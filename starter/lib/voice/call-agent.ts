// The in-call agent: one short Claude request per turn of the phone call. It
// knows only the call's purpose, its questions and a few facts it may share.
// Everything the driver says becomes a "reported" fact, never a verified one.

import Anthropic from "@anthropic-ai/sdk"
import type { Fact } from "@/lib/contracts"
import type { LiveCall } from "./store"

const VIA_OPENROUTER = (process.env.ANTHROPIC_BASE_URL ?? "").includes("openrouter.ai")
const MODEL = process.env.VOICE_MODEL || (VIA_OPENROUTER ? "anthropic/claude-opus-5.5" : "claude-opus-5-5")

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim()
  const baseURL = process.env.ANTHROPIC_BASE_URL?.trim()

  if (!apiKey && !authToken) return null

  try {
    return new Anthropic({
      apiKey: apiKey || "",
      authToken: authToken || undefined,
      baseURL: baseURL || undefined,
    })
  } catch {
    return null
  }
}

const SYSTEM = `You are the Bahn operations assistant, an AI agent, speaking on a phone call with one of Bahn's freelance car delivery drivers. Either you called the driver, or the driver called Bahn and you answered.
Latency-sensitive; begin your visible answer immediately.

How you talk:
- This is speech, not text. One or two short sentences per turn. No lists, no markdown, no emojis.
- Say you are Bahn's AI assistant in your first sentence. If the driver called in, answer like a dispatcher: "Bahn operations, this is the AI assistant. What's happening?"
- If the driver called in, find out what happened, whether they are safe, which car and order it is about (they may have several jobs), where they are, and what they need now.
- Ask one question at a time. Safety first: if anything suggests danger, check the driver is safe before anything else.
- Once the driver says they are safe, do not ask again unless they report a new danger.
- If an answer is vague, ask once more, then move on.
- Compare what the driver says with the facts you were given (route, car). If something does not fit, such as a location far off the planned route, ask once to confirm, then record both what the driver said and that it conflicts. Do not resolve the conflict yourself.
- Keep the whole call short: aim for five or six questions in total.
- Never promise anything that changes a booking, a date, a cost or what the customer is told. Say a person at Bahn will decide and get back to them.
- When you have answers to the questions (or the driver cannot answer), thank them, say what happens next in one sentence, and end the call.

Output JSON only:
- say: what you speak next.
- end_call: true only on your final goodbye turn.
- summary: one plain sentence for the operations team about what you learned so far.
- facts: short statements the driver made that answer the questions, in third person ("Driver says the car is stopped at the A7 service area near Soltau."). Only things the driver actually said.
- order_reference: the order the call is about, such as "CD-420299", if the driver confirmed it or has only one job; otherwise "".
- queue_headline: what a person at Bahn must decide or do because of this call, as one short sentence or question ("Driver missed the ferry. Rebook tonight's sailing?"). "" if nothing is needed.
- urgency: "now" if anyone may be unsafe or a pickup or delivery is about to fail, "today" if it must be handled today, "soon" otherwise.
In summary and facts, refer to the driver as "the driver" or by name, and use "they" if you need a pronoun. Never guess gender from a name.`

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    say: { type: "string" },
    end_call: { type: "boolean" },
    summary: { type: "string" },
    facts: { type: "array", items: { type: "string" } },
    order_reference: { type: "string" },
    queue_headline: { type: "string" },
    urgency: { type: "string", enum: ["now", "today", "soon"] },
  },
  required: ["say", "end_call", "summary", "facts", "order_reference", "queue_headline", "urgency"],
  additionalProperties: false,
}

export type AgentTurn = {
  say: string
  end_call: boolean
  summary: string
  facts: string[]
  order_reference: string
  queue_headline: string
  urgency: "now" | "today" | "soon"
}

/**
 * Intelligent deterministic fallback dispatcher dialogue used when Anthropic / OpenRouter
 * credits are not configured or when the remote model encounters a connection error.
 * Ensures the call never abruptly drops and allows realistic multi-turn voice demos.
 */
function simulateDispatcherTurn(call: LiveCall): AgentTurn {
  const driverTurns = call.transcript.filter((t) => t.speaker === "driver")
  const turnIndex = driverTurns.length
  const lastText = driverTurns[driverTurns.length - 1]?.text ?? ""
  const isEmergency = /crash|accident|smoke|fire|oil|police|hurt|danger|stuck/i.test(lastText)

  const statements = driverTurns.map((t) => t.text).filter(Boolean)
  const facts = statements.map((stmt) => `Driver stated: "${stmt}"`)
  const orderRef = call.orderReference || (lastText.match(/CD-\d{6}/i)?.[0]?.toUpperCase() ?? "")

  if (turnIndex === 0) {
    const greeting =
      call.request.direction === "inbound"
        ? "Bahn operations, this is the AI assistant. What's happening?"
        : `Hello ${call.request.driverName}, this is Bahn operations assistant calling about your delivery. Are you in a safe place right now?`
    return {
      say: greeting,
      end_call: false,
      summary: "Inbound call connected with driver.",
      facts: [],
      order_reference: orderRef,
      queue_headline: "Driver called in",
      urgency: "today",
    }
  }

  if (turnIndex === 1) {
    return {
      say: "Understood. First, are you in a safe place right now, and is anyone hurt or blocking traffic?",
      end_call: false,
      summary: `Driver reported initial status: ${lastText}`,
      facts,
      order_reference: orderRef,
      queue_headline: `Driver reported: ${lastText.slice(0, 50)}`,
      urgency: isEmergency ? "now" : "today",
    }
  }

  if (turnIndex === 2) {
    return {
      say: "Thanks for confirming your safety. Which car or order is this about, and what is your current exact location?",
      end_call: false,
      summary: `Driver confirmed safety and reported: ${lastText}`,
      facts,
      order_reference: orderRef,
      queue_headline: `Driver safety checked: ${lastText.slice(0, 50)}`,
      urgency: isEmergency ? "now" : "today",
    }
  }

  if (turnIndex === 3) {
    return {
      say: "I have recorded the location and car. What do you need from Bahn operations right now?",
      end_call: false,
      summary: `Driver provided location and vehicle context: ${lastText}`,
      facts,
      order_reference: orderRef,
      queue_headline: `Driver needs assistance: ${lastText.slice(0, 50)}`,
      urgency: isEmergency ? "now" : "today",
    }
  }

  return {
    say: "Thank you. I have logged all the details and alerted the duty operations dispatcher. Someone from Bahn will follow up directly. Stay safe.",
    end_call: true,
    summary: `Call completed with driver. Reported: ${statements.join(" · ")}`,
    facts,
    order_reference: orderRef,
    queue_headline: `Driver call finished: ${statements[0]?.slice(0, 50) ?? "Check transit status"}`,
    urgency: isEmergency ? "now" : "today",
  }
}

export async function nextAgentTurn(call: LiveCall): Promise<AgentTurn> {
  const client = getAnthropicClient()

  if (!client) {
    return simulateDispatcherTurn(call)
  }

  try {
    const { request } = call
    const brief = [
      `Driver: ${request.driverName}`,
      request.direction === "inbound" ? `The driver called Bahn. ${request.purpose}` : `Why you are calling: ${request.purpose}`,
      `Find out:\n${request.questions.map((q) => `- ${q}`).join("\n")}`,
      request.context ? `Facts you may use:\n${request.context}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")

    const transcript = call.transcript.length
      ? call.transcript.map((turn) => `${turn.speaker === "agent" ? "You" : "Driver"}: ${turn.text}`).join("\n")
      : request.direction === "inbound"
      ? "(You just answered the driver's call. Greet them.)"
      : "(The driver has just picked up. Open the call.)"

    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      ...(VIA_OPENROUTER ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
      output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `${brief}\n\nCall so far:\n${transcript}` }],
    })

    if (response.stop_reason === "refusal") {
      return {
        say: "Sorry, I have to hand this over to a colleague. Someone from Bahn will call you back.",
        end_call: true,
        summary: "The assistant could not continue the call.",
        facts: [],
        order_reference: "",
        queue_headline: "Call the driver back: the assistant could not continue the call.",
        urgency: "now",
      }
    }

    const text = response.content.flatMap((block: any) => (block.type === "text" ? [block.text] : [])).join("")
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)
    return JSON.parse(json) as AgentTurn
  } catch (error) {
    console.warn("[voice] Claude LLM request failed, activating resilient dispatcher dialogue:", error)
    return simulateDispatcherTurn(call)
  }
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
