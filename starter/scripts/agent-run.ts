// Runs the road agent on one order through the running app and prints its trace.
//   npm run agent -- CD-420299               (driver phone if online, otherwise simulated)
//   npm run agent -- CD-420322 --phone       (always ring the driver's phone)
//   npm run agent -- CD-420322 --simulated   (never ring)
// The trace is also saved to traces/<runId>.json by the app.

import "dotenv/config"

const appUrl = process.env.APP_URL ?? "http://localhost:3000"
const args = process.argv.slice(2)
const order = args.find((a) => !a.startsWith("--")) ?? "CD-420299"
const driverMode = args.includes("--phone") ? "phone" : args.includes("--simulated") ? "simulated" : "auto"
const trigger = args.find((a) => a.startsWith("--trigger="))?.slice(10) ?? "Command line test run"

type Step = { kind: string; tool?: string; summary?: string; text?: string; body?: string; toName?: string; status?: string; proposalId?: string; reason?: string; cost?: string }
type Record = {
  run: { id: string; state: string; steps: Step[] }
  proposals: { id: string; action: string; title: string; changes: { label: string; before: string; after: string }[]; draftMessage?: { to: string; body: string } }[]
  facts: { text: string; strength: string; sources: { label: string }[] }[]
  headline?: string; summary?: string; agentDid?: string; urgency?: string; outcome?: string
  usage: { inputTokens: number; outputTokens: number }; model: string
}

async function main() {
  const started = await fetch(`${appUrl}/api/agent/runs`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order, trigger, driverMode }),
  })
  if (!started.ok) throw new Error(`Could not start: ${started.status} ${await started.text()}`)
  let record = (await started.json()) as Record
  console.log(`Run ${record.run.id} on ${order} (driver: ${driverMode})\n`)
  let printed = 0
  for (;;) {
    record = (await (await fetch(`${appUrl}/api/agent/runs/${record.run.id}`)).json()) as Record
    for (const step of record.run.steps.slice(printed)) {
      if (step.kind === "tool_result") console.log(`  ✓ ${step.tool}: ${step.summary}`)
      else if (step.kind === "call") console.log(`  ☎ ${step.summary}`)
      else if (step.kind === "thought") console.log(`  … ${step.text}`)
      else if (step.kind === "proposal") console.log(`  ★ proposal ${step.proposalId}`)
      else if (step.kind === "message_out") console.log(`  ✉ to ${step.toName}: ${step.body}`)
      else if (step.kind === "stop") console.log(`  ■ stop (${step.reason}): ${step.summary}`)
    }
    printed = record.run.steps.length
    if (record.run.state !== "working") break
    await new Promise((r) => setTimeout(r, 1500))
  }
  console.log(`\nOutcome: ${record.outcome} · urgency ${record.urgency}\nHeadline: ${record.headline}\nAgent did: ${record.agentDid}`)
  for (const p of record.proposals) {
    console.log(`\nProposal [${p.action}] ${p.title}`)
    for (const c of p.changes) console.log(`  ${c.label}: ${c.before} → ${c.after}`)
    if (p.draftMessage) console.log(`  Draft to ${p.draftMessage.to}: ${p.draftMessage.body}`)
  }
  console.log(`\nFacts:`)
  for (const f of record.facts) console.log(`  [${f.strength}] ${f.text} (${f.sources.map((s) => s.label).join(", ")})`)
  console.log(`\nModel ${record.model} · ${record.usage.inputTokens} in / ${record.usage.outputTokens} out tokens`)
}

main().catch((error) => { console.error(error); process.exit(1) })
