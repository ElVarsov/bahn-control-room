import { NextRequest, NextResponse } from "next/server"
import { voiceManager } from "@/lib/voice"

export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  const call = voiceManager.getCall(params.id)
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 })
  return NextResponse.json(call)
}
