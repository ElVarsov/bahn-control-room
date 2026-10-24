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
  const speaking = useRef<SpeechSynthesisUtterance | null>(null)
  const stopListening = useRef<() => void>(() => {})
  const [micError, setMicError] = useState("")
  const [micTest, setMicTest] = useState("")
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

  // Poll once a second rather than holding a stream open: the Cloudflare tunnel
  // buffers server-sent events, so a stream would never ring the phone.
  useEffect(() => {
    if (phase === "off") return
    let stopped = false
    const tick = async () => {
      try {
        const response = await fetch(`/api/voice/poll?driverId=${encodeURIComponent(driverId)}`, { cache: "no-store" })
        const { call: latest } = (await response.json()) as { call: IncomingCall | null }
        if (stopped || !latest) return
        const isNew = latest.id !== callRef.current?.id
        if (isNew && latest.status === "ringing" && (phaseRef.current === "waiting" || phaseRef.current === "ended")) {
          setCall(latest)
          setTurns([])
          setEndedText("")
          setPhase("ringing")
          startRinging()
        } else if (!isNew) {
          setTurns(latest.transcript)
          if (["no_answer", "failed"].includes(latest.status) && phaseRef.current !== "ended") {
            stopRinging()
            endLocally(latest.status === "no_answer" ? "Missed call" : "Call dropped")
          }
        }
      } catch {
        // Offline for a moment; the next tick tries again.
      }
    }
    void tick()
    const timer = setInterval(tick, 1000)
    return () => { stopped = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "off", driverId])

  useEffect(() => {
    if (!["agent", "listening", "thinking"].includes(phase)) return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [phase])

  // --- talking -----------------------------------------------------------------

  // Android Chrome sometimes never fires `end` on an utterance, which would leave
  // the call stuck on "Bahn is speaking". So we also watch `speechSynthesis.speaking`
  // and give up after a length-based timeout.
  const speak = useCallback((text: string) => new Promise<void>((resolve) => {
    if (!text) return resolve()
    let done = false
    let started = false
    const finish = () => {
      if (done) return
      done = true
      clearInterval(watch)
      clearTimeout(limit)
      resolve()
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-GB"
    utterance.rate = 1.05
    const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith("en") && /female|samantha|google uk|serena|libby/i.test(v.name))
      ?? speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"))
    if (voice) utterance.voice = voice
    utterance.onstart = () => { started = true }
    utterance.onend = finish
    utterance.onerror = finish
    speaking.current = utterance // keep a reference so the browser does not drop it mid-sentence
    speechSynthesis.cancel()
    speechSynthesis.speak(utterance)
    const watch = setInterval(() => {
      if (speechSynthesis.speaking) started = true
      else if (started) finish()
    }, 300)
    const limit = setTimeout(finish, 2500 + text.length * 90)
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
    stopListening.current()
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
    // The browser ends a recognition session at every short pause. We keep what was
    // said across sessions and only send once the driver has been quiet for a moment,
    // so the agent hears whole sentences, not fragments.
    const QUIET_MS = 1500
    let kept = ""        // final text from earlier sessions of this turn
    let session = ""     // final text from the current session
    let finished = false
    let quietTimer: ReturnType<typeof setTimeout> | null = null
    stopListening.current = () => {
      finished = true
      if (quietTimer) clearTimeout(quietTimer)
      rec.onend = null
      rec.abort()
    }
    const finish = () => {
      if (finished || phaseRef.current !== "listening") return
      const text = `${kept} ${session}`.trim()
      if (!text) return
      finished = true
      rec.onend = null
      rec.abort()
      sendDriverText(text)
    }
    rec.onresult = (event) => {
      let interim = ""
      session = ""
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) session += result[0].transcript
        else interim += result[0].transcript
      }
      setHeard(`${kept} ${session} ${interim}`.replace(/\s+/g, " ").trim())
      if (quietTimer) clearTimeout(quietTimer)
      quietTimer = setTimeout(finish, interim ? QUIET_MS * 2 : QUIET_MS)
    }
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return
      setMicError(event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone blocked. Type your answer below."
        : `Speech recognition problem (${event.error}). Type your answer below.`)
      if (event.error === "not-allowed" || event.error === "service-not-allowed") setSpeechSupported(false)
    }
    rec.onend = () => {
      if (finished || phaseRef.current !== "listening") return
      // A pause ended the session: keep its words and listen on. The quiet timer decides when the turn is over.
      kept = `${kept} ${session}`.trim()
      session = ""
      setTimeout(() => {
        if (finished || phaseRef.current !== "listening") return
        try { rec.start() } catch { /* already listening */ }
      }, 100)
    }
    setMicError("")
    setPhase("listening")
    try { rec.start() } catch { setMicError("Could not start the microphone. Type your answer below.") }
  }, [sendDriverText])

  // Send what was heard so far, or what was typed, without waiting for the browser to decide the sentence ended.
  const sendNow = (text: string) => {
    const clean = text.trim()
    if (!clean || phaseRef.current !== "listening") return
    stopListening.current()
    setTyped("")
    sendDriverText(clean)
  }

  // --- buttons -------------------------------------------------------------------

  // Everything that needs a tap happens here: sound, speech and the mic prompt.
  // None of it is awaited, so a slow permission prompt never blocks going on shift.
  const goOnShift = () => {
    audio.current = new AudioContext()
    void audio.current.resume()
    speechSynthesis.speak(new SpeechSynthesisUtterance("")) // unlock speech on iOS
    // Ask for the mic up front, but only report a failure: speech recognition asks again itself.
    if (!makeRecognition()) setMicError("This browser has no speech recognition. Use Chrome on Android or Safari on iPhone, or type your answers.")
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then((s) => s.getTracks().forEach((t) => t.stop()))
      .catch((error: Error) => setMicError(`Microphone check failed (${error.name}). Tap "Test microphone" or check Chrome's site settings.`))
    ;(navigator as Navigator & { wakeLock?: { request(type: string): Promise<unknown> } }).wakeLock?.request("screen").catch(() => {})
    setPhase("waiting")
  }

  // Listens for one sentence and shows what it heard, so the person playing the driver can check before a demo.
  const testMic = () => {
    const rec = makeRecognition()
    if (!rec) return setMicTest("No speech recognition in this browser.")
    rec.lang = "en-US"
    rec.interimResults = false
    rec.continuous = false
    setMicError("")
    setMicTest("Listening… say something.")
    let heardSomething = false
    rec.onresult = (event) => {
      heardSomething = true
      setMicTest(`Heard: "${event.results[0][0].transcript}". Speech works.`)
    }
    rec.onerror = (event) => setMicTest(`Speech recognition error: ${event.error}.`)
    rec.onend = () => { if (!heardSomething) setMicTest((t) => (t.startsWith("Listening") ? "Heard nothing. Try again closer to the phone." : t)) }
    try { rec.start() } catch (error) { setMicTest(`Could not start: ${(error as Error).message}`) }
  }

  const accept = async () => {
    stopRinging()
    setSeconds(0)
    setPhase("connecting")
    agentTurn(await post("answer"))
  }

  // The driver calls Bahn: the agent answers straight away and already knows their jobs.
  const callBahn = async () => {
    setSeconds(0)
    setTurns([])
    setEndedText("")
    setMicError("")
    setPhase("connecting")
    try {
      const response = await fetch("/api/voice/calls/inbound", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ driverId }),
      })
      if (!response.ok) throw new Error(String(response.status))
      const reply = (await response.json()) as { callId: string; say: string; end: boolean }
      const started: IncomingCall = { id: reply.callId, status: "in_call", request: { driverName: "", purpose: "", orderId: "" }, transcript: [] }
      callRef.current = started
      setCall(started)
      void agentTurn(reply)
    } catch {
      endLocally("Could not reach Bahn. Try again.")
    }
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
        <button className={styles.callBahn} onClick={callBahn}><span aria-hidden="true">✆</span> Call Bahn</button>
        <p className={styles.fine}>Something wrong on the road? Call and tell the assistant.</p>
        <button className={styles.secondary} onClick={testMic}>Test microphone</button>
        {micTest && <p className={styles.fine}>{micTest}</p>}
        {micError && <p className={styles.micErrorLight}>{micError}</p>}
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
        <button className={styles.callBahn} onClick={callBahn}><span aria-hidden="true">✆</span> Call Bahn</button>
      </main>
    )
  }

  const label = phase === "connecting" ? "Connecting…" : phase === "agent" ? "Bahn is speaking" : phase === "thinking" ? "Bahn is thinking…" : "Your turn, speak now"
  return (
    <main className={`${styles.screen} ${styles.dark}`}>
      <div className={styles.caller}>
        <div className={`${styles.avatar} ${phase === "agent" ? styles.speaking : ""}`}>B</div>
        <div className={styles.callerName}>Bahn Operations</div>
        <div className={styles.callerSub}>{mmss} · {label}</div>
      </div>
      <Transcript turns={turns} live={heard} dark />
      {micError && <p className={styles.micError}>{micError}</p>}
      {phase === "listening" && heard && (
        <button className={styles.sendHeard} onClick={() => sendNow(heard)}>Done talking</button>
      )}
      {/* Always there, so a call can never get stuck on a phone whose speech recognition misbehaves. */}
      <form className={styles.typeBox} onSubmit={(e) => { e.preventDefault(); sendNow(typed) }}>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={speechSupported ? "Or type your answer" : "Type your answer"}
          disabled={phase !== "listening"}
        />
        <button type="submit" disabled={phase !== "listening" || !typed.trim()}>Send</button>
      </form>
      <div className={styles.callButtons}>
        <button className={styles.decline} onClick={hangUp} aria-label="Hang up">✕</button>
      </div>
    </main>
  )
}

function Transcript({ turns, live, dark }: { turns: CallTurn[]; live?: string; dark?: boolean }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }) }, [turns.length, live])
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
