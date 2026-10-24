# Plan: two people, two agents, full parallel

Deadline: **Sunday 25 Oct 15:00** (demo video + public repo).
Product choice and reasoning: `docs/IDEAS.md`.
Shared contract: `starter/lib/contracts/index.ts` + `starter/lib/contracts/fixtures/`.

## The one rule that makes parallel work possible

We never wait on each other. The **contract** (types + API shapes + fixtures) is
the only thing we share. The UI lane builds against fixtures; the agent lane
builds against a CLI and fixtures. We plug them together at fixed checkpoints.

- Changing the contract = a small PR titled `contract: ...`, the other person
  approves within 15 minutes. Add fields, avoid renaming.
- Each lane owns its folders. Do not edit the other lane's folders; open an
  issue or ping instead.
- Each person runs their own coding agent in their own branch (or git worktree).
  Merge to `main` through short PRs, several times a day.

## Lanes and ownership

| | **Lane A: Control room (UI)** | **Lane B: Agent + backend** |
|---|---|---|
| Person | Ignacio (@ElVarsov) | Antoni (@AntoniKajrys) |
| Owns | `starter/app/(pages and components)`, `starter/app/globals.css`, `starter/lib/present/` | `starter/lib/agent/`, `starter/lib/world/` (mocks), `starter/app/api/queue`, `starter/app/api/agent/`, `starter/app/api/proposals/`, `starter/app/api/settings/`, `starter/app/api/orders/[id]/case`, new DB tables, `traces/`, `scripts/agent-*` |
| Shared (PR + review) | `starter/lib/contracts/`, `starter/package.json`, `README.md`, `CLAUDE.md` | same |
| Branch prefix | `ui/...` | `agent/...` |

Lane B should put any new tables in their own file (`starter/lib/agent/schema.ts`)
so `db:seed` keeps working (see `starter/README.md`: reseeding refuses to drop
tables with foreign keys to starter data).

## Lane A: Control room

Goal: a non-engineer opens it and in 5 seconds knows what needs them and what to do.

1. **Design pass** (first 2 h): calm visual system on top of the starter's
   colours and fonts. Tokens, type scale, chips for fact strength
   (verified / reported / estimate / quote / unknown), source chip, urgency pill.
2. **Queue page** (`/`): replaces the lane board. Reads `QueueResponse`.
   Ranked decisions, one sentence each, decide-by time, agent state. "Running
   quietly" collapsed line with a peek. Keyboard J/K/Enter.
3. **Case page** (`/orders/[id]`): reads `CaseView`. Headline → what the agent did →
   the decision (before/after diff, draft message, Approve / Change / Reject /
   "Tell the agent instead") → facts with sources → timeline with internal vs
   public clearly separated. After approving: show `whatHappensNext` and the new
   state, never a dead end.
4. **Agent panel**: on the case page, a chat with the agent and a live trace
   (streamed `TraceStep`s) in plain language: "Asked the driver if they are safe".
5. **Trust dial** settings page: per `ActionKind`, ask first / do and tell / do
   quietly; `message_customer` locked to ask first.
6. **Empty, loading and error states** everywhere. Test with the full 100 orders.
7. Stretch: scale strip of stages, inbox reconciliation view, Cmd-K search.

Works without Lane B by reading `starter/lib/contracts/fixtures/*.json` behind a
tiny `lib/present/api.ts` client with one switch: `USE_FIXTURES=1`.

## Lane B: Agent ("On the road")

Goal: a real LLM loop with tools that does cheap work first and stops with a
clear proposal or a handover.

1. **World mocks** (`lib/world/`): read-only accessors over the dataset (order,
   active plan, assignment, alerts, messages, tracking, reservations vs quotes),
   plus fakes: ferry search and prices, hotel search, terminal road times,
   **simulated driver** (an LLM persona seeded from the driver's real messages,
   replies through `message_in` with `simulated: true`).
2. **Agent loop** (`lib/agent/`): Claude API tool use (model `claude-sonnet-5-5`,
   or `claude-opus-5-5` for the demo). Tools tagged `free` or `needs_approval`.
   `needs_approval` tools never execute; they create a `Proposal`. Hard block on
   any customer contact outside a proposal. Every step appended to `AgentRun.steps`.
3. **Approval gate + execution**: `POST /api/proposals/:id/decision` → if
   approved, execute against the mock world, write an operational event, continue
   the run. Respect `RECHECK_CURRENT_STATE_BEFORE_WRITE`.
4. **Queue builder** (`GET /api/queue`): derive `QueueItem`s from open proposals,
   alerts, incidents, open work items and agent runs in `needs_person`; rank by
   decide-by. Everything else counts as quiet. Reuse `lib/present/attention.ts`.
5. **Case builder** (`GET /api/orders/:id/case`): facts with `SourceRef`s and
   strength, mapped from dataset rows (quote vs reservation, reported vs
   verified).
6. **CLI + scenarios** (`npm run agent -- CD-420299`): run without the UI.
   Three scripted scenarios (ferry sold out, safety stop, tracking gap) saved as
   JSON traces in `traces/`. These double as tests and demo backup.
7. Stretch: autonomy settings honoured by the loop, retry-later scheduling,
   phone-call mock for pickup readiness.

## Checkpoints (both of us, 15 min each)

| When | What |
|---|---|
| Sat 24 Oct, kickoff + 1 h | Contract frozen v1. Repo runs for both. Lanes start. |
| Sat ~18:00 | **Plug-in 1**: UI switches `/api/queue` and `/case` from fixtures to real routes. Fix contract mismatches. |
| Sat ~23:00 | **Plug-in 2**: approve/reject from the UI drives the real agent; live trace streams. |
| Sun 10:00 | Feature freeze. Only polish, bugs, README, traces. |
| Sun 12:00 | Record demo video (script in `docs/DEMO.md`, written by Lane A). |
| Sun 14:00 | Repo public, fresh-clone test of README steps, submit. |

## Shared deliverables
- `README.md`: run steps from a fresh clone (Lane B writes setup, Lane A writes product section).
- `docs/ai-log/<name>.md`: each person logs prompts, rejected outputs, overrides. 30% of the score.
- `docs/DEMO.md`: 2–3 min script: problem (20 s), queue (30 s), CD-420299 decision live (60 s), safety stop handover (20 s), how we built it with agents (40 s).

## How to run your own agent in parallel
- Each person: `git worktree add ../bcr-ui ui/queue` (or a plain clone) so your
  agent never touches the other lane's working tree.
- Start each session with: "Read CLAUDE.md, docs/PLAN.md, and the contract. You
  are Lane A/B. Stay inside your folders."
- Small PRs into `main`; rebase often; never force-push `main`.
