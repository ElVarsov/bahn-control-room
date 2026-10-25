// Words for the queue and case pages. Codes stay in the contract; people read these.

import type { AgentState, FactStrength, QueueReason, SourceKind, Urgency } from "@/lib/contracts"
import type { Tone } from "@/lib/present/types"

export const URGENCY_GROUP: Record<Urgency, string> = {
  now: "Within 30 minutes",
  today: "Later today",
  soon: "Within 2 hours",
  watch: "Keeping an eye on",
}

export const URGENCY_TONE: Record<Urgency, Tone> = { now: "danger", today: "warn", soon: "neutral", watch: "neutral" }

export const REASON: Record<QueueReason, { label: string; tone: Tone; icon: string }> = {
  decision: { label: "Approve here", tone: "accent", icon: "check" },
  handover: { label: "Call needed", tone: "neutral", icon: "phone" },
  forecast: { label: "Forecast", tone: "warn", icon: "trend" },
  driver_report: { label: "Driver called in", tone: "accent", icon: "phone" },
}

export const AGENT_STATE: Record<AgentState, string> = {
  idle: "Monitor is watching",
  working: "Agent working",
  waiting_reply: "Waiting for a reply",
  needs_person: "Agent stopped for you",
  done: "Agent finished",
}

export const STRENGTH: Record<FactStrength, { label: string; tone: Tone; hint: string }> = {
  verified: { label: "Verified", tone: "ok", hint: "A record proves it: a booking reference, a gate scan, an approved proof." },
  reported: { label: "Reported", tone: "neutral", hint: "Someone said it. Nobody has checked it yet." },
  estimate: { label: "Estimate", tone: "warn", hint: "Calculated by the system or an agent. It can change." },
  quote: { label: "Quote", tone: "warn", hint: "Offered, not booked. Availability can change." },
  unknown: { label: "Not known", tone: "danger", hint: "Not supplied, or the sources disagree." },
}

export const SOURCE_KIND: Record<SourceKind, string> = {
  driver: "Driver", customer: "Customer", site: "Site", operator: "Bahn", agent: "Agent", system: "System", provider: "Provider",
}

export const CHANNEL: Record<string, string> = {
  driver_chat: "Driver app chat",
  customer_email: "Customer email",
  internal_note: "Internal note",
  support_chat: "Support chat",
  whatsapp: "WhatsApp",
  site_email: "Email from site",
  sms: "Text message",
  phone: "Phone",
  email: "Email",
  agent: "Agent",
}
