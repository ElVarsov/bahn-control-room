// Persistent store of agent runs, their proposals and facts. Every finished run is
// saved to traces/<runId>.json, and loaded back into memory on startup so restarts
// never clear active runs or proposals.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
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

function getTracesDir(): string {
  const local = path.resolve(process.cwd(), "traces")
  if (existsSync(local)) return local
  const parent = path.resolve(process.cwd(), "../traces")
  return parent
}

function loadTracesFromDisk(): Map<string, RunRecord> {
  const map = new Map<string, RunRecord>()
  try {
    const dir = getTracesDir()
    if (!existsSync(dir)) return map
    const files = readdirSync(dir).filter((f) => f.startsWith("run-") && f.endsWith(".json"))
    for (const file of files) {
      try {
        const content = readFileSync(path.join(dir, file), "utf8")
        const record = JSON.parse(content) as RunRecord
        if (record?.run?.id) {
          map.set(record.run.id, record)
        }
      } catch (e) {
        // Ignore malformed trace file
      }
    }
  } catch (error) {
    console.warn("[agent] could not load initial traces", error)
  }
  return map
}

type Store = { runs: Map<string, RunRecord> }
const g = globalThis as typeof globalThis & { __agentRuns?: Store }
const store = (g.__agentRuns ??= { runs: loadTracesFromDisk() })

export function saveRun(record: RunRecord) {
  store.runs.set(record.run.id, record)
  writeTrace(record)
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
    const dir = getTracesDir()
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, `${record.run.id}.json`), JSON.stringify(record, null, 2))
  } catch (error) {
    console.warn("[agent] could not write trace", error)
  }
}

export type { Decision }
