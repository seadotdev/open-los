#!/usr/bin/env npx tsx
/**
 * Simple test script for LLM Agent
 * Run with: OPENROUTER_API_KEY=your-key npx tsx packages/simulation/src/test-llm-agent.ts
 */

import { LLMAgent, type AgentConfig } from "./agents/index.js";
import { getAllPersonas } from "./personas/index.js";

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("Error: OPENROUTER_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log("Testing LLM Agent with OpenRouter API...\n");

  const agentConfig: AgentConfig = {
    useRuleBased: false,
    maxSteps: 15,
    apiKey: apiKey,
    model: "anthropic/claude-sonnet-4",
  };

  const agent = new LLMAgent(agentConfig);

  // Test with one persona
  const personas = getAllPersonas();
  const testPersona = personas.find((p) => p.id === "us-regional-bank-midwest")!;

  console.log(`Testing with persona: ${testPersona.name}`);
  console.log(`Business model: ${testPersona.businessModel}`);
  console.log(`Description: ${testPersona.description}\n`);

  console.log("Generating workflow via LLM...\n");

  try {
    const scenario = await agent.generateScenarioAsync(testPersona);

    console.log("=== Generated Scenario ===\n");
    console.log(`Name: ${scenario.name}`);
    console.log(`Description: ${scenario.description}`);
    console.log(`Objective: ${scenario.objective}`);
    console.log(`Capabilities tested: ${scenario.capabilitiesUnderTest.join(", ")}`);
    console.log(`\nWorkflow Steps (${scenario.workflow.length}):\n`);

    for (const step of scenario.workflow) {
      console.log(`  ${step.id}: ${step.description}`);
      console.log(`    Action: ${step.action}`);
      console.log(`    Expected: ${step.expectedOutcome.success ? "success" : "failure"} (${step.expectedOutcome.statusCode || "any"})`);
    }

    console.log("\n=== Success ===");
    console.log("LLM Agent is working correctly!");
  } catch (error) {
    console.error("Error generating scenario:", error);
    process.exit(1);
  }
}

main();
