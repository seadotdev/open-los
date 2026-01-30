/**
 * Experiment Configuration
 *
 * Copy this file to config.ts and fill in your API keys.
 *
 * Usage:
 *   cp config.example.ts config.ts
 *   # Edit config.ts with your API keys
 *   pnpm run-experiment
 */

import type { ExperimentConfig, ModelConfig, VaguenessLevel } from './src/types.js';

// ============================================================================
// MODEL CONFIGURATIONS
// ============================================================================

/**
 * Anthropic models - Claude family
 * Recommended for testing: claude-3-haiku-20240307 (fast, cheap)
 */
export const ANTHROPIC_MODELS: ModelConfig[] = [
  {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    apiKey: process.env.ANTHROPIC_API_KEY || 'YOUR_ANTHROPIC_API_KEY',
    maxTokens: 4096,
    temperature: 0,
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    apiKey: process.env.ANTHROPIC_API_KEY || 'YOUR_ANTHROPIC_API_KEY',
    maxTokens: 4096,
    temperature: 0,
  },
];

/**
 * OpenAI models - GPT family
 * Recommended for testing: gpt-4o-mini (fast, cheap)
 */
export const OPENAI_MODELS: ModelConfig[] = [
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
    maxTokens: 4096,
    temperature: 0,
  },
  {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
    maxTokens: 4096,
    temperature: 0,
  },
];

/**
 * Google models - Gemini family
 * Recommended for testing: gemini-1.5-flash (fast, cheap)
 */
export const GOOGLE_MODELS: ModelConfig[] = [
  {
    provider: 'google',
    model: 'gemini-1.5-flash',
    apiKey: process.env.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY',
    maxTokens: 4096,
    temperature: 0,
  },
  {
    provider: 'google',
    model: 'gemini-1.5-pro',
    apiKey: process.env.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY',
    maxTokens: 4096,
    temperature: 0,
  },
];

/**
 * Mistral models
 * Recommended for testing: mistral-small-latest (fast, cheap)
 */
export const MISTRAL_MODELS: ModelConfig[] = [
  {
    provider: 'mistral',
    model: 'mistral-small-latest',
    apiKey: process.env.MISTRAL_API_KEY || 'YOUR_MISTRAL_API_KEY',
    maxTokens: 4096,
    temperature: 0,
  },
  {
    provider: 'mistral',
    model: 'mistral-large-latest',
    apiKey: process.env.MISTRAL_API_KEY || 'YOUR_MISTRAL_API_KEY',
    maxTokens: 4096,
    temperature: 0,
  },
];

/**
 * Local models via Ollama or OpenAI-compatible API
 * No API key needed for local models
 */
export const LOCAL_MODELS: ModelConfig[] = [
  {
    provider: 'local',
    model: 'llama3.2',
    apiKey: 'not-needed',
    baseUrl: 'http://localhost:11434',
    maxTokens: 4096,
    temperature: 0,
  },
  {
    provider: 'local',
    model: 'qwen2.5:7b',
    apiKey: 'not-needed',
    baseUrl: 'http://localhost:11434',
    maxTokens: 4096,
    temperature: 0,
  },
];

// ============================================================================
// EXPERIMENT PRESETS
// ============================================================================

/**
 * Quick test with small models
 * Good for initial validation
 */
export const QUICK_TEST: ExperimentConfig = {
  id: 'quick-test',
  name: 'Quick Validation Test',
  description: 'Fast test with cheap models to validate harness',
  models: [
    ANTHROPIC_MODELS[0],  // claude-3-haiku
    OPENAI_MODELS[0],     // gpt-4o-mini
  ],
  scenarios: [
    'deal-create-basic',
    'stage-transition',
  ],
  vaguenessLevels: ['explicit', 'conversational', 'vague'],
  iterations: 1,
  saveResponses: true,
  outputDir: './results/quick-test',
};

/**
 * Small model comparison
 * Tests smaller/cheaper models across all scenarios
 */
export const SMALL_MODEL_COMPARISON: ExperimentConfig = {
  id: 'small-model-comparison',
  name: 'Small Model Comparison',
  description: 'Compare small/cheap models across all scenarios and vagueness levels',
  models: [
    ANTHROPIC_MODELS[0],  // claude-3-haiku
    OPENAI_MODELS[0],     // gpt-4o-mini
    GOOGLE_MODELS[0],     // gemini-1.5-flash
    MISTRAL_MODELS[0],    // mistral-small
  ],
  scenarios: [
    'deal-create-basic',
    'stage-transition',
    'entity-ownership',
    'spread-ratios',
    'covenant-workflow',
    'document-upload',
    'full-origination-flow',
  ],
  vaguenessLevels: ['explicit', 'guided', 'conversational', 'vague', 'adversarial'],
  iterations: 3,
  saveResponses: true,
  outputDir: './results/small-models',
};

/**
 * Full benchmark
 * Tests all models across all scenarios
 */
export const FULL_BENCHMARK: ExperimentConfig = {
  id: 'full-benchmark',
  name: 'Full Model Benchmark',
  description: 'Comprehensive test of all models across all scenarios',
  models: [
    ...ANTHROPIC_MODELS,
    ...OPENAI_MODELS,
    ...GOOGLE_MODELS,
    ...MISTRAL_MODELS,
  ],
  scenarios: [
    'deal-create-basic',
    'stage-transition',
    'entity-ownership',
    'spread-ratios',
    'covenant-workflow',
    'document-upload',
    'full-origination-flow',
  ],
  vaguenessLevels: ['explicit', 'guided', 'conversational', 'vague', 'adversarial'],
  iterations: 3,
  saveResponses: true,
  outputDir: './results/full-benchmark',
};

/**
 * Vagueness stress test
 * Focus on how models handle increasingly vague instructions
 */
export const VAGUENESS_STRESS_TEST: ExperimentConfig = {
  id: 'vagueness-stress',
  name: 'Vagueness Stress Test',
  description: 'Test how models degrade with increasingly vague instructions',
  models: [
    ANTHROPIC_MODELS[0],  // claude-3-haiku
    OPENAI_MODELS[0],     // gpt-4o-mini
  ],
  scenarios: [
    'deal-create-basic',
    'stage-transition',
    'covenant-workflow',
  ],
  vaguenessLevels: ['explicit', 'guided', 'conversational', 'vague', 'adversarial'],
  iterations: 5,  // More iterations to see variance
  saveResponses: true,
  outputDir: './results/vagueness-stress',
};

/**
 * Local model test
 * For testing with Ollama or other local providers
 */
export const LOCAL_MODEL_TEST: ExperimentConfig = {
  id: 'local-test',
  name: 'Local Model Test',
  description: 'Test local models via Ollama',
  models: LOCAL_MODELS,
  scenarios: [
    'deal-create-basic',
    'stage-transition',
  ],
  vaguenessLevels: ['explicit', 'conversational'],
  iterations: 2,
  saveResponses: true,
  outputDir: './results/local-models',
};

// ============================================================================
// DEFAULT EXPORT - Edit this to change which experiment runs
// ============================================================================

export default QUICK_TEST;
