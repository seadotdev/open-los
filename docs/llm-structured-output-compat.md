# LLM Structured Output Compatibility

Which models work with the Open LOS underwriting flow, which don't, and why.

## How structured output works

`openrouter.ts` uses a two-phase strategy for structured output:

1. **Tool call** (primary): Sends `tool_choice: { type: "function", function: { name: "structured_output" } }` forcing the model to call a tool with the response schema
2. **Prose recovery** (fallback): If no tool call returned, `structured-parse.ts` strips `<think>` blocks and extracts JSON objects from the assistant's text content
3. **Retry**: Up to 2 attempts, each trying tool call then prose recovery
4. **Schema validation**: Every candidate (tool call or extracted JSON) is validated against the schema before acceptance
5. **Reasoning model handling**: GPT-5 family and o-series models use `max_completion_tokens` (not `max_tokens`) with `reasoning_effort: "low"` to prevent reasoning tokens from exhausting the budget

## Tested models

### Season run (2026-02-26, 5 weeks, 25 evals each)

| Model | Error rate | Failure mode | Notes |
|-------|-----------|--------------|-------|
| `openai/gpt-4.1-nano` | **0%** | - | Fast, reliable tool calls |
| `deepseek/deepseek-chat-v3-0324` | **0%** | - | Reliable tool calls |
| `qwen/qwen3-next-80b-a3b-instruct` | **0%** | - | Reliable tool calls |
| `deepseek/deepseek-r1` | **0%** | - | Uses `<think>` blocks; works via prose recovery after think-stripping |
| `meta-llama/llama-3.3-70b-instruct` | **88%** | Prose only, no JSON | Ignores `tool_choice`, returns unstructured reasoning |

### Compatibility smoke test (2026-02-26, 3 evals each)

**Working (structured output OK):**

| Model | Result | Notes |
|-------|--------|-------|
| `meta-llama/llama-4-maverick` | 2A/1R/0E | Llama 4 fixes tool calling |
| `nvidia/llama-3.3-nemotron-super-49b-v1.5` | 2A/1R/0E | Nemotron v1.5 now works (previously failed) |
| `nvidia/nemotron-nano-9b-v2` | 2A/1R/0E | New Nemotron works |
| `google/gemini-2.5-flash` | 1A/2R/0E | Native API, as expected |
| `mistralai/mistral-small-3.2-24b-instruct` | 2A/1R/0E | Native API, as expected |
| `minimax/minimax-m2.5` | 2A/1R/0E | Fixed from MiniMax-01 (which rejected `tools` entirely) |
| `moonshotai/kimi-k2` | 1A/2R/0E | Caught fraud — quality underwriting |
| `xiaomi/mimo-v2-flash` | 1A/2R/0E | Caught fraud with suspicious-pattern reasoning |

**Broken (LLM errors or infrastructure failure):**

| Model | Result | Failure mode | Root cause |
|-------|--------|-------------|-----------|
| `openai/gpt-5-nano` | 0A/0R/3E | Empty response | Reasoning tokens exhaust `max_tokens` budget before producing tool call. Fixed: use `max_completion_tokens` + `reasoning_effort: "low"` |
| `qwen/qwq-32b` | NO_OUTPUT | 60s timeout | Reasoning model takes too long in full LOS pipeline. Fixed: 180s timeout for LLM paths |
| `deepseek/deepseek-r1-0528` | NO_OUTPUT | 60s timeout | Same as QwQ — reasoning overhead exceeds 60s. Fixed: 180s timeout |
| `x-ai/grok-3-mini` | 0A/0R/3E | 404 | OpenRouter privacy/guardrail settings block this model — account config issue, not model issue |
| `z-ai/glm-4.7-flash` | 2A/0R/1E | Intermittent | 1/3 tool call failures — unreliable but not fully broken |
| `bytedance-seed/seed-1.6-flash` | 1A/0R/2E | Intermittent | 2/3 failures — mostly broken |

**Edge cases (structured output works, but poor underwriting quality):**

| Model | Result | Issue |
|-------|--------|-------|
| `meta-llama/llama-4-scout` | 3A/0R/0E | Approved everything including fraud |
| `meta-llama/llama-3.1-8b-instruct` | 3A/0R/0E | Tool calling works (unlike 3.3-70B!), but approves everything |
| `google/gemma-3-27b-it` | 3A/0R/0E | No discrimination — approved fraud |
| `baidu/ernie-4.5-21b-a3b` | 3A/0R/0E | Same rate (13.5%) for all three borrowers — no analysis depth |

### Previously identified failures (from commit 5a4c2b6)

| Model | Failure mode |
|-------|-------------|
| `nvidia/nemotron-49b-v1.5` | Ignores forced `tool_choice` (v1.5 now fixed, see above) |
| `zhipu/glm-4-32b` | Breaks with forced `tool_choice` |
| `minimax/minimax-01` | Rejects `tools` parameter entirely (M2.5 now fixed, see above) |

## The pattern

**Works reliably:**
- Models trained for function calling: OpenAI GPT-4.x series, DeepSeek-V3, Qwen3, Mistral, Gemini
- Reasoning models that output JSON after thinking: DeepSeek-R1 (via `<think>` stripping)
- Chinese vendors with native APIs: MiniMax M2+, Kimi-K2, MiMo, GLM-4.7 (intermittent)
- Llama 4 family (unlike Llama 3.x which was broken on DeepInfra)

**Fails:**
- OpenAI reasoning models (GPT-5, o-series) when using legacy `max_tokens` — reasoning tokens consume the budget. **Fix**: use `max_completion_tokens` + `reasoning_effort: "low"`
- Reasoning models (QwQ, R1-0528) with aggressive HTTP timeouts — they need 90-180s+. **Fix**: 180s timeout for any LLM evaluation path
- Open-weight models on providers with incomplete tool_choice (Llama 3.3-70B on DeepInfra)
- ByteDance Seed-1.6 and ZhiPu GLM-4.7 are intermittent (1-2/3 failures)

**Works but poor quality:**
- Small/cheap open-weight models (Llama-4-Scout, Llama-3.1-8B, Gemma-3-27B, ERNIE-4.5) return valid structured output but approve everything — they lack the analytical depth for underwriting

## Root causes

### 1. Provider-level tool_choice support

The OpenRouter API metadata reports Llama-3.3-70B supports `tool_choice` and even `structured_outputs`. But these flags describe the *model's* advertised capabilities, not the *provider's* actual implementation. DeepInfra (the primary provider for Llama models) does not support `literal_required` or function-type `tool_choice` — it silently downgrades to `auto`, and the model then decides whether to call the tool (it usually doesn't).

This means **you cannot rely on OpenRouter's `supported_parameters` to predict whether forced tool_choice will work**. The only reliable test is empirical.

### 2. Reasoning token budget exhaustion (GPT-5, o-series)

GPT-5 family models have mandatory internal reasoning. When the underwriting prompt is large (system + portfolio context + financials + bank statements + schema), the model spends hundreds of reasoning tokens thinking before producing output. With the legacy `max_tokens: 2048` parameter, reasoning tokens count against this budget, and the model exhausts it before generating a tool call — returning an empty response (no `tool_calls`, no `content`).

**Fix**: For reasoning models, `openrouter.ts` now sends `max_completion_tokens: 4096` (not `max_tokens`) with `reasoning_effort: "low"`.

### 3. HTTP timeout vs reasoning latency

Reasoning models (QwQ-32B, DeepSeek-R1-0528) perform explicit chain-of-thought that can take 90-180+ seconds per evaluation. The Loanville LOS adapter previously used a 60-second HTTP timeout for the full LOS pipeline, which was fine for non-reasoning models but insufficient for thinking models.

**Fix**: `los_adapter.py` now uses 180s timeout for any LLM evaluation path (not just `underwrite_only` mode).

## Risk tiers for new models

When adding a new model to the benchmark, expect:

| Tier | Models | Expected behavior |
|------|--------|------------------|
| **A: Native tool support** | OpenAI GPT-4.x, Anthropic Claude, Google Gemini, Mistral | 0% error rate, forced tool_choice works |
| **A2: Native reasoning** | OpenAI GPT-5/o-series, Grok | 0% with `max_completion_tokens` + `reasoning_effort: "low"`; 100% error without |
| **B: Inference-provider models with good tool support** | DeepSeek-V3, Qwen3, Kimi-K2, MiMo, MiniMax M2+ | 0% error rate, tool calls work via OpenRouter |
| **C: Reasoning models** | DeepSeek-R1, QwQ | 0% after `<think>` stripping; needs 180s+ timeout |
| **D: Open-weight models on 3rd-party inference** | Llama 3.3-70B on DeepInfra | High error rate (50-90%); provider may not enforce tool_choice |
| **D2: Open-weight with poor quality** | Llama-4-Scout, Llama-3.1-8B, Gemma-3-27B, ERNIE-4.5 | 0% error rate but approves everything — useless for underwriting |
| **E: Models without tool support** | MiniMax-01, some fine-tunes | 100% error; API rejects `tools` parameter |
| **F: Intermittent** | GLM-4.7-Flash, Seed-1.6-Flash | 30-70% error rate; tool calls work sometimes |

## What to do about failing models

1. **Don't block them** — the Loanville benchmark tracks `deals_errored` separately from `deals_rejected`, and validation flags models with >25% error rate
2. **Don't fall back to rules** — `allowRulesFallback` defaults to `false` so LLM failures propagate as `[LLM_ERROR]` rather than being silently replaced with deterministic rules
3. **Do test empirically** — run `run_compat_smoke.py` with 3 borrowers before committing to a full season
4. **Consider `tool_choice: "auto"`** — for Tier D models, switching from forced to auto tool_choice trades reliability for compatibility (the model may or may not call the tool)
5. **Check reasoning model support** — for Tier A2/C models, ensure `max_completion_tokens` and adequate timeouts are configured

## Possible improvements

- **Adaptive tool_choice**: Try forced first, if error rate > threshold fall back to `auto` for that model
- **Model capability cache**: Track empirical error rates per model and route accordingly
- **Prompt-based fallback**: For Tier D/E models, skip tools entirely and use in-prompt JSON instructions (the approach from commit 5a4c2b6)
- **Reasoning token inspection**: Read the `reasoning` / `reasoning_details` fields from GPT-5 responses and feed them into the prose recovery parser as a last resort
