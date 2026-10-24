// Where the control room gets its queue and cases. Until Lane B's routes exist
// this reads the contract fixtures; set USE_FIXTURES=0 to read /api/queue and
// /api/orders/:id/case instead. Pages never read fixtures directly.

import "server-only"
import type { CaseView, QueueItem, QueueResponse } from "@/lib/contracts"
import queueFixture from "@/lib/contracts/fixtures/queue.json"
import case299 from "@/lib/contracts/fixtures/case-ord-00299.json"
import case322 from "@/lib/contracts/fixtures/case-ord-00322.json"

const FIXTURE_CASES: Record<string, CaseView> = {
  "ord-00299": case299 as CaseView,
  "ord-00322": case322 as CaseView,
}

const useFixtures = process.env.USE_FIXTURES !== "0"
const appUrl = process.env.APP_URL ?? "http://localhost:3000"

export async function getQueue(): Promise<QueueResponse> {
  if (useFixtures) return queueFixture as QueueResponse
  const response = await fetch(`${appUrl}/api/queue`, { cache: "no-store" })
  if (!response.ok) throw new Error(`Queue failed: ${response.status}`)
  return response.json() as Promise<QueueResponse>
}

/** The full case when one exists; otherwise a short one built from its queue item, or null. */
export async function getCase(orderId: string): Promise<{ view: CaseView; item: QueueItem | null; full: boolean } | null> {
  const queue = await getQueue()
  const item = [...queue.needsPerson, ...(queue.agentsWorking ?? [])].find((entry) => entry.orderId === orderId) ?? null

  let full: CaseView | null = null
  if (useFixtures) full = FIXTURE_CASES[orderId] ?? null
  else {
    const response = await fetch(`${appUrl}/api/orders/${encodeURIComponent(orderId)}/case`, { cache: "no-store" })
    if (response.ok) full = (await response.json()) as CaseView
  }
  if (full) return { view: full, item, full: true }
  if (!item) return null
  return {
    item,
    full: false,
    view: { orderId, orderReference: item.orderReference, headline: item.headline, facts: [], proposals: [], runs: [], timeline: [] },
  }
}

export const SNAPSHOT_AT = queueFixture.snapshotAt
/** Bahn's operations desk works in Finnish time; customer-facing times keep their own zone. */
export const OPS_ZONE = "Europe/Helsinki"
