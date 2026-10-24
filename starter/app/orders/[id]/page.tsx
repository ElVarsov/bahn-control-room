import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getCase, OPS_ZONE, SNAPSHOT_AT } from "@/lib/present/source"
import { AppFrame } from "../../components/app-frame"
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
  const reason = item?.reason ? REASON[item.reason] : null
  const tone = item ? URGENCY_TONE[item.urgency] : "neutral"

  return (
    <AppFrame section="queue" snapshotAt={SNAPSHOT_AT}>
      <main className="page case-page">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Needs you</Link><span>/</span><span className="mono">{view.orderReference}</span>
        </nav>

        <header className="case-head">
          <div className="case-kicker">
            {reason && <span className={`chip tone-${reason.tone}`}><Icon name={reason.icon} size={12} />{reason.label}</span>}
            {item?.stage && <span className="chip">{item.stage}</span>}
            {item?.decideBy && <Deadline at={item.decideBy} snapshotAt={SNAPSHOT_AT} zone={OPS_ZONE} />}
          </div>
          <h1 className="case-car">{item?.car ?? view.orderReference}</h1>
          <div className="chips">
            <span className="chip-fact mono">{view.orderReference}</span>
            {item?.route && <span className="chip-fact"><Icon name="arrow" size={13} />{item.route}</span>}
            {item?.customer && <span className="chip-fact"><Icon name="people" size={13} />{item.customer}</span>}
            <Link className="chip-fact link" href={`/orders/${encodeURIComponent(id)}/record`}><Icon name="file" size={13} />Full order record</Link>
          </div>
          <p className={`story-headline tone-${tone} case-headline`}>{view.headline}</p>
          {item?.why && item.why !== view.headline && item.reason !== "driver_report" && <p className="case-why">{item.why}</p>}
        </header>

        <div className="case-grid">
          <div className="case-main">
            {item?.reason === "driver_report" && <DriverReportCard item={item} />}
            {view.proposals.length > 0
              ? <DecisionPanel proposals={view.proposals} />
              : item && item.reason !== "driver_report" && (
                <section className="decision decision-lite">
                  <p className="decision-eyebrow">{reason?.label ?? "Needs a person"}</p>
                  <h2 className="decision-title">{item.headline}</h2>
                  {item.agentDid && <p className="decision-rationale"><Icon name="bot" size={14} /> {item.agentDid}</p>}
                  <p className="decision-note">The agent has not written up a full proposal for this order yet. Open the full record to work on it by hand.</p>
                  <Link className="btn btn-primary" href={`/orders/${encodeURIComponent(id)}/record`}>Open the full record</Link>
                </section>
              )}

            {view.runs.length > 0 && <AgentWork runs={view.runs} snapshotAt={SNAPSHOT_AT} zone={OPS_ZONE} />}
            {view.timeline.length > 0 && <Timeline entries={view.timeline} zone={OPS_ZONE} />}
            {!full && <p className="case-partial">The case file for this order is still being built. Facts and history are in the <Link className="name-link" href={`/orders/${encodeURIComponent(id)}/record`}>full record</Link>.</p>}
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
