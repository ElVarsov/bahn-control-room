import { NextRequest, NextResponse } from "next/server"
import { voiceManager } from "@/lib/voice"
import type { CallRequest } from "@/lib/contracts"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CallRequest
    const call = voiceManager.createCall(body)
    return NextResponse.json({ callId: call.id, status: call.status })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create call" }, { status: 500 })
  }
}
