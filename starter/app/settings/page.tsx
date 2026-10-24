"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AppFrame } from "../components/app-frame"
import { Icon } from "../components/icons"
import type { ActionKind, Autonomy } from "@/lib/contracts"

const ACTION_DESCRIPTIONS: Record<ActionKind, { title: string; desc: string; locked?: boolean; ruleReason?: string }> = {
  message_customer: {
    title: "Message Paying Customer / Dealer",
    desc: "Drafts and sends emails, SMS or notifications to the car dealer or buyer.",
    locked: true,
    ruleReason: "Rule of the Game: The agent never contacts a customer on its own. Permanently locked to 'Ask me first'.",
  },
  book_travel: {
    title: "Book Ferry, Train, Flight or Hotel",
    desc: "Executes purchased transport bookings with Vela Coast Lines, Scandlines, Deutsche Bahn, or hotels.",
  },
  change_date: {
    title: "Change Delivery Promise or Pickup Slot",
    desc: "Adjusts promised handover windows in marketplace systems and notifies field network.",
  },
  approve_cost: {
    title: "Approve Extra Travel & Waiting Costs",
    desc: "Authorizes unforeseen expense reimbursements, bridge tolls, or emergency driver vouchers.",
  },
  ask_driver: {
    title: "Interview Driver via In-App Chat / Phone",
    desc: "Queries assigned driver on driving hours, safe stops, GPS location, and condition photos.",
  },
  ask_site: {
    title: "Verify Site Access & Gate Releases",
    desc: "Contacts seller or delivery compound receptionists to verify paperwork and release codes.",
  },
  refresh_quote: {
    title: "Query Provider Timetables & Quotes",
    desc: "Refreshes live sailing capacity, hotel room availability, and alternative routing options.",
  },
  resolve_alert: {
    title: "Resolve Tracking & Telematics Warnings",
    desc: "Clears alerts once fresh GPS coordinates or driver messages confirm compliance.",
  },
  handover_to_person: {
    title: "Human Escalation & Phone Briefings",
    desc: "Prepares one-click briefing cards for complex cases needing human judgment.",
  },
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<ActionKind, Autonomy> | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    fetch("/api/settings/autonomy")
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch((err) => console.error("Failed to load settings:", err))
  }, [])

  const updateSetting = async (action: ActionKind, value: Autonomy) => {
    if (!settings || ACTION_DESCRIPTIONS[action]?.locked) return
    const updated = { ...settings, [action]: value }
    setSettings(updated)
    setSaving(true)
    try {
      await fetch("/api/settings/autonomy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      })
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppFrame section="settings">
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "32px 28px 60px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "24px", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Agent Autonomy Dial
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.45 }}>
            Configure the boundary between autonomous agent execution and human sign-off. As agents earn operational trust, routine actions can be delegated to run quietly.
          </p>
        </div>

        {/* Banner on Safety Guardrails */}
        <div
          style={{
            background: "var(--tray)",
            border: "1px solid var(--hair)",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>🔒</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--ink)" }}>
                Strict Customer Communication Guardrail
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "2px" }}>
                Under hackathon judging rules, the agent <b>never</b> contacts a paying car dealer directly. All customer communications are locked to require human approval.
              </div>
            </div>
          </div>
          {savedSuccess && (
            <span style={{ color: "var(--green-ink)", fontWeight: 600, fontSize: "12.5px" }}>
              ✓ Saved successfully
            </span>
          )}
        </div>

        {/* Action Controls List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {settings &&
            (Object.keys(ACTION_DESCRIPTIONS) as ActionKind[]).map((action) => {
              const meta = ACTION_DESCRIPTIONS[action]
              const currentVal = settings[action] || "ask_first"

              return (
                <div
                  key={action}
                  style={{
                    background: "var(--birch)",
                    border: "1px solid var(--hair)",
                    borderRadius: "10px",
                    padding: "16px 20px",
                    boxShadow: "var(--shadow-card)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "24px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--ink)" }}>{meta.title}</span>
                      {meta.locked && (
                        <span
                          style={{
                            background: "var(--orange-bg)",
                            color: "var(--orange-ink)",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          🔒 Permanent Guardrail
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: 0 }}>
                      {meta.locked ? meta.ruleReason : meta.desc}
                    </p>
                  </div>

                  {/* Radio Group */}
                  <div
                    style={{
                      display: "inline-flex",
                      background: "var(--canvas)",
                      padding: "3px",
                      borderRadius: "8px",
                      border: "1px solid var(--hair)",
                      opacity: meta.locked ? 0.6 : 1,
                    }}
                  >
                    {(["ask_first", "do_and_tell", "do_quietly"] as Autonomy[]).map((level) => {
                      const labels = {
                        ask_first: "Ask me first",
                        do_and_tell: "Do it & tell me",
                        do_quietly: "Do it quietly",
                      }
                      const active = currentVal === level

                      return (
                        <button
                          key={level}
                          disabled={meta.locked}
                          onClick={() => updateSetting(action, level)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            border: "none",
                            background: active ? "var(--birch)" : "transparent",
                            color: active ? "var(--ink)" : "var(--muted)",
                            boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                            cursor: meta.locked ? "not-allowed" : "pointer",
                          }}
                        >
                          {labels[level]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </AppFrame>
  )
}
