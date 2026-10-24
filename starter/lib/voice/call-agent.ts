// The in-call agent: one short Claude request per turn of the phone call. It
// knows only the call's purpose, its questions and a few facts it may share.
// Everything the driver says becomes a "reported" fact, never a verified one.

import Anthropic from "@anthropic-ai/sdk"
import type { Fact } from "@/lib/contracts"
import type { LiveCall } from "./store"

const client = new Anthropic()
const MODEL = process.env.VOICE_MODEL ?? "claude-opus-5-5"

const SYSTEM = `You are the Bahn operations assistant, an AI agent, speaking on a phone call with one of Bahn's freelance car delivery drivers.
Latency-sensitive; begin your visible answer immediately.

How you talk:
- This is speech, not text. One or two short sentences per turn. No lists, no markdown, no emojis.
- Say you are Bahn's AI assistant in your first sentence.
- Ask one question at a time. Safety first: if anything suggests danger, check the driver is safe before anything else.
- If an answer is vague, ask once more, then move on.
- Never promise anything that changes a booking, a date, a cost or what the customer is told. Say a person at Bahn will decide and get back to them.
- When you have answers to the questions (or the driver cannot answer), thank them, say what happens next in one sentence, and end the call.

Output JSON only:
- say: what you speak next.
- end_call: true only on your final goodbye turn.
- summary: one plain sentence for the operations team about what you learned so far.
- facts: short statements the driver made that answer the questions, in third person ("Driver says the car is stopped at the A7 service area near Soltau."). Only things the driver actually said.`

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    say: { type: "string" },
    end_call: { type: "boolean" },
    summary: { type: "string" },
    facts: { type: "array", items: { type: "string" } },
  },
  required: ["say", "end_call", "summary", "facts"],
  additionalProperties: false,
}

type AgentTurn = { say: string; end_call: boolean; summary: string; facts: string[] }

export async function nextAgentTurn(call: LiveCall): Promise<AgentTurn> {
  const { request } = call
  const brief = [
    `Driver: ${request.driverName}`,
    `Why you are calling: ${request.purpose}`,
    `Find out:\n${request.questions.map((q) => `- ${q}`).join("\n")}`,
    request.context ? `Facts you may use:\n${request.context}` : "",
  ].filter(Boolean).join("\n\n")

  const transcript = call.transcript.length
    ? call.transcript.map((turn) => `${turn.speaker === "agent" ? "You" : "Driver"}: ${turn.text}`).join("\n")
    : "(The driver has just picked up. Open the call.)"

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `${brief}\n\nCall so far:\n${transcript}` }],
  })

  if (response.stop_reason === "refusal") {
    return { say: "Sorry, I have to hand this over to a colleague. Someone from Bahn will call you back.", end_call: true, summary: "The assistant could not continue the call.", facts: [] }
  }
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("")
  return JSON.parse(text) as AgentTurn
}

export function factsFromCall(call: LiveCall, statements: string[]): Fact[] {
  const at = new Date().toISOString()
  return statements.map((text, index) => ({
    id: `${call.id}-f${index + 1}`,
    text,
    strength: "reported",
    sources: [{ kind: "driver", label: "Phone call", actorName: call.request.driverName, at, table: "voice_calls", recordId: call.id }],
  }))
}
