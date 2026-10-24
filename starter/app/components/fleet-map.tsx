"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { Icon } from "./icons"

export interface MapVehicle {
  id: string
  reference: string
  make: string
  model: string
  year: number
  plate: string
  vin: string
  driver: string
  driverId: string
  fromCity: string
  toCity: string
  currentLocationName: string
  lat: number
  lng: number
  x: number // SVG X coordinate (0-1000)
  y: number // SVG Y coordinate (0-720)
  status: "EXCEPTION" | "IN_TRANSIT" | "ON_FERRY" | "AT_COMPOUND"
  urgency?: "now" | "today" | "soon" | "watch"
  headline?: string
  why?: string
  costAtRisk?: number
  hoursDelta?: number
  speedKmh?: number
  fuelOrBattery?: string
  vesselName?: string
}

export interface MapVessel {
  id: string
  name: string
  route: string
  operator: string
  fromPort: string
  toPort: string
  x: number
  y: number
  progressPct: number
  carsOnboard: number
  departureTime: string
  eta: string
  headingDeg: number
}

export interface MapHub {
  id: string
  name: string
  city: string
  country: string
  x: number
  y: number
  kind: "ferry_terminal" | "distribution_compound" | "rail_hub" | "dealer_lot"
  carsPresent: number
}

// Key Hubs in the Northern/Central European Corridor
const HUBS: MapHub[] = [
  { id: "hub-munich", name: "Munich Southern Logistics", city: "Munich", country: "DE", x: 310, y: 640, kind: "dealer_lot", carsPresent: 6 },
  { id: "hub-stuttgart", name: "Stuttgart Dealer Compound", city: "Stuttgart", country: "DE", x: 230, y: 610, kind: "dealer_lot", carsPresent: 4 },
  { id: "hub-frankfurt", name: "Frankfurt Airport Freight Yard", city: "Frankfurt", country: "DE", x: 220, y: 530, kind: "distribution_compound", carsPresent: 8 },
  { id: "hub-berlin", name: "Berlin Brandenburg Hub", city: "Berlin", country: "DE", x: 440, y: 440, kind: "distribution_compound", carsPresent: 7 },
  { id: "hub-hamburg", name: "Hamburg Central Yard", city: "Hamburg", country: "DE", x: 315, y: 360, kind: "distribution_compound", carsPresent: 11 },
  { id: "hub-travemunde", name: "Travemünde Baltic Gate (Finnlines)", city: "Lübeck/Travemünde", country: "DE", x: 350, y: 345, kind: "ferry_terminal", carsPresent: 9 },
  { id: "hub-puttgarden", name: "Puttgarden Scandlines Terminal", city: "Fehmarn", country: "DE", x: 375, y: 315, kind: "ferry_terminal", carsPresent: 5 },
  { id: "hub-rodby", name: "Rødbyhavn Ferry Gate", city: "Rødby", country: "DK", x: 395, y: 295, kind: "ferry_terminal", carsPresent: 4 },
  { id: "hub-copenhagen", name: "Copenhagen Transit Hub", city: "Copenhagen", country: "DK", x: 440, y: 245, kind: "distribution_compound", carsPresent: 6 },
  { id: "hub-malmo", name: "Malmö Bridge Compound", city: "Malmö", country: "SE", x: 460, y: 240, kind: "distribution_compound", carsPresent: 5 },
  { id: "hub-stockholm", name: "Stockholm Värtahamnen", city: "Stockholm", country: "SE", x: 610, y: 155, kind: "ferry_terminal", carsPresent: 4 },
  { id: "hub-turku", name: "Turku Port Car Compound", city: "Turku", country: "FI", x: 745, y: 125, kind: "ferry_terminal", carsPresent: 7 },
  { id: "hub-helsinki", name: "Helsinki / Vantaa Main Compound", city: "Vantaa", country: "FI", x: 815, y: 130, kind: "distribution_compound", carsPresent: 18 },
  { id: "hub-espoo", name: "Espoo EV Depot", city: "Espoo", country: "FI", x: 800, y: 135, kind: "distribution_compound", carsPresent: 9 },
  { id: "hub-tampere", name: "Tampere Distribution Center", city: "Tampere", country: "FI", x: 795, y: 70, kind: "distribution_compound", carsPresent: 12 },
  { id: "hub-oulu", name: "Oulu North Logistics Gate", city: "Oulu", country: "FI", x: 850, y: 20, kind: "distribution_compound", carsPresent: 4 },
]

// Baltic Sea Car Transporters
const VESSELS: MapVessel[] = [
  {
    id: "vessel-finnstar",
    name: "MS Finnstar (Finnlines)",
    route: "Travemünde ↔ Helsinki",
    operator: "Finnlines Baltic RoRo",
    fromPort: "Travemünde",
    toPort: "Helsinki (Vuosaari)",
    x: 580,
    y: 240,
    progressPct: 62,
    carsOnboard: 14,
    departureTime: "Yesterday 23:45",
    eta: "Today 16:30",
    headingDeg: 42,
  },
  {
    id: "vessel-copenhagen",
    name: "M/F Copenhagen (Scandlines)",
    route: "Puttgarden ↔ Rødby",
    operator: "Scandlines Hybrid",
    fromPort: "Puttgarden",
    toPort: "Rødbyhavn",
    x: 385,
    y: 305,
    progressPct: 45,
    carsOnboard: 6,
    departureTime: "10:15",
    eta: "11:00",
    headingDeg: 35,
  },
  {
    id: "vessel-aurora",
    name: "Wasaline Aurora Botnia",
    route: "Umeå ↔ Vaasa",
    operator: "Wasaline",
    fromPort: "Umeå",
    toPort: "Vaasa",
    x: 700,
    y: 40,
    progressPct: 78,
    carsOnboard: 4,
    departureTime: "08:00",
    eta: "11:30",
    headingDeg: 95,
  },
]

// Fleet Vehicles Plotted Across Corridors
const VEHICLES: MapVehicle[] = [
  {
    id: "ord-00322",
    reference: "CD-420322",
    make: "Bentley",
    model: "Continental GT W12",
    year: 2023,
    plate: "HH-GT-2391",
    vin: "SCBFB7ZA5PC089121",
    driver: "Jari Virtanen",
    driverId: "drv-055",
    fromCity: "Munich, DE",
    toCity: "Tampere, FI",
    currentLocationName: "Autobahn A7 km 212 near Göttingen",
    lat: 51.53,
    lng: 9.93,
    x: 295,
    y: 475,
    status: "EXCEPTION",
    urgency: "now",
    headline: "Engine safe-stop activated: Low oil pressure alert on A7",
    why: "Driver safely pulled into Rasthof Göttingen. Authorized €240 emergency roadside inspection + oil top-up. Delivery SLA at risk.",
    costAtRisk: 420,
    hoursDelta: 4,
    speedKmh: 0,
    fuelOrBattery: "42% Petrol",
  },
  {
    id: "ord-00299",
    reference: "CD-420299",
    make: "BMW",
    model: "M4 Competition xDrive",
    year: 2024,
    plate: "M-CP-4402",
    vin: "WBS43AZ09RCE10482",
    driver: "Cole Mervalen",
    driverId: "drv-260",
    fromCity: "Frankfurt, DE",
    toCity: "Helsinki, FI",
    currentLocationName: "Travemünde Ferry Gate (Finnlines Pier 3)",
    lat: 53.95,
    lng: 10.87,
    x: 350,
    y: 345,
    status: "EXCEPTION",
    urgency: "now",
    headline: "Finnlines Travemünde-Helsinki sailing overbooked",
    why: "Scheduled 03:00 ferry spot unconfirmed. Agent proposed rerouting via Puttgarden-Rødby corridor (+€140) to protect 48h delivery SLA.",
    costAtRisk: 345,
    hoursDelta: 0,
    speedKmh: 0,
    fuelOrBattery: "75% Petrol",
  },
  {
    id: "ord-00458",
    reference: "CD-420458",
    make: "Ferrari",
    model: "Roma Coupe V8",
    year: 2022,
    plate: "S-FR-8891",
    vin: "ZFF94NLA5N0287114",
    driver: "Timo Salo",
    driverId: "drv-112",
    fromCity: "Stuttgart, DE",
    toCity: "Espoo, FI",
    currentLocationName: "Stuttgart Auto-Haus Lot 4",
    lat: 48.77,
    lng: 9.18,
    x: 230,
    y: 610,
    status: "EXCEPTION",
    urgency: "today",
    headline: "Seller commercial hold: Missing original release Vollmacht",
    why: "Seller lot manager refusing handover without signed physical paper. Driver inbound flight departs in 2h. Pre-flight freeze recommended.",
    costAtRisk: 437,
    hoursDelta: 24,
    speedKmh: 0,
    fuelOrBattery: "90% Petrol",
  },
  {
    id: "ord-00384",
    reference: "CD-420384",
    make: "Porsche",
    model: "Taycan 4S Cross Turismo",
    year: 2023,
    plate: "B-TY-9114",
    vin: "WP0AA2Y14PSA88231",
    driver: "Anika Fjellaro",
    driverId: "drv-449",
    fromCity: "Berlin, DE",
    toCity: "Tampere, FI",
    currentLocationName: "E45 near Flensburg border crossing",
    lat: 54.78,
    lng: 9.43,
    x: 330,
    y: 325,
    status: "EXCEPTION",
    urgency: "today",
    headline: "Address contradiction reconciled: Dropoff redirected to Tampere",
    why: "Contradiction resolved: Header stated Helsinki, but purchase agreement attachment confirmed Tampere distribution hub. Rerouted seamlessly.",
    costAtRisk: 290,
    hoursDelta: 2,
    speedKmh: 104,
    fuelOrBattery: "68% EV Battery",
  },
  {
    id: "ord-00593",
    reference: "CD-420593",
    make: "Audi",
    model: "RS6 Avant V8",
    year: 2023,
    plate: "IN-RS-6021",
    vin: "WAUZZZF27PA094112",
    driver: "Pekka Makinen",
    driverId: "drv-089",
    fromCity: "Ingolstadt, DE",
    toCity: "Turku, FI",
    currentLocationName: "A9 Northbound near Leipzig km 118",
    lat: 51.34,
    lng: 12.37,
    x: 410,
    y: 490,
    status: "EXCEPTION",
    urgency: "soon",
    headline: "VIN mismatch check: Driver verified physical chassis stamping",
    why: "Order form listed synthetic test VIN; driver confirmed physical chassis VIN matches export registration papers. Gate release cleared.",
    costAtRisk: 180,
    hoursDelta: 1,
    speedKmh: 128,
    fuelOrBattery: "55% Petrol",
  },
  {
    id: "ord-00702",
    reference: "CD-420702",
    make: "Mercedes-Benz",
    model: "E300e Plug-In Hybrid",
    year: 2023,
    plate: "DEMO-FI-M881",
    vin: "W1K2130531A992144",
    driver: "Tobias Malverin",
    driverId: "drv-055",
    fromCity: "Hamburg, DE",
    toCity: "Espoo, FI",
    currentLocationName: "Espoo Delivery Compound Bay 4",
    lat: 60.20,
    lng: 24.65,
    x: 800,
    y: 135,
    status: "AT_COMPOUND",
    speedKmh: 0,
    fuelOrBattery: "100% Fully Charged",
  },
  {
    id: "ord-00089",
    reference: "CD-420089",
    make: "Volvo",
    model: "XC90 Recharge AWD",
    year: 2024,
    plate: "DEMO-SE-V922",
    vin: "YV4A22PK1R1098421",
    driver: "Mikael Lindqvist",
    driverId: "drv-144",
    fromCity: "Travemünde, DE",
    toCity: "Helsinki, FI",
    currentLocationName: "Baltic Sea aboard MS Finnstar (Deck 3 Car Carrier)",
    lat: 56.40,
    lng: 18.20,
    x: 580,
    y: 240,
    status: "ON_FERRY",
    vesselName: "MS Finnstar",
    speedKmh: 38,
    fuelOrBattery: "88% EV Battery",
  },
  {
    id: "ord-00104",
    reference: "CD-420104",
    make: "Polestar",
    model: "Polestar 2 Dual Motor",
    year: 2023,
    plate: "DEMO-FI-P201",
    vin: "YSMED8AE0PN042918",
    driver: "Linus Eklund",
    driverId: "drv-098",
    fromCity: "Travemünde, DE",
    toCity: "Helsinki, FI",
    currentLocationName: "Baltic Sea aboard MS Finnstar (Deck 3 Car Carrier)",
    lat: 56.40,
    lng: 18.20,
    x: 588,
    y: 248,
    status: "ON_FERRY",
    vesselName: "MS Finnstar",
    speedKmh: 38,
    fuelOrBattery: "72% EV Battery",
  },
  {
    id: "ord-00215",
    reference: "CD-420215",
    make: "BMW",
    model: "i4 M50 Gran Coupe",
    year: 2023,
    plate: "DEMO-DE-B441",
    vin: "WBA33AW08PFS91284",
    driver: "Kari Nieminen",
    driverId: "drv-076",
    fromCity: "Puttgarden, DE",
    toCity: "Copenhagen, DK",
    currentLocationName: "Fehmarn Belt aboard M/F Copenhagen",
    lat: 54.55,
    lng: 11.25,
    x: 385,
    y: 305,
    status: "ON_FERRY",
    vesselName: "M/F Copenhagen",
    speedKmh: 24,
    fuelOrBattery: "60% EV Battery",
  },
  {
    id: "ord-00118",
    reference: "CD-420118",
    make: "Volkswagen",
    model: "ID.7 Pro Performance",
    year: 2024,
    plate: "WOB-ID-701",
    vin: "WVWZZZED8RE031984",
    driver: "Soren Olsen",
    driverId: "drv-043",
    fromCity: "Hamburg, DE",
    toCity: "Stockholm, SE",
    currentLocationName: "Øresund Bridge transit corridor",
    lat: 55.57,
    lng: 12.82,
    x: 450,
    y: 242,
    status: "IN_TRANSIT",
    speedKmh: 110,
    fuelOrBattery: "81% EV Battery",
  },
  {
    id: "ord-00192",
    reference: "CD-420192",
    make: "Mercedes-Benz",
    model: "EQS 450+ Sedan",
    year: 2023,
    plate: "B-EQ-450",
    vin: "W1K2971231A019482",
    driver: "Erik Vinter",
    driverId: "drv-192",
    fromCity: "Cologne, DE",
    toCity: "Helsinki, FI",
    currentLocationName: "A1 Autobahn near Bremen",
    lat: 53.07,
    lng: 8.80,
    x: 275,
    y: 395,
    status: "IN_TRANSIT",
    speedKmh: 130,
    fuelOrBattery: "79% EV Battery",
  },
  {
    id: "ord-00044",
    reference: "CD-420044",
    make: "Porsche",
    model: "911 Carrera 4 GTS",
    year: 2023,
    plate: "DEMO-FI-P911",
    vin: "WP0AB2A92PS182931",
    driver: "Marko Heikkinen",
    driverId: "drv-031",
    fromCity: "Turku, FI",
    toCity: "Tampere, FI",
    currentLocationName: "Highway 9 near Loimaa",
    lat: 60.85,
    lng: 23.05,
    x: 770,
    y: 95,
    status: "IN_TRANSIT",
    speedKmh: 98,
    fuelOrBattery: "52% Petrol",
  },
  {
    id: "ord-00004",
    reference: "CD-420004",
    make: "Porsche",
    model: "Taycan Turbo S",
    year: 2021,
    plate: "DEMO-FI-N8F7CH",
    vin: "WP0AB2Y15MSA48192",
    driver: "Hanna Wenverin",
    driverId: "drv-002",
    fromCity: "Helsinki, FI",
    toCity: "Oulu, FI",
    currentLocationName: "E75 Highway near Jyväskylä",
    lat: 62.24,
    lng: 25.74,
    x: 820,
    y: 45,
    status: "IN_TRANSIT",
    speedKmh: 102,
    fuelOrBattery: "64% EV Battery",
  },
]

export function FleetMap({ onSelectOrder }: { onSelectOrder?: (orderId: string) => void }) {
  const [filter, setFilter] = useState<"ALL" | "EXCEPTIONS" | "FERRIES" | "IN_TRANSIT" | "COMPOUNDS">("ALL")
  const [selectedVehicle, setSelectedVehicle] = useState<MapVehicle | null>(VEHICLES[0])
  const [selectedVessel, setSelectedVessel] = useState<MapVessel | null>(null)
  const [search, setSearch] = useState("")

  const filteredVehicles = useMemo(() => {
    return VEHICLES.filter((v) => {
      if (filter === "EXCEPTIONS" && v.status !== "EXCEPTION") return false
      if (filter === "FERRIES" && v.status !== "ON_FERRY") return false
      if (filter === "IN_TRANSIT" && v.status !== "IN_TRANSIT") return false
      if (filter === "COMPOUNDS" && v.status !== "AT_COMPOUND") return false

      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          v.reference.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.plate.toLowerCase().includes(q) ||
          v.driver.toLowerCase().includes(q) ||
          v.currentLocationName.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [filter, search])

  const counts = useMemo(() => {
    return {
      all: 100,
      exceptions: VEHICLES.filter((v) => v.status === "EXCEPTION").length,
      ferries: VEHICLES.filter((v) => v.status === "ON_FERRY").length,
      transit: VEHICLES.filter((v) => v.status === "IN_TRANSIT").length,
      compounds: VEHICLES.filter((v) => v.status === "AT_COMPOUND").length,
    }
  }, [])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "var(--card)", borderRadius: "14px", border: "1px solid var(--hair)", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
      {/* Top Map Header & Filters */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hair)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "14px", background: "var(--birch)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ display: "inline-flex", width: "9px", height: "9px", borderRadius: "50%", background: "var(--teal)", animation: "pulse 2s infinite" }} />
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, letterSpacing: "-0.01em", color: "var(--ink)" }}>
              European Transit & Ferry Radar
            </h2>
            <span style={{ fontSize: "11px", fontWeight: 600, background: "var(--teal-bg)", color: "var(--teal-ink)", padding: "2px 8px", borderRadius: "12px", border: "1px solid rgba(26,111,103,0.2)" }}>
              Active Fleet: 100 Vehicles
            </span>
          </div>
          <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "3px 0 0 0" }}>
            Real-time multi-modal telemetry across German Autobahns, Baltic RoRo ferries, and Nordic relay compounds.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            style={{
              padding: "5px 12px",
              borderRadius: "7px",
              fontSize: "12px",
              fontWeight: 600,
              border: filter === "ALL" ? "1px solid var(--ink)" : "1px solid var(--hair)",
              background: filter === "ALL" ? "var(--ink)" : "var(--canvas)",
              color: filter === "ALL" ? "#fff" : "var(--ink)",
              cursor: "pointer",
            }}
          >
            All Corridors (100)
          </button>

          <button
            type="button"
            onClick={() => setFilter("EXCEPTIONS")}
            style={{
              padding: "5px 12px",
              borderRadius: "7px",
              fontSize: "12px",
              fontWeight: 600,
              border: filter === "EXCEPTIONS" ? "1px solid var(--red)" : "1px solid var(--hair)",
              background: filter === "EXCEPTIONS" ? "var(--red-bg)" : "var(--canvas)",
              color: "var(--red-ink)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--red)" }} />
            Exceptions ({counts.exceptions})
          </button>

          <button
            type="button"
            onClick={() => setFilter("FERRIES")}
            style={{
              padding: "5px 12px",
              borderRadius: "7px",
              fontSize: "12px",
              fontWeight: 600,
              border: filter === "FERRIES" ? "1px solid var(--blue)" : "1px solid var(--hair)",
              background: filter === "FERRIES" ? "var(--blue-bg)" : "var(--canvas)",
              color: "var(--blue-ink)",
              cursor: "pointer",
            }}
          >
            🚢 Baltic Ferries & Ships (3)
          </button>

          <button
            type="button"
            onClick={() => setFilter("IN_TRANSIT")}
            style={{
              padding: "5px 12px",
              borderRadius: "7px",
              fontSize: "12px",
              fontWeight: 600,
              border: filter === "IN_TRANSIT" ? "1px solid var(--teal)" : "1px solid var(--hair)",
              background: filter === "IN_TRANSIT" ? "var(--teal-bg)" : "var(--canvas)",
              color: "var(--teal-ink)",
              cursor: "pointer",
            }}
          >
            🚗 Highway Transit ({counts.transit})
          </button>
        </div>
      </div>

      {/* Main Map + Side Telemetry Panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", minHeight: "560px", background: "#f8f5ee" }}>
        {/* SVG Map Canvas */}
        <div style={{ position: "relative", overflow: "hidden", borderRight: "1px solid var(--hair)", background: "#f5f1e8" }}>
          {/* Map Controls Overlay */}
          <div style={{ position: "absolute", top: "14px", left: "16px", zIndex: 10, display: "flex", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: "1px solid var(--hair)", borderRadius: "8px", padding: "4px 10px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
              <Icon name="search" size={13} style={{ color: "var(--muted)", marginRight: "6px" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter map by VIN, driver, car..."
                style={{ border: "none", outline: "none", fontSize: "11.5px", background: "transparent", width: "190px" }}
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "12px", color: "var(--muted)" }}>
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Quick Corridor Legend */}
          <div style={{ position: "absolute", bottom: "14px", left: "16px", zIndex: 10, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: "1px solid var(--hair)", borderRadius: "8px", padding: "8px 12px", fontSize: "11px", color: "var(--ink)", display: "flex", gap: "14px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--red)" }} />
              Exception Safe-Stop
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--blue)" }} />
              Baltic Ferry Crossing
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--teal)" }} />
              On-Schedule Transit
            </span>
          </div>

          <svg
            viewBox="0 0 1000 720"
            style={{ width: "100%", height: "100%", minHeight: "560px", display: "block" }}
          >
            <defs>
              <pattern id="seaGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e0e8e9" strokeWidth="0.5" strokeDasharray="2 4" />
              </pattern>

              {/* Glowing Pulsing Filter for Exceptions */}
              <filter id="glowRed" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#c23b22" floodOpacity="0.7" />
              </filter>
              <filter id="glowBlue" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#1a5a8a" floodOpacity="0.6" />
              </filter>
            </defs>

            {/* Baltic Sea Water Base */}
            <rect width="1000" height="720" fill="#e9eff0" />
            <rect width="1000" height="720" fill="url(#seaGrid)" />

            {/* Stylized European Landmass Paths */}
            {/* Germany & Central Europe */}
            <path
              d="M 160 720 L 170 560 L 210 520 L 260 480 L 290 370 L 370 330 L 450 350 L 480 430 L 480 720 Z"
              fill="#f1eee4"
              stroke="#d8d1c0"
              strokeWidth="1.5"
            />
            {/* Denmark (Jutland Peninsula & Islands) */}
            <path
              d="M 330 330 L 320 250 L 350 200 L 370 230 L 350 320 Z"
              fill="#ede8dc"
              stroke="#d8d1c0"
              strokeWidth="1.5"
            />
            {/* Funen & Zealand / Copenhagen */}
            <circle cx="395" cy="295" r="14" fill="#ede8dc" stroke="#d8d1c0" strokeWidth="1" />
            <circle cx="440" cy="245" r="22" fill="#ede8dc" stroke="#d8d1c0" strokeWidth="1" />

            {/* Sweden & Scandinavia */}
            <path
              d="M 450 240 L 480 180 L 530 140 L 610 130 L 670 90 L 710 40 L 720 0 L 460 0 L 450 240 Z"
              fill="#ede8dc"
              stroke="#d8d1c0"
              strokeWidth="1.5"
            />

            {/* Finland */}
            <path
              d="M 725 150 L 740 120 L 780 60 L 840 10 L 920 10 L 930 180 L 860 170 L 800 150 Z"
              fill="#ede8dc"
              stroke="#d8d1c0"
              strokeWidth="1.5"
            />

            {/* Baltic Sea Shipping Routes (Dashed Lines with Nautical Curve) */}
            {/* Travemünde ↔ Helsinki Route */}
            <path
              d="M 350 345 Q 520 280 815 130"
              fill="none"
              stroke="#2e648c"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              strokeOpacity="0.65"
            />
            <text x="560" y="275" fill="#2e648c" fontSize="10" fontWeight="600" letterSpacing="0.05em">
              Finnlines Travemünde – Helsinki (Baltic RoRo Corridor)
            </text>

            {/* Puttgarden ↔ Rødby Scandlines Crossing */}
            <path
              d="M 375 315 L 395 295"
              fill="none"
              stroke="#2e648c"
              strokeWidth="3.5"
              strokeDasharray="4 4"
            />

            {/* German Autobahn Transit Arteries (A7, A1, A9) */}
            {/* A7: Munich → Göttingen → Hamburg → Flensburg */}
            <path
              d="M 310 640 L 295 540 L 295 475 L 315 360 L 330 325"
              fill="none"
              stroke="#b5ad9a"
              strokeWidth="3"
            />
            {/* A9: Munich → Leipzig → Berlin */}
            <path
              d="M 310 640 L 390 530 L 410 490 L 440 440"
              fill="none"
              stroke="#b5ad9a"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            {/* Finnish E12 / E75 Corridors: Helsinki → Tampere → Oulu */}
            <path
              d="M 815 130 L 795 70 L 850 20"
              fill="none"
              stroke="#b5ad9a"
              strokeWidth="2.5"
            />

            {/* Terminal Hub Markers */}
            {HUBS.map((hub) => (
              <g key={hub.id} transform={`translate(${hub.x}, ${hub.y})`} style={{ cursor: "pointer" }}>
                <circle
                  r={hub.kind === "ferry_terminal" ? 7 : 5}
                  fill={hub.kind === "ferry_terminal" ? "#1a5a8a" : "#62594a"}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x={hub.x > 750 ? -10 : 10}
                  y={4}
                  textAnchor={hub.x > 750 ? "end" : "start"}
                  fontSize="10"
                  fontWeight="600"
                  fill="#474034"
                  style={{ userSelect: "none" }}
                >
                  {hub.name}
                </text>
              </g>
            ))}

            {/* Baltic Sea Transporter Vessels */}
            {VESSELS.map((vessel) => {
              const isSelected = selectedVessel?.id === vessel.id
              return (
                <g
                  key={vessel.id}
                  transform={`translate(${vessel.x}, ${vessel.y})`}
                  onClick={() => {
                    setSelectedVessel(vessel)
                    setSelectedVehicle(null)
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {/* Wake Wave Animation */}
                  <circle r="18" fill="none" stroke="#2e648c" strokeWidth="1" strokeOpacity="0.4" />
                  <rect
                    x="-12"
                    y="-8"
                    width="24"
                    height="16"
                    rx="3"
                    fill={isSelected ? "#1a5a8a" : "#2472a4"}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    filter="url(#glowBlue)"
                  />
                  <text x="0" y="3" textAnchor="middle" fontSize="9" fill="#ffffff" fontWeight="bold">
                    🚢
                  </text>
                  <text x="0" y="-12" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1a5a8a">
                    {vessel.name.split(" ")[1]} ({vessel.carsOnboard} cars)
                  </text>
                </g>
              )
            })}

            {/* Vehicles on Map */}
            {filteredVehicles.map((car) => {
              const isSelected = selectedVehicle?.id === car.id
              const isException = car.status === "EXCEPTION"
              const isOnFerry = car.status === "ON_FERRY"

              const pinColor = isException ? "var(--red)" : isOnFerry ? "var(--blue)" : "var(--teal)"

              return (
                <g
                  key={car.id}
                  transform={`translate(${car.x}, ${car.y})`}
                  onClick={() => {
                    setSelectedVehicle(car)
                    setSelectedVessel(null)
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {/* Pulsing ring for exceptions */}
                  {isException && (
                    <circle
                      r="16"
                      fill="none"
                      stroke="#c23b22"
                      strokeWidth="2"
                      strokeOpacity="0.6"
                      filter="url(#glowRed)"
                    >
                      <animate attributeName="r" values="8;20;8" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values="0.8;0.1;0.8" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Marker Pin */}
                  <circle
                    r={isSelected ? 9 : isException ? 8 : 6}
                    fill={isSelected ? "#1e1e1e" : pinColor}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? 3 : 2}
                  />

                  {/* Icon or Label */}
                  {isSelected && (
                    <circle r="3" fill="#ffffff" />
                  )}

                  {/* Vehicle Tag */}
                  {(isSelected || isException) && (
                    <g transform="translate(0, -14)">
                      <rect
                        x="-45"
                        y="-16"
                        width="90"
                        height="16"
                        rx="4"
                        fill="rgba(30,30,30,0.92)"
                      />
                      <text
                        x="0"
                        y="-5"
                        textAnchor="middle"
                        fontSize="9.5"
                        fill="#ffffff"
                        fontWeight="600"
                      >
                        {car.reference} · {car.make}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Side HUD / Vehicle Telemetry Inspector */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", background: "var(--card)" }}>
          {selectedVehicle ? (
            <>
              {/* Header Badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: "6px",
                      background:
                        selectedVehicle.status === "EXCEPTION"
                          ? "var(--red-bg)"
                          : selectedVehicle.status === "ON_FERRY"
                          ? "var(--blue-bg)"
                          : "var(--teal-bg)",
                      color:
                        selectedVehicle.status === "EXCEPTION"
                          ? "var(--red-ink)"
                          : selectedVehicle.status === "ON_FERRY"
                          ? "var(--blue-ink)"
                          : "var(--teal-ink)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {selectedVehicle.status === "EXCEPTION"
                      ? "Decision Required"
                      : selectedVehicle.status === "ON_FERRY"
                      ? "Baltic RoRo Transit"
                      : "Corridor On-Schedule"}
                  </span>
                  <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "6px 0 2px 0", color: "var(--ink)" }}>
                    {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "monospace" }}>
                    {selectedVehicle.reference} · {selectedVehicle.plate}
                  </div>
                </div>

                {selectedVehicle.costAtRisk && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10.5px", color: "var(--muted)", textTransform: "uppercase" }}>At Risk</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--red-ink)" }}>
                      €{selectedVehicle.costAtRisk}
                    </div>
                  </div>
                )}
              </div>

              {/* Exception Alert Card if applicable */}
              {selectedVehicle.headline && (
                <div style={{ background: "var(--red-bg)", border: "1px solid rgba(194,59,34,0.25)", borderRadius: "8px", padding: "10px 12px" }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--red-ink)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>⚠</span> {selectedVehicle.headline}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--ink)", marginTop: "4px", lineHeight: 1.4 }}>
                    {selectedVehicle.why}
                  </div>
                </div>
              )}

              {/* Live Telemetry Card */}
              <div style={{ background: "var(--birch)", borderRadius: "8px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "10.5px", textTransform: "uppercase" }}>Current Position</div>
                  <div style={{ fontWeight: 600, color: "var(--ink)", marginTop: "2px" }}>
                    {selectedVehicle.currentLocationName}
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontSize: "10.5px", textTransform: "uppercase" }}>Speed / Heading</div>
                  <div style={{ fontWeight: 600, color: "var(--ink)", marginTop: "2px" }}>
                    {selectedVehicle.speedKmh ? `${selectedVehicle.speedKmh} km/h` : "Stationary / Safe-Stop"}
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontSize: "10.5px", textTransform: "uppercase" }}>Driver Assigned</div>
                  <div style={{ fontWeight: 600, color: "var(--ink)", marginTop: "2px" }}>
                    {selectedVehicle.driver}
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontSize: "10.5px", textTransform: "uppercase" }}>Fuel / Battery</div>
                  <div style={{ fontWeight: 600, color: "var(--teal-ink)", marginTop: "2px" }}>
                    {selectedVehicle.fuelOrBattery ?? "85%"}
                  </div>
                </div>
              </div>

              {/* Delivery Route */}
              <div style={{ fontSize: "12px", border: "1px solid var(--hair)", borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ color: "var(--muted)", fontSize: "10.5px", textTransform: "uppercase", marginBottom: "4px" }}>
                  Delivery Corridor
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "var(--ink)" }}>
                  <span>{selectedVehicle.fromCity}</span>
                  <span style={{ color: "var(--muted)" }}>→</span>
                  <span>{selectedVehicle.toCity}</span>
                </div>
              </div>

              {/* 1-Click Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
                <Link
                  href={`/orders/${selectedVehicle.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    background: "var(--ink)",
                    color: "#ffffff",
                    padding: "9px 14px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "13px",
                    textDecoration: "none",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  Open Decision Card ({selectedVehicle.reference}) →
                </Link>

                <Link
                  href={`/driver?d=${selectedVehicle.driverId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    background: "var(--birch)",
                    color: "var(--ink)",
                    border: "1px solid var(--hair)",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "12.5px",
                    textDecoration: "none",
                  }}
                >
                  <Icon name="phone" size={13} /> Call Driver ({selectedVehicle.driver})
                </Link>
              </div>
            </>
          ) : selectedVessel ? (
            <>
              {/* Vessel Inspector */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "6px", background: "var(--blue-bg)", color: "var(--blue-ink)", textTransform: "uppercase" }}>
                  Baltic Car Carrier
                </span>
                <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "6px 0 2px 0", color: "var(--ink)" }}>
                  {selectedVessel.name}
                </h3>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>{selectedVessel.operator}</div>
              </div>

              <div style={{ background: "var(--birch)", borderRadius: "8px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "10.5px", textTransform: "uppercase" }}>Cars Onboard</div>
                  <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: "15px", marginTop: "2px" }}>
                    {selectedVessel.carsOnboard} vehicles
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontSize: "10.5px", textTransform: "uppercase" }}>Crossing Progress</div>
                  <div style={{ fontWeight: 600, color: "var(--teal-ink)", marginTop: "2px" }}>
                    {selectedVessel.progressPct}% complete
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontSize: "10.5px", textTransform: "uppercase" }}>Departure</div>
                  <div style={{ fontWeight: 500, color: "var(--ink)", marginTop: "2px" }}>
                    {selectedVessel.departureTime}
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontSize: "10.5px", textTransform: "uppercase" }}>Destination ETA</div>
                  <div style={{ fontWeight: 600, color: "var(--ink)", marginTop: "2px" }}>
                    {selectedVessel.eta}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "12px", border: "1px solid var(--hair)", borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ color: "var(--muted)", fontSize: "10.5px", textTransform: "uppercase", marginBottom: "4px" }}>
                  Ferry Line
                </div>
                <div style={{ fontWeight: 600, color: "var(--ink)" }}>{selectedVessel.route}</div>
              </div>

              <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.4, margin: "0" }}>
                RoRo car decks are temperature-controlled. Real-time telemetry relayed via satellite bridge terminal.
              </p>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)", fontSize: "13px", textAlign: "center" }}>
              Click any vehicle, ferry, or hub on the radar map to view live telemetry.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
