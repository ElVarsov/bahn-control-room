import { NextRequest, NextResponse } from "next/server"
import { worldStore } from "@/lib/world/store"

export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const orderId = params.id
    const caseView = worldStore.getCase(orderId)
    if (!caseView) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    return NextResponse.json(caseView)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load case" }, { status: 500 })
  }
}
