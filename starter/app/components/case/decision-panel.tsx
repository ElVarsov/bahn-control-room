"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import type { Change, Decision, Proposal } from "@/lib/contracts"
import { Icon } from "../icons"

type Mode = "idle" | "editing" | "instructing" | "logging"

const CLOSED_STATUS: Record<string, string> = {
  superseded: "replaced by a newer agent run",
  executed: "approved and carried out",
  rejected: "rejected",
  failed: "failed",
}

const WHO = "You" // until there is sign-in, the person at the screen

// Sends the decision to the agent lane. While that route does not exist yet, the
// decision is kept on this page so the flow can still be shown end to end.
async function sendDecision(proposalId: string, decision: Decision): Promise<"sent" | "local"> {
  try {
    const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}/decision`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(decision),
    })
    return response.ok ? "sent" : "local"
  } catch {
    return "local"
  }
}

export function DecisionPanel({ proposals }: { proposals: Proposal[] }) {
  const open = proposals.filter((proposal) => proposal.status === "pending")
  // The most recent decision stays visible as a confirmation; older ones go to the history.
  const lastDecided = [...proposals].reverse().find((proposal) => proposal.status !== "pending" && proposal.decision)
  const closed = proposals.filter((proposal) => proposal.status !== "pending" && proposal !== lastDecided)
  return (
    <>
      {open.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />)}
      {lastDecided?.decision && <DecidedCard proposal={lastDecided} decision={lastDecided.decision} delivery="sent" />}
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
  const router = useRouter()

  const decide = async (verdict: Decision["verdict"], extra: Partial<Decision> = {}) => {
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
              <span className={`change-before${change.before ? "" : " is-empty"}`} role="cell">{change.before ?? "Nothing yet"}</span>
              <span className="change-after" role="cell">
                {mode === "editing" && !handover
                  ? <input value={change.after} aria-label={`${change.label} after`} onChange={(event) => setChanges((all) => all.map((c, i) => (i === index ? { ...c, after: event.target.value } : c)))} />
                  : change.after}
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
            : <p className="draft-body">{draft}</p>}
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
              <button type="button" className="btn btn-primary" onClick={() => void decide("approve")} disabled={busy}><Icon name="check" size={14} /> Approve</button>
              <button type="button" className="btn btn-secondary" onClick={() => setMode("editing")} disabled={busy}>Change it</button>
              <button type="button" className="btn btn-ghost" onClick={() => void decide("reject")} disabled={busy}>Reject</button>
              <button type="button" className="btn btn-link" onClick={() => setMode("instructing")} disabled={busy}>Tell the agent something else</button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

const VERDICT: Record<Decision["verdict"], { title: string; tone: string }> = {
  approve: { title: "Approved", tone: "ok" },
  edit: { title: "Sent back with your instructions", tone: "accent" },
  reject: { title: "Rejected", tone: "neutral" },
}

function DecidedCard({ proposal, decision, delivery, onUndo }: { proposal: Proposal; decision: Decision; delivery: "sent" | "local"; onUndo?: () => void }) {
  const handover = proposal.action === "handover_to_person"
  const verdict = decision.verdict === "approve" && handover ? { title: "Answer logged", tone: "ok" } : VERDICT[decision.verdict]
  const next = decision.verdict === "reject"
    ? "The agent drops this proposal and keeps the order as it is. The case stays in your queue until someone picks a new plan."
    : decision.verdict === "edit"
      ? "The agent reads your instructions, does the new checks and comes back with a new proposal. Nothing is booked or sent in the meantime."
      : proposal.whatHappensAfter ?? proposal.whatHappensNext
  return (
    <section className={`decision decided tone-${verdict.tone}`} aria-live="polite">
      <p className="decision-eyebrow"><Icon name="check" size={13} /> {verdict.title} by {decision.decidedBy}</p>
      <h2 className="decision-title">{proposal.title}</h2>
      {decision.note && <p className="decided-note">“{decision.note}”</p>}
      <p className="next-step"><b>What happens next.</b> {next}</p>
      {delivery === "local" && <p className="decided-local">Demo mode: this proposal is sample data, so the decision is only kept on this page.</p>}
      {delivery === "local" && onUndo && (
        <div className="decision-actions">
          <button type="button" className="btn btn-ghost" onClick={onUndo}>Undo</button>
        </div>
      )}
    </section>
  )
}
