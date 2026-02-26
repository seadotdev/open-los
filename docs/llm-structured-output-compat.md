# LLM Structured Output Compatibility

Which models work with the Open LOS underwriting flow, which don't, and why.

## How structured output works

`openrouter.ts` uses a two-phase strategy for structured output:

1. **Tool call** (primary): Sends `tool_choice: { type: "function", function: { name: "structured_output" } }` forcing the model to call a tool with the response schema
2. **Prose recovery** (fallback): If no tool call returned, `structured-parse.ts` strips `<think>` blocks and extracts JSON objects from the assistant's text content
3. **Retry**: Up to 2 attempts, each trying tool call then prose recovery
4. **Schema validation**: Every candidate (tool call or extracted JSON) is validated against the schema before acceptance

## Tested models (2026-02-26, season run: 5 weeks, 25 evals each)

| Model | Error rate | Failure mode | Notes |
|-------|-----------|--------------|-------|
| `openai/gpt-4.1-nano` | **0%** | - | Fast, reliable tool calls |
| `deepseek/deepseek-chat-v3-0324` | **0%** | - | Reliable tool calls |
| `qwen/qwen3-next-80b-a3b-instruct` | **0%** | - | Reliable tool calls |
| `deepseek/deepseek-r1` | **0%** | - | Uses `<think>` blocks; works via prose recovery after think-stripping |
| `meta-llama/llama-3.3-70b-instruct` | **88%** | Prose only, no JSON | Ignores `tool_choice`, returns unstructured reasoning |

### Previously identified failures (from commit 5a4c2b6)

| Model | Failure mode |
|-------|-------------|
| `nvidia/nemotron-49b-v1.5` | Ignores forced `tool_choice` |
| `zhipu/glm-4-32b` | Breaks with forced `tool_choice` |
| `minimax/minimax-01` | Rejects `tools` parameter entirely (API error) |

## The pattern

**Works reliably:**
- Models trained for function calling: OpenAI GPT series, DeepSeek-V3, Qwen3
- Reasoning models that output JSON after thinking: DeepSeek-R1 (via `<think>` stripping)

**Fails:**
- Open-weight models served through inference providers (DeepInfra, Together, etc.) where the provider's tool_choice implementation is incomplete
- Specifically: Llama 3.x family via DeepInfra has `literal_required: false` at the provider level, meaning forced `tool_choice` is silently downgraded to `auto`, and the model then ignores the tool entirely

## Root cause: provider-level tool_choice support

The OpenRouter API metadata reports Llama-3.3-70B supports `tool_choice` and even `structured_outputs`. But these flags describe the *model's* advertised capabilities, not the *provider's* actual implementation. DeepInfra (the primary provider for Llama models) does not support `literal_required` or function-type `tool_choice` — it silently downgrades to `auto`, and the model then decides whether to call the tool (it usually doesn't).

This means **you cannot rely on OpenRouter's `supported_parameters` to predict whether forced tool_choice will work**. The only reliable test is empirical.

## Risk tiers for new models

When adding a new model to the benchmark, expect:

| Tier | Models | Expected behavior |
|------|--------|------------------|
| **A: Native tool support** | OpenAI GPT, Anthropic Claude, Google Gemini | 0% error rate, forced tool_choice works |
| **B: Inference-provider models with good tool support** | DeepSeek-V3, Qwen3 | 0% error rate, tool calls work via OpenRouter |
| **C: Reasoning models** | DeepSeek-R1, QwQ | 0% after `<think>` stripping; may need prose recovery |
| **D: Open-weight models on 3rd-party inference** | Llama 3.x, Nemotron, GLM | High error rate (50-90%); provider may not enforce tool_choice |
| **E: Models without tool support** | MiniMax-01, some fine-tunes | 100% error; API rejects `tools` parameter |

## What to do about failing models

1. **Don't block them** — the Loanville benchmark tracks `deals_errored` separately from `deals_rejected`, and validation flags models with >25% error rate
2. **Don't fall back to rules** — `allowRulesFallback` defaults to `false` so LLM failures propagate as `[LLM_ERROR]` rather than being silently replaced with deterministic rules
3. **Do test empirically** — run `run_top5_smoke.py` with 3 borrowers before committing to a full season
4. **Consider `tool_choice: "auto"`** — for Tier D models, switching from forced to auto tool_choice trades reliability for compatibility (the model may or may not call the tool)

## Possible improvements

- **Adaptive tool_choice**: Try forced first, if error rate > threshold fall back to `auto` for that model
- **Model capability cache**: Track empirical error rates per model and route accordingly
- **Prompt-based fallback**: For Tier D/E models, skip tools entirely and use in-prompt JSON instructions (the approach from commit 5a4c2b6)
