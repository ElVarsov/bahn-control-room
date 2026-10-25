# Demo script (2 min 45 s)

Two voices: **A** drives the laptop, **B** holds the phone and plays the driver.
The script follows the brief in its own order: the control room, one real agent ("On the
road"), the rules of the game, then how we built it. Spoken text is about 400 words, which
fits 2:45 at a calm pace with the live call. Lines in *italics* are actions, not words.

| Time | Screen | What it proves (brief / rubric) |
|---|---|---|
| 0:00–0:12 | Needs you | The stakes |
| 0:12–0:35 | Needs you | Shows the orders that need a person, says why, keeps the rest out of the way |
| 0:35–1:20 | CD-420322 + phone | An order in a few seconds; one real agent that does the cheap work first and talks to the driver |
| 1:20–1:45 | CD-420299 | A person's yes before a booking or a cost; clear what happens next |
| 1:45–2:00 | Phone, then Needs you | The driver talks to the agent; the operator steers it |
| 2:00–2:10 | Autonomy dial | The rules: never a customer, never a change, without a person |
| 2:10–2:45 | Code, screenshots, terminal | How we worked with AI: we checked, iterated, and guard every run |

## Before you press record

1. In `starter/`: `npm run demo:reset`, then make sure the old server is really stopped
   (Ctrl-C in its terminal), then `$env:NODE_USE_SYSTEM_CA = '1'; npm run dev`. CD-420299 must
   show **Approve and book · €490**, and Needs you must show **8**.
2. `cloudflared tunnel --url http://localhost:3000`; on the phone open
   `https://<tunnel>/driver?d=drv-319` (Kasper, the Bentley's driver) and tap **Go on shift** so
   the microphone is allowed. Leave it open.
3. Laptop tabs, in this order: `/`, `/orders/ord-00322`, `/orders/ord-00299`, `/settings`.
   A terminal at the repo root, font large. `docs/screens/queue-round-01.png` and `docs/screens/queue-final.png` open side by side.
4. Browser at 1440 px wide, zoom 100%, notifications off, phone volume up. Make one test call.
5. **Record the 0:35–1:20 live run once on its own first.** A live model run words things a
   little differently every time, and a call can fail. If the phone does not ring within about
   10 seconds in the main take, cut to the recorded take and say "here the driver is simulated".
6. After that rehearsal, repeat step 1 so CD-420299 is undecided again.

## The script

### 0:00–0:12 · The stakes *(Needs you)*
**A:** "A ferry sells out overnight, nobody notices, and a dealer in Helsinki misses a delivery.
Bahn moves 25,000 cars a year with about 50 people. This is their control room."

### 0:12–0:35 · Only what needs a person *(Needs you)*
**A:** "Agents work every order. A person sees only what needs a human: eight out of about a
hundred." *Point at the 8 and at "83 running quietly".*

"Each card is a decision with its reason. 'Call needed' means you phone someone"
*(point at CD-420322)*, "'Approve here' is one click" *(point at CD-420299)*. "Red means decide
within half an hour. 'On watch' is what the agents are waiting on."

*Open CD-420322.*

### 0:35–1:20 · One real agent, on the road *(CD-420322 + phone)*
**A:** "A Bentley stopped with a red warning. You see who said what and when"
*(point at Who said what)*, "what we know and how sure we are" *(point at What we know)*,
"and the next decision. Let's have the agent look again." *Click **Ask the agent to look again**.*

"Cheap work first: the order, the chat, alerts, tracking, travel. Then it phones the driver."

*The phone rings. B answers on speaker.*

**Agent (phone):** asks whether they are safe and exactly where they are.
**B (as Kasper):** "I'm safe, parked at a service area, engine off. I'll send you a pin."

**A** *(as the run finishes)*: "The driver's words come back 'Reported', the location still
'Not known': a driver's word is not a location fix. Every fact links to its record. And the
agent never contacts a customer itself, so it hands a person this call brief."

### 1:20–1:45 · A person says yes *(CD-420299)*
*Open CD-420299.*
**A:** "Bookings, dates, costs and customer messages always wait for a person. The ferry is sold
out; the agent compared sailings and hotels and proposes one plan, with what changes and what
happens next." *Click **Approve and book · €490**.*

"An earlier attempt failed, so it checks that first, then books and tells the driver."
*Zoom for 2 s on "Approved by you at 12:00".* "And the record says who decided."
*Click **Back to Needs you**: the queue shows 7.*

### 1:45–2:00 · Talking to the agent *(phone, then Needs you)*
**B** taps **Call Bahn**: "Hi, it's Kasper on the Bentley. I've sent the pin, and the warning
light is flashing now."

**A:** "Drivers talk to the agent by voice, and the report lands here as 'Driver called in'.
Operators steer it in plain words: 'Tell the agent something else'." *Show the new card.*

### 2:00–2:10 · The rules *(Autonomy dial)*
*Open `/settings`.*
**A:** "Phoning a driver is free. Bookings, times, costs, customer messages: always 'Ask me
first', enforced on the server, not just on this page."

### 2:10–2:45 · How we built it *(every claim on screen)*
**B:** "Two of us, each with Claude Code, in parallel lanes joined by one contract file."
*Screen: `starter/lib/contracts/index.ts`, 2 s.*

"We didn't trust the first answer. Four AI judges, two business and two technical, scored us on
Bahn's own rubric for ten rounds, and the score went from 3.4 up to 4.5. Round one: eleven cards,
mostly hand-written. Now: eight, every one a real agent run."
*Screen: `docs/screens/queue-round-01.png` next to `queue-final.png`.*

"And we don't trust the agent blindly either. Every run passes fifteen safety checks. Approve
twice, and it still books once." *Terminal:*
`python starter/scripts/eval_agent.py traces/examples/rejected/run-mvn3ijhi2y3-double-booked.json`
*→ "once_per_yes: … booked 2 times": the check stops it.*

"A time an hour off after the clock change: caught before any customer sees it."
*Terminal:* `python starter/scripts/eval_agent.py traces/examples/rejected/run-mvno42zlb5g-wrong-time.json`
*→ "times_match: says 27 Oct 14:00-16:00; the record says 13:00-15:00".*

**A:** "We cut a map and KPI tiles that looked good but weren't true. Agents do the legwork,
people make the calls, and every fact shows where it came from. That's the Bahn control room."

## Numbers on screen (check right before the main take)

- Needs you **8**, running quietly **83**; after approving CD-420299: **7** and **84**.
- `python starter/scripts/eval_agent.py` → **14/14 runs pass all 15 checks**;
  `--self-test` → **16/16 caught**.
- Judges, average per round out of 5: 3.44 · 3.70 · 3.74 · 4.00 · 4.09 · 4.09 · 3.74 · 4.24 ·
  4.48 · 4.29 (say "from 3.4 up to 4.5"; the peak was 4.48 in round 9).

## If the live parts fail

- **No ring within ~10 s:** cut to the pre-recorded take of 0:35–1:20 and say "here the driver is
  simulated". The committed run on this case is a real agent run with the simulated driver
  labelled "demo stand-in".
- **Speech fails on the phone:** skip 1:45–2:00 and say the line about steering the agent over the
  queue instead; the voice path is described in `docs/VOICE.md`.
- **Never** say a call happened if it did not, and never read out a number the screen does not show.
