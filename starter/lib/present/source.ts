// Where the control room gets its queue and cases. By default the hand-checked contract
// fixtures, whose every car, route and name matches the dataset. USE_FIXTURES=0 reads
// Lane B's agent store in process instead (the data behind /api/queue and /case).
// Pages never read either directly.

import "server-only"
import type { CaseView, Fact, QueueItem, QueueResponse, SourceKind, TimelineEntry } from "@/lib/contracts"
import { actorName, forOrder } from "@/lib/agent/dataset"
import { evaluateJourney, scanJourneys } from "@/lib/agent/monitor"
import { allRuns, latestRunFor, type RunRecord } from "@/lib/agent/runs"
import { allCalls } from "@/lib/voice"
import { driverContext } from "@/lib/voice/driver-context"
import queueFixture from "@/lib/contracts/fixtures/queue.json"
import case299 from "@/lib/contracts/fixtures/case-ord-00299.json"
import case322 from "@/lib/contracts/fixtures/case-ord-00322.json"
import { worldStore } from "@/lib/world/store"
import { evaluateCascadeRisk, scanAllCascadeRisks } from "@/lib/cascade-risk"

const FIXTURE_CASES: Record<string, CaseView> = {
  "ord-00299": case299 as CaseView,
  "ord-00322": case322 as CaseView,
}

const useFixtures = process.env.USE_FIXTURES !== "0"

export async function getQueue(): Promise<QueueResponse> {
  const queue: QueueResponse = useFixtures ? (queueFixture as QueueResponse) : worldStore.getQueue()
  // Live phone calls, agent runs and journey forecasts happen in this process, so they
  // join the queue as they happen. An order the agent has worked replaces its sample entry.
  const calls = callItems()
  const agent = agentItems()
  const keep = (item: QueueItem) => !agent.orders.has(item.orderId)

  // Journey Monitor forecasts for moving fleet
  // One entry per order: a forecast never duplicates something already in the queue.
  const accounted = new Set([
    ...calls.needsPerson, ...calls.working, ...agent.needsPerson, ...agent.working,
    ...queue.needsPerson.filter(keep), ...(queue.agentsWorking ?? []).filter(keep),
  ].map((x) => x.orderId))
  const forecasts = journeyForecastItems(accounted)
  const cascadeRisks = scanAllCascadeRisks()

  return {
    ...queue,
    needsPerson: [...calls.needsPerson, ...agent.needsPerson, ...forecasts.needsPerson, ...queue.needsPerson.filter(keep)],
    agentsWorking: [...calls.working, ...agent.working, ...forecasts.working, ...(queue.agentsWorking ?? []).filter(keep)],
    quiet: { ...queue.quiet, count: Math.max(0, queue.quiet.count + agent.settled - forecasts.needsPerson.length - forecasts.working.length) },
    cascadeRisks,
  }
}

function journeyForecastItems(existingOrders: Set<string>): { needsPerson: QueueItem[]; working: QueueItem[] } {
  const needsPerson: QueueItem[] = []
  const working: QueueItem[] = []
  const forecasts = scanJourneys()

  for (const f of forecasts) {
    if (existingOrders.has(f.orderId)) continue
    const base: QueueItem = {
      id: `forecast-${f.orderId}`,
      orderId: f.orderId,
      orderReference: f.orderReference,
      car: f.car,
      route: f.route,
      customer: f.customer,
      headline: f.headline,
      why: f.summary,
      urgency: f.urgency,
      updatedAt: SNAPSHOT_AT,
      reason: "forecast",
      agentDid: "The journey monitor compared the latest driver-app data with the delivery promise and any booked ferry.",
      agentState: "working",
    }
    if (f.needsIntervention) {
      needsPerson.push({
        ...base,
        agentState: "needs_person",
      })
    } else {
      working.push(base)
    }
  }
  return { needsPerson, working }
}

// --- agent runs ------------------------------------------------------------------

function agentItems(): { needsPerson: QueueItem[]; working: QueueItem[]; orders: Set<string>; settled: number } {
  const needsPerson: QueueItem[] = []
  const working: QueueItem[] = []
  const orders = new Set<string>()
  let settled = 0
  const latest = new Map<string, RunRecord>()
  for (const record of allRuns()) latest.set(record.orderId, record)
  for (const record of latest.values()) {
    orders.add(record.orderId)
    const base = {
      id: record.run.id, orderId: record.orderId, orderReference: record.orderReference,
      car: record.car, route: record.route, customer: record.customer, updatedAt: SNAPSHOT_AT,
    }
    const state = record.run.state
    if (state === "working") {
      const last = [...record.run.steps].reverse().find((step) => step.kind === "tool_result" || step.kind === "call")
      working.push({ ...base, headline: "The agent is working on this order", why: (last && "summary" in last ? last.summary : undefined) ?? "Reading the records.", urgency: "watch", agentState: "working" })
    } else if (state === "needs_person") {
      const pending = record.proposals.filter((p) => p.status === "pending")
      needsPerson.push({
        ...base,
        reason: pending.some((p) => p.action !== "handover_to_person") ? "decision" : "handover",
        headline: record.headline ?? pending[0]?.title ?? "The agent needs a person",
        why: record.summary ?? "",
        agentDid: record.agentDid,
        urgency: record.urgency && record.urgency !== "watch" ? record.urgency : "today",
        decideBy: record.decideBy,
        proposalId: pending[0]?.id,
        agentState: "needs_person",
      })
    } else if (state === "waiting_reply") {
      working.push({ ...base, headline: record.headline ?? "Waiting for a reply", why: record.summary ?? "", urgency: "watch", agentState: "waiting_reply" })
    } else {
      settled += 1
    }
  }
  return { needsPerson, working, orders, settled }
}

const AUTHOR_KIND: Record<string, SourceKind> = { driver: "driver", customer: "customer", operator: "operator", agent: "agent", site_contact: "site", site: "site" }

/** The order's real conversation from the dataset, for the case timeline. */
function datasetTimeline(orderId: string): TimelineEntry[] {
  return forOrder("messages", orderId).map((m) => ({
    id: String(m.id),
    at: String(m.authored_at),
    actor: { kind: AUTHOR_KIND[String(m.author_type)] ?? "system", name: actorName(m.author_type, m.author_id) },
    channel: String(m.channel),
    visibility: m.visibility === "INTERNAL" ? "internal" : "public",
    text: String(m.body),
    recordId: String(m.id),
  }))
}

function agentCase(orderId: string, record: RunRecord): CaseView {
  const runs = allRuns().filter((r) => r.orderId === orderId)
  const outgoing: TimelineEntry[] = runs.flatMap((r) => r.run.steps.flatMap((step, index) => step.kind === "message_out" ? [{
    id: `${r.run.id}-m${index}`,
    at: SNAPSHOT_AT,
    actor: { kind: "agent" as const, name: "Road agent" },
    channel: step.channel,
    visibility: "public" as const,
    text: `To ${step.toName}: ${step.body}`,
  }] : []))
  return {
    orderId,
    orderReference: record.orderReference,
    headline: record.headline ?? record.summary ?? "The agent is working on this order.",
    facts: [...runs].reverse().flatMap((r) => r.facts),
    proposals: runs.flatMap((r) => r.proposals),
    runs: runs.map((r) => r.run),
    timeline: [...datasetTimeline(orderId), ...outgoing],
  }
}

// --- live phone calls -------------------------------------------------------
// The dataset is frozen at its snapshot time, so a call happening today is shown
// as happening "now" in that world, and gets a deadline from its urgency.

const URGENCY_MINUTES = { now: 15, today: 180, soon: 24 * 60 } as const
function snapshotPlus(minutes: number): string {
  return new Date(Date.parse(queueFixture.snapshotAt) + minutes * 60000).toISOString()
}

function callItems(): { needsPerson: QueueItem[]; working: QueueItem[] } {
  const needsPerson: QueueItem[] = []
  const working: QueueItem[] = []
  for (const call of allCalls()) {
    const job = driverContext(call.request.driverId).jobs.find((j) => j.orderId === call.request.orderId)
    const base = {
      id: call.id,
      orderId: call.request.orderId || `call:${call.id}`,
      orderReference: job?.reference ?? call.orderReference ?? "No order linked",
      car: job?.car ?? "Unknown car",
      route: job?.route ?? "",
      updatedAt: queueFixture.snapshotAt,
    }
    const inbound = call.request.direction === "inbound"
    if (call.status === "ringing" || call.status === "in_call") {
      working.push({
        ...base,
        headline: inbound ? `${call.request.driverName} is on the phone with the agent` : `Agent is calling ${call.request.driverName}`,
        why: call.summary || call.request.purpose,
        urgency: "watch",
        agentState: "working",
      })
    } else if (inbound && call.status === "completed" && call.queueHeadline) {
      const minutes = call.answeredAt && call.endedAt ? Math.max(1, Math.round((Date.parse(call.endedAt) - Date.parse(call.answeredAt)) / 60000)) : null
      needsPerson.push({
        ...base,
        reason: "driver_report",
        stage: job?.status === "driving it now" ? "Moving" : job ? "Driver booked" : undefined,
        headline: call.queueHeadline,
        why: call.summary,
        agentDid: call.scripted
          ? `The AI was unavailable, so a scripted backup took ${call.request.driverName}'s call${minutes ? ` (${minutes} min)` : ""}. Read the transcript before acting.`
          : `Took ${call.request.driverName}'s call${minutes ? ` (${minutes} min)` : ""} and wrote down what they said.`,
        urgency: call.urgency ?? "today",
        decideBy: snapshotPlus(URGENCY_MINUTES[call.urgency ?? "today"]),
        agentState: "needs_person",
      })
    }
  }
  return { needsPerson, working }
}

function callFacts(orderId: string): { facts: Fact[]; timeline: TimelineEntry[] } {
  const calls = allCalls().filter((call) => call.request.orderId === orderId || `call:${call.id}` === orderId)
  return {
    facts: calls.flatMap((call) => call.facts.map((fact) => ({ ...fact, sources: fact.sources.map((source) => ({ ...source, at: queueFixture.snapshotAt })) }))),
    timeline: calls.flatMap((call) => call.answeredAt ? [{
      id: call.id,
      at: queueFixture.snapshotAt,
      actor: { kind: "agent" as const, name: "Road agent" },
      channel: "phone",
      visibility: "public" as const,
      text: `${call.request.direction === "inbound" ? `${call.request.driverName} called Bahn.` : `Phoned ${call.request.driverName}.`}${call.scripted ? " Scripted backup answered, not the AI." : ""} ${call.summary}`,
    }] : []),
  }
}

/** The full case when one exists; otherwise a short one built from its queue item, or null. */
export async function getCase(orderId: string): Promise<{ view: CaseView; item: QueueItem | null; full: boolean } | null> {
  const queue = await getQueue()
  const item = [...queue.needsPerson, ...(queue.agentsWorking ?? [])].find((entry) => entry.orderId === orderId) ?? null

  const run = latestRunFor(orderId)
  const full: CaseView | null = run ? agentCase(orderId, run) : useFixtures ? FIXTURE_CASES[orderId] ?? null : worldStore.getCase(orderId)
  const live = callFacts(orderId)
  const forecast = evaluateJourney(orderId)
  const forecastFacts = forecast ? forecast.facts : []
  const cascadeAssessment = evaluateCascadeRisk(orderId)

  if (full) {
    return {
      view: {
        ...full,
        facts: [...forecastFacts, ...live.facts, ...full.facts],
        timeline: [...full.timeline, ...live.timeline],
        cascadeAssessment,
      },
      item,
      full: true,
    }
  }

  if (!item && !cascadeAssessment) return null

  return {
    item: item ?? {
      id: `order-${orderId}`,
      orderId,
      orderReference: cascadeAssessment?.orderReference ?? orderId,
      car: cascadeAssessment?.car ?? "Delivery Vehicle",
      route: cascadeAssessment?.route ?? "Transit Route",
      headline: cascadeAssessment?.summary ?? "Cascade Risk Review",
      why: cascadeAssessment?.rootCause ?? "Predictive Cascade Risk Flagged",
      urgency: cascadeAssessment?.triageState === "NEEDS_DECISION_NOW" ? "now" : "today",
      agentState: "needs_person",
      updatedAt: SNAPSHOT_AT,
    },
    full: false,
    view: {
      orderId,
      orderReference: item?.orderReference ?? cascadeAssessment?.orderReference ?? orderId,
      headline: item?.headline ?? cascadeAssessment?.summary ?? "Order Cascade Review",
      facts: [...forecastFacts, ...live.facts],
      proposals: [],
      runs: [],
      timeline: live.timeline,
      cascadeAssessment,
    },
  }
}

export const SNAPSHOT_AT = queueFixture.snapshotAt
/** Bahn's operations desk works in Finnish time; customer-facing times keep their own zone. */
export const OPS_ZONE = "Europe/Helsinki"
