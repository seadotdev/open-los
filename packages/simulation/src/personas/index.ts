/**
 * Persona Library
 *
 * Generates 100+ diverse lending business personas for simulation testing.
 * Each persona represents a different type of lending institution with unique
 * characteristics, requirements, and potential edge cases.
 */

import type { Persona, BusinessModel, Currency, ProductType, GeographicScope } from "../types.js";

// ============================================================================
// PREDEFINED PERSONA ARCHETYPES
// ============================================================================

/**
 * Core archetype definitions - these are manually crafted to cover
 * the most important business models and edge cases
 */
export const CORE_ARCHETYPES: Persona[] = [
  // -------------------------------------------------------------------------
  // TRADITIONAL BANKS
  // -------------------------------------------------------------------------
  {
    id: "us-regional-bank-midwest",
    name: "Heartland Regional Bank",
    description: "Mid-sized regional bank in the US Midwest focusing on commercial and agricultural lending",
    businessModel: "regional_bank",
    geographicScope: "regional",
    regulatoryRegime: "us_fdic",
    baseCurrency: "USD",
    operatingCurrencies: ["USD"],
    jurisdictions: ["US"],
    products: ["term_loan", "revolving_credit", "line_of_credit", "commercial_mortgage", "equipment_loan", "demand_deposit", "time_deposit"],
    takesDeposits: true,
    typicalDealSize: { min: 500_000, max: 25_000_000, currency: "USD" },
    annualOriginations: { dealCount: 450, volume: 800_000_000, currency: "USD" },
    portfolioSize: { dealCount: 2_200, outstandings: 4_500_000_000, currency: "USD" },
    workflowComplexity: "standard",
    approvalLevels: 4,
    covenantComplexity: "standard",
    requiredIntegrations: ["core_banking", "credit_bureau", "loan_review"],
    testChallenges: ["deposit_taking", "regulatory_reporting", "agriculture_seasonality"],
    category: "traditional_bank",
    tags: ["deposits", "agricultural", "commercial", "regulated"],
  },

  {
    id: "uk-challenger-bank",
    name: "Sterling Digital Bank",
    description: "UK challenger bank with digital-first approach to SME lending",
    businessModel: "online_lender",
    geographicScope: "national",
    regulatoryRegime: "uk_fca",
    baseCurrency: "GBP",
    operatingCurrencies: ["GBP", "EUR"],
    jurisdictions: ["GB"],
    products: ["term_loan", "revolving_credit", "invoice_discounting", "demand_deposit"],
    takesDeposits: true,
    typicalDealSize: { min: 25_000, max: 2_000_000, currency: "GBP" },
    annualOriginations: { dealCount: 3_500, volume: 450_000_000, currency: "GBP" },
    portfolioSize: { dealCount: 8_200, outstandings: 1_200_000_000, currency: "GBP" },
    workflowComplexity: "simple",
    approvalLevels: 2,
    covenantComplexity: "basic",
    requiredIntegrations: ["open_banking", "companies_house", "credit_bureau_uk"],
    testChallenges: ["high_volume_automation", "multi_currency_deposits", "real_time_decisions"],
    category: "fintech_bank",
    tags: ["deposits", "digital", "sme", "high_volume"],
  },

  {
    id: "swiss-private-bank",
    name: "Zurich Wealth & Lombard",
    description: "Swiss private bank offering lombard lending against securities portfolios",
    businessModel: "commercial_bank",
    geographicScope: "multinational",
    regulatoryRegime: "swiss_finma",
    baseCurrency: "CHF",
    operatingCurrencies: ["CHF", "EUR", "USD", "GBP"],
    jurisdictions: ["CH", "LI", "LU", "SG", "HK"],
    products: ["line_of_credit", "term_loan", "bridge_loan", "demand_deposit", "time_deposit"],
    takesDeposits: true,
    typicalDealSize: { min: 5_000_000, max: 500_000_000, currency: "CHF" },
    annualOriginations: { dealCount: 180, volume: 2_500_000_000, currency: "CHF" },
    portfolioSize: { dealCount: 850, outstandings: 12_000_000_000, currency: "CHF" },
    workflowComplexity: "complex",
    approvalLevels: 5,
    covenantComplexity: "complex",
    requiredIntegrations: ["custody_systems", "portfolio_management", "kyc_aml"],
    testChallenges: ["multi_currency", "multi_jurisdiction", "collateral_valuation", "complex_entities"],
    category: "private_bank",
    tags: ["deposits", "wealth", "lombard", "multi_currency", "complex_structures"],
  },

  // -------------------------------------------------------------------------
  // MULTINATIONAL CORPORATE BANKING
  // -------------------------------------------------------------------------
  {
    id: "global-corporate-bank",
    name: "GlobalCorp Financial",
    description: "Tier 1 global bank corporate lending division serving Fortune 500 companies",
    businessModel: "commercial_bank",
    geographicScope: "global",
    regulatoryRegime: "multi_jurisdiction",
    baseCurrency: "USD",
    operatingCurrencies: ["USD", "EUR", "GBP", "JPY", "CHF", "HKD", "SGD", "AUD", "CAD"],
    jurisdictions: ["US", "GB", "DE", "FR", "JP", "HK", "SG", "AU", "CA", "CH"],
    products: ["syndicated_loan", "revolving_credit", "term_loan", "letter_of_credit", "bank_guarantee", "project_finance"],
    takesDeposits: true,
    typicalDealSize: { min: 50_000_000, max: 5_000_000_000, currency: "USD" },
    annualOriginations: { dealCount: 120, volume: 45_000_000_000, currency: "USD" },
    portfolioSize: { dealCount: 380, outstandings: 95_000_000_000, currency: "USD" },
    workflowComplexity: "enterprise",
    approvalLevels: 8,
    covenantComplexity: "complex",
    requiredIntegrations: ["loan_iq", "bloomberg", "reuters", "swift", "clearstream"],
    testChallenges: ["syndication", "multi_currency_facilities", "cross_border_collateral", "complex_covenant_packages", "regulatory_capital"],
    category: "global_bank",
    tags: ["deposits", "syndication", "global", "enterprise", "complex_structures"],
  },

  {
    id: "asian-trade-bank",
    name: "Pan-Asia Trade Finance Bank",
    description: "Regional trade finance specialist connecting Asian exporters with global markets",
    businessModel: "trade_finance",
    geographicScope: "cross_border",
    regulatoryRegime: "singapore_mas",
    baseCurrency: "SGD",
    operatingCurrencies: ["SGD", "USD", "CNY", "HKD", "JPY", "KRW", "TWD", "THB", "MYR", "IDR", "VND", "PHP"],
    jurisdictions: ["SG", "CN", "HK", "JP", "KR", "TW", "TH", "MY", "ID", "VN", "PH"],
    products: ["letter_of_credit", "trade_loan", "export_finance", "supply_chain_finance", "bank_guarantee", "factoring"],
    takesDeposits: true,
    typicalDealSize: { min: 100_000, max: 50_000_000, currency: "USD" },
    annualOriginations: { dealCount: 8_500, volume: 12_000_000_000, currency: "USD" },
    portfolioSize: { dealCount: 4_200, outstandings: 8_500_000_000, currency: "USD" },
    workflowComplexity: "complex",
    approvalLevels: 4,
    covenantComplexity: "standard",
    requiredIntegrations: ["swift", "bolero", "trade_trust", "customs_systems"],
    testChallenges: ["12_currencies", "trade_documentation", "cross_border_settlement", "fx_risk_management"],
    category: "trade_finance",
    tags: ["deposits", "trade", "multi_currency", "asia_pacific", "high_volume"],
  },

  // -------------------------------------------------------------------------
  // SPECIALIZED LENDERS (NON-BANK)
  // -------------------------------------------------------------------------
  {
    id: "us-abl-lender",
    name: "Capital Asset Partners",
    description: "Asset-based lender specializing in revolving credit against inventory and receivables",
    businessModel: "asset_based_lender",
    geographicScope: "national",
    regulatoryRegime: "unregulated",
    baseCurrency: "USD",
    operatingCurrencies: ["USD", "CAD"],
    jurisdictions: ["US", "CA"],
    products: ["abl_revolver", "inventory_finance", "factoring", "term_loan"],
    takesDeposits: false,
    typicalDealSize: { min: 5_000_000, max: 150_000_000, currency: "USD" },
    annualOriginations: { dealCount: 85, volume: 2_800_000_000, currency: "USD" },
    portfolioSize: { dealCount: 210, outstandings: 4_200_000_000, currency: "USD" },
    workflowComplexity: "complex",
    approvalLevels: 4,
    covenantComplexity: "complex",
    requiredIntegrations: ["field_exam_software", "appraisal_systems", "borrowing_base_calculator"],
    testChallenges: ["borrowing_base_calculations", "collateral_monitoring", "field_exam_scheduling", "availability_calculations"],
    category: "specialty_finance",
    tags: ["abl", "collateral_heavy", "monitoring_intensive"],
  },

  {
    id: "eu-factoring-company",
    name: "EuroFactor Solutions",
    description: "Pan-European factoring company providing invoice finance across EU markets",
    businessModel: "factoring_company",
    geographicScope: "cross_border",
    regulatoryRegime: "eu_national",
    baseCurrency: "EUR",
    operatingCurrencies: ["EUR", "GBP", "PLN", "CZK", "HUF", "SEK", "DKK", "NOK", "CHF"],
    jurisdictions: ["DE", "FR", "NL", "BE", "IT", "ES", "PL", "CZ", "HU", "SE", "DK", "NO", "AT"],
    products: ["factoring", "invoice_discounting", "reverse_factoring", "supply_chain_finance"],
    takesDeposits: false,
    typicalDealSize: { min: 500_000, max: 50_000_000, currency: "EUR" },
    annualOriginations: { dealCount: 420, volume: 3_200_000_000, currency: "EUR" },
    portfolioSize: { dealCount: 890, outstandings: 2_100_000_000, currency: "EUR" },
    workflowComplexity: "standard",
    approvalLevels: 3,
    covenantComplexity: "basic",
    requiredIntegrations: ["credit_insurance", "debtor_management", "collections"],
    testChallenges: ["multi_currency_receivables", "cross_border_assignment", "debtor_concentration", "dilution_tracking"],
    category: "receivables_finance",
    tags: ["factoring", "multi_currency", "high_volume", "europe"],
  },

  {
    id: "uk-equipment-finance",
    name: "Industrial Leasing Group",
    description: "Equipment finance company providing leases and loans for manufacturing equipment",
    businessModel: "equipment_finance",
    geographicScope: "national",
    regulatoryRegime: "uk_fca",
    baseCurrency: "GBP",
    operatingCurrencies: ["GBP", "EUR"],
    jurisdictions: ["GB", "IE"],
    products: ["equipment_loan", "equipment_lease", "term_loan"],
    takesDeposits: false,
    typicalDealSize: { min: 50_000, max: 10_000_000, currency: "GBP" },
    annualOriginations: { dealCount: 1_200, volume: 480_000_000, currency: "GBP" },
    portfolioSize: { dealCount: 4_500, outstandings: 950_000_000, currency: "GBP" },
    workflowComplexity: "simple",
    approvalLevels: 2,
    covenantComplexity: "none",
    requiredIntegrations: ["asset_registry", "depreciation_calculator", "residual_value_guide"],
    testChallenges: ["lease_vs_loan_accounting", "residual_value_risk", "asset_lifecycle"],
    category: "equipment_finance",
    tags: ["leasing", "asset_finance", "manufacturing"],
  },

  // -------------------------------------------------------------------------
  // REAL ESTATE LENDERS
  // -------------------------------------------------------------------------
  {
    id: "us-cre-lender",
    name: "Metropolitan Property Finance",
    description: "Commercial real estate lender focused on office, retail, and multifamily properties",
    businessModel: "commercial_mortgage",
    geographicScope: "national",
    regulatoryRegime: "unregulated",
    baseCurrency: "USD",
    operatingCurrencies: ["USD"],
    jurisdictions: ["US"],
    products: ["commercial_mortgage", "bridge_loan", "mezzanine_debt", "construction_loan"],
    takesDeposits: false,
    typicalDealSize: { min: 10_000_000, max: 250_000_000, currency: "USD" },
    annualOriginations: { dealCount: 65, volume: 3_800_000_000, currency: "USD" },
    portfolioSize: { dealCount: 185, outstandings: 8_200_000_000, currency: "USD" },
    workflowComplexity: "complex",
    approvalLevels: 5,
    covenantComplexity: "complex",
    requiredIntegrations: ["appraisal_management", "property_management", "rent_roll_analysis"],
    testChallenges: ["property_valuation", "dscr_calculations", "tenant_analysis", "construction_draws"],
    category: "real_estate",
    tags: ["cre", "property", "collateral_heavy"],
  },

  {
    id: "uk-development-finance",
    name: "BuildBritain Finance",
    description: "Construction and development finance lender for UK residential developers",
    businessModel: "construction_lender",
    geographicScope: "national",
    regulatoryRegime: "uk_fca",
    baseCurrency: "GBP",
    operatingCurrencies: ["GBP"],
    jurisdictions: ["GB"],
    products: ["construction_loan", "bridge_loan", "mezzanine_debt"],
    takesDeposits: false,
    typicalDealSize: { min: 2_000_000, max: 75_000_000, currency: "GBP" },
    annualOriginations: { dealCount: 95, volume: 850_000_000, currency: "GBP" },
    portfolioSize: { dealCount: 140, outstandings: 1_100_000_000, currency: "GBP" },
    workflowComplexity: "complex",
    approvalLevels: 4,
    covenantComplexity: "complex",
    requiredIntegrations: ["monitoring_surveyor", "draw_management", "quantity_surveyor"],
    testChallenges: ["construction_progress_monitoring", "draw_schedule_management", "cost_overrun_tracking", "completion_guarantees"],
    category: "real_estate",
    tags: ["construction", "development", "draws", "uk"],
  },

  {
    id: "us-bridge-lender",
    name: "QuickBridge Capital",
    description: "Private bridge lender providing fast-close financing for real estate transactions",
    businessModel: "bridge_lender",
    geographicScope: "national",
    regulatoryRegime: "unregulated",
    baseCurrency: "USD",
    operatingCurrencies: ["USD"],
    jurisdictions: ["US"],
    products: ["bridge_loan", "commercial_mortgage"],
    takesDeposits: false,
    typicalDealSize: { min: 1_000_000, max: 25_000_000, currency: "USD" },
    annualOriginations: { dealCount: 280, volume: 1_400_000_000, currency: "USD" },
    portfolioSize: { dealCount: 320, outstandings: 1_800_000_000, currency: "USD" },
    workflowComplexity: "simple",
    approvalLevels: 2,
    covenantComplexity: "basic",
    requiredIntegrations: ["title_company", "appraisal", "closing_attorney"],
    testChallenges: ["fast_turnaround", "simplified_underwriting", "high_rate_structures"],
    category: "real_estate",
    tags: ["bridge", "fast_close", "private_credit"],
  },

  // -------------------------------------------------------------------------
  // FINTECH / ALTERNATIVE LENDERS
  // -------------------------------------------------------------------------
  {
    id: "us-revenue-based-finance",
    name: "GrowthCap Ventures",
    description: "Revenue-based financing for SaaS and recurring revenue businesses",
    businessModel: "revenue_based_finance",
    geographicScope: "national",
    regulatoryRegime: "unregulated",
    baseCurrency: "USD",
    operatingCurrencies: ["USD"],
    jurisdictions: ["US"],
    products: ["term_loan", "line_of_credit"],
    takesDeposits: false,
    typicalDealSize: { min: 100_000, max: 5_000_000, currency: "USD" },
    annualOriginations: { dealCount: 850, volume: 425_000_000, currency: "USD" },
    portfolioSize: { dealCount: 1_200, outstandings: 380_000_000, currency: "USD" },
    workflowComplexity: "simple",
    approvalLevels: 2,
    covenantComplexity: "basic",
    requiredIntegrations: ["stripe", "quickbooks", "plaid", "billing_platforms"],
    testChallenges: ["revenue_verification", "mrr_arct_tracking", "variable_repayment", "churn_monitoring"],
    category: "alternative_finance",
    tags: ["saas", "revenue_based", "tech", "automated"],
  },

  {
    id: "us-mca-provider",
    name: "QuickFund Merchant",
    description: "Merchant cash advance provider for retail and restaurant businesses",
    businessModel: "merchant_cash_advance",
    geographicScope: "national",
    regulatoryRegime: "unregulated",
    baseCurrency: "USD",
    operatingCurrencies: ["USD"],
    jurisdictions: ["US"],
    products: ["term_loan"],
    takesDeposits: false,
    typicalDealSize: { min: 10_000, max: 500_000, currency: "USD" },
    annualOriginations: { dealCount: 12_000, volume: 850_000_000, currency: "USD" },
    portfolioSize: { dealCount: 8_500, outstandings: 420_000_000, currency: "USD" },
    workflowComplexity: "simple",
    approvalLevels: 1,
    covenantComplexity: "none",
    requiredIntegrations: ["payment_processors", "bank_statements", "pos_systems"],
    testChallenges: ["high_volume_processing", "split_funding", "stacking_detection", "rapid_decisioning"],
    category: "alternative_finance",
    tags: ["mca", "merchant", "high_volume", "automated"],
  },

  {
    id: "eu-marketplace-lender",
    name: "CrowdLend Europe",
    description: "Peer-to-peer marketplace lender connecting institutional investors with SME borrowers",
    businessModel: "marketplace_lender",
    geographicScope: "cross_border",
    regulatoryRegime: "eu_national",
    baseCurrency: "EUR",
    operatingCurrencies: ["EUR", "GBP"],
    jurisdictions: ["NL", "DE", "FR", "ES", "IT", "GB"],
    products: ["term_loan", "invoice_discounting"],
    takesDeposits: false,
    typicalDealSize: { min: 50_000, max: 2_000_000, currency: "EUR" },
    annualOriginations: { dealCount: 2_800, volume: 680_000_000, currency: "EUR" },
    portfolioSize: { dealCount: 4_200, outstandings: 520_000_000, currency: "EUR" },
    workflowComplexity: "simple",
    approvalLevels: 2,
    covenantComplexity: "none",
    requiredIntegrations: ["investor_portal", "payment_gateway", "credit_scoring"],
    testChallenges: ["investor_allocation", "secondary_market", "multi_investor_deals", "platform_risk"],
    category: "marketplace",
    tags: ["p2p", "marketplace", "multi_investor", "europe"],
  },

  // -------------------------------------------------------------------------
  // DEVELOPMENT FINANCE INSTITUTIONS
  // -------------------------------------------------------------------------
  {
    id: "multilateral-dfi",
    name: "Emerging Markets Development Bank",
    description: "Multilateral development finance institution supporting infrastructure in emerging markets",
    businessModel: "development_bank",
    geographicScope: "global",
    regulatoryRegime: "multi_jurisdiction",
    baseCurrency: "USD",
    operatingCurrencies: ["USD", "EUR", "GBP", "JPY", "CHF", "BRL", "MXN", "ZAR", "INR", "CNY"],
    jurisdictions: ["BR", "MX", "ZA", "NG", "KE", "EG", "IN", "ID", "VN", "PH", "CO", "PE"],
    products: ["project_finance", "syndicated_loan", "term_loan", "letter_of_credit", "bank_guarantee"],
    takesDeposits: false,
    typicalDealSize: { min: 25_000_000, max: 1_000_000_000, currency: "USD" },
    annualOriginations: { dealCount: 45, volume: 8_500_000_000, currency: "USD" },
    portfolioSize: { dealCount: 320, outstandings: 42_000_000_000, currency: "USD" },
    workflowComplexity: "enterprise",
    approvalLevels: 7,
    covenantComplexity: "complex",
    requiredIntegrations: ["environmental_monitoring", "development_impact", "sovereign_risk"],
    testChallenges: ["emerging_market_currencies", "political_risk", "environmental_social_governance", "blended_finance", "complex_structures"],
    category: "development_finance",
    tags: ["dfi", "infrastructure", "emerging_markets", "esg", "complex_structures"],
  },

  {
    id: "us-cdfi",
    name: "Community Capital Fund",
    description: "Community Development Financial Institution serving underserved communities",
    businessModel: "cdfi",
    geographicScope: "regional",
    regulatoryRegime: "us_state",
    baseCurrency: "USD",
    operatingCurrencies: ["USD"],
    jurisdictions: ["US"],
    products: ["term_loan", "line_of_credit", "commercial_mortgage"],
    takesDeposits: false,
    typicalDealSize: { min: 25_000, max: 2_000_000, currency: "USD" },
    annualOriginations: { dealCount: 180, volume: 45_000_000, currency: "USD" },
    portfolioSize: { dealCount: 420, outstandings: 85_000_000, currency: "USD" },
    workflowComplexity: "standard",
    approvalLevels: 3,
    covenantComplexity: "basic",
    requiredIntegrations: ["impact_tracking", "cdfi_fund_reporting", "cra_tracking"],
    testChallenges: ["impact_measurement", "flexible_underwriting", "grant_blending", "reporting_requirements"],
    category: "community_finance",
    tags: ["cdfi", "community", "impact", "underserved"],
  },

  // -------------------------------------------------------------------------
  // AGRICULTURAL & SPECIALTY
  // -------------------------------------------------------------------------
  {
    id: "us-ag-lender",
    name: "FarmCredit Midwest",
    description: "Agricultural lender providing financing for farms and agribusiness",
    businessModel: "agricultural_lender",
    geographicScope: "regional",
    regulatoryRegime: "us_state",
    baseCurrency: "USD",
    operatingCurrencies: ["USD"],
    jurisdictions: ["US"],
    products: ["term_loan", "line_of_credit", "equipment_loan", "commercial_mortgage"],
    takesDeposits: false,
    typicalDealSize: { min: 100_000, max: 10_000_000, currency: "USD" },
    annualOriginations: { dealCount: 380, volume: 420_000_000, currency: "USD" },
    portfolioSize: { dealCount: 1_850, outstandings: 1_200_000_000, currency: "USD" },
    workflowComplexity: "standard",
    approvalLevels: 3,
    covenantComplexity: "standard",
    requiredIntegrations: ["crop_insurance", "usda_fsa", "commodity_prices"],
    testChallenges: ["crop_cycle_seasonality", "commodity_price_risk", "weather_impact", "government_programs"],
    category: "agricultural",
    tags: ["agriculture", "seasonal", "commodity_linked"],
  },

  {
    id: "us-healthcare-finance",
    name: "MediFin Capital",
    description: "Healthcare finance company providing loans to medical practices and healthcare facilities",
    businessModel: "healthcare_finance",
    geographicScope: "national",
    regulatoryRegime: "unregulated",
    baseCurrency: "USD",
    operatingCurrencies: ["USD"],
    jurisdictions: ["US"],
    products: ["term_loan", "line_of_credit", "equipment_loan", "commercial_mortgage"],
    takesDeposits: false,
    typicalDealSize: { min: 250_000, max: 25_000_000, currency: "USD" },
    annualOriginations: { dealCount: 145, volume: 580_000_000, currency: "USD" },
    portfolioSize: { dealCount: 420, outstandings: 1_100_000_000, currency: "USD" },
    workflowComplexity: "standard",
    approvalLevels: 3,
    covenantComplexity: "standard",
    requiredIntegrations: ["practice_management", "revenue_cycle", "insurance_verification"],
    testChallenges: ["reimbursement_risk", "regulatory_compliance", "practitioner_guarantees", "accounts_receivable_quality"],
    category: "healthcare",
    tags: ["healthcare", "medical", "reimbursement"],
  },

  {
    id: "us-franchise-finance",
    name: "FranchiseFund America",
    description: "Franchise finance company providing SBA and conventional loans to franchisees",
    businessModel: "franchise_finance",
    geographicScope: "national",
    regulatoryRegime: "us_state",
    baseCurrency: "USD",
    operatingCurrencies: ["USD"],
    jurisdictions: ["US"],
    products: ["term_loan", "line_of_credit", "equipment_loan"],
    takesDeposits: false,
    typicalDealSize: { min: 100_000, max: 5_000_000, currency: "USD" },
    annualOriginations: { dealCount: 420, volume: 340_000_000, currency: "USD" },
    portfolioSize: { dealCount: 1_250, outstandings: 680_000_000, currency: "USD" },
    workflowComplexity: "standard",
    approvalLevels: 3,
    covenantComplexity: "basic",
    requiredIntegrations: ["sba_etran", "franchisor_systems", "pos_integration"],
    testChallenges: ["sba_compliance", "franchisor_requirements", "multi_unit_operators", "fdd_analysis"],
    category: "franchise",
    tags: ["franchise", "sba", "qsr", "retail"],
  },

  // -------------------------------------------------------------------------
  // EXPORT CREDIT & TRADE
  // -------------------------------------------------------------------------
  {
    id: "export-credit-agency",
    name: "National Export Credit Agency",
    description: "Government-backed export credit agency supporting national exporters",
    businessModel: "export_credit_agency",
    geographicScope: "global",
    regulatoryRegime: "multi_jurisdiction",
    baseCurrency: "EUR",
    operatingCurrencies: ["EUR", "USD", "GBP", "JPY", "CHF"],
    jurisdictions: ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "PL"],
    products: ["export_finance", "letter_of_credit", "bank_guarantee", "project_finance"],
    takesDeposits: false,
    typicalDealSize: { min: 5_000_000, max: 500_000_000, currency: "EUR" },
    annualOriginations: { dealCount: 85, volume: 4_200_000_000, currency: "EUR" },
    portfolioSize: { dealCount: 420, outstandings: 18_500_000_000, currency: "EUR" },
    workflowComplexity: "enterprise",
    approvalLevels: 6,
    covenantComplexity: "complex",
    requiredIntegrations: ["government_systems", "swift", "country_risk_systems"],
    testChallenges: ["sovereign_exposure", "political_risk_insurance", "oecd_consensus", "tied_aid"],
    category: "export_credit",
    tags: ["eca", "government", "export", "political_risk"],
  },

  // -------------------------------------------------------------------------
  // MICROFINANCE & EMERGING MARKETS
  // -------------------------------------------------------------------------
  {
    id: "latam-microfinance",
    name: "MicroFinanza Andina",
    description: "Microfinance institution serving micro-entrepreneurs in Latin America",
    businessModel: "microfinance",
    geographicScope: "cross_border",
    regulatoryRegime: "unregulated",
    baseCurrency: "USD",
    operatingCurrencies: ["USD", "PEN", "COP", "BRL", "MXN"],
    jurisdictions: ["PE", "CO", "EC", "BO", "MX", "GT"],
    products: ["term_loan"],
    takesDeposits: false,
    typicalDealSize: { min: 500, max: 25_000, currency: "USD" },
    annualOriginations: { dealCount: 85_000, volume: 125_000_000, currency: "USD" },
    portfolioSize: { dealCount: 120_000, outstandings: 95_000_000, currency: "USD" },
    workflowComplexity: "simple",
    approvalLevels: 2,
    covenantComplexity: "none",
    requiredIntegrations: ["mobile_banking", "biometric_id", "credit_bureau_local"],
    testChallenges: ["extremely_high_volume", "small_ticket", "informal_economy", "mobile_first", "local_currency_risk"],
    category: "microfinance",
    tags: ["microfinance", "high_volume", "emerging_markets", "mobile"],
  },

  {
    id: "africa-sme-lender",
    name: "AfriGrowth Finance",
    description: "SME lender operating across Sub-Saharan Africa",
    businessModel: "online_lender",
    geographicScope: "cross_border",
    regulatoryRegime: "multi_jurisdiction",
    baseCurrency: "USD",
    operatingCurrencies: ["USD", "NGN", "KES", "ZAR", "GHS", "TZS", "UGX", "RWF"],
    jurisdictions: ["NG", "KE", "ZA", "GH", "TZ", "UG", "RW", "ET"],
    products: ["term_loan", "invoice_discounting", "trade_loan"],
    takesDeposits: false,
    typicalDealSize: { min: 5_000, max: 500_000, currency: "USD" },
    annualOriginations: { dealCount: 3_500, volume: 180_000_000, currency: "USD" },
    portfolioSize: { dealCount: 4_800, outstandings: 145_000_000, currency: "USD" },
    workflowComplexity: "simple",
    approvalLevels: 2,
    covenantComplexity: "none",
    requiredIntegrations: ["mobile_money", "alternative_data", "local_bureaus"],
    testChallenges: ["african_currencies", "mobile_money_integration", "limited_financial_data", "fx_volatility"],
    category: "emerging_markets",
    tags: ["africa", "sme", "mobile_money", "emerging_markets"],
  },

  // -------------------------------------------------------------------------
  // SYNDICATION & CLUB DEALS
  // -------------------------------------------------------------------------
  {
    id: "syndication-agent",
    name: "Syndicate Capital Partners",
    description: "Lead arranger and agent bank for syndicated loan facilities",
    businessModel: "commercial_bank",
    geographicScope: "global",
    regulatoryRegime: "us_occ",
    baseCurrency: "USD",
    operatingCurrencies: ["USD", "EUR", "GBP"],
    jurisdictions: ["US", "GB", "DE", "FR", "NL", "LU"],
    products: ["syndicated_loan", "club_deal", "term_loan", "revolving_credit"],
    takesDeposits: true,
    typicalDealSize: { min: 100_000_000, max: 3_000_000_000, currency: "USD" },
    annualOriginations: { dealCount: 35, volume: 28_000_000_000, currency: "USD" },
    portfolioSize: { dealCount: 85, outstandings: 45_000_000_000, currency: "USD" },
    workflowComplexity: "enterprise",
    approvalLevels: 6,
    covenantComplexity: "complex",
    requiredIntegrations: ["loan_iq", "clearpar", "markit", "intralinks"],
    testChallenges: ["multi_lender_coordination", "agent_role_workflows", "fee_distribution", "amendment_voting", "secondary_trading"],
    category: "syndication",
    tags: ["deposits", "syndication", "agent_bank", "secondary_market"],
  },
];

// ============================================================================
// PARAMETRIC PERSONA GENERATION
// ============================================================================

/**
 * Generate additional personas programmatically by combining parameters
 */
export function generateParametricPersonas(): Persona[] {
  const personas: Persona[] = [];
  let idCounter = 1;

  // Generate regional bank variants for different countries
  const bankRegions: Array<{
    region: string;
    country: string;
    currency: Currency;
    regulatory: Persona["regulatoryRegime"];
  }> = [
    { region: "northeast-us", country: "US", currency: "USD", regulatory: "us_fdic" },
    { region: "southeast-us", country: "US", currency: "USD", regulatory: "us_fdic" },
    { region: "west-coast-us", country: "US", currency: "USD", regulatory: "us_state" },
    { region: "texas", country: "US", currency: "USD", regulatory: "us_state" },
    { region: "scotland", country: "GB", currency: "GBP", regulatory: "uk_pra" },
    { region: "northern-england", country: "GB", currency: "GBP", regulatory: "uk_pra" },
    { region: "bavaria", country: "DE", currency: "EUR", regulatory: "eu_national" },
    { region: "nord-rhein", country: "DE", currency: "EUR", regulatory: "eu_national" },
    { region: "ile-de-france", country: "FR", currency: "EUR", regulatory: "eu_national" },
    { region: "lombardy", country: "IT", currency: "EUR", regulatory: "eu_national" },
    { region: "catalonia", country: "ES", currency: "EUR", regulatory: "eu_national" },
    { region: "randstad", country: "NL", currency: "EUR", regulatory: "eu_national" },
    { region: "osaka", country: "JP", currency: "JPY", regulatory: "japan_fsa" },
    { region: "nagoya", country: "JP", currency: "JPY", regulatory: "japan_fsa" },
    { region: "queensland", country: "AU", currency: "AUD", regulatory: "australia_apra" },
    { region: "victoria", country: "AU", currency: "AUD", regulatory: "australia_apra" },
    { region: "ontario", country: "CA", currency: "CAD", regulatory: "us_state" },
    { region: "alberta", country: "CA", currency: "CAD", regulatory: "us_state" },
  ];

  for (const { region, country, currency, regulatory } of bankRegions) {
    personas.push({
      id: `regional-bank-${region}-${idCounter++}`,
      name: `${region.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} Community Bank`,
      description: `Regional community bank serving the ${region} area`,
      businessModel: "regional_bank",
      geographicScope: "regional",
      regulatoryRegime: regulatory,
      baseCurrency: currency,
      operatingCurrencies: [currency],
      jurisdictions: [country],
      products: ["term_loan", "revolving_credit", "line_of_credit", "commercial_mortgage", "demand_deposit"],
      takesDeposits: true,
      typicalDealSize: { min: 250_000, max: 15_000_000, currency },
      annualOriginations: { dealCount: 280, volume: 450_000_000, currency },
      portfolioSize: { dealCount: 1_400, outstandings: 2_100_000_000, currency },
      workflowComplexity: "standard",
      approvalLevels: 3,
      covenantComplexity: "standard",
      requiredIntegrations: ["core_banking", "credit_bureau"],
      testChallenges: ["deposit_taking", "regulatory_reporting"],
      category: "regional_bank",
      tags: ["deposits", "regional", country.toLowerCase()],
    });
  }

  // Generate specialty finance variants
  const specialtyTypes: Array<{
    type: BusinessModel;
    name: string;
    products: ProductType[];
    challenges: string[];
  }> = [
    {
      type: "transportation_finance",
      name: "Transportation",
      products: ["equipment_loan", "equipment_lease", "term_loan"],
      challenges: ["fleet_tracking", "depreciation_curves", "utilization_monitoring"],
    },
    {
      type: "energy_finance",
      name: "Energy",
      products: ["project_finance", "term_loan", "revolving_credit"],
      challenges: ["commodity_hedging", "regulatory_permits", "environmental_compliance"],
    },
  ];

  for (const specialty of specialtyTypes) {
    for (const scope of ["national", "cross_border"] as GeographicScope[]) {
      personas.push({
        id: `${specialty.type}-${scope}-${idCounter++}`,
        name: `${specialty.name} Finance ${scope === "national" ? "USA" : "International"}`,
        description: `Specialized ${specialty.name.toLowerCase()} finance company`,
        businessModel: specialty.type,
        geographicScope: scope,
        regulatoryRegime: "unregulated",
        baseCurrency: "USD",
        operatingCurrencies: scope === "national" ? ["USD"] : ["USD", "EUR", "GBP"],
        jurisdictions: scope === "national" ? ["US"] : ["US", "GB", "DE", "FR"],
        products: specialty.products,
        takesDeposits: false,
        typicalDealSize: { min: 1_000_000, max: 50_000_000, currency: "USD" },
        annualOriginations: { dealCount: 120, volume: 1_200_000_000, currency: "USD" },
        portfolioSize: { dealCount: 350, outstandings: 2_800_000_000, currency: "USD" },
        workflowComplexity: "complex",
        approvalLevels: 4,
        covenantComplexity: "complex",
        requiredIntegrations: ["asset_tracking", "industry_data"],
        testChallenges: specialty.challenges,
        category: "specialty_finance",
        tags: [specialty.type, scope],
      });
    }
  }

  // Generate fintech variants across different regions
  const fintechRegions = [
    { region: "DACH", countries: ["DE", "AT", "CH"], currency: "EUR" as Currency },
    { region: "Nordic", countries: ["SE", "NO", "DK", "FI"], currency: "EUR" as Currency },
    { region: "Benelux", countries: ["NL", "BE", "LU"], currency: "EUR" as Currency },
    { region: "APAC", countries: ["SG", "HK", "AU"], currency: "SGD" as Currency },
    { region: "LATAM", countries: ["MX", "BR", "CO", "CL"], currency: "USD" as Currency },
  ];

  for (const { region, countries, currency } of fintechRegions) {
    personas.push({
      id: `fintech-lender-${region.toLowerCase()}-${idCounter++}`,
      name: `${region} Digital Lending`,
      description: `Digital-first SME lender operating across ${region}`,
      businessModel: "online_lender",
      geographicScope: "cross_border",
      regulatoryRegime: "eu_national",
      baseCurrency: currency,
      operatingCurrencies: [currency, "USD", "EUR"],
      jurisdictions: countries,
      products: ["term_loan", "line_of_credit", "invoice_discounting"],
      takesDeposits: false,
      typicalDealSize: { min: 25_000, max: 1_000_000, currency },
      annualOriginations: { dealCount: 2_500, volume: 380_000_000, currency },
      portfolioSize: { dealCount: 4_800, outstandings: 290_000_000, currency },
      workflowComplexity: "simple",
      approvalLevels: 2,
      covenantComplexity: "none",
      requiredIntegrations: ["open_banking", "accounting_software", "credit_scoring"],
      testChallenges: ["automated_decisioning", "multi_jurisdiction_compliance", "api_integration"],
      category: "fintech",
      tags: ["digital", "automated", region.toLowerCase()],
    });
  }

  // Generate embedded finance variants for different platforms
  const embeddedPlatforms = [
    { platform: "ecommerce", vertical: "Online Marketplace" },
    { platform: "accounting", vertical: "Accounting Software" },
    { platform: "payroll", vertical: "Payroll Platform" },
    { platform: "erp", vertical: "ERP System" },
    { platform: "procurement", vertical: "Procurement Platform" },
  ];

  for (const { platform, vertical } of embeddedPlatforms) {
    personas.push({
      id: `embedded-finance-${platform}-${idCounter++}`,
      name: `${vertical} Embedded Lending`,
      description: `White-label lending embedded within ${vertical.toLowerCase()} platforms`,
      businessModel: "embedded_finance",
      geographicScope: "multinational",
      regulatoryRegime: "unregulated",
      baseCurrency: "USD",
      operatingCurrencies: ["USD", "EUR", "GBP"],
      jurisdictions: ["US", "GB", "DE", "FR", "NL", "AU"],
      products: ["term_loan", "line_of_credit"],
      takesDeposits: false,
      typicalDealSize: { min: 5_000, max: 250_000, currency: "USD" },
      annualOriginations: { dealCount: 15_000, volume: 450_000_000, currency: "USD" },
      portfolioSize: { dealCount: 22_000, outstandings: 380_000_000, currency: "USD" },
      workflowComplexity: "simple",
      approvalLevels: 1,
      covenantComplexity: "none",
      requiredIntegrations: ["platform_api", "payment_gateway", "identity_verification"],
      testChallenges: ["white_label_branding", "platform_data_integration", "instant_decisioning", "seamless_ux"],
      category: "embedded_finance",
      tags: ["embedded", "white_label", platform, "api_first"],
    });
  }

  // Generate credit union variants
  const creditUnionTypes = [
    { type: "municipal", members: "Municipal Employees" },
    { type: "healthcare", members: "Healthcare Workers" },
    { type: "education", members: "Teachers & Educators" },
    { type: "military", members: "Military Personnel" },
    { type: "tech", members: "Technology Workers" },
  ];

  for (const { type, members } of creditUnionTypes) {
    personas.push({
      id: `credit-union-${type}-${idCounter++}`,
      name: `${members} Credit Union`,
      description: `Member-owned credit union serving ${members.toLowerCase()}`,
      businessModel: "credit_union",
      geographicScope: "regional",
      regulatoryRegime: "us_state",
      baseCurrency: "USD",
      operatingCurrencies: ["USD"],
      jurisdictions: ["US"],
      products: ["term_loan", "line_of_credit", "vehicle_finance", "demand_deposit", "time_deposit"],
      takesDeposits: true,
      typicalDealSize: { min: 10_000, max: 500_000, currency: "USD" },
      annualOriginations: { dealCount: 850, volume: 95_000_000, currency: "USD" },
      portfolioSize: { dealCount: 4_200, outstandings: 320_000_000, currency: "USD" },
      workflowComplexity: "simple",
      approvalLevels: 2,
      covenantComplexity: "none",
      requiredIntegrations: ["core_banking", "member_systems"],
      testChallenges: ["member_verification", "share_account_integration", "dividend_calculations"],
      category: "credit_union",
      tags: ["deposits", "credit_union", "member_owned", type],
    });
  }

  return personas;
}

// ============================================================================
// EXPORT ALL PERSONAS
// ============================================================================

/**
 * Get all personas (core archetypes + parametric generated)
 */
export function getAllPersonas(): Persona[] {
  return [...CORE_ARCHETYPES, ...generateParametricPersonas()];
}

/**
 * Get personas by business model
 */
export function getPersonasByBusinessModel(model: BusinessModel): Persona[] {
  return getAllPersonas().filter(p => p.businessModel === model);
}

/**
 * Get personas that take deposits (banks, credit unions)
 */
export function getDepositTakingPersonas(): Persona[] {
  return getAllPersonas().filter(p => p.takesDeposits);
}

/**
 * Get personas by geographic scope
 */
export function getPersonasByScope(scope: GeographicScope): Persona[] {
  return getAllPersonas().filter(p => p.geographicScope === scope);
}

/**
 * Get personas that operate in a specific currency
 */
export function getPersonasByCurrency(currency: Currency): Persona[] {
  return getAllPersonas().filter(p =>
    p.baseCurrency === currency || p.operatingCurrencies.includes(currency)
  );
}

/**
 * Get personas with specific test challenges
 */
export function getPersonasByChallenge(challenge: string): Persona[] {
  return getAllPersonas().filter(p =>
    p.testChallenges.some(c => c.toLowerCase().includes(challenge.toLowerCase()))
  );
}
