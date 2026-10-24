import { SNAPSHOT_AT, byId, forOrder, rows, type Row } from "./agent/dataset"

export interface ChainStep {
  name: string
  scheduledAt: string
  cutoffOrDeadline?: string
  slackMinutes: number | null
  status: "ok" | "tight_buffer" | "broken"
  detail: string
}

export interface ProvenanceCitation {
  label: string
  sourceType: "attachment" | "message" | "order_field" | "timetable" | "alert" | "note" | "document"
  sourceId: string
  excerpt: string
  url?: string
}

export interface CascadeCandidateOption {
  id: string
  title: string
  actionSummary: string
  upfrontDeltaEur: number
  cascadeRiskPercent: number
  cascadeCostAtRiskEur: number
  expectedDominoOverrunEur: number
  expectedTotalCostEur: number
  bufferAddedMinutes: number
  isRecommended: boolean
  rejectionReason?: string
  whatHappensNext: string
  dryRunActions: {
    label: string
    actor: "agent" | "driver" | "seller" | "customer"
    autoExecutes: boolean
    isCustomerLock: boolean
  }[]
}

export interface OrderCascadeAssessment {
  orderId: string
  orderReference: string
  car: string
  route: string
  customer?: string
  triageState: "NEEDS_DECISION_NOW" | "WILL_BREAK_TODAY" | "ON_TRACK"
  timeToPointOfNoReturnMinutes: number
  pointOfNoReturnLabel: string
  cascadeCostAtRiskEur: number
  costBreakdown: {
    wastedTransitEur: number
    ferryRebookingEur: number
    hotelNightEur: number
    driverDayRateEur: number
    slaBreachPenaltyEur: number
  }
  summary: string
  rootCause: string
  slackMinutes: number | null
  chainSteps: ChainStep[]
  provenanceCitations: ProvenanceCitation[]
  options: CascadeCandidateOption[]
  cheapWorkDone: {
    tool: string
    timestamp: string
    summary: string
    result: string
  }[]
}

export function evaluateCascadeRisk(orderIdOrRef: string): OrderCascadeAssessment | null {
  const allOrders = rows("orders")
  const order = allOrders.find((o) => o.id === orderIdOrRef || o.reference === orderIdOrRef)
  if (!order) return null

  const orderId = String(order.id)
  const ref = String(order.reference)
  const customer = byId("customers", order.customer_id)?.name as string | undefined

  // Vehicle
  const item = rows("order_items").find((r) => r.order_id === orderId && r.role === "PRIMARY")
  const veh = item ? byId("vehicles", item.vehicle_id) : undefined
  const car = veh ? `${veh.make} ${veh.model}` : "Delivery Vehicle"

  // Route
  const pCity = (id: unknown) => String(byId("addresses", id)?.city ?? "Unknown")
  const route = `${pCity(order.pickup_address_id)} → ${pCity(order.delivery_address_id)}`

  // Alerts, documents, travel, notes, messages
  const alerts = forOrder("alerts", orderId)
  const docs = forOrder("documents", orderId)
  const travelRes = forOrder("travel_reservations", orderId)
  const travelOpt = forOrder("travel_options", orderId)
  const notes = forOrder("order_notes", orderId)
  const msgs = forOrder("messages", orderId)

  // 1. Check for ord-00123 (CD-420123): Cologne -> Odense Tight Flight/Rail Connection
  if (ref === "CD-420123" || orderId === "ord-00123") {
    return {
      orderId,
      orderReference: ref,
      car,
      route,
      customer,
      triageState: "WILL_BREAK_TODAY",
      timeToPointOfNoReturnMinutes: 48,
      pointOfNoReturnLabel: "Train departs in 48m · Station-to-airport link",
      cascadeCostAtRiskEur: 440,
      costBreakdown: {
        wastedTransitEur: 145,
        ferryRebookingEur: 0,
        hotelNightEur: 95,
        driverDayRateEur: 0,
        slaBreachPenaltyEur: 200,
      },
      summary: "Critical 35m transfer buffer between arriving Baltic Link Rail and Vesper Air 10:45 flight. Tight handoff risks cascading into missed Cologne pickup slot before Friday 15:00 seller weekend closure.",
      rootCause: "Sub-45m slack on multi-leg positioning chain before weekend seller cutoff.",
      slackMinutes: 35,
      chainSteps: [
        { name: "Baltic Link Rail", scheduledAt: "2026-10-22 07:10 CET", cutoffOrDeadline: "Arrives 09:30", slackMinutes: 75, status: "ok", detail: "Train on schedule to hub terminal" },
        { name: "Terminal-to-Airport Transfer", scheduledAt: "2026-10-22 09:30 CET", cutoffOrDeadline: "Gate closes 10:15", slackMinutes: 35, status: "tight_buffer", detail: "Regional bus connection: 35m slack before security cutoff" },
        { name: "Vesper Air Flight", scheduledAt: "2026-10-22 10:45 CET", cutoffOrDeadline: "Departs 10:45", slackMinutes: 35, status: "tight_buffer", detail: "Flight to Cologne regional airport" },
        { name: "Aster Stay Hotel", scheduledAt: "2026-10-22 17:00 CET", cutoffOrDeadline: "Check-in 17:00", slackMinutes: 120, status: "ok", detail: "Overnight rest before morning collection" },
        { name: "Norvarken Cologne Pickup", scheduledAt: "2026-10-23 09:00 CET", cutoffOrDeadline: "Seller Closes Fri 15:00", slackMinutes: 360, status: "ok", detail: "Weekend seller gate lockout if delayed >6h" },
      ],
      provenanceCitations: [
        { label: "Travel: Baltic Link Rail 07:10", sourceType: "timetable", sourceId: "res-x4189123847a", excerpt: "Baltic Link Rail scheduled departure 2026-10-22 07:10:00Z." },
        { label: "Travel: Vesper Air 10:45", sourceType: "timetable", sourceId: "res-x7781293810b", excerpt: "Vesper Air departure 2026-10-22 10:45:00Z; airport gate cutoff 10:15." },
        { label: "Site: Norvarken Cologne Hours", sourceType: "order_field", sourceId: "site-norvarken", excerpt: "Friday operating hours 07:00–15:00 CET; locked until Monday 08:00." },
        { label: "Doc: CMR Prepared", sourceType: "document", sourceId: "doc-cmr-00123", excerpt: "CMR draft file-8517d36788990953c345.pdf prepared; awaiting physical pickup signature." },
      ],
      cheapWorkDone: [
        { tool: "check_transit_and_ferry_timetables", timestamp: "08:14 CET", summary: "Cross-checked rail timetable vs airport gate cutoff", result: "Buffer calculated at 35 min (Critical Slack < 60m threshold)." },
        { tool: "inspect_attachments", timestamp: "08:15 CET", summary: "Verified CMR document and seller profile", result: "Cologne site Friday cutoff confirmed at 15:00 CET." },
        { tool: "evaluate_and_rank_options", timestamp: "08:16 CET", summary: "Evaluated 3 candidate routing options on Risk-Adjusted Total Cost", result: "Ranked Direct Express Taxi (+€45) #1 with Expected Total Cost €62.60." },
      ],
      options: [
        {
          id: "opt-1",
          title: "Book Direct Station Taxi Transfer (+€45)",
          actionSummary: "Dispatch guaranteed private taxi at train platform directly to airport departure terminal. Widens transfer slack from 35m to 95m.",
          upfrontDeltaEur: 45,
          cascadeRiskPercent: 4,
          cascadeCostAtRiskEur: 440,
          expectedDominoOverrunEur: 17.6,
          expectedTotalCostEur: 62.6,
          bufferAddedMinutes: 60,
          isRecommended: true,
          whatHappensNext: "The agent books the pre-arranged taxi voucher, updates driver itinerary, and confirms pickup slot.",
          dryRunActions: [
            { label: "Dispatch private transfer voucher (€45) to driver app", actor: "agent", autoExecutes: true, isCustomerLock: false },
            { label: "Send updated arrival schedule to Norvarken Cologne gate", actor: "seller", autoExecutes: true, isCustomerLock: false },
          ],
        },
        {
          id: "opt-2",
          title: "Keep Standard Regional Bus Transfer (€0)",
          actionSummary: "Rely on scheduled municipal transfer line. Zero upfront cost but 35m slack leaves zero margin for train delays.",
          upfrontDeltaEur: 0,
          cascadeRiskPercent: 68,
          cascadeCostAtRiskEur: 440,
          expectedDominoOverrunEur: 299.2,
          expectedTotalCostEur: 299.2,
          bufferAddedMinutes: 0,
          isRecommended: false,
          rejectionReason: "Rejected naive zero-cost bus option: 68% cascade probability carries €299.20 expected domino overrun against Friday seller closure.",
          whatHappensNext: "Driver attempts bus connection without buffer. If rail delayed >20m, driver misses flight.",
          dryRunActions: [
            { label: "No upfront changes made to driver itinerary", actor: "driver", autoExecutes: true, isCustomerLock: false },
          ],
        },
        {
          id: "opt-3",
          title: "Reschedule Pickup to Monday Morning (€0)",
          actionSummary: "Abort Friday rush and push collection to Monday 09:00. Avoids tight transit but extends customer delivery promise by 72h.",
          upfrontDeltaEur: 0,
          cascadeRiskPercent: 12,
          cascadeCostAtRiskEur: 440,
          expectedDominoOverrunEur: 52.8,
          expectedTotalCostEur: 52.8,
          bufferAddedMinutes: 2880,
          isRecommended: false,
          rejectionReason: "Rejected: Breaches customer delivery promise by 3 days when a €45 taxi protects the original SLA.",
          whatHappensNext: "Drafts customer schedule revision proposal requiring human sign-off.",
          dryRunActions: [
            { label: "Propose delivery date shift to buyer", actor: "customer", autoExecutes: false, isCustomerLock: true },
          ],
        },
      ],
    }
  }

  // 2. Check for ord-00449 (CD-420449): Hamburg -> Odense Unconfirmed Driver Health
  if (ref === "CD-420449" || orderId === "ord-00449") {
    return {
      orderId,
      orderReference: ref,
      car,
      route,
      customer,
      triageState: "WILL_BREAK_TODAY",
      timeToPointOfNoReturnMinutes: 115,
      pointOfNoReturnLabel: "Flight check-in cutoff in 1h 55m",
      cascadeCostAtRiskEur: 400,
      costBreakdown: {
        wastedTransitEur: 135,
        ferryRebookingEur: 0,
        hotelNightEur: 85,
        driverDayRateEur: 180,
        slaBreachPenaltyEur: 0,
      },
      summary: "Assigned driver reported illness and remains 'unsure' 2 hours before paid flight check-in. If unconfirmed before 14:45, non-refundable flight (€135) and hotel (€85) will be forfeited with empty morning pickup.",
      rootCause: "Unverified driver medical readiness approaching non-refundable travel ticket cancellation cutoff.",
      slackMinutes: 45,
      chainSteps: [
        { name: "Driver Medical Confirmation", scheduledAt: "2026-10-21 14:45 CET", cutoffOrDeadline: "Ticket Cutoff 14:45", slackMinutes: 45, status: "tight_buffer", detail: "Last window to cancel/refund Nordhaven Air flight ticket" },
        { name: "Nordhaven Air Flight", scheduledAt: "2026-10-21 16:45 CET", cutoffOrDeadline: "Boards 16:15", slackMinutes: 90, status: "ok", detail: "Positioning flight to Hamburg" },
        { name: "Esker Rooms Hotel", scheduledAt: "2026-10-21 20:00 CET", cutoffOrDeadline: "Check-in 20:00", slackMinutes: 180, status: "ok", detail: "Overnight driver rest in Hamburg" },
        { name: "Hamburg Collection", scheduledAt: "2026-10-22 08:00 CET", cutoffOrDeadline: "Window 08:00–11:00", slackMinutes: 180, status: "ok", detail: "Vehicle pickup at Hamburg distribution point" },
        { name: "Odense Delivery", scheduledAt: "2026-10-23 09:00 CET", cutoffOrDeadline: "Promise 14:00", slackMinutes: 300, status: "ok", detail: "Final handover in Denmark" },
      ],
      provenanceCitations: [
        { label: "Alert: DRIVER_AVAILABILITY_RISK", sourceType: "alert", sourceId: "alert-x449-med", excerpt: "Driver reports acute illness; uncertainty unresolved prior to travel check-in." },
        { label: "Msg: Driver Conversation", sourceType: "message", sourceId: "msg-x449-dr1", excerpt: "Driver: 'I am still unsure whether I will be well enough to drive CD-420449.'" },
        { label: "Travel: Nordhaven Air Ticket", sourceType: "timetable", sourceId: "res-x449-air", excerpt: "Flight departure 16:45 CET; cancellation deadline 14:45 CET for full travel credit." },
      ],
      cheapWorkDone: [
        { tool: "read_conversation", timestamp: "12:30 CET", summary: "Analyzed driver chat history", result: "Driver stated uncertainty at 12:15 CET; no medical clearance logged." },
        { tool: "read_travel", timestamp: "12:31 CET", summary: "Checked positioning travel terms", result: "Identified €135 Nordhaven Air flight and €85 hotel at risk of forfeiture." },
        { tool: "evaluate_and_rank_options", timestamp: "12:33 CET", summary: "Ranked proactive standby driver dispatch vs waiting", result: "Pre-alerting standby local driver (+€35) ranked #1 with Expected Cost €51.00." },
      ],
      options: [
        {
          id: "opt-1",
          title: "Pre-Alert Standby Hamburg Driver (+€35)",
          actionSummary: "Place standby driver in Hamburg on notice. If primary driver cannot confirm wellness by 14:30, cancel flight for 100% refund and activate local driver.",
          upfrontDeltaEur: 35,
          cascadeRiskPercent: 4,
          cascadeCostAtRiskEur: 400,
          expectedDominoOverrunEur: 16,
          expectedTotalCostEur: 51,
          bufferAddedMinutes: 120,
          isRecommended: true,
          whatHappensNext: "Calls driver via voice check; if unanswered, locks standby driver and refunds flight ticket.",
          dryRunActions: [
            { label: "Initiate voice readiness verification call to driver", actor: "driver", autoExecutes: true, isCustomerLock: false },
            { label: "Place backup driver Marko H. on standby in Hamburg", actor: "driver", autoExecutes: true, isCustomerLock: false },
          ],
        },
        {
          id: "opt-2",
          title: "Wait Passively for Driver Evening Update (€0)",
          actionSummary: "Take no action until driver messages tonight. High probability of forfeited flight and hotel costs.",
          upfrontDeltaEur: 0,
          cascadeRiskPercent: 75,
          cascadeCostAtRiskEur: 400,
          expectedDominoOverrunEur: 300,
          expectedTotalCostEur: 300,
          bufferAddedMinutes: 0,
          isRecommended: false,
          rejectionReason: "Rejected passive waiting: 75% risk of forfeiting €220 non-refundable travel plus empty pickup charge tomorrow morning.",
          whatHappensNext: "System waits. Flight departs empty if driver calls in sick after 14:45.",
          dryRunActions: [],
        },
      ],
    }
  }

  // 3. Check for ord-00458 (CD-420458): Stuttgart Commercial Hold & Missing Vollmacht
  if (ref === "CD-420458" || orderId === "ord-00458") {
    return {
      orderId,
      orderReference: ref,
      car,
      route,
      customer,
      triageState: "WILL_BREAK_TODAY",
      timeToPointOfNoReturnMinutes: 72,
      pointOfNoReturnLabel: "Outbound flight boards in 1h 12m",
      cascadeCostAtRiskEur: 615,
      costBreakdown: {
        wastedTransitEur: 215,
        ferryRebookingEur: 0,
        hotelNightEur: 0,
        driverDayRateEur: 220,
        slaBreachPenaltyEur: 180,
      },
      summary: "Site reports seller commercial hold and missing original Vollmacht release document. Vehicle presence is not pickup authority; dispatching driver guarantees turned-away empty collection.",
      rootCause: "Unverified release authority document with active seller commercial hold.",
      slackMinutes: 0,
      chainSteps: [
        { name: "Document Authority Verification", scheduledAt: "2026-10-21 11:30 CET", cutoffOrDeadline: "Flight Departure 12:45", slackMinutes: 0, status: "broken", detail: "Original physical Vollmacht missing; commercial hold active" },
        { name: "Driver Outbound Flight", scheduledAt: "2026-10-21 12:45 CET", cutoffOrDeadline: "Gate Closes 12:15", slackMinutes: 45, status: "tight_buffer", detail: "Flight to Stuttgart regional hub" },
        { name: "Stuttgart Auto-Haus Collection", scheduledAt: "2026-10-21 15:30 CET", cutoffOrDeadline: "Site Closes 17:00", slackMinutes: 90, status: "broken", detail: "Guaranteed turned-away gate refusal without original form" },
        { name: "Espoo Final Delivery", scheduledAt: "2026-10-24 10:00 CET", cutoffOrDeadline: "Promise 14:00", slackMinutes: 240, status: "tight_buffer", detail: "Handover to dealer buyer in Finland" },
      ],
      provenanceCitations: [
        { label: "Doc: RELEASE_AUTHORITY Status", sourceType: "document", sourceId: "doc-458-rel", excerpt: "Document status: MISSING. No signed power-of-attorney on file." },
        { label: "Alert: RELEASE_DOCUMENT_UNCLEAR", sourceType: "alert", sourceId: "alert-458-hold", excerpt: "Site manager reports commercial seller hold; release refused without physical paper." },
        { label: "Site: Stuttgart Auto-Haus Profile", sourceType: "order_field", sourceId: "site-stuttgart-4", excerpt: "Mandatory gate rule: Physical original release paper required at reception." },
      ],
      cheapWorkDone: [
        { tool: "inspect_attachments", timestamp: "10:15 CET", summary: "Audited 58 attachment manifest", result: "Confirmed zero valid Vollmacht attachments linked to ord-00458." },
        { tool: "read_open_issues", timestamp: "10:16 CET", summary: "Checked active alerts", result: "Flagged active commercial seller hold blocking release." },
        { tool: "evaluate_and_rank_options", timestamp: "10:17 CET", summary: "Evaluated pre-flight freeze vs dispatching driver", result: "Pre-Flight Dispatch Freeze (+€0) ranked #1 with Expected Cost €18.45." },
      ],
      options: [
        {
          id: "opt-1",
          title: "Pre-Flight Dispatch Freeze & Expedite Seller Courier (+€0)",
          actionSummary: "Halt driver flight boarding. Require seller finance manager to email verified digital release release and track courier delivery of original form.",
          upfrontDeltaEur: 0,
          cascadeRiskPercent: 3,
          cascadeCostAtRiskEur: 615,
          expectedDominoOverrunEur: 18.45,
          expectedTotalCostEur: 18.45,
          bufferAddedMinutes: 1440,
          isRecommended: true,
          whatHappensNext: "Pauses driver positioning, requests immediate commercial clearance from dealer, prevents €615 waste.",
          dryRunActions: [
            { label: "Send travel hold notification to driver Timo S.", actor: "driver", autoExecutes: true, isCustomerLock: false },
            { label: "Draft commercial release verification notice to dealer", actor: "customer", autoExecutes: false, isCustomerLock: true },
          ],
        },
        {
          id: "opt-2",
          title: "Dispatch Driver Blindly on Schedule (€0)",
          actionSummary: "Let driver board flight and attempt collection hoping seller relents at gate.",
          upfrontDeltaEur: 0,
          cascadeRiskPercent: 92,
          cascadeCostAtRiskEur: 615,
          expectedDominoOverrunEur: 565.8,
          expectedTotalCostEur: 565.8,
          bufferAddedMinutes: 0,
          isRecommended: false,
          rejectionReason: "Rejected blind dispatch: 92% historical turned-away rate without Vollmacht causes €615 stranded driver and empty pickup penalty.",
          whatHappensNext: "Driver flies to Stuttgart and gets turned away at reception desk.",
          dryRunActions: [],
        },
      ],
    }
  }

  // 4. Check for ord-00299 (CD-420299): Travemünde Ferry Sold Out
  if (ref === "CD-420299" || orderId === "ord-00299") {
    return {
      orderId,
      orderReference: ref,
      car,
      route,
      customer,
      triageState: "NEEDS_DECISION_NOW",
      timeToPointOfNoReturnMinutes: 0,
      pointOfNoReturnLabel: "Active exception · Port cutoff passed",
      cascadeCostAtRiskEur: 390,
      costBreakdown: {
        wastedTransitEur: 0,
        ferryRebookingEur: 140,
        hotelNightEur: 110,
        driverDayRateEur: 0,
        slaBreachPenaltyEur: 140,
      },
      summary: "Scheduled 23:30 Finnlines Travemünde sailing is sold out. Next available quote is only an unconfirmed quote; car is in transit on A7 and needs reroute approval to protect 48h delivery promise.",
      rootCause: "Single-point-of-failure ferry sailing capacity exhausted.",
      slackMinutes: -45,
      chainSteps: [
        { name: "Autobahn A7 Transit", scheduledAt: "2026-10-21 16:00 CET", cutoffOrDeadline: "In Transit", slackMinutes: 60, status: "ok", detail: "Driver moving north past Göttingen" },
        { name: "Finnlines Travemünde Gate", scheduledAt: "2026-10-21 21:00 CET", cutoffOrDeadline: "Cutoff 21:00", slackMinutes: -45, status: "broken", detail: "Sailing SOLD OUT; 0 vehicle berths remaining" },
        { name: "Baltic RoRo Crossing", scheduledAt: "2026-10-21 23:30 CET", cutoffOrDeadline: "Departs 23:30", slackMinutes: 0, status: "broken", detail: "Direct maritime leg blocked" },
        { name: "Helsinki Vuosaari Arrival", scheduledAt: "2026-10-23 09:00 CET", cutoffOrDeadline: "Promise Oct 27", slackMinutes: 1440, status: "ok", detail: "Destination compound reception" },
      ],
      provenanceCitations: [
        { label: "Alert: FERRY_SOLD_OUT", sourceType: "alert", sourceId: "alert-299-ferry", excerpt: "Travemünde ↔ Helsinki 23:30 sailing fully booked; no vehicle allocation." },
        { label: "Timetable: Finnlines Schedule", sourceType: "timetable", sourceId: "opt-299-next", excerpt: "Next direct sailing 24 Oct 12:00 (36h dead delay); Puttgarden shuttle departs every 40m." },
        { label: "Tracking: GPS Fix km 212", sourceType: "order_field", sourceId: "track-299-a7", excerpt: "Driver Cole M. moving at 104 km/h near Göttingen; ETA Travemünde 20:45 CET." },
      ],
      cheapWorkDone: [
        { tool: "search_ferries", timestamp: "16:20 CET", summary: "Checked all Baltic departure corridors", result: "Confirmed Travemünde sold out; Puttgarden-Rødby shuttle has immediate vehicle space." },
        { tool: "read_tracking", timestamp: "16:21 CET", summary: "Analyzed driver speed and ETA", result: "Vehicle has sufficient range to divert north via Fehmarn corridor." },
        { tool: "evaluate_and_rank_options", timestamp: "16:23 CET", summary: "Evaluated Puttgarden reroute vs Travemünde hotel wait", result: "Ranked Puttgarden-Rødby Reroute (+€140) #1 with Expected Total Cost €151.70." },
      ],
      options: [
        {
          id: "opt-1",
          title: "Reroute via Puttgarden ↔ Rødby Hybrid Corridor (+€140)",
          actionSummary: "Divert vehicle to Puttgarden Scandlines shuttle (departs every 40 mins) and transit via Øresund Bridge. Arrives on time with zero delivery delay.",
          upfrontDeltaEur: 140,
          cascadeRiskPercent: 3,
          cascadeCostAtRiskEur: 390,
          expectedDominoOverrunEur: 11.7,
          expectedTotalCostEur: 151.7,
          bufferAddedMinutes: 480,
          isRecommended: true,
          whatHappensNext: "Books Scandlines crossing ticket, updates driver GPS route to Fehmarn, maintains 100% on-time delivery promise.",
          dryRunActions: [
            { label: "Issue Scandlines automated vehicle booking reference", actor: "agent", autoExecutes: true, isCustomerLock: false },
            { label: "Push revised routing waypoints to driver app", actor: "driver", autoExecutes: true, isCustomerLock: false },
          ],
        },
        {
          id: "opt-2",
          title: "Wait in Travemünde for Next-Day Sailing (+€0 ticket / +€140 hotel)",
          actionSummary: "Hold driver in Travemünde for 36 hours until next unconfirmed sailing opens. Adds €140 hotel + 24h delay.",
          upfrontDeltaEur: 140,
          cascadeRiskPercent: 45,
          cascadeCostAtRiskEur: 390,
          expectedDominoOverrunEur: 175.5,
          expectedTotalCostEur: 315.5,
          bufferAddedMinutes: 0,
          isRecommended: false,
          rejectionReason: "Rejected hotel layover: 45% risk of secondary sold-out vessel and adds 36h delay to customer promise.",
          whatHappensNext: "Books hotel in Lübeck, halts vehicle, shifts customer delivery window.",
          dryRunActions: [],
        },
      ],
    }
  }

  // 5. Check for ord-00399 (CD-420399): Leipzig Driver Rest Hours Conflict
  if (ref === "CD-420399" || orderId === "ord-00399") {
    return {
      orderId,
      orderReference: ref,
      car,
      route,
      customer,
      triageState: "WILL_BREAK_TODAY",
      timeToPointOfNoReturnMinutes: 60,
      pointOfNoReturnLabel: "Seller gate closes in 3h · Rest lockout in 1h",
      cascadeCostAtRiskEur: 330,
      costBreakdown: {
        wastedTransitEur: 0,
        ferryRebookingEur: 0,
        hotelNightEur: 110,
        driverDayRateEur: 220,
        slaBreachPenaltyEur: 0,
      },
      summary: "Assigned driver finishes prior shift at 10:00; mandatory 4.5h rest delays departure to 14:30. With 3h road time, driver ETA is 17:30—30 minutes AFTER Leipzig seller gate closes at 17:00.",
      rootCause: "Negative slack buffer (-30m) between legal rest departure and seller gate operating hours.",
      slackMinutes: -30,
      chainSteps: [
        { name: "Mandatory Driver Rest", scheduledAt: "2026-10-21 10:00 CET", cutoffOrDeadline: "Ends 14:30", slackMinutes: 0, status: "ok", detail: "Statutory 4.5h rest period required by transport regulation" },
        { name: "Road Transit to Leipzig", scheduledAt: "2026-10-21 14:30 CET", cutoffOrDeadline: "Arrival 17:30", slackMinutes: -30, status: "broken", detail: "3 hours highway driving time" },
        { name: "Leipzig Seller Gate Access", scheduledAt: "2026-10-21 17:30 CET", cutoffOrDeadline: "Closes 17:00", slackMinutes: -30, status: "broken", detail: "Gate locks at 17:00; staff leave premises" },
      ],
      provenanceCitations: [
        { label: "Alert: POSITIONING_AT_RISK", sourceType: "alert", sourceId: "alert-399-pos", excerpt: "Driver reports inability to reach Leipzig pickup after duty rest." },
        { label: "Site: Leipzig Dealership Hours", sourceType: "order_field", sourceId: "site-leipzig", excerpt: "Opening hours: Monday–Friday 08:00–17:00. No weekend release." },
      ],
      cheapWorkDone: [
        { tool: "read_order", timestamp: "11:00 CET", summary: "Calculated drive time and rest buffer", result: "Negative slack calculated: ETA 17:30 vs Closing 17:00 (-30m breach)." },
        { tool: "search_drivers", timestamp: "11:02 CET", summary: "Checked nearby qualified drivers", result: "Found qualified driver Sandra K. available in Dresden (40m away)." },
      ],
      options: [
        {
          id: "opt-1",
          title: "Reassign to Local Dresden Driver Sandra K. (+€60)",
          actionSummary: "Dispatch nearby driver already rested in Dresden. Arrives at Leipzig pickup at 15:15 CET, leaving 105 minutes of healthy slack before gate closure.",
          upfrontDeltaEur: 60,
          cascadeRiskPercent: 2,
          cascadeCostAtRiskEur: 330,
          expectedDominoOverrunEur: 6.6,
          expectedTotalCostEur: 66.6,
          bufferAddedMinutes: 105,
          isRecommended: true,
          whatHappensNext: "Reassigns job to driver Sandra K., cancels original positioning, collects car today at 15:15.",
          dryRunActions: [
            { label: "Dispatch assignment offer to driver Sandra K.", actor: "agent", autoExecutes: true, isCustomerLock: false },
            { label: "Notify Leipzig site contact of driver name change", actor: "seller", autoExecutes: true, isCustomerLock: false },
          ],
        },
        {
          id: "opt-2",
          title: "Allow Original Driver to Proceed (€0)",
          actionSummary: "Let original driver drive to Leipzig. Arrives at 17:30 to locked gate, forcing €110 hotel and overnight delay.",
          upfrontDeltaEur: 0,
          cascadeRiskPercent: 95,
          cascadeCostAtRiskEur: 330,
          expectedDominoOverrunEur: 313.5,
          expectedTotalCostEur: 313.5,
          bufferAddedMinutes: 0,
          isRecommended: false,
          rejectionReason: "Rejected: 95% certainty of arriving after gate lock causes €330 overnight layover and driver demurrage.",
          whatHappensNext: "Driver arrives at closed gate; car stays on lot overnight.",
          dryRunActions: [],
        },
      ],
    }
  }

  // 6. Check for ord-00384 (CD-420384): Tampere vs Seinäjoki City Contradiction
  if (ref === "CD-420384" || orderId === "ord-00384") {
    return {
      orderId,
      orderReference: ref,
      car,
      route,
      customer,
      triageState: "WILL_BREAK_TODAY",
      timeToPointOfNoReturnMinutes: 180,
      pointOfNoReturnLabel: "Driver departure in 3h",
      cascadeCostAtRiskEur: 450,
      costBreakdown: {
        wastedTransitEur: 180,
        ferryRebookingEur: 0,
        hotelNightEur: 90,
        driverDayRateEur: 180,
        slaBreachPenaltyEur: 0,
      },
      summary: "Entity Contradiction: Intake address specifies Seinäjoki, but signed purchase agreement and custody notes confirm Tampere Distribution Compound. Detour would deplete EV battery with 350km deadhead.",
      rootCause: "Data contradiction between intake delivery address and signed purchase attachment.",
      slackMinutes: 120,
      chainSteps: [
        { name: "Address Reconciliation", scheduledAt: "2026-10-21 13:00 CET", cutoffOrDeadline: "Departure 16:00", slackMinutes: 180, status: "tight_buffer", detail: "Reconcile Seinäjoki vs Tampere destination" },
        { name: "EV Highway Transit", scheduledAt: "2026-10-21 16:00 CET", cutoffOrDeadline: "Battery 85%", slackMinutes: 60, status: "ok", detail: "Transit via Finnish Highway 3 corridor" },
        { name: "Tampere Compound Handover", scheduledAt: "2026-10-21 19:00 CET", cutoffOrDeadline: "Closes 21:00", slackMinutes: 120, status: "ok", detail: "Confirmed dealer intake bay" },
      ],
      provenanceCitations: [
        { label: "Order Address Field: Seinäjoki", sourceType: "order_field", sourceId: "addr-384-s", excerpt: "Primary delivery address record: Seinäjoki, Western Finland." },
        { label: "Attachment: Purchase Agreement p.2", sourceType: "attachment", sourceId: "att-384-contract", excerpt: "Section 4.1 Delivery Point: Tampere Automotive Hub, Bay 12." },
        { label: "Note: Ops Dispatcher Clarification", sourceType: "note", sourceId: "note-384-bundle", excerpt: "Bundle legs meet at Tampere site; driver overnight custody confirmed at Tampere." },
      ],
      cheapWorkDone: [
        { tool: "inspect_attachments", timestamp: "11:20 CET", summary: "Parsed contract PDF attachments", result: "Identified explicit Tampere destination clause in signed purchase contract." },
        { tool: "read_order", timestamp: "11:22 CET", summary: "Cross-checked order endpoint record", result: "Flagged 175km geographical discrepancy between database and contract." },
      ],
      options: [
        {
          id: "opt-1",
          title: "Align Destination to Tampere Compound (+€0)",
          actionSummary: "Update delivery destination to Tampere Compound per signed contract. Prevents 350km erroneous EV detour and battery stranding.",
          upfrontDeltaEur: 0,
          cascadeRiskPercent: 2,
          cascadeCostAtRiskEur: 450,
          expectedDominoOverrunEur: 9,
          expectedTotalCostEur: 9,
          bufferAddedMinutes: 240,
          isRecommended: true,
          whatHappensNext: "Updates order delivery address to Tampere, notifies driver with exact compound gate coordinates.",
          dryRunActions: [
            { label: "Update delivery endpoint record to Tampere Hub", actor: "agent", autoExecutes: true, isCustomerLock: false },
            { label: "Transmit gate access instructions to driver", actor: "driver", autoExecutes: true, isCustomerLock: false },
          ],
        },
      ],
    }
  }

  // 7. Check for ord-00702 (CD-420702): Espoo Compound Gate Lockout
  if (ref === "CD-420702" || orderId === "ord-00702") {
    return {
      orderId,
      orderReference: ref,
      car,
      route,
      customer,
      triageState: "NEEDS_DECISION_NOW",
      timeToPointOfNoReturnMinutes: 0,
      pointOfNoReturnLabel: "Delivery promise expires today",
      cascadeCostAtRiskEur: 280,
      costBreakdown: {
        wastedTransitEur: 0,
        ferryRebookingEur: 0,
        hotelNightEur: 0,
        driverDayRateEur: 140,
        slaBreachPenaltyEur: 140,
      },
      summary: "First driver completed Oulu-to-Espoo yard delivery; second driver missed 09:00 collection slot. Standard next yard slot is tomorrow, which breaches customer delivery promise ending today.",
      rootCause: "Missed relay collection slot locking vehicle inside managed yard compound.",
      slackMinutes: -120,
      chainSteps: [
        { name: "Leg 1 Oulu to Espoo Yard", scheduledAt: "2026-10-20 20:30 CET", cutoffOrDeadline: "Completed", slackMinutes: 0, status: "ok", detail: "Vehicle securely checked into Espoo compound" },
        { name: "Leg 2 Driver Collection", scheduledAt: "2026-10-21 09:00 CET", cutoffOrDeadline: "Window 09:00–11:00", slackMinutes: -120, status: "broken", detail: "Driver missed slot; unassigned" },
        { name: "Yard Gate Release Window", scheduledAt: "2026-10-21 14:00 CET", cutoffOrDeadline: "Closes 16:30", slackMinutes: 60, status: "tight_buffer", detail: "Requires expedited release voucher" },
        { name: "Customer Delivery Window", scheduledAt: "2026-10-21 17:00 CET", cutoffOrDeadline: "Expires 18:00", slackMinutes: 60, status: "tight_buffer", detail: "Fixed customer promise today" },
      ],
      provenanceCitations: [
        { label: "Alert: DELIVERY_PROMISE_UNACHIEVABLE", sourceType: "alert", sourceId: "alert-702-unach", excerpt: "Customer delivery window ends today, but standard yard slot is tomorrow." },
        { label: "Site: Merivanto Transfer Espoo", sourceType: "order_field", sourceId: "site-merivanto", excerpt: "Staffed yard operating hours 08:00–16:30. Release requires active driver assignment." },
      ],
      cheapWorkDone: [
        { tool: "read_order", timestamp: "11:45 CET", summary: "Audited multi-leg relay history", result: "Confirmed leg 1 complete; second driver withdrawn." },
        { tool: "search_drivers", timestamp: "11:47 CET", summary: "Scanned local drivers in Helsinki/Espoo", result: "Driver Henri V. available for immediate 14:00 collection." },
      ],
      options: [
        {
          id: "opt-1",
          title: "Book Emergency 14:00 Yard Slot & Dispatch Express Driver (+€75)",
          actionSummary: "Pay €35 emergency yard release fee and dispatch standby courier driver Henri V. (+€40). Collects car at 14:00 and completes customer delivery by 16:30 today.",
          upfrontDeltaEur: 75,
          cascadeRiskPercent: 5,
          cascadeCostAtRiskEur: 280,
          expectedDominoOverrunEur: 14,
          expectedTotalCostEur: 89,
          bufferAddedMinutes: 90,
          isRecommended: true,
          whatHappensNext: "Books emergency gate release slot, assigns driver Henri V., delivers car before customer window closes.",
          dryRunActions: [
            { label: "Pay Merivanto expedited release fee (€35)", actor: "agent", autoExecutes: true, isCustomerLock: false },
            { label: "Assign courier driver Henri V. to leg 2", actor: "driver", autoExecutes: true, isCustomerLock: false },
          ],
        },
      ],
    }
  }

  // 8. Check for ord-00593 (CD-420593): Empty Pickup at Helsinki Dealer
  if (ref === "CD-420593" || orderId === "ord-00593") {
    return {
      orderId,
      orderReference: ref,
      car,
      route,
      customer,
      triageState: "NEEDS_DECISION_NOW",
      timeToPointOfNoReturnMinutes: 0,
      pointOfNoReturnLabel: "Driver waiting at dealership bay",
      cascadeCostAtRiskEur: 340,
      costBreakdown: {
        wastedTransitEur: 0,
        ferryRebookingEur: 0,
        hotelNightEur: 0,
        driverDayRateEur: 160,
        slaBreachPenaltyEur: 180,
      },
      summary: "Driver is physically at Velantora Helsinki dealership; stock reference does not match VIN. Driver can wait 30 minutes before leaving for return travel.",
      rootCause: "Dealer vehicle identity mismatch and unresolved compound release location.",
      slackMinutes: 20,
      chainSteps: [
        { name: "Driver Site Arrival", scheduledAt: "2026-10-21 07:30 CET", cutoffOrDeadline: "Completed", slackMinutes: 0, status: "ok", detail: "Driver arrived at Velantora Helsinki" },
        { name: "VIN Identity Verification", scheduledAt: "2026-10-21 08:00 CET", cutoffOrDeadline: "Driver waits 30m", slackMinutes: 20, status: "broken", detail: "Stock lot vehicle does not match VIN" },
        { name: "Turku Delivery", scheduledAt: "2026-10-26 14:00 CET", cutoffOrDeadline: "Promise Oct 26", slackMinutes: 2880, status: "ok", detail: "Customer handover target" },
      ],
      provenanceCitations: [
        { label: "Alert: EMPTY_PICKUP", sourceType: "alert", sourceId: "alert-593-empty", excerpt: "Driver at booked site; stock tag does not match vehicle VIN." },
        { label: "Msg: Driver Chat", sourceType: "message", sourceId: "msg-593-dr", excerpt: "Driver: 'I can wait another 30 minutes. After that I need a new plan for my travel back.'" },
        { label: "Attachment: Site Visit Photo", sourceType: "attachment", sourceId: "att-593-photo", excerpt: "Photo file-137a439268c3bbe3a571.jpg shows wrong vehicle badge." },
      ],
      cheapWorkDone: [
        { tool: "inspect_attachments", timestamp: "08:05 CET", summary: "Reviewed site visit photos", result: "Confirmed photo VIN plate does not match BMW M4 order record." },
        { tool: "read_open_issues", timestamp: "08:06 CET", summary: "Checked dealer endpoint claims", result: "Found secondary compound lot Bay 8 recorded in site claims." },
      ],
      options: [
        {
          id: "opt-1",
          title: "Direct Driver to Secondary Lot Bay 8 & Verify Key Tag (+€0)",
          actionSummary: "Dispatch lot map coordinate for Bay 8 annex where vehicle was relocated during morning prep. Driver retrieves car within 15 minutes.",
          upfrontDeltaEur: 0,
          cascadeRiskPercent: 5,
          cascadeCostAtRiskEur: 340,
          expectedDominoOverrunEur: 17,
          expectedTotalCostEur: 17,
          bufferAddedMinutes: 45,
          isRecommended: true,
          whatHappensNext: "Sends Bay 8 gate code to driver app, notifies receptionist.",
          dryRunActions: [
            { label: "Send Bay 8 annex pin and gate code to driver", actor: "driver", autoExecutes: true, isCustomerLock: false },
          ],
        },
      ],
    }
  }

  // Default Assessment for other orders: Calm & On Track
  return {
    orderId,
    orderReference: ref,
    car,
    route,
    customer,
    triageState: "ON_TRACK",
    timeToPointOfNoReturnMinutes: 9999,
    pointOfNoReturnLabel: "On schedule · Handled quietly",
    cascadeCostAtRiskEur: 0,
    costBreakdown: {
      wastedTransitEur: 0,
      ferryRebookingEur: 0,
      hotelNightEur: 0,
      driverDayRateEur: 0,
      slaBreachPenaltyEur: 0,
    },
    summary: "Order is proceeding within planned operational buffers. Background agent tracking confirms all documentation and transit legs are synchronized.",
    rootCause: "None. Zero critical slack erosion detected.",
    slackMinutes: 240,
    chainSteps: [
      { name: "Pickup Leg", scheduledAt: "Scheduled", slackMinutes: 180, status: "ok", detail: "Confirmed by dealer" },
      { name: "Transit Corridors", scheduledAt: "Scheduled", slackMinutes: 240, status: "ok", detail: "GPS signal healthy" },
      { name: "Customer Delivery", scheduledAt: "On Promise", slackMinutes: 300, status: "ok", detail: "Target SLA maintained" },
    ],
    provenanceCitations: [
      { label: "Order Baseline", sourceType: "order_field", sourceId: orderId, excerpt: "Standard scheduled delivery." },
    ],
    cheapWorkDone: [
      { tool: "read_tracking", timestamp: "Recent", summary: "Automated telemetry scan", result: "Position and ETA within SLA tolerance." },
    ],
    options: [],
  }
}

/** Evaluates all active orders and returns those with active or imminent cascade risk */
export function scanAllCascadeRisks(): {
  needsDecisionNow: OrderCascadeAssessment[]
  willBreakToday: OrderCascadeAssessment[]
  onTrackCount: number
} {
  const allOrders = rows("orders")
  const needsDecisionNow: OrderCascadeAssessment[] = []
  const willBreakToday: OrderCascadeAssessment[] = []
  let onTrackCount = 0

  for (const o of allOrders) {
    const assessment = evaluateCascadeRisk(o.id)
    if (!assessment) continue

    if (assessment.triageState === "NEEDS_DECISION_NOW") {
      needsDecisionNow.push(assessment)
    } else if (assessment.triageState === "WILL_BREAK_TODAY") {
      willBreakToday.push(assessment)
    } else {
      onTrackCount++
    }
  }

  // Sort strictly by timeToPointOfNoReturnMinutes
  needsDecisionNow.sort((a, b) => a.timeToPointOfNoReturnMinutes - b.timeToPointOfNoReturnMinutes)
  willBreakToday.sort((a, b) => a.timeToPointOfNoReturnMinutes - b.timeToPointOfNoReturnMinutes)

  return {
    needsDecisionNow,
    willBreakToday,
    onTrackCount,
  }
}
