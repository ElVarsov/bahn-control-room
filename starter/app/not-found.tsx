import Link from "next/link"

// A bad link or an old bookmark: say so plainly and point back to the queue.
export default function NotFound() {
  return (
    <main className="page">
      <section className="queue-empty">
        <h2>We could not find that page.</h2>
        <p>The link may be old, or the order number may be mistyped.</p>
        <Link href="/" className="btn btn-primary">Back to Needs you</Link>
      </section>
    </main>
  )
}
