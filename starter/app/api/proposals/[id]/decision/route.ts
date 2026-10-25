import { NextRequest, NextResponse } from "next/server"
import { worldStore } from "@/lib/world/store"
import type { Decision } from "@/lib/contracts"
import { decideAgentProposal } from "@/lib/agent/decide"
import { SNAPSHOT_AT } from "@/lib/agent/dataset"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const proposalId = params.id
    const sent = (await request.json()) as Decision
    // Who decided and when is set here, never taken from the browser: the yes gate cannot be
    // claimed by the dial or a script. Until there is sign-in, the person at the screen is "You".
    if (String(sent.decidedBy ?? "").startsWith("Autonomy")) {
      return NextResponse.json({ error: "Only a person can decide here." }, { status: 403 })
    }
    const body: Decision = { ...sent, decidedBy: "You", decidedAt: SNAPSHOT_AT }
    // Proposals from a live agent run are decided (and carried out) by the agent store.
    const fromAgent = decideAgentProposal(proposalId, body)
    if (fromAgent?.alreadyDecided) {
      const by = fromAgent.proposal.decision?.decidedBy
      return NextResponse.json({ error: `Already decided${by ? ` by ${by === "You" ? "you" : by}` : ""}. Nothing was done twice.`, proposal: fromAgent.proposal }, { status: 409 })
    }
    if (fromAgent) return NextResponse.json({ ...fromAgent.proposal, followUpRunId: fromAgent.followUpRunId })
    const updated = worldStore.recordDecision(proposalId, body)
    if (!updated) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }
    if (updated.alreadyDecided) {
      return NextResponse.json({ error: "Already decided. Nothing was done twice.", proposal: updated.proposal }, { status: 409 })
    }
    return NextResponse.json(updated.proposal)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to record decision" }, { status: 500 })
  }
}
