# Ideas

What we could build for the Bahn Car Delivery Control Room, and what we picked.
Scoring reminder: control room 40%, how we worked with AI 30%, taste 30%.

## What the judges actually reward

Read straight from `PARTICIPANT-BRIEF.md`:

1. **Only the orders that need a person**, with just enough to decide.
2. **Every fact shows where it came from** (who said it, when, through which channel).
3. **The agent does cheap work first**, knows when to stop, and hands over what it found.
4. **After a decision it is obvious what happens next.**
5. Looks made with care, readable by a non-engineer, calm at hundreds of orders.
6. A visible story of how we used coding agents: what we asked, checked, threw away.

The dataset is built to trap naive tools: a quote is not a booking, an alert is
not a diagnosis, a driver message is not a location fix, a CMR "SIGNED" is often
pickup-only. Getting those distinctions right *in the UI* is a cheap way to look
smarter than other teams.

## Control room concepts

### A. Decision queue instead of lanes (recommended)
The home screen is not orders, it is **decisions**. Each row is one thing a person
must decide, written as a sentence: "Approve a later ferry for CD-420299 and ask
the dealer to accept delivery on 28 Oct?" Ranked by what breaks first (deadline
minus time needed to act). Everything else collapses into one calm line:
"86 orders running quietly. Agents are watching them." with a peek list.

### B. Case page as a story, not a form
Opening an order shows, top to bottom:
- **Headline**: what is wrong in one sentence, in plain words.
- **What the agent already did**: a short checklist ("Asked the driver: safe, at
  service area A7 km 212 · Driver app 08:41"; "Checked 3 sailings · quotes, not
  bookings").
- **The decision**: proposed change as a before/after diff (date, cost, booking,
  message), with Approve / Change / Reject and a free text "tell the agent instead".
- **Facts with sources**: every fact a chip with source + time + strength
  (verified / reported / estimate / quote). Hover shows the raw record.
- **Timeline**: who said what and when, people and agents in one stream, with
  internal notes visually distinct from what the customer actually saw.

### C. Trust dial (autonomy that can grow)
Per action type (ask driver, refresh quote, book ferry, change date, message
customer) a setting: *Ask me first* / *Do it and tell me* / *Do it quietly*.
Customer contact is locked to *Ask me first* (rule of the game). Shows judges we
designed for "more freedom later as it earns trust".

### D. Handover cards
When a person needs to take over (call the dealer), the agent produces a
one-screen brief: who to call, number, what to ask, what we already know, what
answer changes what. After the call the person types the outcome in one line and
the agent continues from it.

### E. Quiet-orders proof
A small "why is this quiet?" explainer per order: which records were checked
(alerts, threads, proofs, tracking freshness) and when. Turns "nothing to show"
into trust instead of doubt. Good empty state.

### F. Scale view
A compact strip of all orders by stage with counts and how many need a person,
so the queue never hides the size of the operation. No kanban.

## Agent area options

| Area | Data in the packet | Demo wow | Risk in 30 h | Verdict |
|---|---|---|---|---|
| **On the road** (breakdowns, missed ferry, delays) | SAFETY_STOP, FERRY_SOLD_OUT, FERRY_CONNECTION_RISK, TRACKING_GAP, 37 travel options, 25 reservations, terminals, road estimates | High: the brief's own Bentley story | Medium | **Pick** |
| Driver travel planning | travel options, reservations, confirmations | High, browser booking | High (many mocks) | Fold into On the road as the rebooking tool |
| Pickup readiness by phone | site claims, release docs, endpoint details | Very high if voice works | High (telephony, TTS) | Stretch only |
| Driver support inbox | 62 conversations, inbox threads | Medium | Low | Fallback |

**Pick: "On the road" agent with ferry/travel rebooking as one of its tools.**
It matches the brief's worked example, it has the richest data, and it naturally
produces the decisions the control room is built to show (accept a delay, approve
a rebooking, approve a cost, approve a customer message).

### How the agent behaves (cheap first, then stop)
1. **Read** (free): order, active plan, assignment, alerts, latest messages,
   tracking freshness, reservations vs quotes.
2. **Ask** (free, allowed): message the driver (simulated driver replies), ask the
   pickup site. Never the customer.
3. **Look up** (free): ferry capacity and prices, terminal road time, hotels,
   driver rest rules (mocked).
4. **Decide what it cannot decide**: anything that changes a booking, a date, a
   cost or talks to a customer becomes a **proposal** with evidence and a diff.
5. **Stop** when the facts line up, when it is waiting on a reply (set a
   next-check time), or when it needs a person.

Every tool call is logged as a trace step with its inputs, outputs and the
records it cites, so the UI can show "what the agent did" and judges can read
the traces.

### Demo scenarios (all from the dataset)
- **CD-420299** ferry sold out, failed booking attempt, customer must approve a
  later date. Agent reconciles the failed booking, finds the next sailing, checks
  driver rest, proposes rebook + hotel + customer message draft.
- **SAFETY_STOP order** red warning light. Agent checks driver is safe, gets
  location and photo, looks up the car and promise, hands over "call the dealer:
  roadside or tow?".
- **TRACKING_GAP order** no recent position. Agent asks the driver before raising
  anything; resolves quietly if the driver answers. Shows *not* bothering a
  person.

## Things that make it feel made with care
- Plain language everywhere; no raw codes (`FERRY_SOLD_OUT` → "Ferry sold out").
- Times in the place's local zone with a relative phrase against snapshot time.
- One accent colour for "needs you", everything else muted.
- Loading skeletons and real empty states ("Nothing needs you right now").
- Keyboard: J/K through the queue, A to approve, E to edit.
- Agent voice is short and factual. No "I'd be happy to help".

## Process story (30%)
Each of us keeps `docs/ai-log/<name>.md`: prompts that worked, outputs we
rejected and why, places we overrode the agent. Commit agent traces from test
runs into `traces/`. The video spends ~40 s on this.
