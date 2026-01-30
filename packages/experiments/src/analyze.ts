#!/usr/bin/env node
/**
 * Result Analyzer CLI
 *
 * Analyzes experiment results and generates reports.
 *
 * Usage:
 *   pnpm analyze ./results/quick-test/run-xxx.json
 *   pnpm analyze ./results/quick-test/run-xxx.json --format markdown
 *   pnpm analyze ./results/quick-test/run-xxx.json --compare ./results/other-run.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';

import type {
  ExperimentRun,
  ExperimentSummary,
  ScenarioResult,
  VaguenessLevel,
} from './types.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Experiment Result Analyzer

Usage:
  pnpm analyze <result-file.json> [options]

Options:
  --format <text|markdown|json>  Output format (default: text)
  --compare <other-file.json>    Compare with another run
  --output <file>                Save analysis to file
  --failures                     Show detailed failure analysis
  --by-scenario                  Break down by scenario
  --by-model                     Break down by model (default)
  --by-vagueness                 Break down by vagueness level

Examples:
  pnpm analyze ./results/quick-test/run-abc123.json
  pnpm analyze ./results/run-abc.json --format markdown --output report.md
  pnpm analyze ./results/run-1.json --compare ./results/run-2.json
`);
    process.exit(0);
  }

  const resultFile = args[0];
  if (!existsSync(resultFile)) {
    console.error(`File not found: ${resultFile}`);
    process.exit(1);
  }

  // Parse options
  const format = getArg(args, '--format') || 'text';
  const compareFile = getArg(args, '--compare');
  const outputFile = getArg(args, '--output');
  const showFailures = args.includes('--failures');
  const byScenario = args.includes('--by-scenario');
  const byVagueness = args.includes('--by-vagueness');

  // Load result
  const run: ExperimentRun = JSON.parse(readFileSync(resultFile, 'utf-8'));

  // Generate analysis
  let output: string;

  if (format === 'markdown') {
    output = generateMarkdownReport(run, { showFailures, byScenario, byVagueness });
  } else if (format === 'json') {
    output = JSON.stringify(analyzeRun(run), null, 2);
  } else {
    output = generateTextReport(run, { showFailures, byScenario, byVagueness });
  }

  // Compare if requested
  if (compareFile && existsSync(compareFile)) {
    const compareRun: ExperimentRun = JSON.parse(readFileSync(compareFile, 'utf-8'));
    output += '\n\n' + generateComparison(run, compareRun, format);
  }

  // Output
  if (outputFile) {
    writeFileSync(outputFile, output);
    console.log(`Analysis saved to: ${outputFile}`);
  } else {
    console.log(output);
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

interface AnalysisOptions {
  showFailures?: boolean;
  byScenario?: boolean;
  byVagueness?: boolean;
}

function analyzeRun(run: ExperimentRun) {
  const results = run.results;
  const total = results.length;
  const successful = results.filter(r => r.success).length;

  // Analyze by model
  const modelStats = new Map<string, { total: number; success: number; avgLatency: number }>();
  for (const r of results) {
    const stats = modelStats.get(r.model) || { total: 0, success: 0, avgLatency: 0 };
    stats.total++;
    if (r.success) stats.success++;
    stats.avgLatency = (stats.avgLatency * (stats.total - 1) + r.metrics.latencyMs) / stats.total;
    modelStats.set(r.model, stats);
  }

  // Analyze by vagueness
  const vaguenessStats = new Map<string, { total: number; success: number }>();
  for (const r of results) {
    const stats = vaguenessStats.get(r.vaguenessLevel) || { total: 0, success: 0 };
    stats.total++;
    if (r.success) stats.success++;
    vaguenessStats.set(r.vaguenessLevel, stats);
  }

  // Analyze by scenario
  const scenarioStats = new Map<string, { total: number; success: number }>();
  for (const r of results) {
    const stats = scenarioStats.get(r.scenarioId) || { total: 0, success: 0 };
    stats.total++;
    if (r.success) stats.success++;
    scenarioStats.set(r.scenarioId, stats);
  }

  // Collect failures
  const failures = results
    .filter(r => !r.success)
    .map(r => ({
      scenario: r.scenarioId,
      model: r.model,
      vagueness: r.vaguenessLevel,
      reason: r.failureReason,
    }));

  return {
    experimentId: run.experimentId,
    runId: run.runId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    totalRuns: total,
    successfulRuns: successful,
    successRate: successful / total,
    byModel: Object.fromEntries(
      Array.from(modelStats.entries()).map(([model, stats]) => [
        model,
        {
          total: stats.total,
          success: stats.success,
          successRate: stats.success / stats.total,
          avgLatencyMs: Math.round(stats.avgLatency),
        },
      ])
    ),
    byVagueness: Object.fromEntries(
      Array.from(vaguenessStats.entries()).map(([level, stats]) => [
        level,
        {
          total: stats.total,
          success: stats.success,
          successRate: stats.success / stats.total,
        },
      ])
    ),
    byScenario: Object.fromEntries(
      Array.from(scenarioStats.entries()).map(([scenario, stats]) => [
        scenario,
        {
          total: stats.total,
          success: stats.success,
          successRate: stats.success / stats.total,
        },
      ])
    ),
    failures,
  };
}

function generateTextReport(run: ExperimentRun, options: AnalysisOptions): string {
  const analysis = analyzeRun(run);
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push(`EXPERIMENT ANALYSIS: ${run.experimentId}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Run ID: ${run.runId}`);
  lines.push(`Started: ${run.startedAt}`);
  lines.push(`Completed: ${run.completedAt}`);
  lines.push('');
  lines.push(`Total Runs: ${analysis.totalRuns}`);
  lines.push(`Successful: ${analysis.successfulRuns}`);
  lines.push(`Success Rate: ${(analysis.successRate * 100).toFixed(1)}%`);
  lines.push('');

  lines.push('-'.repeat(40));
  lines.push('BY MODEL');
  lines.push('-'.repeat(40));
  for (const [model, stats] of Object.entries(analysis.byModel)) {
    const s = stats as { total: number; success: number; successRate: number; avgLatencyMs: number };
    lines.push(`  ${model}`);
    lines.push(`    Success: ${s.success}/${s.total} (${(s.successRate * 100).toFixed(1)}%)`);
    lines.push(`    Avg Latency: ${s.avgLatencyMs}ms`);
  }
  lines.push('');

  if (options.byVagueness) {
    lines.push('-'.repeat(40));
    lines.push('BY VAGUENESS LEVEL');
    lines.push('-'.repeat(40));
    const order: VaguenessLevel[] = ['explicit', 'guided', 'conversational', 'vague', 'adversarial'];
    for (const level of order) {
      const stats = analysis.byVagueness[level];
      if (stats) {
        const s = stats as { total: number; success: number; successRate: number };
        lines.push(`  ${level.padEnd(15)} ${s.success}/${s.total} (${(s.successRate * 100).toFixed(1)}%)`);
      }
    }
    lines.push('');
  }

  if (options.byScenario) {
    lines.push('-'.repeat(40));
    lines.push('BY SCENARIO');
    lines.push('-'.repeat(40));
    for (const [scenario, stats] of Object.entries(analysis.byScenario)) {
      const s = stats as { total: number; success: number; successRate: number };
      lines.push(`  ${scenario.padEnd(25)} ${s.success}/${s.total} (${(s.successRate * 100).toFixed(1)}%)`);
    }
    lines.push('');
  }

  if (options.showFailures && analysis.failures.length > 0) {
    lines.push('-'.repeat(40));
    lines.push('FAILURES');
    lines.push('-'.repeat(40));
    for (const f of analysis.failures.slice(0, 20)) {
      lines.push(`  ${f.model} @ ${f.vagueness}`);
      lines.push(`    Scenario: ${f.scenario}`);
      lines.push(`    Reason: ${f.reason?.substring(0, 80) || 'Unknown'}`);
      lines.push('');
    }
    if (analysis.failures.length > 20) {
      lines.push(`  ... and ${analysis.failures.length - 20} more failures`);
    }
  }

  return lines.join('\n');
}

function generateMarkdownReport(run: ExperimentRun, options: AnalysisOptions): string {
  const analysis = analyzeRun(run);
  const lines: string[] = [];

  lines.push(`# Experiment Analysis: ${run.experimentId}`);
  lines.push('');
  lines.push(`**Run ID:** ${run.runId}  `);
  lines.push(`**Started:** ${run.startedAt}  `);
  lines.push(`**Completed:** ${run.completedAt}  `);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Runs | ${analysis.totalRuns} |`);
  lines.push(`| Successful | ${analysis.successfulRuns} |`);
  lines.push(`| **Success Rate** | **${(analysis.successRate * 100).toFixed(1)}%** |`);
  lines.push('');

  lines.push('## Results by Model');
  lines.push('');
  lines.push('| Model | Success Rate | Avg Latency |');
  lines.push('|-------|--------------|-------------|');
  for (const [model, stats] of Object.entries(analysis.byModel)) {
    const s = stats as { total: number; success: number; successRate: number; avgLatencyMs: number };
    lines.push(`| ${model} | ${s.success}/${s.total} (${(s.successRate * 100).toFixed(1)}%) | ${s.avgLatencyMs}ms |`);
  }
  lines.push('');

  lines.push('## Results by Vagueness Level');
  lines.push('');
  lines.push('| Level | Success Rate |');
  lines.push('|-------|--------------|');
  const order: VaguenessLevel[] = ['explicit', 'guided', 'conversational', 'vague', 'adversarial'];
  for (const level of order) {
    const stats = analysis.byVagueness[level];
    if (stats) {
      const s = stats as { total: number; success: number; successRate: number };
      lines.push(`| ${level} | ${s.success}/${s.total} (${(s.successRate * 100).toFixed(1)}%) |`);
    }
  }
  lines.push('');

  lines.push('## Results by Scenario');
  lines.push('');
  lines.push('| Scenario | Success Rate |');
  lines.push('|----------|--------------|');
  for (const [scenario, stats] of Object.entries(analysis.byScenario)) {
    const s = stats as { total: number; success: number; successRate: number };
    lines.push(`| ${scenario} | ${s.success}/${s.total} (${(s.successRate * 100).toFixed(1)}%) |`);
  }
  lines.push('');

  if (options.showFailures && analysis.failures.length > 0) {
    lines.push('## Failure Analysis');
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Show failures</summary>');
    lines.push('');
    for (const f of analysis.failures.slice(0, 20)) {
      lines.push(`- **${f.model}** @ **${f.vagueness}** - ${f.scenario}`);
      lines.push(`  - ${f.reason || 'Unknown reason'}`);
    }
    if (analysis.failures.length > 20) {
      lines.push(`- ... and ${analysis.failures.length - 20} more failures`);
    }
    lines.push('');
    lines.push('</details>');
  }

  return lines.join('\n');
}

function generateComparison(run1: ExperimentRun, run2: ExperimentRun, format: string): string {
  const a1 = analyzeRun(run1);
  const a2 = analyzeRun(run2);

  const lines: string[] = [];

  if (format === 'markdown') {
    lines.push('## Comparison');
    lines.push('');
    lines.push(`| Metric | Run 1 | Run 2 | Diff |`);
    lines.push(`|--------|-------|-------|------|`);
    lines.push(`| Success Rate | ${(a1.successRate * 100).toFixed(1)}% | ${(a2.successRate * 100).toFixed(1)}% | ${((a2.successRate - a1.successRate) * 100).toFixed(1)}% |`);
  } else {
    lines.push('');
    lines.push('COMPARISON');
    lines.push('-'.repeat(40));
    lines.push(`Run 1 Success Rate: ${(a1.successRate * 100).toFixed(1)}%`);
    lines.push(`Run 2 Success Rate: ${(a2.successRate * 100).toFixed(1)}%`);
    lines.push(`Difference: ${((a2.successRate - a1.successRate) * 100).toFixed(1)}%`);
  }

  return lines.join('\n');
}

main().catch(console.error);
