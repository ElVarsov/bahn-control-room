// What the in-call agent may know about a driver who calls in: their name and
// current jobs, read straight from the dataset files so calls work without the database.

import { readFileSync } from "node:fs"
import path from "node:path"

export type DriverJob = { orderId: string; reference: string; car: string; route: string; status: string }
export type DriverContext = { driverId: string; driverName: string; jobs: DriverJob[] }

type Row = Record<string, unknown>
const cache = new Map<string, Row[]>()

function rows(file: string): Row[] {
  const hit = cache.get(file)
  if (hit) return hit
  const dir = process.env.DATASET_DIR ?? path.resolve(process.cwd(), "../dataset/data")
  const parsed = readFileSync(path.join(dir, file), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as Row)
  cache.set(file, parsed)
  return parsed
}

export function driverContext(driverId: string): DriverContext {
  const driver = rows("drivers.jsonl").find((row) => row.id === driverId)
  const orders = rows("orders.jsonl")
  const addresses = rows("addresses.jsonl")
  const vehicles = rows("vehicles.jsonl")
  const items = rows("order_items.jsonl")
  const city = (id: unknown) => String(addresses.find((row) => row.id === id)?.city ?? "?")

  // Live work first: a job in progress is the most likely reason to call.
  const jobs = rows("work_assignments.jsonl")
    .filter((row) => row.driver_id === driverId && (row.status === "IN_PROGRESS" || row.status === "ASSIGNED"))
    .sort((a) => (a.status === "IN_PROGRESS" ? -1 : 1))
    .flatMap((assignment): DriverJob[] => {
      const order = orders.find((row) => row.id === assignment.order_id)
      if (!order) return []
      const item = items.find((row) => row.order_id === order.id && row.role === "PRIMARY")
      const vehicle = item && vehicles.find((row) => row.id === item.vehicle_id)
      return [{
        orderId: String(order.id),
        reference: String(order.reference),
        car: vehicle ? `${vehicle.make} ${vehicle.model}` : "a car",
        route: `${city(order.pickup_address_id)} → ${city(order.delivery_address_id)}`,
        status: assignment.status === "IN_PROGRESS" ? "driving it now" : "booked, not started",
      }]
    })

  return { driverId, driverName: String(driver?.display_name ?? "the driver"), jobs }
}
