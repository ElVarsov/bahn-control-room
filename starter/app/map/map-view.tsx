"use client"

import dynamic from "next/dynamic"

const FleetMap = dynamic(() => import("../components/fleet-map").then((mod) => mod.FleetMap), {
  ssr: false,
  loading: () => (
    <div style={{ height: "600px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--birch)", borderRadius: "14px", border: "1px solid var(--hair)", gap: "10px" }}>
      <div style={{ width: "24px", height: "24px", border: "3px solid var(--hair)", borderTopColor: "var(--teal)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <p style={{ color: "var(--muted)", fontSize: "13px" }}>Loading European Fleet Radar...</p>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  ),
})

export function MapView() {
  return <FleetMap />
}
