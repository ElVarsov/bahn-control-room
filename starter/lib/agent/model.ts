// One Claude client for the agent. Works against Anthropic directly or through
// OpenRouter (ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN), like lib/voice.

import Anthropic from "@anthropic-ai/sdk"

export const client = new Anthropic()
export const VIA_OPENROUTER = (process.env.ANTHROPIC_BASE_URL ?? "").includes("openrouter.ai")
export const MODEL = process.env.AGENT_MODEL || (VIA_OPENROUTER ? "anthropic/claude-opus-5.5" : "claude-opus-5-5")

/** Server-side refusal fallback is an Anthropic API feature; OpenRouter may not pass it through. */
export const FALLBACKS = VIA_OPENROUTER ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }

/** A single request with no tools, for small jobs like the simulated driver. */
export async function complete({ system, prompt, maxTokens = 2000 }: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    ...FALLBACKS,
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: prompt }],
  })
  if (response.stop_reason === "refusal") return ""
  return response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("")
}
