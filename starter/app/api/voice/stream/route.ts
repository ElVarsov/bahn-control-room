import { ringingCallFor, subscribe } from "@/lib/voice"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Server-sent events for one driver's phone: an "incoming" event rings it, "update" events follow the call.
export async function GET(request: Request) {
  const driverId = new URL(request.url).searchParams.get("driverId")
  if (!driverId) return new Response("driverId is required", { status: 400 })

  const encoder = new TextEncoder()
  let cleanup = () => {}
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      const ringing = ringingCallFor(driverId)
      if (ringing) send({ type: "incoming", call: ringing })
      const unsubscribe = subscribe((event) => {
        if (event.call.request.driverId === driverId) send(event)
      })
      const keepAlive = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15000)
      cleanup = () => { unsubscribe(); clearInterval(keepAlive) }
      request.signal.addEventListener("abort", () => { cleanup(); controller.close() })
    },
    cancel() { cleanup() },
  })
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  })
}
