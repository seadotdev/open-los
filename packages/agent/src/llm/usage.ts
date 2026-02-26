import type { LLMUsageSnapshot } from '../types.js'

type Path = ReadonlyArray<string>

export interface UsageExtractConfig {
  inputTokenPaths: ReadonlyArray<Path>
  outputTokenPaths: ReadonlyArray<Path>
  billedInputTokenPaths?: ReadonlyArray<Path>
  billedOutputTokenPaths?: ReadonlyArray<Path>
  billedCostPaths?: ReadonlyArray<Path>
  promptCostPaths?: ReadonlyArray<Path>
  completionCostPaths?: ReadonlyArray<Path>
}

export interface UsageExtractResult {
  tokensIn: number
  tokensOut: number
  billedTokensIn?: number
  billedTokensOut?: number
  billedCostUsd?: number
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function getNumberAtPath(root: unknown, path: Path): number | undefined {
  let current: unknown = root
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return toFiniteNumber(current)
}

function getFirstNumber(root: unknown, paths?: ReadonlyArray<Path>): number | undefined {
  if (!paths) return undefined
  for (const path of paths) {
    const n = getNumberAtPath(root, path)
    if (n !== undefined) return n
  }
  return undefined
}

function sanitizeNonNegative(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  return value >= 0 ? value : undefined
}

export function extractUsageFromResponse(
  response: unknown,
  config: UsageExtractConfig
): UsageExtractResult {
  const tokensIn = sanitizeNonNegative(getFirstNumber(response, config.inputTokenPaths)) ?? 0
  const tokensOut = sanitizeNonNegative(getFirstNumber(response, config.outputTokenPaths)) ?? 0

  const billedTokensIn = sanitizeNonNegative(getFirstNumber(response, config.billedInputTokenPaths))
  const billedTokensOut = sanitizeNonNegative(getFirstNumber(response, config.billedOutputTokenPaths))

  let billedCostUsd = sanitizeNonNegative(getFirstNumber(response, config.billedCostPaths))
  if (billedCostUsd === undefined) {
    const promptCost = sanitizeNonNegative(getFirstNumber(response, config.promptCostPaths))
    const completionCost = sanitizeNonNegative(getFirstNumber(response, config.completionCostPaths))
    if (promptCost !== undefined || completionCost !== undefined) {
      billedCostUsd = (promptCost ?? 0) + (completionCost ?? 0)
    }
  }

  return {
    tokensIn,
    tokensOut,
    billedTokensIn,
    billedTokensOut,
    billedCostUsd,
  }
}

export function resolveUsageForTrace(
  llmClient: unknown,
  estimateCost: (tokensIn: number, tokensOut: number) => number
): { tokensIn: number; tokensOut: number; costUsd: number } {
  const defaultUsage = { tokensIn: 0, tokensOut: 0, costUsd: 0 }
  if (!llmClient || typeof llmClient !== 'object') return defaultUsage

  const client = llmClient as Record<string, unknown>
  if (typeof client.getUsage === 'function') {
    const usage = (client.getUsage as () => LLMUsageSnapshot)()
    const tokensIn = sanitizeNonNegative(toFiniteNumber(usage?.tokensIn)) ?? 0
    const tokensOut = sanitizeNonNegative(toFiniteNumber(usage?.tokensOut)) ?? 0
    const billedCostUsd = sanitizeNonNegative(toFiniteNumber(usage?.billedCostUsd))
    return {
      tokensIn,
      tokensOut,
      costUsd: billedCostUsd ?? estimateCost(tokensIn, tokensOut),
    }
  }

  const tokensIn = sanitizeNonNegative(toFiniteNumber(client.tokensIn)) ?? 0
  const tokensOut = sanitizeNonNegative(toFiniteNumber(client.tokensOut)) ?? 0
  return {
    tokensIn,
    tokensOut,
    costUsd: estimateCost(tokensIn, tokensOut),
  }
}

