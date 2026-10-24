import { NextRequest, NextResponse } from "next/server"
import { voiceManager } from "@/lib/voice"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  const body = await request.json()
  const result = voiceManager.processDriverTurn(params.id, body.text || "")
  return NextResponse.json(result)
}
