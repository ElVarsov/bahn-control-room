import { NextResponse } from "next/server"
import { getCall, toResult } from "@/lib/voice"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const call = getCall(id)
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 })
  return NextResponse.json(toResult(call))
}
