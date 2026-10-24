"use client"

import React from "react"
import { Icon } from "../icons"

export interface KpiRibbonProps {
  decisionsCount: number
  inTransitCount?: number
  quietCount?: number
  warningsCount?: number
  vesselsCount?: number
}

export function KpiRibbon({
  decisionsCount,
  inTransitCount = 24,
  quietCount = 86,
  warningsCount = 5,
  vesselsCount = 3,
}: KpiRibbonProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: "12px",
        marginBottom: "24px",
      }}
    >
      {/* Metric 1: Needs Operator Yes */}
      <div
        className="kpi-stat-card"
        style={{
          background: "var(--birch)",
          border: "1px solid var(--hair)",
          borderRadius: "12px",
          padding: "14px 16px",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "3.5px", background: "var(--red)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--red-ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Needs Operator Yes
          </span>
          <span style={{ display: "inline-flex", width: "7px", height: "7px", borderRadius: "50%", background: "var(--red)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            {decisionsCount}
          </span>
          <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>
            actions pending
          </span>
        </div>
        <div style={{ fontSize: "11.5px", color: "var(--subtle)" }}>
          Ferry cutoffs, holds & roadside repairs
        </div>
      </div>

      {/* Metric 2: Live In-Transit Fleet */}
      <div
        className="kpi-stat-card"
        style={{
          background: "var(--birch)",
          border: "1px solid var(--hair)",
          borderRadius: "12px",
          padding: "14px 16px",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "3.5px", background: "var(--teal)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal-ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Fleet In Transit
          </span>
          <span className="agent-pulse state-working" style={{ width: "7px", height: "7px" }} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            {inTransitCount}
          </span>
          <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>
            cars on the road
          </span>
        </div>
        <div style={{ fontSize: "11.5px", color: "var(--subtle)" }}>
          Active drivers across DE, DK, SE & FI
        </div>
      </div>

      {/* Metric 3: Early Warnings & Cutoffs */}
      <div
        className="kpi-stat-card"
        style={{
          background: "var(--birch)",
          border: "1px solid var(--hair)",
          borderRadius: "12px",
          padding: "14px 16px",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "3.5px", background: "var(--orange)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--orange-ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Early Forecaster
          </span>
          <span style={{ fontSize: "12px" }}>⚡</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            {warningsCount}
          </span>
          <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>
            at-risk corridors
          </span>
        </div>
        <div style={{ fontSize: "11.5px", color: "var(--subtle)" }}>
          Ferry cutoffs & GPS gaps &gt; 3 hours
        </div>
      </div>

      {/* Metric 4: Autonomous Background Monitoring */}
      <div
        className="kpi-stat-card"
        style={{
          background: "var(--birch)",
          border: "1px solid var(--hair)",
          borderRadius: "12px",
          padding: "14px 16px",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "3.5px", background: "var(--green)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--green-ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Corridor Agent
          </span>
          <span style={{ fontSize: "11px", fontWeight: 700, background: "var(--green-bg)", color: "var(--green-ink)", padding: "1px 6px", borderRadius: "10px" }}>
            Active
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--green-ink)", fontFamily: "var(--font-display)" }}>
            {quietCount}
          </span>
          <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>
            orders quietly moving
          </span>
        </div>
        <div style={{ fontSize: "11.5px", color: "var(--subtle)" }}>
          Routine tracking on time without noise
        </div>
      </div>
    </div>
  )
}
