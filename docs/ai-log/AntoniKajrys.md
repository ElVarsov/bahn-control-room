# AI Development Log: Antoni (@AntoniKajrys) - Lane B (Agent & Backend)

## 1. Initial Prompt & Research Direction
- **Goal**: Build the "On the road" Domino Rerouter and "Zero Dry Run" Pre-Flight Verifier agent loops.
- **Initial Prompt**:
  > *"Analyze the 100 orders and build an autonomous agent that queries ferry routes and automatically rebooks tickets and updates customers."*
- **Output Rejected**: The initial LLM tool loop created an automated handler that sent an outbound message directly to `Kavellora Car House` with a newly booked ferry ticket.
- **Why Rejected**: The brief explicitly prohibits autonomous customer contact: *"The agent never contacts a customer on its own. A customer is anyone who pays us."*
- **Override**: We implemented an architectural gate in `starter/lib/contracts/index.ts` and `starter/lib/world/store.ts`:
  - `message_customer` is hardcoded to `ask_first` autonomy.
  - The agent generates a staged `draftMessage` and queues it inside the `Proposal` object for human review.

## 2. Distinction between Quotes, Alerts, and Bookings
- **Challenge**: The LLM initially treated travel quote records in `travel_options.jsonl` as verified bookings.
- **Correction**: We enforced the `FactStrength` enum (`verified`, `reported`, `estimate`, `quote`).
- **Prompt Guardrail**: In the agent prompt and evaluation harness, quotes must always carry `quote` strength. Only gate observations or confirmation references receive `verified`.

## 3. Automated Eval Harness (`starter/scripts/eval_agent.py`)
- We ran a 10-order test suite checking:
  1. Customer Lock validation (0 unapproved customer messages).
  2. Cheap work executed first (reads, driver chats, and quotes queried before spending).
  3. Quantified decision proposals with calculated cost deltas (€) and delivery delay deltas (hours).

> Correction (Sun 25 Oct): the harness described above printed PASS without testing anything. It was replaced by real guardrail checks over agent traces; see `starter/scripts/eval_agent.py`.
