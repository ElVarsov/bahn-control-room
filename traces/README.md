# Agent traces

Every run of the road agent writes `run-<id>.json` here: the trigger, every tool call
and result, the driver call, the facts it noted (with strength and source record), its
proposals, the person's decision, what was carried out after approval, the model used
and token counts.

Kept from the first build session (24 Oct, Opus 5.5 via OpenRouter, about $0.25 a run):

| Trace | Order | What happened |
|---|---|---|
| `run-mvmm4qe8x1p.json` | CD-420299 ferry sold out | **First attempt, rejected by us.** The mock ferry search invented a 23 Oct 20:00 sailing the dataset does not have. We changed the search to use the dataset's own timetable. Also used UTC and "she". |
| `run-mvmm90c55l5.json` | CD-420299 | After the fix: uses the real sold-out and quoted sailings, local times, did **not** phone the driver because the conversation already had the answer, flagged the failed booking as unknown. |
| `run-mvmmb8xb0yn.json` | CD-420322 red warning light | Read the stale tracking, phoned the driver (simulated), marked the location unknown, handed the dealer call to a person with a call brief. The operator logged the dealer's answer and the agent told the driver. |
| `run-mvmmdu0s1jg.json` | CD-420299 | Proposal approved in the control room; booking carried out with a fictional reference. |

Run one yourself with the app running: `cd starter && npm run agent -- CD-420322`.
