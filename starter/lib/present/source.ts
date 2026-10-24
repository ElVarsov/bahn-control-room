// Where the control room gets its queue and cases. By default the hand-checked contract
// fixtures, whose every car, route and name matches the dataset. USE_FIXTURES=0 reads
// Lane B's agent store in process instead (the data behind /api/queue and /case).
// Pages never read either directly.

import "server-only"
import type { CaseView, Fact, QueueItem, QueueResponse, TimelineEntry } from "@/lib/contracts"
import { allCalls } from "@/lib/voice"
import { driverContext } from "@/lib/voice/driver-context"
import queueFixture from "@/lib/contracts/fixtures/queue.json"
import case299 from "@/lib/contracts/fixtures/case-ord-00299.json"
import case322 from "@/lib/contracts/fixtures/case-ord-00322.json"
import { worldStore } from "@/lib/world/store"

const FIXTURE_CASES: Record<string, CaseView> = {
  "ord-00299": case299 as CaseView,
  "ord-00322": case322 as CaseView,
}

const useFixtures = process.env.USE_FIXTURES !== "0"

export async function getQueue(): Promise<QueueResponse> {
  const queue: QueueResponse = useFixtures ? (queueFixture as QueueResponse) : worldStore.getQueue()
  // Live phone calls run in this process, so they join the queue as they happen.
  const calls = callItems()
  return {
    ...queue,
    needsPerson: [...calls.needsPerson, ...queue.needsPerson],
    agentsWorking: [...calls.working, ...(queue.agentsWorking ?? [])],
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
        agentDid: `Took ${call.request.driverName}'s call${minutes ? ` (${minutes} min)` : ""} and wrote down what they said.`,
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
      text: `${call.request.direction === "inbound" ? `${call.request.driverName} called Bahn.` : `Phoned ${call.request.driverName}.`} ${call.summary}`,
    }] : []),
  }
}

/** The full case when one exists; otherwise a short one built from its queue item, or null. */
export async function getCase(orderId: string): Promise<{ view: CaseView; item: QueueItem | null; full: boolean } | null> {
  const queue = await getQueue()
  const item = [...queue.needsPerson, ...(queue.agentsWorking ?? [])].find((entry) => entry.orderId === orderId) ?? null

  const full: CaseView | null = useFixtures ? FIXTURE_CASES[orderId] ?? null : worldStore.getCase(orderId)
  const live = callFacts(orderId)
  if (full) return { view: { ...full, facts: [...live.facts, ...full.facts], timeline: [...full.timeline, ...live.timeline] }, item, full: true }
  if (!item) return null
  return {
    item,
    full: false,
    view: { orderId, orderReference: item.orderReference, headline: item.headline, facts: live.facts, proposals: [], runs: [], timeline: live.timeline },
  }
}

export const SNAPSHOT_AT = queueFixture.snapshotAt
/** Bahn's operations desk works in Finnish time; customer-facing times keep their own zone. */
export const OPS_ZONE = "Europe/Helsinki"
