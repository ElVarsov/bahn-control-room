// In-memory store of agent runs, their proposals and facts. Every finished run is
// also written to traces/<runId>.json so judges and teammates can read what it did.

import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { AgentRun, Decision, Fact, Proposal, TraceStep, Urgency } from "@/lib/contracts"

export type RunRecord = {
  run: AgentRun
  orderId: string
  orderReference: string
  car: string
  route: string
  customer: string
  proposals: Proposal[]
  facts: Fact[]
  outcome?: "needs_person" | "facts_line_up" | "waiting_reply" | "error"
  headline?: string
  summary?: string
  agentDid?: string
  urgency?: Urgency
  decideBy?: string
  model: string
  usage: { inputTokens: number; outputTokens: number }
}

type Store = { runs: Map<string, RunRecord> }
const g = globalThis as typeof globalThis & { __agentRuns?: Store }
const store = (g.__agentRuns ??= { runs: new Map() })

export function saveRun(record: RunRecord) {
  store.runs.set(record.run.id, record)
}

export function getRun(id: string) {
  return store.runs.get(id)
}

export function allRuns(): RunRecord[] {
  return [...store.runs.values()].sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt))
}

/** The newest run per order. */
export function latestRunFor(orderId: string): RunRecord | undefined {
  return allRuns().filter((record) => record.orderId === orderId).at(-1)
}

export function addStep(record: RunRecord, step: TraceStep) {
  record.run.steps.push(step)
}

export function findProposal(proposalId: string): { record: RunRecord; proposal: Proposal } | undefined {
  for (const record of store.runs.values()) {
    const proposal = record.proposals.find((p: Proposal) => p.id === proposalId)
    if (proposal) return { record, proposal }
  }
  return undefined
}

export function writeTrace(record: RunRecord) {
  try {
    const dir = path.resolve(process.cwd(), "../traces")
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, `${record.run.id}.json`), JSON.stringify(record, null, 2))
  } catch (error) {
    console.warn("[agent] could not write trace", error)
  }
}

export type { Decision }
