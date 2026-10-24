import { NextResponse } from "next/server"
import { startInboundCall } from "@/lib/voice"

export const runtime = "nodejs"

// The driver tapped "Call Bahn" in the driver app. Returns the agent's greeting.
export async function POST(request: Request) {
  const { driverId } = (await request.json()) as { driverId?: string }
  if (!driverId) return NextResponse.json({ error: "driverId is required" }, { status: 400 })
  return NextResponse.json(await startInboundCall(driverId))
}
