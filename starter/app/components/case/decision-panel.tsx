"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { withoutIds } from "@/lib/present/ids"
import { fmtClock } from "@/lib/present/time"
import type { AgentRun, Change, Decision, Proposal } from "@/lib/contracts"
import { Icon } from "../icons"

type Mode = "idle" | "editing" | "instructing" | "logging"

const CLOSED_STATUS: Record<string, string> = {
  superseded: "replaced by a newer agent run",
  executed: "approved and carried out",
  rejected: "rejected",
  failed: "failed",
}

/** Record ids belong in the sources, not in what a person reads: "€387 (quote travel-x29…)" → "€387 quote". */

const WHO = "You" // until there is sign-in, the person at the screen

// Sends the decision to the agent lane. While that route does not exist yet, the
// decision is kept on this page so the flow can still be shown end to end.
async function sendDecision(proposalId: string, decision: Decision): Promise<"sent" | "local"> {
  try {
    const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}/decision`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(decision),
    })
    // 409: someone already decided this one; show the real state instead of acting again.
    return response.ok || response.status === 409 ? "sent" : "local"
  } catch {
    return "local"
  }
}

/** "Ferry booked: Vela Coast…, €387. Reference VCL-NJO3D (fictional…)." → "Ferry booked · VCL-NJO3D". */
function shortDone(line: string): string {
  const booked = line.match(/^(.+?) booked: .*Reference (\S+) \(fictional/i)
  if (booked) return `${booked[1]} booked · ${booked[2]}`
  if (/^Checked the earlier failed attempt/i.test(line)) return "Checked the earlier failed attempt first (simulated provider check): nothing was booked, so nothing is booked twice"
  if (/^Sent the driver/i.test(line)) return `Driver told: ${line.replace(/^Sent the driver:\s*booked for you,\s*/i, "").replace(/\.\s*Details are in the app\.?$/i, "")}`
  return line.replace(/\s*\(fictional, nothing real was bought\)/i, "")
}

/** "Approve and book · €490": the button says what it commits to. */
function approveLabel(proposal: Proposal): string {
  const cost = proposal.title.match(/€\s?[\d.,]+/)?.[0] ?? proposal.changes.find((c) => /cost|total|price/i.test(c.label))?.after.match(/€\s?[\d.,]+/)?.[0]
  const verb = { book_travel: "Approve and book", change_date: "Approve the new date", approve_cost: "Approve the cost", message_customer: "Approve and send", resolve_alert: "Approve and close" }[proposal.action as string] ?? "Approve"
  return cost ? `${verb} · ${cost.replace(/[.,]$/, "")}` : verb
}

// Steps that only ever run after a person's yes: what the agent actually did with it.
const AFTER_YES = new Set(["check_booking_outcome", "book_travel", "change_date", "approve_cost", "resolve_alert"])

function doneAfterYes(runs: AgentRun[]): string[] {
  return runs.flatMap((run) => run.steps).flatMap((step) =>
    step.kind === "tool_result" && AFTER_YES.has(step.tool) ? [withoutIds(step.summary ?? "")]
      : step.kind === "message_out" && step.body.startsWith("Update from Bahn") ? [`Sent the driver: ${step.body.replace(/^Update from Bahn:\s*/, "")}`]
      : [])
}

export function DecisionPanel({ proposals, runs = [] }: { proposals: Proposal[]; runs?: AgentRun[] }) {
  const open = proposals.filter((proposal) => proposal.status === "pending")
  // The most recent decision stays visible as a confirmation; older ones go to the history.
  const lastDecided = [...proposals].reverse().find((proposal) => proposal.status !== "pending" && proposal.decision)
  const closed = proposals.filter((proposal) => proposal.status !== "pending" && proposal !== lastDecided)
  return (
    <>
      {open.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />)}
      {lastDecided?.decision && <DecidedCard proposal={lastDecided} decision={lastDecided.decision} delivery="sent" done={doneAfterYes(runs)} />}
      {closed.length > 0 && (
        <details className="decision-history">
          <summary><Icon name="chevron" size={12} /> Earlier proposals on this order ({closed.length})</summary>
          {closed.map((proposal) => <p key={proposal.id}>{proposal.title} · {CLOSED_STATUS[proposal.status] ?? proposal.status.replace(/_/g, " ")}</p>)}
        </details>
      )}
    </>
  )
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const handover = proposal.action === "handover_to_person"
  const [mode, setMode] = useState<Mode>("idle")
  const [changes, setChanges] = useState<Change[]>(proposal.changes)
  const [draft, setDraft] = useState(proposal.draftMessage?.body ?? "")
  const [note, setNote] = useState("")
  const [decided, setDecided] = useState<{ decision: Decision; delivery: "sent" | "local" } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)
  const router = useRouter()

  const inFlight = useRef(false)
  const decide = async (verdict: Decision["verdict"], extra: Partial<Decision> = {}) => {
    if (inFlight.current) return // a second click before the first answer is ignored
    inFlight.current = true
    setBusy(true)
    const decision: Decision = { verdict, decidedBy: WHO, decidedAt: new Date().toISOString(), ...extra }
    const delivery = await sendDecision(proposal.id, decision)
    setDecided({ decision, delivery })
    setBusy(false)
    // The agent carried it out (and may have started a follow-up run): show the new state.
    if (delivery === "sent") router.refresh()
  }

  if (decided) return <DecidedCard proposal={proposal} decision={decided.decision} delivery={decided.delivery} onUndo={() => { setDecided(null); setMode("idle") }} />

  const editedSomething = draft !== (proposal.draftMessage?.body ?? "") || changes.some((change, i) => change.after !== proposal.changes[i]?.after)

  return (
    <section className={`decision${handover ? " is-handover" : ""}`} aria-labelledby={`decision-${proposal.id}`}>
      <p className="decision-eyebrow">
        <Icon name={handover ? "phone" : "proposal"} size={13} />
        {handover ? "The agent needs you to do this" : "The agent suggests"}
      </p>
      <h2 id={`decision-${proposal.id}`} className="decision-title">{proposal.title}</h2>
      <p className="decision-rationale">{proposal.rationale}</p>

      {changes.length > 0 && (
        <div className="changes" role="table" aria-label="What would change">
          <div className="changes-head" role="row"><span role="columnheader">{handover ? "Depends on the call" : "What changes"}</span><span role="columnheader">Now</span><span role="columnheader">After</span></div>
          {changes.map((change, index) => (
            <div className="change-row" role="row" key={change.label}>
              <span className="change-label" role="cell">{change.label}</span>
              <span className={`change-before${change.before ? "" : " is-empty"}`} role="cell">{change.before ? withoutIds(change.before) : "Nothing yet"}</span>
              <span className="change-after" role="cell">
                {mode === "editing" && !handover
                  ? <input value={change.after} aria-label={`${change.label} after`} onChange={(event) => setChanges((all) => all.map((c, i) => (i === index ? { ...c, after: event.target.value } : c)))} />
                  : withoutIds(change.after)}
              </span>
            </div>
          ))}
        </div>
      )}

      {proposal.draftMessage && (
        <div className={`draft${handover ? " is-brief" : ""}`}>
          <p className="draft-head">
            {handover
              ? <><Icon name="phone" size={13} /> Call brief for {proposal.draftMessage.to}</>
              : <><Icon name="message" size={13} /> Message to {proposal.draftMessage.to}, sent only when you approve</>}
          </p>
          {mode === "editing" && !handover
            ? <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} aria-label="Message text" />
            : handover ? <CallBrief text={draft} /> : <p className="draft-body">{draft}</p>}
        </div>
      )}

      <p className="next-step"><b>What happens next.</b> {proposal.whatHappensNext}</p>

      {mode === "instructing" && (
        <form className="instruct" onSubmit={(event) => { event.preventDefault(); if (note.trim()) void decide("edit", { note: note.trim() }) }}>
          <label htmlFor={`note-${proposal.id}`}>Tell the agent what to do instead</label>
          <textarea id={`note-${proposal.id}`} value={note} onChange={(event) => setNote(event.target.value)} rows={3} autoFocus placeholder="For example: check the train to Travemünde first, the dealer prefers no hotel cost." />
          <div className="decision-actions">
            <button type="submit" className="btn btn-primary" disabled={!note.trim() || busy}>Send to the agent</button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </form>
      )}

      {mode === "logging" && (
        <form className="instruct" onSubmit={(event) => { event.preventDefault(); if (note.trim()) void decide("approve", { note: note.trim() }) }}>
          <label htmlFor={`note-${proposal.id}`}>What did they decide? One line is enough.</label>
          <textarea id={`note-${proposal.id}`} value={note} onChange={(event) => setNote(event.target.value)} rows={2} autoFocus placeholder="For example: their own roadside service comes within 2 hours; car goes to their Munich workshop." />
          <div className="decision-actions">
            <button type="submit" className="btn btn-primary" disabled={!note.trim() || busy}>Give this to the agent</button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </form>
      )}

      {(mode === "idle" || mode === "editing") && (
        <div className="decision-actions">
          {handover ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => setMode("logging")} disabled={busy}><Icon name="check" size={14} /> I called them, log the answer</button>
              <button type="button" className="btn btn-ghost" onClick={() => setMode("instructing")} disabled={busy}>Tell the agent something else</button>
            </>
          ) : mode === "editing" ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => void decide(editedSomething ? "edit" : "approve", editedSomething ? { editedChanges: changes, note: draft !== proposal.draftMessage?.body ? `Message changed to: ${draft}` : undefined } : {})} disabled={busy}>
                <Icon name="check" size={14} /> Approve with my changes
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setChanges(proposal.changes); setDraft(proposal.draftMessage?.body ?? ""); setMode("idle") }}>Undo changes</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={() => void decide("approve")} disabled={busy}><Icon name="check" size={14} /> {approveLabel(proposal)}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setMode("editing")} disabled={busy}>Change it</button>
              {/* Reject is one click from Approve, so it asks once more before it drops the plan. */}
              <button type="button" className={`btn ${confirmReject ? "btn-danger" : "btn-ghost"}`} onClick={() => { if (confirmReject) void decide("reject"); else { setConfirmReject(true); setTimeout(() => setConfirmReject(false), 5000) } }} disabled={busy}>{confirmReject ? "Yes, reject it" : "Reject"}</button>
              <button type="button" className="btn btn-link" onClick={() => setMode("instructing")} disabled={busy}>Tell the agent something else</button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

/** A call brief is read while dialling: numbered questions on their own lines, warnings apart. */
function CallBrief({ text }: { text: string }) {
  const parts = text.split(/\s(?=\(?\d[).]\s)/)
  const intro = parts[0].replace(/\s*Ask:?\s*$/i, "")
  const asks = parts.slice(1).map((p) => p.replace(/^\(?\d[).]\s*/, ""))
  const sentences = (asks.length ? asks.pop() ?? "" : "").split(/(?<=[.!?])\s+/)
  const plain = sentences.filter((x) => !/^(do not|don't|never)\b/i.test(x))
  const lastQ = plain.findLastIndex((x) => x.endsWith("?"))
  const lastAsk = (lastQ >= 0 ? plain.slice(0, lastQ + 1) : plain).join(" ")
  const outro = lastQ >= 0 ? plain.slice(lastQ + 1).join(" ") : ""
  const warnings = [...(asks.length || lastAsk ? [] : intro.split(/(?<=[.!?])\s+/)), ...sentences].filter((x) => /^(do not|don't|never)\b/i.test(x))
  const allAsks = lastAsk ? [...asks, lastAsk] : asks
  const introText = intro.split(/(?<=[.!?])\s+/).filter((x) => !/^(do not|don't|never)\b/i.test(x)).join(" ")
  return (
    <div className="draft-body brief">
      {introText && <p>{introText}</p>}
      {allAsks.length > 0 && <ol>{allAsks.map((a, i) => <li key={i}>{a}</li>)}</ol>}
      {outro && <p>{outro}</p>}
      {warnings.map((w, i) => <p key={i} className="brief-warning">{w}</p>)}
    </div>
  )
}

const VERDICT: Record<Decision["verdict"], { title: string; tone: string }> = {
  approve: { title: "Approved", tone: "ok" },
  edit: { title: "Sent back with your instructions", tone: "accent" },
  reject: { title: "Rejected", tone: "neutral" },
}

function DecidedCard({ proposal, decision, delivery, onUndo, done = [] }: { proposal: Proposal; decision: Decision; delivery: "sent" | "local"; onUndo?: () => void; done?: string[] }) {
  const handover = proposal.action === "handover_to_person"
  const verdict = decision.verdict === "approve" && handover ? { title: "Answer logged", tone: "ok" } : VERDICT[decision.verdict]
  const next = decision.verdict === "reject"
    ? "The agent drops this proposal and keeps the order as it is. The case stays in your queue until someone picks a new plan."
    : decision.verdict === "edit"
      ? "The agent reads your instructions, does the new checks and comes back with a new proposal. Nothing is booked or sent in the meantime."
      : proposal.whatHappensAfter ?? proposal.whatHappensNext
  return (
    <section className={`decision decided tone-${verdict.tone}`} aria-live="polite">
      <p className="decision-eyebrow"><Icon name="check" size={13} /> {verdict.title} by {decision.decidedBy === WHO ? "you" : decision.decidedBy}{delivery === "sent" && decision.decidedAt ? ` at ${fmtClock(decision.decidedAt, "Europe/Helsinki")}` : ""}</p>
      <h2 className="decision-title">{proposal.title}</h2>
      {decision.note && <p className="decided-note">“{decision.note}”</p>}
      {done.length > 0
        ? (
          <div className="next-step">
            <b>What the agent did after your yes.</b>
            <ul className="done-list">{done.map((line, i) => <li key={i}><Icon name="check" size={12} /> {shortDone(line)}</li>)}</ul>
            {done.some((line) => /fictional/i.test(line)) && <p className="done-note">References are fictional: nothing real was bought.</p>}
            <details className="done-details">
              <summary>Full details</summary>
              <ul>{done.map((line, i) => <li key={i}>{line}</li>)}</ul>
            </details>
          </div>
        )
        : <p className="next-step"><b>What happens next.</b> {next}</p>}
      {delivery === "sent" && <div className="decision-actions"><Link href="/" className="btn btn-primary">Back to Needs you</Link></div>}
      {delivery === "local" && <p className="decided-local">Demo mode: this proposal is sample data, so the decision is only kept on this page.</p>}
      {delivery === "local" && onUndo && (
        <div className="decision-actions">
          <button type="button" className="btn btn-ghost" onClick={onUndo}>Undo</button>
        </div>
      )}
    </section>
  )
}
