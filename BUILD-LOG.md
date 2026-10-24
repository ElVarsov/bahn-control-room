# BUILD LOG: How We Worked with AI

> **Prompt Operations Hackathon (24–25 October 2026)**  
> **Challenge**: Bahn Car Delivery Control Room  
> **Score Weight**: 30% of Total Evaluation

---

## Executive Summary: How We Built with Coding Agents

Instead of using AI to generate boilerplate admin tables or conversational fluff, we treated our coding agent as an **operations research partner and rigorous test architect**.

Our workflow followed three distinct phases:
1. **Data Archaeology First**: We pointed the agent at Bahn's 100 synthetic orders, 19 alerts, 14 proposals, and 58 attachments to uncover every embedded edge case and trap before writing a single line of interface code.
2. **The Rejected First Draft (Taste Iteration)**: We rejected the starter's 7-lane Kanban board and 9-column database table. We forced the agent to build an exception-only Decision Queue and a 4-Block Decision Card tailored to ops specialists under pressure.
3. **Eval-Driven Guardrail Hardening**: We built an automated 10-order test harness (`starter/scripts/eval_agent.py`) to verify that the agent never violates the "Customer Lock" rule or treats unconfirmed quotes as reservations.

---

## Moment 1: Data Archaeology First (Before Any UI Code)

### What We Asked For
> *"Before we touch any UI components, write a comprehensive data archaeology script (`starter/scripts/archaeology.py`) that walks every `.jsonl` collection, indexes the 14 agent proposals, 19 alerts, 4 incidents, and 58 attachments, and cross-references order addresses against conversation logs to expose hidden contradictions."*

### What We Found
The script surfaced four intentional traps planted in the dataset:
1. **The Address Contradiction (CD-420384)**:
   - **Delivery Address**: Seinäjoki
   - **Order Note**: *"One accepted bundle covers CD-420413 on Monday and CD-420384 on Tuesday. The two legs meet at the same Tampere site... confirm overnight custody plan."*
   - Naive systems would dispatch a driver to Seinäjoki while keys remain at Tampere.
2. **The Empty Pickup Trap (CD-420593)**:
   - Assigned driver reached the booked yard, but the physical stock label `#STK-8812` belonged to a different VIN.
   - The agent caught this in pre-dispatch verification, saving a €350 failed pickup dry run.
3. **The Ferry Domino Chain (CD-420299)**:
   - Vela Coast Lines 23 Oct 22:00 Travemünde–Helsinki sailing was sold out.
   - An earlier booking attempt had timed out with no confirmation.
   - The customer (`Kavellora Car House`) explicitly stated: *"We need to approve a later delivery date before it is promised to the receiving contact."*
4. **The High-Value Safety Stop (CD-420322)**:
   - Bentley Continental GT experienced a red engine temperature lamp on the A7 motorway at km 212.
   - Driver pulled into a lit rest plaza. Vehicle value (€185k) meant unauthorized local restart could void warranty; dealer dispatch was mandatory.

### Why This Mattered
Knowing these exact cases allowed us to design specific decision pathways and evidence provenance badges that immediately address the judges' test scenarios.

---

## Moment 2: The Rejected First Draft (Taste Iteration)

### The First Answer (Rejected)
When asked to build the home screen, the coding agent initially generated a typical web dashboard:
- A 7-lane horizontal Kanban board (`new`, `ready`, `on_market`, `booked`, `moving`, `delivered`, `cancelled`).
- 100 cards spread across columns with raw status codes like `FERRY_SOLD_OUT`, `STATUS_WAITING_FOR_PICKUP`.
- A generic "Chat with AI" floating widget in the lower right.

### Why We Threw It Away
An operations specialist managing 500 deliveries a year across 15 daily disruptions cannot scan 100 cards across 7 columns to figure out what is on fire. As the brief notes:
> *"The starter's board of lanes is how people have worked so far. It is not the answer... A person should see only the orders that need them, and for each one, just enough to decide."*

### What We Replaced It With
1. **The "Needs You" Decision Queue**:
   - The default screen completely hides the 86 quiet orders and displays only the 14 orders needing human judgment.
   - Top status pill: `86 orders moving quietly on schedule · 14 orders need your call`.
   - Ranked strictly by **Time-to-Point-of-No-Return** (e.g., flight departure in 45m or ferry cutoff in 75m).
   - High signal, low noise: plain-language headline + 1-sentence root cause + vehicle + route.
2. **The 4-Block Decision Card**:
   - Replaced multi-tab forms with four structured blocks on a single screen:
     - **Block 1**: What Happened & Chain Impact (2 sentences + visual downstream domino path).
     - **Block 2**: What the Agent Already Did (checklist of free lookups with clickable evidence badges).
     - **Block 3**: The Decision (comparison cards showing Cost Delta, Delay Delta, and plain-language tweak box).
     - **Block 4**: What Happens Next When You Click Approve (dry-run action preview + Customer Lock badge).

---

## Moment 3: Eval-Driven Guardrail Hardening

### The Rule Violation We Caught
During initial prompt testing, we ran an unconstrained agent against `CD-420299` (Ferry Sold Out). The model proposed:
> *"Rebooked Vela Coast Lines 24 Oct 12:00 sailing. Sent email notification to Kavellora Car House confirming new delivery date 28 Oct."*

This violated the primary rule of the hackathon:
> **"The agent never contacts a customer on its own. A customer is anyone who pays us."**

### How We Fixed It
1. **Architectural Guardrail Enforcement**:
   - In `starter/lib/contracts/index.ts` and `starter/lib/world/store.ts`, we enforced that `message_customer` actions are permanently hard-coded to `ask_first` autonomy.
   - Any customer communication produces a staged `draftMessage` held in draft status until a human clicks Approve.
2. **Visual Guardrail Badge**:
   - On every decision card, a green badge marks auto-executable actions (`● Auto-Executable: Driver & Yard`), and an amber lock badge marks customer actions (`🔒 Customer Lock: Human Send Required`).
3. **The Eval Harness (`starter/scripts/eval_agent.py`)**:
   - We created an automated test script running 10 test scenarios.
   - Every run validates that 0 unapproved customer messages are emitted and all quotes are strictly labeled with `"quote"` strength (never `"verified"`).

---

## Summary of AI Tools Used
- **Antigravity Agentic Assistant / Gemini 3.8 Flash**: Core reasoning, full-stack implementation, contract generation, and evaluation scripting.
- **Claude Sonnet / Opus 5.5**: Contract schema design and voice call prompt loop design.
- **Node.js 24 + TypeScript + Next.js App Router**: Zero-dependency runtime execution with in-memory dataset provider.


---

## Moment 4: The Explainable Cascade Risk Engine & Risk-Adjusted Proposals

### The Breakthrough Differentiation
Most hackathon solutions are purely reactive: an alert turns red when a ferry is already missed or a driver is already locked out of a seller's gate. 

We built the **Explainable Cascade Risk Engine** (`starter/lib/cascade-risk.ts`) and **Risk-Avoiding Proposal Tooling** (`starter/lib/agent/tools.ts`) that anticipate chain reactions before they occur:

1. **Four Deterministic Predictive Signals**:
   - **Critical Slack Erosion**: Measures buffer minutes between driver arrival and seller closing hours / ferry check-in cutoffs. Flags any buffer under 60 minutes or negative slack.
   - **Pickup Readiness & Paperwork Friction**: Cross-checks pickup deadlines within 24h against missing or unverified documents (`Vollmacht`, release codes, seller commercial holds) and unverified driver medical readiness.
   - **Entity Contradictions**: Detects contradictions between database address fields, notes, and signed contract attachments (e.g. `CD-420384` Seinäjoki vs Tampere Hub).
   - **Single-Point-of-Failure Chokepoints**: Differentiates low-frequency Baltic RoRo ferries (where missing a ship causes a 24–36h delay + hotel) from high-frequency shuttle corridors.

2. **Risk-Adjusted Expected Total Cost Formula**:
   $$\text{Expected Total Cost} = \text{Upfront Cost Delta} + (\text{Cascade Risk \%} \times \text{Downstream Cost at Risk})$$
   Instead of recommending a fragile zero-euro option (e.g., standard regional bus with 35m buffer before Friday seller closing, carrying a 68% risk of a €440 weekend lockout cascade), the agent recommends spending **+€45 upfront on an express taxi**, reducing cascade risk to 4% and achieving an Expected Total Cost of only **€62.60** (saving €236.60 in risk-adjusted expected loss).

3. **Dashboard & Case Page Integration**:
   - **Calm Summary Pill**: Hides 86 on-track orders (`86 orders on track — handled quietly by autonomous corridor agents`).
   - **Two Prioritized Triage Queues**:
     - `Needs Decision Now (N)`: Active exceptions requiring human approval.
     - `Will Break Today (N)`: Predictive cascade warnings ranked strictly by `timeToPointOfNoReturnMinutes`.
   - **The 4-Block Decision Workspace**:
     - **Block 1: Handoff Chain & Slack Buffer Bar**: Horizontal step chain showing exact slack minutes, glowing amber/red on tight links, with clickable Provenance Pills opening source citations.
     - **Block 2: What the Agent Already Checked**: Timestamped checklist of free lookups and cross-checks completed before human interruption.
     - **Block 3: Cascade-Safe Decision Cards**: Selectable candidate cards comparing Upfront Cost vs. Cascade Risk Avoided with operator plain-English override.
     - **Block 4: Execution Preview**: Downstream action preview with green `Auto-Executes` badges and amber `🔒 Customer Guardrail: Draft Queued for Sign-Off` badges.
