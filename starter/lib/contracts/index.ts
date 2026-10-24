// Shared contract between the control room (UI lane) and the agent (agent lane).
// Both lanes code against these types and the fixtures next to this file.
// Change this file only through a PR that both of us approve.

export type Iso = string // ISO 8601 UTC

// ---------------------------------------------------------------------------
// Facts and where they came from
// ---------------------------------------------------------------------------

/** How much a fact can be trusted. A quote is never a booking. */
export type FactStrength =
  | "verified"   // a record that proves it: gate scan, approved proof, booking ref
  | "reported"   // someone said it: driver, site, customer message
  | "estimate"   // system or agent calculation: ETA, road time
  | "quote"      // offered, not purchased
  | "unknown"    // input not supplied

export type SourceKind =
  | "driver" | "customer" | "site" | "operator" | "agent" | "system" | "provider"

export type SourceRef = {
  kind: SourceKind
  label: string            // "Driver app", "Site email", "Vela Coast Lines quote"
  actorName?: string       // "Camille Emberwick"
  at: Iso                  // when it was said or observed
  table?: string           // dataset table, or "agent_trace" for agent-made facts
  recordId?: string        // id in that table, so the UI can open the raw record
}

export type Fact = {
  id: string
  text: string             // plain sentence: "Overnight sailing on 23 Oct is sold out."
  strength: FactStrength
  sources: SourceRef[]
}

// ---------------------------------------------------------------------------
// Proposals: anything that changes the world goes through a person first
// ---------------------------------------------------------------------------

export type ActionKind =
  | "ask_driver"           // no approval needed
  | "ask_site"             // no approval needed
  | "refresh_quote"        // no approval needed
  | "book_travel"          // ferry, train, flight, hotel
  | "change_date"          // pickup slot or delivery promise
  | "approve_cost"
  | "message_customer"     // always needs approval (rule of the game)
  | "resolve_alert"
  | "handover_to_person"   // agent cannot do it: a call, a judgement

export type Autonomy = "ask_first" | "do_and_tell" | "do_quietly"

/** One field that would change if the proposal is approved. */
export type Change = {
  label: string            // "Ferry", "Delivery promise", "Cost"
  before: string | null
  after: string
}

export type ProposalStatus =
  | "pending" | "approved" | "edited_and_approved" | "rejected" | "executed" | "failed"
  | "superseded" // a newer agent run replaced it before anyone decided

export type Proposal = {
  id: string
  orderId: string
  action: ActionKind
  title: string            // "Book the 24 Oct 12:00 sailing and a hotel in Travemünde"
  rationale: string        // one or two sentences
  changes: Change[]
  draftMessage?: { to: string; channel: string; body: string } // for message_customer / ask_*
  evidence: Fact[]
  status: ProposalStatus
  createdAt: Iso
  createdBy: string        // agent id
  decision?: Decision
  whatHappensNext: string  // shown before the decision: "On approval the agent books the sailing and tells the driver."
  whatHappensAfter?: string // shown once approved, in the past/present tense; falls back to whatHappensNext
}

export type Decision = {
  verdict: "approve" | "reject" | "edit"
  note?: string            // "Tell the agent instead": free text from the person
  editedChanges?: Change[]
  decidedBy: string
  decidedAt: Iso
}

// ---------------------------------------------------------------------------
// The queue: one item per thing a person must decide
// ---------------------------------------------------------------------------

export type Urgency = "now" | "today" | "soon" | "watch"

/** Why the item is on someone's screen. */
export type QueueReason =
  | "decision"       // the agent proposes a change and needs a yes
  | "handover"       // the agent cannot do it (a call to a customer, a judgement)
  | "forecast"       // the journey monitor predicts trouble; it is an estimate, not a fact
  | "driver_report"  // the driver called or wrote in

export type QueueItem = {
  id: string
  orderId: string
  orderReference: string   // "CD-420299"
  car: string              // "BMW M4"
  route: string            // "Leipzig → Helsinki"
  customer?: string        // "Kavellora Car House"
  stage?: string           // "Driver booked", "Moving", "Delivered"
  reason?: QueueReason
  headline: string         // "Ferry sold out. Approve a later sailing?"
  why: string              // one line: what happened
  agentDid?: string        // one line: the cheap work already done ("Asked the driver, checked 3 sailings")
  urgency: Urgency
  decideBy?: Iso           // when waiting stops being free
  proposalId?: string
  agentState: AgentState
  updatedAt: Iso
}

export type QueueResponse = {
  snapshotAt: Iso
  needsPerson: QueueItem[]
  /** Work agents are doing right now without a person: visible, but out of the way. */
  agentsWorking?: QueueItem[]
  quiet: { count: number; sample: { orderId: string; orderReference: string; car: string; stage: string }[] }
}

// ---------------------------------------------------------------------------
// Agent runs and traces
// ---------------------------------------------------------------------------

export type AgentState = "idle" | "working" | "waiting_reply" | "needs_person" | "done"

export type TraceStep =
  | { kind: "thought"; at: Iso; text: string }
  | { kind: "tool_call"; at: Iso; tool: string; input: unknown; cost: "free" | "needs_approval" }
  | { kind: "tool_result"; at: Iso; tool: string; summary: string; facts?: Fact[] }
  | { kind: "message_out"; at: Iso; to: SourceKind; toName: string; channel: string; body: string }
  | { kind: "message_in"; at: Iso; from: SourceKind; fromName: string; channel: string; body: string; simulated: boolean }
  | { kind: "proposal"; at: Iso; proposalId: string }
  | { kind: "call"; at: Iso; callId: string; status: CallStatus; summary?: string }
  | { kind: "stop"; at: Iso; reason: "facts_line_up" | "waiting_reply" | "needs_person" | "error"; summary: string; nextCheckAt?: Iso }

export type AgentRun = {
  id: string
  orderId: string
  agentId: string          // "road-agent"
  trigger: string          // "alert:FERRY_SOLD_OUT", "operator", "driver_message"
  state: AgentState
  startedAt: Iso
  steps: TraceStep[]
}

// ---------------------------------------------------------------------------
// Voice calls to drivers (lib/voice, see docs/VOICE.md)
// ---------------------------------------------------------------------------

export type CallStatus = "ringing" | "in_call" | "completed" | "no_answer" | "declined" | "failed"

export type CallRequest = {
  direction?: "outbound" | "inbound" // inbound: the driver tapped "Call Bahn"; default outbound
  orderId: string                    // inbound calls may start with "" until the agent links an order
  driverId: string
  driverName: string
  purpose: string          // "Check the driver is safe after a warning light"
  questions: string[]      // what the in-call agent must find out
  context?: string         // short facts the in-call agent may use: car, route, promise
  runId?: string
}

export type CallTurn = { speaker: "agent" | "driver"; text: string; at: Iso }

export type CallResult = {
  callId: string
  direction?: "outbound" | "inbound"
  driverId?: string
  orderId?: string
  status: CallStatus
  startedAt: Iso
  endedAt?: Iso
  transcript: CallTurn[]
  summary: string          // one sentence for the trace and the case page
  facts: Fact[]            // strength "reported", source kind "driver", label "Phone call"
}

// GET  /api/voice/stream?driverId=…            -> text/event-stream of { type: "incoming" | "update", call }
// POST /api/voice/calls  CallRequest           -> { callId }   (dev/demo trigger; the agent uses callDriver())
// GET  /api/voice/calls/:id                    -> CallResult
// POST /api/voice/calls/:id/answer | /decline | /hangup
// POST /api/voice/calls/:id/turn { text }      -> { say: string; end: boolean }

// ---------------------------------------------------------------------------
// HTTP API (implemented by the agent lane, consumed by the UI lane)
// ---------------------------------------------------------------------------
//
// GET  /api/queue                              -> QueueResponse
// GET  /api/orders/:id/case                    -> CaseView
// POST /api/agent/runs        { orderId, trigger }          -> AgentRun
// GET  /api/agent/runs/:id                     -> AgentRun
// GET  /api/agent/runs/:id/stream              -> text/event-stream of TraceStep
// POST /api/agent/runs/:id/messages { text }   -> AgentRun   (person talks to the agent)
// POST /api/proposals/:id/decision  Decision   -> Proposal
// GET  /api/settings/autonomy                  -> Record<ActionKind, Autonomy>
// PUT  /api/settings/autonomy  Record<ActionKind, Autonomy>
//
// Until the real routes exist, the UI reads ./fixtures/*.json.

export type CaseView = {
  orderId: string
  orderReference: string
  headline: string
  facts: Fact[]
  proposals: Proposal[]
  runs: AgentRun[]
  timeline: TimelineEntry[]
}

export type TimelineEntry = {
  id: string
  at: Iso
  actor: { kind: SourceKind; name: string }
  channel: string          // "driver_chat", "customer_email", "internal_note", "agent"
  visibility: "public" | "internal"
  text: string
  recordId?: string
}
