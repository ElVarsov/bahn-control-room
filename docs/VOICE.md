# Voice: the agent calls the driver

For the demo, a person plays the driver and **receives a real call on their phone
from the agent**. The call has to be free, reliable on stage, and work in Finland.

## What we checked (24 Oct 2026)

| Option | Free? | Works from Finland? | Verdict |
|---|---|---|---|
| **Driver-app call in the phone browser** (our own page, Web Speech API, free tunnel) | Yes, no account | Yes, any phone with Chrome or Safari | **Primary.** Nothing can be cut off on stage. |
| Twilio trial (real phone network) | 75 free minutes, no card | Only to numbers in your sign-up country, up to 5 verified numbers, shared trial caller ID, some TwiML verbs blocked on trial | **Stretch.** A real ring, but trial limits are unclear for our use. Try for 30 min max. |
| Vapi free numbers | Free credits | No: US/Canada only, ~10 outbound calls a day | No |
| Retell / ElevenLabs agents | Small free tiers | Need a Twilio number anyway | No |

Sources: Twilio trial docs (twilio.com/docs/usage/trials), Vapi free telephony
docs and support forum.

## How the primary path works

```
road agent ──call_driver(tool)──► lib/voice (call store + in-call agent)
                                      │  server-sent events
           phone (driver app page) ◄──┘  rings: full-screen call, ringtone, vibration
           phone ──speech-to-text (browser)──► POST /api/voice/calls/:id/turn
           server ──in-call agent (Claude)──► reply text ──► phone speaks it (browser TTS)
           call ends ──► CallResult {transcript, facts} ──► back to the road agent
```

- **No streams through the tunnel**: Cloudflare quick tunnels buffer server-sent events, so the phone polls `/api/voice/poll` every second instead.
- **Phone page** `/driver?d=<driverId>`: the "Bahn Driver" app. Open it once and
  leave it open. When the agent calls, it rings like a phone call (ringtone,
  vibration, Accept / Decline).
- **Waking the phone (optional)**: set `NTFY_TOPIC` and install the free *ntfy*
  app. Each call also pushes "Incoming call from Bahn" to the lock screen; tapping
  it opens the call. No account needed.
- **Reaching the laptop from the phone**: the mic needs HTTPS, so run a free
  Cloudflare quick tunnel: `cloudflared tunnel --url http://localhost:3000`
  (no account), then open the printed `https://….trycloudflare.com/driver` on the phone.
- **Speech**: the browser does speech-to-text and text-to-speech for free. Chrome on
  Android works best; Safari on iOS 14.5+ works.
- **In-call agent**: a short Claude loop per call with the call's purpose and
  questions ("Are you safe? Where exactly are you? Can you send a photo of the
  warning light?"). It ends the call itself when it has the answers and returns
  structured facts. Everything it hears is `reported` strength, source `driver`,
  channel `phone`.
- **No answer / declined**: returns `no_answer` or `declined`; the road agent
  decides when to try again ("retry in 15 min") and shows that in the trace.

## The contract (what Lane B calls)

```ts
import { callDriver } from "@/lib/voice"
const result = await callDriver({ orderId, driverId, driverName, purpose, questions, runId })
// result: CallResult (see lib/contracts)
```

`callDriver` resolves when the call ends. It is a **free** tool: drivers may be
contacted without approval. It must never be pointed at a customer.

## Claude access

We use the organisers' OpenRouter credits. In `starter/.env`:

```
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://openrouter.ai/api
ANTHROPIC_AUTH_TOKEN=<your OpenRouter key>
VOICE_MODEL=anthropic/claude-haiku-5.5
```

A call is about 8 to 10 short turns: well under 1 cent on Haiku 5.5, roughly
10 to 20 cents on Opus 5.5 (same prices as Anthropic's own API). Test with Haiku,
decide on the demo model later.

## Try it

```sh
cd starter
npm run dev
cloudflared tunnel --url http://localhost:3000   # second terminal
# open https://<tunnel>/driver?d=drv-140 on the phone, tap "Go on shift"
npm run voice:call -- drv-140 ord-00299          # third terminal: the agent calls you
```

## Troubleshooting (found in the first real test, 24 Oct)

- **Phone says speech is unavailable or "not-allowed"**: the mic is blocked. In Chrome
  tap the icon left of the address bar, then Permissions, then Microphone: Allow. If it
  is not listed: Android Settings, Apps, Chrome, Permissions, Microphone: Allow. Then use
  **Test microphone** on the driver page before the call. The text box always works as a fallback.
- **Agent hangs up at once with "technical problem"**: check the dev server log. On a
  laptop with antivirus HTTPS scanning (Norton) Node rejects the certificate; start the
  server with `NODE_USE_SYSTEM_CA=1` (PowerShell: `$env:NODE_USE_SYSTEM_CA = '1'; npm run dev`).
- **Phone never rings**: make sure the phone page shows "On shift" and the driver id in
  the link matches the one you call.
