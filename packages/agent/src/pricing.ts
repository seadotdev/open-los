/**
 * Cost estimation utilities.
 *
 * Prices are USD per 1M tokens and are derived from published OpenRouter model
 * pricing (snapshot: 2026-02-26). These are estimates only; final billing is
 * determined by provider-side metering.
 */

export type TokenPricingPerMillion = { input: number; output: number }

// Keep this focused on models we actively run in Loanville tests plus common
// defaults used in this repository.
const MODEL_PRICING_PER_MILLION: Record<string, TokenPricingPerMillion> = {
  // Anthropic defaults
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },

  // OpenRouter models used in matrix runs
  "meta-llama/llama-4-maverick": { input: 0.15, output: 0.60 },
  "google/gemini-2.5-flash": { input: 0.30, output: 2.50 },
  "nvidia/llama-3.3-nemotron-super-49b-v1.5": { input: 0.10, output: 0.40 },
  "nvidia/nemotron-nano-9b-v2": { input: 0.04, output: 0.16 },
  "mistralai/mistral-small-3.2-24b-instruct": { input: 0.06, output: 0.18 },
  "minimax/minimax-m2.5": { input: 0.30, output: 1.10 },
  "moonshotai/kimi-k2": { input: 0.55, output: 2.20 },
  "xiaomi/mimo-v2-flash": { input: 0.09, output: 0.29 },
}

// Conservative generic fallback for unknown models. This is still only an
// estimate and should be treated as directional.
const DEFAULT_PRICING_PER_MILLION: TokenPricingPerMillion = {
  input: 0.30,
  output: 1.00,
}

function normalizeModelId(model: string): string {
  const trimmed = (model ?? "").trim()
  // OpenRouter variants often include suffixes like ":free"
  return trimmed.replace(/:free$/i, "")
}

export function getPricingPerMillion(model: string): TokenPricingPerMillion {
  const normalized = normalizeModelId(model)
  return MODEL_PRICING_PER_MILLION[normalized] ?? DEFAULT_PRICING_PER_MILLION
}

export function estimateCostUsd(tokensIn: number, tokensOut: number, model: string): number {
  const pricing = getPricingPerMillion(model)
  const inCost = (tokensIn * pricing.input) / 1_000_000
  const outCost = (tokensOut * pricing.output) / 1_000_000
  return inCost + outCost
}
