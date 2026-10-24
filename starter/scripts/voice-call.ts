// Rings a driver's phone from the command line, the same way the agent will.
//   npm run voice:call -- drv-140 ord-00299
// The phone must have /driver?d=drv-140 open and be on shift.

import "dotenv/config"
import { readFileSync } from "node:fs"
import path from "node:path"
import type { CallRequest } from "../lib/contracts"
import { callDriverRemote } from "../lib/voice"

const appUrl = process.env.APP_URL ?? "http://localhost:3000"
const dataDir = process.env.DATASET_DIR ?? path.resolve("../dataset/data")
const [driverId = "drv-140", orderId = "ord-00299"] = process.argv.slice(2)

function rows(file: string): Record<string, unknown>[] {
  return readFileSync(path.join(dataDir, file), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line))
}

const driver = rows("drivers.jsonl").find((row) => row.id === driverId)
const order = rows("orders.jsonl").find((row) => row.id === orderId)
const item = rows("order_items.jsonl").find((row) => row.order_id === orderId)
const vehicle = item && rows("vehicles.jsonl").find((row) => row.id === item.vehicle_id)

const car = vehicle ? `${vehicle.make} ${vehicle.model}` : "the car"
const addresses = rows("addresses.jsonl")
const cityOf = (id: unknown) => addresses.find((row) => row.id === id)?.city
const route = order && cityOf(order.pickup_address_id) && cityOf(order.delivery_address_id)
  ? `${cityOf(order.pickup_address_id)} to ${cityOf(order.delivery_address_id)}`
  : null
const request: CallRequest = {
  orderId,
  driverId,
  driverName: String(driver?.display_name ?? "the driver"),
  purpose: `A warning light was reported on the ${car} for ${order?.reference ?? orderId}. Check the driver is safe and find out where the car is.`,
  questions: [
    "Is the driver safe and off the road?",
    "Where exactly is the car (road, service area, nearest town)?",
    "What warning light is on, and does the car still drive normally?",
    "Can the driver send a photo of the warning light in the app?",
  ],
  context: [
    `Car: ${car}. Order ${order?.reference ?? orderId}.`,
    route ? `Planned route: ${route}. The driver should be somewhere along this route.` : "",
  ].filter(Boolean).join("\n"),
}

async function main() {
  console.log(`Calling ${request.driverName} (${driverId}) about ${order?.reference ?? orderId}…`)
  const result = await callDriverRemote(appUrl, request)
  console.log(`\nCall ${result.status}.`)
  for (const turn of result.transcript) console.log(`${turn.speaker === "agent" ? "Agent " : "Driver"}: ${turn.text}`)
  console.log(`\nSummary: ${result.summary}`)
  for (const fact of result.facts) console.log(`  · ${fact.text} (${fact.strength}, ${fact.sources[0]?.label})`)
}

main().catch((error) => { console.error(error); process.exit(1) })
