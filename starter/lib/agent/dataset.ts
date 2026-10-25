// Read-only access to the JSONL snapshot for the agent's tools. Loaded once per
// process from ../dataset/data (or DATASET_DIR). No database needed.

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

export type Row = Record<string, unknown> & { id: string }

const cache = new Map<string, Row[]>()

export function rows(collection: string): Row[] {
  const hit = cache.get(collection)
  if (hit) return hit
  const dir = process.env.DATASET_DIR ?? path.resolve(process.cwd(), "../dataset/data")
  const parsed = readFileSync(path.join(dir, `${collection}.jsonl`), "utf8")
    .split("\n").filter(Boolean).map((line) => JSON.parse(line) as Row)
  cache.set(collection, parsed)
  return parsed
}

export const byId = (collection: string, id: unknown) => rows(collection).find((row) => row.id === id)
export const forOrder = (collection: string, orderId: string) => rows(collection).filter((row) => row.order_id === orderId)

/** Accepts "ord-00322", "CD-420322" or "420322". */
export function findOrder(ref: string): Row | undefined {
  const clean = ref.trim().toUpperCase()
  return rows("orders").find((order) => order.id === ref || String(order.reference).toUpperCase() === clean || String(order.reference).endsWith(clean))
}

let tableIndex: Map<string, string> | undefined

/** The table a record id really lives in ("travel-x…" → "travel_options"), from the files themselves. */
export function tableOf(id: unknown): string | undefined {
  if (!tableIndex) {
    tableIndex = new Map()
    const dir = process.env.DATASET_DIR ?? path.resolve(process.cwd(), "../dataset/data")
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
      for (const row of rows(file.replace(/\.jsonl$/, ""))) tableIndex.set(row.id, file.replace(/\.jsonl$/, ""))
    }
  }
  return typeof id === "string" ? tableIndex.get(id) : undefined
}

export const SNAPSHOT_AT = "2026-10-21T09:00:00Z"

export function minutesBeforeSnapshot(iso: unknown): number | null {
  if (typeof iso !== "string") return null
  return Math.round((Date.parse(SNAPSHOT_AT) - Date.parse(iso)) / 60000)
}

export function actorName(type: unknown, id: unknown): string {
  if (type === "driver") return String(byId("drivers", id)?.display_name ?? id)
  if (type === "customer") return String(byId("customers", id)?.name ?? id)
  if (type === "agent") return String(byId("agents", id)?.title ?? id)
  if (type === "operator") return String(byId("operators", id)?.title ?? byId("operators", id)?.name ?? id)
  return String(id)
}
