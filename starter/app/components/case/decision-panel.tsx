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

const WHO = "You" // operator at the console

async function sendDecision(proposalId: string, decision: Decision): Promise<"sent" | "local"> {
  try {
    const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(decision),
    })
    return response.ok ? "sent" : "local"
  } catch {
    return "local"
  }
}

export function DecisionPanel({ proposals }: { proposals: Proposal[] }) {
  const open = proposals.filter((proposal) => proposal.status === "pending")
  const lastDecided = [...proposals].reverse().find((proposal) => proposal.status !== "pending" && proposal.decision)
  const closed = proposals.filter((proposal) => proposal.status !== "pending" && proposal !== lastDecided)

  return (
    <>
      {open.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
      {lastDecided?.decision && (
        <DecidedCard proposal={lastDecided} decision={lastDecided.decision} delivery="sent" />
      )}
      {closed.length > 0 && (
        <details className="decision-history" style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "10px", background: "var(--tray)", border: "1px solid var(--hair)" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Icon name="chevron" size={12} /> Earlier proposals on this order ({closed.length})
          </summary>
          <div style={{ marginTop: "10px", display: "grid", gap: "6px" }}>
            {closed.map((proposal) => (
              <p key={proposal.id} style={{ fontSize: "12.5px", color: "var(--brown)", margin: 0 }}>
                <b>{proposal.title}</b> · <span style={{ color: "var(--subtle)" }}>{CLOSED_STATUS[proposal.status] ?? proposal.status.replace(/_/g, " ")}</span>
              </p>
            ))}
          </div>
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
    if (delivery === "sent") router.refresh()
  }

  if (decided) {
    return (
      <DecidedCard
        proposal={proposal}
        decision={decided.decision}
        delivery={decided.delivery}
        onUndo={() => {
          setDecided(null)
          setMode("idle")
        }}
      />
    )
  }

  const editedSomething = draft !== (proposal.draftMessage?.body ?? "") || changes.some((change, i) => change.after !== proposal.changes[i]?.after)

  return (
    <section
      className={`decision${handover ? " is-handover" : ""}`}
      aria-labelledby={`decision-${proposal.id}`}
      style={{
        background: "#ffffff",
        border: handover ? "2px solid var(--ink)" : "1.5px solid var(--hair)",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 4px 20px -2px rgba(18, 17, 14, 0.06), 0 0 0 1px rgba(18, 17, 14, 0.04)",
      }}
    >
      {/* Block 1: Header & Rationale */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
        <p className="decision-eyebrow" style={{ margin: 0, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "11px" }}>
          <Icon name={handover ? "phone" : "proposal"} size={13} />
          {handover ? "Handover: Operator Phone Call Needed" : "Agent Recommendation · Needs Approval"}
        </p>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "6px",
            background: handover ? "var(--red-bg)" : "var(--teal-bg)",
            color: handover ? "var(--red-ink)" : "var(--teal-ink)",
            border: `1px solid ${handover ? "rgba(180,44,66,0.2)" : "rgba(31,111,123,0.2)"}`,
          }}
        >
          {handover ? "Human Required" : "Awaiting Verdict"}
        </span>
      </div>

      <h2 id={`decision-${proposal.id}`} className="decision-title" style={{ fontSize: "21px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 8px 0" }}>
        {proposal.title}
      </h2>

      <div
        style={{
          background: "var(--tray)",
          border: "1px solid var(--hair)",
          borderRadius: "10px",
          padding: "12px 14px",
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
          marginBottom: "18px",
        }}
      >
        <div style={{ color: "var(--teal-ink)", marginTop: "2px" }}>
          <Icon name="bot" size={15} />
        </div>
        <p className="decision-rationale" style={{ fontSize: "13.5px", lineHeight: "1.45", color: "var(--brown)", margin: 0 }}>
          {proposal.rationale}
        </p>
      </div>

      {/* Block 2: What Would Change (Card Grid / Side-by-Side Diff) */}
      {changes.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--subtle)", marginBottom: "8px" }}>
            {handover ? "Proposed Updates Dependent On Call" : "Contract & Operational Updates"}
          </div>

          <div
            style={{
              display: "grid",
              gap: "8px",
              border: "1px solid var(--hair)",
              borderRadius: "10px",
              overflow: "hidden",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "160px minmax(0, 1fr) minmax(0, 1.2fr)",
                gap: "12px",
                padding: "8px 14px",
                background: "var(--tray)",
                fontSize: "11.5px",
                fontWeight: 600,
                color: "var(--subtle)",
                borderBottom: "1px solid var(--hair)",
              }}
            >
              <span>Parameter</span>
              <span>Current Baseline</span>
              <span>Proposed Modification</span>
            </div>

            {changes.map((change, index) => {
              const isCost = change.label.toLowerCase().includes("cost") || change.label.toLowerCase().includes("price") || change.after.includes("€")
              const isTime = change.label.toLowerCase().includes("date") || change.label.toLowerCase().includes("time") || change.label.toLowerCase().includes("eta")

              return (
                <div
                  key={change.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px minmax(0, 1fr) minmax(0, 1.2fr)",
                    gap: "12px",
                    padding: "10px 14px",
                    alignItems: "center",
                    borderTop: index > 0 ? "1px solid var(--hair-soft)" : "none",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--brown)" }}>
                    {change.label}
                  </span>

                  <span style={{ color: "var(--muted)", textDecoration: change.before ? "line-through" : "none", fontStyle: change.before ? "normal" : "italic" }}>
                    {change.before ?? "None specified"}
                  </span>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {mode === "editing" && !handover ? (
                      <input
                        value={change.after}
                        aria-label={`${change.label} after`}
                        onChange={(event) =>
                          setChanges((all) => all.map((c, i) => (i === index ? { ...c, after: event.target.value } : c)))
                        }
                        style={{
                          width: "100%",
                          height: "32px",
                          padding: "0 10px",
                          border: "1.5px solid var(--ink)",
                          borderRadius: "6px",
                          background: "#ffffff",
                          fontSize: "13px",
                        }}
                      />
                    ) : (
                      <>
                        <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                          {change.after}
                        </span>
                        {isCost && (
                          <span className="delta-badge cost">Cost Impact</span>
                        )}
                        {isTime && (
                          <span className="delta-badge delay">Schedule</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Block 3: Message / Call Brief Preview (With Strict Customer Lock Badge) */}
      {proposal.draftMessage && (
        <div
          style={{
            marginBottom: "20px",
            border: "1px solid var(--hair)",
            borderRadius: "12px",
            background: handover ? "var(--canvas)" : "var(--birch)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              background: handover ? "var(--hair-soft)" : "var(--teal-bg)",
              borderBottom: "1px solid var(--hair)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 700, color: handover ? "var(--brown)" : "var(--teal-ink)" }}>
              <Icon name={handover ? "phone" : "message"} size={13} />
              <span>
                {handover ? `Call Brief For ${proposal.draftMessage.to}` : `Draft Message To ${proposal.draftMessage.to}`}
              </span>
            </div>

            {!handover && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: "#ffffff",
                  color: "var(--orange-ink)",
                  border: "1px solid rgba(176,70,23,0.25)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Customer Lock is non-negotiable. The agent cannot send this message without human approval."
              >
                <span>🔒</span> Customer Lock: Requires Human Click
              </span>
            )}
          </div>

          <div style={{ padding: "14px 16px" }}>
            {mode === "editing" && !handover ? (
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                aria-label="Message text"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1.5px solid var(--ink)",
                  borderRadius: "8px",
                  fontSize: "13.5px",
                  fontFamily: "var(--font-body)",
                }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.55", color: "var(--ink)", whiteSpace: "pre-wrap" }}>
                {draft}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Block 4: Downstream Domino Chain & Next Steps */}
      <div
        style={{
          padding: "12px 14px",
          background: "var(--tray)",
          borderRadius: "10px",
          border: "1px solid var(--hair)",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--subtle)" }}>
          <Icon name="arrow" size={13} />
          <span>What Happens Downstream When Approved</span>
        </div>
        <p style={{ margin: "6px 0 0 0", fontSize: "13px", lineHeight: "1.5", color: "var(--brown)" }}>
          {proposal.whatHappensNext}
        </p>
      </div>

      {/* Interactive Modes: Instructing Alternative Plan */}
      {mode === "instructing" && (
        <form
          className="instruct"
          style={{ marginBottom: "16px" }}
          onSubmit={(event) => {
            event.preventDefault()
            if (note.trim()) void decide("edit", { note: note.trim() })
          }}
        >
          <label htmlFor={`note-${proposal.id}`} style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}>
            Tell the autonomous agent what to do instead:
          </label>
          <textarea
            id={`note-${proposal.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            autoFocus
            placeholder="For example: Check Puttgarden ferry instead, or inspect roadside before booking hotel."
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid var(--ink)", fontSize: "13.5px" }}
          />
          <div className="decision-actions" style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            <button type="submit" className="btn btn-primary" disabled={!note.trim() || busy}>
              Send To Agent
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Interactive Modes: Logging Phone Call Handover */}
      {mode === "logging" && (
        <form
          className="instruct"
          style={{ marginBottom: "16px" }}
          onSubmit={(event) => {
            event.preventDefault()
            if (note.trim()) void decide("approve", { note: note.trim() })
          }}
        >
          <label htmlFor={`note-${proposal.id}`} style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}>
            Call Result: What did the counterparty decide?
          </label>
          <textarea
            id={`note-${proposal.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            autoFocus
            placeholder="For example: Seller manager confirmed original Vollmacht received by courier; car released to driver."
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid var(--ink)", fontSize: "13.5px" }}
          />
          <div className="decision-actions" style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            <button type="submit" className="btn btn-primary" disabled={!note.trim() || busy}>
              Record Decision &amp; Resume
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Main Action Bar */}
      {(mode === "idle" || mode === "editing") && (
        <div className="decision-actions" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px", marginTop: "12px", paddingTop: "14px", borderTop: "1px solid var(--hair)" }}>
          {handover ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setMode("logging")}
                disabled={busy}
                style={{ background: "var(--ink)", color: "#ffffff", padding: "0 18px", fontWeight: 600 }}
              >
                <Icon name="check" size={14} /> I Called Them · Log Verdict
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMode("instructing")}
                disabled={busy}
              >
                Instruct Agent Instead
              </button>
            </>
          ) : mode === "editing" ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  void decide(
                    editedSomething ? "edit" : "approve",
                    editedSomething
                      ? { editedChanges: changes, note: draft !== proposal.draftMessage?.body ? `Message changed to: ${draft}` : undefined }
                      : {}
                  )
                }
                disabled={busy}
                style={{ background: "var(--ink)", color: "#ffffff", padding: "0 18px", fontWeight: 600 }}
              >
                <Icon name="check" size={14} /> Approve With My Changes
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setChanges(proposal.changes)
                  setDraft(proposal.draftMessage?.body ?? "")
                  setMode("idle")
                }}
              >
                Discard Changes
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void decide("approve")}
                disabled={busy}
                style={{
                  background: "var(--ink)",
                  color: "#ffffff",
                  padding: "0 22px",
                  fontWeight: 600,
                  boxShadow: "0 2px 6px rgba(18, 17, 14, 0.15)",
                }}
              >
                <Icon name="check" size={14} /> Approve &amp; Execute
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMode("editing")}
                disabled={busy}
                style={{ fontWeight: 500 }}
              >
                Customize Changes
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void decide("reject")}
                disabled={busy}
                style={{ color: "var(--red-ink)" }}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn btn-link"
                onClick={() => setMode("instructing")}
                disabled={busy}
                style={{ marginLeft: "auto", fontSize: "13px" }}
              >
                Instruct Agent Alternative...
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

const VERDICT: Record<Decision["verdict"], { title: string; tone: string }> = {
  approve: { title: "Approved & Executed", tone: "ok" },
  edit: { title: "Returned with Operator Instructions", tone: "accent" },
  reject: { title: "Rejected by Operator", tone: "neutral" },
}

function DecidedCard({
  proposal,
  decision,
  delivery,
  onUndo,
}: {
  proposal: Proposal
  decision: Decision
  delivery: "sent" | "local"
  onUndo?: () => void
}) {
  const handover = proposal.action === "handover_to_person"
  const verdict = decision.verdict === "approve" && handover ? { title: "Call Result Logged", tone: "ok" } : VERDICT[decision.verdict]
  const next =
    decision.verdict === "reject"
      ? "The proposal was dismissed. The delivery baseline remains unchanged while waiting for alternative planning."
      : decision.verdict === "edit"
      ? "The road agent has ingested your instructions and is running new feasibility checks. No bookings or customer messages will occur until the next proposal."
      : proposal.whatHappensAfter ?? proposal.whatHappensNext

  return (
    <section
      className={`decision decided tone-${verdict.tone}`}
      aria-live="polite"
      style={{
        background: "#ffffff",
        border: "1.5px solid var(--green)",
        borderRadius: "16px",
        padding: "22px 24px",
        boxShadow: "0 4px 16px -2px rgba(27, 122, 82, 0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <p className="decision-eyebrow" style={{ margin: 0, color: "var(--green-ink)", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <Icon name="check" size={13} /> {verdict.title} · Operator {decision.decidedBy}
        </p>
        <span style={{ fontSize: "11px", fontWeight: 700, background: "var(--green-bg)", color: "var(--green-ink)", padding: "2px 8px", borderRadius: "10px" }}>
          Action Dispatched
        </span>
      </div>

      <h2 className="decision-title" style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px 0" }}>
        {proposal.title}
      </h2>

      {decision.note && (
        <div style={{ background: "var(--tray)", padding: "10px 14px", borderRadius: "8px", margin: "8px 0 12px", border: "1px solid var(--hair)", fontStyle: "italic", fontSize: "13px" }}>
          “{decision.note}”
        </div>
      )}

      <p className="next-step" style={{ fontSize: "13px", lineHeight: "1.5", color: "var(--brown)" }}>
        <b>What happens next:</b> {next}
      </p>

      {delivery === "local" && (
        <p className="decided-local" style={{ fontSize: "11.5px", color: "var(--subtle)", marginTop: "10px" }}>
          Simulation mode: The approval record was verified and committed to this session state.
        </p>
      )}

      {delivery === "local" && onUndo && (
        <div className="decision-actions" style={{ marginTop: "12px" }}>
          <button type="button" className="btn btn-ghost" onClick={onUndo} style={{ fontSize: "12px" }}>
            Undo Decision
          </button>
        </div>
      )}
    </section>
  )
}
