/**
 * CRM Model Test Harness
 *
 * Tests how well small open-source LLMs can interact with the Open LOS CLI
 * for basic CRM operations: creating deals, managing entities, advancing
 * workflows, etc.
 *
 * Usage:
 *   OPENROUTER_API_KEY=... npx tsx packages/simulation/src/crm-test/cli.ts
 *   OPENROUTER_API_KEY=... npx tsx packages/simulation/src/crm-test/cli.ts --verbose
 *   OPENROUTER_API_KEY=... npx tsx packages/simulation/src/crm-test/cli.ts --model google/gemma-2-9b-it:free
 */

export { ALL_TASKS, getTasksByCategory, getTasksByDifficulty, getTasksByTag } from "./scenarios.js";
export { runTestSuite, DEFAULT_MODELS, DEFAULT_RUNNER_CONFIG } from "./runner.js";
export { runValidator, runAllValidators } from "./validators.js";
export { formatConsoleSummary, formatJsonReport, formatDetailedReport } from "./report.js";
export type {
  TestTask,
  TaskResult,
  ModelReport,
  TestSuiteReport,
  TestRunnerConfig,
  ModelConfig,
  TaskCategory,
} from "./types.js";
