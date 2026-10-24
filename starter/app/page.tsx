import type { Metadata } from "next"
import Link from "next/link"
import { getQueue, OPS_ZONE } from "@/lib/present/source"
import { fmtWeekday, fmtClock } from "@/lib/present/time"
import { AppFrame } from "./components/app-frame"
import { Icon } from "./components/icons"
import { AgentsWorking } from "./components/queue/agents-working"
import { QueueList } from "./components/queue/queue-list"

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
        <header className="queue-head">
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

        {decisions === 0
          ? (
            <section className="queue-empty">
              <Icon name="check" size={22} />
              <h2>Nothing needs you right now.</h2>
              <p>Agents are working on {working} {working === 1 ? "order" : "orders"} and {queue.quiet.count} are running quietly. New decisions appear here on their own.</p>
            </section>
          )
          : <QueueList items={queue.needsPerson} snapshotAt={queue.snapshotAt} zone={OPS_ZONE} />}

        {working > 0 && <AgentsWorking items={queue.agentsWorking ?? []} snapshotAt={queue.snapshotAt} />}

        <section className="queue-quiet">
          <Icon name="eye" />
          <p>
            <b>{queue.quiet.count} orders are running quietly.</b> Agents watch them and bring them here if something changes.
          </p>
          <Link href="/board" className="quiet-link">See all orders <Icon name="arrow" size={14} /></Link>
        </section>
      </main>
    </AppFrame>
  )
}
