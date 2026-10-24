import type { Metadata } from "next"
import nextDynamic from "next/dynamic"
import { AppFrame } from "../components/app-frame"

const FleetMap = nextDynamic(() => import("../components/fleet-map").then((mod) => mod.FleetMap), {
  ssr: false,
  loading: () => (
    <div style={{ height: "600px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--birch)", borderRadius: "14px", border: "1px solid var(--hair)", gap: "10px" }}>
      <div style={{ width: "24px", height: "24px", border: "3px solid var(--hair)", borderTopColor: "var(--teal)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <p style={{ color: "var(--muted)", fontSize: "13px" }}>Loading European Fleet Radar...</p>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  ),
})

export const metadata: Metadata = { title: "Live Fleet & Ferry Radar · Control Room" }
export const dynamic = "force-dynamic"

export default function MapPage() {
  return (
    <AppFrame section="map">
      <main className="page" style={{ maxWidth: "1400px", padding: "20px 24px" }}>
        <header style={{ marginBottom: "16px" }}>
          <h1 className="queue-title" style={{ fontSize: "24px", margin: "0 0 4px 0" }}>
            Live European Fleet & Ferry Radar
          </h1>
          <p className="queue-sub" style={{ margin: 0 }}>
            Real-time positioning across German Autobahn transit corridors, Baltic Sea RoRo vessels, and Nordic compounds.
          </p>
        </header>

        <FleetMap />
      </main>
    </AppFrame>
  )
}
