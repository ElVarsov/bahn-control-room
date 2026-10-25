// The road agent's tools. Reading and asking are free; anything that would change a
// booking, a date, a cost or tell a customer something only becomes a proposal.
// Every result carries record ids so facts can point back to their source.

import type Anthropic from "@anthropic-ai/sdk"
import { fmtDateTime } from "@/lib/present/time"
import { SNAPSHOT_AT, actorName, byId, findOrder, forOrder, minutesBeforeSnapshot, rows, type Row } from "./dataset"

type Tool = Anthropic.Beta.BetaTool

const orderParam = { order: { type: "string", description: "Order id or reference, e.g. CD-420322" } }

export const TOOLS: Tool[] = [
  {
    name: "read_order",
    description: "Free. The order: customer, car, route, stage, pickup slot, delivery promise (with time zone and who set it), assigned driver, endpoint contacts and access status.",
    input_schema: { type: "object", properties: orderParam, required: ["order"], additionalProperties: false },
  },
  {
    name: "read_conversation",
    description: "Free. Recent messages on the order: who said what, when, on which channel, and whether it was internal. A message is a claim by its author, not a verified fact.",
    input_schema: { type: "object", properties: orderParam, required: ["order"], additionalProperties: false },
  },
  {
    name: "read_open_issues",
    description: "Free. Alerts (with status), incidents, open work items and earlier agent proposals on the order. An alert is a reason to look, not a diagnosis.",
    input_schema: { type: "object", properties: orderParam, required: ["order"], additionalProperties: false },
  },
  {
    name: "read_tracking",
    description: "Free. Latest driver-app positions and ETAs with how old they are. A stale or missing signal does not prove the car stopped.",
    input_schema: { type: "object", properties: orderParam, required: ["order"], additionalProperties: false },
  },
  {
    name: "read_travel",
    description: "Free. Booked travel (reservations with references) kept apart from quotes and capacity checks. A quote is not a booking.",
    input_schema: { type: "object", properties: orderParam, required: ["order"], additionalProperties: false },
  },
  {
    name: "search_ferries",
    description: "Free. Current vehicle-ferry sailings between two terminals from a given time. Returns quotes only; nothing is reserved.",
    input_schema: {
      type: "object",
      properties: {
        from_terminal: { type: "string" },
        to_terminal: { type: "string" },
        earliest_departure: { type: "string", description: "ISO time" },
      },
      required: ["from_terminal", "to_terminal", "earliest_departure"],
      additionalProperties: false,
    },
  },
  {
    name: "search_hotels",
    description: "Free. Hotels for the driver near a place for one night. Prices are quotes.",
    input_schema: {
      type: "object",
      properties: { near: { type: "string" }, night: { type: "string", description: "Date, e.g. 2026-10-23" } },
      required: ["near", "night"],
      additionalProperties: false,
    },
  },
  {
    name: "call_driver",
    description: "Free, no approval needed. Phone the order's assigned driver and ask short questions. Returns what the driver said. Drivers may be contacted; customers may not. Only call when you need something the records cannot tell you.",
    input_schema: {
      type: "object",
      properties: {
        order: orderParam.order,
        purpose: { type: "string", description: "One sentence the driver hears first: why you are calling." },
        questions: { type: "array", items: { type: "string" }, description: "Two to five short questions." },
      },
      required: ["order", "purpose", "questions"],
      additionalProperties: false,
    },
  },
  {
    name: "note_fact",
    description: "Record one fact for the operator, with how strong it is and where it came from. Use the record id from a tool result. For a fact that something is missing (no booking, no tracking), set source_table to the table you checked, e.g. travel_reservations. verified = a record proves it; reported = someone said it; estimate = calculated; quote = offered not booked; unknown = not supplied or sources disagree.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        strength: { type: "string", enum: ["verified", "reported", "estimate", "quote", "unknown"] },
        source_kind: { type: "string", enum: ["driver", "customer", "site", "operator", "agent", "system", "provider"] },
        source_label: { type: "string", description: "e.g. 'Driver chat', 'Ferry quote', 'Delivery promise'" },
        source_actor: { type: "string", description: "Name of the person or company, if any" },
        source_at: { type: "string", description: "ISO time the source was said or observed" },
        source_table: { type: "string" },
        source_record_id: { type: "string" },
      },
      required: ["text", "strength", "source_kind", "source_label", "source_at"],
      additionalProperties: false,
    },
  },
  {
    name: "propose",
    description: "Ask a person to approve a change, or hand them something only a person can do. Nothing happens until they say yes. Required for: booking travel, changing a date, approving a cost, any message to a customer, and calls to customers (handover_to_person).",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["book_travel", "change_date", "approve_cost", "message_customer", "resolve_alert", "handover_to_person"] },
        title: { type: "string", description: "The decision in one line, e.g. 'Book the 24 Oct 12:00 sailing and one hotel night'" },
        rationale: { type: "string", description: "One or two sentences: why this, why now." },
        changes: {
          type: "array",
          items: {
            type: "object",
            properties: { label: { type: "string" }, before: { type: "string" }, after: { type: "string", description: "Plain words a person reads, e.g. '24 Oct 15:00, vehicle slot, €387 quote'. No record ids here; cite them with note_fact." } },
            required: ["label", "before", "after"],
            additionalProperties: false,
          },
        },
        draft_message: {
          type: "object",
          description: "For message_customer: the exact text. For handover_to_person: a short call brief.",
          properties: { to: { type: "string" }, channel: { type: "string" }, body: { type: "string" } },
          required: ["to", "channel", "body"],
          additionalProperties: false,
        },
        what_happens_next: { type: "string", description: "Shown before the decision: what you will do if they approve." },
        what_happens_after: { type: "string", description: "Shown after approval, present tense." },
      },
      required: ["action", "title", "rationale", "changes", "what_happens_next", "what_happens_after"],
      additionalProperties: false,
    },
  },
  {
    name: "finish",
    description: "Stop working. Call exactly once, last.",
    input_schema: {
      type: "object",
      properties: {
        outcome: { type: "string", enum: ["needs_person", "facts_line_up", "waiting_reply"] },
        headline: { type: "string", description: "For the queue: the decision in 12 words or fewer, as a question if a person must choose. No times, no lists. E.g. 'Book the next ferry and a hotel night (€490)?'" },
        summary: { type: "string", description: "One sentence, under 160 characters: what is wrong and what happens if nobody acts. Details belong in facts, not here." },
        agent_did: { type: "string", description: "Under 100 characters: the cheap work you did, e.g. 'Phoned the driver, checked 3 sailings and the promise.'" },
        urgency: { type: "string", enum: ["now", "today", "soon", "watch"] },
        decide_within_minutes: { type: "number", description: "Minutes from now until waiting stops being free." },
      },
      required: ["outcome", "headline", "summary", "agent_did", "urgency"],
      additionalProperties: false,
    },
  },
]

// --- read tools ---------------------------------------------------------------

/** Times already in Helsinki time (the desk's clock, DST included), so the agent never converts. */
const hki = (iso: unknown) => typeof iso === "string" ? fmtDateTime(iso, "Europe/Helsinki", false) : null

const ago = (iso: unknown) => {
  const m = minutesBeforeSnapshot(iso)
  if (m == null) return "unknown time"
  if (m < 0) return `in ${Math.round(-m / 60)} h`
  return m < 90 ? `${m} min ago` : `${Math.round(m / 60)} h ago`
}

function vehicleOf(order: Row) {
  const item = rows("order_items").find((row) => row.order_id === order.id && row.role === "PRIMARY")
  return item ? byId("vehicles", item.vehicle_id) : undefined
}

export function carOf(order: Row): string {
  const v = vehicleOf(order)
  return v ? `${v.make} ${v.model}` : "Unknown car"
}

export function routeOf(order: Row): string {
  const city = (id: unknown) => String(byId("addresses", id)?.city ?? "?")
  return `${city(order.pickup_address_id)} → ${city(order.delivery_address_id)}`
}

export function assignedDriver(order: Row): Row | undefined {
  const asg = forOrder("work_assignments", order.id).find((row) => row.status === "IN_PROGRESS" || row.status === "ASSIGNED")
  return asg ? byId("drivers", asg.driver_id) : undefined
}

export function readOrder(order: Row) {
  const windows = forOrder("time_windows", order.id).filter((w) => w.is_selected)
  const asg = forOrder("work_assignments", order.id).filter((row) => row.status !== "CANCELLED")
  return {
    order_id: order.id,
    reference: order.reference,
    status: order.status,
    customer: { name: byId("customers", order.customer_id)?.name, note: "A customer pays Bahn. Never contact them except through an approved proposal." },
    car: carOf(order),
    plate: vehicleOf(order)?.registration ?? null,
    route: routeOf(order),
    route_kind: order.route_kind,
    selected_windows: windows.map((w) => ({ purpose: w.purpose, start: w.start_at, end: w.end_at, timezone: w.timezone, source: w.source, record: w.id })),
    assignments: asg.map((a) => ({ driver: actorName("driver", a.driver_id), driver_id: a.driver_id, status: a.status, started_at: a.started_at, record: a.id })),
    endpoints: forOrder("order_endpoint_details", order.id).map((e) => ({
      boundary: e.boundary, contact: e.contact_name ?? null, contact_status: e.contact_status, access_status: e.access_status,
      access_instruction: e.access_instruction, last_confirmed_source: e.last_confirmed_source, record: e.id,
    })),
    snapshot_now: SNAPSHOT_AT,
  }
}

export function readConversation(order: Row) {
  return forOrder("messages", order.id)
    .sort((a, b) => String(a.authored_at).localeCompare(String(b.authored_at)))
    .slice(-14)
    .map((m) => ({
      at: m.authored_at, when: ago(m.authored_at), from: `${m.author_type}: ${actorName(m.author_type, m.author_id)}`,
      to: `${m.recipient_type}: ${actorName(m.recipient_type, m.recipient_id)}`, channel: m.channel,
      visibility: m.visibility, text: m.body, record: m.id,
    }))
}

export function readOpenIssues(order: Row) {
  return {
    alerts: forOrder("alerts", order.id).map((a) => ({ signal: a.signal, status: a.status, severity: a.severity, summary: a.summary, triggered: a.triggered_at, owner: a.owner ?? null, record: a.id })),
    incidents: forOrder("incidents", order.id).map((i) => ({ kind: i.kind, status: i.status, opened: i.opened_at, details: { ...i, id: undefined, order_id: undefined }, record: i.id })),
    open_work: forOrder("work_items", order.id).filter((w) => w.status !== "DONE").map((w) => ({ kind: w.kind, priority: w.priority, summary: w.summary, next_action: w.next_action, due: w.due_at, record: w.id })),
    earlier_agent_proposals: forOrder("agent_proposals", order.id).map((p) => ({ command: p.command, status: p.status, summary: p.summary, record: p.id })),
  }
}

export function readTracking(order: Row) {
  const obs = forOrder("tracking_observations", order.id).sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at))).slice(0, 4)
  const promise = forOrder("time_windows", order.id).find((w) => w.purpose === "CUSTOMER_DELIVERY_PROMISE" && w.is_selected)
  return {
    latest: obs.map((o) => ({ observed: o.observed_at, age: ago(o.observed_at), quality: o.location_quality, progress: o.progress_fraction, km_left: o.distance_remaining_km, eta: o.estimated_delivery_at, source: o.source, record: o.id })),
    delivery_promise: promise ? { start: promise.start_at, end: promise.end_at, timezone: promise.timezone, record: promise.id } : null,
    note: obs.length ? "Coarse positions without coordinates. A driver report is not a location fix." : "No tracking on record.",
  }
}

export function readTravel(order: Row) {
  return {
    booked: forOrder("travel_reservations", order.id).map((r) => ({
      kind: r.kind, status: r.status, reference: r.booking_reference ?? null, departure: r.departure_at, arrival: r.expected_arrival_at,
      departure_helsinki: hki(r.departure_at), arrival_helsinki: hki(r.expected_arrival_at),
      from: r.origin_terminal ?? r.from_city ?? null, to: r.destination_terminal ?? r.to_city ?? null,
      check_in: r.check_in_confirmation ?? null, boarding: r.boarding_confirmation ?? null, record: r.id,
    })),
    quotes_and_checks_not_booked: forOrder("travel_options", order.id).map((o) => ({
      kind: o.kind, status: o.status, provider: o.provider, from: o.from_city, to: o.to_city, departure: o.departure_at, arrival: o.arrival_at,
      departure_helsinki: hki(o.departure_at), arrival_helsinki: hki(o.arrival_at),
      check_in_cutoff: o.check_in_cutoff_at ?? null, price_eur: typeof o.quote_cents === "number" ? o.quote_cents / 100 : null,
      note: o.capacity_note ?? null, checked: o.checked_at, checked_age: ago(o.checked_at), record: o.id,
    })),
  }
}

// --- mock search tools (fictional prices and timetables) ------------------------

function seed(text: string): number {
  let h = 2166136261
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return Math.abs(h)
}

export function searchFerries(from: string, to: string, earliest: string) {
  const start = Date.parse(earliest) || Date.parse(SNAPSHOT_AT)
  const norm = (text: unknown) => String(text ?? "").toLowerCase().replace(/vehicle|terminal|port/g, "").trim()
  const matches = (a: unknown, b: string) => norm(a).includes(norm(b).split(" ")[0]) || norm(b).includes(norm(a).split(" ")[0])

  // The dataset holds a shared timetable of checked sailings across orders. Use it as the
  // source of truth: one entry per departure, and "sold out" wins if any check said so.
  const known = new Map<string, { departure: string; departure_helsinki: string | null; arrival: string; arrival_helsinki: string | null; check_in_cutoff: string | null; vehicle_space: string; price_eur: number | null; quote_id: string; checked_at: string }>()
  for (const option of rows("travel_options")) {
    if (option.kind !== "FERRY" || !matches(option.from_city, from) || !matches(option.to_city, to)) continue
    const departure = String(option.departure_at)
    if (Date.parse(departure) < start) continue
    const soldOut = option.status === "SOLD_OUT"
    const existing = known.get(departure)
    if (existing && existing.vehicle_space === "SOLD_OUT") continue
    known.set(departure, {
      departure,
      departure_helsinki: hki(departure),
      arrival_helsinki: hki(option.arrival_at),
      arrival: String(option.arrival_at),
      check_in_cutoff: (option.check_in_cutoff_at as string) ?? null,
      vehicle_space: soldOut ? "SOLD_OUT" : "AVAILABLE",
      price_eur: typeof option.quote_cents === "number" ? option.quote_cents / 100 : null,
      quote_id: String(option.id),
      checked_at: String(option.checked_at),
    })
  }
  const sailings = [...known.values()].sort((a, b) => a.departure.localeCompare(b.departure)).slice(0, 6)
  if (sailings.length === 0) {
    return { provider: "Vela Coast Lines (fictional)", from, to, sailings, note: "No sailings on record for this route from that time. Do not assume one exists." }
  }
  return { provider: "Vela Coast Lines (fictional)", from, to, sailings, note: "Quotes only, as last checked (see checked_at). Space can go before booking." }
}

export function searchHotels(near: string, night: string) {
  const s = seed(`${near}|${night}`)
  const names = ["Harbour Rest", "Terminal Inn", "Nordlicht Hotel", "Kaiview Rooms"]
  return {
    near, night, checked_at: SNAPSHOT_AT,
    hotels: [0, 1, 2].map((i) => ({ quote_id: `hotel-${((s >> i) % 100000).toString(36)}`, name: `${names[(s + i) % names.length]} (fictional)`, minutes_to_terminal: 5 + ((s >> i) % 12), price_eur: 79 + ((s >> (i + 2)) % 6) * 12, free_cancellation: i !== 2 })),
    note: "Quotes only. Nothing is reserved.",
  }
}

export function resolveOrder(ref: string): Row {
  const order = findOrder(ref)
  if (!order) throw new Error(`No order matches "${ref}".`)
  return order
}
