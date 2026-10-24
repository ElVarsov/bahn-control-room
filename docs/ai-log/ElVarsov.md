# AI Development Log: Ignacio (@ElVarsov) - Lane A (Control Room UI)

## 1. The Rejected First Draft (Kanban Board vs Decision Queue)
- **Prompt**:
  > *"Generate the main operations view for Bahn Control Room showing order statuses."*
- **Output Rejected**: The coding agent generated a 7-column Kanban board displaying all 100 orders with raw status badges (`FERRY_SOLD_OUT`, `STATUS_WAITING_FOR_PICKUP`).
- **Why Rejected**: Operations specialists managing 25,000 deliveries cannot sift through 100 cards across 7 lanes to spot the 14 live crises.
- **Override**: We threw away the Kanban board as the default view and built the **"Needs You" Decision Queue**:
  - Hides the 86 quiet orders behind a calm status pill (`86 orders running on schedule · 14 need your call`).
  - Sorts exceptions strictly by **Time-to-Point-of-No-Return** (imminent departure and terminal cutoffs at the top).

## 2. Decision Card Architecture (4 Blocks)
- **Prompt**:
  > *"When an operator clicks an order, show the conversation history and a chat box with the agent."*
- **Output Rejected**: Agent suggested a split screen with a long chat transcript and JSON properties.
- **Why Rejected**: Ops specialists need rapid clarity in 15 seconds, not a chat log to scroll through.
- **Override**: We designed the **4-Block Decision Card**:
  1. *Block 1: What Happened & Chain Impact* (2 sentences + visual mini-chain).
  2. *Block 2: What the Agent Already Did* (checklist of free lookups with clickable evidence badges).
  3. *Block 3: The Decision* (comparison cards with cost and time deltas, plus inline tweak box).
  4. *Block 4: What Happens Next When You Click Approve* (dry-run action preview + Customer Lock badge).

## 3. Inline Source Provenance Badges
- Ensured that every fact on screen has an interactive badge (`[Vela Coast Lines quote]`, `[Driver chat]`, `[Seller Phone]`).
- Clicking or hovering on badges opens the Evidence Inspector drawer with exact source records and timestamps.
