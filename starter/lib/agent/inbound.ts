// Handles inbound phone calls from drivers ("Call Bahn" button). Maps the call to
// the driver's active order and launches an agent run to assess the situation and propose next steps.

import { onInboundCall } from "@/lib/voice"
import { rows } from "./dataset"
import { startRun } from "./loop"

let wired = false

export function wireInboundCalls() {
  if (wired) return
  wired = true

  onInboundCall(async (call) => {
    try {
      let orderId = call.orderId
      if (!orderId && call.driverId) {
        // Find active assignment for this driver
        const assignment = rows("work_assignments").find(
          (a) => a.driver_id === call.driverId && a.status !== "COMPLETED" && a.status !== "CANCELLED"
        )
        if (assignment) orderId = String(assignment.order_id)
      }

      if (!orderId) {
        console.warn("[agent-inbound] Inbound call received but no active order found for driver", call.driverId)
        return
      }

      const heard = call.transcript.filter((t) => t.speaker === "driver").map((t) => t.text).join(" ")
      const trigger = call.summary
        ? `Driver phoned Bahn: ${call.summary}`
        : heard
        ? `Driver phoned Bahn: “${heard.slice(0, 180)}”`
        : "Driver phoned Bahn with an inbound status report"

      const record = startRun({
        order: orderId,
        trigger,
        driverMode: "phone",
      })

      if (call.facts && call.facts.length > 0) {
        for (const f of call.facts) {
          record.facts.push(f)
        }
      }
    } catch (error) {
      console.error("[agent-inbound] Failed to handle inbound call", error)
    }
  })
}
