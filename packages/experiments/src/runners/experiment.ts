/**
 * Experiment Runner
 *
 * Orchestrates running experiments across models, scenarios, and vagueness levels.
 */

import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import type {
  ExperimentConfig,
  ExperimentRun,
  ScenarioResult,
  ExperimentSummary,
  ModelSummary,
  VaguenessSummary,
  VaguenessLevel,
  ModelConfig,
  TouchpointFailure,
} from '../types.js';
import { createProvider, type ChatMessage } from '../providers/index.js';
import {
  SCENARIOS,
  getScenario,
  getInstruction,
  SYSTEM_CONTEXT_FULL,
  SYSTEM_CONTEXT_MINIMAL,
  SYSTEM_CONTEXT_REFERENCE,
  extractApiCalls,
  matchCalls,
} from '../scenarios/index.js';
import { validateScenarioResult, analyzeTouchpoints } from '../validators/index.js';

/**
 * Run a complete experiment
 */
export async function runExperiment(config: ExperimentConfig): Promise<ExperimentRun> {
  const run: ExperimentRun = {
    experimentId: config.id,
    runId: randomUUID(),
    startedAt: new Date().toISOString(),
    status: 'running',
    results: [],
  };

  console.log(`\n🧪 Starting experiment: ${config.name}`);
  console.log(`   Run ID: ${run.runId}`);
  console.log(`   Models: ${config.models.map(m => m.model).join(', ')}`);
  console.log(`   Scenarios: ${config.scenarios.length}`);
  console.log(`   Vagueness levels: ${config.vaguenessLevels.join(', ')}`);
  console.log(`   Iterations per combination: ${config.iterations}\n`);

  // Ensure output directory exists
  if (!existsSync(config.outputDir)) {
    mkdirSync(config.outputDir, { recursive: true });
  }

  try {
    // Run each model
    for (const modelConfig of config.models) {
      console.log(`\n📊 Testing model: ${modelConfig.model}`);

      const provider = await createProvider(modelConfig);

      // Run each scenario
      for (const scenarioId of config.scenarios) {
        const scenario = getScenario(scenarioId);
        if (!scenario) {
          console.log(`   ⚠️  Scenario not found: ${scenarioId}`);
          continue;
        }

        // Run each vagueness level
        for (const level of config.vaguenessLevels) {
          const instructionVariant = getInstruction(scenario, level);
          if (!instructionVariant) {
            console.log(`   ⚠️  No ${level} instruction for: ${scenario.name}`);
            continue;
          }

          // Run iterations
          for (let iter = 0; iter < config.iterations; iter++) {
            console.log(
              `   Running: ${scenario.name} @ ${level} (${iter + 1}/${config.iterations})`
            );

            const result = await runSingleScenario(
              provider,
              modelConfig,
              scenario,
              instructionVariant.instruction,
              level,
              iter
            );

            run.results.push(result);

            // Save individual result if configured
            if (config.saveResponses) {
              saveResult(config.outputDir, result);
            }

            // Brief delay to avoid rate limits
            await sleep(500);
          }
        }
      }
    }

    // Generate summary
    run.summary = generateSummary(run.results, config);
    run.completedAt = new Date().toISOString();
    run.status = 'completed';

    // Save full run
    const runPath = join(config.outputDir, `run-${run.runId}.json`);
    writeFileSync(runPath, JSON.stringify(run, null, 2));
    console.log(`\n✅ Experiment complete. Results saved to: ${runPath}`);

    // Print summary
    printSummary(run.summary);

  } catch (error) {
    run.status = 'failed';
    run.completedAt = new Date().toISOString();
    console.error('Experiment failed:', error);
  }

  return run;
}

/**
 * Run a single scenario with a specific model and vagueness level
 */
async function runSingleScenario(
  provider: Awaited<ReturnType<typeof createProvider>>,
  modelConfig: ModelConfig,
  scenario: ReturnType<typeof getScenario>,
  instruction: string,
  level: VaguenessLevel,
  iteration: number
): Promise<ScenarioResult> {
  if (!scenario) {
    throw new Error('Scenario is undefined');
  }

  // Select system context based on vagueness level
  let systemContext: string;
  switch (level) {
    case 'explicit':
    case 'guided':
      systemContext = SYSTEM_CONTEXT_FULL;
      break;
    case 'conversational':
      systemContext = SYSTEM_CONTEXT_MINIMAL;
      break;
    case 'vague':
    case 'adversarial':
      systemContext = SYSTEM_CONTEXT_REFERENCE;
      break;
    default:
      systemContext = SYSTEM_CONTEXT_FULL;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContext },
    { role: 'user', content: instruction },
  ];

  let modelResponse = '';
  let latencyMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await provider.chat(messages);
    modelResponse = response.content;
    latencyMs = response.latencyMs;
    inputTokens = response.usage.inputTokens;
    outputTokens = response.usage.outputTokens;
  } catch (error) {
    modelResponse = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
  }

  // Extract API calls from response
  const extractedCalls = extractApiCalls(modelResponse);

  // Match against expected calls
  const { matched, unmatched, missing } = matchCalls(
    extractedCalls,
    scenario.expectedCalls
  );

  // Run validations
  const validations = validateScenarioResult(scenario, extractedCalls);

  // Determine success
  const criticalMissing = missing.filter(m => m.critical);
  const allValidationsPassed = validations.every(v => v.passed);
  const success = criticalMissing.length === 0 && allValidationsPassed;

  let failureReason: string | undefined;
  if (!success) {
    const reasons: string[] = [];
    if (criticalMissing.length > 0) {
      reasons.push(`Missing critical calls: ${criticalMissing.map(m => m.pathPattern).join(', ')}`);
    }
    const failedValidations = validations.filter(v => !v.passed);
    if (failedValidations.length > 0) {
      reasons.push(`Failed validations: ${failedValidations.map(v => v.ruleId).join(', ')}`);
    }
    failureReason = reasons.join('; ');
  }

  return {
    scenarioId: scenario.id,
    model: modelConfig.model,
    vaguenessLevel: level,
    iteration,
    instruction,
    modelResponse,
    extractedCalls,
    validations,
    success,
    failureReason,
    metrics: {
      latencyMs,
      inputTokens,
      outputTokens,
      apiCallsGenerated: extractedCalls.length,
      validationsPassed: validations.filter(v => v.passed).length,
      validationsFailed: validations.filter(v => !v.passed).length,
    },
  };
}

/**
 * Generate experiment summary
 */
function generateSummary(
  results: ScenarioResult[],
  config: ExperimentConfig
): ExperimentSummary {
  // By model
  const byModel: Record<string, ModelSummary> = {};
  for (const modelConfig of config.models) {
    const modelResults = results.filter(r => r.model === modelConfig.model);
    const successful = modelResults.filter(r => r.success);

    const byVagueness: Record<VaguenessLevel, number> = {
      explicit: 0,
      guided: 0,
      conversational: 0,
      vague: 0,
      adversarial: 0,
    };

    for (const level of config.vaguenessLevels) {
      const levelResults = modelResults.filter(r => r.vaguenessLevel === level);
      byVagueness[level] = levelResults.filter(r => r.success).length / Math.max(levelResults.length, 1);
    }

    byModel[modelConfig.model] = {
      model: modelConfig.model,
      provider: modelConfig.provider,
      totalRuns: modelResults.length,
      successfulRuns: successful.length,
      successRate: successful.length / Math.max(modelResults.length, 1),
      avgLatencyMs: modelResults.reduce((sum, r) => sum + r.metrics.latencyMs, 0) / Math.max(modelResults.length, 1),
      avgTokens: modelResults.reduce((sum, r) => sum + r.metrics.inputTokens + r.metrics.outputTokens, 0) / Math.max(modelResults.length, 1),
      byVagueness,
    };
  }

  // By vagueness level
  const byVagueness: Record<VaguenessLevel, VaguenessSummary> = {} as Record<VaguenessLevel, VaguenessSummary>;
  for (const level of config.vaguenessLevels) {
    const levelResults = results.filter(r => r.vaguenessLevel === level);
    const successful = levelResults.filter(r => r.success);

    // Find common failures
    const failureReasons = levelResults
      .filter(r => !r.success && r.failureReason)
      .map(r => r.failureReason as string);

    const reasonCounts = new Map<string, number>();
    for (const reason of failureReasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }

    const commonFailures = Array.from(reasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason]) => reason);

    byVagueness[level] = {
      level,
      totalRuns: levelResults.length,
      successfulRuns: successful.length,
      successRate: successful.length / Math.max(levelResults.length, 1),
      commonFailures,
    };
  }

  // By category
  const byCategory: Record<string, number> = {};
  const categories = new Set(SCENARIOS.map(s => s.category));
  for (const category of categories) {
    const catScenarios = SCENARIOS.filter(s => s.category === category).map(s => s.id);
    const catResults = results.filter(r => catScenarios.includes(r.scenarioId));
    byCategory[category] = catResults.filter(r => r.success).length / Math.max(catResults.length, 1);
  }

  // Touchpoint failures
  const touchpointAnalysis = analyzeTouchpoints(results);
  const touchpointFailures: TouchpointFailure[] = Array.from(touchpointAnalysis.entries())
    .map(([touchpoint, data]) => ({
      touchpoint,
      failureCount: data.failures,
      failureRate: data.failures / results.length,
      affectedScenarios: data.scenarios,
      commonErrors: [], // Could be enhanced
    }))
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, 10);

  return {
    totalScenarios: config.scenarios.length,
    totalRuns: results.length,
    byModel,
    byVagueness,
    byCategory,
    touchpointFailures,
  };
}

/**
 * Save individual result to file
 */
function saveResult(outputDir: string, result: ScenarioResult): void {
  const filename = `${result.scenarioId}-${result.model}-${result.vaguenessLevel}-${result.iteration}.json`;
  const filepath = join(outputDir, 'results', filename);

  if (!existsSync(join(outputDir, 'results'))) {
    mkdirSync(join(outputDir, 'results'), { recursive: true });
  }

  writeFileSync(filepath, JSON.stringify(result, null, 2));
}

/**
 * Print summary to console
 */
function printSummary(summary: ExperimentSummary): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT SUMMARY');
  console.log('='.repeat(60));

  console.log(`\nTotal runs: ${summary.totalRuns}`);
  console.log(`Total scenarios: ${summary.totalScenarios}`);

  console.log('\n📊 Results by Model:');
  console.log('-'.repeat(50));
  for (const [model, data] of Object.entries(summary.byModel)) {
    const pct = (data.successRate * 100).toFixed(1);
    console.log(`  ${model}: ${data.successfulRuns}/${data.totalRuns} (${pct}%)`);
    console.log(`    Avg latency: ${data.avgLatencyMs.toFixed(0)}ms`);
    console.log(`    Avg tokens: ${data.avgTokens.toFixed(0)}`);
  }

  console.log('\n📈 Results by Vagueness Level:');
  console.log('-'.repeat(50));
  for (const [level, data] of Object.entries(summary.byVagueness)) {
    const pct = (data.successRate * 100).toFixed(1);
    console.log(`  ${level}: ${data.successfulRuns}/${data.totalRuns} (${pct}%)`);
    if (data.commonFailures.length > 0) {
      console.log(`    Common failures: ${data.commonFailures[0].substring(0, 50)}...`);
    }
  }

  console.log('\n📁 Results by Category:');
  console.log('-'.repeat(50));
  for (const [category, rate] of Object.entries(summary.byCategory)) {
    const pct = (rate * 100).toFixed(1);
    console.log(`  ${category}: ${pct}%`);
  }

  if (summary.touchpointFailures.length > 0) {
    console.log('\n⚠️  Top Touchpoint Failures:');
    console.log('-'.repeat(50));
    for (const tp of summary.touchpointFailures.slice(0, 5)) {
      console.log(`  ${tp.touchpoint}: ${tp.failureCount} failures (${(tp.failureRate * 100).toFixed(1)}%)`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Helper: Sleep for ms
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
