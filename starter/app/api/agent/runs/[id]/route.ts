import { NextResponse } from "next/server"
import { getRun } from "@/lib/agent/runs"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const record = getRun(id)
  if (!record) return NextResponse.json({ error: "Run not found" }, { status: 404 })
  return NextResponse.json(record)
}
