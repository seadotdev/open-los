/**
 * Lending Business Simulation Suite Types
 *
 * This module defines the type system for simulating hundreds of different
 * lending businesses to stress-test the Open LOS platform capabilities.
 */

import { z } from "zod";

// ============================================================================
// BUSINESS PERSONA DEFINITIONS
// ============================================================================

/**
 * Primary business model of the lending institution
 */
export const BusinessModelSchema = z.enum([
  // Traditional lending
  "commercial_bank",
  "regional_bank",
  "community_bank",
  "credit_union",

  // Specialized lenders
  "equipment_finance",
  "asset_based_lender",
  "factoring_company",
  "invoice_finance",
  "trade_finance",
  "supply_chain_finance",

  // Real estate
  "commercial_mortgage",
  "construction_lender",
  "bridge_lender",
  "hard_money_lender",
  "reit_lender",

  // SMB & Consumer crossover
  "sba_lender",
  "community_development_fi",
  "cdfi",
  "microfinance",

  // Alternative & Fintech
  "online_lender",
  "marketplace_lender",
  "revenue_based_finance",
  "merchant_cash_advance",
  "embedded_finance",
  "bnpl_business",

  // Specialty
  "agricultural_lender",
  "healthcare_finance",
  "franchise_finance",
  "transportation_finance",
  "energy_finance",
  "project_finance",

  // International
  "export_credit_agency",
  "development_bank",
  "multilateral_lender",
  "correspondent_bank",
]);

export type BusinessModel = z.infer<typeof BusinessModelSchema>;

/**
 * Geographic scope of operations
 */
export const GeographicScopeSchema = z.enum([
  "local",           // Single city/metro
  "regional",        // Multi-state/province
  "national",        // Single country
  "cross_border",    // 2-5 countries
  "multinational",   // 5+ countries
  "global",          // Worldwide operations
]);

export type GeographicScope = z.infer<typeof GeographicScopeSchema>;

/**
 * Regulatory environment
 */
export const RegulatoryRegimeSchema = z.enum([
  "us_occ",          // US Office of Comptroller
  "us_fdic",         // US FDIC regulated
  "us_state",        // US state-chartered
  "uk_fca",          // UK Financial Conduct Authority
  "uk_pra",          // UK Prudential Regulation Authority
  "eu_ecb",          // EU ECB supervised
  "eu_national",     // EU national regulator
  "swiss_finma",     // Swiss FINMA
  "singapore_mas",   // Singapore MAS
  "hk_hkma",         // Hong Kong HKMA
  "japan_fsa",       // Japan FSA
  "australia_apra",  // Australia APRA
  "unregulated",     // Non-bank/unregulated
  "multi_jurisdiction", // Multiple regulators
]);

export type RegulatoryRegime = z.infer<typeof RegulatoryRegimeSchema>;

/**
 * Currencies the business operates with
 */
export const CurrencySchema = z.enum([
  "USD", "EUR", "GBP", "CHF", "JPY", "CNY", "HKD", "SGD", "AUD", "CAD",
  "INR", "BRL", "MXN", "ZAR", "AED", "SAR", "KRW", "TWD", "THB", "IDR",
  "PHP", "VND", "MYR", "NZD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF",
  "TRY", "RUB", "ILS", "NGN", "KES", "EGP", "PKR", "BDT", "LKR", "CLP",
  "COP", "PEN", "ARS", "GHS", "TZS", "UGX", "RWF", "ETB",
]);

export type Currency = z.infer<typeof CurrencySchema>;

/**
 * Products the lender offers
 */
export const ProductTypeSchema = z.enum([
  // Term loans
  "term_loan",
  "amortizing_loan",
  "bullet_loan",
  "balloon_loan",

  // Revolving
  "revolving_credit",
  "line_of_credit",
  "overdraft",

  // Asset-based
  "abl_revolver",
  "inventory_finance",
  "equipment_loan",
  "equipment_lease",
  "vehicle_finance",

  // Receivables
  "factoring",
  "invoice_discounting",
  "supply_chain_finance",
  "reverse_factoring",

  // Real estate
  "commercial_mortgage",
  "construction_loan",
  "bridge_loan",
  "mezzanine_debt",

  // Trade
  "letter_of_credit",
  "bank_guarantee",
  "trade_loan",
  "export_finance",

  // Specialty
  "project_finance",
  "leveraged_loan",
  "syndicated_loan",
  "club_deal",

  // Deposits (if bank)
  "demand_deposit",
  "time_deposit",
  "certificate_of_deposit",
]);

export type ProductType = z.infer<typeof ProductTypeSchema>;

/**
 * Business persona - represents a hypothetical lending business
 */
export const PersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),

  // Business characteristics
  businessModel: BusinessModelSchema,
  geographicScope: GeographicScopeSchema,
  regulatoryRegime: RegulatoryRegimeSchema,

  // Operational parameters
  baseCurrency: CurrencySchema,
  operatingCurrencies: z.array(CurrencySchema),
  jurisdictions: z.array(z.string()), // ISO country codes

  // Product mix
  products: z.array(ProductTypeSchema),
  takesDeposits: z.boolean(),

  // Scale indicators
  typicalDealSize: z.object({
    min: z.number(),
    max: z.number(),
    currency: CurrencySchema,
  }),
  annualOriginations: z.object({
    dealCount: z.number(),
    volume: z.number(),
    currency: CurrencySchema,
  }),
  portfolioSize: z.object({
    dealCount: z.number(),
    outstandings: z.number(),
    currency: CurrencySchema,
  }),

  // Process preferences
  workflowComplexity: z.enum(["simple", "standard", "complex", "enterprise"]),
  approvalLevels: z.number().min(1).max(10),
  covenantComplexity: z.enum(["none", "basic", "standard", "complex"]),

  // Integration requirements
  requiredIntegrations: z.array(z.string()),

  // Specific challenges this persona tests
  testChallenges: z.array(z.string()),

  // Metadata
  category: z.string(),
  tags: z.array(z.string()),
});

export type Persona = z.infer<typeof PersonaSchema>;

// ============================================================================
// CAPABILITY DEFINITIONS
// ============================================================================

/**
 * A capability represents something the system should be able to do
 */
export const CapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum([
    "deal_management",
    "workflow",
    "currency",
    "multi_jurisdiction",
    "products",
    "covenants",
    "monitoring",
    "compliance",
    "integrations",
    "reporting",
    "deposits",
    "syndication",
    "automation",
  ]),

  // What business models need this capability
  requiredBy: z.array(BusinessModelSchema),

  // Test scenarios for this capability
  testScenarios: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    steps: z.array(z.string()),
    expectedOutcome: z.string(),
    failureIndicators: z.array(z.string()),
  })),
});

export type Capability = z.infer<typeof CapabilitySchema>;

// ============================================================================
// SIMULATION EXECUTION
// ============================================================================

/**
 * A workflow step the agent attempts to execute
 */
export const WorkflowStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  action: z.enum([
    "create_deal",
    "update_deal",
    "transition_stage",
    "upload_document",
    "create_entity",
    "create_relationship",
    "create_spread",
    "define_covenant",
    "test_covenant",
    "create_facility",
    "create_loan",
    "approve_loan",
    "disburse_loan",
    "record_repayment",
    "ingest_transactions",
    "check_monitoring",
    "create_alert",
    "request_approval",
    "custom_api_call",
  ]),
  params: z.record(z.unknown()),
  expectedOutcome: z.object({
    success: z.boolean(),
    statusCode: z.number().optional(),
    errorType: z.string().optional(),
  }),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/**
 * Result of executing a workflow step
 */
export const StepResultSchema = z.object({
  stepId: z.string(),
  success: z.boolean(),
  statusCode: z.number().optional(),
  response: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }).optional(),
  duration: z.number(), // ms
  timestamp: z.string(),

  // Gap analysis
  capabilityGap: z.object({
    detected: z.boolean(),
    capabilityId: z.string().optional(),
    description: z.string().optional(),
    severity: z.enum(["blocker", "major", "minor", "enhancement"]).optional(),
  }).optional(),
});

export type StepResult = z.infer<typeof StepResultSchema>;

/**
 * A simulation scenario combines a persona with workflow goals
 */
export const SimulationScenarioSchema = z.object({
  id: z.string(),
  personaId: z.string(),
  name: z.string(),
  description: z.string(),

  // What the business is trying to accomplish
  objective: z.string(),

  // Workflow steps (can be generated by AI agent or predefined)
  workflow: z.array(WorkflowStepSchema),

  // Capabilities being tested
  capabilitiesUnderTest: z.array(z.string()),

  // Expected vs actual outcome tracking
  expectedOutcome: z.enum(["success", "partial_success", "known_limitation", "failure"]),
});

export type SimulationScenario = z.infer<typeof SimulationScenarioSchema>;

/**
 * Result of running a complete simulation
 */
export const SimulationResultSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  personaId: z.string(),

  // Execution metadata
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number(),

  // Results
  overallSuccess: z.boolean(),
  stepResults: z.array(StepResultSchema),

  // Analysis
  capabilityGaps: z.array(z.object({
    capabilityId: z.string(),
    description: z.string(),
    severity: z.enum(["blocker", "major", "minor", "enhancement"]),
    affectedSteps: z.array(z.string()),
    recommendation: z.string(),
  })),

  // Summary
  summary: z.object({
    totalSteps: z.number(),
    successfulSteps: z.number(),
    failedSteps: z.number(),
    blockerGaps: z.number(),
    majorGaps: z.number(),
    minorGaps: z.number(),
  }),
});

export type SimulationResult = z.infer<typeof SimulationResultSchema>;

// ============================================================================
// AGGREGATE REPORTING
// ============================================================================

/**
 * Aggregate report across all simulations
 */
export const SimulationSuiteReportSchema = z.object({
  runId: z.string(),
  runAt: z.string(),

  // Coverage
  personasSimulated: z.number(),
  scenariosRun: z.number(),
  totalSteps: z.number(),

  // Results summary
  successRate: z.number(),
  partialSuccessRate: z.number(),
  failureRate: z.number(),

  // Gap analysis
  uniqueCapabilityGaps: z.array(z.object({
    capabilityId: z.string(),
    description: z.string(),
    severity: z.enum(["blocker", "major", "minor", "enhancement"]),
    affectedPersonas: z.array(z.string()),
    occurrences: z.number(),
    priorityScore: z.number(), // Based on severity * occurrences * persona importance
  })),

  // By category
  resultsByBusinessModel: z.record(z.object({
    total: z.number(),
    successful: z.number(),
    failed: z.number(),
    gaps: z.array(z.string()),
  })),

  resultsByCapabilityCategory: z.record(z.object({
    tested: z.number(),
    passed: z.number(),
    failed: z.number(),
    notSupported: z.number(),
  })),

  // Recommendations
  topPriorityImprovements: z.array(z.object({
    rank: z.number(),
    capabilityGap: z.string(),
    businessImpact: z.string(),
    estimatedEffort: z.enum(["small", "medium", "large", "xlarge"]),
    affectedBusinessModels: z.array(z.string()),
  })),

  // Individual results
  results: z.array(SimulationResultSchema),
});

export type SimulationSuiteReport = z.infer<typeof SimulationSuiteReportSchema>;
