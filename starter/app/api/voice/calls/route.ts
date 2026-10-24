import { NextResponse } from "next/server"
import type { CallRequest } from "@/lib/contracts"
import { startCall } from "@/lib/voice"

export const runtime = "nodejs"

// Starts ringing a driver's phone. The agent calls callDriver() in-process; this route is for scripts and demos.
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CallRequest>
  if (!body.driverId || !body.driverName || !body.orderId || !body.purpose || !Array.isArray(body.questions)) {
    return NextResponse.json({ error: "driverId, driverName, orderId, purpose and questions are required" }, { status: 400 })
  }
  const call = startCall(body as CallRequest)
  return NextResponse.json({ callId: call.id })
}
