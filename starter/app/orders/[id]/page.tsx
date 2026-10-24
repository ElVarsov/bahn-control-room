"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { AppFrame } from "../../components/app-frame"
import { Icon } from "../../components/icons"
import type { CaseView, Decision, Fact, Proposal, SourceRef, TimelineEntry, TraceStep } from "@/lib/contracts"

export default function OrderCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [caseView, setCaseView] = useState<CaseView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedOption, setSelectedOption] = useState<number>(0)
  const [tweakText, setTweakText] = useState("")
  const [activeSideTab, setActiveSideTab] = useState<"trace" | "timeline" | "sources">("trace")
  const [selectedSource, setSelectedSource] = useState<SourceRef | null>(null)
  const [decisionState, setDecisionState] = useState<"pending" | "executed" | "rejected">("pending")
  const [executing, setExecuting] = useState(false)
  const [showCallModal, setShowCallModal] = useState(false)
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "connected" | "ended">("idle")
  const [callTranscript, setCallTranscript] = useState<{ speaker: string; text: string }[]>([])

  useEffect(() => {
    fetch(`/api/orders/${encodeURIComponent(id)}/case`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load order case")
        return res.json()
      })
      .then((data: CaseView) => {
        setCaseView(data)
        if (data.proposals[0]?.status === "executed") {
          setDecisionState("executed")
        }
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  const proposal = caseView?.proposals[0]

  // Alternative options for the decision card
  const getDecisionOptions = () => {
    if (id === "ord-00299") {
      return [
        {
          id: 0,
          title: "Option 1 (Recommended): 24 Oct 12:00 Sailing + Lübeck Hotel",
          costDelta: "+€412",
          timeDelta: "+24h delay",
          badge: "Recommended by Agent",
          description: "Book earliest vehicle crossing with confirmed space. Hotel arranged for driver Camille Emberwick. Dealer notified for arrival on 28 Oct.",
          risk: "Low risk · 100% space confirmed",
        },
        {
          id: 1,
          title: "Option 2: Reroute via Denmark Storebælt & Øresund Bridges",
          costDelta: "+€560",
          timeDelta: "+6h delay",
          badge: "Fastest Transit",
          description: "Bypasses Baltic ferry completely. Driver drives through Flensburg, Odense, Copenhagen to Stockholm ferry. High fatigue.",
          risk: "Driver rest violation risk",
        },
        {
          id: 2,
          title: "Option 3: Escalate & Swap Driver at Leipzig Compound",
          costDelta: "+€210",
          timeDelta: "+48h delay",
          badge: "Hold & Re-assign",
          description: "Return car to secure yard. Re-post gig on driver marketplace for next week's scheduled transport carrier.",
          risk: "Customer churn risk",
        },
      ]
    }
    if (id === "ord-00322") {
      return [
        {
          id: 0,
          title: "Option 1 (Recommended): Call Autohaus Preussen (Authorized Dealer Roadside)",
          costDelta: "€0 direct",
          timeDelta: "+2h to +6h delay",
          badge: "Recommended",
          description: "Bentley warranty policy requires authorized dealer roadside technician. Presenting operator with 1-click call briefing.",
          risk: "Preserves vehicle warranty",
        },
        {
          id: 1,
          title: "Option 2: Order Emergency Flatbed Tow to Hamburg Facility",
          costDelta: "+€285",
          timeDelta: "+3h arrival",
          badge: "Local Tow",
          description: "ADAC heavy flatbed to tow Bentley directly to delivery compound. Requires subsequent dealer mechanic clearance.",
          risk: "Requires dealer cost approval",
        },
      ]
    }
    if (id === "ord-00458") {
      return [
        {
          id: 0,
          title: "Option 1 (Recommended): Freeze Driver Flight LH2042 Check-in",
          costDelta: "€0 wasted",
          timeDelta: "Reschedule to 14:00",
          badge: "Saves €380 Dry Run",
          description: "Halts non-refundable departure while buyer sends signed Vollmacht. Protects €280 flight and €100 train fare.",
          risk: "Zero financial waste",
        },
        {
          id: 1,
          title: "Option 2: Authorize Driver Departure & Dispatch Express Courier",
          costDelta: "+€140",
          timeDelta: "On schedule",
          badge: "High Risk",
          description: "Driver flies on schedule; express same-day courier carries paper Vollmacht to seller gate.",
          risk: "Seller gate may turn driver away",
        },
      ]
    }
    return [
      {
        id: 0,
        title: "Option 1: Approve Recommended Agent Plan",
        costDelta: "+€0",
        timeDelta: "0h",
        badge: "Recommended",
        description: "Proceed with verified parameters and notify field contacts.",
        risk: "Low risk",
      },
    ]
  }

  // Visual Mini-Chain Steps
  const getMiniChain = () => {
    if (id === "ord-00299") {
      return [
        { label: "Timed Out Booking", detail: "Attempted 07:10", status: "error" },
        { label: "23 Oct 22:00 Sold Out", detail: "Vela Coast ferry full", status: "error" },
        { label: "Driver Rest Needed", detail: "9h mandatory rest", status: "warning" },
        { label: "24 Oct 12:00 Quoted", detail: "+€240 vehicle slot", status: "active" },
        { label: "Dealer Approval", detail: "Customer Lock Active", status: "gated" },
      ]
    }
    if (id === "ord-00322") {
      return [
        { label: "Red Engine Lamp", detail: "Triggered at km 212", status: "error" },
        { label: "Safe Stop A7 Plaza", detail: "Driver confirmed safe", status: "ok" },
        { label: "Diagnostic Photo", detail: "Coolant warning verified", status: "ok" },
        { label: "Dealer Roadside Brief", detail: "Autohaus Preussen", status: "gated" },
      ]
    }
    if (id === "ord-00458") {
      return [
        { label: "Seller Finance Hold", detail: "Autohaus Süd", status: "error" },
        { label: "Missing Vollmacht", detail: "Not in order packet", status: "error" },
        { label: "Flight Boards 1h 45m", detail: "LH2042 (€380 at risk)", status: "warning" },
        { label: "Freeze Departure", detail: "Zero Dry Run Gate", status: "active" },
      ]
    }
    return [
      { label: "Event Triggered", detail: "Telemetry alert", status: "warning" },
      { label: "Agent Verification", detail: "Cheap checks done", status: "ok" },
      { label: "Decision Gated", detail: "Requires human yes", status: "active" },
    ]
  }

  // Handle human decision click
  const handleDecision = async (verdict: "approve" | "reject") => {
    if (!proposal) return
    setExecuting(true)
    const payload: Decision = {
      verdict,
      note: tweakText || (verdict === "approve" ? "Approved recommended plan" : "Rejected by operator"),
      decidedBy: "Ops Specialist (Current Session)",
      decidedAt: new Date().toISOString(),
    }

    try {
      const res = await fetch(`/api/proposals/${proposal.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setDecisionState(verdict === "approve" ? "executed" : "rejected")
      }
    } catch (err) {
      console.error("Decision submission error:", err)
    } finally {
      setExecuting(false)
    }
  }

  // Trigger Driver Voice Call Modal
  const startDriverCall = async () => {
    setShowCallModal(true)
    setCallStatus("calling")
    setCallTranscript([
      { speaker: "system", text: "Connecting secure WebRTC audio bridge to driver phone..." },
    ])

    try {
      const res = await fetch("/api/voice/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: id,
          driverId: "drv-140",
          driverName: "Matti V.",
          purpose: "Verify driver safety and vehicle status after red warning lamp",
          questions: ["Are you safe?", "What warning light appeared?", "Can you upload a photo?"],
        }),
      })
      const data = await res.json()
      setTimeout(() => {
        setCallStatus("connected")
        setCallTranscript((prev) => [
          ...prev,
          { speaker: "agent", text: "Hi Matti, this is Bahn Operations. We saw your safe stop report. Are you safe and where are you?" },
          { speaker: "driver", text: "Hi! Yes, I'm totally safe. Pulled into the rest stop on A7 near km 212. The red engine temperature light came on." },
          { speaker: "agent", text: "Glad you're safe. Please keep the ignition switched off. Can you upload a photo of the dashboard light via the driver app?" },
          { speaker: "driver", text: "Just took the photo and submitted it now. Waiting in the service building." },
          { speaker: "agent", text: "Received! We're briefing the dealer now. Stay warm and we'll follow up shortly." },
        ])
      }, 1500)
    } catch {
      setCallStatus("connected")
    }
  }

  if (loading) {
    return (
      <AppFrame section="queue">
        <div style={{ padding: "60px 40px", textAlign: "center", color: "var(--muted)" }}>
          Loading decision briefing card for {id}...
        </div>
      </AppFrame>
    )
  }

  if (error || !caseView) {
    return (
      <AppFrame section="queue">
        <div style={{ padding: "60px 40px", textAlign: "center" }}>
          <h2 style={{ color: "var(--red-ink)" }}>{error || "Order not found"}</h2>
          <Link href="/" style={{ color: "var(--brown)", textDecoration: "underline", marginTop: "12px", display: "inline-block" }}>
            ← Return to Control Room Queue
          </Link>
        </div>
      </AppFrame>
    )
  }

  const options = getDecisionOptions()
  const miniChain = getMiniChain()

  return (
    <AppFrame section="queue">
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "24px 28px 60px" }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
            <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>
              Control Room
            </Link>
            <span style={{ color: "var(--sand)" }}>/</span>
            <span className="mono" style={{ fontWeight: 700, color: "var(--ink)" }}>
              {caseView.orderReference}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {id === "ord-00322" && (
              <button
                onClick={startDriverCall}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "var(--teal-bg)",
                  color: "var(--teal-ink)",
                  border: "1px solid rgba(67, 175, 193, 0.3)",
                  fontSize: "12.5px",
                  fontWeight: 600,
                }}
              >
                <Icon name="driver" size={14} />
                Live Driver Voice Call
              </button>
            )}

            <Link
              href="/"
              style={{
                color: "var(--muted)",
                fontSize: "12.5px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ← Back to Queue (Esc)
            </Link>
          </div>
        </div>

        {/* Main Grid: Left 4-Block Decision Card (70%), Right Live Trace & Evidence Panel (30%) */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: "24px", alignItems: "start" }}>
          {/* LEFT: THE 4-BLOCK DECISION CARD */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* BLOCK 1: WHAT HAPPENED & CHAIN IMPACT */}
            <div
              style={{
                background: "var(--birch)",
                border: "1px solid var(--hair)",
                borderRadius: "12px",
                padding: "20px 24px",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--subtle)",
                  }}
                >
                  Block 1 · What Happened & Chain Impact
                </span>
                <span
                  style={{
                    background: "var(--red-bg)",
                    color: "var(--red-ink)",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  Exception Detected
                </span>
              </div>

              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)", lineHeight: 1.35, marginBottom: "8px" }}>
                {caseView.headline}
              </h2>

              <p style={{ fontSize: "13.5px", color: "var(--muted)", lineHeight: 1.45, marginBottom: "16px" }}>
                {proposal?.rationale || "Active chain reaction underway. Downstream arrival, driver rest, and vehicle custody require human judgment."}
              </p>

              {/* Visual Mini-Chain Diagram */}
              <div style={{ background: "var(--tray)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--hair)" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--subtle)", textTransform: "uppercase", marginBottom: "8px" }}>
                  Downstream Domino Path
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  {miniChain.map((step, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div
                        style={{
                          background:
                            step.status === "error"
                              ? "var(--red-bg)"
                              : step.status === "warning"
                              ? "var(--orange-bg)"
                              : step.status === "gated"
                              ? "var(--teal-bg)"
                              : "var(--birch)",
                          border: "1px solid var(--hair)",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            color:
                              step.status === "error"
                                ? "var(--red-ink)"
                                : step.status === "warning"
                                ? "var(--orange-ink)"
                                : step.status === "gated"
                                ? "var(--teal-ink)"
                                : "var(--ink)",
                          }}
                        >
                          {step.label}
                        </div>
                        <div style={{ fontSize: "10.5px", color: "var(--subtle)" }}>{step.detail}</div>
                      </div>
                      {idx < miniChain.length - 1 && (
                        <span style={{ color: "var(--sand)", fontSize: "14px", fontWeight: 700 }}>→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* BLOCK 2: WHAT THE AGENT ALREADY DID (THE CHEAP WORK) */}
            <div
              style={{
                background: "var(--birch)",
                border: "1px solid var(--hair)",
                borderRadius: "12px",
                padding: "20px 24px",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--subtle)" }}>
                  Block 2 · What The Agent Already Did (The Cheap Work)
                </span>
                <span style={{ fontSize: "11.5px", color: "var(--teal-ink)", fontWeight: 500 }}>
                  ✓ 4 Free Lookups Executed · Stopped before spend
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {caseView.facts.map((fact) => (
                  <div
                    key={fact.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "8px 12px",
                      background: "var(--canvas)",
                      borderRadius: "6px",
                      border: "1px solid var(--hair-soft)",
                    }}
                  >
                    <span style={{ color: "var(--teal-ink)", marginTop: "2px", fontWeight: 700 }}>✓</span>
                    <div style={{ flex: 1, fontSize: "13px", color: "var(--ink)", lineHeight: 1.4 }}>
                      {fact.text}
                      {/* Clickable Provenance Badges */}
                      <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                        {fact.sources.map((src, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setSelectedSource(src)
                              setActiveSideTab("sources")
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              background: "var(--hair-soft)",
                              color: "var(--brown)",
                              border: "1px solid var(--sand)",
                              cursor: "pointer",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>[{src.label}]</span>
                            <span style={{ color: "var(--subtle)" }}>
                              {src.actorName ? `· ${src.actorName}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BLOCK 3: THE DECISION (WITH COST & TIME DELTAS) */}
            <div
              style={{
                background: "var(--birch)",
                border: "1px solid var(--hair)",
                borderRadius: "12px",
                padding: "20px 24px",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--subtle)" }}>
                  Block 3 · The Decision (Priced Options)
                </span>
                <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                  Select an option or tweak with plain language
                </span>
              </div>

              {/* Selectable Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                {options.map((opt) => {
                  const isSelected = selectedOption === opt.id
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedOption(opt.id)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "8px",
                        border: isSelected ? "2px solid var(--teal-ink)" : "1px solid var(--hair)",
                        background: isSelected ? "var(--teal-bg)" : "var(--tray)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="radio"
                            checked={isSelected}
                            onChange={() => setSelectedOption(opt.id)}
                            style={{ accentColor: "var(--teal-ink)" }}
                          />
                          <span style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink)" }}>{opt.title}</span>
                        </div>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: "4px",
                            background: isSelected ? "var(--teal)" : "var(--hair)",
                            color: isSelected ? "#fff" : "var(--brown)",
                          }}
                        >
                          {opt.badge}
                        </span>
                      </div>

                      <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "4px 0 8px 24px" }}>
                        {opt.description}
                      </p>

                      <div style={{ display: "flex", gap: "16px", marginLeft: "24px", fontSize: "12px" }}>
                        <span>
                          Cost Delta: <b style={{ color: opt.costDelta.startsWith("+") ? "var(--orange-ink)" : "var(--teal-ink)" }}>{opt.costDelta}</b>
                        </span>
                        <span>
                          Timeline Impact: <b>{opt.timeDelta}</b>
                        </span>
                        <span style={{ color: "var(--subtle)" }}>{opt.risk}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Tweak / "Tell the agent instead" Free Text Input */}
              <div style={{ marginTop: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--brown)", marginBottom: "4px" }}>
                  Or tell the agent to modify the plan:
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={tweakText}
                    onChange={(e) => setTweakText(e.target.value)}
                    placeholder="e.g. 'Change hotel to Ibis Budget Lübeck and book' or 'Ask driver if they need meal allowance'"
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--hair)",
                      background: "var(--canvas)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                  {tweakText && (
                    <button
                      onClick={() => setTweakText("")}
                      style={{ padding: "0 10px", background: "none", border: "none", color: "var(--subtle)", cursor: "pointer" }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* BLOCK 4: WHAT HAPPENS NEXT (DRY-RUN PREVIEW & STRICT GUARDRAILS) */}
            <div
              style={{
                background: decisionState === "executed" ? "var(--green-bg)" : "var(--birch)",
                border: decisionState === "executed" ? "1px solid var(--green)" : "1px solid var(--hair)",
                borderRadius: "12px",
                padding: "20px 24px",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--subtle)" }}>
                  Block 4 · What Happens Next When You Click Approve
                </span>

                {/* STRICT GUARDRAIL VISIBILITY PILL */}
                <div style={{ display: "flex", gap: "6px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "var(--green-bg)",
                      color: "var(--green-ink)",
                      border: "1px solid rgba(41, 175, 119, 0.3)",
                    }}
                  >
                    ● Auto-Executable: Driver & Yard
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "var(--orange-bg)",
                      color: "var(--orange-ink)",
                      border: "1px solid rgba(253, 106, 49, 0.3)",
                    }}
                  >
                    🔒 Customer Lock: Human Send Required
                  </span>
                </div>
              </div>

              {decisionState === "executed" ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--green-ink)", fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>
                    <span>✓ Decision Executed Successfully</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--green-ink)", margin: 0 }}>
                    Travel bookings secured. Digital vouchers pushed to driver app. Delay notification email drafted and placed in Customer Review Outbox for your signature.
                  </p>
                </div>
              ) : (
                <div>
                  {/* Exact Dry-Run Action List */}
                  <div style={{ background: "var(--tray)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--hair)", marginBottom: "16px" }}>
                    <div style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--brown)", marginBottom: "6px" }}>
                      Dry-Run Execution Plan:
                    </div>
                    <div style={{ fontSize: "12.5px", color: "var(--ink)", lineHeight: 1.5 }}>
                      {proposal?.whatHappensNext || "1. Confirm booking with provider API • 2. Push updated schedule to driver • 3. Stage customer email draft."}
                    </div>
                  </div>

                  {/* Customer Lock Warning */}
                  <div style={{ fontSize: "12px", color: "var(--orange-ink)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🔒</span>
                    <span>
                      <b>Rule of the Game:</b> The agent never contacts a customer directly. The customer delay notice is queued in draft mode for your explicit click.
                    </span>
                  </div>

                  {/* Approve / Reject Action Buttons */}
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => handleDecision("approve")}
                      disabled={executing}
                      style={{
                        flex: 1,
                        background: "var(--ink)",
                        color: "var(--birch)",
                        padding: "10px 20px",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: 600,
                        border: "none",
                        cursor: executing ? "not-allowed" : "pointer",
                      }}
                    >
                      {executing ? "Executing Actions..." : "Approve & Execute Recommended Plan"}
                    </button>

                    <button
                      onClick={() => handleDecision("reject")}
                      disabled={executing}
                      style={{
                        padding: "10px 18px",
                        background: "var(--canvas)",
                        color: "var(--red-ink)",
                        borderRadius: "8px",
                        fontSize: "13.5px",
                        fontWeight: 600,
                        border: "1px solid var(--hair)",
                        cursor: executing ? "not-allowed" : "pointer",
                      }}
                    >
                      Reject & Escalate
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: TABBED INSPECTOR (LIVE AGENT TRACE, TIMELINE, SOURCE PROVENANCE) */}
          <div
            style={{
              background: "var(--birch)",
              border: "1px solid var(--hair)",
              borderRadius: "12px",
              padding: "16px 18px",
              boxShadow: "var(--shadow-card)",
              position: "sticky",
              top: "20px",
            }}
          >
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--hair)", paddingBottom: "10px", gap: "12px", marginBottom: "14px" }}>
              <button
                onClick={() => setActiveSideTab("trace")}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: activeSideTab === "trace" ? "var(--teal-ink)" : "var(--muted)",
                  borderBottom: activeSideTab === "trace" ? "2px solid var(--teal-ink)" : "none",
                  paddingBottom: "4px",
                  cursor: "pointer",
                }}
              >
                Agent Trace
              </button>
              <button
                onClick={() => setActiveSideTab("timeline")}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: activeSideTab === "timeline" ? "var(--ink)" : "var(--muted)",
                  borderBottom: activeSideTab === "timeline" ? "2px solid var(--ink)" : "none",
                  paddingBottom: "4px",
                  cursor: "pointer",
                }}
              >
                Order Timeline
              </button>
              <button
                onClick={() => setActiveSideTab("sources")}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: activeSideTab === "sources" ? "var(--ink)" : "var(--muted)",
                  borderBottom: activeSideTab === "sources" ? "2px solid var(--ink)" : "none",
                  paddingBottom: "4px",
                  cursor: "pointer",
                }}
              >
                Evidence Inspector
              </button>
            </div>

            {/* Content: Agent Trace */}
            {activeSideTab === "trace" && (
              <div>
                <div style={{ fontSize: "11px", color: "var(--subtle)", marginBottom: "10px" }}>
                  Autonomous execution steps · Recorded in append-only trace
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "560px", overflowY: "auto" }}>
                  {caseView.runs[0]?.steps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: "12px",
                        padding: "8px 10px",
                        background: "var(--tray)",
                        borderRadius: "6px",
                        borderLeft:
                          step.kind === "thought"
                            ? "3px solid var(--sand)"
                            : step.kind === "tool_call" || step.kind === "tool_result"
                            ? "3px solid var(--teal)"
                            : step.kind === "message_in" || step.kind === "message_out"
                            ? "3px solid var(--orange)"
                            : "3px solid var(--red)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--subtle)", fontSize: "10.5px", marginBottom: "3px" }}>
                        <span style={{ fontWeight: 600, textTransform: "uppercase" }}>{step.kind}</span>
                        <span>{step.at.slice(11, 16)} UTC</span>
                      </div>
                      <div style={{ color: "var(--ink)", lineHeight: 1.35 }}>
                        {step.kind === "thought" && <i>"{step.text}"</i>}
                        {step.kind === "tool_call" && (
                          <span>
                            Tool: <b>{step.tool}</b> ({step.cost})
                          </span>
                        )}
                        {step.kind === "tool_result" && <span>{step.summary}</span>}
                        {step.kind === "message_out" && <span>Sent to {step.toName}: "{step.body}"</span>}
                        {step.kind === "message_in" && <span>From {step.fromName}: "{step.body}"</span>}
                        {step.kind === "call" && <span>Phone Call #{step.callId}: {step.summary}</span>}
                        {step.kind === "stop" && <b style={{ color: "var(--red-ink)" }}>Stop: {step.summary}</b>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content: Timeline */}
            {activeSideTab === "timeline" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "560px", overflowY: "auto" }}>
                {caseView.timeline.map((entry) => (
                  <div key={entry.id} style={{ fontSize: "12px", borderBottom: "1px solid var(--hair-soft)", paddingBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--subtle)", fontSize: "10.5px", marginBottom: "2px" }}>
                      <span>
                        <b>{entry.actor.name}</b> ({entry.channel})
                      </span>
                      <span>{entry.at.slice(11, 16)} UTC</span>
                    </div>
                    <div style={{ color: "var(--ink)", lineHeight: 1.4 }}>{entry.text}</div>
                    {entry.visibility === "internal" && (
                      <span style={{ fontSize: "10px", color: "var(--subtle)", fontStyle: "italic" }}>
                        Internal ops visibility only
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Content: Evidence Inspector */}
            {activeSideTab === "sources" && (
              <div>
                <div style={{ fontSize: "11px", color: "var(--subtle)", marginBottom: "8px" }}>
                  Selected Fact Provenance
                </div>
                {selectedSource ? (
                  <div style={{ background: "var(--tray)", padding: "12px", borderRadius: "8px", border: "1px solid var(--hair)" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>
                      {selectedSource.label}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                      Channel / Source: <b>{selectedSource.kind}</b> {selectedSource.actorName ? `· ${selectedSource.actorName}` : ""}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "var(--subtle)", marginBottom: "8px" }}>
                      Observed: {selectedSource.at}
                    </div>
                    {selectedSource.recordId && (
                      <div className="mono" style={{ fontSize: "11px", color: "var(--teal-ink)", background: "var(--birch)", padding: "4px 8px", borderRadius: "4px" }}>
                        Raw Record ID: {selectedSource.recordId}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--subtle)", fontSize: "12px" }}>
                    Click any source pill [PDF], [Quote], or [Chat] in Block 2 to inspect its exact provenance record.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Voice Call Simulation Modal (for Demo & Stage) */}
      {showCallModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(18, 17, 14, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--birch)",
              borderRadius: "16px",
              padding: "24px 28px",
              width: "480px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: callStatus === "connected" ? "var(--green)" : "var(--orange)" }} />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                  Agent Voice Call: Driver Matti V.
                </h3>
              </div>
              <button
                onClick={() => setShowCallModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--subtle)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>
              Purpose: Automated safety check following red engine lamp on A7 motorway.
            </div>

            {/* Transcript Area */}
            <div
              style={{
                background: "var(--canvas)",
                borderRadius: "8px",
                padding: "14px",
                maxHeight: "260px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              {callTranscript.map((t, idx) => (
                <div key={idx} style={{ fontSize: "12.5px", lineHeight: 1.35 }}>
                  <b style={{ color: t.speaker === "agent" ? "var(--teal-ink)" : t.speaker === "driver" ? "var(--orange-ink)" : "var(--muted)" }}>
                    {t.speaker.toUpperCase()}:
                  </b>{" "}
                  <span>{t.text}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setShowCallModal(false)}
                style={{
                  background: "var(--ink)",
                  color: "var(--birch)",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Close & Return to Briefing
              </button>
            </div>
          </div>
        </div>
      )}
    </AppFrame>
  )
}
