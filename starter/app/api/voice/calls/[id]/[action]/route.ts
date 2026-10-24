import { NextResponse } from "next/server"
import { answer, decline, driverSaid, getCall, hangUp } from "@/lib/voice"

export const runtime = "nodejs"

// Actions from the driver's phone: answer, decline, turn (what the driver said), hangup.
export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params
  if (!getCall(id)) return NextResponse.json({ error: "Call not found" }, { status: 404 })
  switch (action) {
    case "answer":
      return NextResponse.json(await answer(id))
    case "turn": {
      const { text } = (await request.json()) as { text?: string }
      if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 })
      return NextResponse.json(await driverSaid(id, text.trim()))
    }
    case "decline":
      decline(id)
      return NextResponse.json({ ok: true })
    case "hangup":
      hangUp(id)
      return NextResponse.json({ ok: true })
    default:
      return NextResponse.json({ error: `Unknown action ${action}` }, { status: 404 })
  }
}
