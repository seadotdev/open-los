/**
 * Agent Framework
 *
 * AI-powered agents that attempt to build workflows for different
 * lending business personas. Each agent represents a lending business
 * trying to accomplish their objectives using the Open LOS platform.
 */

import type {
  Persona,
  SimulationScenario,
  WorkflowStep,
  Capability,
} from "../types.js";
import { getCapabilitiesForBusinessModel } from "../capabilities/index.js";

/**
 * Agent configuration for LLM-based workflow generation
 */
export interface AgentConfig {
  /** Model to use for generation (if using LLM) */
  model?: string;
  /** API key for LLM service */
  apiKey?: string;
  /** Use rule-based generation instead of LLM */
  useRuleBased: boolean;
  /** Maximum workflow steps to generate */
  maxSteps: number;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  useRuleBased: true,
  maxSteps: 20,
};

/**
 * Workflow templates for common lending scenarios
 */
const WORKFLOW_TEMPLATES: Record<string, WorkflowStep[]> = {
  // Basic deal origination
  "basic-origination": [
    {
      id: "create-deal",
      description: "Create new deal",
      action: "create_deal",
      params: {},
      expectedOutcome: { success: true, statusCode: 201 },
    },
    {
      id: "update-deal-details",
      description: "Add deal details",
      action: "update_deal",
      params: {},
      expectedOutcome: { success: true, statusCode: 200 },
    },
    {
      id: "create-borrower-entity",
      description: "Create borrower entity",
      action: "create_entity",
      params: {},
      expectedOutcome: { success: true, statusCode: 201 },
    },
    {
      id: "link-borrower",
      description: "Link borrower to deal",
      action: "create_relationship",
      params: {},
      expectedOutcome: { success: true, statusCode: 201 },
    },
    {
      id: "upload-application",
      description: "Upload loan application",
      action: "upload_document",
      params: {},
      expectedOutcome: { success: true, statusCode: 201 },
    },
    {
      id: "transition-to-origination",
      description: "Move to origination stage",
      action: "transition_stage",
      params: { to_stage: "origination" },
      expectedOutcome: { success: true, statusCode: 201 },
    },
  ],

  // Full underwriting workflow
  "full-underwriting": [
    {
      id: "create-spread",
      description: "Create financial spread",
      action: "create_spread",
      params: {},
      expectedOutcome: { success: true, statusCode: 201 },
    },
    {
      id: "define-leverage-covenant",
      description: "Define leverage covenant",
      action: "define_covenant",
      params: {},
      expectedOutcome: { success: true, statusCode: 201 },
    },
    {
      id: "test-covenant",
      description: "Test covenant compliance",
      action: "test_covenant",
      params: {},
      expectedOutcome: { success: true },
    },
    {
      id: "transition-to-underwriting",
      description: "Move to underwriting stage",
      action: "transition_stage",
      params: { to_stage: "underwriting" },
      expectedOutcome: { success: true, statusCode: 201 },
    },
  ],

  // Loan funding
  "loan-funding": [
    {
      id: "create-facility",
      description: "Create loan facility",
      action: "create_facility",
      params: {},
      expectedOutcome: { success: true, statusCode: 201 },
    },
    {
      id: "create-loan-account",
      description: "Create loan account",
      action: "create_loan",
      params: {},
      expectedOutcome: { success: true, statusCode: 201 },
    },
    {
      id: "disburse-loan",
      description: "Disburse loan funds",
      action: "disburse_loan",
      params: {},
      expectedOutcome: { success: true, statusCode: 201 },
    },
  ],

  // Monitoring workflow
  "monitoring": [
    {
      id: "ingest-transactions",
      description: "Ingest bank transactions",
      action: "ingest_transactions",
      params: {},
      expectedOutcome: { success: true, statusCode: 201 },
    },
    {
      id: "check-monitoring-status",
      description: "Check monitoring status",
      action: "check_monitoring",
      params: {},
      expectedOutcome: { success: true, statusCode: 200 },
    },
  ],

  // Multi-currency deal
  "multi-currency": [
    {
      id: "create-deal-eur",
      description: "Create EUR denominated deal",
      action: "create_deal",
      params: { currency: "EUR" },
      expectedOutcome: { success: true, statusCode: 201 },
    },
    {
      id: "verify-currency",
      description: "Verify deal currency",
      action: "custom_api_call",
      params: { method: "GET", path: "/v1/deals/${deal_id}" },
      expectedOutcome: { success: true },
    },
  ],

  // Deposit account (for banks)
  "deposit-account": [
    {
      id: "create-deposit",
      description: "Create deposit account",
      action: "custom_api_call",
      params: {
        method: "POST",
        path: "/v1/deposits",
        body: { type: "demand_deposit", account_holder: "Test Customer" },
      },
      expectedOutcome: { success: true, statusCode: 201 },
    },
  ],

  // Syndication
  "syndication": [
    {
      id: "create-syndicated-facility",
      description: "Create syndicated facility",
      action: "custom_api_call",
      params: {
        method: "POST",
        path: "/v1/facilities",
        body: { type: "syndicated", agent_bank: "Lead Bank" },
      },
      expectedOutcome: { success: true, statusCode: 201 },
    },
    {
      id: "add-participant",
      description: "Add participant lender",
      action: "custom_api_call",
      params: {
        method: "POST",
        path: "/v1/facilities/${facility_id}/participants",
        body: { lender_name: "Participant Bank", commitment: 25000000 },
      },
      expectedOutcome: { success: true, statusCode: 201 },
    },
  ],
};

/**
 * Generate workflow parameters based on persona characteristics
 */
function generatePersonaParams(persona: Persona): Record<string, unknown> {
  return {
    borrower_name: `${persona.name} Test Borrower`,
    jurisdiction: persona.jurisdictions[0] || "US",
    requested_amount: (persona.typicalDealSize.min + persona.typicalDealSize.max) / 2,
    currency: persona.baseCurrency,
    purpose: `${persona.businessModel} financing`,
  };
}

/**
 * Generate financial spread params based on persona
 */
function generateSpreadParams(persona: Persona): Record<string, unknown> {
  // Scale based on typical deal size
  const scale = persona.typicalDealSize.max / 10_000_000;

  return {
    period: "FY2025",
    line_items: {
      revenue: Math.round(20_000_000 * scale),
      cogs: Math.round(12_000_000 * scale),
      operating_expense: Math.round(4_000_000 * scale),
      interest: Math.round(500_000 * scale),
      tax: Math.round(800_000 * scale),
      depreciation: Math.round(300_000 * scale),
    },
  };
}

/**
 * Generate covenant params based on persona complexity
 */
function generateCovenantParams(persona: Persona): Record<string, unknown> {
  if (persona.covenantComplexity === "none") {
    return {};
  }

  return {
    name: "Leverage Ratio",
    type: "financial",
    metric: "debt_to_ebitda",
    operator: "lte",
    threshold: 3.5,
    frequency: "quarterly",
    grace_period_days: 30,
  };
}

/**
 * Generate facility params based on persona products
 */
function generateFacilityParams(persona: Persona): Record<string, unknown> {
  const products = persona.products;

  // Determine facility type based on products
  let facilityType = "term_loan";
  if (products.includes("revolving_credit") || products.includes("line_of_credit")) {
    facilityType = "revolving";
  }

  return {
    type: facilityType,
    amount: persona.typicalDealSize.max,
    currency: persona.baseCurrency,
    interest_rate: 5.5,
    term_months: 60,
  };
}

/**
 * Generate loan params based on persona
 */
function generateLoanParams(persona: Persona): Record<string, unknown> {
  return {
    principal_amount: persona.typicalDealSize.min,
    currency: persona.baseCurrency,
    interest_rate: 6.0,
    repayment_frequency: "monthly",
    term_months: 36,
  };
}

/**
 * Generate entity params based on persona
 */
function generateEntityParams(persona: Persona): Record<string, unknown> {
  return {
    type: "company",
    name: `${persona.name} Test Borrower Inc.`,
    legal_name: `${persona.name} Test Borrower, Inc.`,
    jurisdiction: persona.jurisdictions[0] || "US",
    registration_number: `REG-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
  };
}

/**
 * Generate relationship params
 */
function generateRelationshipParams(): Record<string, unknown> {
  return {
    relationship_type: "borrower",
    ownership_pct: 100,
  };
}

/**
 * Generate document params
 */
function generateDocumentParams(): Record<string, unknown> {
  return {
    doc_type: "loan_application",
    filename: "loan_application.pdf",
    content: Buffer.from("Sample document content").toString("base64"),
  };
}

/**
 * Generate transaction ingestion params
 */
function generateTransactionParams(): Record<string, unknown> {
  const today = new Date();
  const transactions = [];

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    transactions.push({
      date: date.toISOString().split("T")[0],
      amount: Math.round((Math.random() - 0.5) * 50000),
      description: `Transaction ${i + 1}`,
      category: Math.random() > 0.5 ? "revenue" : "expense",
    });
  }

  return { transactions };
}

/**
 * Apply persona-specific parameters to workflow steps
 */
function applyPersonaParams(
  steps: WorkflowStep[],
  persona: Persona
): WorkflowStep[] {
  const baseParams = generatePersonaParams(persona);
  const spreadParams = generateSpreadParams(persona);
  const covenantParams = generateCovenantParams(persona);
  const facilityParams = generateFacilityParams(persona);
  const loanParams = generateLoanParams(persona);
  const entityParams = generateEntityParams(persona);
  const relationshipParams = generateRelationshipParams();
  const documentParams = generateDocumentParams();
  const transactionParams = generateTransactionParams();

  return steps.map((step) => {
    let params = { ...step.params };

    switch (step.action) {
      case "create_deal":
        params = { ...params, ...baseParams };
        break;
      case "update_deal":
        params = { ...params, ...baseParams };
        break;
      case "create_spread":
        params = { ...params, ...spreadParams };
        break;
      case "define_covenant":
        params = { ...params, ...covenantParams };
        break;
      case "create_facility":
        params = { ...params, ...facilityParams };
        break;
      case "create_loan":
        params = { ...params, ...loanParams };
        break;
      case "create_entity":
        params = { ...params, ...entityParams };
        break;
      case "create_relationship":
        params = { ...params, ...relationshipParams, source_entity_id: "${entity_id}" };
        break;
      case "upload_document":
        params = { ...params, ...documentParams };
        break;
      case "ingest_transactions":
        params = { ...params, ...transactionParams };
        break;
    }

    return { ...step, params };
  });
}

/**
 * Determine which workflow templates to use based on persona
 */
function selectWorkflowTemplates(persona: Persona): string[] {
  const templates: string[] = ["basic-origination"];

  // Add underwriting for non-trivial covenant complexity
  if (persona.covenantComplexity !== "none") {
    templates.push("full-underwriting");
  }

  // Add loan funding
  templates.push("loan-funding");

  // Add monitoring for lenders that need it
  if (
    persona.businessModel !== "merchant_cash_advance" &&
    persona.workflowComplexity !== "simple"
  ) {
    templates.push("monitoring");
  }

  // Add multi-currency test for international lenders
  if (persona.operatingCurrencies.length > 1) {
    templates.push("multi-currency");
  }

  // Add deposit test for deposit-taking institutions
  if (persona.takesDeposits) {
    templates.push("deposit-account");
  }

  // Add syndication for large deal lenders
  if (
    persona.products.includes("syndicated_loan") ||
    persona.products.includes("club_deal")
  ) {
    templates.push("syndication");
  }

  return templates;
}

/**
 * Rule-based agent that generates workflows from templates
 */
export class RuleBasedAgent {
  constructor(private config: AgentConfig = DEFAULT_AGENT_CONFIG) {}

  /**
   * Generate a simulation scenario for a persona
   */
  generateScenario(persona: Persona): SimulationScenario {
    const templateNames = selectWorkflowTemplates(persona);

    // Combine workflow steps from selected templates
    let allSteps: WorkflowStep[] = [];
    for (const templateName of templateNames) {
      const templateSteps = WORKFLOW_TEMPLATES[templateName] || [];
      allSteps = allSteps.concat(templateSteps);
    }

    // Limit steps
    allSteps = allSteps.slice(0, this.config.maxSteps);

    // Apply persona-specific parameters
    const workflow = applyPersonaParams(allSteps, persona);

    // Determine capabilities being tested
    const capabilities = getCapabilitiesForBusinessModel(persona.businessModel);
    const capabilityIds = capabilities.map((c) => c.id);

    return {
      id: `scenario-${persona.id}-${Date.now()}`,
      personaId: persona.id,
      name: `${persona.name} Standard Workflow`,
      description: `Automated workflow test for ${persona.businessModel} persona`,
      objective: `Validate that ${persona.name} can complete their standard lending workflow`,
      workflow,
      capabilitiesUnderTest: capabilityIds,
      expectedOutcome: "success",
    };
  }

  /**
   * Generate scenarios for specific capability tests
   */
  generateCapabilityTestScenario(
    persona: Persona,
    capability: Capability
  ): SimulationScenario {
    const testScenarios = capability.testScenarios;
    if (testScenarios.length === 0) {
      return this.generateScenario(persona);
    }

    // Convert capability test scenario to workflow steps
    const workflow: WorkflowStep[] = [];

    // Always start with creating a deal
    workflow.push({
      id: "setup-deal",
      description: "Create test deal",
      action: "create_deal",
      params: generatePersonaParams(persona),
      expectedOutcome: { success: true, statusCode: 201 },
    });

    // Add capability-specific test steps based on the category
    switch (capability.category) {
      case "currency":
        workflow.push({
          id: "test-currency",
          description: "Test currency support",
          action: "custom_api_call",
          params: {
            method: "PATCH",
            path: "/v1/deals/${deal_id}",
            body: { currency: persona.operatingCurrencies[1] || "EUR" },
          },
          expectedOutcome: { success: true },
        });
        break;

      case "deposits":
        workflow.push({
          id: "test-deposit",
          description: "Test deposit account creation",
          action: "custom_api_call",
          params: {
            method: "POST",
            path: "/v1/deposits",
            body: { type: "demand_deposit", currency: persona.baseCurrency },
          },
          expectedOutcome: { success: true, statusCode: 201 },
        });
        break;

      case "syndication":
        workflow.push({
          id: "test-syndication",
          description: "Test syndicated facility",
          action: "custom_api_call",
          params: {
            method: "POST",
            path: "/v1/facilities",
            body: { type: "syndicated", syndicate_role: "agent" },
          },
          expectedOutcome: { success: true, statusCode: 201 },
        });
        break;

      case "covenants":
        workflow.push(
          {
            id: "create-test-spread",
            description: "Create financial spread for covenant test",
            action: "create_spread",
            params: generateSpreadParams(persona),
            expectedOutcome: { success: true, statusCode: 201 },
          },
          {
            id: "create-test-covenant",
            description: "Create test covenant",
            action: "define_covenant",
            params: generateCovenantParams(persona),
            expectedOutcome: { success: true, statusCode: 201 },
          },
          {
            id: "test-covenant",
            description: "Execute covenant test",
            action: "test_covenant",
            params: {},
            expectedOutcome: { success: true },
          }
        );
        break;

      default:
        // Generic test flow
        break;
    }

    return {
      id: `cap-test-${capability.id}-${persona.id}-${Date.now()}`,
      personaId: persona.id,
      name: `${capability.name} Test for ${persona.name}`,
      description: `Testing capability: ${capability.description}`,
      objective: `Verify ${persona.name} can use ${capability.name}`,
      workflow: applyPersonaParams(workflow, persona),
      capabilitiesUnderTest: [capability.id],
      expectedOutcome: capability.requiredBy.includes(persona.businessModel as any)
        ? "success"
        : "known_limitation",
    };
  }
}

/**
 * LLM-powered agent that uses Claude to generate realistic lending workflows
 */
export class LLMAgent {
  private ruleAgent: RuleBasedAgent;
  private baseUrl: string;

  constructor(private config: AgentConfig) {
    this.ruleAgent = new RuleBasedAgent(config);
    this.baseUrl = "https://api.anthropic.com";
  }

  /**
   * Generate a simulation scenario (synchronous fallback to rule-based)
   */
  generateScenario(persona: Persona): SimulationScenario {
    // Synchronous call falls back to rule-based
    return this.ruleAgent.generateScenario(persona);
  }

  /**
   * Build the system prompt for workflow generation
   */
  private buildSystemPrompt(): string {
    return `You are an expert lending workflow designer. Your task is to generate realistic API workflow scenarios for different types of lending businesses.

You must generate workflows as JSON that use the Open LOS API. Available actions are:
- create_deal: Create a new loan deal (params: borrower_name, jurisdiction, requested_amount, currency, purpose)
- update_deal: Update deal details (params: any deal fields)
- transition_stage: Move deal to next stage (params: to_stage - one of: lead, origination, underwriting, approval, documentation, closing, funded, servicing, closed)
- upload_document: Attach document to deal (params: doc_type, filename, content)
- create_entity: Create borrower/guarantor entity (params: type, name, legal_name, jurisdiction, registration_number)
- create_relationship: Link entity to deal (params: relationship_type, ownership_pct, source_entity_id)
- create_spread: Add financial spreading data (params: period, line_items object with revenue/cogs/operating_expense/interest/tax/depreciation)
- define_covenant: Create covenant (params: name, type, metric, operator, threshold, frequency, grace_period_days)
- test_covenant: Test covenant compliance (params: none, uses covenant_id from previous step)
- create_facility: Create loan facility (params: type, amount, currency, interest_rate, term_months)
- create_loan: Create loan account (params: principal_amount, currency, interest_rate, repayment_frequency, term_months)
- disburse_loan: Disburse funds (params: amount, disbursement_date)
- record_repayment: Record payment (params: amount, payment_date)
- ingest_transactions: Upload bank transactions for monitoring (params: transactions array)
- check_monitoring: Check monitoring status (params: none)
- custom_api_call: Custom API request (params: method, path, body)

Your response must be valid JSON matching this structure:
{
  "name": "scenario name",
  "description": "what this tests",
  "objective": "business goal",
  "workflow": [
    {
      "id": "step-id",
      "description": "what this step does",
      "action": "action_name",
      "params": { ... },
      "expectedOutcome": { "success": true, "statusCode": 201 }
    }
  ]
}

Generate realistic workflows that reflect how the specific lending business would actually operate.`;
  }

  /**
   * Build the user prompt for a specific persona
   */
  private buildUserPrompt(persona: Persona): string {
    return `Generate a realistic lending workflow for this business persona:

**Business:** ${persona.name}
**Type:** ${persona.businessModel}
**Description:** ${persona.description}

**Characteristics:**
- Geographic Scope: ${persona.geographicScope}
- Base Currency: ${persona.baseCurrency}
- Operating Currencies: ${persona.operatingCurrencies.join(", ")}
- Jurisdictions: ${persona.jurisdictions.join(", ")}
- Products: ${persona.products.join(", ")}
- Takes Deposits: ${persona.takesDeposits}
- Typical Deal Size: ${persona.typicalDealSize.min.toLocaleString()} - ${persona.typicalDealSize.max.toLocaleString()} ${persona.typicalDealSize.currency}
- Workflow Complexity: ${persona.workflowComplexity}
- Approval Levels: ${persona.approvalLevels}
- Covenant Complexity: ${persona.covenantComplexity}

**Test Challenges:** ${persona.testChallenges.join(", ")}

Generate a workflow that:
1. Creates a deal appropriate for this business type
2. Sets up the borrower entity and relationships
3. Handles any required financial analysis/spreading (if covenant complexity > none)
4. Tests specific capabilities this business needs
5. Includes ${Math.min(persona.approvalLevels * 3, this.config.maxSteps)} steps maximum

Return ONLY the JSON, no markdown code blocks or explanation.`;
  }

  /**
   * Parse LLM response into a SimulationScenario
   */
  private parseResponse(
    response: string,
    persona: Persona
  ): SimulationScenario | null {
    try {
      // Try to extract JSON from the response
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith("```")) {
        const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          jsonStr = match[1].trim();
        }
      }

      const parsed = JSON.parse(jsonStr);

      // Validate and transform the workflow steps
      const workflow: WorkflowStep[] = (parsed.workflow || []).map(
        (step: any, idx: number) => ({
          id: step.id || `step-${idx}`,
          description: step.description || `Step ${idx + 1}`,
          action: step.action,
          params: step.params || {},
          expectedOutcome: step.expectedOutcome || { success: true },
        })
      );

      return {
        id: `llm-scenario-${persona.id}-${Date.now()}`,
        personaId: persona.id,
        name: parsed.name || `${persona.name} LLM Workflow`,
        description:
          parsed.description || `LLM-generated workflow for ${persona.businessModel}`,
        objective: parsed.objective || `Test ${persona.name} capabilities`,
        workflow,
        capabilitiesUnderTest: this.inferCapabilities(workflow),
        expectedOutcome: "success",
      };
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      return null;
    }
  }

  /**
   * Infer capabilities being tested from workflow steps
   */
  private inferCapabilities(workflow: WorkflowStep[]): string[] {
    const capabilities = new Set<string>();

    for (const step of workflow) {
      switch (step.action) {
        case "create_deal":
        case "update_deal":
          capabilities.add("deal_management");
          break;
        case "transition_stage":
          capabilities.add("workflow");
          break;
        case "create_entity":
        case "create_relationship":
          capabilities.add("entity_management");
          break;
        case "create_spread":
          capabilities.add("financial_analysis");
          break;
        case "define_covenant":
        case "test_covenant":
          capabilities.add("covenant_management");
          break;
        case "create_facility":
        case "create_loan":
        case "disburse_loan":
        case "record_repayment":
          capabilities.add("loan_origination");
          break;
        case "ingest_transactions":
        case "check_monitoring":
          capabilities.add("monitoring");
          break;
        case "upload_document":
          capabilities.add("document_management");
          break;
      }

      // Check for multi-currency
      if (step.params && typeof step.params === "object") {
        const params = step.params as Record<string, unknown>;
        if (params.currency && params.currency !== "USD") {
          capabilities.add("multi_currency");
        }
      }
    }

    return Array.from(capabilities);
  }

  /**
   * Generate scenario asynchronously using Claude API
   */
  async generateScenarioAsync(persona: Persona): Promise<SimulationScenario> {
    if (!this.config.apiKey) {
      console.warn("No API key configured, falling back to rule-based generation");
      return this.generateScenario(persona);
    }

    try {
      const body = {
        model: this.config.model || "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: this.buildSystemPrompt(),
        messages: [
          {
            role: "user",
            content: this.buildUserPrompt(persona),
          },
        ],
      };

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Anthropic API error: ${response.status} - ${error}`);
        return this.generateScenario(persona);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
        usage: { input_tokens: number; output_tokens: number };
      };

      const content = data.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");

      const scenario = this.parseResponse(content, persona);

      if (scenario && scenario.workflow.length > 0) {
        console.log(
          `  [LLM] Generated ${scenario.workflow.length} steps for ${persona.name}`
        );
        return scenario;
      }

      // Fall back to rule-based if parsing failed
      console.warn("LLM response parsing failed, falling back to rule-based");
      return this.generateScenario(persona);
    } catch (error) {
      console.error("LLM generation failed:", error);
      return this.generateScenario(persona);
    }
  }
}

/**
 * Create an agent based on configuration
 */
export function createAgent(config: AgentConfig = DEFAULT_AGENT_CONFIG) {
  if (config.useRuleBased) {
    return new RuleBasedAgent(config);
  }
  return new LLMAgent(config);
}
