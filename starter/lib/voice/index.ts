// The driver phone channel. Lane B's agent calls `callDriver()` as a free tool:
// drivers may be contacted without approval, customers never through this.
// See docs/VOICE.md for how the phone side works.

import type { CallRequest, CallResult } from "@/lib/contracts"
import { factsFromCall, nextAgentTurn } from "./call-agent"
import { driverContext } from "./driver-context"
import { TERMINAL, addTurn, createCall, getCall, subscribe, toResult, updateCall, type LiveCall } from "./store"

export { allCalls, getCall, latestCallFor, ringingCallFor, subscribe, toResult } from "./store"
export type { LiveCall } from "./store"

export const voiceManager = {
  answerCall: async (id: string) => {
    const res = await answer(id)
    return { id, ...res }
  },
  hangupCall: (id: string) => {
    hangUp(id)
    return { id, status: "completed" }
  },
  processDriverTurn: async (id: string, text: string) => {
    return driverSaid(id, text)
  },
}

const RING_SECONDS = Number(process.env.VOICE_RING_SECONDS ?? 45)
const MAX_CALL_SECONDS = Number(process.env.VOICE_MAX_CALL_SECONDS ?? 300)

/** Starts ringing the driver's phone and returns at once. */
export function startCall(request: CallRequest): LiveCall {
  const call = createCall(request)
  void notifyPhone(call)
  setTimeout(() => {
    if (getCall(call.id)?.status === "ringing") updateCall(call.id, { status: "no_answer" })
  }, RING_SECONDS * 1000)
  // A phone that drops off mid-call (tab closed, signal lost) must not leave the agent waiting forever.
  setTimeout(() => {
    if (getCall(call.id)?.status === "in_call") updateCall(call.id, { status: "completed" })
  }, MAX_CALL_SECONDS * 1000)
  return call
}

/** Rings the driver and resolves when the call ends: completed, no answer, declined or failed. */
export async function callDriver(request: CallRequest): Promise<CallResult> {
  const call = startCall(request)
  return waitForEnd(call.id)
}

export function waitForEnd(callId: string): Promise<CallResult> {
  return new Promise((resolve) => {
    const done = (call: LiveCall) => {
      unsubscribe()
      resolve(toResult(call))
    }
    const unsubscribe = subscribe(({ call }) => {
      if (call.id === callId && TERMINAL.includes(call.status)) done(call)
    })
    const current = getCall(callId)
    if (current && TERMINAL.includes(current.status)) done(current)
  })
}

/** Same as callDriver, for scripts running outside the Next server. */
export async function callDriverRemote(appUrl: string, request: CallRequest): Promise<CallResult> {
  const started = await fetch(`${appUrl}/api/voice/calls`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request),
  })
  if (!started.ok) throw new Error(`Could not start call: ${started.status} ${await started.text()}`)
  const { callId } = (await started.json()) as { callId: string }
  for (;;) {
    await new Promise((r) => setTimeout(r, 1500))
    const result = (await (await fetch(`${appUrl}/api/voice/calls/${callId}`)).json()) as CallResult
    if (TERMINAL.includes(result.status)) return result
  }
}

/**
 * The driver tapped "Call Bahn". The call is answered at once by the in-call
 * agent, which already knows the driver's current jobs.
 */
export async function startInboundCall(driverId: string): Promise<{ callId: string; say: string; end: boolean }> {
  const context = driverContext(driverId)
  const jobs = context.jobs.map((job) => `- ${job.reference}: ${job.car}, ${job.route}, ${job.status}`).join("\n")
  const call = createCall({
    direction: "inbound",
    orderId: context.jobs.length === 1 ? context.jobs[0].orderId : "",
    driverId,
    driverName: context.driverName,
    purpose: "Find out why they are calling and what they need.",
    questions: [
      "What happened, in their words?",
      "Is the driver safe? Is anyone hurt?",
      "Which car and order is it about?",
      "Where exactly are they?",
      "What do they need from Bahn right now?",
    ],
    context: jobs ? `The driver's current jobs:
${jobs}` : "The driver has no current job on record.",
  })
  updateCall(call.id, { status: "in_call", answeredAt: new Date().toISOString() })
  const reply = await agentSpeaks(call)
  return { callId: call.id, ...reply }
}

// Lane B registers here to turn a finished inbound call into an agent run.
type InboundHandler = (result: CallResult) => void | Promise<void>
const hooks = globalThis as typeof globalThis & { __voiceInbound?: { handlers: InboundHandler[]; wired: boolean } }
const inbound = (hooks.__voiceInbound ??= { handlers: [], wired: false })
if (!inbound.wired) {
  inbound.wired = true
  subscribe(({ call }) => {
    if (call.request.direction !== "inbound" || !TERMINAL.includes(call.status)) return
    for (const handler of inbound.handlers) void Promise.resolve(handler(toResult(call))).catch((error) => console.error("[voice] inbound handler failed", error))
  })
}

export function onInboundCall(handler: InboundHandler): () => void {
  inbound.handlers.push(handler)
  return () => { inbound.handlers = inbound.handlers.filter((h) => h !== handler) }
}

// --- actions from the phone -------------------------------------------------

export async function answer(callId: string): Promise<{ say: string; end: boolean }> {
  const call = updateCall(callId, { status: "in_call", answeredAt: new Date().toISOString() })
  if (!call || call.status !== "in_call") return { say: "", end: true }
  return agentSpeaks(call)
}

export async function driverSaid(callId: string, text: string): Promise<{ say: string; end: boolean }> {
  const call = getCall(callId)
  if (!call || call.status !== "in_call") return { say: "", end: true }
  addTurn(callId, { speaker: "driver", text, at: new Date().toISOString() })
  return agentSpeaks(call)
}

export function decline(callId: string) {
  updateCall(callId, { status: "declined" })
}

export function hangUp(callId: string) {
  const call = getCall(callId)
  if (!call) return
  updateCall(callId, { status: call.status === "ringing" ? "declined" : "completed" })
}

async function agentSpeaks(call: LiveCall): Promise<{ say: string; end: boolean }> {
  try {
    const turn = await nextAgentTurn(call)
    addTurn(call.id, { speaker: "agent", text: turn.say, at: new Date().toISOString() })
    call.summary = turn.summary
    call.facts = factsFromCall(call, turn.facts)
    call.queueHeadline = turn.queue_headline || undefined
    call.urgency = turn.urgency
    if (turn.order_reference) {
      call.orderReference = turn.order_reference
      const job = driverContext(call.request.driverId).jobs.find((j) => j.reference === turn.order_reference)
      if (job && !call.request.orderId) call.request.orderId = job.orderId
    }
    // The phone hangs up after it finishes speaking the goodbye.
    return { say: turn.say, end: turn.end_call }
  } catch (error) {
    console.error("[voice] agent turn failed", error)
    updateCall(call.id, { status: "failed", summary: "The assistant had a technical problem and dropped the call." })
    return { say: "Sorry, I have a technical problem. A colleague from Bahn will call you back.", end: true }
  }
}

// Optional lock-screen push through ntfy.sh, so the phone rings even when the page is in the background.
async function notifyPhone(call: LiveCall) {
  const topic = process.env.NTFY_TOPIC
  if (!topic) return
  const base = process.env.PUBLIC_URL ?? ""
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        Title: "Incoming call from Bahn",
        Priority: "urgent",
        Tags: "telephone_receiver",
        ...(base ? { Click: `${base}/driver?d=${encodeURIComponent(call.request.driverId)}` } : {}),
      },
      body: call.request.purpose,
    })
  } catch (error) {
    console.warn("[voice] ntfy push failed", error)
  }
}
