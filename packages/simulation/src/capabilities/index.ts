/**
 * Capability Definitions
 *
 * Defines what the Open LOS system should be able to do, mapped to which
 * business models require each capability and how to test them.
 */

import type { Capability } from "../types.js";

export const CAPABILITIES: Capability[] = [
  // ============================================================================
  // DEAL MANAGEMENT
  // ============================================================================
  {
    id: "deal-create-basic",
    name: "Basic Deal Creation",
    description: "Create a deal with core fields (borrower, amount, purpose)",
    category: "deal_management",
    requiredBy: [
      "commercial_bank", "regional_bank", "community_bank", "credit_union",
      "equipment_finance", "asset_based_lender", "factoring_company",
      "online_lender", "bridge_lender", "sba_lender",
    ],
    testScenarios: [
      {
        id: "deal-create-minimal",
        name: "Create deal with minimal fields",
        description: "Create a deal with only required fields",
        steps: [
          "POST /v1/deals with borrower_name",
          "Verify 201 response",
          "Verify deal is in broker stage",
        ],
        expectedOutcome: "Deal created in broker stage",
        failureIndicators: ["4xx/5xx response", "missing deal ID"],
      },
    ],
  },

  {
    id: "deal-custom-fields",
    name: "Custom Deal Fields",
    description: "Support for custom/extended fields on deals",
    category: "deal_management",
    requiredBy: [
      "commercial_bank", "regional_bank", "asset_based_lender",
      "development_bank", "export_credit_agency",
    ],
    testScenarios: [
      {
        id: "deal-custom-fields-create",
        name: "Create deal with custom fields",
        description: "Create a deal with custom_fields object",
        steps: [
          "POST /v1/deals with custom_fields: { industry_code: 'SIC-1234', risk_rating: 'A' }",
          "GET /v1/deals/{id}",
          "Verify custom_fields are preserved",
        ],
        expectedOutcome: "Custom fields stored and retrievable",
        failureIndicators: ["custom_fields not returned", "data corruption"],
      },
    ],
  },

  // ============================================================================
  // CURRENCY & INTERNATIONALIZATION
  // ============================================================================
  {
    id: "multi-currency-deals",
    name: "Multi-Currency Deal Support",
    description: "Create and manage deals in multiple currencies",
    category: "currency",
    requiredBy: [
      "commercial_bank", "trade_finance", "export_credit_agency",
      "development_bank", "multilateral_lender", "correspondent_bank",
    ],
    testScenarios: [
      {
        id: "deal-currency-eur",
        name: "Create EUR denominated deal",
        description: "Create a deal with EUR as the deal currency",
        steps: [
          "POST /v1/deals with requested_amount and currency: EUR",
          "Verify deal stores EUR currency",
          "Verify amounts display correctly",
        ],
        expectedOutcome: "Deal created with EUR currency",
        failureIndicators: ["currency field not supported", "USD default forced"],
      },
      {
        id: "deal-currency-exotic",
        name: "Create deal in emerging market currency",
        description: "Test handling of less common currencies (NGN, KES, VND)",
        steps: [
          "POST /v1/deals with currency: NGN",
          "Verify currency stored correctly",
          "Verify no precision issues",
        ],
        expectedOutcome: "Exotic currency supported",
        failureIndicators: ["currency rejected", "precision errors"],
      },
    ],
  },

  {
    id: "fx-rate-management",
    name: "FX Rate Management",
    description: "Store and use foreign exchange rates for currency conversion",
    category: "currency",
    requiredBy: [
      "trade_finance", "export_credit_agency", "development_bank",
      "multilateral_lender", "factoring_company",
    ],
    testScenarios: [
      {
        id: "fx-rate-store",
        name: "Store FX rates",
        description: "Store exchange rate between currencies",
        steps: [
          "POST /v1/fx-rates with EUR/USD rate",
          "GET /v1/fx-rates/EUR/USD",
          "Verify rate stored with timestamp",
        ],
        expectedOutcome: "FX rate stored and retrievable",
        failureIndicators: ["endpoint not found", "rate not persisted"],
      },
    ],
  },

  {
    id: "multi-currency-facility",
    name: "Multi-Currency Facilities",
    description: "Create facilities that can be drawn in multiple currencies",
    category: "currency",
    requiredBy: [
      "commercial_bank", "trade_finance", "correspondent_bank",
    ],
    testScenarios: [
      {
        id: "facility-multi-ccy",
        name: "Create multi-currency revolving facility",
        description: "Create a facility with multiple available currencies",
        steps: [
          "POST /v1/facilities with available_currencies: [USD, EUR, GBP]",
          "Verify facility created",
          "Attempt draw in EUR",
          "Verify draw in non-base currency works",
        ],
        expectedOutcome: "Facility supports multiple currencies for drawings",
        failureIndicators: ["single currency only", "draw in non-base currency fails"],
      },
    ],
  },

  // ============================================================================
  // MULTI-JURISDICTION
  // ============================================================================
  {
    id: "multi-jurisdiction-deal",
    name: "Multi-Jurisdiction Deal Management",
    description: "Manage deals spanning multiple legal jurisdictions",
    category: "multi_jurisdiction",
    requiredBy: [
      "commercial_bank", "trade_finance", "development_bank",
      "multilateral_lender", "export_credit_agency", "factoring_company",
    ],
    testScenarios: [
      {
        id: "deal-multi-jurisdiction",
        name: "Create deal with multiple jurisdictions",
        description: "Deal with borrower in one jurisdiction, collateral in another",
        steps: [
          "POST /v1/deals with jurisdiction: US",
          "Create entity with jurisdiction: GB",
          "Link entity as guarantor",
          "Verify multi-jurisdiction relationship",
        ],
        expectedOutcome: "Deal supports multiple jurisdictions via entity relationships",
        failureIndicators: ["single jurisdiction forced", "entity linking fails"],
      },
    ],
  },

  {
    id: "cross-border-collateral",
    name: "Cross-Border Collateral Management",
    description: "Manage collateral located in different jurisdictions from the borrower",
    category: "multi_jurisdiction",
    requiredBy: [
      "commercial_bank", "asset_based_lender", "trade_finance",
    ],
    testScenarios: [
      {
        id: "collateral-cross-border",
        name: "Register cross-border collateral",
        description: "Register collateral in a different jurisdiction than the loan",
        steps: [
          "Create deal with US jurisdiction",
          "Create collateral entity in DE",
          "Link collateral to deal",
          "Verify jurisdiction tracking",
        ],
        expectedOutcome: "Collateral jurisdiction tracked separately",
        failureIndicators: ["no collateral jurisdiction field", "linking fails"],
      },
    ],
  },

  // ============================================================================
  // DEPOSIT TAKING
  // ============================================================================
  {
    id: "deposit-accounts",
    name: "Deposit Account Management",
    description: "Create and manage deposit accounts (checking, savings, CDs)",
    category: "deposits",
    requiredBy: [
      "commercial_bank", "regional_bank", "community_bank", "credit_union",
    ],
    testScenarios: [
      {
        id: "deposit-create-demand",
        name: "Create demand deposit account",
        description: "Create a checking/demand deposit account",
        steps: [
          "POST /v1/deposits with type: demand_deposit",
          "Verify account created",
          "Record deposit transaction",
          "Verify balance updated",
        ],
        expectedOutcome: "Deposit account created and functional",
        failureIndicators: ["endpoint not found", "deposit type not supported"],
      },
      {
        id: "deposit-create-term",
        name: "Create term deposit (CD)",
        description: "Create a certificate of deposit with maturity",
        steps: [
          "POST /v1/deposits with type: time_deposit, maturity_date",
          "Verify CD created with maturity",
          "Verify interest accrual logic",
        ],
        expectedOutcome: "Term deposit with maturity tracking",
        failureIndicators: ["term deposits not supported", "no maturity tracking"],
      },
    ],
  },

  {
    id: "deposit-interest-accrual",
    name: "Deposit Interest Accrual",
    description: "Calculate and accrue interest on deposit accounts",
    category: "deposits",
    requiredBy: [
      "commercial_bank", "regional_bank", "community_bank", "credit_union",
    ],
    testScenarios: [
      {
        id: "deposit-interest-calc",
        name: "Calculate deposit interest",
        description: "Accrue interest on savings/term deposits",
        steps: [
          "Create deposit with interest rate",
          "Advance time by 30 days",
          "Trigger interest accrual",
          "Verify interest calculated correctly",
        ],
        expectedOutcome: "Interest accrued per deposit terms",
        failureIndicators: ["no interest accrual", "calculation errors"],
      },
    ],
  },

  // ============================================================================
  // PRODUCTS
  // ============================================================================
  {
    id: "loan-term",
    name: "Term Loan Product",
    description: "Create and manage amortizing term loans",
    category: "products",
    requiredBy: [
      "commercial_bank", "regional_bank", "community_bank", "credit_union",
      "equipment_finance", "sba_lender", "online_lender",
    ],
    testScenarios: [
      {
        id: "loan-term-create",
        name: "Create term loan",
        description: "Create a standard amortizing term loan",
        steps: [
          "POST /v1/loans with product_type: term_loan",
          "Set amortization schedule",
          "Disburse loan",
          "Verify repayment schedule generated",
        ],
        expectedOutcome: "Term loan with amortization schedule",
        failureIndicators: ["no schedule generated", "amortization incorrect"],
      },
    ],
  },

  {
    id: "loan-revolving",
    name: "Revolving Credit Facility",
    description: "Create and manage revolving credit facilities with draws and paydowns",
    category: "products",
    requiredBy: [
      "commercial_bank", "regional_bank", "asset_based_lender",
    ],
    testScenarios: [
      {
        id: "revolver-create",
        name: "Create revolving facility",
        description: "Create a revolving credit line",
        steps: [
          "POST /v1/facilities with type: revolving",
          "Set commitment amount",
          "Record draw",
          "Record paydown",
          "Verify availability recalculates",
        ],
        expectedOutcome: "Revolving facility with draw/paydown tracking",
        failureIndicators: ["availability not tracked", "draws not supported"],
      },
    ],
  },

  {
    id: "loan-loc",
    name: "Line of Credit",
    description: "Create and manage lines of credit",
    category: "products",
    requiredBy: [
      "commercial_bank", "regional_bank", "community_bank", "credit_union",
      "online_lender",
    ],
    testScenarios: [
      {
        id: "loc-create",
        name: "Create line of credit",
        description: "Create a simple line of credit",
        steps: [
          "POST /v1/loans with product_type: line_of_credit",
          "Set credit limit",
          "Verify draws track against limit",
        ],
        expectedOutcome: "LOC with credit limit tracking",
        failureIndicators: ["no limit tracking", "overdraw allowed"],
      },
    ],
  },

  {
    id: "loan-equipment",
    name: "Equipment Finance Products",
    description: "Equipment loans and leases with asset tracking",
    category: "products",
    requiredBy: [
      "equipment_finance", "commercial_bank", "regional_bank",
    ],
    testScenarios: [
      {
        id: "equipment-loan",
        name: "Create equipment loan",
        description: "Create equipment-secured term loan",
        steps: [
          "POST /v1/loans with collateral_type: equipment",
          "Link equipment asset",
          "Verify asset-loan linkage",
        ],
        expectedOutcome: "Equipment loan with asset linkage",
        failureIndicators: ["no asset tracking", "collateral not linked"],
      },
    ],
  },

  {
    id: "loan-construction",
    name: "Construction Loan with Draws",
    description: "Construction loans with draw schedules and inspections",
    category: "products",
    requiredBy: [
      "construction_lender", "commercial_mortgage", "bridge_lender",
    ],
    testScenarios: [
      {
        id: "construction-draws",
        name: "Manage construction draws",
        description: "Request, approve, and fund construction draws",
        steps: [
          "Create construction loan with total commitment",
          "Create draw schedule",
          "Request draw with inspection",
          "Approve and fund draw",
          "Verify holdback tracking",
        ],
        expectedOutcome: "Construction draws with approval workflow",
        failureIndicators: ["no draw schedule", "no approval process"],
      },
    ],
  },

  {
    id: "factoring",
    name: "Invoice Factoring",
    description: "Purchase receivables and manage collections",
    category: "products",
    requiredBy: [
      "factoring_company", "asset_based_lender", "trade_finance",
    ],
    testScenarios: [
      {
        id: "factoring-purchase",
        name: "Purchase invoice",
        description: "Purchase receivable at discount",
        steps: [
          "Create invoice/receivable record",
          "Calculate advance rate and reserve",
          "Fund advance to client",
          "Record collection from debtor",
          "Release reserve minus fees",
        ],
        expectedOutcome: "Complete factoring lifecycle",
        failureIndicators: ["no receivable tracking", "no collection workflow"],
      },
    ],
  },

  {
    id: "letter-of-credit",
    name: "Letter of Credit",
    description: "Issue and manage documentary letters of credit",
    category: "products",
    requiredBy: [
      "trade_finance", "commercial_bank", "export_credit_agency",
    ],
    testScenarios: [
      {
        id: "loc-issuance",
        name: "Issue letter of credit",
        description: "Issue documentary LC with terms",
        steps: [
          "POST /v1/trade-instruments with type: letter_of_credit",
          "Set beneficiary and terms",
          "Track document presentation",
          "Process payment on compliant presentation",
        ],
        expectedOutcome: "LC issuance and document workflow",
        failureIndicators: ["LC type not supported", "no document tracking"],
      },
    ],
  },

  // ============================================================================
  // SYNDICATION
  // ============================================================================
  {
    id: "syndication-basic",
    name: "Basic Loan Syndication",
    description: "Create syndicated loans with multiple lenders",
    category: "syndication",
    requiredBy: [
      "commercial_bank", "development_bank", "export_credit_agency",
    ],
    testScenarios: [
      {
        id: "syndicate-create",
        name: "Create syndicated facility",
        description: "Create a loan with multiple participant lenders",
        steps: [
          "Create facility with agent bank",
          "Add participant lenders with commitments",
          "Verify total commitment = sum of participants",
          "Distribute draw pro-rata",
        ],
        expectedOutcome: "Multi-lender facility with pro-rata distribution",
        failureIndicators: ["single lender only", "no participant tracking"],
      },
    ],
  },

  {
    id: "syndication-voting",
    name: "Syndicate Voting & Amendments",
    description: "Manage lender voting on amendments and waivers",
    category: "syndication",
    requiredBy: [
      "commercial_bank",
    ],
    testScenarios: [
      {
        id: "syndicate-amendment",
        name: "Process syndicate amendment",
        description: "Propose amendment and collect lender votes",
        steps: [
          "Create amendment request",
          "Distribute to lenders",
          "Collect votes with thresholds",
          "Determine if amendment passes",
        ],
        expectedOutcome: "Amendment voting workflow",
        failureIndicators: ["no voting mechanism", "no threshold logic"],
      },
    ],
  },

  // ============================================================================
  // COVENANTS
  // ============================================================================
  {
    id: "covenant-financial",
    name: "Financial Covenant Tracking",
    description: "Define and test financial covenants",
    category: "covenants",
    requiredBy: [
      "commercial_bank", "regional_bank", "asset_based_lender",
      "commercial_mortgage", "development_bank",
    ],
    testScenarios: [
      {
        id: "covenant-leverage",
        name: "Test leverage covenant",
        description: "Define and test debt/EBITDA covenant",
        steps: [
          "Create deal with financial spread",
          "Define leverage covenant: Debt/EBITDA <= 3.5x",
          "Test covenant against spread data",
          "Verify pass/fail determination",
        ],
        expectedOutcome: "Covenant tested accurately",
        failureIndicators: ["calculation error", "wrong pass/fail"],
      },
    ],
  },

  {
    id: "covenant-borrowing-base",
    name: "Borrowing Base Covenant",
    description: "Calculate availability based on collateral borrowing base",
    category: "covenants",
    requiredBy: [
      "asset_based_lender", "factoring_company",
    ],
    testScenarios: [
      {
        id: "borrowing-base-calc",
        name: "Calculate borrowing base",
        description: "Calculate availability from AR and inventory",
        steps: [
          "Define advance rates (85% AR, 50% inventory)",
          "Input eligible collateral values",
          "Calculate borrowing base",
          "Compare to outstandings",
          "Determine over/under advance",
        ],
        expectedOutcome: "Accurate borrowing base calculation",
        failureIndicators: ["calculation errors", "no eligibility tracking"],
      },
    ],
  },

  // ============================================================================
  // MONITORING
  // ============================================================================
  {
    id: "monitoring-liquidity",
    name: "Liquidity Monitoring",
    description: "Track borrower liquidity and cash flow",
    category: "monitoring",
    requiredBy: [
      "commercial_bank", "regional_bank", "asset_based_lender",
      "online_lender",
    ],
    testScenarios: [
      {
        id: "liquidity-tracking",
        name: "Track borrower liquidity",
        description: "Monitor bank account balances and runway",
        steps: [
          "Ingest bank transactions",
          "Calculate average daily balance",
          "Calculate burn rate",
          "Calculate runway months",
          "Generate alert if runway < threshold",
        ],
        expectedOutcome: "Liquidity tracked with alerts",
        failureIndicators: ["no transaction ingestion", "no runway calculation"],
      },
    ],
  },

  {
    id: "monitoring-alerts",
    name: "Alert Generation",
    description: "Generate alerts for covenant breaches, payment misses, etc.",
    category: "monitoring",
    requiredBy: [
      "commercial_bank", "regional_bank", "asset_based_lender",
      "commercial_mortgage", "online_lender",
    ],
    testScenarios: [
      {
        id: "alert-covenant",
        name: "Generate covenant breach alert",
        description: "Create alert when covenant fails",
        steps: [
          "Set covenant threshold",
          "Test covenant with failing value",
          "Verify alert generated",
          "Verify alert severity correct",
        ],
        expectedOutcome: "Alert created on covenant breach",
        failureIndicators: ["no alert generated", "wrong severity"],
      },
    ],
  },

  // ============================================================================
  // COMPLIANCE & REPORTING
  // ============================================================================
  {
    id: "audit-trail",
    name: "Immutable Audit Trail",
    description: "Maintain immutable audit log of all changes",
    category: "compliance",
    requiredBy: [
      "commercial_bank", "regional_bank", "community_bank", "credit_union",
      "development_bank", "export_credit_agency",
    ],
    testScenarios: [
      {
        id: "audit-immutable",
        name: "Verify audit immutability",
        description: "Verify audit records cannot be modified",
        steps: [
          "Create deal",
          "Update deal",
          "Retrieve audit trail",
          "Verify all events logged",
          "Attempt to modify audit (should fail)",
        ],
        expectedOutcome: "Complete immutable audit trail",
        failureIndicators: ["missing events", "audit modifiable"],
      },
    ],
  },

  {
    id: "regulatory-reporting",
    name: "Regulatory Reporting",
    description: "Generate regulatory reports (CCAR, DFAST, call reports)",
    category: "compliance",
    requiredBy: [
      "commercial_bank", "regional_bank",
    ],
    testScenarios: [
      {
        id: "report-call",
        name: "Generate call report data",
        description: "Extract data for regulatory call report",
        steps: [
          "Create portfolio of loans",
          "Request call report extract",
          "Verify required fields present",
          "Verify aggregations correct",
        ],
        expectedOutcome: "Regulatory data extraction",
        failureIndicators: ["endpoint not found", "missing required fields"],
      },
    ],
  },

  // ============================================================================
  // INTEGRATIONS
  // ============================================================================
  {
    id: "integration-core-banking",
    name: "Core Banking Integration",
    description: "Integrate with core banking systems for GL, payments",
    category: "integrations",
    requiredBy: [
      "commercial_bank", "regional_bank", "community_bank", "credit_union",
    ],
    testScenarios: [
      {
        id: "gl-posting",
        name: "Post to general ledger",
        description: "Create GL journal entries for loan events",
        steps: [
          "Disburse loan",
          "Verify GL entry generated",
          "Verify debit/credit balanced",
        ],
        expectedOutcome: "GL entries created automatically",
        failureIndicators: ["no GL integration", "unbalanced entries"],
      },
    ],
  },

  {
    id: "integration-open-banking",
    name: "Open Banking Integration",
    description: "Connect to borrower bank accounts via open banking APIs",
    category: "integrations",
    requiredBy: [
      "online_lender", "revenue_based_finance", "embedded_finance",
    ],
    testScenarios: [
      {
        id: "open-banking-connect",
        name: "Connect borrower bank account",
        description: "Link borrower bank account for transaction monitoring",
        steps: [
          "Initiate bank connection",
          "Store access credentials",
          "Fetch transactions",
          "Verify transactions ingested",
        ],
        expectedOutcome: "Bank account connected and syncing",
        failureIndicators: ["no open banking support", "sync failures"],
      },
    ],
  },

  // ============================================================================
  // AUTOMATION
  // ============================================================================
  {
    id: "automation-decisioning",
    name: "Automated Credit Decisioning",
    description: "Automated approval/decline based on rules",
    category: "automation",
    requiredBy: [
      "online_lender", "revenue_based_finance", "merchant_cash_advance",
      "embedded_finance",
    ],
    testScenarios: [
      {
        id: "auto-approve",
        name: "Auto-approve qualifying deal",
        description: "Automatically approve deal meeting criteria",
        steps: [
          "Define approval rules",
          "Submit deal meeting criteria",
          "Verify instant approval",
          "Verify no human intervention required",
        ],
        expectedOutcome: "Instant automated approval",
        failureIndicators: ["requires human review", "no rules engine"],
      },
    ],
  },

  {
    id: "automation-high-volume",
    name: "High Volume Processing",
    description: "Handle thousands of deals per day efficiently",
    category: "automation",
    requiredBy: [
      "merchant_cash_advance", "microfinance", "marketplace_lender",
    ],
    testScenarios: [
      {
        id: "high-volume-load",
        name: "Process high volume batch",
        description: "Process 1000 deals in batch",
        steps: [
          "Submit batch of 1000 deals",
          "Verify all processed",
          "Verify response time acceptable",
          "Verify no data corruption",
        ],
        expectedOutcome: "1000 deals processed in < 60 seconds",
        failureIndicators: ["timeout", "data corruption", "partial processing"],
      },
    ],
  },
];

/**
 * Get all capabilities
 */
export function getAllCapabilities(): Capability[] {
  return CAPABILITIES;
}

/**
 * Get capabilities required by a specific business model
 */
export function getCapabilitiesForBusinessModel(model: string): Capability[] {
  return CAPABILITIES.filter(c =>
    c.requiredBy.includes(model as any)
  );
}

/**
 * Get capabilities by category
 */
export function getCapabilitiesByCategory(category: Capability["category"]): Capability[] {
  return CAPABILITIES.filter(c => c.category === category);
}

/**
 * Get capability by ID
 */
export function getCapabilityById(id: string): Capability | undefined {
  return CAPABILITIES.find(c => c.id === id);
}
