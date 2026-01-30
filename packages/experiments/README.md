# Open LOS CLI Testing Harness

An experimental framework for testing how well different LLM models understand and operate the Open LOS API with varying levels of instruction clarity.

## Purpose

This harness validates:
1. **Data model comprehension** - Can models correctly use deals, entities, covenants, etc.?
2. **API structure understanding** - Do models generate correct HTTP calls with headers?
3. **Conceptual clarity** - How well does the system's design hold up with vague instructions?
4. **Touchpoint validation** - Which parts of the API are most error-prone?

## Quick Start

```bash
# 1. Install dependencies
cd packages/experiments
pnpm install

# 2. Copy and configure
cp config.example.ts config.ts

# 3. Add your API keys to config.ts (or set environment variables)
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...

# 4. Run a quick test
pnpm run-experiment quick-test

# 5. Analyze results
pnpm analyze ./results/quick-test/run-*.json
```

## Configuration

Edit `config.ts` to configure:

### Model Providers

```typescript
// Anthropic Claude
{
  provider: 'anthropic',
  model: 'claude-3-haiku-20240307',
  apiKey: process.env.ANTHROPIC_API_KEY,
}

// OpenAI GPT
{
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
}

// Google Gemini
{
  provider: 'google',
  model: 'gemini-1.5-flash',
  apiKey: process.env.GOOGLE_API_KEY,
}

// Mistral
{
  provider: 'mistral',
  model: 'mistral-small-latest',
  apiKey: process.env.MISTRAL_API_KEY,
}

// Local (Ollama)
{
  provider: 'local',
  model: 'llama3.2',
  baseUrl: 'http://localhost:11434',
  apiKey: 'not-needed',
}
```

### Experiment Presets

| Preset | Description |
|--------|-------------|
| `QUICK_TEST` | Fast validation with 2 small models, 2 scenarios |
| `SMALL_MODEL_COMPARISON` | Compare 4 cheap models across all scenarios |
| `FULL_BENCHMARK` | All models, all scenarios, 3 iterations |
| `VAGUENESS_STRESS_TEST` | Focus on instruction degradation |
| `LOCAL_MODEL_TEST` | Test Ollama/local models |

## Vagueness Levels

Instructions are provided at 5 levels of clarity:

| Level | Description | Example |
|-------|-------------|---------|
| `explicit` | Full JSON examples with exact field names | "POST /v1/deals with {borrower_name: '...'}" |
| `guided` | Natural language with hints | "Create a deal, remember borrower_name is required" |
| `conversational` | Natural request like a user | "Set up a new lending opportunity for Acme Ltd" |
| `vague` | Minimal information | "Add Acme to the system" |
| `adversarial` | Misleading terminology | "Create a customer record for the loan application" |

## Test Scenarios

### Core Scenarios

| Scenario | What it Tests |
|----------|---------------|
| `deal-create-basic` | Deal creation, required fields, headers |
| `stage-transition` | Stage workflow, transition validation |
| `entity-ownership` | Entity creation, relationships |
| `spread-ratios` | Financial data, minor units, ratios |
| `covenant-workflow` | Covenant creation, operator validation, testing |
| `document-upload` | Document attachment, types |
| `full-origination-flow` | Multi-step workflow sequencing |

### Touchpoints Validated

- `X-Actor` header extraction
- `X-Tenant-Id` header extraction
- Required field validation (`borrower_name`, `period`, etc.)
- Enum validation (`stage`, `operator`, `type`)
- Amount handling (minor units)
- API call sequencing

## Results Analysis

```bash
# Text report
pnpm analyze ./results/run-xxx.json

# Markdown report
pnpm analyze ./results/run-xxx.json --format markdown --output report.md

# Show failures
pnpm analyze ./results/run-xxx.json --failures

# Compare runs
pnpm analyze ./results/run-1.json --compare ./results/run-2.json
```

### Understanding Results

The harness reports:

1. **Overall Success Rate** - Did the model generate correct API calls?
2. **By Model** - Which models perform best?
3. **By Vagueness** - How does performance degrade with vague instructions?
4. **By Scenario** - Which workflows are hardest?
5. **Touchpoint Failures** - Which specific validations fail most?

## Design Insights

Good results indicate:
- Data model terminology is clear and unambiguous
- API structure is intuitive
- Required vs optional fields are well-defined

Poor results at specific vagueness levels indicate:
- **Explicit passes, others fail**: Documentation is good but concepts aren't intuitive
- **All levels fail**: Fundamental design issues
- **Conversational/vague fails**: Terminology doesn't match natural language

## Extending the Harness

### Adding Scenarios

Edit `src/scenarios/definitions.ts`:

```typescript
{
  id: 'my-scenario',
  name: 'My Test Scenario',
  category: 'deal_lifecycle',
  instructions: [
    { level: 'explicit', instruction: '...' },
    { level: 'vague', instruction: '...' },
  ],
  expectedCalls: [
    { method: 'POST', pathPattern: '^/v1/deals$', critical: true }
  ],
  validations: [
    { id: 'check-field', type: 'field_present', target: 'body.field' }
  ]
}
```

### Adding Providers

Create a new provider in `src/providers/`:

```typescript
export class MyProvider extends BaseProvider {
  async chat(messages: ChatMessage[]): Promise<ProviderResponse> {
    // Implement your provider
  }
}
```

## Environment Variables

| Variable | Provider |
|----------|----------|
| `ANTHROPIC_API_KEY` | Anthropic Claude |
| `OPENAI_API_KEY` | OpenAI GPT |
| `GOOGLE_API_KEY` | Google Gemini |
| `MISTRAL_API_KEY` | Mistral AI |

## Output Structure

```
results/
├── quick-test/
│   ├── run-abc123.json          # Full experiment results
│   └── results/
│       ├── deal-create-basic-claude-3-haiku-explicit-0.json
│       ├── deal-create-basic-claude-3-haiku-vague-0.json
│       └── ...
```
