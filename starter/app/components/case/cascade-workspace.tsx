"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { OrderCascadeAssessment, CascadeCandidateOption, ProvenanceCitation } from "@/lib/cascade-risk"
import { Icon } from "../icons"

export function CascadeWorkspace({
  assessment,
  orderId,
}: {
  assessment: OrderCascadeAssessment
  orderId: string
}) {
  const [selectedOptionId, setSelectedOptionId] = useState<string>(
    assessment.options.find((o) => o.isRecommended)?.id ?? assessment.options[0]?.id ?? ""
  )
  const [activeCitation, setActiveCitation] = useState<ProvenanceCitation | null>(null)
  const [operatorNote, setOperatorNote] = useState("")
  const [isExecuting, setIsExecuting] = useState(false)
  const [executedVerdict, setExecutedVerdict] = useState<string | null>(null)
  const router = useRouter()

  const selectedOption = assessment.options.find((o) => o.id === selectedOptionId) ?? assessment.options[0]

  const handleApprove = async () => {
    setIsExecuting(true)
    try {
      await fetch(`/api/proposals/${encodeURIComponent(orderId)}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          verdict: "approve",
          decidedBy: "Operations Console",
          decidedAt: new Date().toISOString(),
          note: operatorNote || `Approved cascade-safe option: ${selectedOption?.title}`,
        }),
      })
    } catch {}
    setIsExecuting(false)
    setExecutedVerdict(selectedOption?.title ?? "Approved")
    router.refresh()
  }

  return (
    <div style={{ display: "grid", gap: "24px", marginBottom: "32px" }}>
      {/* Active Citation Inspection Drawer / Modal */}
      {activeCitation && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(18, 17, 14, 0.45)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setActiveCitation(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "540px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              border: "1px solid var(--hair)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--teal-ink)", background: "var(--teal-bg)", padding: "2px 8px", borderRadius: "6px" }}>
                Verified Evidence Source
              </span>
              <button
                type="button"
                onClick={() => setActiveCitation(null)}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: "16px", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 8px 0", color: "var(--ink)" }}>
              {activeCitation.label}
            </h3>
            <div style={{ fontSize: "12px", color: "var(--subtle)", fontFamily: "var(--font-mono)", marginBottom: "14px" }}>
              Record ID: {activeCitation.sourceId} · Type: {activeCitation.sourceType.toUpperCase()}
            </div>
            <div style={{ background: "var(--tray)", padding: "14px", borderRadius: "10px", border: "1px solid var(--hair)", fontSize: "13.5px", lineHeight: "1.55", color: "var(--brown)" }}>
              “{activeCitation.excerpt}”
            </div>
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveCitation(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Confirmation Toast */}
      {executedVerdict && (
        <div style={{ background: "var(--green-bg)", border: "1px solid rgba(27,122,82,0.3)", borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--green-ink)", color: "#fff", display: "grid", placeItems: "center", fontSize: "12px" }}>
              ✓
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--green-ink)" }}>
                Cascade Prevention Plan Approved &amp; Dispatched
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--brown)" }}>
                Executed: {executedVerdict} · Downstream actions queued
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setExecutedVerdict(null)} style={{ fontSize: "12px" }}>
            Dismiss
          </button>
        </div>
      )}

      {/* BLOCK 1: The Chain & Where It Snaps (Visual Buffer Bar) */}
      <section
        style={{
          background: "#ffffff",
          border: "1.5px solid var(--hair)",
          borderRadius: "16px",
          padding: "22px 24px",
          boxShadow: "0 2px 10px rgba(18, 17, 14, 0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: assessment.triageState === "NEEDS_DECISION_NOW" ? "var(--red-bg)" : "var(--orange-bg)",
                  color: assessment.triageState === "NEEDS_DECISION_NOW" ? "var(--red-ink)" : "var(--orange-ink)",
                  border: `1px solid ${assessment.triageState === "NEEDS_DECISION_NOW" ? "rgba(180,44,66,0.25)" : "rgba(176,70,23,0.25)"}`,
                }}
              >
                {assessment.triageState === "NEEDS_DECISION_NOW" ? "🚨 Active Broken Chain" : "⚡ Will Break Today"}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--red-ink)", display: "flex", alignItems: "center", gap: "4px" }}>
                <span>⏳</span> {assessment.pointOfNoReturnLabel}
              </span>
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", margin: "6px 0 2px 0", color: "var(--ink)" }}>
              Block 1: Handoff Chain &amp; Critical Slack Buffer
            </h2>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "11.5px", color: "var(--subtle)" }}>Cascade Cost at Risk:</span>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--red-ink)", fontFamily: "var(--font-mono)" }}>
              €{assessment.cascadeCostAtRiskEur}
            </span>
          </div>
        </div>

        {/* Horizontal Visual Step Chain (Slack Bar) */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: "8px",
            overflowX: "auto",
            padding: "12px 0",
            marginBottom: "16px",
          }}
        >
          {assessment.chainSteps.map((step, idx) => {
            const isBroken = step.status === "broken"
            const isTight = step.status === "tight_buffer"
            const borderColor = isBroken ? "var(--red)" : isTight ? "var(--orange)" : "var(--hair)"
            const bgColor = isBroken ? "var(--red-bg)" : isTight ? "var(--orange-bg)" : "var(--tray)"

            return (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 0 170px" }}>
                <div
                  style={{
                    flex: 1,
                    background: bgColor,
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: "10px",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: isBroken ? "var(--red-ink)" : isTight ? "var(--orange-ink)" : "var(--brown)" }}>
                      Step {idx + 1}
                    </span>
                    {step.slackMinutes !== null && (
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: isBroken ? "var(--red)" : isTight ? "var(--orange)" : "var(--green)",
                          color: "#ffffff",
                        }}
                      >
                        {step.slackMinutes < 0 ? `${step.slackMinutes}m breach` : `${step.slackMinutes}m slack`}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {step.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {step.scheduledAt}
                  </div>
                  <div style={{ fontSize: "10.5px", color: "var(--subtle)", marginTop: "2px", lineHeight: "1.3" }}>
                    {step.detail}
                  </div>
                </div>

                {idx < assessment.chainSteps.length - 1 && (
                  <span style={{ color: "var(--sand)", fontWeight: 700, fontSize: "14px" }}>
                    ➔
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* 2-Sentence Plain English Summary */}
        <p style={{ fontSize: "14px", lineHeight: "1.5", color: "var(--ink)", margin: "0 0 14px 0", fontWeight: 500 }}>
          {assessment.summary}
        </p>

        {/* Clickable Provenance Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", paddingTop: "12px", borderTop: "1px solid var(--hair-soft)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Evidence Provenance:
          </span>
          {assessment.provenanceCitations.map((cit, idx) => (
            <button
              key={idx}
              type="button"
              className="provenance-pill"
              onClick={() => setActiveCitation(cit)}
              style={{
                cursor: "pointer",
                padding: "3px 9px",
                borderRadius: "6px",
                border: "1px solid var(--hair)",
                background: "var(--birch)",
                fontSize: "11.5px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                color: "var(--ink)",
              }}
              title="Click to view raw source record and excerpt"
            >
              <Icon name="file" size={12} />
              <span style={{ fontWeight: 600 }}>{cit.label}</span>
              <span style={{ color: "var(--muted)", fontSize: "10.5px" }}>🔍</span>
            </button>
          ))}
        </div>
      </section>

      {/* BLOCK 2: What the Agent Already Checked (The Cheap Work Done) */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid var(--hair)",
          borderRadius: "16px",
          padding: "20px 24px",
          boxShadow: "0 2px 10px rgba(18, 17, 14, 0.03)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
              Block 2: What the Agent Already Checked (The Cheap Work)
            </h2>
            <p style={{ fontSize: "12px", color: "var(--subtle)", margin: "2px 0 0 0" }}>
              Autonomously verified against primary documents, timetables, and driver telemetry before interrupting human operations.
            </p>
          </div>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal-ink)", background: "var(--teal-bg)", padding: "2px 8px", borderRadius: "10px" }}>
            {assessment.cheapWorkDone.length} checks completed (Free)
          </span>
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          {assessment.cheapWorkDone.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "180px minmax(0, 1fr) auto",
                alignItems: "center",
                gap: "12px",
                padding: "8px 12px",
                borderRadius: "8px",
                background: "var(--tray)",
                fontSize: "12.5px",
                border: "1px solid var(--hair-soft)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "var(--green-ink)", fontWeight: 700 }}>✓</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--brown)" }}>
                  {item.tool}()
                </span>
              </div>
              <div style={{ color: "var(--ink)", fontWeight: 500 }}>
                {item.summary}: <span style={{ color: "var(--muted)", fontWeight: 400 }}>{item.result}</span>
              </div>
              <span style={{ color: "var(--subtle)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                {item.timestamp}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* BLOCK 3: Cascade-Safe Decision Cards (Risk-Adjusted Tradeoffs) */}
      <section
        style={{
          background: "#ffffff",
          border: "1.5px solid var(--hair)",
          borderRadius: "16px",
          padding: "22px 24px",
          boxShadow: "0 2px 10px rgba(18, 17, 14, 0.04)",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
            Block 3: Cascade-Safe Decision Cards (Risk-Adjusted Cost)
          </h2>
          <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "4px 0 0 0" }}>
            Candidate plans evaluated on: <code>Expected Total Cost = Upfront Delta + (Cascade Risk % × Cost at Risk)</code>.
          </p>
        </div>

        <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
          {assessment.options.map((opt) => {
            const isSelected = opt.id === selectedOptionId
            const isRecommended = opt.isRecommended

            return (
              <div
                key={opt.id}
                onClick={() => setSelectedOptionId(opt.id)}
                style={{
                  border: isSelected ? "2px solid var(--ink)" : "1px solid var(--hair)",
                  borderRadius: "12px",
                  padding: "16px 18px",
                  background: isSelected ? "#ffffff" : "var(--birch)",
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 4px 14px rgba(18, 17, 14, 0.08)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="radio"
                      name="cascade-option"
                      checked={isSelected}
                      onChange={() => setSelectedOptionId(opt.id)}
                      style={{ cursor: "pointer" }}
                    />
                    <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                      {opt.title}
                    </h3>
                    {isRecommended && (
                      <span style={{ fontSize: "11px", fontWeight: 700, background: "var(--green-bg)", color: "var(--green-ink)", padding: "2px 7px", borderRadius: "10px", border: "1px solid rgba(27,122,82,0.2)" }}>
                        ★ Recommended Option
                      </span>
                    )}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>
                      Expected Cost: €{opt.expectedTotalCostEur.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--subtle)" }}>
                      Upfront: {opt.upfrontDeltaEur > 0 ? `+€${opt.upfrontDeltaEur}` : "€0"} · Risk: {opt.cascadeRiskPercent}%
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: "13px", lineHeight: "1.45", color: "var(--brown)", margin: "0 0 8px 0" }}>
                  {opt.actionSummary}
                </p>

                {opt.rejectionReason && (
                  <div style={{ background: "var(--red-bg)", border: "1px solid rgba(180,44,66,0.2)", borderRadius: "8px", padding: "8px 10px", fontSize: "12px", color: "var(--red-ink)", marginTop: "8px" }}>
                    <b>Agent Rejection Rationale:</b> {opt.rejectionReason}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Operator Natural Language Plan Override */}
        <div style={{ marginTop: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
            Operator Plain-English Instruction / Custom Override:
          </label>
          <input
            type="text"
            value={operatorNote}
            onChange={(e) => setOperatorNote(e.target.value)}
            placeholder="e.g., Use the 19:00 train instead and verify with Cologne reception desk..."
            style={{
              width: "100%",
              height: "36px",
              padding: "0 12px",
              borderRadius: "8px",
              border: "1px solid var(--sand)",
              fontSize: "13px",
              background: "#ffffff",
            }}
          />
        </div>
      </section>

      {/* BLOCK 4: "What Happens When You Click Approve" (Dry-Run Execution Preview) */}
      <section
        style={{
          background: "#ffffff",
          border: "1.5px solid var(--hair)",
          borderRadius: "16px",
          padding: "22px 24px",
          boxShadow: "0 2px 10px rgba(18, 17, 14, 0.04)",
        }}
      >
        <div style={{ marginBottom: "14px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
            Block 4: What Happens When You Click Approve (Dry-Run Execution Preview)
          </h2>
          <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "4px 0 0 0" }}>
            {selectedOption?.whatHappensNext}
          </p>
        </div>

        {/* Numbered Downstream Action List with Guardrail Badges */}
        <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
          {selectedOption?.dryRunActions.map((action, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: "8px",
                background: "var(--tray)",
                border: "1px solid var(--hair-soft)",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--sand)", color: "var(--ink)", fontSize: "11px", fontWeight: 700, display: "grid", placeItems: "center" }}>
                  {idx + 1}
                </span>
                <span style={{ fontWeight: 500, color: "var(--ink)" }}>
                  {action.label}
                </span>
              </div>

              <div>
                {action.isCustomerLock ? (
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "var(--orange-bg)", color: "var(--orange-ink)", border: "1px solid rgba(176,70,23,0.3)" }}>
                    🔒 Customer Guardrail: Draft Queued for Sign-Off
                  </span>
                ) : (
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "var(--green-bg)", color: "var(--green-ink)", border: "1px solid rgba(27,122,82,0.2)" }}>
                    ⚡ Auto-Executes Immediately
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Button Strip */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingTop: "14px", borderTop: "1px solid var(--hair)" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleApprove}
            disabled={isExecuting}
            style={{
              padding: "0 24px",
              height: "42px",
              fontSize: "14px",
              fontWeight: 700,
              background: "var(--ink)",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(18, 17, 14, 0.2)",
            }}
          >
            {isExecuting ? "Executing Plan..." : `Approve & Execute (${selectedOption?.title.split(" (")[0]})`}
          </button>

          <span style={{ fontSize: "12px", color: "var(--subtle)" }}>
            Takes effect against fleet telemetry instantly · Prevents €{assessment.cascadeCostAtRiskEur} downstream chain
          </span>
        </div>
      </section>
    </div>
  )
}
