import { NextRequest, NextResponse } from "next/server"
import { worldStore } from "@/lib/world/store"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json(worldStore.getAutonomySettings())
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const updated = worldStore.updateAutonomySettings(body)
    return NextResponse.json(updated)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update autonomy settings" }, { status: 500 })
  }
}
