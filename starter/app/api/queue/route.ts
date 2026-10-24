import { NextResponse } from "next/server"
import { worldStore } from "@/lib/world/store"

export const runtime = "nodejs"

export async function GET() {
  try {
    const queue = worldStore.getQueue()
    return NextResponse.json(queue)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load queue" }, { status: 500 })
  }
}
