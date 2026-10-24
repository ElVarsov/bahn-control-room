import fs from "node:fs"
import path from "node:path"
import type {
  ActionKind,
  AgentRun,
  AgentState,
  Autonomy,
  CaseView,
  Change,
  Decision,
  Fact,
  FactStrength,
  Proposal,
  QueueItem,
  QueueResponse,
  SourceKind,
  SourceRef,
  TimelineEntry,
  TraceStep,
  Urgency,
} from "../contracts"

export type DatasetRecord = Record<string, unknown> & { id: string; order_id?: string }

// Path to dataset data folder
const ROOT_DIR = path.resolve(process.cwd(), "..")
const DATASET_DIR = path.join(ROOT_DIR, "dataset", "data")
const ATTACHMENTS_DIR = path.join(ROOT_DIR, "attachments")

class WorldStore {
  private orders: Map<string, DatasetRecord> = new Map()
  private vehicles: Map<string, DatasetRecord> = new Map()
  private orderItems: Map<string, DatasetRecord> = new Map()
  private customers: Map<string, DatasetRecord> = new Map()
  private addresses: Map<string, DatasetRecord> = new Map()
  private sites: Map<string, DatasetRecord> = new Map()
  private drivers: Map<string, DatasetRecord> = new Map()
  private alerts: Map<string, DatasetRecord> = new Map()
  private proposals: Map<string, Proposal> = new Map()
  private rawProposals: Map<string, DatasetRecord> = new Map()
  private incidents: Map<string, DatasetRecord> = new Map()
  private conversations: Map<string, DatasetRecord> = new Map()
  private messages: Map<string, DatasetRecord> = new Map()
  private orderNotes: Map<string, DatasetRecord> = new Map()
  private proofs: Map<string, DatasetRecord> = new Map()
  private travelReservations: Map<string, DatasetRecord> = new Map()
  private travelOptions: Map<string, DatasetRecord> = new Map()
  private operationalEvents: Map<string, DatasetRecord> = new Map()
  private attachments: any[] = []

  // Runtime mutable state
  private runs: Map<string, AgentRun> = new Map()
  private decisions: Map<string, Decision> = new Map()
  private autonomy: Record<ActionKind, Autonomy> = {
    book_travel: "ask_first",
    change_date: "ask_first",
    approve_cost: "ask_first",
    message_customer: "ask_first", // Permanently locked by rule
    ask_driver: "do_quietly",
    ask_site: "do_quietly",
    refresh_quote: "do_quietly",
    resolve_alert: "do_and_tell",
    handover_to_person: "ask_first",
  }

  private initialized = false

  public ensureLoaded() {
    if (this.initialized) return
    this.loadAll()
    this.initializeProposalsAndRuns()
    this.initialized = true
  }

  private readJsonl(filename: string): DatasetRecord[] {
    const fullPath = path.join(DATASET_DIR, `${filename}.jsonl`)
    if (!fs.existsSync(fullPath)) return []
    const content = fs.readFileSync(fullPath, "utf8")
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DatasetRecord)
  }

  private loadAll() {
    for (const row of this.readJsonl("orders")) this.orders.set(row.id, row)
    for (const row of this.readJsonl("vehicles")) this.vehicles.set(row.id, row)
    for (const row of this.readJsonl("order_items")) this.orderItems.set(row.id, row)
    for (const row of this.readJsonl("customers")) this.customers.set(row.id, row)
    for (const row of this.readJsonl("addresses")) this.addresses.set(row.id, row)
    for (const row of this.readJsonl("sites")) this.sites.set(row.id, row)
    for (const row of this.readJsonl("drivers")) this.drivers.set(row.id, row)
    for (const row of this.readJsonl("alerts")) this.alerts.set(row.id, row)
    for (const row of this.readJsonl("agent_proposals")) this.rawProposals.set(row.id, row)
    for (const row of this.readJsonl("incidents")) this.incidents.set(row.id, row)
    for (const row of this.readJsonl("conversations")) this.conversations.set(row.id, row)
    for (const row of this.readJsonl("messages")) this.messages.set(row.id, row)
    for (const row of this.readJsonl("order_notes")) this.orderNotes.set(row.id, row)
    for (const row of this.readJsonl("proofs")) this.proofs.set(row.id, row)
    for (const row of this.readJsonl("travel_reservations")) this.travelReservations.set(row.id, row)
    for (const row of this.readJsonl("travel_options")) this.travelOptions.set(row.id, row)
    for (const row of this.readJsonl("operational_events")) this.operationalEvents.set(row.id, row)

    const manifestPath = path.join(ATTACHMENTS_DIR, "manifest.json")
    if (fs.existsSync(manifestPath)) {
      try {
        this.attachments = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
      } catch {
        this.attachments = []
      }
    }
  }

  private initializeProposalsAndRuns() {
    // Seed CD-420299 proposal & run
    const p299: Proposal = {
      id: "prop-299-rebook",
      orderId: "ord-00299",
      action: "book_travel",
      title: "Book the 24 Oct 12:00 sailing and one hotel night near the terminal",
      rationale:
        "The overnight vehicle crossing on 23 Oct is sold out. Driver Camille Emberwick agreed to take the 24 Oct 12:00 departure if lodging is arranged. Customer approval is required before locking in the 28 Oct delivery promise.",
      changes: [
        { label: "Ferry", before: "23 Oct 22:00 (sold out, unconfirmed)", after: "24 Oct 12:00, vehicle slot (quoted)" },
        { label: "Hotel", before: null, after: "1 night, 23 Oct, Baltic Harbor Hotel Lübeck" },
        { label: "Delivery promise", before: "27 Oct 13:00–15:00 EET", after: "28 Oct 13:00–15:00 EET (requires dealer sign-off)" },
        { label: "Cost Delta", before: "€ 0", after: "+€ 412 (ferry fare delta €240 + hotel €172)" },
      ],
      draftMessage: {
        to: "Kavellora Car House",
        channel: "customer_email",
        body: "The overnight Travemünde-Helsinki vehicle crossing for CD-420299 is sold out. The earliest confirmed slot is 24 Oct 12:00, moving delivery to 28 Oct 13:00–15:00. Please confirm if this delivery window is acceptable.",
      },
      evidence: [
        {
          id: "f1",
          text: "The overnight vehicle crossing on 23 Oct 22:00 is sold out.",
          strength: "verified",
          sources: [
            {
              kind: "provider",
              label: "Vela Coast Lines live capacity",
              at: "2026-10-21T07:00:00Z",
              table: "travel_options",
              recordId: "travel-xc1d8163d5443a606",
            },
          ],
        },
        {
          id: "f2",
          text: "The earlier booking attempt timed out; no active reservation exists.",
          strength: "verified",
          sources: [
            {
              kind: "agent",
              label: "Travel booking attempt",
              at: "2026-10-21T07:10:00Z",
              table: "agent_proposals",
              recordId: "agent-x4ac988b20000595f",
            },
          ],
        },
        {
          id: "f3",
          text: "The 24 Oct 12:00 sailing has a vehicle slot quoted at €240.",
          strength: "quote",
          sources: [
            {
              kind: "provider",
              label: "Vela Coast Lines quote",
              at: "2026-10-21T07:00:00Z",
              table: "travel_options",
              recordId: "travel-xf29ed1732d895f37",
            },
          ],
        },
        {
          id: "f4",
          text: "Driver Camille Emberwick reports willingness to take 12:00 boat with Lübeck rest hotel.",
          strength: "reported",
          sources: [
            {
              kind: "driver",
              label: "Driver chat",
              actorName: "Camille Emberwick",
              at: "2026-10-21T08:05:00Z",
              table: "messages",
              recordId: "msg-x77a59a639105e016",
            },
          ],
        },
      ],
      status: "pending",
      createdAt: "2026-10-21T08:50:00Z",
      createdBy: "road-agent",
      whatHappensNext:
        "1. Rebook sailing on Vela Coast 24 Oct 12:00 (€240) • 2. Reserve Baltic Harbor Hotel Lübeck (€172) • 3. Transmit ticket and hotel voucher to driver Camille Emberwick • 4. Stage dealer delay notification for your sign-off.",
    }
    this.proposals.set(p299.id, p299)

    // Seed CD-420322 proposal (Bentley Safety Stop)
    const p322: Proposal = {
      id: "prop-322-safetystop",
      orderId: "ord-00322",
      action: "handover_to_person",
      title: "Dealer Handover: Call Autohaus Preussen regarding Bentley roadside vs tow",
      rationale:
        "The driver pulled over at A7 km 212 with a red engine temperature warning light. Driver is safe; Bentley is stationary. Dealer must authorize dealer roadside technician or private flatbed tow.",
      changes: [
        { label: "Vehicle Status", before: "Moving (A7 Northbound)", after: "Safely Stopped (Service Area A7 km 212)" },
        { label: "Next Action", before: "Transit to Hamburg", after: "Dealer Decision: Own Roadside vs Tow" },
        { label: "Delivery Target", before: "22 Oct 10:00 (On schedule)", after: "At risk (delayed pending diagnosis)" },
      ],
      draftMessage: {
        to: "Autohaus Preussen (Dealer Dispatch)",
        channel: "customer_email",
        body: "Bentley Continental GT (CD-420322) encountered a red engine temperature alert at km 212. Driver is safe in service parking. Does Autohaus Preussen dispatch authorized roadside support, or should Bahn arrange flatbed towing to your Hamburg facility?",
      },
      evidence: [
        {
          id: "f322-1",
          text: "Driver verified safe; parked in lit service area at A7 km 212.",
          strength: "reported",
          sources: [{ kind: "driver", label: "Driver Voice Call", actorName: "Matti V.", at: "2026-10-21T08:42:00Z", table: "messages" }],
        },
        {
          id: "f322-2",
          text: "Dashboard warning indicates critical engine coolant/temperature fault.",
          strength: "verified",
          sources: [{ kind: "driver", label: "Driver Photo Upload", at: "2026-10-21T08:44:00Z", table: "proofs" }],
        },
        {
          id: "f322-3",
          text: "Vehicle value €185,000; dealer policy specifies authorized technician inspection prior to unauthorized restart.",
          strength: "verified",
          sources: [{ kind: "system", label: "Dealer Service Profile", at: "2026-10-21T08:45:00Z", table: "sites" }],
        },
      ],
      status: "pending",
      createdAt: "2026-10-21T08:46:00Z",
      createdBy: "road-agent",
      whatHappensNext:
        "1. Present operator with 1-click Phone Briefing Card to call Autohaus Preussen • 2. Issue driver standby & coffee voucher (€15) • 3. Hold delivery promise pending dealer decision.",
    }
    this.proposals.set(p322.id, p322)

    // Seed CD-420458 proposal (Ferrari Roma - Zero Dry Run)
    const p458: Proposal = {
      id: "prop-458-preflight",
      orderId: "ord-00458",
      action: "handover_to_person",
      title: "Hold Driver Departure: Seller reports commercial finance hold and missing Vollmacht",
      rationale:
        "Seller Autohaus Süd confirmed car is not released for pickup without signed original Vollmacht. Driver flight departs in 1h 45m. Freezing travel prevents a €380 wasted trip.",
      changes: [
        { label: "Driver Travel", before: "Flight LH2042 Check-in Open", after: "Travel Frozen (Held by Pre-Flight Verifier)" },
        { label: "Pickup Readiness", before: "Unverified (Seller flagged ready)", after: "BLOCKED (Missing Vollmacht + Finance Hold)" },
        { label: "Dry Run Prevention", before: "None", after: "€ 380 saved in hard flight/train costs" },
      ],
      draftMessage: {
        to: "Scandic Premium Cars (Buyer)",
        channel: "customer_email",
        body: "Pre-flight audit for Ferrari Roma (CD-420458) identified that seller Autohaus Süd requires an original signed Vollmacht. We have placed the driver's flight on hold to avoid wasted travel fees while this document is gathered.",
      },
      evidence: [
        {
          id: "f458-1",
          text: "Seller dispatch call: Staff confirmed keys will NOT be handed over without signed Vollmacht.",
          strength: "reported",
          sources: [{ kind: "site", label: "Seller Phone Verification", actorName: "K. Becker", at: "2026-10-21T08:30:00Z", table: "messages" }],
        },
        {
          id: "f458-2",
          text: "Order document packet missing power of attorney attachment.",
          strength: "verified",
          sources: [{ kind: "agent", label: "Packet Document Audit", at: "2026-10-21T08:31:00Z", table: "documents" }],
        },
      ],
      status: "pending",
      createdAt: "2026-10-21T08:35:00Z",
      createdBy: "preflight-agent",
      whatHappensNext:
        "1. Freeze driver LH2042 flight check-in • 2. Alert buyer document desk to upload signed Vollmacht PDF • 3. Re-check seller status once document is transmitted.",
    }
    this.proposals.set(p458.id, p458)
  }

  public getOrdersCount() {
    this.ensureLoaded()
    return this.orders.size
  }

  public getAutonomySettings(): Record<ActionKind, Autonomy> {
    return { ...this.autonomy }
  }

  public updateAutonomySettings(settings: Partial<Record<ActionKind, Autonomy>>) {
    for (const [k, v] of Object.entries(settings)) {
      if (k === "message_customer") continue // Always locked to ask_first
      if (v) this.autonomy[k as ActionKind] = v
    }
    return this.getAutonomySettings()
  }

  public getQueue(): QueueResponse {
    this.ensureLoaded()

    const needsPerson: QueueItem[] = [
      {
        id: "q-458",
        orderId: "ord-00458",
        orderReference: "CD-420458",
        car: "Ferrari Roma",
        route: "Stuttgart → Tampere",
        headline: "Seller commercial hold & missing Vollmacht. Hold flight departure?",
        why: "Seller refuses release without original signed Vollmacht. Driver flight LH2042 departs in 1h 45m (€380 at risk).",
        urgency: "now",
        decideBy: "2026-10-21T10:15:00Z",
        proposalId: "prop-458-preflight",
        agentState: "needs_person",
        updatedAt: "2026-10-21T08:35:00Z",
      },
      {
        id: "q-322",
        orderId: "ord-00322",
        orderReference: "CD-420322",
        car: "Bentley Continental GT",
        route: "Berlin → Hamburg",
        headline: "Red warning light on A7. Driver safe; call dealer for tow authorization?",
        why: "Driver stopped safely at service area km 212. Critical engine alert requires dealer decision on authorized tow vs mobile roadside.",
        urgency: "now",
        decideBy: "2026-10-21T09:30:00Z",
        proposalId: "prop-322-safetystop",
        agentState: "needs_person",
        updatedAt: "2026-10-21T08:46:00Z",
      },
      {
        id: "q-299",
        orderId: "ord-00299",
        orderReference: "CD-420299",
        car: "BMW M4",
        route: "Leipzig → Helsinki",
        headline: "Ferry sold out. Approve next-day sailing & dealer delay sign-off?",
        why: "Overnight Travemünde crossing is sold out. Recommended plan: 24 Oct 12:00 boat + Lübeck hotel (+€412, +24h delay).",
        urgency: "today",
        decideBy: "2026-10-21T14:00:00Z",
        proposalId: "prop-299-rebook",
        agentState: "needs_person",
        updatedAt: "2026-10-21T08:50:00Z",
      },
      {
        id: "q-593",
        orderId: "ord-00593",
        orderReference: "CD-420593",
        car: "BMW M4",
        route: "Munich → Turku",
        headline: "Empty pickup block: Yard vehicle stock reference does not match VIN",
        why: "Driver on site; vehicle tag #STK-8812 does not match order chassis number. Collection frozen.",
        urgency: "now",
        decideBy: "2026-10-21T10:00:00Z",
        agentState: "needs_person",
        updatedAt: "2026-10-21T08:40:00Z",
      },
      {
        id: "q-603",
        orderId: "ord-00603",
        orderReference: "CD-420603",
        car: "Volkswagen Golf",
        route: "Hannover → Helsinki",
        headline: "Ferry connection risk: Traffic delay projected to breach 21:30 cutoff",
        why: "A1 road congestion adds 45m delay. ETA 21:45 breaches 21:30 gate check-in cutoff.",
        urgency: "today",
        decideBy: "2026-10-21T17:00:00Z",
        agentState: "working",
        updatedAt: "2026-10-21T08:20:00Z",
      },
      {
        id: "q-516",
        orderId: "ord-00516",
        orderReference: "CD-420516",
        car: "Volvo V60",
        route: "Gothenburg → Espoo",
        headline: "Site access refuted: Reception has no keys and side gate is unstaffed",
        why: "Site contact off-site until tomorrow morning. Driver waiting for release access.",
        urgency: "today",
        decideBy: "2026-10-21T11:00:00Z",
        agentState: "waiting_reply",
        updatedAt: "2026-10-21T08:15:00Z",
      },
      {
        id: "q-702",
        orderId: "ord-00702",
        orderReference: "CD-420702",
        car: "Toyota Corolla",
        route: "Oulu → Espoo Relay",
        headline: "Relay transfer broken: Leg 2 driver cancelled; car stored in yard",
        why: "Leg 1 completed to Merivanto Espoo yard. Leg 2 driver withdrew. Re-dispatch needed before delivery target expires.",
        urgency: "soon",
        decideBy: "2026-10-21T16:00:00Z",
        agentState: "needs_person",
        updatedAt: "2026-10-21T07:45:00Z",
      },
      {
        id: "q-384",
        orderId: "ord-00384",
        orderReference: "CD-420384",
        car: "Porsche 911 Carrera",
        route: "Tampere → Seinäjoki",
        headline: "Address contradiction: Order header says Seinäjoki, custody note says Tampere",
        why: "Driver bundle custody note directs drop-off at Tampere yard, but official delivery address is Seinäjoki.",
        urgency: "soon",
        decideBy: "2026-10-21T15:00:00Z",
        agentState: "needs_person",
        updatedAt: "2026-10-21T08:10:00Z",
      },
      {
        id: "q-399",
        orderId: "ord-00399",
        orderReference: "CD-420399",
        car: "Ferrari 296 GTB",
        route: "Frankfurt → Leipzig",
        headline: "Driver positioning risk: Mandatory legal rest prevents reaching pickup slot",
        why: "Driver completed prior duty at 04:00; mandatory 9h rest rule pushes pickup readiness to 13:00.",
        urgency: "today",
        decideBy: "2026-10-21T11:30:00Z",
        agentState: "needs_person",
        updatedAt: "2026-10-21T08:00:00Z",
      },
      {
        id: "q-154",
        orderId: "ord-00154",
        orderReference: "CD-420154",
        car: "Audi Q8 e-tron",
        route: "Lyon → Helsinki",
        headline: "Earliest ferry sold out: Driver cross-border travel requires updated itinerary",
        why: "First sailing unavailable; agent has quotes for next day but requires ops approval before purchase.",
        urgency: "soon",
        decideBy: "2026-10-21T18:00:00Z",
        agentState: "needs_person",
        updatedAt: "2026-10-21T07:30:00Z",
      },
      {
        id: "q-055",
        orderId: "ord-00055",
        orderReference: "CD-420055",
        car: "Volvo V60",
        route: "Stockholm → Helsinki",
        headline: "Post-delivery condition claim: Customer reports rear bumper scuff",
        why: "Customer uploaded photos 2 hours post-delivery. Agent comparing pickup vs delivery proofs before assigning liability.",
        urgency: "watch",
        decideBy: "2026-10-22T10:00:00Z",
        agentState: "working",
        updatedAt: "2026-10-21T08:12:00Z",
      },
      {
        id: "q-437",
        orderId: "ord-00437",
        orderReference: "CD-420437",
        car: "Bentley Flying Spur",
        route: "Cologne → Hamburg",
        headline: "Delivery site gate code unconfirmed: Yard closes in 2h 20m",
        why: "Driver in transit; receiver phone went to voicemail. Agent querying secondary site contact.",
        urgency: "today",
        decideBy: "2026-10-21T14:40:00Z",
        agentState: "waiting_reply",
        updatedAt: "2026-10-21T08:25:00Z",
      },
      {
        id: "q-449",
        orderId: "ord-00449",
        orderReference: "CD-420449",
        car: "Toyota Corolla",
        route: "Copenhagen → Malmö",
        headline: "Driver illness reported: Search standby driver while keeping pickup reservation",
        why: "Driver reported fever; standby pool queried. Assignment kept active until replacement confirmed.",
        urgency: "soon",
        decideBy: "2026-10-21T13:00:00Z",
        agentState: "working",
        updatedAt: "2026-10-21T08:05:00Z",
      },
      {
        id: "q-164",
        orderId: "ord-00164",
        orderReference: "CD-420164",
        car: "BMW M4",
        route: "Dresden → Tampere",
        headline: "Delivery CMR proof missing receiver signature stamp",
        why: "Uploaded delivery photo lacks dealer receiving stamp. Agent requested driver re-upload before shift end.",
        urgency: "watch",
        decideBy: "2026-10-22T12:00:00Z",
        agentState: "waiting_reply",
        updatedAt: "2026-10-21T07:15:00Z",
      },
    ]

    // Sample of quiet orders running autonomously
    const quietSample = [
      { orderId: "ord-00004", orderReference: "CD-420004", car: "Porsche Taycan", stage: "Delivered (Signed & Closed)" },
      { orderId: "ord-00012", orderReference: "CD-420012", car: "Mercedes-Benz E-Class", stage: "In Transit (Travemünde Ferry Boarded)" },
      { orderId: "ord-00018", orderReference: "CD-420018", car: "Tesla Model Y", stage: "Moving (A7 Northbound · On Schedule)" },
      { orderId: "ord-00025", orderReference: "CD-420025", car: "BMW i4", stage: "Waiting Pickup (Gate Code & Vollmacht Verified)" },
      { orderId: "ord-00031", orderReference: "CD-420031", car: "Audi e-tron GT", stage: "Market Offer (3 Drivers Viewed · Rate Optimal)" },
      { orderId: "ord-00042", orderReference: "CD-420042", car: "Polestar 2", stage: "Booked (Driver Travel Ticketed)" },
      { orderId: "ord-00050", orderReference: "CD-420050", car: "Volkswagen ID.4", stage: "Moving (Puttgarden Ferry Crossing)" },
      { orderId: "ord-00063", orderReference: "CD-420063", car: "Skoda Enyaq", stage: "In Transit (Tracking Active · Telematics Fresh)" },
    ]

    return {
      snapshotAt: "2026-10-21T09:00:00Z",
      needsPerson,
      quiet: {
        count: 100 - needsPerson.length,
        sample: quietSample,
      },
    }
  }

  public getCase(orderId: string): CaseView | null {
    this.ensureLoaded()
    const order = this.orders.get(orderId)
    if (!order) return null

    const ref = (order.reference as string) || orderId

    // Specialized case views for headline demonstration cases
    if (orderId === "ord-00299") {
      const p = this.proposals.get("prop-299-rebook")
      return {
        orderId,
        orderReference: ref,
        headline: "Ferry sold out. The car can still arrive one day late if the next sailing is booked today.",
        facts: p?.evidence || [],
        proposals: p ? [p] : [],
        runs: [
          {
            id: "run-299",
            orderId,
            agentId: "domino-rerouter",
            trigger: "alert:FERRY_SOLD_OUT",
            state: "needs_person",
            startedAt: "2026-10-21T07:05:00Z",
            steps: [
              { kind: "thought", at: "2026-10-21T07:05:00Z", text: "Alert triggered: Travemünde-Helsinki overnight sailing on 23 Oct returned sold out. Initiating cheap legwork." },
              { kind: "tool_call", at: "2026-10-21T07:05:10Z", tool: "query_travel_options", input: { route: "Travemünde → Helsinki", date: "2026-10-23" }, cost: "free" },
              { kind: "tool_result", at: "2026-10-21T07:05:20Z", tool: "query_travel_options", summary: "23 Oct 22:00: SOLD OUT. Next available: 24 Oct 12:00 (Vehicle slot quoted at €240)." },
              { kind: "tool_call", at: "2026-10-21T07:06:00Z", tool: "check_driver_hours", input: { driverId: "drv-140" }, cost: "free" },
              { kind: "tool_result", at: "2026-10-21T07:06:05Z", tool: "check_driver_hours", summary: "Driver duty ends at 22:00. Mandatory 9h rest requires hotel accommodation near port." },
              { kind: "message_out", at: "2026-10-21T08:00:00Z", to: "driver", toName: "Camille Emberwick", channel: "driver_chat", body: "Overnight ferry is sold out. Can you take tomorrow's 12:00 boat if we book a hotel in Lübeck?" },
              { kind: "message_in", at: "2026-10-21T08:05:00Z", from: "driver", fromName: "Camille Emberwick", channel: "driver_chat", body: "Yes, that works fine as long as the hotel has secure parking.", simulated: true },
              { kind: "thought", at: "2026-10-21T08:06:00Z", text: "Rebooking ferry and hotel will move delivery promise by 24 hours. Rule of the game: NEVER contact customer autonomously. Creating approval proposal." },
              { kind: "proposal", at: "2026-10-21T08:50:00Z", proposalId: "prop-299-rebook" },
              { kind: "stop", at: "2026-10-21T08:50:05Z", reason: "needs_person", summary: "Awaiting operator authorization for hotel, ferry booking, and customer delivery revision." },
            ],
          },
        ],
        timeline: [
          { id: "t1", at: "2026-10-21T07:00:00Z", actor: { kind: "provider", name: "Vela Coast Lines" }, channel: "provider_api", visibility: "internal", text: "Live ferry check: 23 Oct 22:00 Travemünde-Helsinki vehicle capacity is full (0 slots)." },
          { id: "t2", at: "2026-10-21T07:20:00Z", actor: { kind: "driver", name: "Camille Emberwick" }, channel: "driver_chat", visibility: "public", text: "I have the gig for CD-420299, but I do not see a confirmed ferry reference in the app. Is it booked?" },
          { id: "t3", at: "2026-10-21T07:56:00Z", actor: { kind: "customer", name: "Kavellora Car House" }, channel: "customer_email", visibility: "public", text: "Please keep us informed on CD-420299. We need to approve any revised delivery date before it is promised to the buyer." },
          { id: "t4", at: "2026-10-21T08:05:00Z", actor: { kind: "agent", name: "Domino Rerouter" }, channel: "driver_chat", visibility: "public", text: "Driver Camille Emberwick confirmed agreement to take the 24 Oct 12:00 sailing with hotel rest stop." },
        ],
      }
    }

    if (orderId === "ord-00322") {
      const p = this.proposals.get("prop-322-safetystop")
      return {
        orderId,
        orderReference: ref,
        headline: "Red warning light on A7. Driver safely stopped; call dealer to authorize roadside support.",
        facts: p?.evidence || [],
        proposals: p ? [p] : [],
        runs: [
          {
            id: "run-322",
            orderId,
            agentId: "road-safety-agent",
            trigger: "alert:SAFETY_STOP",
            state: "needs_person",
            startedAt: "2026-10-21T08:41:00Z",
            steps: [
              { kind: "thought", at: "2026-10-21T08:41:00Z", text: "Driver initiated safe stop report via mobile app. Triggering voice protocol." },
              { kind: "call", at: "2026-10-21T08:42:00Z", callId: "call-322", status: "completed", summary: "Driver verified safe; parked in lit service area at A7 km 212. Red engine temperature warning." },
              { kind: "tool_call", at: "2026-10-21T08:44:00Z", tool: "request_photo", input: { item: "dashboard_warning_light" }, cost: "free" },
              { kind: "tool_result", at: "2026-10-21T08:44:30Z", tool: "request_photo", summary: "Photo received: Red coolant / engine overheating lamp illuminated." },
              { kind: "thought", at: "2026-10-21T08:45:00Z", text: "High-value vehicle (Bentley Continental GT). Dealer Autohaus Preussen retains own roadside dispatch contract. Operator must decide." },
              { kind: "proposal", at: "2026-10-21T08:46:00Z", proposalId: "prop-322-safetystop" },
              { kind: "stop", at: "2026-10-21T08:46:05Z", reason: "needs_person", summary: "Handover card ready with phone briefing for Autohaus Preussen." },
            ],
          },
        ],
        timeline: [
          { id: "t322-1", at: "2026-10-21T08:40:00Z", actor: { kind: "driver", name: "Matti V." }, channel: "driver_app", visibility: "public", text: "Red warning light flashed on dash. Pulled over at rest stop A7 km 212." },
          { id: "t322-2", at: "2026-10-21T08:42:00Z", actor: { kind: "agent", name: "Safety Agent" }, channel: "phone", visibility: "internal", text: "Automated voice check completed: Driver unharmed, vehicle parked safely in truck plaza." },
          { id: "t322-3", at: "2026-10-21T08:44:00Z", actor: { kind: "driver", name: "Matti V." }, channel: "driver_app", visibility: "public", text: "Uploaded photo of instrument cluster showing red coolant temperature indicator." },
        ],
      }
    }

    if (orderId === "ord-00458") {
      const p = this.proposals.get("prop-458-preflight")
      return {
        orderId,
        orderReference: ref,
        headline: "Seller commercial hold & missing Vollmacht. Hold driver departure to prevent €380 dry run.",
        facts: p?.evidence || [],
        proposals: p ? [p] : [],
        runs: [
          {
            id: "run-458",
            orderId,
            agentId: "preflight-gatekeeper",
            trigger: "alert:RELEASE_DOCUMENT_UNCLEAR",
            state: "needs_person",
            startedAt: "2026-10-21T08:25:00Z",
            steps: [
              { kind: "thought", at: "2026-10-21T08:25:00Z", text: "Scanning order packet 2h prior to driver departure. Cross-referencing PDF attachments against seller site rules." },
              { kind: "tool_call", at: "2026-10-21T08:26:00Z", tool: "audit_packet_documents", input: { orderId: "ord-00458" }, cost: "free" },
              { kind: "tool_result", at: "2026-10-21T08:26:15Z", tool: "audit_packet_documents", summary: "MISSING: Original Power of Attorney (Vollmacht). Present: Purchase invoice only." },
              { kind: "tool_call", at: "2026-10-21T08:30:00Z", tool: "verify_site_readiness", input: { siteId: "site-stuttgart", contact: "Autohaus Süd" }, cost: "free" },
              { kind: "tool_result", at: "2026-10-21T08:30:45Z", tool: "verify_site_readiness", summary: "Seller receptionist states: Vehicle has commercial finance block; will not release without signed Vollmacht and bank clearance." },
              { kind: "thought", at: "2026-10-21T08:31:00Z", text: "Driver flight LH2042 departs in 1h 45m (€280 flight + €100 train). Halting departure to save €380." },
              { kind: "proposal", at: "2026-10-21T08:35:00Z", proposalId: "prop-458-preflight" },
              { kind: "stop", at: "2026-10-21T08:35:05Z", reason: "needs_person", summary: "Hold Driver Departure decision staged for ops." },
            ],
          },
        ],
        timeline: [
          { id: "t458-1", at: "2026-10-21T08:20:00Z", actor: { kind: "system", name: "Dispatch Engine" }, channel: "system", visibility: "internal", text: "Driver J. Virtanen assigned to flight LH2042 Stuttgart. Departure 10:45." },
          { id: "t458-2", at: "2026-10-21T08:30:00Z", actor: { kind: "site", name: "Autohaus Süd" }, channel: "phone", visibility: "internal", text: "Site reception: 'The Ferrari Roma is in our compound, but the finance desk has not cleared release. We need a signed Vollmacht before handing keys.'" },
          { id: "t458-3", at: "2026-10-21T08:35:00Z", actor: { kind: "agent", name: "Zero Dry Run Verifier" }, channel: "internal_note", visibility: "internal", text: "Travel freeze staged. Prevents €380 in wasted travel bookings." },
        ],
      }
    }

    // Generic fallback for any other order in the 100-order dataset
    const orderAlerts = Array.from(this.alerts.values()).filter((a) => a.order_id === orderId)
    const orderProps = Array.from(this.proposals.values()).filter((p) => p.orderId === orderId)
    const orderNotes = Array.from(this.orderNotes.values()).filter((n) => n.order_id === orderId)
    const orderMsgs = Array.from(this.messages.values()).filter((m) => m.order_id === orderId)

    const fallbackFacts: Fact[] = orderAlerts.map((a, idx) => ({
      id: `fact-gen-${idx}`,
      text: (a.summary as string) || "Operational exception flagged by background monitoring agent.",
      strength: "verified" as FactStrength,
      sources: [
        {
          kind: "system" as SourceKind,
          label: "Alert Engine",
          at: (a.triggered_at as string) || "2026-10-21T08:00:00Z",
          table: "alerts",
          recordId: a.id,
        },
      ],
    }))

    if (fallbackFacts.length === 0) {
      fallbackFacts.push({
        id: "fact-ok",
        text: "All travel bookings, gate clearances, and driver telemetry are moving on schedule.",
        strength: "verified",
        sources: [{ kind: "system", label: "Fleet Monitor", at: "2026-10-21T08:50:00Z" }],
      })
    }

    return {
      orderId,
      orderReference: ref,
      headline: orderAlerts[0]?.summary
        ? `${orderAlerts[0].summary as string}`
        : `Order ${ref} is running smoothly under autonomous monitoring.`,
      facts: fallbackFacts,
      proposals: orderProps,
      runs: [],
      timeline: [
        ...orderNotes.map((n, i) => ({
          id: `tn-${i}`,
          at: (n.created_at as string) || "2026-10-21T07:00:00Z",
          actor: { kind: "operator" as SourceKind, name: "Ops Log" },
          channel: "internal_note",
          visibility: "internal" as const,
          text: (n.body as string) || "",
        })),
        ...orderMsgs.slice(0, 5).map((m, i) => ({
          id: `tm-${i}`,
          at: (m.authored_at as string) || "2026-10-21T07:30:00Z",
          actor: { kind: "driver" as SourceKind, name: "Driver" },
          channel: "driver_chat",
          visibility: "public" as const,
          text: (m.body as string) || "",
        })),
      ],
    }
  }

  public recordDecision(proposalId: string, decision: Decision): Proposal | null {
    this.ensureLoaded()
    const proposal = this.proposals.get(proposalId)
    if (!proposal) return null

    proposal.decision = decision
    proposal.status = decision.verdict === "approve" ? "approved" : decision.verdict === "edit" ? "edited_and_approved" : "rejected"

    // If approved, simulate execution
    if (proposal.status === "approved" || proposal.status === "edited_and_approved") {
      proposal.status = "executed"
      // Record operational event
      const eventId = `evt-exec-${Date.now()}`
      this.operationalEvents.set(eventId, {
        id: eventId,
        order_id: proposal.orderId,
        command: `proposal.${proposal.action}.executed`,
        recorded_at: decision.decidedAt,
        details: { proposalId, decision },
      })
    }

    return proposal
  }

  public getAttachments() {
    this.ensureLoaded()
    return this.attachments
  }
}

export const worldStore = new WorldStore()
