import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db, isDbAvailable } from "@/lib/db"
import { buildInboxView } from "@/lib/present/inbox"
import { loadShared, orderRefs } from "@/lib/present/load"
import { relatedRecords } from "@/lib/schema"
import { Directory } from "@/lib/present/actors"
import { readDataset } from "@/lib/present/dataset"

export const runtime = "nodejs"

export async function GET() {
  const hasDb = await isDbAvailable()

  if (hasDb) {
    try {
      const [threadRows, messageRows, shared] = await Promise.all([
        db.select().from(relatedRecords).where(eq(relatedRecords.collection, "support_inbox_threads")),
        db.select().from(relatedRecords).where(eq(relatedRecords.collection, "support_inbox_messages")),
        loadShared(),
      ])
      const threads = threadRows.map((row) => row.details)
        .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)))
      const messages = messageRows.map((row) => row.details)
        .sort((left, right) => String(left.authored_at).localeCompare(String(right.authored_at)))
      const ids = threads.flatMap((thread) => [...(Array.isArray(thread.candidate_order_ids) ? thread.candidate_order_ids : []), ...(Array.isArray(thread.linked_order_ids) ? thread.linked_order_ids : [])])
        .filter((value): value is string => typeof value === "string")
      const refs = await orderRefs(ids)
      const view = buildInboxView(threads, messages, shared.makeDirectory(), refs, shared.snapshotAt)
      return NextResponse.json({ threads, messages, view })
    } catch (err) {
      // fallback below
    }
  }

  // Graceful fallback to dataset JSONL files when postgres is unavailable
  const threads = readDataset("support_inbox_threads")
    .sort((left: any, right: any) => String(right.updated_at).localeCompare(String(left.updated_at)))
  const messages = readDataset("support_inbox_messages")
    .sort((left: any, right: any) => String(left.authored_at).localeCompare(String(right.authored_at)))

  const drivers = readDataset("drivers")
  const customers = readDataset("customers")
  const sites = readDataset("sites")
  const endpointDetails = readDataset("order_endpoint_details")
  const operators = readDataset("operators")
  const agents = readDataset("agents")
  const orders = readDataset("orders")

  const refs = Object.fromEntries(orders.map((o: any) => [o.id, o.reference]))

  const dir = new Directory({
    drivers: drivers.map((d: any) => ({ id: d.id, displayName: d.display_name, homeCity: d.home_city, homeCountry: d.home_country })),
    operators,
    agents,
    customers: customers.map((c: any) => ({ id: c.id, name: c.name })),
    sites: sites.map((s: any) => ({ id: s.id, name: s.name })),
    endpointDetails: endpointDetails.map((e: any) => ({ id: e.id, ...e })),
  })

  const view = buildInboxView(threads, messages, dir, refs, "2026-10-21T09:00:00Z")
  return NextResponse.json({ threads, messages, view })
}
