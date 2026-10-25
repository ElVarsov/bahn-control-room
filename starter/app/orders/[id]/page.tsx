import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { latestRunFor } from "@/lib/agent/runs"
import { carOf, resolveOrder, routeOf } from "@/lib/agent/tools"
import { getCase, OPS_ZONE, SNAPSHOT_AT } from "@/lib/present/source"
import { fmtClock } from "@/lib/present/time"
import { AppFrame } from "../../components/app-frame"
import { AgentControl } from "../../components/case/agent-control"
import { AgentWork } from "../../components/case/agent-work"
import { DecisionPanel } from "../../components/case/decision-panel"
import { DriverReportCard } from "../../components/case/driver-report-card"
import { FactsPanel } from "../../components/case/facts-panel"
import { Timeline } from "../../components/case/timeline"
import { Icon } from "../../components/icons"
import { Deadline } from "../../components/queue/deadline"
import { REASON, URGENCY_TONE } from "../../components/queue/labels"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const found = await getCase(id)
  return { title: found ? `${found.view.orderReference} · Control Room` : "Order · Control Room" }
}

// One order as a case: the decision first, then what the agent did, the facts and who said what.
// Orders without a case go straight to the full record.
export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await getCase(id)
  if (!found) redirect(`/orders/${encodeURIComponent(id)}/record`)
  const { view, item, full } = found
  const run = latestRunFor(id)
  const running = run?.run.state === "working"
  const reason = item?.reason ? REASON[item.reason] : null
  const tone = item ? URGENCY_TONE[item.urgency] : "neutral"
  // Decided and nothing left to approve: the case is closed for now.
  const lastYes = [...view.proposals].reverse().find((p) => p.status !== "pending" && p.decision)
  const closed = !!lastYes && !view.proposals.some((p) => p.status === "pending")

  return (
    <AppFrame section="queue" snapshotAt={SNAPSHOT_AT}>
      <main className="page case-page">
        <nav className="crumbs" aria-label="Breadcrumb">
          {item ? <Link href="/">Needs you</Link> : <Link href="/board">All orders</Link>}<span>/</span><span className="mono">{view.orderReference}</span>
        </nav>

        <header className="case-head">
          <div className="case-kicker">
            {reason && <span className={`chip tone-${reason.tone}`}><Icon name={reason.icon} size={12} />{reason.label}</span>}
            {item?.stage && <span className="chip">{item.stage}</span>}
            {item?.decideBy && <Deadline at={item.decideBy} snapshotAt={SNAPSHOT_AT} zone={OPS_ZONE} />}
          </div>
          <h1 className="case-car">{item?.car ?? carName(view.orderReference)}</h1>
          <div className="chips">
            <span className="chip-fact mono">{view.orderReference}</span>
            {(item?.route ?? routeName(view.orderReference)) && <span className="chip-fact"><Icon name="arrow" size={13} />{item?.route ?? routeName(view.orderReference)}</span>}
            {item?.customer && <span className="chip-fact"><Icon name="people" size={13} />{item.customer}</span>}
            <Link className="chip-fact link" href={`/orders/${encodeURIComponent(id)}/record`}><Icon name="file" size={13} />Full order record</Link>
          </div>
          <p className={`story-headline tone-${tone} case-headline`}>{view.headline}</p>
          {item?.why && item.why !== view.headline && item.reason !== "driver_report" && <p className="case-why">{item.why}</p>}
          <AgentControl orderId={id} running={running} hasRun={!!run} primary={!full && view.proposals.length === 0} quiet={closed} />
        </header>

        <div className="case-grid">
          <div className="case-main">
            {item?.reason === "driver_report" && <DriverReportCard item={item} />}
            {view.proposals.length > 0
              ? <DecisionPanel proposals={view.proposals} runs={view.runs} />
              : item && item.reason !== "driver_report" && (
                <section className="decision decision-lite">
                  <p className="decision-eyebrow"><Icon name="bot" size={13} /> Not looked at yet</p>
                  <p className="decision-rationale">Nobody has worked this order yet. Ask the agent above: it reads the order and conversation, may phone the driver, and brings you a proposal. The conversation so far is below.</p>
                  <Link className="btn btn-secondary" href={`/orders/${encodeURIComponent(id)}/record`}>Open the full record</Link>
                </section>
              )}

            {view.runs.length > 0 && <AgentWork runs={view.runs} snapshotAt={SNAPSHOT_AT} zone={OPS_ZONE} decidedLabel={lastYes?.decision ? `${fmtClock(lastYes.decision.decidedAt, OPS_ZONE)} · ${lastYes.decision.decidedBy === "You" ? "you" : lastYes.decision.decidedBy}` : undefined} />}
            {view.timeline.length > 0 && <Timeline entries={view.timeline} zone={OPS_ZONE} />}
          </div>

          {view.facts.length > 0 && (
            <aside className="case-aside">
              <FactsPanel facts={view.facts} zone={OPS_ZONE} />
            </aside>
          )}
        </div>
      </main>
    </AppFrame>
  )
}

// A case that has left the queue still shows the car, not just its number.
function carName(reference: string): string {
  try { return carOf(resolveOrder(reference)) } catch { return reference }
}

function routeName(reference: string): string | undefined {
  try { return routeOf(resolveOrder(reference)) } catch { return undefined }
}
