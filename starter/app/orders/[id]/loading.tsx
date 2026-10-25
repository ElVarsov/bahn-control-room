// Shown while the case loads: the shape of the page, so nothing jumps.
export default function Loading() {
  return (
    <main className="page case-page" aria-busy="true">
      <p className="loading-note">Loading the order…</p>
      <div className="skeleton skeleton-head" />
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card short" />
    </main>
  )
}
