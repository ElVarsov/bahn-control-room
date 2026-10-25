# Demo script (2 min 45 s)

Two voices: **A** drives the laptop, **B** holds the phone and plays the driver.
Record the laptop screen at 1440 px wide with the browser zoom at 100%; keep the phone in
frame (a second camera or a picture-in-picture of the phone screen).

## Before you press record

1. `starter/`: `$env:NODE_USE_SYSTEM_CA = '1'; npm run dev` (fresh start, so only the committed
   agent runs are loaded and nothing is decided yet).
2. `cloudflared tunnel --url http://localhost:3000`; on the phone open
   `https://<tunnel>/driver?d=drv-319` (Kasper, the Bentley's driver on CD-420322) and tap once so
   speech is allowed. Leave it open.
3. Laptop tabs, in order: `/` (Needs you), `/orders/ord-00322`, `/orders/ord-00299`, `/settings`.
4. Phone volume up. Laptop notifications off. Test one call before recording.
5. Backup if the tunnel or speech fails: the case pages already show real runs of the agent, with
   the simulated driver labelled as such. Say so on camera; do not pretend a call happened.
6. Record the 0:40–1:20 live run once as a separate take before the main recording. A live model
   run can word things differently from the screenshots; if the take goes wrong, cut to it.
7. After a rehearsal, reset with `npm run demo:reset` and restart the app, so CD-420299 is
   undecided again for the real take.

## The script

### 0:00–0:15 · The stakes (queue on screen)
**A:** "A ferry sells out overnight and nobody notices. Now a BMW sits in Leipzig, a driver waits
at the terminal, and a dealer in Helsinki misses a delivery. Bahn moves over 25,000 cars a year
with a team of about 50 people, so misses like that are what they fight every day. Our control
room lets AI agents work every order, and a person sees only the ones that need a human. Today
that is eight out of about a hundred."

*On screen: Needs you, 8 cards. Point at the count and the "83 running quietly" line.*

### 0:15–0:40 · One glance, one question (queue)
**A:** "Every card is a question, not an alert. 'Call the customer for the Bentley's recovery
decision?' It has a deadline, 'in 15 min', and one line on what the agent already did. The tag
says what it takes: 'Approve here' is one click, 'Call needed' means you phone someone. Red means
due within half an hour. Below, 'On watch': things the agents are waiting on, nothing for you to do."

*Hover the CD-420322 card, then scroll once to On watch. Open CD-420322.*

### 0:40–1:20 · The agent works the case, live (case 322 + phone)
**A:** "Let's ask the agent to look again." *Click **Ask the agent to look again**.*
"It reads the order, the chat, the alerts, the tracking and the travel first. Those are free.
Then it phones the driver."

*The phone rings. B answers on speaker.*

**Agent (phone):** asks whether they are safe and where exactly they are.
**B (as Kasper):** "I'm safe, parked at a service area, engine off. I'll send you a pin."

**A** *(back on the laptop as the run finishes)*: "Here's what it brings back. A call brief for
the customer with numbered questions and what not to agree to. Every fact with its strength:
'Reported' for what the driver said, 'Not known' for the exact location, because a driver's word
is not a location fix. Tap a source and you see the record it came from."

*Tap one source in What we know. Point at the run line, e.g. "5 checks, 1 driver call, took 41 s"
(the live numbers will differ slightly).*

### 1:20–1:50 · A person says yes, and sees what happened (case 299)
**A:** "Bookings, dates, costs and customer messages always wait for a person." *Open CD-420299.*
"The overnight ferry is sold out. The agent checked sailings and hotels and proposes the next-day
ferry plus a hotel night, €490. Now, After, and what happens next."

"The button says what you commit to: 'Approve and book, €490'." *Click it.*

"Because the records show an earlier booking attempt failed, it checks with the provider first,
then books the ferry and the hotel, each with its own reference, and tells the driver. Approved by
you, at 12:00. The facts that are no longer true move under 'Before your yes'. And behind this
button, a second request for the same yes is refused; our eval checks every run for it."
*Point at the five rows, then the facts panel. Click **Back to Needs you**: the queue is down to 7.*

### 1:50–2:05 · The driver calls in (phone)
**B** taps **Call Bahn** on the phone: "Hi, it's Kasper on the Bentley. I've sent the pin, and the
warning light is flashing now."

**A:** "The driver can call us too. The agent answers, works out which order it is about, and it
lands in Needs you as 'Driver called in' within seconds. What the driver said comes in as
'reported', not verified: a call is not a location fix." *Show the new card.*

*(Do not script anything the case has not decided yet, such as a tow arriving: the owner has
not chosen recovery, and the agent would rightly treat it as a conflict.)*

### 2:05–2:45 · How we built it (every claim gets a screen)
**A:** "Two of us built this in parallel with Claude Code, one on the screens and one on the
agent, joined only by a shared contract file." *Screen: `starter/lib/contracts/index.ts`, 2 s.*

**B:** "We didn't take the first answer. Four AI judges, two from the business side and two from
engineering, scored Bahn's own rubric over ten rounds with fresh screenshots each time."
*Screen: the round-1 queue screenshot next to today's (from `docs/ai-log/ignacio.md` scores).*

"They caught real problems. In round seven, a double booking in our own screenshot: approving
twice booked twice. We fixed it and wrote a check that fails that exact trace."
*Screen: terminal running
`python starter/scripts/eval_agent.py traces/examples/rejected/run-mvn3ijhi2y3-double-booked.json`
→ "once_per_yes: 'ferry' booked 2 times", 3 s.*

"And when a judge told us an arrival time was wrong, we checked: 25 October is the night clocks
go back, so we were right, and we kept it." *Screen: the "Judge round 4" paragraph in the ai-log.*

**A:** "We also threw away what looked impressive but wasn't true: a risk dashboard, a map and KPI
tiles with made-up numbers. Thirteen checks run over every committed agent run, and a self-test
plants one violation per check to prove each one can fail."
*Screen: `python starter/scripts/eval_agent.py --self-test` ending in "caught", 2 s.*

**A:** "Agents do the legwork, people make the calls, and every fact shows where it came from.
That's the Car Delivery Control Room."

## Numbers to say (check before recording)

- Needs you: 8 · running quietly: 83 (top of the queue page).
- Eval: `python starter/scripts/eval_agent.py` → all runs pass 13 checks;
  `--self-test` → 13/13 caught.
- Judges: average score from round 1 to round 10 (see `docs/ai-log/ignacio.md`).
- After approving CD-420299 the queue shows 7.
