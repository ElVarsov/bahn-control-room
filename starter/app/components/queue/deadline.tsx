import { fmtClock, fmtLong, relativeTo } from "@/lib/present/time"

/** "in 15 min" or "2 min overdue", with the clock time underneath. Measured against the snapshot. */
export function Deadline({ at, snapshotAt, zone, compact = false }: { at?: string; snapshotAt: string; zone: string; compact?: boolean }) {
  if (!at) return <span className="deadline deadline-none">No deadline</span>
  const rel = relativeTo(at, snapshotAt)
  const overdue = !!rel?.past
  const soon = !!rel && !rel.past && rel.minutes <= 60
  const text = !rel ? "" : rel.text === "now" ? "due now" : overdue ? `${rel.text.replace(" ago", "")} overdue` : rel.text
  return (
    <time className={`deadline${overdue ? " overdue" : soon ? " soon" : ""}`} dateTime={at} title={`Decide by ${fmtLong(at)}`}>
      <span className="deadline-rel">{text}</span>
      {!compact && <span className="deadline-clock">by {fmtClock(at, zone)}</span>}
    </time>
  )
}
