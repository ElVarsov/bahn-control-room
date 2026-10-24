# Ignacio's AI work log

Working with Claude Code (Opus 5.5) in the desktop app. Lane A: control room UI and voice.

## Sat 24 Oct · Kickoff: read the packet, split the work
Asked: analyse the challenge repo, ideate, set up a repo for two people, plan so we
can work fully in parallel with our own agents.
Got: product direction (decision queue instead of lanes, "On the road" agent), a
two-lane plan, and a **typed contract plus fixtures** so neither lane waits.
Kept: the contract-first split. It is what lets two coding agents work at once.

## Voice: free calls from the agent to the driver
Asked: the agent must be able to phone me as the driver in the demo, for free.
Claude researched first instead of picking a provider: Vapi's free numbers only call
US/Canada, Twilio's trial only calls verified numbers in your sign-up country and blocks
some features. **Rejected both** for a browser "driver app" call (Web Speech API, free
tunnel). Real phone network stays a stretch goal.

## What broke in the first real call, and what we changed
- No request reached the model. Node rejected TLS: **Norton antivirus intercepts HTTPS**.
  Fix: `NODE_USE_SYSTEM_CA=1`. Found by reading the error, not guessing.
- The phone never rang. **The Cloudflare tunnel buffers server-sent events.** Proved it with
  curl (instant locally, nothing through the tunnel), then switched the phone to polling.
- Calls stalled after the first sentence: Android Chrome sometimes never fires the
  "finished speaking" event. Added a fallback timer and an always-visible text box.
- The mic was blocked by Chrome without a prompt. Added a "Test microphone" button.

## Prompt changes after listening to a call
- The agent wrote "she" about a driver, guessing gender from the name. Now it uses the
  driver's name or "they".
- I said I was "on the M6 near London" for a Leipzig→Helsinki job and it **believed me**.
  That is exactly the "driver message is not a location fix" trap in the brief. The prompt
  now gets the planned route, asks once when a location does not fit, and records the conflict.
- It asked "are you safe?" three times. Now once, unless a new danger comes up.
- It refused to book a replacement car on its own. Kept: that is the approval rule working.

## Control room pages
- Fixtures written from **real dataset cases** (alerts, incidents, work items), not invented
  ones, so the queue shows the packet's actual traps: a quote is not a booking, an empty
  pickup, a seller hold.
- First case-page layout put facts in a side column; at laptop width it squeezed the
  decision card. Switched to one column below 1180 px, decision first.
- "What happens next" showed the before-text after a decision. Added `whatHappensAfter`
  to the contract.
- A customer's email was labelled "Email to customer". Fixed the wording.
- Live calls run on today's clock while the dataset is frozen at 21 Oct 09:00, so a call
  showed up last with no deadline. Calls are now placed at the snapshot's "now".

## Ideas added mid-build
- Journey monitor that **forecasts** delays (Lane B), shown as estimates, never facts.
- **Driver calls Bahn**: "Call Bahn" button; the agent answers, finds the order among
  the driver's jobs, and the report appears in the queue as "Driver called in".
