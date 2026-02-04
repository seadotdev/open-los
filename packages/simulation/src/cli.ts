#!/usr/bin/env node
/**
 * Simulation Suite CLI
 *
 * Command-line interface for running lending business simulations
 * against the Open LOS platform.
 *
 * Usage:
 *   npx tsx packages/simulation/src/cli.ts run --all
 *   npx tsx packages/simulation/src/cli.ts run --persona us-regional-bank-midwest
 *   npx tsx packages/simulation/src/cli.ts run --business-model commercial_bank
 *   npx tsx packages/simulation/src/cli.ts run --challenge multi_currency
 *   npx tsx packages/simulation/src/cli.ts list personas
 *   npx tsx packages/simulation/src/cli.ts list capabilities
 */

import { Command } from "commander";
import { getAllPersonas, getPersonasByBusinessModel, getPersonasByChallenge } from "./personas/index.js";
import { getAllCapabilities, getCapabilitiesForBusinessModel } from "./capabilities/index.js";
import { runSimulation, runSimulations, DEFAULT_CONFIG, type SimulationConfig } from "./runner/index.js";
import { createAgent, DEFAULT_AGENT_CONFIG, LLMAgent, type AgentConfig } from "./agents/index.js";
import { generateSuiteReport, formatReportAsMarkdown, formatQuickSummary, formatReportAsJson } from "./reports/index.js";
import type { Persona, SimulationResult } from "./types.js";
import * as fs from "node:fs";

const program = new Command();

program
  .name("simulation")
  .description("Open LOS Lending Business Simulation Suite")
  .version("0.1.0");

// ============================================================================
// LIST COMMAND
// ============================================================================

const listCmd = program.command("list").description("List personas or capabilities");

listCmd
  .command("personas")
  .description("List all available lending business personas")
  .option("--business-model <model>", "Filter by business model")
  .option("--deposits", "Show only deposit-taking institutions")
  .option("--json", "Output as JSON")
  .action((options) => {
    let personas = getAllPersonas();

    if (options.businessModel) {
      personas = personas.filter((p) => p.businessModel === options.businessModel);
    }

    if (options.deposits) {
      personas = personas.filter((p) => p.takesDeposits);
    }

    console.log(`\nFound ${personas.length} personas\n`);

    if (options.json) {
      console.log(JSON.stringify(personas, null, 2));
    } else {
      console.log("ID                                    | Name                                | Business Model          | Deposits");
      console.log("--------------------------------------|-------------------------------------|-------------------------|----------");
      for (const p of personas) {
        const id = p.id.padEnd(37);
        const name = p.name.slice(0, 35).padEnd(35);
        const model = p.businessModel.padEnd(23);
        const deposits = p.takesDeposits ? "Yes" : "No";
        console.log(`${id} | ${name} | ${model} | ${deposits}`);
      }
    }
  });

listCmd
  .command("capabilities")
  .description("List all capability definitions")
  .option("--category <category>", "Filter by category")
  .option("--business-model <model>", "Show capabilities required by business model")
  .option("--json", "Output as JSON")
  .action((options) => {
    let capabilities = getAllCapabilities();

    if (options.category) {
      capabilities = capabilities.filter((c) => c.category === options.category);
    }

    if (options.businessModel) {
      capabilities = getCapabilitiesForBusinessModel(options.businessModel);
    }

    console.log(`\nFound ${capabilities.length} capabilities\n`);

    if (options.json) {
      console.log(JSON.stringify(capabilities, null, 2));
    } else {
      console.log("ID                          | Category              | Name");
      console.log("----------------------------|----------------------|----------------------------------");
      for (const c of capabilities) {
        const id = c.id.padEnd(27);
        const category = c.category.padEnd(21);
        console.log(`${id} | ${category} | ${c.name}`);
      }
    }
  });

listCmd
  .command("business-models")
  .description("List all business model types")
  .action(() => {
    const personas = getAllPersonas();
    const models = new Map<string, number>();

    for (const p of personas) {
      models.set(p.businessModel, (models.get(p.businessModel) || 0) + 1);
    }

    console.log("\nBusiness Models:\n");
    console.log("Model                       | Persona Count");
    console.log("----------------------------|---------------");
    for (const [model, count] of Array.from(models.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`${model.padEnd(27)} | ${count}`);
    }
  });

// ============================================================================
// RUN COMMAND
// ============================================================================

program
  .command("run")
  .description("Run simulations against the Open LOS API")
  .option("--all", "Run all personas")
  .option("--persona <id>", "Run specific persona by ID")
  .option("--business-model <model>", "Run all personas of a business model")
  .option("--challenge <challenge>", "Run personas with specific test challenge")
  .option("--deposits-only", "Only run deposit-taking personas")
  .option("--limit <n>", "Limit number of personas to run", parseInt)
  .option("--base-url <url>", "API base URL", DEFAULT_CONFIG.baseUrl)
  .option("--tenant <id>", "Tenant ID", DEFAULT_CONFIG.tenantId)
  .option("--concurrency <n>", "Parallel simulation limit", parseInt, DEFAULT_CONFIG.concurrency)
  .option("--verbose", "Verbose logging", false)
  .option("--output <file>", "Output report to file")
  .option("--format <format>", "Output format (json, markdown)", "markdown")
  .option("--llm", "Use LLM-based workflow generation (requires API key)")
  .option("--api-key <key>", "Anthropic API key (or use ANTHROPIC_API_KEY env var)")
  .option("--model <model>", "LLM model to use", "claude-sonnet-4-20250514")
  .action(async (options) => {
    // Select personas
    let personas: Persona[] = [];

    if (options.all) {
      personas = getAllPersonas();
    } else if (options.persona) {
      const all = getAllPersonas();
      const found = all.find((p) => p.id === options.persona);
      if (!found) {
        console.error(`Persona not found: ${options.persona}`);
        process.exit(1);
      }
      personas = [found];
    } else if (options.businessModel) {
      personas = getPersonasByBusinessModel(options.businessModel as any);
    } else if (options.challenge) {
      personas = getPersonasByChallenge(options.challenge);
    } else {
      console.error("Please specify --all, --persona, --business-model, or --challenge");
      process.exit(1);
    }

    if (options.depositsOnly) {
      personas = personas.filter((p) => p.takesDeposits);
    }

    if (options.limit && options.limit > 0) {
      personas = personas.slice(0, options.limit);
    }

    if (personas.length === 0) {
      console.error("No personas match the criteria");
      process.exit(1);
    }

    console.log(`\nRunning simulations for ${personas.length} persona(s)...\n`);

    // Create config
    const config: SimulationConfig = {
      ...DEFAULT_CONFIG,
      baseUrl: options.baseUrl,
      tenantId: options.tenant,
      concurrency: options.concurrency,
      verbose: options.verbose,
    };

    // Create agent config
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    const useLlm = options.llm && apiKey;

    if (options.llm && !apiKey) {
      console.warn("Warning: --llm specified but no API key found. Falling back to rule-based generation.");
      console.warn("Provide API key via --api-key or ANTHROPIC_API_KEY environment variable.\n");
    }

    const agentConfig: AgentConfig = {
      useRuleBased: !useLlm,
      maxSteps: 20,
      apiKey: apiKey,
      model: options.model,
    };

    // Create agent
    const agent = useLlm ? new LLMAgent(agentConfig) : createAgent(agentConfig);

    if (useLlm) {
      console.log(`Using LLM-based workflow generation with model: ${options.model}\n`);
    }

    // Generate scenarios (async for LLM agent)
    const scenarios: Array<{ scenario: any; persona: Persona }> = [];
    for (const persona of personas) {
      if (useLlm && agent instanceof LLMAgent) {
        const scenario = await agent.generateScenarioAsync(persona);
        scenarios.push({ scenario, persona });
      } else {
        scenarios.push({ scenario: agent.generateScenario(persona), persona });
      }
    }

    // Track progress
    let completed = 0;
    const results: SimulationResult[] = [];

    // Run simulations
    for (const { scenario, persona } of scenarios) {
      if (config.verbose) {
        console.log(`[${completed + 1}/${scenarios.length}] Running: ${persona.name}`);
      } else {
        process.stdout.write(`\rProgress: ${completed + 1}/${scenarios.length}`);
      }

      try {
        const result = await runSimulation(scenario, persona, config);
        results.push(result);

        if (config.verbose) {
          const status = result.overallSuccess ? "PASS" : "FAIL";
          const gaps = result.capabilityGaps.length;
          console.log(`  Result: ${status} (${result.summary.successfulSteps}/${result.summary.totalSteps} steps, ${gaps} gaps)`);
        }
      } catch (error) {
        console.error(`\nError running simulation for ${persona.id}:`, error);
      }

      completed++;
    }

    console.log("\n");

    // Generate report
    const personaMap = new Map(personas.map((p) => [p.id, p]));
    const report = generateSuiteReport(results, personaMap);

    // Output report
    const quickSummary = formatQuickSummary(report);
    console.log(quickSummary);

    if (options.output) {
      let content: string;
      if (options.format === "json") {
        content = formatReportAsJson(report);
      } else {
        content = formatReportAsMarkdown(report);
      }

      fs.writeFileSync(options.output, content);
      console.log(`Report written to: ${options.output}`);
    }
  });

// ============================================================================
// QUICK COMMAND - Run a quick smoke test
// ============================================================================

program
  .command("quick")
  .description("Run a quick smoke test with a few key personas")
  .option("--base-url <url>", "API base URL", DEFAULT_CONFIG.baseUrl)
  .option("--verbose", "Verbose logging", false)
  .option("--llm", "Use LLM-based workflow generation (requires API key)")
  .option("--api-key <key>", "Anthropic API key (or use ANTHROPIC_API_KEY env var)")
  .option("--model <model>", "LLM model to use", "claude-sonnet-4-20250514")
  .action(async (options) => {
    // Select a diverse set of key personas
    const keyPersonaIds = [
      "us-regional-bank-midwest",     // Traditional bank with deposits
      "us-abl-lender",                // Asset-based lender
      "us-revenue-based-finance",     // Fintech
      "swiss-private-bank",           // Multi-currency
      "uk-development-finance",       // Construction
    ];

    const allPersonas = getAllPersonas();
    const personas = keyPersonaIds
      .map((id) => allPersonas.find((p) => p.id === id))
      .filter((p): p is Persona => !!p);

    console.log(`\nQuick test with ${personas.length} key personas...\n`);

    const config: SimulationConfig = {
      ...DEFAULT_CONFIG,
      baseUrl: options.baseUrl,
      verbose: options.verbose,
    };

    // Create agent config
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    const useLlm = options.llm && apiKey;

    if (options.llm && !apiKey) {
      console.warn("Warning: --llm specified but no API key found. Falling back to rule-based generation.\n");
    }

    const agentConfig: AgentConfig = {
      useRuleBased: !useLlm,
      maxSteps: 20,
      apiKey: apiKey,
      model: options.model,
    };

    const agent = useLlm ? new LLMAgent(agentConfig) : createAgent(agentConfig);

    if (useLlm) {
      console.log(`Using LLM-based workflow generation with model: ${options.model}\n`);
    }

    const results: SimulationResult[] = [];

    for (const persona of personas) {
      console.log(`Testing: ${persona.name}...`);
      const scenario = useLlm && agent instanceof LLMAgent
        ? await agent.generateScenarioAsync(persona)
        : agent.generateScenario(persona);

      try {
        const result = await runSimulation(scenario, persona, config);
        results.push(result);

        const status = result.overallSuccess ? "PASS" : "FAIL";
        console.log(`  ${status} - ${result.summary.successfulSteps}/${result.summary.totalSteps} steps`);

        if (result.capabilityGaps.length > 0) {
          for (const gap of result.capabilityGaps) {
            console.log(`    Gap: [${gap.severity}] ${gap.description}`);
          }
        }
      } catch (error) {
        console.error(`  ERROR:`, error instanceof Error ? error.message : error);
      }
    }

    const personaMap = new Map(personas.map((p) => [p.id, p]));
    const report = generateSuiteReport(results, personaMap);
    console.log(formatQuickSummary(report));
  });

// ============================================================================
// ANALYZE COMMAND - Analyze a previous report
// ============================================================================

program
  .command("analyze")
  .description("Analyze a previous simulation report")
  .argument("<file>", "Report file (JSON)")
  .option("--top <n>", "Show top N gaps", parseInt, 10)
  .action((file, options) => {
    const content = fs.readFileSync(file, "utf-8");
    const report = JSON.parse(content);

    console.log("\n=== Report Analysis ===\n");
    console.log(`Run ID: ${report.runId}`);
    console.log(`Date: ${report.runAt}`);
    console.log(`Personas: ${report.personasSimulated}`);
    console.log(`Success Rate: ${(report.successRate * 100).toFixed(1)}%`);
    console.log("");

    console.log(`Top ${options.top} Capability Gaps:\n`);

    for (const gap of report.uniqueCapabilityGaps.slice(0, options.top)) {
      console.log(`  [${gap.severity.toUpperCase()}] ${gap.capabilityId}`);
      console.log(`    ${gap.description}`);
      console.log(`    Occurrences: ${gap.occurrences}, Priority: ${gap.priorityScore}`);
      console.log(`    Affected: ${gap.affectedPersonas.join(", ")}`);
      console.log("");
    }
  });

// Parse and execute
program.parse();
