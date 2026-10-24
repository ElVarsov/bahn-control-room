import type { Metadata, Viewport } from "next"
import { DriverPhone } from "./driver-phone"

export const metadata: Metadata = { title: "Bahn Driver" }
export const viewport: Viewport = { themeColor: "#12110e", width: "device-width", initialScale: 1, maximumScale: 1 }

// The driver's phone for the demo: open /driver?d=<driverId> on a phone and the agent can call it.
export default async function DriverPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams
  return <DriverPhone driverId={d ?? "drv-140"} />
}
