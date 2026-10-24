// The agent's call_driver tool. If the driver's phone page is open, the real phone
// rings (lib/voice). Otherwise a simulated driver answers from what that driver has
// actually written on this order, so runs work without a phone. Traces say which.

import type { CallResult, CallTurn } from "@/lib/contracts"
import { callDriver, isDriverOnline } from "@/lib/voice"
import { complete, MODEL } from "./model"
import { actorName, forOrder, SNAPSHOT_AT, type Row } from "./dataset"
import { assignedDriver, carOf, routeOf } from "./tools"

export type DriverMode = "auto" | "phone" | "simulated"

export async function callAssignedDriver(order: Row, purpose: string, questions: string[], mode: DriverMode, runId: string): Promise<CallResult & { simulated: boolean; driverName: string }> {
  const driver = assignedDriver(order)
  if (!driver) {
    return { callId: "none", status: "failed", startedAt: SNAPSHOT_AT, transcript: [], summary: "No driver is assigned to this order, so there is nobody to call.", facts: [], simulated: false, driverName: "nobody" }
  }
  const driverName = String(driver.display_name)
  const usePhone = mode === "phone" || (mode === "auto" && isDriverOnline(driver.id))
  if (usePhone) {
    const result = await callDriver({
      orderId: order.id, driverId: driver.id, driverName, purpose, questions, runId,
      context: `Car: ${carOf(order)}. Order ${order.reference}. Planned route: ${routeOf(order)}. The driver should be somewhere along this route.`,
    })
    return { ...result, simulated: false, driverName }
  }
  return { ...(await simulatedCall(order, driver, purpose, questions)), simulated: true, driverName }
}

async function simulatedCall(order: Row, driver: Row, purpose: string, questions: string[]): Promise<CallResult> {
  const theirMessages = forOrder("messages", order.id)
    .filter((m) => m.author_id === driver.id)
    .map((m) => `[${m.authored_at}] ${m.body}`)
    .join("\n") || "(No messages from this driver on record.)"
  const system = `You play ${driver.display_name}, a freelance car delivery driver, answering a short phone call from Bahn's AI assistant. Stay consistent with what you have written before. If you do not know something, say so. Answer each question in one or two plain sentences. This is a simulation for a demo; everything is fictional.`
  const prompt = `Your job: ${carOf(order)}, order ${order.reference}, ${routeOf(order)}.
What you have written to Bahn so far:
${theirMessages}

The assistant says: "${purpose}"
Questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Reply as JSON: {"answers": ["...one per question..."]}`
  const text = await complete({ system, prompt, maxTokens: 1500 })
  let answers: string[] = []
  try { answers = (JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { answers: string[] }).answers ?? [] } catch { answers = [] }
  const transcript: CallTurn[] = [{ speaker: "agent", text: `Hi ${actorName("driver", driver.id)}, this is Bahn's AI assistant. ${purpose}`, at: SNAPSHOT_AT }]
  questions.forEach((q, i) => {
    transcript.push({ speaker: "agent", text: q, at: SNAPSHOT_AT })
    transcript.push({ speaker: "driver", text: answers[i] ?? "I'm not sure.", at: SNAPSHOT_AT })
  })
  return {
    callId: `sim-${Date.now().toString(36)}`,
    status: answers.length ? "completed" : "failed",
    startedAt: SNAPSHOT_AT,
    endedAt: SNAPSHOT_AT,
    transcript,
    summary: answers.length ? `Simulated call with ${driver.display_name} (${MODEL}).` : "The simulated call failed.",
    facts: [],
  }
}
