/**
 * Open LOS Lending Business Simulation Suite
 *
 * A comprehensive testing framework that simulates hundreds of different
 * lending businesses attempting to build their workflows in the Open LOS
 * platform, identifying capability gaps and areas for improvement.
 *
 * Key Components:
 * - Personas: 100+ lending business archetypes (banks, fintechs, etc.)
 * - Capabilities: What the platform should support
 * - Agents: Rule-based or AI-powered workflow generators
 * - Runner: Executes simulations against the API
 * - Reports: Gap analysis and improvement recommendations
 *
 * Usage:
 *   import { getAllPersonas, createAgent, runSimulation } from '@open-los/simulation';
 *
 *   const personas = getAllPersonas();
 *   const agent = createAgent();
 *
 *   for (const persona of personas) {
 *     const scenario = agent.generateScenario(persona);
 *     const result = await runSimulation(scenario, persona);
 *     console.log(`${persona.name}: ${result.overallSuccess ? 'PASS' : 'FAIL'}`);
 *   }
 */

// Types
export type {
  Persona,
  BusinessModel,
  Currency,
  ProductType,
  GeographicScope,
  RegulatoryRegime,
  Capability,
  SimulationScenario,
  SimulationResult,
  StepResult,
  WorkflowStep,
  SimulationSuiteReport,
} from "./types.js";

// Personas
export {
  getAllPersonas,
  getPersonasByBusinessModel,
  getPersonasByScope,
  getPersonasByCurrency,
  getPersonasByChallenge,
  getDepositTakingPersonas,
  CORE_ARCHETYPES,
  generateParametricPersonas,
} from "./personas/index.js";

// Capabilities
export {
  getAllCapabilities,
  getCapabilitiesForBusinessModel,
  getCapabilitiesByCategory,
  getCapabilityById,
  CAPABILITIES,
} from "./capabilities/index.js";

// Runner
export {
  runSimulation,
  runSimulations,
  DEFAULT_CONFIG,
  type SimulationConfig,
  type ExecutionContext,
} from "./runner/index.js";

// Agents
export {
  createAgent,
  RuleBasedAgent,
  LLMAgent,
  DEFAULT_AGENT_CONFIG,
  type AgentConfig,
} from "./agents/index.js";

// Reports
export {
  generateSuiteReport,
  formatReportAsMarkdown,
  formatReportAsJson,
  formatQuickSummary,
} from "./reports/index.js";
