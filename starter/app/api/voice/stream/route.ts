import { NextRequest } from "next/server"
import { voiceManager } from "@/lib/voice"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  const customReadable = new ReadableStream({
    start(controller) {
      const unsubscribe = voiceManager.subscribe((event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          unsubscribe()
        }
      })

      request.signal.addEventListener("abort", () => {
        unsubscribe()
      })
    },
  })

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
