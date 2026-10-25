# Agent traces (examples)

Every run of the road agent writes `traces/run-<id>.json`: the trigger, every tool call
and result, the driver call, the facts it noted (with strength and source record), its
proposals, the person's decision, what was carried out after approval, the model used
and token counts. Those live files are reloaded when the app restarts and are not
committed, so a fresh clone starts with a clean queue. The four below are kept as
examples and are never loaded into the app.

Kept from the first build session (24 Oct, Opus 5.5 via OpenRouter, about $0.25 a run):

| Trace | Order | What happened |
|---|---|---|
| `rejected/run-mvmm4qe8x1p.json` | CD-420299 ferry sold out | **First attempt, rejected by us.** The mock ferry search invented a 23 Oct 20:00 sailing the dataset does not have. We changed the search to use the dataset's own timetable. Also used UTC and "she". |
| `run-mvmm90c55l5.json` | CD-420299 | After the fix: uses the real sold-out and quoted sailings, local times, did **not** phone the driver because the conversation already had the answer, flagged the failed booking as unknown. |
| `run-mvmmb8xb0yn.json` | CD-420322 red warning light | Read the stale tracking, phoned the driver (simulated), marked the location unknown, handed the dealer call to a person with a call brief. The operator logged the dealer's answer and the agent told the driver. |
| `run-mvmmdu0s1jg.json` | CD-420299 | Proposal approved in the control room; booking carried out with a fictional reference. |
| `rejected/run-mvn3ijhi2y3-double-booked.json` | CD-420299 | **Our bug, caught by the judges (25 Oct, round 7).** Approving the same proposal twice carried it out twice: two ferries, two hotels, two cost steps. Every check passed it. Fixed with a guard (a decided proposal is never carried out again; the API answers 409) and a new check, `once_per_yes`, which fails this trace. |
| `rejected/run-mvno42zlb5g-wrong-time.json` | CD-420299 | **Our miss, caught by the judges (round 10).** A rerun put the 27 Oct delivery promise at 14:00-16:00 Helsinki; the record (11:00-13:00 UTC, after the clock change) is 13:00-15:00. We had called it a fix. Fails `times_match` (and `quote_not_booking`: a "sold out" check marked verified). |
| `run-mvnobwngypa-approved.json` | CD-420299 | A later run of the same case (rerun 25 Oct so every fact cites its real table), approved after the fix, approved twice on purpose: the second request was refused. One provider check, one ferry and one hotel, each with its own fictional reference, the driver told both. |

Run one yourself with the app running: `cd starter && npm run agent -- CD-420322`.

Guardrail checks over these traces: `python starter/scripts/eval_agent.py` (all pass) and
`python starter/scripts/eval_agent.py traces/examples/rejected/run-mvmm4qe8x1p.json`, which
fails the `grounded` check because the run cited a ferry quote that does not exist, and
`python starter/scripts/eval_agent.py traces/examples/rejected/run-mvn3ijhi2y3-double-booked.json`,
which fails `once_per_yes`.
