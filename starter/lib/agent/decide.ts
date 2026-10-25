// A person decided on one of the agent's proposals. Approve: carry it out against
// the mock world (fictional booking references, simulated sends) and record each
// effect in the trace. Reject: nothing changes. Instructions: start a new run that
// reads them first. Real providers and customers are never contacted.

import type { Decision, Proposal } from "@/lib/contracts"
import { SNAPSHOT_AT } from "./dataset"
import { startRun } from "./loop"
import { addStep, findProposal, writeTrace, type RunRecord } from "./runs"

const now = () => new Date().toISOString()

export function decideAgentProposal(proposalId: string, decision: Decision): { proposal: Proposal; followUpRunId?: string; alreadyDecided?: boolean } | null {
  const found = findProposal(proposalId)
  if (!found) return null
  const { record, proposal } = found
  // One yes, one action: a double click, a retry or a second person never carries it out again.
  if (proposal.status !== "pending") return { proposal, alreadyDecided: true }
  proposal.decision = decision
  if (decision.editedChanges?.length) proposal.changes = decision.editedChanges

  if (decision.verdict === "reject") {
    proposal.status = "rejected"
    addStep(record, { kind: "stop", at: now(), reason: "facts_line_up", summary: `${decision.decidedBy} rejected “${proposal.title}”. Nothing was changed.` })
    settle(record)
    return { proposal }
  }

  // Instructions without edits: the agent takes another pass with them.
  if (decision.verdict === "edit" && !decision.editedChanges?.length && decision.note) {
    proposal.status = "rejected"
    addStep(record, { kind: "stop", at: now(), reason: "needs_person", summary: `${decision.decidedBy} sent it back: “${decision.note}”` })
    settle(record)
    const next = startRun({ order: record.orderId, trigger: `A person reviewed your proposal “${proposal.title}” and said: ${decision.note}` })
    return { proposal, followUpRunId: next.run.id }
  }

  proposal.status = decision.verdict === "edit" ? "edited_and_approved" : "approved"
  execute(record, proposal, decision)
  proposal.status = "executed"
  settle(record)
  // After a person made a call for the agent, the chain goes on: the agent picks up
  // from their answer (for example, replanning the delivery once recovery is agreed).
  if (proposal.action === "handover_to_person" && decision.note) {
    const next = startRun({ order: record.orderId, trigger: `${decision.decidedBy} called as you asked (“${proposal.title}”). Their answer: ${decision.note}. Continue from here.` })
    return { proposal, followUpRunId: next.run.id }
  }
  return { proposal }
}

export function execute(record: RunRecord, proposal: Proposal, decision: Decision) {
  const code = () => Math.random().toString(36).slice(2, 7).toUpperCase()
  const after = proposal.changes.map((c) => `${c.label}: ${c.after}`).join("; ")
  const step = (tool: string, summary: string) => {
    addStep(record, { kind: "tool_call", at: now(), tool, input: { proposalId: proposal.id, approvedBy: decision.decidedBy }, cost: "needs_approval" })
    addStep(record, { kind: "tool_result", at: now(), tool, summary })
  }
  switch (proposal.action) {
    case "book_travel": {
      // Never book twice: if an earlier attempt on this order failed without a reference,
      // ask the provider first (simulated) and only then book.
      const earlierFailed = record.facts.some((f) => /fail|timed out|no reference|unverified/i.test(f.text) && /book/i.test(f.text))
      if (earlierFailed) step("check_booking_outcome", "Checked the earlier failed attempt with the provider: no reservation exists, so this cannot double-book (simulated check).")
      // One plain line per item, each with its own fictional reference.
      const refs: string[] = []
      for (const change of proposal.changes) {
        const what = change.after.replace(/\s*\((?:quote|record)?\s*[a-z]+-[a-z0-9]{4,}\)/gi, "").replace(/,?\s*\bquote\b/gi, "").trim()
        if (/ferry|sailing|train|flight|travel/i.test(change.label)) {
          const ref = `VCL-${code()}`
          refs.push(`${/ferry|sailing/i.test(change.label + what) ? "ferry" : "travel"} ${ref}`)
          step("book_travel", `${change.label} booked: ${what}. Reference ${ref} (fictional, nothing real was bought).`)
        } else if (/hotel|night|room/i.test(change.label)) {
          const ref = `HTL-${code()}`
          refs.push(`hotel ${ref}`)
          step("book_travel", `${change.label} booked: ${what}. Reference ${ref} (fictional, nothing real was bought).`)
        } else if (/cost|total|price/i.test(change.label)) {
          step("approve_cost", `${change.label} approved by ${decision.decidedBy === "You" ? "you" : decision.decidedBy}: ${what}.`)
        }
      }
      if (!refs.length) {
        const ref = `VCL-${code()}`
        refs.push(ref)
        step("book_travel", `Booked: ${after}. Reference ${ref} (fictional, nothing real was bought).`)
      }
      addStep(record, { kind: "message_out", at: now(), to: "driver", toName: "the driver", channel: "driver_chat", body: `Update from Bahn: booked for you, ${refs.join(" and ")}. Details are in the app.` })
      // What we knew before the yes is now history; the booking itself is the new fact.
      for (const fact of record.facts) if (/book|reserv|quote|sold out|no ferry|no hotel|attempt/i.test(fact.text)) fact.outdated = true
      record.facts.unshift({
        id: `${proposal.id}-done`, strength: "verified",
        text: `Booked after your yes: ${proposal.changes.filter((c) => !/promise|cost|total/i.test(c.label)).map((c) => c.label.toLowerCase()).join(" and ") || "travel"}, references ${refs.map((r) => r.split(" ").pop()).join(" and ")} (fictional).`,
        sources: [{ kind: "agent", label: "Booking made after your yes", at: SNAPSHOT_AT, recordId: refs[0].split(" ").pop() }],
      })
      break
    }
    case "change_date":
      step("change_date", `Updated after approval: ${after}.`)
      break
    case "approve_cost":
      step("approve_cost", `Cost approved by ${decision.decidedBy}: ${after}.`)
      break
    case "resolve_alert":
      step("resolve_alert", `Alert marked resolved by ${decision.decidedBy}.`)
      break
    case "message_customer":
      break
    case "handover_to_person":
      if (decision.note) {
        addStep(record, { kind: "message_out", at: now(), to: "driver", toName: "the driver", channel: "driver_chat", body: `Update from Bahn: ${decision.note}` })
      }
      break
    default:
      break
  }
  if (proposal.draftMessage && proposal.action === "message_customer") {
    addStep(record, { kind: "message_out", at: now(), to: "customer", toName: proposal.draftMessage.to, channel: proposal.draftMessage.channel, body: proposal.draftMessage.body })
  }
}

export function settle(record: RunRecord) {
  const open = record.proposals.some((p) => p.status === "pending")
  const waitingOnCustomer = record.proposals.some((p) => p.action === "message_customer" && p.status === "executed")
  record.run.state = open ? "needs_person" : waitingOnCustomer ? "waiting_reply" : "done"
  if (!open) {
    record.outcome = waitingOnCustomer ? "waiting_reply" : "facts_line_up"
    const done = [...record.proposals].reverse().find((p) => p.status === "executed")
    record.headline = waitingOnCustomer ? `Waiting for ${record.customer || "the customer"} to answer` : done ? doneHeadline(done) : record.headline
  }
  writeTrace(record)
}

// "Book the 24 Oct sailing…" becomes "Booked: 24 Oct sailing…" once it is done.
function doneHeadline(proposal: Proposal): string {
  const past: Record<string, string> = { book: "Booked", change: "Changed", approve: "Approved", resolve: "Resolved", send: "Sent", tell: "Sent", call: "Called" }
  const match = proposal.title.match(/^(\w+)\s+(?:the\s+)?(.*)$/i)
  const verb = match && past[match[1].toLowerCase()]
  return verb ? `${verb}: ${match![2]}` : `Done: ${proposal.title}`
}

export { SNAPSHOT_AT }
