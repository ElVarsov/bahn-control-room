// Record and quote ids belong in the fact sources, not in sentences people read.
export function withoutIds(text: string): string {
  return text
    .replace(/\s*\((?:quote|record|ref|id)?\s*[a-z]+-[a-z0-9]{4,}\)/gi, (m) => (/quote/i.test(m) ? " quote" : ""))
    .replace(/\s*(?:quote|record)\s+[a-z]+-[a-z0-9]{4,}/gi, (m) => (/quote/i.test(m) ? " quote" : ""))
    .replace(/\b(?:travel|hotel|win|msg|track|agent|quote)-[a-z0-9]{4,}\b/gi, "")
    .replace(/\s{2,}/g, " ").replace(/\s+([,.)])/g, "$1").trim()
}
