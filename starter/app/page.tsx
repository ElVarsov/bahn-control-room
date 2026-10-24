import type { Metadata } from "next"
import Link from "next/link"
import { getQueue, OPS_ZONE } from "@/lib/present/source"
import { fmtWeekday, fmtClock } from "@/lib/present/time"
import { AppFrame } from "./components/app-frame"
import { LiveRefresh } from "./components/queue/live-refresh"
import { DashboardView } from "./components/queue/dashboard-view"

export const metadata: Metadata = { title: "Needs you · Control Room" }
export const dynamic = "force-dynamic"

// The home page: only the orders that need a person, each written as the decision to make.
export default async function NeedsYou() {
  const queue = await getQueue()
  const decisions = queue.needsPerson.length
  const working = queue.agentsWorking?.length ?? 0

  return (
    <AppFrame section="queue" snapshotAt={queue.snapshotAt}>
      <main className="page queue-page">
        <LiveRefresh />
        <header className="queue-head" style={{ marginBottom: "16px" }}>
          <div>
            <h1 className="queue-title">Needs you{decisions > 0 && <span className="queue-count num">{decisions}</span>}</h1>
            <p className="queue-sub">
              {fmtWeekday(queue.snapshotAt, OPS_ZONE)}, {fmtClock(queue.snapshotAt, OPS_ZONE)} Helsinki time
              <span className="sep">·</span>{working} handled by agents
              <span className="sep">·</span>{queue.quiet.count} running quietly
            </p>
          </div>
          <p className="queue-keys" aria-hidden="true"><kbd>J</kbd><kbd>K</kbd> move <kbd>Enter</kbd> open</p>
        </header>

        <DashboardView
          items={queue.needsPerson}
          workingItems={queue.agentsWorking ?? []}
          snapshotAt={queue.snapshotAt}
          zone={OPS_ZONE}
          quietCount={queue.quiet.count}
        />
      </main>
    </AppFrame>
  )
}
