# Bahn Car Delivery Control Room

> **Prompt Operations Hackathon (24–25 October 2026)**  
> **Repository**: [ElVarsov/bahn-control-room](https://github.com/ElVarsov/bahn-control-room)  
> **Team**: Ignacio (@ElVarsov) & Antoni (@AntoniKajrys)  
> **Process & AI Story**: [`BUILD-LOG.md`](./BUILD-LOG.md) · [`starter/scripts/eval_agent.py`](./starter/scripts/eval_agent.py)

---

## 1. The Core Problem & Baseline Unit Economics

Bahn delivers **25,000 used cars per year** across Finland, Denmark, and Germany using a network of **1,500 freelance drivers** and an operations staff of **50 people** (~500 cars per ops specialist per year).

When an unexpected variable breaks (a missed train, a sold-out Baltic ferry, or a seller requesting an unmentioned power of attorney), an ops specialist spends **45 minutes cross-referencing PDFs, emails, ferry timetables, and driver chats before making a €200 decision**.

### Baseline Unit Economics Model (Pitch Metrics)
- **Ops Labor Payroll**: 50 staff × ~€55,000 fully loaded = **€2.75M/year** (~€110 in ops labor per delivered car).
- **The "Dry Run" Cost (Failed Pickup)**: When a freelance driver flies to Germany, takes a regional train to a rural seller, and gets turned away because the car has a finance hold or missing power of attorney, Bahn absorbs **€350 to €500 per incident**.
- **Ferry & Routing Domino Cost**: Missing a Baltic ferry (e.g. Travemünde–Helsinki or Puttgarden–Rødby) forces emergency spot-bookings, hotel accommodation, and extra driver day-rates: **€220 to €380 per delay**.
- **Dealer Holding Cost (Customer Churn Risk)**: A €25,000 used car loses **€20 to €35/day** for the dealer in floorplan financing and depreciation. Protecting the 2-day delivery promise is why dealers pay Bahn a premium over 3-week truck carriers.
- **Stipulated Annual Savings**: Our agentic control room prevents 80% of dry runs and automates rerouting legwork, saving **€345,000 to €510,000 annually** and freeing 2,000+ ops hours.

---

## 2. Four Differentiated Agent Architectures

| Concept | Core Agent Loop | Main Cost Driver Solved | Stipulated Annual Savings |
|---|---|---|---|
| **1. "Zero Dry Run" Pre-Flight Verifier** | Cross-examines order packets against seller site rules 24h before departure; halts non-refundable driver travel if papers/finance clearance are missing. | Wasted outbound flights, train tickets, and driver waiting day-rates on failed pickups. | **€437,500 / yr** |
| **2. "Domino Rerouter" (On-the-Road)** | Detects transit delay signals, checks downstream ferry cutoffs, queries alternative routes and rest hotels, and computes priced recovery options. | Last-minute Baltic ferry rebookings, stranded drivers, and delayed customer handovers. | **€345,000 / yr** |
| **3. "Silent Contradiction Hunter"** | Systematically cross-checks order delivery addresses, PDF attachments, and notes for hidden discrepancies (e.g. Seinäjoki vs Tampere custody). | Wrong-city deliveries and compound release stalls. | **€290,000 / yr** |
| **4. "Door-to-Door Arbitrage" Travel Planner** | Constructs multi-modal positioning itineraries (flight + DB train + taxi + return ferry) with driver rest buffer scoring. | Overpriced ad-hoc travel bookings and missed connection chains. | **€510,000 / yr** |

---

## 3. Control Room UI & Taste (Rubric Alignment)

### Non-Negotiable 1: The "Needs You" Queue (Hide the Quiet 86%)
Never open onto a table of 100 orders. The Control Room opens onto a calm status pill:
```
86 orders moving on schedule (handled by agents) · 14 orders need your call
```
Exceptions are strictly sorted by **Time-to-Point-of-No-Return** (e.g. *"Flight boards in 1h 45m — €380 at risk"* at the top).

### Non-Negotiable 2: The "4-Block Decision Card" Layout
Opening an exception presents a single, scannable briefing card with zero transcript clutter:
1. **Block 1 · What Happened & Chain Impact**: Two plain sentences plus a visual **Downstream Domino Path** (`Flight Delayed → Misses 16:15 DB Train → Misses Seller 18:00 Closing → Travemünde Ferry at Risk`).
2. **Block 2 · What the Agent Already Did (The Cheap Work)**: A checklist of free actions executed with timestamps (`Checked Vela Coast ferry timetable at 07:00 (sold out)`, `Verified driver hours: 9h rest required`, `Interviewed driver Camille Emberwick at 08:05`).
3. **Block 3 · The Decision (Priced Options)**: Selectable comparison cards with **Cost Delta** and **Time Delta** (e.g. Option 1: 24 Oct 12:00 Sailing + Lübeck Hotel `+€412`, `+24h delay` vs Option 2: Reroute via Denmark bridges `+€560`, `+6h delay`), plus an inline text box to tweak with natural language.
4. **Block 4 · What Happens Next When You Click Approve**: A dry-run action preview displaying the exact actions that will fire:
   ```
   1. Rebook sailing on Vela Coast 24 Oct 12:00 (€240)
   2. Reserve Baltic Harbor Hotel Lübeck (€172)
   3. Transmit ticket and hotel voucher to driver Camille Emberwick via app
   4. Stage dealer delay notification for your sign-off
   ```

### Non-Negotiable 3: Inline Source Provenance Pills
Every fact displayed on screen has an interactive provenance badge (`[Vela Coast Lines quote]`, `[Driver chat]`, `[Seller Phone]`). Clicking any badge opens the **Evidence Inspector** drawer showing the exact source record, author, and timestamp.

### Non-Negotiable 4: Strict Guardrail Visibility ("Customer Lock")
Under hackathon rules: **The agent never contacts a customer on its own.**
- Actions touching drivers and pickup yards carry a green badge: `● Auto-Executable: Driver & Yard`.
- Actions touching dealers carry an amber lock badge: `🔒 Customer Lock: Human Send Required`. Customer emails are held in draft mode until an operator clicks Send.

---

## 4. Driver Companion & Live Voice Calling

For field communication and demo realism:
- **Driver Mobile Companion (`/driver?d=drv-140`)**: A mobile web interface for freelance drivers supporting safe stop reporting and dashboard photo uploads.
- **In-Browser Voice Calling**: Triggered on safety stops (e.g. CD-420322 Bentley). Features ringtone audio synthesis, speech-to-text (Web Speech API), and text-to-speech agent responses.

---

## 5. Quickstart: Running from Fresh Clone

The project requires **Node.js 24+** and runs completely out-of-the-box with zero database setup required (features an automatic in-memory dataset provider that indexes `dataset/data/*.jsonl` in 5ms).

```bash
# 1. Clone the repository
git clone https://github.com/ElVarsov/bahn-control-room.git
cd bahn-control-room

# 2. Enter starter and install dependencies
cd starter
npm ci

# 3. Start the Control Room
npm run dev
```

Open **`http://localhost:3000`** in your browser.

### Key Routes
- **`/`**: The Operations Control Room ("Needs You" Decision Queue)
- **`/orders/ord-00299`**: CD-420299 Case Page (Domino Rerouting on sold out Travemünde ferry)
- **`/orders/ord-00322`**: CD-420322 Case Page (Bentley Safety Stop & Live Voice Call)
- **`/orders/ord-00458`**: CD-420458 Case Page (Pre-Flight Verifier preventing €380 dry run)
- **`/settings`**: Autonomy Dial (Agent trust configuration & customer lock)
- **`/driver?d=drv-140`**: Freelance Driver Mobile Companion
- **`/board`**: Scale View (100 orders across 7 operational lanes)

### Automated Test Harnesses & Archaeology
```bash
# Run the 10-order agent guardrail harness
python starter/scripts/eval_agent.py

# Run the dataset anomaly & contradiction detector
python starter/scripts/archaeology.py

# Verify packet integrity (100 orders, 4366 records, 58 attachments)
python check_packet.py
```
