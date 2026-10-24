"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

// Re-reads the queue every few seconds so new decisions and calls appear without a reload.
// Pauses while the tab is hidden.
export function LiveRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) router.refresh() }, seconds * 1000)
    return () => clearInterval(timer)
  }, [router, seconds])
  return null
}
