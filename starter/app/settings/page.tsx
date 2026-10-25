"use client"

import { useEffect, useState } from "react"
import { ALWAYS_ASK, type ActionKind, type Autonomy } from "@/lib/contracts"
import { AppFrame } from "../components/app-frame"
import { Icon } from "../components/icons"

// How much the agent may do on its own, per kind of action. Bookings, dates, costs,
// customer messages and handovers always wait for a person: the challenge rules say so.

const ACTIONS: { kind: ActionKind; title: string; detail: string }[] = [
  { kind: "ask_driver", title: "Phone the driver", detail: "Call the driver to ask where they are, whether they are safe, and what they need. Set to “Ask me first” and the agent hands you the questions instead." },
  { kind: "resolve_alert", title: "Close an alert", detail: "Mark a warning as handled once the facts behind it are cleared." },
  { kind: "book_travel", title: "Book travel", detail: "Ferries, trains, flights and hotels for the driver." },
  { kind: "change_date", title: "Change a pickup or delivery time", detail: "Move a slot or the promise to the customer." },
  { kind: "approve_cost", title: "Approve a cost", detail: "Extra travel, waiting time or other expenses." },
  { kind: "message_customer", title: "Message a customer", detail: "Anything the dealer or buyer would read." },
  { kind: "handover_to_person", title: "Hand a case to a person", detail: "Calls only a person can make, like asking a dealer to decide." },
]

const LEVELS: { value: Autonomy; label: string }[] = [
  { value: "ask_first", label: "Ask me first" },
  { value: "do_and_tell", label: "Do it and tell me" },
  { value: "do_quietly", label: "Do it quietly" },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<ActionKind, Autonomy> | null>(null)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/settings/autonomy")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(setSettings)
      .catch(() => setError("Could not load the settings. Reload the page to try again."))
  }, [])

  const update = async (kind: ActionKind, value: Autonomy) => {
    if (!settings || ALWAYS_ASK.includes(kind)) return
    const next = { ...settings, [kind]: value }
    setSettings(next)
    const response = await fetch("/api/settings/autonomy", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ [kind]: value }) })
    setSaved(response.ok)
    if (response.ok) setTimeout(() => setSaved(false), 2000)
    else setError("That change was not saved.")
  }

  const free = ACTIONS.filter((a) => !ALWAYS_ASK.includes(a.kind))
  const locked = ACTIONS.filter((a) => ALWAYS_ASK.includes(a.kind))

  return (
    <AppFrame section="settings">
      <main className="page settings-page">
        <header className="queue-head">
          <div>
            <h1 className="queue-title">Autonomy dial</h1>
            <p className="queue-sub">What the agent may do without asking. Reading the order and looking up travel are always free. Start strict and give it more room as it earns trust.</p>
          </div>
          <p className="settings-saved" aria-live="polite">{saved ? "Saved" : ""}</p>
        </header>

        {error && <p className="board-error" role="alert">{error}</p>}
        {!settings && !error && <p className="settings-loading">Loading settings…</p>}

        {settings && (
          <>
            <section className="settings-group" aria-labelledby="free-title">
              <h2 id="free-title" className="queue-group-title">You choose</h2>
              <ul className="settings-rows">
                {free.map((action) => (
                  <li key={action.kind} className="settings-row">
                    <div>
                      <p className="settings-title">{action.title}</p>
                      <p className="settings-detail">{action.detail}</p>
                    </div>
                    <div className="segmented" role="radiogroup" aria-label={action.title}>
                      {LEVELS.map((level) => (
                        <button
                          key={level.value}
                          type="button"
                          role="radio"
                          aria-checked={settings[action.kind] === level.value}
                          className={settings[action.kind] === level.value ? "is-on" : ""}
                          onClick={() => void update(action.kind, level.value)}
                        >{level.label}</button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="settings-group" aria-labelledby="locked-title">
              <h2 id="locked-title" className="queue-group-title">
                Always asks you first<span className="queue-group-note">A person says yes before bookings, dates, costs or anything a customer hears.</span>
              </h2>
              <ul className="settings-rows">
                {locked.map((action) => (
                  <li key={action.kind} className="settings-row is-locked">
                    <div>
                      <p className="settings-title">{action.title}</p>
                      <p className="settings-detail">{action.detail}</p>
                    </div>
                    <p className="settings-fixed"><Icon name="check" size={13} /> Asks you first</p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </AppFrame>
  )
}
