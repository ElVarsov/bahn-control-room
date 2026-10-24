import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { latestRunFor } from "@/lib/agent/runs"
import { getCase, OPS_ZONE, SNAPSHOT_AT } from "@/lib/present/source"
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

  return (
    <AppFrame section="queue" snapshotAt={SNAPSHOT_AT}>
      <main className="page case-page">
        <nav className="crumbs" aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "5px", textDecoration: "none", color: "var(--muted)", fontWeight: 500, fontSize: "12.5px" }}>
            <span>←</span> Back to Needs You
          </Link>
          <span style={{ color: "var(--sand)" }}>/</span>
          <span className="mono" style={{ background: "var(--tray)", padding: "1px 6px", borderRadius: "4px", border: "1px solid var(--hair)", fontSize: "12px", color: "var(--ink)", fontWeight: 600 }}>
            {view.orderReference}
          </span>
        </nav>

        <header className="case-head" style={{ marginBottom: "24px" }}>
          <div className="case-kicker" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            {reason && (
              <span className={`chip tone-${reason.tone}`} style={{ fontWeight: 600 }}>
                <Icon name={reason.icon} size={12} />
                {reason.label}
              </span>
            )}
            {item?.stage && <span className="chip" style={{ fontWeight: 600 }}>{item.stage}</span>}
            {item?.reason === "forecast" && (
              <span className="provenance-pill is-estimate">⚡ AI Early Forecaster</span>
            )}
            {item?.decideBy && <Deadline at={item.decideBy} snapshotAt={SNAPSHOT_AT} zone={OPS_ZONE} />}
          </div>

          <h1 className="case-car" style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink)", margin: "4px 0 10px 0" }}>
            {item?.car ?? view.orderReference}
          </h1>

          <div className="chips" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
            <span className="chip-fact mono" style={{ fontWeight: 600 }}>{view.orderReference}</span>
            {item?.route && (
              <span className="chip-fact" style={{ fontWeight: 600, background: "var(--hair-soft)", color: "var(--ink)" }}>
                <Icon name="arrow" size={13} />
                {item.route}
              </span>
            )}
            {item?.customer && (
              <span className="chip-fact" style={{ color: "var(--brown)" }}>
                <Icon name="people" size={13} />
                {item.customer}
              </span>
            )}
            <Link className="chip-fact link" href={`/orders/${encodeURIComponent(id)}/record`} style={{ marginLeft: "auto", fontWeight: 500 }}>
              <Icon name="file" size={13} /> Full order record →
            </Link>
          </div>

          <p className={`story-headline tone-${tone} case-headline`} style={{ fontSize: "22px", fontWeight: 600, lineHeight: "1.3", color: "var(--ink)" }}>
            {view.headline}
          </p>
          {item?.why && item.why !== view.headline && item.reason !== "driver_report" && (
            <p className="case-why" style={{ color: "var(--brown)", fontSize: "14.5px", lineHeight: "1.5", marginTop: "6px" }}>
              {item.why}
            </p>
          )}

          <AgentControl orderId={id} running={running} hasRun={!!run} primary={!full && view.proposals.length === 0} />
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
                  <p className="decision-note">The agent has not written up a proposal for this order yet. Ask it to work on it above, or open the full record to work by hand.</p>
                  <Link className="btn btn-secondary" href={`/orders/${encodeURIComponent(id)}/record`}>Open the full record</Link>
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
