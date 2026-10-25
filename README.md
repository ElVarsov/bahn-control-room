# Bahn Car Delivery Control Room

Our entry for Bahn's challenge at the Prompt Operations Hackathon, 24–25 October 2026.
Team: Ignacio ([@ElVarsov](https://github.com/ElVarsov)) and Antoni ([@AntoniKajrys](https://github.com/AntoniKajrys)).

A control room where people and agents work together to get every car delivered.
It opens on **only the orders that need a person**, each written as the decision to
make. Behind it, a **road agent** (Claude, in a tool-use loop) reads the order, phones
the driver when the records cannot answer, writes down what it found with the source
of every fact, and brings a person one clear proposal. Nothing that changes a booking,
a date, a cost or what a customer hears happens without a person's yes.

Everything in the data is fictional (Bahn's packet: 100 orders, `dataset/`). The brief
is in [`PARTICIPANT-BRIEF.md`](./PARTICIPANT-BRIEF.md).

---

## What is in it

### The control room (`starter/app`)
- **Needs you (`/`)**: decisions grouped as *Right now / Today / Soon*, each with a
  deadline ("in 15 min", "2 min overdue"), why it is here and what the agent already
  did. Work the agents are doing alone sits in a calm *Agents are on it* list; the rest
  is one line, *N orders running quietly*. Keys: `J`/`K` to move, `Enter` to open.
- **Case page (`/orders/[id]`)**: the decision first (what changes, *now → after*, the
  exact message a customer would get, *what happens next*), then *what the agent
  already did* as a short story, *what we know* with every fact marked **Verified /
  Reported / Estimate / Quote / Not known** and its source record, and *who said what*
  with Bahn-only notes kept visibly apart. Approve, change, reject, or tell the agent
  something else. **Ask the agent to work on this** starts the road agent on any order
  and the page updates live while it works.
- **All orders (`/board`)**, **Inbox**, **Customers / Drivers / Places**: the starter's
  views, kept for depth.
- **Autonomy dial (`/settings`)**: what the agent may do without asking (asking the driver
  or a site, looking up travel, closing an alert). Bookings, date changes, costs, customer
  messages and handovers always ask a person first; that is enforced on the server, not
  just in the page.

### The road agent (`starter/lib/agent`)
A Claude tool-use loop for one order at a time:
1. **Reads first**: order, conversation, open issues, tracking (with how old it is),
   travel (bookings kept apart from quotes).
2. **Asks only when needed**: `call_driver` rings the real driver phone if that driver's
   app is open, otherwise a simulated driver answers from their own messages in the data.
3. **Writes facts** with strength and source record.
4. **Proposes, never acts**: bookings, date changes, costs, customer messages and calls
   to customers become proposals for a person.
5. **Stops** with a queue headline, urgency and deadline.

After a decision: approve carries it out against a mock world (fictional booking
references, a provider check first if an earlier attempt failed); reject changes
nothing; instructions start a new run; a logged call answer starts a follow-up run.
A newer run supersedes older open proposals. Every run is saved as a trace
(`traces/run-<id>.json`, local only); four examples with notes are in
[`traces/examples/`](./traces/examples/README.md).

A **journey monitor** (`lib/agent/monitor.ts`) checks moving cars against their
delivery promise and booked ferries and adds *forecasts* to the queue, always marked as
estimates. **Driver call-ins** start an agent run too.

### Phone calls (`starter/lib/voice`, `/driver`)
- **The agent phones the driver**: the driver page on a phone rings full-screen; the
  in-call agent asks its questions by voice (browser speech, free) and hands back a
  transcript and facts marked *reported by the driver*.
- **The driver calls Bahn**: a *Call Bahn* button; the agent answers, works out which of
  the driver's jobs it is about, and the report lands in *Needs you* within seconds.
- If the AI is unavailable, a **scripted backup** takes the call and is labelled as
  scripted everywhere (phone, transcript, queue, trace). Details: [`docs/VOICE.md`](./docs/VOICE.md).

---

## Run it from a fresh clone

You need **Node.js 24+**. No database is needed for the control room, the agent or calls.

```sh
git clone https://github.com/ElVarsov/bahn-control-room.git
cd bahn-control-room/starter
npm ci
cp .env.example .env
```

Put a Claude key in `starter/.env`. Either an Anthropic key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

or OpenRouter (what we used):

```
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://openrouter.ai/api
ANTHROPIC_AUTH_TOKEN=sk-or-...
AGENT_MODEL=anthropic/claude-opus-5.5
VOICE_MODEL=anthropic/claude-haiku-5.5
```

Then start it and open http://localhost:3000:

```sh
npm run dev
```

Without a key the pages work, the agent cannot run, and calls use the labelled
scripted backup. A road-agent run costs about $0.25 on Opus 5.5.

> **Antivirus HTTPS scanning** (we hit this with Norton): if calls to Claude fail with a
> certificate error, start the server with `NODE_USE_SYSTEM_CA=1`
> (PowerShell: `$env:NODE_USE_SYSTEM_CA = '1'; npm run dev`).

### Try the agent
- Open **`/orders/ord-00322`** (Bentley stopped with a red warning light) or
  **`/orders/ord-00299`** (ferry sold out) and press **Ask the agent to work on this**.
- Or from a terminal while the app runs: `npm run agent -- CD-420322`
  (`--phone` always rings the phone, `--simulated` never does).

### Take a call on your phone
The microphone needs HTTPS, so open the app on the phone through a free tunnel:

```sh
cloudflared tunnel --url http://localhost:3000
```

On the phone open `https://<tunnel>/driver?d=drv-319` (the Bentley's driver) and tap
**Go on shift**, then run the agent on CD-420322: the phone rings. Or tap **Call Bahn**
on the phone to report something. Android Chrome works best; allow the microphone.

### Optional: the starter's database views
The *full order record* (`/orders/[id]/record`) and its attachments read the starter's
Postgres and attachment store; everything else works without them. To use them, start Docker and follow [`starter/README.md`](./starter/README.md)
(`docker compose up -d --wait`, `npm run db:push`, `npm run db:seed`, `npm run attachments:seed`).

### Settings in `starter/.env`
| Setting | Meaning |
|---|---|
| `USE_FIXTURES` | `1` (default): the queue starts from hand-checked sample cases, all matching the dataset. `0`: read the agent store. Agent runs and calls always join live. |
| `AGENT_MODEL`, `VOICE_MODEL` | Models for the road agent and the in-call agent. |
| `NTFY_TOPIC`, `PUBLIC_URL` | Optional lock-screen push for incoming calls ([ntfy](https://ntfy.sh)). |

---

## How we built it

Two people, each with a coding agent (Claude Code), working in parallel lanes against a
shared typed contract (`starter/lib/contracts/index.ts`) with fixtures, so neither had to
wait for the other. What we asked for, what we checked, what we threw away and where we
did not take the first answer:

- [`docs/ai-log/ignacio.md`](./docs/ai-log/ignacio.md), [`docs/ai-log/antoni.md`](./docs/ai-log/antoni.md), [`BUILD-LOG.md`](./BUILD-LOG.md)
- [`traces/examples/`](./traces/examples/README.md): real agent runs, including the first one we rejected
- [`docs/IDEAS.md`](./docs/IDEAS.md), [`docs/PLAN.md`](./docs/PLAN.md), [`docs/VOICE.md`](./docs/VOICE.md)

## Repository map
| Path | What |
|---|---|
| `starter/app` | Pages: queue, case, driver phone, settings, starter views |
| `starter/lib/agent` | Road agent loop, tools, decisions, monitor, run store |
| `starter/lib/voice` | Calls: call store, in-call agent, driver presence |
| `starter/lib/present` | Read layer for the pages (`source.ts` decides where data comes from) |
| `starter/lib/contracts` | Shared types and sample fixtures |
| `dataset/`, `attachments/` | Bahn's fictional packet |
