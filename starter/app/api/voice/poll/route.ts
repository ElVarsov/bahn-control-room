import { NextResponse } from "next/server"
import { latestCallFor, markDriverSeen } from "@/lib/voice"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The driver's phone asks here every second. Tunnels and venue proxies can hold
// back a server-sent event stream, but a short request always gets through.
export async function GET(request: Request) {
  const driverId = new URL(request.url).searchParams.get("driverId")
  if (!driverId) return NextResponse.json({ error: "driverId is required" }, { status: 400 })
  markDriverSeen(driverId)
  return NextResponse.json({ call: latestCallFor(driverId) ?? null }, { headers: { "cache-control": "no-store" } })
}
