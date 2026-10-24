import fs from "node:fs"
import path from "node:path"

let cachedDir: string | null = null

export function resolveDatasetDir(): string {
  if (cachedDir && fs.existsSync(cachedDir)) return cachedDir

  if (process.env.DATASET_DIR && fs.existsSync(process.env.DATASET_DIR)) {
    cachedDir = process.env.DATASET_DIR
    return cachedDir
  }

  const candidates = [
    path.join(process.cwd(), "dataset", "data"),
    path.join(process.cwd(), "..", "dataset", "data"),
    path.join(process.cwd(), "scratch", "bahn-control-room", "dataset", "data"),
    "C:\\Users\\Anton\\.gemini\\antigravity\\scratch\\bahn-control-room\\dataset\\data",
  ]

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      cachedDir = c
      return c
    }
  }

  let curr = process.cwd()
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(curr, "dataset", "data")
    if (fs.existsSync(candidate)) {
      cachedDir = candidate
      return candidate
    }
    const candidate2 = path.join(curr, "bahn-control-room", "dataset", "data")
    if (fs.existsSync(candidate2)) {
      cachedDir = candidate2
      return candidate2
    }
    const parent = path.dirname(curr)
    if (parent === curr) break
    curr = parent
  }

  cachedDir = path.join(process.cwd(), "..", "dataset", "data")
  return cachedDir
}

export function readDataset<T = any>(name: string): T[] {
  try {
    const dir = resolveDatasetDir()
    const file = path.join(dir, `${name}.jsonl`)
    if (!fs.existsSync(file)) return []
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as T)
  } catch (err) {
    console.error(`Failed to read dataset ${name}:`, err)
    return []
  }
}
