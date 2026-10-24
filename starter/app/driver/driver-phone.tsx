"use client"

// A tiny "Bahn Driver" app that receives calls from the agent. The browser does
// the speech both ways (Web Speech API), so the call costs nothing. Listening
// only starts after the agent finishes speaking, so it never hears itself.

import { useCallback, useEffect, useRef, useState } from "react"
import type { CallTurn } from "@/lib/contracts"
import styles from "./driver.module.css"

type IncomingCall = {
  id: string
  status: string
  request: { driverName: string; purpose: string; orderId: string }
  transcript: CallTurn[]
}

type Phase = "off" | "waiting" | "ringing" | "connecting" | "agent" | "listening" | "thinking" | "ended"

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  start(): void
  stop(): void
  abort(): void
}

function makeRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

export function DriverPhone({ driverId }: { driverId: string }) {
  const [phase, setPhase] = useState<Phase>("off")
  const [call, setCall] = useState<IncomingCall | null>(null)
  const [turns, setTurns] = useState<CallTurn[]>([])
  const [heard, setHeard] = useState("")
  const [typed, setTyped] = useState("")
  const [seconds, setSeconds] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [endedText, setEndedText] = useState("")

  const audio = useRef<AudioContext | null>(null)
  const ringTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognition = useRef<Recognition | null>(null)
  const callRef = useRef<IncomingCall | null>(null)
  const phaseRef = useRef<Phase>("off")
  phaseRef.current = phase
  callRef.current = call

  // --- ringing ---------------------------------------------------------------

  const stopRinging = useCallback(() => {
    if (ringTimer.current) clearInterval(ringTimer.current)
    ringTimer.current = null
    navigator.vibrate?.(0)
  }, [])

  const startRinging = useCallback(() => {
    stopRinging()
    const ring = () => {
      navigator.vibrate?.([400, 200, 400])
      const ctx = audio.current
      if (!ctx) return
      for (const offset of [0, 0.45]) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = offset ? 480 : 440
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset)
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.4)
        osc.connect(gain).connect(ctx.destination)
        osc.start(ctx.currentTime + offset)
        osc.stop(ctx.currentTime + offset + 0.42)
      }
    }
    ring()
    ringTimer.current = setInterval(ring, 2000)
  }, [stopRinging])

  // --- incoming calls --------------------------------------------------------

  useEffect(() => {
    if (phase === "off") return
    const source = new EventSource(`/api/voice/stream?driverId=${encodeURIComponent(driverId)}`)
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as { type: string; call: IncomingCall }
      if (event.type === "incoming" && (phaseRef.current === "waiting" || phaseRef.current === "ended")) {
        setCall(event.call)
        setTurns([])
        setEndedText("")
        setPhase("ringing")
        startRinging()
      } else if (event.type === "update" && event.call.id === callRef.current?.id) {
        setTurns(event.call.transcript)
        if (["no_answer", "failed"].includes(event.call.status) && phaseRef.current !== "ended") {
          stopRinging()
          endLocally(event.call.status === "no_answer" ? "Missed call" : "Call dropped")
        }
      }
    }
    return () => source.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "off", driverId])

  useEffect(() => {
    if (!["agent", "listening", "thinking"].includes(phase)) return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [phase])

  // --- talking -----------------------------------------------------------------

  const speak = useCallback((text: string) => new Promise<void>((resolve) => {
    if (!text) return resolve()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-GB"
    utterance.rate = 1.05
    const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith("en") && /female|samantha|google uk|serena|libby/i.test(v.name))
      ?? speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"))
    if (voice) utterance.voice = voice
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    speechSynthesis.cancel()
    speechSynthesis.speak(utterance)
  }), [])

  const post = useCallback(async (action: string, body?: unknown) => {
    const id = callRef.current?.id
    if (!id) return null
    const response = await fetch(`/api/voice/calls/${id}/${action}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
    })
    return response.ok ? response.json() as Promise<{ say: string; end: boolean }> : null
  }, [])

  const endLocally = useCallback((text: string) => {
    recognition.current?.abort()
    speechSynthesis.cancel()
    setEndedText(text)
    setPhase("ended")
  }, [])

  const agentTurn = useCallback(async (reply: { say: string; end: boolean } | null) => {
    if (!reply) return endLocally("Call ended")
    setPhase("agent")
    await speak(reply.say)
    if (phaseRef.current === "ended") return
    if (reply.end) {
      await post("hangup")
      return endLocally("Call ended")
    }
    listen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, post, endLocally])

  const sendDriverText = useCallback(async (text: string) => {
    setHeard("")
    setPhase("thinking")
    agentTurn(await post("turn", { text }))
  }, [agentTurn, post])

  const listen = useCallback(() => {
    const rec = makeRecognition()
    if (!rec) {
      setSpeechSupported(false)
      setPhase("listening")
      return
    }
    recognition.current = rec
    rec.lang = "en-US"
    rec.interimResults = true
    rec.continuous = false
    let finalText = ""
    rec.onresult = (event) => {
      let interim = ""
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interim += result[0].transcript
      }
      setHeard((finalText + " " + interim).trim())
    }
    rec.onerror = (event) => {
      if (event.error === "not-allowed") setSpeechSupported(false)
    }
    rec.onend = () => {
      if (phaseRef.current !== "listening") return
      if (finalText.trim()) sendDriverText(finalText.trim())
      else setTimeout(() => phaseRef.current === "listening" && rec.start(), 150) // silence: keep listening
    }
    setPhase("listening")
    rec.start()
  }, [sendDriverText])

  // --- buttons -------------------------------------------------------------------

  // Everything that needs a tap happens here: sound, speech and the mic prompt.
  // None of it is awaited, so a slow permission prompt never blocks going on shift.
  const goOnShift = () => {
    audio.current = new AudioContext()
    void audio.current.resume()
    speechSynthesis.speak(new SpeechSynthesisUtterance("")) // unlock speech on iOS
    navigator.mediaDevices?.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => setSpeechSupported(false))
    ;(navigator as Navigator & { wakeLock?: { request(type: string): Promise<unknown> } }).wakeLock?.request("screen").catch(() => {})
    setPhase("waiting")
  }

  const accept = async () => {
    stopRinging()
    setSeconds(0)
    setPhase("connecting")
    agentTurn(await post("answer"))
  }

  const declineCall = async () => {
    stopRinging()
    await post("decline")
    endLocally("Call declined")
  }

  const hangUp = async () => {
    await post("hangup")
    endLocally("Call ended")
  }

  // --- screens -------------------------------------------------------------------

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

  if (phase === "off") {
    return (
      <main className={styles.screen}>
        <div className={styles.brand}>Bahn Driver</div>
        <p className={styles.lead}>Calls from Bahn operations ring here while you are on shift.</p>
        <button className={styles.primary} onClick={goOnShift}>Go on shift</button>
        <p className={styles.fine}>Allow the microphone when asked. Keep this page open.</p>
      </main>
    )
  }

  if (phase === "waiting") {
    return (
      <main className={styles.screen}>
        <div className={styles.brand}>Bahn Driver</div>
        <div className={styles.status}><span className={styles.dot} /> On shift</div>
        <p className={styles.lead}>No calls right now.</p>
        <p className={styles.fine}>Driver {driverId}</p>
      </main>
    )
  }

  if (phase === "ringing" && call) {
    return (
      <main className={`${styles.screen} ${styles.dark}`}>
        <div className={styles.caller}>
          <div className={styles.avatar}>B</div>
          <div className={styles.callerName}>Bahn Operations</div>
          <div className={styles.callerSub}>AI assistant · incoming call</div>
          <p className={styles.purpose}>{call.request.purpose}</p>
        </div>
        <div className={styles.callButtons}>
          <button className={styles.decline} onClick={declineCall} aria-label="Decline">✕</button>
          <button className={styles.accept} onClick={accept} aria-label="Accept">✆</button>
        </div>
      </main>
    )
  }

  if (phase === "ended") {
    return (
      <main className={styles.screen}>
        <div className={styles.brand}>Bahn Driver</div>
        <p className={styles.lead}>{endedText}{seconds ? ` · ${mmss}` : ""}</p>
        <Transcript turns={turns} />
        <div className={styles.status}><span className={styles.dot} /> On shift</div>
      </main>
    )
  }

  const label = phase === "connecting" ? "Connecting…" : phase === "agent" ? "Bahn is speaking" : phase === "thinking" ? "…" : "Listening"
  return (
    <main className={`${styles.screen} ${styles.dark}`}>
      <div className={styles.caller}>
        <div className={`${styles.avatar} ${phase === "agent" ? styles.speaking : ""}`}>B</div>
        <div className={styles.callerName}>Bahn Operations</div>
        <div className={styles.callerSub}>{mmss} · {label}</div>
      </div>
      <Transcript turns={turns} live={heard} dark />
      {phase === "listening" && !speechSupported && (
        <form className={styles.typeBox} onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { sendDriverText(typed.trim()); setTyped("") } }}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Speech is not available here. Type your answer" autoFocus />
          <button type="submit">Send</button>
        </form>
      )}
      <div className={styles.callButtons}>
        <button className={styles.decline} onClick={hangUp} aria-label="Hang up">✕</button>
      </div>
    </main>
  )
}

function Transcript({ turns, live, dark }: { turns: CallTurn[]; live?: string; dark?: boolean }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [turns.length, live])
  if (!turns.length && !live) return null
  return (
    <div className={`${styles.transcript} ${dark ? styles.transcriptDark : ""}`}>
      {turns.map((turn, i) => (
        <p key={i} className={turn.speaker === "agent" ? styles.agentLine : styles.driverLine}>{turn.text}</p>
      ))}
      {live && <p className={`${styles.driverLine} ${styles.live}`}>{live}</p>}
      <div ref={end} />
    </div>
  )
}
