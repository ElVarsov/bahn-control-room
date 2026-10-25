// Puts the demo back to its committed state: removes local agent runs (traces/run-*.json, which are
// gitignored and override the committed ones in traces/seed). Restart `npm run dev` afterwards.
//   npm run demo:reset

import { readdirSync, rmSync } from "node:fs"
import { join } from "node:path"

const dir = join(process.cwd(), "..", "traces")
const local = readdirSync(dir).filter((f) => /^run-.*\.json$/.test(f))
for (const file of local) rmSync(join(dir, file))
console.log(local.length ? `Removed ${local.length} local run(s): ${local.join(", ")}` : "Nothing to reset: no local runs.")
console.log("Restart the app (npm run dev) to load the committed runs only.")
