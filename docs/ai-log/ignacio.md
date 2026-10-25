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
- **Round 3 (avg 3.74):** showing real agent output raised trust but cost taste: 5–7-line summaries,
  five time zones on one screen, steps stamped with the real 03:20 clock under 11:58 messages, the
  first thought labelled "Why it stopped here", and "1 open alert(s)". We fixed the display (snapshot
  clock, labels, plurals, word-boundary cuts, two-line cards) and the cause: the agent now writes a
  12-word headline, a one-sentence summary and every time in Helsinki time, and we reran all ten seed
  runs. A new eval check, `strength_honest`, fails "verified" facts that predict the future; it
  caught one in our own seed. Sample "agents are working" items with no run behind them were removed,
  and forecasts are labelled as the monitor watching, not as agent work.

## Judge round 4 (avg 4.00)
Judges found a run that ended "waiting for a reply" with a pending proposal, so a yes it needed never
reached Needs you. The loop now forces needs_person whenever a proposal is pending and a new eval
check, pending_surfaces, proves it. One judge said CD-420299 should arrive 19:00 Helsinki time; we did
not take that: 25 Oct 2026 is the night EU clocks go back, so 18:00 was right. We still moved time
conversion out of the model into the tools so it can never get it wrong. Added elapsed step times,
stripped record ids from change rows, and rendered the call brief as numbered questions.

## Judge round 5 (avg 4.09)
All four judges flagged the same regression from round 4: the "Noted" timeline steps repeated the
facts panel word for word. Folded them into one line. T1 caught that the simulated driver invented a
service-area name that then read as a real fact; we now give the simulator its booked travel, forbid
invented details, and label every simulated call and its facts as demo stand-ins. Reran 322, 449
and 399 (399 twice: the first rerun named the decision in the headline but still only proposed the
holding message, so the rule was tightened to require proposing the decision itself). Added
not-found/error/loading pages and a decided-state card showing what the agent did after the yes.

## Judge round 6 (avg 4.09)
The new "decided" view exposed contradictions: after approving the ferry, What we know still said
"nothing is booked", the headline was still a question, and the result was one semicolon dump shown
twice. Bookings now produce one line per item with their own fictional references, a verified
booking fact, and the overtaken facts folded under "Before your yes". Judges also caught "seed run
for the demo" (our own CLI trigger) on ops screens and a Hamburg customer brief in Helsinki time;
reran three cases with real triggers and added an eval check, customer_clock, which failed the old
322 seed before the rerun. The eval then caught our own change: logging the approved total as a
cost step looked like a cost change without a yes. We allowed it only when the approved proposal
listed that cost, rather than dropping the check.

## Judge round 7 (avg 3.74, down from 4.09)
The score dropped because the judges found a real bug in our own showcase screenshot: approving the
same proposal twice carried it out twice (two ferries, two hotels). We had taken two decided
screenshots in one server session and did not look closely; all twelve checks passed the trace.
Fixed at the cause (a decided proposal is never carried out again, the API answers 409, the button
ignores a second click), added `once_per_yes` to the eval, and committed the double-booked trace as
a rejected example that the new check fails. Lesson: a screenshot is evidence too; read it like a trace.

## Judge round 8 (avg 4.24)
Back up after the fix. Technical judges pushed further on the yes gate: the approver's name came
from the browser, so the eval's "a person approved" test trusted a client string. The server now
stamps who and when and refuses dial claims, with a self-test case. The store's second decision
path got the same once-only guard, and the double-booking check now reads the FAILED attempt from
the records instead of matching fact wording. Business judges asked for the button to state the
cost, a second click on Reject, deadline-driven colour (red only within 30 minutes) and a demo
script that never claims on camera what the screen does not show.

## Judge round 9 (avg 4.48)
Three judges caught the same mislabel: CD-420399 said "Approve here" while its real job was a call
(the tag came from an optional holding message). The tag now follows the main decision. T1 asked
for a provenance check; our first version failed ten runs, but almost all on general names like
"tracking". We narrowed it to the real error (naming a different real table), which left exactly
the one mislabel the judge found, then fixed the cause: the loop now takes the table from the record
id instead of the model. The CD-420299 rerun also quietly corrected a time the old seed had wrong
(the 27 Oct promise after the clock change).
