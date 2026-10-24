"use client"

import { useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { Icon } from "../icons"
import { QueueList } from "./queue-list"
import { AgentsWorking } from "./agents-working"
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
      {/* View Switcher Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "inline-flex", background: "var(--hair-soft)", padding: "3px", borderRadius: "8px", border: "1px solid var(--hair)" }}>
          <button
            type="button"
            onClick={() => setViewMode("queue")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "12.5px",
              fontWeight: 600,
              border: "none",
              background: viewMode === "queue" ? "#ffffff" : "transparent",
              color: viewMode === "queue" ? "var(--ink)" : "var(--muted)",
              boxShadow: viewMode === "queue" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--red)" }} />
            Needs you ({items.length})
          </button>

          <button
            type="button"
            onClick={() => setViewMode("map")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "12.5px",
              fontWeight: 600,
              border: "none",
              background: viewMode === "map" ? "#ffffff" : "transparent",
              color: viewMode === "map" ? "var(--ink)" : "var(--muted)",
              boxShadow: viewMode === "map" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>🗺️</span>
            Live Fleet Radar (100)
          </button>

          <button
            type="button"
            onClick={() => setViewMode("split")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "12.5px",
              fontWeight: 600,
              border: "none",
              background: viewMode === "split" ? "#ffffff" : "transparent",
              color: viewMode === "split" ? "var(--ink)" : "var(--muted)",
              boxShadow: viewMode === "split" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>🔀</span>
            Split View
          </button>
        </div>

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
          }}
        >
          Open Fullscreen Map <Icon name="arrow" size={12} />
        </Link>
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
