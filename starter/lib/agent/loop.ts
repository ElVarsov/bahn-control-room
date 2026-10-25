// The road agent: a Claude tool-use loop for one order. It reads first, asks the
// driver only when the records cannot answer, writes down what it found with
// sources, and then either stops (facts line up, waiting on a reply) or hands a
// person one clear proposal. It cannot book, change a date, spend money or contact
// a customer: those only exist as proposals a person approves.

import type Anthropic from "@anthropic-ai/sdk"
import { ALWAYS_ASK, type ActionKind, type Change, type Fact, type FactStrength, type Proposal, type SourceKind, type Urgency } from "@/lib/contracts"
import { worldStore } from "@/lib/world/store"
import { byId, SNAPSHOT_AT, type Row } from "./dataset"
import { execute } from "./decide"
import { callAssignedDriver, type DriverMode } from "./driver-call"
import { wireInboundCalls } from "./inbound"
import { client, FALLBACKS, MODEL } from "./model"
import { addStep, allRuns, saveRun, writeTrace, type RunRecord } from "./runs"
import {
  TOOLS, carOf, readConversation, readOpenIssues, readOrder, readTracking, readTravel, resolveOrder, routeOf,
  searchFerries, searchHotels,
} from "./tools"

// Hook inbound driver "Call Bahn" phoning to the agent loop
wireInboundCalls()

const MAX_TURNS = 16

const SYSTEM = `You are Bahn's road agent. Bahn delivers used cars across Finland, Denmark and Germany with freelance drivers. You work one order at a time for the operations team.

The time now is ${SNAPSHOT_AT} (the data is a frozen snapshot; treat this as now).

How you work:
1. Cheap first. Read the order, the conversation, open issues, tracking and travel before anything else.
2. Ask the driver (call_driver) only when you need something the records cannot tell you, such as whether they are safe, where they are now, or whether a new plan works for them. Drivers and pickup sites may be contacted. Customers (anyone who pays Bahn: dealers, buyers) may never be contacted by you.
3. Write down what matters with note_fact, with its true strength and its source record. A quote is not a booking. An alert is a reason to look, not a diagnosis. A driver message is not a location fix. A system ETA is an estimate. If sources disagree, say so and mark it unknown.
4. Decide what a person must decide. Anything that books travel, changes a pickup or delivery date, costs money, messages a customer, or needs a call to a customer becomes ONE propose call with exact before and after values and, for messages, the exact text. Never pretend something is booked or agreed.
5. Stop with finish. If the facts line up and nothing needs a person, say so (outcome facts_line_up). If you are waiting on someone, outcome waiting_reply. Otherwise needs_person.

Style: plain words an operations person reads in a second. Give times in the local time of the place they happen (for example "23 Oct 22:00 Berlin time"), not UTC. Refer to drivers and contacts by name or as "the driver"; use "they" if you need a pronoun and never guess gender from a name. No codes like FERRY_SOLD_OUT in text for people. Times with their zone where it matters. Keep the whole job under about ten tool calls. One proposal per run unless two are truly independent.`

export type StartOptions = { order: string; trigger: string; driverMode?: DriverMode }

export function startRun({ order: ref, trigger, driverMode = "auto" }: StartOptions): RunRecord {
  const order = resolveOrder(ref)
  // A new run replaces the open proposals of earlier runs on this order, so nobody
  // approves a plan built on older facts.
  for (const earlier of allRuns().filter((r) => r.orderId === order.id)) {
    const open = earlier.proposals.filter((p) => p.status === "pending")
    if (open.length === 0 && earlier.run.state !== "needs_person") continue
    for (const proposal of open) proposal.status = "superseded"
    if (earlier.run.state !== "working") earlier.run.state = "done"
    writeTrace(earlier)
  }
  const record: RunRecord = {
    run: {
      id: `run-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      orderId: order.id,
      agentId: "road-agent",
      trigger,
      state: "working",
      startedAt: new Date().toISOString(),
      steps: [],
    },
    orderId: order.id,
    orderReference: String(order.reference),
    car: carOf(order),
    route: routeOf(order),
    customer: String(byId("customers", order.customer_id)?.name ?? ""),
    proposals: [],
    facts: [],
    model: MODEL,
    usage: { inputTokens: 0, outputTokens: 0 },
  }
  saveRun(record)
  void work(record, order, driverMode).catch((error) => {
    console.error("[agent] run failed", error)
    addStep(record, { kind: "stop", at: now(), reason: "error", summary: `The agent hit a technical problem: ${String(error?.message ?? error).slice(0, 200)}` })
    record.outcome = "error"
    record.run.state = "needs_person"
    record.headline = record.headline ?? "The agent could not finish. Please look at this order by hand."
    writeTrace(record)
  })
  return record
}

const now = () => new Date().toISOString()

async function work(record: RunRecord, order: Row, driverMode: DriverMode) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{
    role: "user",
    content: `Trigger: ${record.run.trigger}\nOrder: ${order.reference} (${carOf(order)}, ${routeOf(order)}).\nWork this order now.`,
  }]

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACKS,
      output_config: { effort: "medium" },
      system: SYSTEM,
      tools: TOOLS,
      messages,
    })
    record.usage.inputTokens += response.usage.input_tokens
    record.usage.outputTokens += response.usage.output_tokens

    if (response.stop_reason === "refusal") throw new Error("The model declined this request.")
    // Keep the assistant turn exactly as returned, thinking blocks included.
    messages.push({ role: "assistant", content: response.content })

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) addStep(record, { kind: "thought", at: now(), text: block.text.trim().slice(0, 600) })
    }

    const toolUses = response.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use")
    if (toolUses.length === 0) {
      if (response.stop_reason === "max_tokens") throw new Error("The model ran out of room mid-answer.")
      // Ended without finish: ask once more, then stop.
      if (turn < MAX_TURNS - 1) { messages.push({ role: "user", content: "Call finish now to stop." }); continue }
      break
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
    let finished = false
    for (const use of toolUses) {
      const input = (use.input ?? {}) as Record<string, unknown>
      addStep(record, { kind: "tool_call", at: now(), tool: use.name, input, cost: use.name === "propose" ? "needs_approval" : "free" })
      try {
        const { content, done } = await runTool(record, order, use.name, input, driverMode)
        results.push({ type: "tool_result", tool_use_id: use.id, content })
        if (done) finished = true
      } catch (error) {
        results.push({ type: "tool_result", tool_use_id: use.id, content: `Error: ${(error as Error).message}`, is_error: true })
      }
    }
    // All results for one assistant turn go back in a single user message.
    messages.push({ role: "user", content: results })
    if (finished) break
  }

  if (!record.outcome) {
    record.outcome = record.proposals.length ? "needs_person" : "facts_line_up"
    record.headline ??= record.proposals[0]?.title ?? "The agent stopped without a summary."
    addStep(record, { kind: "stop", at: now(), reason: record.proposals.length ? "needs_person" : "facts_line_up", summary: "Stopped after the turn limit." })
  }
  record.run.state = record.outcome === "waiting_reply" ? "waiting_reply" : record.outcome === "facts_line_up" ? "done" : "needs_person"
  writeTrace(record)
}

async function runTool(record: RunRecord, order: Row, name: string, input: Record<string, unknown>, driverMode: DriverMode): Promise<{ content: string; done?: boolean }> {
  const json = (value: unknown) => JSON.stringify(value)
  const result = (tool: string, summary: string, value: unknown) => {
    addStep(record, { kind: "tool_result", at: now(), tool, summary })
    return { content: json(value) }
  }
  const target = () => resolveOrder(String(input.order ?? order.id))

  switch (name) {
    case "read_order": {
      const o = readOrder(target())
      const driver = o.assignments.find((a) => a.status !== "COMPLETED")
      return result(name, `${o.car} for ${o.customer.name}, ${o.route}. ${driver ? `Driver ${driver.driver} (${String(driver.status).toLowerCase().replace("_", " ")}).` : "No driver assigned."}`, o)
    }
    case "read_conversation": {
      const list = readConversation(target())
      const last = list.at(-1)
      return result(name, list.length ? `${list.length} recent messages. Latest from ${last?.from.split(": ")[1]}: “${String(last?.text).slice(0, 110)}”` : "No messages on this order.", list)
    }
    case "read_open_issues": {
      const issues = readOpenIssues(target())
      const openAlerts = issues.alerts.filter((a) => a.status !== "RESOLVED" && a.status !== "DISMISSED")
      return result(name, `${openAlerts.length} open alert(s)${openAlerts[0] ? ` (${openAlerts[0].summary})` : ""}, ${issues.incidents.length} incident(s), ${issues.open_work.length} open work item(s).`, issues)
    }
    case "read_tracking": {
      const t = readTracking(target())
      const latest = t.latest[0]
      return result(name, latest ? `Last driver-app position ${latest.age} (${String(latest.quality).toLowerCase()}), ${latest.km_left ?? "?"} km to go.` : "No tracking on record.", t)
    }
    case "read_travel": {
      const t = readTravel(target())
      return result(name, `${t.booked.length} booked, ${t.quotes_and_checks_not_booked.length} quote(s) or capacity check(s) that are not bookings.`, t)
    }
    case "search_ferries": {
      const f = searchFerries(String(input.from_terminal), String(input.to_terminal), String(input.earliest_departure))
      const open = f.sailings.filter((s) => s.vehicle_space === "AVAILABLE")
      return result(name, `${f.sailings.length} sailings checked, ${open.length} with vehicle space (quotes, not booked).`, f)
    }
    case "search_hotels": {
      const h = searchHotels(String(input.near), String(input.night))
      return result(name, `${h.hotels.length} hotels near ${h.near}, from € ${Math.min(...h.hotels.map((x) => x.price_eur))} (quotes).`, h)
    }
    case "call_driver": {
      // The Autonomy dial decides whether the agent may phone a driver without asking.
      if ((worldStore.getAutonomySettings().ask_driver ?? "do_quietly") === "ask_first") {
        throw new Error("The Autonomy dial says to ask a person before contacting drivers. Use propose with handover_to_person and the questions you would ask.")
      }
      const o = target()
      const questions = Array.isArray(input.questions) ? input.questions.map(String).slice(0, 5) : []
      const call = await callAssignedDriver(o, String(input.purpose ?? ""), questions, driverMode, record.run.id)
      const heard = call.transcript.filter((t) => t.speaker === "driver").map((t) => t.text).join(" ")
      addStep(record, {
        kind: "call", at: now(), callId: call.callId, status: call.status,
        summary: call.status === "completed"
          ? `${call.simulated ? "Simulated call" : "Phoned"} ${call.driverName}${call.scripted ? " (scripted backup answered, AI unavailable)" : ""}. ${heard.slice(0, 260)}`
          : `${call.simulated ? "Simulated call to" : "Phoned"} ${call.driverName}: ${call.status.replace("_", " ")}.`,
      })
      // Facts heard on a real call are reported by the driver; keep them with the run.
      for (const fact of call.facts) record.facts.push(fact)
      return { content: json({ status: call.status, simulated: call.simulated, scripted_backup: !!call.scripted, driver: call.driverName, transcript: call.transcript, call_id: call.callId }) }
    }
    case "note_fact": {
      const fact: Fact = {
        id: `${record.run.id}-f${record.facts.length + 1}`,
        text: String(input.text),
        strength: input.strength as FactStrength,
        sources: [{
          kind: input.source_kind as SourceKind,
          label: String(input.source_label),
          actorName: input.source_actor ? String(input.source_actor) : undefined,
          at: String(input.source_at || SNAPSHOT_AT),
          table: input.source_table ? String(input.source_table) : undefined,
          recordId: input.source_record_id ? String(input.source_record_id) : undefined,
        }],
      }
      record.facts.push(fact)
      return { content: "Noted." }
    }
    case "propose": {
      const action = input.action as ActionKind
      const draft = input.draft_message as { to: string; channel: string; body: string } | undefined
      if (action === "message_customer" && !draft?.body) throw new Error("A customer message needs the exact draft_message text.")

      // Autonomy Dial evaluation
      const autonomySettings = worldStore.getAutonomySettings()
      // Bookings, dates, costs, customer messages and handovers always wait for a person.
      const autonomy = ALWAYS_ASK.includes(action) ? "ask_first" : (autonomySettings[action] ?? "ask_first")

      const proposal: Proposal = {
        id: `${record.run.id}-p${record.proposals.length + 1}`,
        orderId: order.id,
        action,
        title: String(input.title),
        rationale: String(input.rationale),
        changes: (Array.isArray(input.changes) ? input.changes : []) as Change[],
        draftMessage: draft,
        evidence: [],
        status: "pending",
        createdAt: now(),
        createdBy: "road-agent",
        whatHappensNext: String(input.what_happens_next),
        whatHappensAfter: String(input.what_happens_after),
      }
      record.proposals.push(proposal)
      addStep(record, { kind: "proposal", at: now(), proposalId: proposal.id })

      if (autonomy === "do_quietly") {
        proposal.status = "executed"
        execute(record, proposal, { verdict: "approve", decidedBy: "Autonomy Dial (do_quietly)", decidedAt: now() })
        return { content: json({ proposal_id: proposal.id, status: "executed", note: "Auto-executed quietly per autonomy settings." }) }
      }

      if (autonomy === "do_and_tell") {
        proposal.status = "executed"
        execute(record, proposal, { verdict: "approve", decidedBy: "Autonomy Dial (do_and_tell)", decidedAt: now() })
        return { content: json({ proposal_id: proposal.id, status: "executed", note: "Auto-executed per autonomy settings (operator notified in log)." }) }
      }

      return { content: json({ proposal_id: proposal.id, status: "pending", note: "Waiting for a person. Nothing has changed." }) }
    }
    case "finish": {
      record.outcome = input.outcome as RunRecord["outcome"]
      record.headline = String(input.headline)
      record.summary = String(input.summary)
      record.agentDid = String(input.agent_did)
      record.urgency = input.urgency as Urgency
      const minutes = typeof input.decide_within_minutes === "number" ? input.decide_within_minutes : null
      record.decideBy = minutes != null ? new Date(Date.parse(SNAPSHOT_AT) + minutes * 60000).toISOString() : undefined
      addStep(record, { kind: "stop", at: now(), reason: record.outcome === "error" ? "error" : record.outcome ?? "needs_person", summary: record.summary })
      return { content: "Stopped.", done: true }
    }
    default:
      throw new Error(`Unknown tool ${name}`)
  }
}
