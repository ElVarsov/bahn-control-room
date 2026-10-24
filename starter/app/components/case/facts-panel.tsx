"use client"

import type { Fact } from "@/lib/contracts"
import { fmtDateTime, fmtLong } from "@/lib/present/time"
import { SOURCE_KIND, STRENGTH } from "../queue/labels"
import { Icon } from "../icons"

export function FactsPanel({ facts, zone }: { facts: Fact[]; zone: string }) {
  const verifiedCount = facts.filter((f) => f.strength === "verified").length
  const estimateCount = facts.filter((f) => f.strength === "estimate").length

  return (
    <section
      className="facts-panel"
      aria-labelledby="facts-title"
      style={{
        background: "#ffffff",
        border: "1px solid var(--hair)",
        borderRadius: "14px",
        padding: "18px 20px",
        boxShadow: "0 2px 10px -2px rgba(18, 17, 14, 0.04), 0 0 0 1px rgba(18, 17, 14, 0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "6px" }}>
        <h2 id="facts-title" className="case-section-title" style={{ margin: 0, fontSize: "16px", fontWeight: 700, letterSpacing: "-0.015em" }}>
          Verified Facts &amp; Evidence
        </h2>
        <div style={{ display: "flex", gap: "6px" }}>
          {verifiedCount > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px", background: "var(--green-bg)", color: "var(--green-ink)" }}>
              {verifiedCount} verified
            </span>
          )}
          {estimateCount > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px", background: "var(--orange-bg)", color: "var(--orange-ink)" }}>
              {estimateCount} estimate
            </span>
          )}
        </div>
      </div>

      <ul className="fact-list" style={{ display: "grid", gap: "14px", padding: 0, margin: 0, listStyle: "none" }}>
        {facts.map((fact) => {
          const strength = STRENGTH[fact.strength]
          const isVerified = fact.strength === "verified"
          const isEstimate = fact.strength === "estimate"

          return (
            <li
              key={fact.id}
              className="fact-item"
              style={{
                background: "var(--birch)",
                border: "1px solid var(--hair-soft)",
                borderRadius: "10px",
                padding: "12px 14px",
                display: "grid",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  className={`strength tone-${strength.tone}`}
                  title={strength.hint}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    background: isVerified ? "var(--green-bg)" : isEstimate ? "var(--orange-bg)" : "var(--hair-soft)",
                    color: isVerified ? "var(--green-ink)" : isEstimate ? "var(--orange-ink)" : "var(--brown)",
                    border: `1px solid ${isVerified ? "rgba(27,122,82,0.2)" : isEstimate ? "rgba(176,70,23,0.2)" : "var(--hair)"}`,
                  }}
                >
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor" }} />
                  {strength.label}
                </span>

                <span style={{ fontSize: "11px", color: "var(--subtle)", fontFamily: "var(--font-mono)" }}>
                  {fact.id}
                </span>
              </div>

              <p className="fact-text" style={{ fontSize: "13.5px", lineHeight: "1.45", color: "var(--ink)", margin: 0, fontWeight: 500 }}>
                {fact.text}
              </p>

              {/* Provenance Evidence Links */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "2px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Sources &amp; Audit Trail:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {fact.sources.map((source, index) => (
                    <span
                      key={index}
                      className="provenance-pill"
                      title={source.recordId ? `${source.table} · ${source.recordId} · ${fmtLong(source.at)}` : fmtLong(source.at)}
                      style={{
                        fontSize: "11.5px",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: "#ffffff",
                        border: "1px solid var(--hair)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        color: "var(--brown)",
                      }}
                    >
                      <Icon name="file" size={12} />
                      <span style={{ fontWeight: 600 }}>{source.label}</span>
                      {source.actorName && <span style={{ color: "var(--muted)" }}>({source.actorName})</span>}
                      <span style={{ color: "var(--subtle)", fontSize: "10.5px" }}>· {fmtDateTime(source.at, zone, false)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="facts-legend" style={{ fontSize: "11.5px", color: "var(--subtle)", marginTop: "14px", margin: "14px 0 0 0" }}>
        Every fact is verified against primary documents, GPS pings, or voice audio recordings.
      </p>
    </section>
  )
}
