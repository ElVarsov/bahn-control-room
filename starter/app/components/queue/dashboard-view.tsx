"use client"

import { useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { Icon } from "../icons"
import { QueueList } from "./queue-list"
import { AgentsWorking } from "./agents-working"
import { KpiRibbon } from "./kpi-ribbon"
import type { QueueItem } from "@/lib/contracts"

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
}: {
  items: QueueItem[]
  workingItems: QueueItem[]
  snapshotAt: string
  zone: string
  quietCount: number
}) {
  const [viewMode, setViewMode] = useState<"queue" | "map" | "split">("queue")

  return (
    <div>
      {/* Figma-Grade Executive KPI Strip */}
      <KpiRibbon
        decisionsCount={items.length}
        inTransitCount={24}
        quietCount={quietCount}
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
          <button
            type="button"
            onClick={() => setViewMode("queue")}
            style={{
              padding: "7px 15px",
              borderRadius: "7px",
              fontSize: "12.5px",
              fontWeight: 600,
              border: "none",
              background: viewMode === "queue" ? "#ffffff" : "transparent",
              color: viewMode === "queue" ? "var(--ink)" : "var(--muted)",
              boxShadow: viewMode === "queue" ? "0 2px 5px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--red)" }} />
            Needs you ({items.length})
          </button>

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
            Live Fleet Radar (100)
          </button>

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
            Split View (Cards + Map)
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
            Open Fullscreen Map <Icon name="arrow" size={12} />
          </Link>
        </div>
      </div>

      {/* Mode 1: Queue Only */}
      {viewMode === "queue" && (
        <>
          {items.length === 0 ? (
            <section className="queue-empty">
              <Icon name="check" size={22} />
              <h2>Nothing needs you right now.</h2>
              <p>Agents are working on {workingItems.length} orders and {quietCount} are running quietly.</p>
            </section>
          ) : (
            <QueueList items={items} snapshotAt={snapshotAt} zone={zone} />
          )}

          {workingItems.length > 0 && <AgentsWorking items={workingItems} snapshotAt={snapshotAt} />}

          {/* Radar Preview Strip */}
          <section style={{ marginTop: "24px", marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--birch)",
                border: "1px solid var(--hair)",
                borderRadius: "10px",
                padding: "12px 18px",
                cursor: "pointer",
              }}
              onClick={() => setViewMode("map")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "16px" }}>🚢</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                    European Fleet & Baltic Ferry Radar is Live
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    3 Baltic RoRo ferry transporters sailing · 14 exception safe-stops tracked in Germany & Denmark
                  </div>
                </div>
              </div>
              <button
                type="button"
                style={{
                  background: "var(--ink)",
                  color: "#ffffff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Open Radar Map →
              </button>
            </div>
          </section>

          <section className="queue-quiet">
            <Icon name="eye" />
            <p>
              <b>{quietCount} orders are running quietly.</b> Agents watch them and bring them here if something changes.
            </p>
            <Link href="/board" className="quiet-link">See all orders <Icon name="arrow" size={14} /></Link>
          </section>
        </>
      )}

      {/* Mode 2: Map Only */}
      {viewMode === "map" && (
        <div style={{ marginBottom: "24px" }}>
          <FleetMap />
        </div>
      )}

      {/* Mode 3: Split View */}
      {viewMode === "split" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "30px" }}>
          <FleetMap />

          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px 0", color: "var(--ink)" }}>
              Needs Your Decision ({items.length})
            </h2>
            <QueueList items={items} snapshotAt={snapshotAt} zone={zone} />
          </div>
        </div>
      )}
    </div>
  )
}
