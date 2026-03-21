#!/usr/bin/env node
/**
 * Experiment Runner CLI
 *
 * Usage:
 *   pnpm run-experiment                    # Run default experiment
 *   pnpm run-experiment quick-test         # Run specific experiment
 *   pnpm run-experiment --list             # List available experiments
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { runExperiment } from './runners/index.js';
import type { ExperimentConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);

  // Check for config file
  const configPath = join(__dirname, '..', 'config.ts');
  const exampleConfigPath = join(__dirname, '..', 'config.example.ts');

  if (!existsSync(configPath)) {
    console.log(`
⚠️  Configuration file not found!

To get started:

1. Copy the example config:
   cp ${exampleConfigPath} ${configPath}

2. Edit config.ts and add your API keys

3. Run the experiment:
   pnpm run-experiment

Available experiment presets in config:
- QUICK_TEST: Fast validation with small models
- SMALL_MODEL_COMPARISON: Compare cheap models across all scenarios
- FULL_BENCHMARK: Comprehensive test of all models
- VAGUENESS_STRESS_TEST: Focus on instruction vagueness
- LOCAL_MODEL_TEST: Test with Ollama/local models
`);
    process.exit(1);
  }

  // Import config
  let config: typeof import('../config.example.js');
  try {
    config = await import(pathToFileURL(configPath).href);
  } catch (error) {
    console.error('Error loading config:', error);
    process.exit(1);
  }

  // Handle --list flag
  if (args.includes('--list')) {
    console.log(`
Available experiments:

  quick-test              Quick validation with small models
  small-model-comparison  Compare cheap models across all scenarios
  full-benchmark          Comprehensive test of all models
  vagueness-stress        Focus on instruction vagueness
  local-test              Test with Ollama/local models

Usage:
  pnpm run-experiment [experiment-name]
`);
    process.exit(0);
  }

  // Select experiment
  let experimentConfig: ExperimentConfig;

  if (args.length > 0 && !args[0].startsWith('-')) {
    const experimentName = args[0];
    const experiments: Record<string, ExperimentConfig> = {
      'quick-test': config.QUICK_TEST,
      'small-model-comparison': config.SMALL_MODEL_COMPARISON,
      'full-benchmark': config.FULL_BENCHMARK,
      'vagueness-stress': config.VAGUENESS_STRESS_TEST,
      'local-test': config.LOCAL_MODEL_TEST,
    };

    if (!(experimentName in experiments)) {
      console.error(`Unknown experiment: ${experimentName}`);
      console.error('Use --list to see available experiments');
      process.exit(1);
    }

    experimentConfig = experiments[experimentName];
  } else {
    experimentConfig = config.default;
  }

  // Validate API keys
  const missingKeys: string[] = [];
  for (const model of experimentConfig.models) {
    if (
      model.apiKey.includes('YOUR_') ||
      (model.provider !== 'local' && !model.apiKey)
    ) {
      missingKeys.push(`${model.provider}:${model.model}`);
    }
  }

  if (missingKeys.length > 0) {
    console.error(`
⚠️  Missing API keys for models:
${missingKeys.map(k => `   - ${k}`).join('\n')}

Please edit config.ts and add your API keys, or set environment variables:
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- GOOGLE_API_KEY
- MISTRAL_API_KEY
`);
    process.exit(1);
  }

  // Run experiment
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           Open LOS CLI Testing Harness                         ║
║           Testing Model Understanding of Data Models           ║
╚════════════════════════════════════════════════════════════════╝
`);

  try {
    const result = await runExperiment(experimentConfig);

    if (result.status === 'completed' && result.summary) {
      // Calculate overall success rate
      const overallSuccess = result.results.filter(r => r.success).length / result.results.length;

      console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    EXPERIMENT COMPLETE                          ║
╠════════════════════════════════════════════════════════════════╣
║  Overall Success Rate: ${(overallSuccess * 100).toFixed(1).padStart(6)}%                              ║
║  Results saved to: ${experimentConfig.outputDir.padEnd(40)}║
╚════════════════════════════════════════════════════════════════╝
`);

      // Exit with appropriate code
      process.exit(overallSuccess >= 0.5 ? 0 : 1);
    } else {
      console.error('Experiment failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error running experiment:', error);
    process.exit(1);
  }
}

main().catch(console.error);
