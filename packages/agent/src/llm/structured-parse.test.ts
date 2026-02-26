import { describe, it, expect } from 'vitest'
import { parseStructuredFromAssistantMessage } from './structured-parse.js'

const schema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['approve', 'decline'] },
    rationale: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
      },
      required: ['summary'],
    },
  },
  required: ['action', 'rationale'],
}

describe('parseStructuredFromAssistantMessage', () => {
  it('parses embedded JSON from prose content', () => {
    const input = 'Analysis complete. {"action":"approve","rationale":{"summary":"Strong cash flow"}}'
    const out = parseStructuredFromAssistantMessage(input, schema)
    expect(out.error).toBeUndefined()
    expect(out.value).toEqual({
      action: 'approve',
      rationale: { summary: 'Strong cash flow' },
    })
  })

  it('parses JSON after <think> blocks', () => {
    const input = '<think>chain of thought</think>{"action":"decline","rationale":{"summary":"Weak DSCR"}}'
    const out = parseStructuredFromAssistantMessage(input, schema)
    expect(out.error).toBeUndefined()
    expect(out.value).toEqual({
      action: 'decline',
      rationale: { summary: 'Weak DSCR' },
    })
  })

  it('parses JSON from content-part arrays', () => {
    const input = [
      { type: 'reasoning', text: 'internal thoughts' },
      { type: 'text', text: '{"action":"approve","rationale":{"summary":"Healthy margins"}}' },
    ]
    const out = parseStructuredFromAssistantMessage(input, schema)
    expect(out.error).toBeUndefined()
    expect(out.value).toEqual({
      action: 'approve',
      rationale: { summary: 'Healthy margins' },
    })
  })
})
