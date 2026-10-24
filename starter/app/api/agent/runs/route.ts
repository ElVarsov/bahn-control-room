import { NextResponse } from "next/server"
import type { DriverMode } from "@/lib/agent/driver-call"
import { startRun } from "@/lib/agent/loop"
import { allRuns } from "@/lib/agent/runs"

export const runtime = "nodejs"

// Start the road agent on an order. It runs in the background; poll GET /api/agent/runs/:id.
export async function POST(request: Request) {
  const body = (await request.json()) as { order?: string; orderId?: string; trigger?: string; driverMode?: DriverMode }
  const order = body.order ?? body.orderId
  if (!order) return NextResponse.json({ error: "order is required" }, { status: 400 })
  try {
    const record = startRun({ order, trigger: body.trigger ?? "A person asked the agent to look at this order", driverMode: body.driverMode })
    return NextResponse.json(record)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 })
  }
}

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("orderId")
  return NextResponse.json(allRuns().filter((record) => !orderId || record.orderId === orderId))
}
