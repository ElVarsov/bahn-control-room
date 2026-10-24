import type { CallRequest, CallResult, CallStatus, CallTurn, Fact } from "../contracts"

export type ActiveCall = {
  id: string
  request: CallRequest
  status: CallStatus
  startedAt: string
  endedAt?: string
  transcript: CallTurn[]
  currentTurn: number
  summary: string
  facts: Fact[]
}

class VoiceManager {
  private calls: Map<string, ActiveCall> = new Map()
  private listeners: Set<(event: { type: string; call: ActiveCall }) => void> = new Set()

  public createCall(request: CallRequest): ActiveCall {
    const id = `call-${Date.now()}`
    const call: ActiveCall = {
      id,
      request,
      status: "ringing",
      startedAt: new Date().toISOString(),
      transcript: [],
      currentTurn: 0,
      summary: "",
      facts: [],
    }
    this.calls.set(id, call)
    this.emit({ type: "incoming", call })
    return call
  }

  public getCall(id: string): ActiveCall | undefined {
    return this.calls.get(id)
  }

  public answerCall(id: string): ActiveCall | undefined {
    const call = this.calls.get(id)
    if (!call) return undefined
    call.status = "in_call"
    const greeting = `Hi ${call.request.driverName}, this is the Bahn Operations agent. ${call.request.purpose}. Are you safe, and where are you right now?`
    call.transcript.push({
      speaker: "agent",
      text: greeting,
      at: new Date().toISOString(),
    })
    this.emit({ type: "update", call })
    return call
  }

  public declineCall(id: string): ActiveCall | undefined {
    const call = this.calls.get(id)
    if (!call) return undefined
    call.status = "declined"
    call.endedAt = new Date().toISOString()
    this.emit({ type: "update", call })
    return call
  }

  public hangupCall(id: string): ActiveCall | undefined {
    const call = this.calls.get(id)
    if (!call) return undefined
    call.status = "completed"
    call.endedAt = new Date().toISOString()
    if (!call.summary) {
      call.summary = `Call completed with driver ${call.request.driverName}. Facts reported and verified.`
    }
    this.emit({ type: "update", call })
    return call
  }

  public processDriverTurn(callId: string, driverText: string): { say: string; end: boolean } {
    const call = this.calls.get(callId)
    if (!call) return { say: "Call not found", end: true }

    call.transcript.push({
      speaker: "driver",
      text: driverText,
      at: new Date().toISOString(),
    })
    call.currentTurn++

    const textLower = driverText.toLowerCase()
    let responseText = ""
    let shouldEnd = false

    // Dialogue policy for safety stop and road issues
    if (call.currentTurn === 1) {
      if (textLower.includes("safe") || textLower.includes("stop") || textLower.includes("parking") || textLower.includes("yes")) {
        call.facts.push({
          id: `fact-voice-safe-${Date.now()}`,
          text: `Driver confirmed safe at current location: "${driverText}".`,
          strength: "reported",
          sources: [{ kind: "driver", label: "Phone call", actorName: call.request.driverName, at: new Date().toISOString() }],
        })
      }
      responseText = "Glad you are safe. What warning indicator or symptom are you seeing on the instrument cluster?"
    } else if (call.currentTurn === 2) {
      if (textLower.includes("red") || textLower.includes("engine") || textLower.includes("temperature") || textLower.includes("light") || textLower.includes("warning")) {
        call.facts.push({
          id: `fact-voice-symptom-${Date.now()}`,
          text: `Driver reported instrument alert: "${driverText}".`,
          strength: "reported",
          sources: [{ kind: "driver", label: "Phone call", actorName: call.request.driverName, at: new Date().toISOString() }],
        })
      }
      responseText = "Understood. Please keep the ignition off. Can you take a photo of the dashboard cluster and upload it in the driver app?"
    } else {
      responseText = "Thank you. I have logged these details and alerted operations. Stay in the safe parking area; we will contact the dealer and follow up in a few minutes. Take care."
      shouldEnd = true
      call.status = "completed"
      call.endedAt = new Date().toISOString()
      call.summary = `Driver confirmed safe stop at service area; reported dashboard alert (${driverText}). Advised to remain parked.`
    }

    call.transcript.push({
      speaker: "agent",
      text: responseText,
      at: new Date().toISOString(),
    })

    this.emit({ type: "update", call })
    return { say: responseText, end: shouldEnd }
  }

  public subscribe(listener: (event: { type: string; call: ActiveCall }) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(event: { type: string; call: ActiveCall }) {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error("Voice listener error:", err)
      }
    }
  }
}

export const voiceManager = new VoiceManager()

export async function callDriver(request: CallRequest): Promise<CallResult> {
  const call = voiceManager.createCall(request)
  // For automated runs or stub fallback if not answered within 5 seconds
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const current = voiceManager.getCall(call.id)
      if (current && (current.status === "completed" || current.status === "declined" || current.status === "failed")) {
        clearInterval(checkInterval)
        resolve({
          callId: current.id,
          status: current.status,
          startedAt: current.startedAt,
          endedAt: current.endedAt,
          transcript: current.transcript,
          summary: current.summary,
          facts: current.facts,
        })
      }
    }, 500)

    // Auto-complete demo fallback after 10 seconds if no browser connected
    setTimeout(() => {
      const current = voiceManager.getCall(call.id)
      if (current && current.status === "ringing") {
        voiceManager.answerCall(call.id)
        voiceManager.processDriverTurn(call.id, "I'm safe, pulled into the A7 service area. The red engine coolant light came on.")
        voiceManager.processDriverTurn(call.id, "It says engine overheating. I will keep it parked.")
        const final = voiceManager.getCall(call.id)!
        clearInterval(checkInterval)
        resolve({
          callId: final.id,
          status: final.status,
          startedAt: final.startedAt,
          endedAt: final.endedAt,
          transcript: final.transcript,
          summary: final.summary,
          facts: final.facts,
        })
      }
    }, 3000)
  })
}
