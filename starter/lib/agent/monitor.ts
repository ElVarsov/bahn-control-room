// Journey Monitor: continuously checks active in-transit deliveries.
// Compares telemetry (progress, ETA, staleness) against customer delivery promises,
// Baltic ferry check-in cutoffs and compound hours. Emits early forecasts before
// domino delays strike. Forecasts carry strength "estimate", never treated as facts.

import type { Change, Fact, QueueItem, Urgency } from "@/lib/contracts"
import { actorName, byId, forOrder, minutesBeforeSnapshot, rows, SNAPSHOT_AT, type Row } from "./dataset"
import { carOf, resolveOrder, routeOf } from "./tools"
import { startRun } from "./loop"
import { allRuns, type RunRecord } from "./runs"

export interface JourneyForecast {
  orderId: string
  orderReference: string
  car: string
  route: string
  customer: string
  driver: string
  driverId?: string
  status: string
  urgency: Urgency
  headline: string
  summary: string
  reasons: string[]
  facts: Fact[]
  estimatedArrival?: string
  promiseDeadline?: string
  hoursDelayed?: number
  trackingAgeMinutes?: number
  ferryDeparture?: string
  needsIntervention: boolean
}

/**
 * Scans all moving cars in the fleet. Computes delay risks, ferry cutoff
 * breaches, and stale tracking gaps against the snapshot timestamp.
 */
export function scanJourneys(): JourneyForecast[] {
  const movingOrders = rows("orders").filter((o) => o.status === "IN_TRANSIT" || o.display_lane === "moving")
  const forecasts: JourneyForecast[] = []

  for (const order of movingOrders) {
    const forecast = evaluateJourney(order)
    if (forecast) {
      forecasts.push(forecast)
    }
  }

  // Sort by urgency: now > today > soon > watch
  const weight: Record<Urgency, number> = { now: 4, today: 3, soon: 2, watch: 1 }
  return forecasts.sort((a, b) => weight[b.urgency] - weight[a.urgency])
}

/**
 * Evaluates one order's telemetry against promises and ferry timetables.
 */
export function evaluateJourney(orderRef: Row | string): JourneyForecast | null {
  const order = typeof orderRef === "string" ? resolveOrder(orderRef) : orderRef
  const customer = String(byId("customers", order.customer_id)?.name ?? "Unknown Customer")
  const car = carOf(order)
  const route = routeOf(order)

  // Assigned driver
  const assignment = forOrder("work_assignments", order.id).find((a) => a.status !== "COMPLETED" && a.status !== "CANCELLED")
  const driver = assignment ? actorName("driver", assignment.driver_id) : "Unassigned"
  const driverId = assignment ? String(assignment.driver_id) : undefined

  // Tracking observations (latest first)
  const obs = forOrder("tracking_observations", order.id).sort((a, b) =>
    String(b.observed_at).localeCompare(String(a.observed_at))
  )
  const latestObs = obs[0]

  // Delivery promise window
  const promiseWindow = forOrder("time_windows", order.id).find(
    (w) => w.purpose === "CUSTOMER_DELIVERY_PROMISE" && w.is_selected
  )
  const promiseEnd = promiseWindow ? String(promiseWindow.end_at) : undefined

  // Booked / quoted travel (ferries)
  const ferries = forOrder("travel_reservations", order.id)
    .concat(forOrder("travel_options", order.id) as any[])
    .filter((t) => t.kind === "FERRY" && t.status !== "CANCELLED")
  const upcomingFerry = ferries.sort((a, b) => String(a.departure_at).localeCompare(String(b.departure_at)))[0]

  const reasons: string[] = []
  const facts: Fact[] = []
  let urgency: Urgency = "watch"
  let hoursDelayed: number | undefined

  // 1. Check Tracking Staleness (Gap > 3 hours)
  const ageMinutes = latestObs ? minutesBeforeSnapshot(latestObs.observed_at) : null
  if (ageMinutes != null && ageMinutes > 180) {
    const hours = Math.round(ageMinutes / 60)
    reasons.push(`Tracking gap: no position update for ${hours} hours`)
    facts.push({
      id: `${order.id}-forecast-telemetry`,
      text: `Driver-app telemetry is ${hours}h stale (last update ${ageMinutes}m before snapshot). Movement unverified.`,
      strength: "estimate",
      sources: [{
        kind: "system",
        label: "Tracking Telemetry Watcher",
        at: SNAPSHOT_AT,
        table: "tracking_observations",
        recordId: latestObs?.id,
      }],
    })
    if (hours >= 12) urgency = "today"
    if (hours >= 20) urgency = "now"
  }

  // 2. Check Delivery Promise Breach
  const eta = latestObs?.estimated_delivery_at ? String(latestObs.estimated_delivery_at) : null
  if (eta && promiseEnd) {
    const etaMs = Date.parse(eta)
    const promiseMs = Date.parse(promiseEnd)
    if (etaMs > promiseMs) {
      hoursDelayed = Math.max(1, Math.round((etaMs - promiseMs) / 3600000))
      reasons.push(`Delivery SLA breach: ETA is ${hoursDelayed}h past customer promise (${promiseEnd.slice(11, 16)} UTC)`)
      facts.push({
        id: `${order.id}-forecast-promise`,
        text: `Calculated ETA (${eta.replace("T", " ").slice(0, 16)}) breaches promised customer delivery window (${promiseEnd.replace("T", " ").slice(0, 16)}) by ~${hoursDelayed} hours.`,
        strength: "estimate",
        sources: [{
          kind: "system",
          label: "SLA ETA Forecaster",
          at: SNAPSHOT_AT,
          table: "time_windows",
          recordId: promiseWindow?.id,
        }],
      })
      urgency = hoursDelayed >= 4 ? "now" : "today"
    }
  }

  // 3. Check Ferry Check-In Cutoff Breach
  if (upcomingFerry && eta) {
    const cutoffStr = (upcomingFerry.check_in_cutoff_at as string) ?? upcomingFerry.departure_at
    const cutoffMs = Date.parse(cutoffStr)
    const departureStr = String(upcomingFerry.departure_at)
    // If estimated arrival at port is after check-in cutoff
    if (Date.parse(eta) > cutoffMs - 30 * 60000) {
      reasons.push(`Ferry check-in cutoff at risk for ${departureStr.slice(11, 16)} departure`)
      facts.push({
        id: `${order.id}-forecast-ferry`,
        text: `Projected transit arrival breaches Baltic ferry check-in cutoff for ${departureStr}. Missed sailing triggers overnight delay.`,
        strength: "estimate",
        sources: [{
          kind: "provider",
          label: "Vela Coast / Scandlines Timetable",
          at: SNAPSHOT_AT,
          table: "travel_reservations",
          recordId: upcomingFerry?.id,
        }],
      })
      urgency = "now"
    }
  }

  // If no risk signals detected, return clean null
  if (reasons.length === 0) {
    return null
  }

  const headline = reasons[0]
  const summary = `Journey Monitor Alert: ${reasons.join(". ")}. Action required to protect delivery SLA.`

  return {
    orderId: order.id,
    orderReference: String(order.reference),
    car,
    route,
    customer,
    driver,
    driverId,
    status: String(order.status),
    urgency,
    headline,
    summary,
    reasons,
    facts,
    estimatedArrival: eta ?? undefined,
    promiseDeadline: promiseEnd,
    hoursDelayed,
    trackingAgeMinutes: ageMinutes ?? undefined,
    ferryDeparture: upcomingFerry ? String(upcomingFerry.departure_at) : undefined,
    needsIntervention: urgency === "now" || urgency === "today",
  }
}

/**
 * Launches an agent run for a high-risk journey forecast.
 */
export function startJourneyResolution(orderRef: string, forecast?: JourneyForecast | null): RunRecord {
  const f = forecast ?? evaluateJourney(orderRef)
  const trigger = f
    ? `Journey Monitor forecasted exception: ${f.summary}`
    : `Journey Monitor flagged transit exception on ${orderRef}`

  const record = startRun({
    order: orderRef,
    trigger,
    driverMode: "auto",
  })

  if (f?.facts) {
    for (const fact of f.facts) {
      record.facts.push(fact)
    }
  }

  return record
}
