#!/usr/bin/env npx tsx
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { EvalRunner } from "./runner.js";
import type { EvalScenario } from "./types.js";

const program = new Command();

program
  .name("los-eval")
  .description("Agent evaluation harness for Open LOS")
  .version("0.1.0");

program
  .command("run")
  .description("Run an evaluation scenario")
  .argument("<scenario-file>", "Path to scenario YAML file")
  .option("--server <url>", "API server URL", "http://localhost:3000")
  .option("--token <token>", "Authentication token")
  .action(async (file: string, opts: { server: string; token?: string }) => {
    const content = readFileSync(file, "utf-8");
    const scenario: EvalScenario = parseYaml(content);

    console.log(`Running scenario: ${scenario.name}`);
    console.log(`  ${scenario.description}`);
    console.log(`  Server: ${opts.server}`);
    console.log("");

    const runner = new EvalRunner(opts.server, opts.token);
    const result = await runner.runScenario(scenario);

    // Print results
    console.log(`\nResults: ${result.passed ? "PASSED" : "FAILED"}`);
    console.log(`  Score: ${result.score}/${result.max_score}`);
    console.log(`  Duration: ${result.duration_ms}ms`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log("");

    for (const check of result.checks) {
      const icon = check.passed ? "\u2713" : "\u2717";
      console.log(`  ${icon} ${check.name} (weight: ${check.weight})`);
      if (!check.passed) {
        console.log(`    Expected: ${JSON.stringify(check.expected)}`);
        console.log(`    Actual:   ${JSON.stringify(check.actual)}`);
      }
    }

    if (result.errors.length > 0) {
      console.log("\nErrors:");
      for (const err of result.errors) {
        console.log(`  - ${err}`);
      }
    }

    process.exit(result.passed ? 0 : 1);
  });

program
  .command("list")
  .description("List available built-in scenarios")
  .action(() => {
    console.log("Built-in evaluation scenarios:\n");
    console.log("  full-origination     Full deal origination from broker to closing");
    console.log("  entity-graph         Create entities and link them to a deal");
    console.log("  covenant-setup       Set up and test financial covenants");
    console.log("  stage-transitions    Navigate all stage transitions correctly");
    console.log("  error-recovery       Handle API errors gracefully");
    console.log("");
    console.log("Run with: los-eval run scenarios/<name>.yaml");
  });

program.parse();
