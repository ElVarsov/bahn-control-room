"use client"

import type { AgentRun, TraceStep } from "@/lib/contracts"
import { fmtClock, fmtLong } from "@/lib/present/time"
import { Icon } from "../icons"

const TOOL_WORDS: Record<string, string> = {
  read_order: "Read order file & delivery SLA",
  read_tracking: "Checked GPS telemetry & position",
  read_messages: "Read customer & driver conversation",
  check_booking_outcome: "Checked booking status with ferry operator",
  search_ferries: "Searched Baltic RoRo sailings & capacity",
  search_hotels: "Searched nearby driver hotels",
  search_trains: "Searched rail connections",
  search_drivers: "Looked for nearby qualified drivers",
  read_open_issues: "Checked active alerts & roadside incidents",
  read_travel: "Checked booked tickets & travel quotes",
  book_travel: "Booked travel (post-operator approval)",
  change_date: "Updated delivery promise (post-operator approval)",
  approve_cost: "Approved expense voucher (post-operator approval)",
  resolve_alert: "Resolved incident alert (post-operator approval)",
}

function toolWords(tool: string): string {
  return TOOL_WORDS[tool] ?? tool.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

type Line = { at: string; icon: string; title: string; detail?: string; kind: "check" | "contact" | "thought" | "stop" | "proposal" }

function toLines(steps: TraceStep[]): Line[] {
  const lines: Line[] = []
  for (const step of steps) {
    switch (step.kind) {
      case "tool_result":
        lines.push({ at: step.at, icon: "check", title: toolWords(step.tool), detail: step.summary, kind: "check" })
        break
      case "call":
        lines.push({ at: step.at, icon: "phone", title: step.status === "completed" ? "Phoned the driver" : `Attempted driver call (${step.status.replace("_", " ")})`, detail: step.summary, kind: "contact" })
        break
      case "message_out":
        lines.push({ at: step.at, icon: "message", title: `Sent message to ${step.toName}`, detail: step.body, kind: "contact" })
        break
      case "message_in":
        lines.push({ at: step.at, icon: "message", title: `${step.fromName} replied${step.simulated ? " (simulated)" : ""}`, detail: step.body, kind: "contact" })
        break
      case "thought":
        lines.push({ at: step.at, icon: "note", title: "Feasibility Assessment", detail: step.text, kind: "thought" })
        break
      case "stop":
        lines.push({ at: step.at, icon: step.reason === "needs_person" ? "flag" : "check", title: step.summary, kind: "stop" })
        break
      default:
        break
    }
  }
  return lines
}

export function AgentWork({ runs, zone }: { runs: AgentRun[]; snapshotAt: string; zone: string }) {
  return (
    <section
      className="agent-work"
      aria-labelledby="agent-work-title"
      style={{
        background: "#ffffff",
        border: "1px solid var(--hair)",
        borderRadius: "14px",
        padding: "20px 22px",
        boxShadow: "0 2px 10px -2px rgba(18, 17, 14, 0.04), 0 0 0 1px rgba(18, 17, 14, 0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
        <h2 id="agent-work-title" className="case-section-title" style={{ margin: 0, fontSize: "16px", fontWeight: 700, letterSpacing: "-0.015em" }}>
          Autonomous Road Agent Execution Trace
        </h2>
        <span style={{ fontSize: "11.5px", color: "var(--subtle)" }}>
          Read tools &amp; checks are free · World-changing actions wait for operator
        </span>
      </div>

      {runs.map((run) => (
        <div key={run.id} className="agent-run" style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 12px",
              borderRadius: "8px",
              background: "var(--teal-bg)",
              border: "1px solid rgba(31,111,123,0.15)",
              marginBottom: "12px",
            }}
          >
            <span className="agent-pulse state-working" style={{ width: "6px", height: "6px" }} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--teal-ink)" }}>
              Run Trigger: {run.trigger}
            </span>
            <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--teal-ink)", fontFamily: "var(--font-mono)" }}>
              {run.id}
            </span>
          </div>

          <ol className="agent-steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {toLines(run.steps).map((line, index) => {
              const isContact = line.kind === "contact"
              const isStop = line.kind === "stop"
              const isThought = line.kind === "thought"

              return (
                <li
                  key={index}
                  className={`agent-step kind-${line.kind}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px minmax(0, 1fr)",
                    gap: "12px",
                    padding: "8px 0",
                    borderTop: index > 0 ? "1px solid var(--hair-soft)" : "none",
                  }}
                >
                  <span
                    className="agent-step-icon"
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: isStop ? "var(--ink)" : isContact ? "var(--teal-bg)" : "var(--birch)",
                      color: isStop ? "#ffffff" : isContact ? "var(--teal-ink)" : "var(--subtle)",
                      border: isStop || isContact ? "none" : "1px solid var(--hair)",
                      fontSize: "11px",
                    }}
                  >
                    <Icon name={line.icon} size={11} />
                  </span>

                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                      <p className="agent-step-title" style={{ fontSize: "13.5px", fontWeight: isStop ? 700 : 600, color: "var(--ink)", margin: 0 }}>
                        {line.title}
                      </p>
                      <time dateTime={line.at} title={fmtLong(line.at)} style={{ fontSize: "11.5px", color: "var(--subtle)", fontFamily: "var(--font-mono)" }}>
                        {fmtClock(line.at, zone)}
                      </time>
                    </div>

                    {line.detail && (
                      <p
                        className="agent-step-detail"
                        style={{
                          margin: "3px 0 0 0",
                          fontSize: "12.5px",
                          lineHeight: "1.45",
                          color: isThought ? "var(--muted)" : "var(--brown)",
                          fontStyle: isThought ? "italic" : "normal",
                        }}
                      >
                        {line.detail}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </section>
  )
}
