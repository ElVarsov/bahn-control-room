import "server-only"

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import net from "node:net"
import * as schema from "./schema"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is required. See starter/README.md.")

let dbStatus: boolean | null = null

export async function isDbAvailable(): Promise<boolean> {
  if (dbStatus !== null) return dbStatus
  return new Promise((resolve) => {
    try {
      const u = new URL(url || "postgres://localhost:5432")
      const host = u.hostname || "localhost"
      const port = parseInt(u.port || "5432", 10)
      const socket = net.createConnection({ host, port, timeout: 300 })
      socket.on("connect", () => {
        socket.destroy()
        dbStatus = true
        resolve(true)
      })
      socket.on("error", () => {
        socket.destroy()
        dbStatus = false
        resolve(false)
      })
      socket.on("timeout", () => {
        socket.destroy()
        dbStatus = false
        resolve(false)
      })
    } catch {
      dbStatus = false
      resolve(false)
    }
  })
}

const client = postgres(url, { max: 5, connect_timeout: 1, idle_timeout: 1 })
export const db = drizzle(client, { schema })
