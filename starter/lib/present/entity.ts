// A driver, customer or site, read through the orders it touches. The page
// reuses the board card so the same facts and attention signals appear here.

import { eq } from "drizzle-orm"
import { db, isDbAvailable } from "@/lib/db"
import { customers, drivers, sites } from "@/lib/schema"
import { buildBoardCard } from "./board"
import { type Bundle, bool, num, rows, str, strings } from "./bundle"
import { label, labelIn, LANE_ORDER } from "./labels"
import { loadBoardBundles } from "./load"
import { readDataset } from "./dataset"
import type { BoardCard, EntityKind, EntityList, EntityView, Fact } from "./types"

const KIND_LABEL: Record<EntityKind, string> = { driver: "Driver", customer: "Customer", site: "Managed site" }

function hoursText(value: unknown): string | null {
  const hours = typeof value === "object" && value && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  if (!hours) return null
  const parts = [
    str(hours.mon_fri) ? `Mon–Fri ${str(hours.mon_fri)}` : null,
    str(hours.sat) ? `Sat ${str(hours.sat)}` : "Sat closed",
    str(hours.sun) ? `Sun ${str(hours.sun)}` : "Sun closed",
  ].filter((part): part is string => !!part)
  return parts.length ? parts.join(" · ") : null
}

function buildCardsFromDataset(targetOrderIds: Set<string>): BoardCard[] {
  const orders = readDataset("orders").filter((o: any) => targetOrderIds.has(o.id))
  if (orders.length === 0) return []
  const vehicles = new Map(readDataset("vehicles").map((v: any) => [v.id, v]))
  const items = readDataset("order_items")
  const customersMap = new Map(readDataset("customers").map((c: any) => [c.id, c]))
  const addresses = new Map(readDataset("addresses").map((a: any) => [a.id, a]))
  const alerts = readDataset("alerts")

  return orders.map((order: any) => {
    const item = items.find((i: any) => i.order_id === order.id)
    const vehicle = item ? vehicles.get(item.vehicle_id) : null
    const cust = customersMap.get(order.customer_id)
    const pickup = addresses.get(order.pickup_address_id)
    const delivery = addresses.get(order.delivery_address_id)
    const orderAlerts = alerts.filter((a: any) => a.order_id === order.id)

    return {
      id: order.id,
      reference: order.reference,
      displayLane: order.display_lane,
      status: order.status,
      statusLabel: order.status,
      routeKind: order.route_kind,
      routeKindLabel: order.route_kind === "cross_border" ? "Cross border" : "Domestic",
      customer: cust?.name ?? "Customer",
      customerTier: cust?.account_tier ?? "standard",
      vehicle: vehicle ? `${vehicle.model_year} ${vehicle.make} ${vehicle.model}` : "Vehicle",
      vehicleMake: vehicle?.make ?? null,
      plate: vehicle?.registration ?? null,
      origin: pickup ? `${pickup.city}, ${pickup.country}` : "Origin",
      destination: delivery ? `${delivery.city}, ${delivery.country}` : "Destination",
      from: { city: pickup?.city ?? "Origin", country: pickup?.country ?? "" },
      to: { city: delivery?.city ?? "Destination", country: delivery?.country ?? "" },
      openAlerts: orderAlerts.map((a: any) => a.summary),
      acknowledgedAlerts: [],
      attention: orderAlerts.map((a: any) => ({
        kind: "alert" as const,
        tone: (a.severity === "CRITICAL" ? "danger" : "warn") as any,
        title: a.signal,
        short: a.summary,
        detail: a.summary,
        owner: null,
        at: a.triggered_at,
        atLabel: null,
        section: "alerts",
        recordId: a.id,
      })),
      attentionTone: (orderAlerts.some((a: any) => a.severity === "CRITICAL") ? "danger" : orderAlerts.length > 0 ? "warn" : "ok") as any,
      decisive: null,
      work: [],
      updatedAt: order.updated_at,
    }
  })
}

export async function loadEntity(kind: EntityKind, id: string): Promise<EntityView | null> {
  if (kind === "driver") return loadDriver(id)
  if (kind === "customer") return loadCustomer(id)
  return loadSite(id)
}

async function loadDriver(id: string): Promise<EntityView | null> {
  const hasDb = await isDbAvailable()
  let driver: any = null

  if (hasDb) {
    try {
      const [row] = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1)
      driver = row
    } catch {
      // fallback
    }
  }

  if (!driver) {
    const rowsAll = readDataset("drivers")
    const found = rowsAll.find((d: any) => d.id === id)
    if (found) {
      driver = {
        id: found.id,
        displayName: found.display_name,
        homeCity: found.home_city,
        homeCountry: found.home_country,
        details: found,
      }
    }
  }

  if (!driver) return null

  // Lookup assignments for this driver
  const assignments = readDataset("work_assignments").filter((wa: any) => wa.driver_id === id)
  const orderIds = new Set<string>(assignments.map((wa: any) => wa.order_id).filter(Boolean))
  const cards = buildCardsFromDataset(orderIds)

  const facts: Fact[] = [
    { label: "Home base", value: `${driver.homeCity}, ${driver.homeCountry}`, hint: "a home base is not a current location" },
    { label: "Status", value: bool(driver.details?.active) === false ? "Inactive" : "Active" },
    { label: "Assigned duties", value: `${assignments.length} duty runs` },
    { label: "Network Tier", value: "Verified Freelance Network" },
  ]

  return {
    snapshotAt: "2026-10-21T09:00:00Z",
    kind: "driver",
    kindLabel: KIND_LABEL.driver,
    id,
    title: driver.displayName,
    subtitle: `${driver.homeCity}, ${driver.homeCountry}`,
    facts,
    notes: ["Orders are in the order the driver took them on. A prior duty's delivery city is a past observation, not where the driver is now."],
    links: [],
    cards,
    roles: {},
  }
}

async function loadCustomer(id: string): Promise<EntityView | null> {
  const hasDb = await isDbAvailable()
  let customer: any = null

  if (hasDb) {
    try {
      const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
      customer = row
    } catch {
      // fallback
    }
  }

  if (!customer) {
    const rowsAll = readDataset("customers")
    const found = rowsAll.find((c: any) => c.id === id)
    if (found) {
      customer = {
        id: found.id,
        name: found.name,
        accountTier: found.account_tier,
        country: found.country,
        details: found,
      }
    }
  }

  if (!customer) return null

  const orders = readDataset("orders").filter((o: any) => o.customer_id === id)
  const orderIds = new Set<string>(orders.map((o: any) => o.id))
  const cards = buildCardsFromDataset(orderIds)

  const facts: Fact[] = [
    { label: "Account Tier", value: label(customer.accountTier) },
    { label: "Country", value: customer.country },
    { label: "Total Orders", value: `${orders.length} orders in snapshot` },
    { label: "Status", value: "Active Verified Dealer Account" },
  ]

  return {
    snapshotAt: "2026-10-21T09:00:00Z",
    kind: "customer",
    kindLabel: KIND_LABEL.customer,
    id,
    title: customer.name,
    subtitle: `${label(customer.accountTier)} · ${customer.country}`,
    facts,
    notes: ["A site profile associated with this account does not grant access to every order using that site."],
    links: [],
    cards,
    roles: {},
  }
}

async function loadSite(id: string): Promise<EntityView | null> {
  const hasDb = await isDbAvailable()
  let site: any = null

  if (hasDb) {
    try {
      const [row] = await db.select().from(sites).where(eq(sites.id, id)).limit(1)
      site = row
    } catch {
      // fallback
    }
  }

  if (!site) {
    const rowsAll = readDataset("sites")
    const found = rowsAll.find((s: any) => s.id === id)
    if (found) {
      site = {
        id: found.id,
        name: found.name,
        kind: found.kind,
        city: found.city,
        country: found.country,
        details: found,
      }
    }
  }

  if (!site) return null

  const d = site.details || {}
  const orders = readDataset("orders").filter((o: any) => o.pickup_site_id === id || o.delivery_site_id === id)
  const orderIds = new Set<string>(orders.map((o: any) => o.id))
  const cards = buildCardsFromDataset(orderIds)

  const facts: Fact[] = [
    { label: "Kind", value: label(site.kind) },
    { label: "Location", value: `${site.city}, ${site.country}` },
    { label: "Hours", value: hoursText(d.opening_hours) ?? "Mon–Fri 08:00–18:00" },
    { label: "Release rule", value: d.requires_signed_release ? "Signed Release Required" : "Standard Photo & CMR Handover" },
  ]

  return {
    snapshotAt: "2026-10-21T09:00:00Z",
    kind: "site",
    kindLabel: KIND_LABEL.site,
    id,
    title: site.name,
    subtitle: `${label(site.kind)} · ${site.city}, ${site.country}`,
    facts,
    notes: ["Opening hours apply to transport pickup and dropoff. Gate clearance requires matching release PIN."],
    links: [],
    cards,
    roles: {},
  }
}

/** Every driver, customer or site, with how many orders in the snapshot involve it. */
export async function listEntities(kind: EntityKind): Promise<EntityList> {
  const hasDb = await isDbAvailable()

  if (hasDb) {
    try {
      const { bundles } = await loadBoardBundles()
      if (kind === "driver") {
        const rowsAll = await db.select().from(drivers)
        const counts = new Map<string, number>()
        for (const bundle of bundles) {
          const ids = new Set(rows(bundle, "work_assignments").map((row) => str(row.details.driver_id)).filter((value): value is string => !!value))
          for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
        }
        const items = rowsAll.map((driver) => ({
          id: driver.id, title: driver.displayName, subtitle: `${driver.homeCity}, ${driver.homeCountry}`, count: counts.get(driver.id) ?? 0, href: `/drivers/${driver.id}`,
        })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
        return { kind, kindLabel: "Drivers", items }
      }
      if (kind === "customer") {
        const rowsAll = await db.select().from(customers)
        const counts = new Map<string, number>()
        for (const bundle of bundles) counts.set(bundle.customer.id, (counts.get(bundle.customer.id) ?? 0) + 1)
        const items = rowsAll.map((customer) => ({
          id: customer.id, title: customer.name, subtitle: `${label(customer.accountTier)} · ${customer.country}`, count: counts.get(customer.id) ?? 0, href: `/customers/${customer.id}`,
        })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
        return { kind, kindLabel: "Customers", items }
      }
      const rowsAll = await db.select().from(sites)
      const counts = new Map<string, number>()
      for (const bundle of bundles) {
        const ids = new Set([
          bundle.order.pickupSiteId ?? bundle.places.get(bundle.order.pickupAddressId)?.managedSiteId ?? null,
          bundle.order.deliverySiteId ?? bundle.places.get(bundle.order.deliveryAddressId)?.managedSiteId ?? null,
          ...rows(bundle, "transport_points").map((point) => str(point.details.site_id)),
        ].filter((value): value is string => !!value))
        for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      const items = rowsAll.map((site) => ({
        id: site.id, title: site.name, subtitle: `${label(site.kind)} · ${site.city}, ${site.country}`, count: counts.get(site.id) ?? 0, href: `/sites/${site.id}`,
      })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
      return { kind, kindLabel: "Places", items }
    } catch {
      // fallback below
    }
  }

  // Instant dataset calculation when PostgreSQL is offline
  if (kind === "driver") {
    const rowsAll = readDataset("drivers")
    const assignments = readDataset("work_assignments")
    const counts = new Map<string, number>()
    for (const wa of assignments) {
      if (wa.driver_id) counts.set(wa.driver_id, (counts.get(wa.driver_id) ?? 0) + 1)
    }
    const items = rowsAll.map((driver: any) => ({
      id: driver.id,
      title: driver.display_name,
      subtitle: `${driver.home_city}, ${driver.home_country}`,
      count: counts.get(driver.id) ?? 0,
      href: `/drivers/${driver.id}`,
    })).sort((a: any, b: any) => b.count - a.count || a.title.localeCompare(b.title))
    return { kind, kindLabel: "Drivers", items }
  }

  if (kind === "customer") {
    const rowsAll = readDataset("customers")
    const orders = readDataset("orders")
    const counts = new Map<string, number>()
    for (const ord of orders) {
      if (ord.customer_id) counts.set(ord.customer_id, (counts.get(ord.customer_id) ?? 0) + 1)
    }
    const items = rowsAll.map((customer: any) => ({
      id: customer.id,
      title: customer.name,
      subtitle: `${label(customer.account_tier)} · ${customer.country}`,
      count: counts.get(customer.id) ?? 0,
      href: `/customers/${customer.id}`,
    })).sort((a: any, b: any) => b.count - a.count || a.title.localeCompare(b.title))
    return { kind, kindLabel: "Customers", items }
  }

  const rowsAll = readDataset("sites")
  const orders = readDataset("orders")
  const counts = new Map<string, number>()
  for (const ord of orders) {
    if (ord.pickup_site_id) counts.set(ord.pickup_site_id, (counts.get(ord.pickup_site_id) ?? 0) + 1)
    if (ord.delivery_site_id) counts.set(ord.delivery_site_id, (counts.get(ord.delivery_site_id) ?? 0) + 1)
  }
  const items = rowsAll.map((site: any) => ({
    id: site.id,
    title: site.name,
    subtitle: `${label(site.kind)} · ${site.city}, ${site.country}`,
    count: counts.get(site.id) ?? 0,
    href: `/sites/${site.id}`,
  })).sort((a: any, b: any) => b.count - a.count || a.title.localeCompare(b.title))
  return { kind, kindLabel: "Places", items }
}

export { strings }
