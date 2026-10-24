"use client"

import { useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { Icon } from "../icons"
import { QueueList } from "./queue-list"
import { AgentsWorking } from "./agents-working"
import { KpiRibbon } from "./kpi-ribbon"
import type { QueueItem } from "@/lib/contracts"
import type { OrderCascadeAssessment } from "@/lib/cascade-risk"

const FleetMap = dynamic(() => import("../fleet-map").then((mod) => mod.FleetMap), {
  ssr: false,
  loading: () => (
    <div style={{ height: "580px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--birch)", borderRadius: "14px", border: "1px solid var(--hair)", gap: "10px" }}>
      <div style={{ width: "24px", height: "24px", border: "3px solid var(--hair)", borderTopColor: "var(--teal)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <p style={{ color: "var(--muted)", fontSize: "13px" }}>Loading European Fleet Radar...</p>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  ),
})

export function DashboardView({
  items,
  workingItems,
  snapshotAt,
  zone,
  quietCount,
  cascadeRisks,
}: {
  items: QueueItem[]
  workingItems: QueueItem[]
  snapshotAt: string
  zone: string
  quietCount: number
  cascadeRisks?: {
    needsDecisionNow: OrderCascadeAssessment[]
    willBreakToday: OrderCascadeAssessment[]
    onTrackCount: number
  }
}) {
  const [viewMode, setViewMode] = useState<"needs_now" | "will_break_today" | "map" | "split">("needs_now")

  const willBreakList = cascadeRisks?.willBreakToday ?? []
  const onTrackCount = cascadeRisks?.onTrackCount ?? quietCount

  return (
    <div>
      {/* Calm 80%+ On-Track Summary Pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--green-bg)",
          border: "1px solid rgba(27,122,82,0.22)",
          borderRadius: "10px",
          padding: "9px 16px",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "var(--green-ink)" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--green)" }} />
          <span>{onTrackCount} orders on track — handled quietly by autonomous corridor agents</span>
        </div>
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
          Predictive Cascade Engine active · Customer Lock active
        </span>
      </div>

      {/* Executive KPI Ribbon */}
      <KpiRibbon
        decisionsCount={items.length}
        inTransitCount={24}
        quietCount={onTrackCount}
        warningsCount={willBreakList.length}
        vesselsCount={3}
      />

      {/* View Switcher & Operational Status Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
          flexWrap: "wrap",
          gap: "12px",
          background: "var(--tray)",
          padding: "8px 12px",
          borderRadius: "12px",
          border: "1px solid var(--hair)",
        }}
      >
        <div style={{ display: "inline-flex", background: "var(--hair-soft)", padding: "3px", borderRadius: "9px", border: "1px solid var(--hair)" }}>
          {/* Tab 1: Needs Decision Now */}
          <button
            type="button"
            onClick={() => setViewMode("needs_now")}
            style={{
              padding: "7px 15px",
              borderRadius: "7px",
              fontSize: "12.5px",
              fontWeight: 600,
              border: "none",
              background: viewMode === "needs_now" ? "#ffffff" : "transparent",
              color: viewMode === "needs_now" ? "var(--ink)" : "var(--muted)",
              boxShadow: viewMode === "needs_now" ? "0 2px 5px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--red)" }} />
            Needs Decision Now ({items.length})
          </button>

          {/* Tab 2: Will Break Today (Cascade Prediction) */}
          <button
            type="button"
            onClick={() => setViewMode("will_break_today")}
            style={{
              padding: "7px 15px",
              borderRadius: "7px",
              fontSize: "12.5px",
              fontWeight: 600,
              border: "none",
              background: viewMode === "will_break_today" ? "#ffffff" : "transparent",
              color: viewMode === "will_break_today" ? "var(--ink)" : "var(--muted)",
              boxShadow: viewMode === "will_break_today" ? "0 2px 5px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              transition: "all 0.15s ease",
            }}
          >
            <span>⚡</span>
            Will Break Today ({willBreakList.length})
          </button>

          {/* Tab 3: Live Fleet Radar */}
          <button
            type="button"
            onClick={() => setViewMode("map")}
            style={{
              padding: "7px 15px",
              borderRadius: "7px",
              fontSize: "12.5px",
              fontWeight: 600,
              border: "none",
              background: viewMode === "map" ? "#ffffff" : "transparent",
              color: viewMode === "map" ? "var(--ink)" : "var(--muted)",
              boxShadow: viewMode === "map" ? "0 2px 5px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              transition: "all 0.15s ease",
            }}
          >
            <span>🗺️</span>
            Live Fleet Radar
          </button>

          {/* Tab 4: Split View */}
          <button
            type="button"
            onClick={() => setViewMode("split")}
            style={{
              padding: "7px 15px",
              borderRadius: "7px",
              fontSize: "12.5px",
              fontWeight: 600,
              border: "none",
              background: viewMode === "split" ? "#ffffff" : "transparent",
              color: viewMode === "split" ? "var(--ink)" : "var(--muted)",
              boxShadow: viewMode === "split" ? "0 2px 5px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              transition: "all 0.15s ease",
            }}
          >
            <span>🔀</span>
            Split View
          </button>
        </div>

        {/* Operational Guardrail Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 9px",
              borderRadius: "20px",
              background: "var(--birch)",
              border: "1px solid var(--sand)",
              color: "var(--brown)",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
            title="Customer Lock is permanently active. The agent cannot contact customers without human approval."
          >
            <span style={{ color: "#d97706" }}>🔒</span> Customer Lock: Active
          </span>

          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 9px",
              borderRadius: "20px",
              background: "var(--teal-bg)",
              border: "1px solid rgba(31,111,123,0.2)",
              color: "var(--teal-ink)",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <span className="agent-pulse state-working" style={{ width: "6px", height: "6px" }} />
            Autonomous Road Agent: Active
          </span>

          <Link
            href="/map"
            style={{
              fontSize: "12px",
              color: "var(--brown)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontWeight: 500,
              marginLeft: "6px",
            }}
          >
            Fullscreen Map <Icon name="arrow" size={12} />
          </Link>
        </div>
      </div>

      {/* Mode 1: Needs Decision Now */}
      {viewMode === "needs_now" && (
        <>
          {items.length === 0 ? (
            <section className="queue-empty">
              <Icon name="check" size={22} />
              <h2>No active broken chains right now.</h2>
              <p>Agents are handling {workingItems.length} orders and {onTrackCount} are running quietly.</p>
            </section>
          ) : (
            <QueueList items={items} snapshotAt={snapshotAt} zone={zone} />
          )}

          {workingItems.length > 0 && (
            <AgentsWorking items={workingItems} snapshotAt={snapshotAt} />
          )}
        </>
      )}

      {/* Mode 2: Will Break Today (Predictive Cascade Queue) */}
      {viewMode === "will_break_today" && (
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ background: "var(--orange-bg)", border: "1px solid rgba(176,70,23,0.25)", borderRadius: "10px", padding: "12px 16px" }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 700, color: "var(--orange-ink)" }}>
              Predictive Cascade Risk Queue (Sorted by Point of No Return)
            </h3>
            <p style={{ margin: 0, fontSize: "12.5px", color: "var(--brown)", lineHeight: "1.4" }}>
              These orders are currently marked on schedule in legacy systems, but our cascade engine detected critical slack erosion (&lt;60m buffer), missing pickup paperwork, or data contradictions that will break today unless resolved proactively.
            </p>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {willBreakList.map((item) => (
              <div
                key={item.orderId}
                style={{
                  background: "#ffffff",
                  border: "1.5px solid var(--hair)",
                  borderRadius: "12px",
                  padding: "16px 18px",
                  boxShadow: "0 2px 8px rgba(18, 17, 14, 0.04)",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: "var(--orange-bg)",
                        color: "var(--orange-ink)",
                        border: "1px solid rgba(176,70,23,0.25)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span>⏳</span> {item.pointOfNoReturnLabel}
                    </span>

                    {item.slackMinutes !== null && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: item.slackMinutes <= 0 ? "var(--red-bg)" : "var(--orange-bg)",
                          color: item.slackMinutes <= 0 ? "var(--red-ink)" : "var(--orange-ink)",
                        }}
                      >
                        {item.slackMinutes <= 0 ? `❌ ${item.slackMinutes}m slack breach` : `⚠️ ${item.slackMinutes}m critical slack`}
                      </span>
                    )}

                    <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--ink)" }}>
                      {item.car}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", background: "var(--tray)", padding: "1px 6px", borderRadius: "4px" }}>
                      {item.orderReference}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: "var(--subtle)" }}>Cost at Risk:</span>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--red-ink)", fontFamily: "var(--font-mono)" }}>
                      €{item.cascadeCostAtRiskEur}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: "13.5px", color: "var(--ink)", fontWeight: 500, lineHeight: "1.45" }}>
                  {item.summary}
                </div>

                {/* Domino Chain Steps Pill Strip */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", background: "var(--tray)", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--hair-soft)" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", color: "var(--subtle)", marginRight: "4px" }}>
                    Chain:
                  </span>
                  {item.chainSteps.map((step, sIdx) => (
                    <span key={sIdx} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px" }}>
                      <span
                        style={{
                          fontWeight: step.status === "broken" ? 700 : step.status === "tight_buffer" ? 600 : 500,
                          color: step.status === "broken" ? "var(--red-ink)" : step.status === "tight_buffer" ? "var(--orange-ink)" : "var(--brown)",
                        }}
                      >
                        {step.name}
                      </span>
                      {sIdx < item.chainSteps.length - 1 && <span style={{ color: "var(--sand)" }}>➔</span>}
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                  <span style={{ fontSize: "12px", color: "var(--brown)", fontWeight: 500 }}>
                    Route: {item.route}
                  </span>
                  <Link
                    href={`/orders/${item.orderId}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "var(--ink)",
                      textDecoration: "underline",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "var(--hair-soft)",
                    }}
                  >
                    Open 4-Block Decision Brief <Icon name="arrow" size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode 3: Fleet Map */}
      {viewMode === "map" && (
        <div style={{ marginTop: "10px" }}>
          <FleetMap />
        </div>
      )}

      {/* Mode 4: Split View */}
      {viewMode === "split" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px", color: "var(--ink)" }}>
              Active Exceptions &amp; Decisions ({items.length})
            </div>
            <QueueList items={items} snapshotAt={snapshotAt} zone={zone} />
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px", color: "var(--ink)" }}>
              Live Fleet Radar Overlay
            </div>
            <FleetMap />
          </div>
        </div>
      )}
    </div>
  )
}
