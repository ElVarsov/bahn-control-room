import type { Metadata } from "next"
import { AppFrame } from "../components/app-frame"
import { MapView } from "./map-view"

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

        <MapView />
      </main>
    </AppFrame>
  )
}
