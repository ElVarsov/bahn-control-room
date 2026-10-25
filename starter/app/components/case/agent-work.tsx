import type { AgentRun, TraceStep } from "@/lib/contracts"
import { withoutIds } from "@/lib/present/ids"
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

type Line = { afterYes?: boolean; at: string; icon: string; title: string; detail?: string; notes?: string[]; kind: "check" | "contact" | "thought" | "stop" | "proposal" }

// Turn a raw trace into a short story: what the agent checked (free), who it contacted, and why it stopped.
function toLines(steps: TraceStep[]): Line[] {
  const lines: Line[] = []
  let stopped = false
  for (const step of steps) {
    // Anything after the agent handed over happened later, once a person decided.
    // The decision card above lists that work line by line, so here it is one line.
    if (stopped && step.kind !== "stop") {
      const done = lines.find((l) => l.afterYes)
      const count = step.kind === "tool_result" || step.kind === "message_out" ? 1 : 0
      if (done) done.notes!.push(...Array(count).fill(""))
      else if (count) lines.push({ at: step.at, icon: "check", title: "Carried out after a person decided", detail: "Each step, with its reference, is in the decision card above.", notes: [""], afterYes: true, kind: "check" })
      continue
    }
    if (step.kind === "stop") stopped = true
    pushStep(step)
  }
  return lines

  function pushStep(step: TraceStep) {
    switch (step.kind) {
      case "tool_result":
        lines.push({ at: step.at, icon: "check", title: toolWords(step.tool), detail: step.summary && withoutIds(step.summary), kind: "check" })
        break
      case "call":
        // A simulated driver is a stand-in for the demo; never let it read as a real call.
        lines.push({ at: step.at, icon: "phone", title: /^simulated/i.test(step.summary ?? "") ? "Simulated driver call (demo stand-in, not a real person)" : step.status === "completed" ? "Phoned the driver" : `Tried to phone the driver (${step.status.replace("_", " ")})`, detail: step.summary, kind: "contact" })
        break
      case "message_out":
        lines.push({ at: step.at, icon: "message", title: `Wrote to ${step.toName}`, detail: step.body, kind: "contact" })
        break
      case "message_in":
        lines.push({ at: step.at, icon: "message", title: `${step.fromName} replied${step.simulated ? " (simulated)" : ""}`, detail: step.body, kind: "contact" })
        break
      case "tool_call":
        // Noted facts already sit in "What we know": fold them into one line, open on tap.
        if (step.tool === "note_fact" && step.input && typeof step.input === "object" && "text" in step.input) {
          const text = String((step.input as { text: unknown }).text)
          const folded = lines.find((l) => l.notes)
          if (folded) { folded.notes!.push(text); folded.at = step.at }
          else lines.push({ at: step.at, icon: "file", title: "Noted", notes: [text], kind: "check" })
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
}

/** "+0 s", "+42 s", "+1 min 05 s" since the run started: a run takes seconds, so clock times say nothing. */
function elapsed(at: string, start: string): string {
  const s = Math.max(0, Math.round((Date.parse(at) - Date.parse(start)) / 1000))
  return s < 60 ? `+${s} s` : `+${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`
}

function runSummary(run: AgentRun): string {
  // Only the agent's own pass counts; what it did after a decision is listed in the card.
  const stop = run.steps.findIndex((s) => s.kind === "stop")
  const own = stop >= 0 ? run.steps.slice(0, stop) : run.steps
  const checks = own.filter((s) => s.kind === "tool_result").length
  const calls = own.filter((s) => s.kind === "call").length
  const last = run.steps.find((s) => s.kind === "stop")?.at ?? run.steps.at(-1)?.at ?? run.startedAt
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
            <Icon name="bot" size={14} /> Started at {fmtClock(run.startedAt, zone)} because: {/^(seed|command line)/i.test(run.trigger) ? "operations asked the agent to work this case" : run.trigger.replace(/^\w/, (c) => c.toLowerCase())}
            <span className="agent-run-meta">{runSummary(run)}</span>
          </p>
          <ol className="agent-steps">
            {toLines(run.steps).map((line, index) => (
              <li key={index} className={`agent-step kind-${line.kind}`}>
                <span className="agent-step-icon"><Icon name={line.icon} size={13} /></span>
                <div>
                  <p className="agent-step-title">{line.notes && !line.afterYes ? `Noted ${line.notes.length} ${line.notes.length === 1 ? "fact" : "facts"}` : line.title}<time dateTime={line.at} title={fmtLong(line.at)}>{line.afterYes ? "later" : elapsed(line.at, run.startedAt)}</time></p>
                  {line.detail && <p className="agent-step-detail">{line.detail}</p>}
                  {line.notes && !line.afterYes && (
                    <details className="agent-step-notes">
                      <summary>They are listed under What we know, with their sources. Show them here</summary>
                      <ul>{line.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  )
}
