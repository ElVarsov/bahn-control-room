# Team context for coding agents

We are building Bahn's **Car Delivery Control Room** for the Prompt Operations
Hackathon (deadline Sun 25 Oct 2026, 15:00). Two people work in parallel, each
with their own coding agent.

## Read first
1. `PARTICIPANT-BRIEF.md`: what to build and how it is judged.
2. `OPERATIONS-CONTEXT.md` and `dataset/SCHEMA.md`: the world and its traps.
3. `docs/IDEAS.md`: what we chose. `docs/PLAN.md`: who owns what.
4. `starter/lib/contracts/index.ts`: the shared types and API. The only coupling between lanes.

## Lanes
- **Lane A (UI)**: `starter/app/**` pages/components, `globals.css`, `starter/lib/present/`.
- **Lane B (agent)**: `starter/lib/agent/`, `starter/lib/world/`, API routes for queue, case, agent, proposals, settings, `traces/`.
- Stay inside your lane. `starter/lib/contracts/` changes only through a `contract:` PR.

## Rules of the world (do not break)
- The agent **never contacts a customer on its own**. Customer messages are proposals.
- Anything that changes a booking, a date, a cost, or messages a customer needs a person's yes first. Reading, asking drivers/sites and looking things up need none.
- A quote is not a booking. An alert is not a diagnosis. A driver message is not a location fix. A CMR `SIGNED` is often pickup only. Show the source and strength of every fact.
- Everything is fictional. No real people, messages or bookings.
- The UI is for operations people, not engineers: plain words, no raw codes, no JSON on screen.

## Practical
- Next.js in `starter/` is a newer version than you know: read `starter/AGENTS.md` and `node_modules/next/dist/docs/` before writing Next code.
- Run: see `starter/README.md`. Snapshot time is `2026-10-21T09:00:00Z`; use it as "now", not the real clock.
- Put new DB tables in `starter/lib/agent/schema.ts`, never with foreign keys onto seed tables.
- Log notable prompts, rejected outputs and overrides in `docs/ai-log/<name>.md` as you go.
