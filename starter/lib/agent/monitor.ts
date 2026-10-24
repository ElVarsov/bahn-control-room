// Journey Monitor: continuously checks active in-transit deliveries.
// Compares telemetry (progress, ETA, staleness) against customer delivery promises,
// Baltic ferry check-in cutoffs and compound hours. Emits early forecasts before
// domino delays strike. Forecasts carry strength "estimate", never treated as facts.

import type { Change, Fact, QueueItem, Urgency } from "@/lib/contracts"
import { fmtClock, fmtDateTime } from "@/lib/present/time"
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

  // Only booked ferries count (a quote is not a booking), and only ones still ahead of us.
  const upcomingFerry = forOrder("travel_reservations", order.id)
    .filter((t) => t.kind === "FERRY" && t.status !== "CANCELLED" && Date.parse(String(t.departure_at)) > Date.parse(SNAPSHOT_AT))
    .sort((a, b) => String(a.departure_at).localeCompare(String(b.departure_at)))[0]
  const promiseZone = promiseWindow?.timezone ? String(promiseWindow.timezone) : null

  const reasons: string[] = []
  const facts: Fact[] = []
  let urgency: Urgency = "watch"
  let hoursDelayed: number | undefined

  // 1. Check Tracking Staleness (Gap > 3 hours)
  const ageMinutes = latestObs ? minutesBeforeSnapshot(latestObs.observed_at) : null
  if (ageMinutes != null && ageMinutes > 180) {
    const hours = Math.round(ageMinutes / 60)
    reasons.push(`No position from the driver app for ${hours} h`)
    facts.push({
      id: `${order.id}-forecast-telemetry`,
      text: `No driver-app position for ${hours} h. Whether the car is moving is not known.`,
      strength: "estimate",
      sources: [{
        kind: "system",
        label: "Driver-app tracking",
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
      reasons.push(`Likely about ${hoursDelayed} h late: the last ETA is ${fmtDateTime(eta, promiseZone, false)}, the promise ends ${fmtDateTime(promiseEnd, promiseZone)}`)
      facts.push({
        id: `${order.id}-forecast-promise`,
        text: `The last driver-app ETA (${fmtDateTime(eta, promiseZone)}) is about ${hoursDelayed} h after the promised window ends (${fmtDateTime(promiseEnd, promiseZone)}). This is an estimate from the app, not a confirmed delay.`,
        strength: "estimate",
        sources: [{
          kind: "system",
          label: "Driver-app ETA",
          at: SNAPSHOT_AT,
          table: "time_windows",
          recordId: promiseWindow?.id,
        }],
      })
      urgency = hoursDelayed >= 4 ? "now" : "today"
    }
  }

  // 3. Booked ferry ahead, check-in not confirmed, and we cannot see the car.
  // The dataset's road times are planning ranges and must not be turned into a live
  // terminal ETA, so we only raise this when the position is stale and the cutoff is near.
  if (upcomingFerry && upcomingFerry.check_in_confirmation !== "CONFIRMED") {
    const cutoff = String(upcomingFerry.check_in_cutoff_at ?? upcomingFerry.departure_at)
    const minutesToCutoff = -(minutesBeforeSnapshot(cutoff) ?? 0)
    const stale = ageMinutes == null || ageMinutes > 120
    if (stale && minutesToCutoff > 0 && minutesToCutoff <= 12 * 60) {
      const terminal = byId("ferry_terminals", upcomingFerry.origin_terminal_id)
      const zone = terminal?.timezone ? String(terminal.timezone) : "Europe/Berlin"
      const where = String(terminal?.name ?? upcomingFerry.origin_terminal ?? "the terminal")
      reasons.push(`Ferry check-in at ${where} closes ${fmtClock(cutoff, zone)} and the car's position is ${ageMinutes == null ? "unknown" : `${Math.round(ageMinutes / 60)} h old`}`)
      facts.push({
        id: `${order.id}-forecast-ferry`,
        text: `Booked ferry ${upcomingFerry.booking_reference ?? ""} departs ${fmtDateTime(String(upcomingFerry.departure_at), zone)}; check-in closes ${fmtDateTime(cutoff, zone)} and is not confirmed. With no recent position we cannot tell whether the car will make it.`,
        strength: "unknown",
        sources: [{
          kind: "provider",
          label: "Ferry booking (Vela Coast Lines, fictional)",
          at: String(upcomingFerry.booked_at ?? SNAPSHOT_AT),
          table: "travel_reservations",
          recordId: upcomingFerry.id,
        }],
      })
      urgency = minutesToCutoff <= 4 * 60 ? "now" : urgency === "now" ? "now" : "today"
    }
  }

  // If no risk signals detected, return clean null
  if (reasons.length === 0) {
    return null
  }

  const headline = reasons[0]
  const summary = `${reasons.join(". ")}. Forecast from the journey monitor, not a confirmed problem.`

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
