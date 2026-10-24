// In-memory call state for the driver phone channel. One Node process holds
// every live call; the dev server keeps it on globalThis so hot reloads do not
// drop a call in progress. Nothing here is persisted.

import { EventEmitter } from "node:events"
import type { CallRequest, CallResult, CallStatus, CallTurn, Fact } from "@/lib/contracts"

export type LiveCall = {
  id: string
  request: CallRequest
  status: CallStatus
  startedAt: string
  answeredAt?: string
  endedAt?: string
  transcript: CallTurn[]
  summary: string
  facts: Fact[]
}

export type CallEvent = { type: "incoming" | "update"; call: LiveCall }

type Store = { calls: Map<string, LiveCall>; events: EventEmitter }

const globalStore = globalThis as typeof globalThis & { __voiceStore?: Store }

function store(): Store {
  if (!globalStore.__voiceStore) {
    const events = new EventEmitter()
    events.setMaxListeners(100)
    globalStore.__voiceStore = { calls: new Map(), events }
  }
  return globalStore.__voiceStore
}

export const TERMINAL: CallStatus[] = ["completed", "no_answer", "declined", "failed"]

export function createCall(request: CallRequest): LiveCall {
  const call: LiveCall = {
    id: `call-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    request,
    status: "ringing",
    startedAt: new Date().toISOString(),
    transcript: [],
    summary: "",
    facts: [],
  }
  store().calls.set(call.id, call)
  emit("incoming", call)
  return call
}

export function getCall(id: string): LiveCall | undefined {
  return store().calls.get(id)
}

export function ringingCallFor(driverId: string): LiveCall | undefined {
  return [...store().calls.values()].find((call) => call.request.driverId === driverId && call.status === "ringing")
}

/** The driver's most recent call, for phones that poll instead of holding a stream open. */
export function latestCallFor(driverId: string): LiveCall | undefined {
  return [...store().calls.values()].filter((call) => call.request.driverId === driverId).at(-1)
}

export function updateCall(id: string, patch: Partial<LiveCall>): LiveCall | undefined {
  const call = getCall(id)
  if (!call) return undefined
  if (TERMINAL.includes(call.status)) return call
  Object.assign(call, patch)
  if (patch.status && TERMINAL.includes(patch.status)) call.endedAt = new Date().toISOString()
  emit("update", call)
  return call
}

export function addTurn(id: string, turn: CallTurn) {
  const call = getCall(id)
  if (!call) return
  call.transcript.push(turn)
  emit("update", call)
}

function emit(type: CallEvent["type"], call: LiveCall) {
  store().events.emit("call", { type, call } satisfies CallEvent)
}

export function subscribe(listener: (event: CallEvent) => void): () => void {
  store().events.on("call", listener)
  return () => store().events.off("call", listener)
}

export function toResult(call: LiveCall): CallResult {
  return {
    callId: call.id,
    status: call.status,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    transcript: call.transcript,
    summary: call.summary || defaultSummary(call),
    facts: call.facts,
  }
}

function defaultSummary(call: LiveCall): string {
  const name = call.request.driverName
  switch (call.status) {
    case "no_answer": return `${name} did not answer the call.`
    case "declined": return `${name} declined the call.`
    case "failed": return `The call to ${name} failed.`
    case "ringing": return `Calling ${name}.`
    case "in_call": return `On the phone with ${name}.`
    default: return `Spoke with ${name}.`
  }
}
