"use client"

import Link from "next/link"
import { useEffect } from "react"

// Something broke while loading. Plain words, a retry, and a way back; no developer screen.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <main className="page">
      <section className="queue-empty">
        <h2>This page did not load.</h2>
        <p>Nothing was changed. Try again, or go back to the queue.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={() => retry()}>Try again</button>
          <Link href="/" className="btn btn-ghost">Back to Needs you</Link>
        </div>
      </section>
    </main>
  )
}
