"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { AppFrame } from "./components/app-frame"
import { Icon } from "./components/icons"
import { FleetMap } from "./components/fleet-map"
import type { QueueItem, QueueResponse, Urgency } from "@/lib/contracts"

export default function QueuePage() {
  const [data, setData] = useState<QueueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"needs" | "map" | "quiet">("needs")
  const [search, setSearch] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showRoi, setShowRoi] = useState(false)

  useEffect(() => {
    fetch("/api/queue")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load queue")
        return res.json()
      })
      .then((json: QueueResponse) => {
        setData(json)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Keyboard navigation: J/K to move, Enter to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (document.activeElement?.tagName === "INPUT") return
      if (e.key === "j" || e.key === "ArrowDown") {
        setSelectedIndex((prev) => Math.min(prev + 1, (filteredNeeds?.length ?? 1) - 1))
      } else if (e.key === "k" || e.key === "ArrowUp") {
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" && filteredNeeds && filteredNeeds[selectedIndex]) {
        window.location.href = `/orders/${filteredNeeds[selectedIndex].orderId}`
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  })

  const filteredNeeds = useMemo(() => {
    if (!data?.needsPerson) return []
    if (!search.trim()) return data.needsPerson
    const q = search.toLowerCase()
    return data.needsPerson.filter(
      (item) =>
        item.orderReference.toLowerCase().includes(q) ||
        item.car.toLowerCase().includes(q) ||
        item.route.toLowerCase().includes(q) ||
        item.headline.toLowerCase().includes(q) ||
        item.why.toLowerCase().includes(q)
    )
  }, [data, search])

  const urgencyBadge = (urgency: Urgency, decideBy?: string) => {
    switch (urgency) {
      case "now":
        return {
          bg: "var(--red-bg)",
          color: "var(--red-ink)",
          label: "Point of No Return · Imminent",
          sub: "Action required in < 90 min",
        }
      case "today":
        return {
          bg: "var(--orange-bg)",
          color: "var(--orange-ink)",
          label: "Needs Call Today",
          sub: "Decision needed before terminal cutoff",
        }
      case "soon":
        return {
          bg: "var(--teal-bg)",
          color: "var(--teal-ink)",
          label: "Window Slip Watch",
          sub: "Agent monitoring; human review queued",
        }
      case "watch":
      default:
        return {
          bg: "var(--hair-soft)",
          color: "var(--brown)",
          label: "Evidence Review",
          sub: "Awaiting driver / proof upload",
        }
    }
  }

  const agentStateBadge = (state: string) => {
    switch (state) {
      case "needs_person":
        return { label: "Awaiting your call", color: "var(--red-ink)", dot: "var(--red)" }
      case "working":
        return { label: "Agent querying routes", color: "var(--teal-ink)", dot: "var(--teal)" }
      case "waiting_reply":
        return { label: "Waiting driver/site", color: "var(--orange-ink)", dot: "var(--orange)" }
      default:
        return { label: "Idle", color: "var(--muted)", dot: "var(--sand)" }
    }
  }

  return (
    <AppFrame section="queue" snapshotAt={data?.snapshotAt}>
      <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "32px 28px 60px" }}>
        {/* Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <h1 style={{ fontSize: "24px", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.02em" }}>
                Operations Control Room
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: "var(--teal-bg)",
                  color: "var(--teal-ink)",
                  border: "1px solid rgba(67, 175, 193, 0.2)",
                }}
              >
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--teal)" }} />
                {data ? `${data.quiet.count} orders moving quietly on schedule` : "Loading fleet..."}
              </span>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "14px" }}>
              Showing only the <b>{data?.needsPerson.length ?? 14}</b> deliveries requiring human judgement. Routine legwork handled autonomously by background agents.
            </p>
          </div>

          <button
            onClick={() => setShowRoi(!showRoi)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "7px 14px",
              borderRadius: "8px",
              border: "1px solid var(--hair)",
              background: showRoi ? "var(--hair-soft)" : "var(--birch)",
              color: "var(--brown)",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            <Icon name="arrow" size={13} style={{ transform: showRoi ? "rotate(90deg)" : "rotate(0deg)" }} />
            Unit Economics & ROI Model
          </button>
        </div>

        {/* Expandable Unit Economics Model (Argon & Brief Math) */}
        {showRoi && (
          <div
            style={{
              background: "var(--tray)",
              border: "1px solid var(--hair)",
              borderRadius: "12px",
              padding: "18px 22px",
              marginBottom: "24px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Ops Labor Capacity
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)", marginTop: "2px" }}>
                €2.75M / yr
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                50 ops staff × €55k (~€110 per delivered car across 25,000 trips)
              </div>
            </div>

            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Failed Pickup "Dry Run"
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--red-ink)", marginTop: "2px" }}>
                €350 – €500 / incident
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                Wasted outbound flights, train fares, driver day-rate eaten by Bahn
              </div>
            </div>

            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Ferry & Transit Domino
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--orange-ink)", marginTop: "2px" }}>
                €220 – €380 / delay
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                Missed Baltic ferry, emergency rebookings, extra driver hotel nights
              </div>
            </div>

            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Stipulated Agent Savings
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--teal-ink)", marginTop: "2px" }}>
                €345k – €510k / yr
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                Pre-flight dry run prevention + Domino rerouting + Address reconciliation
              </div>
            </div>
          </div>
        )}

        {/* Toolbar & Filters */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
          {/* Tab Selector */}
          <div style={{ display: "inline-flex", background: "var(--canvas)", padding: "3px", borderRadius: "9px", border: "1px solid var(--hair)" }}>
            <button
              onClick={() => setActiveTab("needs")}
              style={{
                padding: "6px 14px",
                borderRadius: "7px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                background: activeTab === "needs" ? "var(--birch)" : "transparent",
                color: activeTab === "needs" ? "var(--ink)" : "var(--muted)",
                boxShadow: activeTab === "needs" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                display: "flex",
                alignItems: "center",
                gap: "7px",
              }}
            >
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--red)" }} />
              Needs Your Call ({data?.needsPerson.length ?? 14})
            </button>

            <button
              onClick={() => setActiveTab("map")}
              style={{
                padding: "6px 14px",
                borderRadius: "7px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                background: activeTab === "map" ? "var(--birch)" : "transparent",
                color: activeTab === "map" ? "var(--ink)" : "var(--muted)",
                boxShadow: activeTab === "map" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                display: "flex",
                alignItems: "center",
                gap: "7px",
              }}
            >
              <span>🗺️</span>
              Live Fleet & Ferry Radar
            </button>

            <button
              onClick={() => setActiveTab("quiet")}
              style={{
                padding: "6px 14px",
                borderRadius: "7px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                background: activeTab === "quiet" ? "var(--birch)" : "transparent",
                color: activeTab === "quiet" ? "var(--ink)" : "var(--muted)",
                boxShadow: activeTab === "quiet" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                display: "flex",
                alignItems: "center",
                gap: "7px",
              }}
            >
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--teal)" }} />
              Running Quietly ({data?.quiet.count ?? 86})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: "relative", minWidth: "320px" }}>
            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--subtle)" }}>
              <Icon name="search" size={14} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order CD-..., car, city, or cause"
              style={{
                width: "100%",
                padding: "7px 12px 7px 32px",
                fontSize: "13px",
                borderRadius: "8px",
                border: "1px solid var(--hair)",
                background: "var(--birch)",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Tab 1: Needs You Queue */}
        {activeTab === "needs" && (
          <div>
            {/* Quick Map Access Banner */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "linear-gradient(90deg, var(--birch) 0%, #f0ede4 100%)",
                border: "1px solid var(--hair)",
                borderRadius: "9px",
                padding: "10px 16px",
                marginBottom: "14px",
                fontSize: "12.5px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span>🗺️</span>
                <span>
                  <strong>Live Corridor Radar:</strong> 14 vehicles currently flagged with safe-stops, overbooked Baltic ferries, or missing lot paperwork across Central Europe.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("map")}
                style={{
                  background: "var(--ink)",
                  color: "#ffffff",
                  border: "none",
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                View on Radar Map →
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", fontSize: "12px", color: "var(--subtle)" }}>
              <span>Sorted by Time-to-Point-of-No-Return · Top items have imminent financial or schedule deadlines</span>
              <span className="mono">Tip: Use J / K to navigate · Enter to open</span>
            </div>

            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>Scanning 100 orders & telemetry...</div>
            ) : filteredNeeds.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", background: "var(--tray)", borderRadius: "12px", border: "1px dashed var(--hair)" }}>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--brown)" }}>All caught up! Zero unresolved exceptions.</div>
                <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>Background agents are monitoring all active transits.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredNeeds.map((item, idx) => {
                  const badge = urgencyBadge(item.urgency, item.decideBy)
                  const agentBadge = agentStateBadge(item.agentState)
                  const isSelected = idx === selectedIndex

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedIndex(idx)}
                      style={{
                        background: "var(--birch)",
                        borderRadius: "10px",
                        border: isSelected ? "2px solid var(--ink)" : "1px solid var(--hair)",
                        padding: "16px 20px",
                        boxShadow: isSelected ? "var(--shadow-card-hover)" : "var(--shadow-card)",
                        display: "grid",
                        gridTemplateColumns: "190px minmax(0, 1fr) 220px",
                        gap: "20px",
                        alignItems: "center",
                        transition: "all 0.15s ease",
                        cursor: "pointer",
                      }}
                    >
                      {/* Left Block: Reference, Car, Route */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                          <span className="mono" style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                            {item.orderReference}
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--brown)" }}>{item.car}</div>
                        <div style={{ fontSize: "12px", color: "var(--subtle)", marginTop: "2px" }}>{item.route}</div>
                      </div>

                      {/* Middle Block: The Plain-Language Headline & Why */}
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "4px", lineHeight: 1.35 }}>
                          {item.headline}
                        </div>
                        <div style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.4 }}>{item.why}</div>
                      </div>

                      {/* Right Block: Urgency & Action Button */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: agentBadge.dot,
                            }}
                          />
                          <span style={{ fontSize: "11.5px", fontWeight: 500, color: agentBadge.color }}>
                            {agentBadge.label}
                          </span>
                        </div>

                        <span
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            padding: "3px 9px",
                            borderRadius: "6px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {badge.label}
                        </span>

                        <Link
                          href={`/orders/${item.orderId}`}
                          style={{
                            background: isSelected ? "var(--ink)" : "var(--canvas)",
                            color: isSelected ? "var(--birch)" : "var(--ink)",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            fontSize: "12.5px",
                            fontWeight: 600,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            border: "1px solid var(--hair)",
                          }}
                        >
                          Review Decision
                          <Icon name="arrow" size={11} style={{ transform: "rotate(-90deg)" }} />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Live Fleet & Transporter Map */}
        {activeTab === "map" && (
          <div style={{ marginBottom: "30px" }}>
            <FleetMap />
          </div>
        )}

        {/* Tab 2: Running Quietly Proof */}
        {activeTab === "quiet" && (
          <div>
            <div
              style={{
                background: "var(--tray)",
                border: "1px solid var(--hair)",
                borderRadius: "10px",
                padding: "16px 20px",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--teal-ink)", marginBottom: "4px" }}>
                Autonomous Background Supervision Active (86 Orders)
              </div>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
                Every 5 minutes, background agents cross-check GPS telematics, Baltic ferry bookings, site opening hours, and driver rest intervals. If all conditions match the transport plan, no human intervention is triggered.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
              {data?.quiet.sample.map((q) => (
                <div
                  key={q.orderId}
                  style={{
                    background: "var(--birch)",
                    border: "1px solid var(--hair)",
                    borderRadius: "8px",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span className="mono" style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                      {q.orderReference}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--teal-ink)", fontWeight: 500 }}>● Quiet</span>
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--brown)" }}>{q.car}</div>
                  <div style={{ fontSize: "12px", color: "var(--subtle)", marginTop: "4px" }}>{q.stage}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "24px", textAlign: "center" }}>
              <Link
                href="/board"
                style={{
                  color: "var(--brown)",
                  fontSize: "13px",
                  fontWeight: 500,
                  textDecoration: "underline",
                }}
              >
                Open Scale View: Inspect all 100 orders across 7 stages →
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppFrame>
  )
}
