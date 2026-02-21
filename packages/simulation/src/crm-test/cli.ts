#!/usr/bin/env npx tsx
/**
 * CRM Model Test CLI
 *
 * Run with:
 *   OPENROUTER_API_KEY=your-key npx tsx packages/simulation/src/crm-test/cli.ts
 *
 * Options:
 *   --verbose              Show per-task details during execution
 *   --model <id>           Test a specific model (can be repeated)
 *   --category <cat>       Filter to specific categories (can be repeated)
 *   --task <id>            Run specific tasks only (can be repeated)
 *   --output <file>        Write JSON report to file
 *   --detailed <file>      Write detailed per-task report to file
 *   --concurrency <n>      Max concurrent requests (default: 1)
 *   --timeout <ms>         Timeout per request (default: 30000)
 *   --list-tasks           List all available tasks and exit
 *   --list-models          List default models and exit
 */

import { Command } from "commander";
import * as fs from "node:fs";
import {
  runTestSuite,
  DEFAULT_MODELS,
  DEFAULT_RUNNER_CONFIG,
} from "./runner.js";
import { ALL_TASKS } from "./scenarios.js";
import {
  formatConsoleSummary,
  formatJsonReport,
  formatDetailedReport,
} from "./report.js";
import type { ModelConfig, TaskCategory, TestRunnerConfig } from "./types.js";

const program = new Command();

program
  .name("crm-test")
  .description(
    "Test small LLMs on CRM/CLI interactions with the Open LOS system"
  )
  .version("0.1.0");

// List tasks
program
  .command("list-tasks")
  .description("List all available test tasks")
  .option("--category <cat>", "Filter by category")
  .option("--difficulty <diff>", "Filter by difficulty")
  .option("--json", "Output as JSON")
  .action((opts) => {
    let tasks = ALL_TASKS;
    if (opts.category) {
      tasks = tasks.filter((t) => t.category === opts.category);
    }
    if (opts.difficulty) {
      tasks = tasks.filter((t) => t.difficulty === opts.difficulty);
    }

    if (opts.json) {
      console.log(
        JSON.stringify(
          tasks.map((t) => ({
            id: t.id,
            name: t.name,
            category: t.category,
            difficulty: t.difficulty,
            tags: t.tags,
            validatorCount: t.validators.length,
          })),
          null,
          2
        )
      );
      return;
    }

    console.log(`\n${tasks.length} test tasks:\n`);
    console.log(
      "ID".padEnd(35) +
        "Name".padEnd(40) +
        "Category".padEnd(22) +
        "Difficulty"
    );
    console.log("-".repeat(105));
    for (const t of tasks) {
      console.log(
        t.id.padEnd(35) +
          t.name.slice(0, 38).padEnd(40) +
          t.category.padEnd(22) +
          t.difficulty
      );
    }
    console.log("");
  });

// List models
program
  .command("list-models")
  .description("List default models")
  .action(() => {
    console.log("\nDefault models:\n");
    for (const m of DEFAULT_MODELS) {
      console.log(`  ${m.name.padEnd(20)} ${m.id}`);
    }
    console.log("");
  });

// Run tests
program
  .command("run")
  .description("Run the CRM model test suite")
  .option("--verbose", "Show per-task details", false)
  .option(
    "--model <ids...>",
    "Model ID(s) to test (OpenRouter format). Overrides defaults."
  )
  .option("--category <cats...>", "Category filter(s)")
  .option("--task <ids...>", "Specific task ID(s) to run")
  .option("--output <file>", "Write JSON report to file")
  .option("--detailed <file>", "Write detailed per-task report to file")
  .option("--concurrency <n>", "Max concurrent requests", "1")
  .option("--timeout <ms>", "Timeout per request in ms", "30000")
  .option(
    "--api-key <key>",
    "OpenRouter API key (or use OPENROUTER_API_KEY env var)"
  )
  .action(async (opts) => {
    const apiKey =
      opts.apiKey || process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error(
        "Error: OpenRouter API key required.\n" +
          "Set OPENROUTER_API_KEY environment variable or use --api-key flag."
      );
      process.exit(1);
    }

    // Build model list
    let models: ModelConfig[];
    if (opts.model && opts.model.length > 0) {
      models = (opts.model as string[]).map((id: string) => ({
        id,
        name: id.split("/").pop()?.replace(/:.*$/, "") || id,
        maxTokens: 1024,
        temperature: 0.1,
      }));
    } else {
      models = DEFAULT_MODELS;
    }

    // Build config
    const config: TestRunnerConfig = {
      apiKey,
      models,
      baseUrl: DEFAULT_RUNNER_CONFIG.baseUrl,
      timeoutMs: parseInt(opts.timeout),
      retries: DEFAULT_RUNNER_CONFIG.retries,
      concurrency: parseInt(opts.concurrency),
      verbose: opts.verbose,
      taskFilter: opts.task,
      categoryFilter: opts.category as TaskCategory[] | undefined,
    };

    // Run
    const report = await runTestSuite(config);

    // Print summary
    console.log(formatConsoleSummary(report));

    // Write files
    if (opts.output) {
      fs.writeFileSync(opts.output, formatJsonReport(report));
      console.log(`JSON report written to: ${opts.output}`);
    }

    if (opts.detailed) {
      fs.writeFileSync(opts.detailed, formatDetailedReport(report));
      console.log(`Detailed report written to: ${opts.detailed}`);
    }
  });

program.parse();
