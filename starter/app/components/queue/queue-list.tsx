"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { QueueItem, Urgency } from "@/lib/contracts"
import { Icon } from "../icons"
import { Deadline } from "./deadline"
import { REASON, URGENCY_GROUP } from "./labels"

const ORDER: Urgency[] = ["now", "today", "soon", "watch"]

export function QueueList({ items, snapshotAt, zone }: { items: QueueItem[]; snapshotAt: string; zone: string }) {
  const router = useRouter()
  const rows = useRef<(HTMLAnchorElement | null)[]>([])
  const [active, setActive] = useState(-1)

  // Within a group, the earliest deadline first; items without one go last.
  const groups = ORDER.map((urgency) => ({
    urgency,
    items: items
      .filter((item) => item.urgency === urgency)
      .sort((a, b) => (a.decideBy ?? "9999").localeCompare(b.decideBy ?? "9999")),
  })).filter((group) => group.items.length > 0)
  const flat = groups.flatMap((group) => group.items)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest("input, textarea, select, [contenteditable]") || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === "j" || event.key === "k") {
        event.preventDefault()
        setActive((current) => {
          const next = Math.max(0, Math.min(flat.length - 1, current + (event.key === "j" ? 1 : -1)))
          rows.current[next]?.focus()
          return next
        })
      } else if (event.key === "Enter" && active >= 0 && document.activeElement !== rows.current[active]) {
        router.push(`/orders/${flat[active].orderId}`)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flat, active, router])

  let index = -1
  return (
    <div className="queue-groups">
      {groups.map((group) => (
        <section key={group.urgency} className={`queue-group urgency-${group.urgency}`} aria-labelledby={`group-${group.urgency}`}>
          <h2 id={`group-${group.urgency}`} className="queue-group-title">
            {URGENCY_GROUP[group.urgency]}<span className="num">{group.items.length}</span>
          </h2>
          <ol className="queue-rows">
            {group.items.map((item) => {
              index += 1
              const i = index
              // Nothing to say yes to until the agent has worked the order.
              const untouched = item.agentState === "idle" && item.reason !== "forecast"
              const reason = untouched ? null : item.reason ? REASON[item.reason] : null
              return (
                <li key={item.id}>
                  <Link
                    href={`/orders/${item.orderId}`}
                    className={`queue-row urgency-${item.urgency}${item.reason === "forecast" ? " is-forecast" : ""}`}
                    ref={(element) => { rows.current[i] = element }}
                    onFocus={() => setActive(i)}
                  >
                    <div className="queue-row-main">
                      <div className="queue-row-top">
                        {reason && <span className={`chip tone-${reason.tone}`}><Icon name={reason.icon} size={12} />{reason.label}</span>}
                        {untouched && <span className="chip">Not looked at yet</span>}
                        <span className="queue-row-car">{item.car}</span>
                        <span className="queue-row-ref mono">{item.orderReference}</span>
                      </div>
                      <h3 className="queue-row-headline">{item.headline}</h3>
                      <p className="queue-row-why">{item.why}</p>
                      {item.agentDid && !untouched && (
                        <p className="queue-row-agent"><Icon name="bot" size={14} /><span>{item.agentDid}</span></p>
                      )}
                    </div>
                    <div className="queue-row-side">
                      <Deadline at={item.decideBy} snapshotAt={snapshotAt} zone={zone} />
                      <span className="queue-row-route">{item.route}</span>
                      {item.customer && <span className="queue-row-customer">{item.customer}</span>}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
