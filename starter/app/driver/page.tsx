"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { ActiveCall } from "@/lib/voice"

export default function DriverAppPage() {
  const [onShift, setOnShift] = useState(true)
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null)
  const [inCall, setInCall] = useState(false)
  const [transcript, setTranscript] = useState<{ speaker: string; text: string }[]>([])
  const [inputText, setInputText] = useState("")
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const ringIntervalRef = useRef<any>(null)

  // Listen for Server-Sent Events from /api/voice/stream
  useEffect(() => {
    const eventSource = new EventSource("/api/voice/stream")

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "incoming" && data.call) {
          setIncomingCall(data.call)
          startRingtone()
        } else if (data.type === "update" && data.call) {
          if (data.call.status === "completed" || data.call.status === "declined") {
            setInCall(false)
            setIncomingCall(null)
            stopRingtone()
          }
        }
      } catch (err) {
        console.error("SSE parse error:", err)
      }
    }

    return () => {
      eventSource.close()
      stopRingtone()
    }
  }, [])

  // Web Audio API Ringtone Synth (works 100% offline without external audio files)
  const startRingtone = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      if (ctx.state === "suspended") {
        ctx.resume()
      }

      const playChime = () => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(440, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3)
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.4)
      }

      playChime()
      ringIntervalRef.current = setInterval(playChime, 1800)
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([300, 200, 300])
      }
    } catch (e) {
      console.log("Audio synth error:", e)
    }
  }

  const stopRingtone = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current)
      ringIntervalRef.current = null
    }
  }

  // Speak agent message using browser SpeechSynthesis
  const speakText = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.05
      utterance.pitch = 1.0
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utterance)
    }
  }

  // Answer Call
  const handleAnswer = async () => {
    stopRingtone()
    if (!incomingCall) return

    setInCall(true)
    try {
      const res = await fetch(`/api/voice/calls/${incomingCall.id}/answer`, { method: "POST" })
      const updated = await res.json()
      setTranscript(updated.transcript || [])
      const lastTurn = updated.transcript?.[updated.transcript.length - 1]
      if (lastTurn && lastTurn.speaker === "agent") {
        speakText(lastTurn.text)
      }
    } catch (err) {
      console.error("Answer error:", err)
    }
  }

  // Decline Call
  const handleDecline = async () => {
    stopRingtone()
    if (!incomingCall) return
    try {
      await fetch(`/api/voice/calls/${incomingCall.id}/hangup`, { method: "POST" })
    } finally {
      setIncomingCall(null)
      setInCall(false)
    }
  }

  // Send Driver Turn
  const sendDriverTurn = async (textToSend: string) => {
    if (!incomingCall || !textToSend.trim()) return

    const userText = textToSend.trim()
    setInputText("")
    setTranscript((prev) => [...prev, { speaker: "driver", text: userText }])

    try {
      const res = await fetch(`/api/voice/calls/${incomingCall.id}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText }),
      })
      const result = await res.json()
      if (result.say) {
        setTranscript((prev) => [...prev, { speaker: "agent", text: result.say }])
        speakText(result.say)
      }
      if (result.end) {
        setTimeout(() => {
          setInCall(false)
          setIncomingCall(null)
        }, 3000)
      }
    } catch (err) {
      console.error("Turn error:", err)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      {/* Mobile Device Frame */}
      <div
        style={{
          width: "100%",
          maxWidth: "390px",
          height: "760px",
          background: "#1e293b",
          borderRadius: "44px",
          border: "4px solid #334155",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Notch */}
        <div
          style={{
            height: "26px",
            background: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 20px",
          }}
        >
          <div style={{ width: "80px", height: "14px", background: "#1e293b", borderRadius: "10px" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#38bdf8" }}>BAHN DRIVER</div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>Driver: Matti V. · drv-140</div>
          </div>
          <button
            onClick={() => setOnShift(!onShift)}
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 600,
              background: onShift ? "rgba(34, 197, 94, 0.2)" : "#334155",
              color: onShift ? "#4ade80" : "#94a3b8",
              border: "1px solid rgba(74, 222, 128, 0.3)",
              cursor: "pointer",
            }}
          >
            {onShift ? "● On Shift" : "○ Off Shift"}
          </button>
        </div>

        {/* Body / Active Assignment */}
        <div style={{ flex: 1, padding: "18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ background: "#0f172a", borderRadius: "14px", padding: "16px", border: "1px solid #334155" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 600 }}>ACTIVE GIG</span>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>CD-420322</span>
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>Bentley Continental GT</div>
            <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "2px" }}>Berlin → Hamburg (A7 Northbound)</div>

            <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
              <button
                onClick={() => {
                  fetch("/api/voice/calls", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      orderId: "ord-00322",
                      driverId: "drv-140",
                      driverName: "Matti V.",
                      purpose: "Driver triggered safe stop check on A7",
                      questions: ["Are you safe?", "What warning light appeared?"],
                    }),
                  })
                }}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "8px",
                  background: "#dc2626",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ⚠️ Report Safe Stop
              </button>
              <button
                onClick={() => alert("Photo upload simulated: Dash warning image sent to order proofs.")}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "8px",
                  background: "#334155",
                  color: "#f8fafc",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                📷 Upload Photo
              </button>
            </div>
          </div>

          {/* Test call trigger for self-test */}
          <div style={{ background: "#1e293b", borderRadius: "12px", padding: "12px", border: "1px dashed #475569", textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>
              Demonstration: Test incoming call from the agent:
            </div>
            <button
              onClick={() => {
                fetch("/api/voice/calls", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    orderId: "ord-00322",
                    driverId: "drv-140",
                    driverName: "Matti V.",
                    purpose: "Test driver voice protocol",
                    questions: ["Are you safe?"],
                  }),
                })
              }}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                background: "#0284c7",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              Simulate Incoming Call
            </button>
          </div>
        </div>

        {/* Footer Link back to Control Room */}
        <div style={{ padding: "10px", textAlign: "center", borderTop: "1px solid #334155" }}>
          <Link href="/" style={{ color: "#38bdf8", fontSize: "11px", textDecoration: "none" }}>
            ← Return to Control Room (Ops View)
          </Link>
        </div>

        {/* FULLSCREEN INCOMING CALL OVERLAY */}
        {incomingCall && !inCall && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#090d16",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "60px 24px 50px",
              zIndex: 50,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "13px", color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                INCOMING CALL
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#fff", marginTop: "8px" }}>
                Bahn Operations
              </div>
              <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>
                Road Dispatch & Safety Agent
              </div>
              <div style={{ marginTop: "30px", width: "80px", height: "80px", borderRadius: "50%", background: "#0284c7", margin: "30px auto 0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>
                📞
              </div>
            </div>

            <div style={{ width: "100%", display: "flex", justifyContent: "space-around" }}>
              <button
                onClick={handleDecline}
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: "#dc2626",
                  border: "none",
                  color: "#fff",
                  fontSize: "24px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
              <button
                onClick={handleAnswer}
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  border: "none",
                  color: "#fff",
                  fontSize: "24px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✓
              </button>
            </div>
          </div>
        )}

        {/* FULLSCREEN ACTIVE CALL SCREEN */}
        {inCall && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#0f172a",
              display: "flex",
              flexDirection: "column",
              padding: "40px 18px 24px",
              zIndex: 50,
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: isSpeaking ? "#4ade80" : "#94a3b8" }}>
                {isSpeaking ? "Agent Speaking..." : "Call in Progress"}
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>
                Bahn Safety Agent
              </div>
            </div>

            {/* Conversation Log */}
            <div
              style={{
                flex: 1,
                background: "#1e293b",
                borderRadius: "14px",
                padding: "12px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              {transcript.map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: t.speaker === "driver" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    background: t.speaker === "driver" ? "#0284c7" : "#334155",
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    fontSize: "12.5px",
                    lineHeight: 1.35,
                  }}
                >
                  <div style={{ fontSize: "10px", opacity: 0.7, marginBottom: "2px" }}>
                    {t.speaker.toUpperCase()}
                  </div>
                  {t.text}
                </div>
              ))}
            </div>

            {/* Quick Driver Voice Answers or Text Input */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <button
                  onClick={() => sendDriverTurn("I'm safe, pulled into the service area parking.")}
                  style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px", background: "#334155", color: "#cbd5e1", border: "none" }}
                >
                  "I'm safe at rest stop"
                </button>
                <button
                  onClick={() => sendDriverTurn("Red engine coolant temperature light is on.")}
                  style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px", background: "#334155", color: "#cbd5e1", border: "none" }}
                >
                  "Red engine light on"
                </button>
                <button
                  onClick={() => sendDriverTurn("Photo uploaded in the app.")}
                  style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px", background: "#334155", color: "#cbd5e1", border: "none" }}
                >
                  "Photo uploaded"
                </button>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendDriverTurn(inputText)}
                  placeholder="Speak or type driver reply..."
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "#1e293b",
                    border: "1px solid #475569",
                    color: "#fff",
                    fontSize: "12px",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => sendDriverTurn(inputText)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    background: "#0284c7",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Send
                </button>
              </div>
            </div>

            {/* Hangup Button */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={handleDecline}
                style={{
                  width: "120px",
                  padding: "10px",
                  borderRadius: "999px",
                  background: "#dc2626",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                End Call
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
