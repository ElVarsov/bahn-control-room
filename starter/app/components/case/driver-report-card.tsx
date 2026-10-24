"use client"

import { useState } from "react"
import type { QueueItem } from "@/lib/contracts"
import { Icon } from "../icons"

// A driver called in. The person answers through the agent (it phones or writes to the
// driver) or takes the call back themselves. Either way the driver hears from Bahn.
export function DriverReportCard({ item }: { item: QueueItem }) {
  const [mode, setMode] = useState<"idle" | "reply" | "done">("idle")
  const [reply, setReply] = useState("")
  const [outcome, setOutcome] = useState("")

  if (mode === "done") {
    return (
      <section className="decision decided tone-ok" aria-live="polite">
        <p className="decision-eyebrow"><Icon name="check" size={13} /> Handled by You, just now</p>
        <h2 className="decision-title">{item.headline}</h2>
        <p className="next-step"><b>What happens next.</b> {outcome}</p>
        <div className="decision-actions"><button type="button" className="btn btn-ghost" onClick={() => setMode("idle")}>Undo</button></div>
      </section>
    )
  }

  return (
    <section className="decision is-report" aria-labelledby="report-title">
      <p className="decision-eyebrow"><Icon name="phone" size={13} /> The driver called in</p>
      <h2 id="report-title" className="decision-title">{item.headline}</h2>
      <p className="decision-rationale">{item.why}</p>
      {item.agentDid && <p className="report-agent"><Icon name="bot" size={14} /> {item.agentDid} What they said is under “What we know”, marked as reported.</p>}

      {mode === "reply" ? (
        <form className="instruct" onSubmit={(event) => {
          event.preventDefault()
          if (!reply.trim()) return
          setOutcome(`The agent passes your answer to the driver in the app and calls them if they do not read it within 5 minutes: “${reply.trim()}”`)
          setMode("done")
        }}>
          <label htmlFor="report-reply">What should the driver do? The agent tells them.</label>
          <textarea id="report-reply" rows={3} value={reply} onChange={(event) => setReply(event.target.value)} autoFocus placeholder="For example: wait the two hours, the ferry is tomorrow anyway. Send a photo when the car is ready." />
          <div className="decision-actions">
            <button type="submit" className="btn btn-primary" disabled={!reply.trim()}>Send through the agent</button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="decision-actions">
          <button type="button" className="btn btn-primary" onClick={() => setMode("reply")}><Icon name="message" size={14} /> Answer the driver</button>
          <button type="button" className="btn btn-secondary" onClick={() => { setOutcome("You call the driver back. The agent adds a note to the order and checks in with the driver in 30 minutes if nothing else is recorded."); setMode("done") }}>
            <Icon name="phone" size={14} /> I'll call them back
          </button>
        </div>
      )}
    </section>
  )
}
