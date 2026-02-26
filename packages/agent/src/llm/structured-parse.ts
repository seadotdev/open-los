import { validateStructuredOutput } from './schema-validate.js'

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  const parts: string[] = []
  for (const part of content) {
    if (typeof part === 'string') {
      parts.push(part)
      continue
    }
    if (!part || typeof part !== 'object') continue

    const maybePart = part as Record<string, unknown>
    if (typeof maybePart.text === 'string') {
      parts.push(maybePart.text)
      continue
    }
    if (typeof maybePart.content === 'string') {
      parts.push(maybePart.content)
    }
  }
  return parts.join('\n')
}

function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

function extractJsonObjects(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '{') {
      if (depth === 0) start = i
      depth++
      continue
    }
    if (ch === '}') {
      if (depth > 0) depth--
      if (depth === 0 && start >= 0) {
        out.push(text.slice(start, i + 1))
        start = -1
      }
    }
  }

  return out
}

export function parseStructuredFromAssistantMessage<T>(
  content: unknown,
  schema: object
): { value?: T; error?: string } {
  const raw = extractText(content)
  if (!raw) return { error: 'No assistant text content to parse' }

  const cleaned = stripThinkBlocks(raw)
  const candidates = extractJsonObjects(cleaned)
  if (candidates.length === 0) {
    return { error: 'No JSON object found in assistant text content' }
  }

  let lastError = 'Unable to parse candidate JSON blocks'
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      const validationErrors = validateStructuredOutput(parsed, schema)
      if (validationErrors.length === 0) {
        return { value: parsed as T }
      }
      lastError = `JSON parsed but schema mismatch: ${validationErrors.join('; ')}`
    } catch (err: any) {
      lastError = `JSON parse failed: ${err?.message ?? 'unknown error'}`
    }
  }
  return { error: lastError }
}
