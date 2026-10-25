"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Icon } from "../icons"

// Start the road agent on this order, and keep the page fresh while it works so its
// steps, the driver call and its proposal appear as they happen.
export function AgentControl({ orderId, running, hasRun, primary = false, quiet = false }: { orderId: string; running: boolean; hasRun: boolean; primary?: boolean; quiet?: boolean }) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => router.refresh(), 2000)
    return () => clearInterval(timer)
  }, [running, router])

  useEffect(() => { if (running) setStarting(false) }, [running])

  const start = async () => {
    setStarting(true)
    setError("")
    const response = await fetch("/api/agent/runs", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ order: orderId, trigger: hasRun ? "A person asked the agent to look again" : "A person asked the agent to look at this order", driverMode: "auto" }),
    })
    if (!response.ok) { setStarting(false); setError("The agent could not start. Check the server log."); return }
    router.refresh()
  }

  if (running || starting) {
    return (
      <p className="agent-bar is-running" aria-live="polite">
        <span className="agent-pulse state-working" aria-hidden="true" />
        The agent is working on this order. Its steps appear below as it goes; it rings the driver's phone if the driver app is open.
      </p>
    )
  }
  // A closed case: going back to work is the next step, so starting the agent again is a quiet link.
  if (quiet) {
    return (
      <p className="agent-bar is-quiet">
        <button type="button" className="btn-link-quiet" onClick={start}>Ask the agent to look at this order again</button>
        {error && <span className="agent-bar-error">{error}</span>}
      </p>
    )
  }
  return (
    <div className="agent-bar">
      <button type="button" className={`btn ${primary ? "btn-primary" : "btn-secondary"}`} onClick={start}>
        <Icon name="bot" size={14} /> {hasRun ? "Ask the agent to look again" : "Ask the agent to work on this"}
      </button>
      <span className="agent-bar-note">It reads first, may phone the driver, and brings you a proposal. Nothing changes without your yes.</span>
      {error && <span className="agent-bar-error">{error}</span>}
    </div>
  )
}
