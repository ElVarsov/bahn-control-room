import { NextRequest, NextResponse } from "next/server"
import { buildBoardCard } from "@/lib/present/board"
import { LANE_ORDER } from "@/lib/present/labels"
import { loadBoardBundles } from "@/lib/present/load"
import type { BoardCard, Overview, Tone } from "@/lib/present/types"
import { worldStore } from "@/lib/world/store"
import fs from "node:fs"
import path from "node:path"

export const runtime = "nodejs"

const TONE_RANK: Record<Tone, number> = { danger: 0, warn: 1, accent: 2, neutral: 3, ok: 4 }

function laneSort(lane: string) {
  return (a: BoardCard, b: BoardCard): number => {
    const attention = TONE_RANK[a.attentionTone] - TONE_RANK[b.attentionTone]
    if (attention) return attention
    const aDate = a.decisive?.start ?? ""
    const bDate = b.decisive?.start ?? ""
    if (lane === "delivered" || lane === "cancelled") return bDate.localeCompare(aDate) || b.updatedAt.localeCompare(a.updatedAt)
    if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate)
    if (aDate !== bDate) return aDate ? -1 : 1
    return b.updatedAt.localeCompare(a.updatedAt)
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? ""

  try {
    const { snapshotAt, bundles } = await loadBoardBundles()
    const all = bundles.map(buildBoardCard)
    const counts = Object.fromEntries(LANE_ORDER.map((lane) => [lane, all.filter((card) => card.displayLane === lane).length]))
    const attentionCounts = Object.fromEntries(LANE_ORDER.map((lane) => [lane, all.filter((card) => card.displayLane === lane && card.attention.length > 0).length]))
    const matches = query
      ? all.filter((card) =>
          [card.reference, card.customer, card.vehicle, card.origin, card.destination, card.plate ?? ""].some((field) =>
            field.toLowerCase().includes(query)
          )
        )
      : all
    const visible = LANE_ORDER.flatMap((lane) => matches.filter((card) => card.displayLane === lane).sort(laneSort(lane)))
    const body: Overview = { snapshotAt, total: all.length, counts, attentionCounts, visible, query }
    return NextResponse.json(body)
  } catch (err) {
    // Graceful fallback to dataset JSONL files when postgres is unavailable
    const datasetDir = path.resolve(process.cwd(), "..", "dataset", "data")
    const readJsonl = (name: string) => {
      const p = path.join(datasetDir, `${name}.jsonl`)
      if (!fs.existsSync(p)) return []
      return fs.readFileSync(p, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l))
    }

    const orders = readJsonl("orders")
    const vehicles = new Map(readJsonl("vehicles").map((v: any) => [v.id, v]))
    const items = readJsonl("order_items")
    const customers = new Map(readJsonl("customers").map((c: any) => [c.id, c]))
    const addresses = new Map(readJsonl("addresses").map((a: any) => [a.id, a]))
    const alerts = readJsonl("alerts")

    const orderVeh = new Map<string, any>()
    for (const it of items) {
      if (vehicles.has(it.vehicle_id)) orderVeh.set(it.order_id, vehicles.get(it.vehicle_id))
    }
    const orderAlerts = new Map<string, any[]>()
    for (const a of alerts) {
      const list = orderAlerts.get(a.order_id) ?? []
      list.push(a)
      orderAlerts.set(a.order_id, list)
    }

    const allCards: BoardCard[] = orders.map((o: any) => {
      const v = orderVeh.get(o.id)
      const c = customers.get(o.customer_id)
      const pAddr = addresses.get(o.pickup_address_id)
      const dAddr = addresses.get(o.delivery_address_id)
      const aList = orderAlerts.get(o.id) ?? []

      const attentionItems = aList.map((a: any) => ({
        kind: "alert" as const,
        tone: (a.severity === "high" || a.severity === "critical" ? "danger" : "warn") as Tone,
        title: a.summary || a.signal || "Alert",
        short: a.signal || "Alert",
        detail: a.summary || null,
        owner: null,
        at: a.triggered_at || null,
        atLabel: null,
        section: "alerts",
        recordId: a.id,
      }))

      return {
        id: o.id,
        reference: o.reference,
        displayLane: o.display_lane || "booked",
        status: o.status || "WAITING_FOR_PICKUP",
        statusLabel: o.status || "Booked",
        routeKind: o.route_kind || "DOMESTIC",
        routeKindLabel: o.route_kind || "Domestic",
        customer: c?.name || "Customer",
        customerTier: c?.account_tier || null,
        vehicle: v ? `${v.make} ${v.model}` : "Vehicle",
        vehicleMake: v?.make || null,
        plate: v?.registration_plate || null,
        origin: pAddr?.city || "Germany",
        destination: dAddr?.city || "Finland",
        from: { city: pAddr?.city || "Germany", country: pAddr?.country || "DE" },
        to: { city: dAddr?.city || "Finland", country: dAddr?.country || "FI" },
        openAlerts: aList.filter((a: any) => a.status === "OPEN").map((a: any) => a.id),
        acknowledgedAlerts: aList.filter((a: any) => a.status === "ACKNOWLEDGED").map((a: any) => a.id),
        attention: attentionItems,
        attentionTone: aList.length > 0 ? (aList.some((a: any) => a.severity === "high" || a.severity === "critical") ? "danger" : "warn") : "neutral",
        decisive: {
          key: "pickup_slot",
          label: "Pickup",
          start: o.created_at,
          end: null,
          zone: "Europe/Berlin",
          source: null,
          tone: "neutral",
          note: null,
        },
        work: [],
        updatedAt: o.updated_at,
      } as BoardCard
    })

    const counts = Object.fromEntries(LANE_ORDER.map((lane) => [lane, allCards.filter((card) => card.displayLane === lane).length]))
    const attentionCounts = Object.fromEntries(LANE_ORDER.map((lane) => [lane, allCards.filter((card) => card.displayLane === lane && card.attention.length > 0).length]))
    const matches = query
      ? allCards.filter((card) =>
          [card.reference, card.customer, card.vehicle, card.origin, card.destination, card.plate ?? ""].some((field) =>
            field.toLowerCase().includes(query)
          )
        )
      : allCards
    const visible = LANE_ORDER.flatMap((lane) => matches.filter((card) => card.displayLane === lane).sort(laneSort(lane)))
    return NextResponse.json({
      snapshotAt: "2026-10-21T09:00:00Z",
      total: allCards.length,
      counts,
      attentionCounts,
      visible,
      query,
    })
  }
}
