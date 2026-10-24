import { NextRequest, NextResponse } from "next/server"
import { worldStore } from "@/lib/world/store"
import type { Decision } from "@/lib/contracts"
import { decideAgentProposal } from "@/lib/agent/decide"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const proposalId = params.id
    const body = (await request.json()) as Decision
    // Proposals from a live agent run are decided (and carried out) by the agent store.
    const fromAgent = decideAgentProposal(proposalId, body)
    if (fromAgent) return NextResponse.json({ ...fromAgent.proposal, followUpRunId: fromAgent.followUpRunId })
    const updated = worldStore.recordDecision(proposalId, body)
    if (!updated) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to record decision" }, { status: 500 })
  }
}
