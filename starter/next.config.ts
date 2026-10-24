import type { NextConfig } from "next"

// The driver phone page is opened through a Cloudflare quick tunnel during demos (docs/VOICE.md).
const config: NextConfig = { devIndicators: false, allowedDevOrigins: ["*.trycloudflare.com"] }

export default config
