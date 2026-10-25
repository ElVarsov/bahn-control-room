import Link from "next/link"
import type { QueueItem } from "@/lib/contracts"
import { relativeTo } from "@/lib/present/time"
import { AGENT_STATE } from "./labels"

// Work the agents are doing on their own. Visible so nobody wonders, quiet so nobody has to act.
export function AgentsWorking({ items, snapshotAt }: { items: QueueItem[]; snapshotAt: string }) {
  return (
    <section className="agents-working" aria-labelledby="agents-working-title">
      <h2 id="agents-working-title" className="queue-group-title">
        On watch<span className="num">{items.length}</span>
        <span className="queue-group-note">Agents are waiting on a reply or the monitor is watching. No action needed; they come back here if they need you.</span>
      </h2>
      <ul className="working-rows">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/orders/${item.orderId}`} className="working-row">
              <span className={`agent-pulse state-${item.agentState}`} aria-hidden="true" />
              <span className="working-text">
                <span className="working-headline">{item.headline}</span>
                <span className="working-meta">{item.car} <span className="mono">{item.orderReference}</span> · {item.route}</span>
              </span>
              <span className="working-state">
                {AGENT_STATE[item.agentState]}
                <small>{relativeTo(item.updatedAt, snapshotAt)?.text}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
