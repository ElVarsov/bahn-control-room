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

## Merging with Antoni, and enforcing lanes
- Antoni's merge replaced Lane A pages and added voice routes that broke calls. I asked the agent
  to check before merging: it typechecked their `main` in a separate worktree and found three
  routes importing a missing `voiceManager` that shadowed the working route.
- Their seeded cases invented routes, names and a flight number. We kept their backend but show
  the hand-checked fixtures by default until the store derives facts from the dataset.
- GitHub cannot say "only the other lane needs approval" (code-owner review also blocks your own
  PRs). Instead: a `lane-guard` check that reads `.github/lanes.json` from the base branch, passes
  at once for your own lane and waits for the other person otherwise. `main` only takes PRs.

## The road agent loop (built in Lane B on a branch, PR for Antoni)
- Asked for a real Claude tool-use loop: read tools over the dataset, mock ferry/hotel search,
  `call_driver` (rings the real phone if the driver app is open, else a simulated driver who
  answers from that driver's real messages), `note_fact` with strength and source record,
  `propose` for anything that changes the world, `finish`. Every run is a trace in `traces/`.
- **First run rejected:** the mock ferry search invented a sailing the dataset does not have,
  so the agent proposed a ship that does not exist. Fixed by searching the dataset's shared
  timetable instead of generating one. Also forbade UTC in operator text and guessing gender.
- **The agent caught our mistake:** our hand-written CD-420299 case said delivery moves to
  28 Oct. The agent worked out that the 24 Oct sailing still arrives before the 27 Oct promise.
- It skipped the phone call on CD-420299 because the conversation already had the driver's
  answer, and called on CD-420322 because the location was unknown. Cheap first, as asked.
- Approving a booking first booked straight away, ignoring the agent's own warning about a
  failed earlier attempt. The approval step now checks with the provider first.
- A second run left the first run's proposal open, so two plans could be approved. Older
  proposals are now "superseded" when a new run starts.

## Completeness review after Antoni's monitor (Sat 21:00)
- **Monitor false alarms:** it compared the final-delivery ETA with the ferry check-in cutoff,
  so every import with a ferry was "at risk" (5 near-identical queue items, in UTC). The dataset
  itself says its road times "cannot be applied to the latest driver-app progress" as a terminal
  ETA. Now it only counts booked ferries ahead of us, and only raises "we can't confirm it makes
  check-in" when the position is stale and the cutoff is within 12 h. Local times, plain words.
- **Demo case vanished on fresh start:** saved runs now reload at startup, and the four committed
  example traces ended "done", so CD-420299 left the queue. Examples moved to `traces/examples/`
  (never loaded), live runs are local only.
- **README rewritten** to describe what exists. The old one described priced option cards, an
  evidence drawer and lock badges we do not have, invented savings figures, and skipped the API key.
- Flagged, not changed: `eval_agent.py` prints PASS without testing anything; the map's hubs,
  car counts and positions are made up and name real ferry companies.

## Four AI judges, ten rounds (Sun 25 Oct, from 03:00)
We set up four judge agents that score the product each round against Bahn's own rubric
(control room 40%, AI process 30%, taste 30%): Bahn's head of operations and a pitch judge
(business), an agent-systems engineer and a frontend engineer (technical). They see fresh
screenshots and read the code; we fix their top findings, then they judge again.

Before round 1 we simplified by hand: the overnight redesign had added KPI cards, tabs, a map
with made-up positions and a "cascade risk engine" that displayed pre-written agent activity and
invented percentages. We removed all of it.

- **Round 1 (avg 3.44):** all four found that the Autonomy dial could let the agent book, change
  dates and approve costs alone. Locked those to "ask a person" in the loop and the store, not just
  the page. Rewrote Settings in plain words. The phone "overflow" they saw was our screenshot tool
  (headless browsers won't go below 512px); we fixed the tool, not the app. Queue cards stopped
  claiming agent work that was not on the case page. Added a `grounded` eval check, which now fails
  the run we rejected for inventing a sailing. Deleted a log that put invented prompts in my name.
- **Round 2 (avg 3.70):** the ferry case still told two stories (proposal fixed, timeline not), and
  eight "not looked at yet" cards made the agent look idle. Instead of hiding that, we ran the real
  agent on those eight orders. Parallel runs hit OpenRouter's 20-requests-a-minute limit, so the
  client now retries with backoff. The "Ask the driver" dial row did nothing; it now really decides
  whether the agent may phone. Fact sources open on tap, not only on hover.
