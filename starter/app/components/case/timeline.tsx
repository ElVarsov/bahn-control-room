import type { TimelineEntry } from "@/lib/contracts"
import { fmtClock, fmtLong, fmtWeekday } from "@/lib/present/time"
import { CHANNEL, SOURCE_KIND } from "../queue/labels"

// Who said what, and when. Internal notes look different: the customer and driver never saw them.
export function Timeline({ entries, zone }: { entries: TimelineEntry[]; zone: string }) {
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at))
  return (
    <section className="timeline" aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="case-section-title">Who said what<span className="case-section-note">Times in Helsinki time</span></h2>
      <ol className="timeline-list">
        {sorted.map((entry, index) => {
          const day = fmtWeekday(entry.at, zone)
          const newDay = index === 0 || fmtWeekday(sorted[index - 1].at, zone) !== day
          return (
            <li key={entry.id} className={`timeline-item actor-${entry.actor.kind}${entry.visibility === "internal" ? " is-internal" : ""}`}>
              {newDay && <p className="timeline-day">{day}</p>}
              <div className="timeline-row">
                <time className="timeline-time num" dateTime={entry.at} title={fmtLong(entry.at)}>{fmtClock(entry.at, zone)}</time>
                <div className="timeline-body">
                  <p className="timeline-who">
                    <b>{entry.actor.name}</b>
                    <span>{SOURCE_KIND[entry.actor.kind]} · {CHANNEL[entry.channel] ?? entry.channel}</span>
                    {entry.visibility === "internal" && <span className="chip">Only Bahn sees this</span>}
                  </p>
                  <p className="timeline-text">{entry.text}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
