import type { Fact } from "@/lib/contracts"
import { fmtDateTime, fmtLong } from "@/lib/present/time"
import { SOURCE_KIND, STRENGTH } from "../queue/labels"

// Every fact says how strong it is and who said it, when. A quote is never shown as a booking.
export function FactsPanel({ facts, zone }: { facts: Fact[]; zone: string }) {
  return (
    <section className="facts-panel" aria-labelledby="facts-title">
      <h2 id="facts-title" className="case-section-title">What we know<span className="facts-zone">Times in Helsinki time</span></h2>
      <ul className="fact-list">
        {facts.map((fact) => {
          const strength = STRENGTH[fact.strength]
          return (
            <li key={fact.id} className="fact-item">
              <span className={`strength tone-${strength.tone}`} title={strength.hint}>{strength.label}</span>
              <p className="fact-text">{fact.text}</p>
              <ul className="fact-sources">
                {fact.sources.map((source, index) => (
                  <li key={index}>
                    <details>
                      <summary>
                        {source.label}
                        {source.actorName && <> · {source.actorName}</>}
                        {!source.actorName && source.kind !== "system" && <> · {SOURCE_KIND[source.kind]}</>}
                        <> · {fmtDateTime(source.at, zone, false)}</>
                      </summary>
                      <p className="fact-record">
                        {source.recordId ? <>Record <span className="mono">{source.recordId}</span>{source.table ? <> in {source.table.replace(/_/g, " ")}</> : null}. </> : "No single record: worked out by the agent. "}
                        {fmtLong(source.at)}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
      <p className="facts-legend">Tap a source to see the record it comes from.</p>
    </section>
  )
}
