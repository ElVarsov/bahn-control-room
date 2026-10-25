import type { AgentRun, TraceStep } from "@/lib/contracts"
import { fmtClock, fmtLong } from "@/lib/present/time"
import { Icon } from "../icons"

const TOOL_WORDS: Record<string, string> = {
  read_order: "Read the order",
  read_tracking: "Checked the tracking",
  read_messages: "Read the conversation",
  check_booking_outcome: "Checked the booking with the ferry line",
  search_ferries: "Searched sailings",
  search_hotels: "Searched hotels",
  search_trains: "Searched trains",
  search_drivers: "Looked for nearby drivers",
  read_open_issues: "Checked alerts, incidents and open work",
  read_travel: "Checked booked travel and quotes",
  book_travel: "Booked, after your approval",
  change_date: "Changed the date, after your approval",
  approve_cost: "Recorded the approved cost",
  resolve_alert: "Resolved the alert, after your approval",
}

function toolWords(tool: string): string {
  return TOOL_WORDS[tool] ?? tool.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

const STOP_TITLE: Record<string, string> = {
  needs_person: "Handed to you",
  waiting_reply: "Waiting for a reply",
  facts_line_up: "Nothing needs a person",
  error: "Stopped with a problem",
}

type Line = { at: string; icon: string; title: string; detail?: string; kind: "check" | "contact" | "thought" | "stop" | "proposal" }

// Turn a raw trace into a short story: what the agent checked (free), who it contacted, and why it stopped.
function toLines(steps: TraceStep[]): Line[] {
  const lines: Line[] = []
  for (const step of steps) {
    switch (step.kind) {
      case "tool_result":
        lines.push({ at: step.at, icon: "check", title: toolWords(step.tool), detail: step.summary, kind: "check" })
        break
      case "call":
        lines.push({ at: step.at, icon: "phone", title: step.status === "completed" ? "Phoned the driver" : `Tried to phone the driver (${step.status.replace("_", " ")})`, detail: step.summary, kind: "contact" })
        break
      case "message_out":
        lines.push({ at: step.at, icon: "message", title: `Wrote to ${step.toName}`, detail: step.body, kind: "contact" })
        break
      case "message_in":
        lines.push({ at: step.at, icon: "message", title: `${step.fromName} replied${step.simulated ? " (simulated)" : ""}`, detail: step.body, kind: "contact" })
        break
      case "tool_call":
        // What the agent wrote down for you: the facts in "What we know" appear here as it noted them.
        if (step.tool === "note_fact" && step.input && typeof step.input === "object" && "text" in step.input) {
          lines.push({ at: step.at, icon: "file", title: "Noted", detail: String((step.input as { text: unknown }).text), kind: "check" })
        }
        break
      case "thought":
        lines.push({ at: step.at, icon: "note", title: "Agent's note", detail: step.text, kind: "thought" })
        break
      case "stop":
        lines.push({ at: step.at, icon: step.reason === "needs_person" ? "flag" : "check", title: STOP_TITLE[step.reason] ?? "Stopped", kind: "stop" })
        break
      default:
        break
    }
  }
  return lines
}

/** "+0 s", "+42 s", "+1 min 05 s" since the run started: a run takes seconds, so clock times say nothing. */
function elapsed(at: string, start: string): string {
  const s = Math.max(0, Math.round((Date.parse(at) - Date.parse(start)) / 1000))
  return s < 60 ? `+${s} s` : `+${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`
}

function runSummary(run: AgentRun): string {
  const checks = run.steps.filter((s) => s.kind === "tool_result").length
  const calls = run.steps.filter((s) => s.kind === "call").length
  const last = run.steps.at(-1)?.at ?? run.startedAt
  const secs = Math.max(1, Math.round((Date.parse(last) - Date.parse(run.startedAt)) / 1000))
  const took = secs < 60 ? `${secs} s` : `${Math.round(secs / 60)} min`
  return `${checks} ${checks === 1 ? "check" : "checks"}${calls ? `, ${calls} driver ${calls === 1 ? "call" : "calls"}` : ""}, took ${took}`
}

export function AgentWork({ runs, zone }: { runs: AgentRun[]; snapshotAt: string; zone: string }) {
  return (
    <section className="agent-work" aria-labelledby="agent-work-title">
      <h2 id="agent-work-title" className="case-section-title">
        What the agent already did
        <span className="case-section-note">Checks and questions are free. Changes wait for you.</span>
      </h2>
      {runs.map((run) => (
        <div key={run.id} className="agent-run">
          <p className="agent-run-trigger">
            <Icon name="bot" size={14} /> Started at {fmtClock(run.startedAt, zone)} because: {run.trigger.toLowerCase()}
            <span className="agent-run-meta">{runSummary(run)}</span>
          </p>
          <ol className="agent-steps">
            {toLines(run.steps).map((line, index) => (
              <li key={index} className={`agent-step kind-${line.kind}`}>
                <span className="agent-step-icon"><Icon name={line.icon} size={13} /></span>
                <div>
                  <p className="agent-step-title">{line.title}<time dateTime={line.at} title={fmtLong(line.at)}>{elapsed(line.at, run.startedAt)}</time></p>
                  {line.detail && <p className="agent-step-detail">{line.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  )
}
