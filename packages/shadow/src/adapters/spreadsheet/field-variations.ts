/**
 * Field Variations Database
 *
 * Maps common spreadsheet column name variations to Open LOS field mappings.
 * Used for automatic schema discovery and field mapping suggestions.
 */

import { TargetEntity, TransformType, SpreadsheetDataType } from "./types";

// =============================================================================
// Field Variation Types
// =============================================================================

export interface FieldVariation {
  /** Common column name pattern (lowercase) */
  pattern: string;
  /** Whether this is a regex pattern */
  isRegex?: boolean;
  /** Target Open LOS entity */
  targetEntity: TargetEntity;
  /** Target field path */
  targetField: string;
  /** Required transformation */
  transform?: TransformType;
  /** Transform parameters */
  transformParams?: Record<string, unknown>;
  /** Base confidence score (0-1) */
  confidence: number;
  /** Expected data types that boost confidence */
  expectedTypes?: SpreadsheetDataType[];
  /** Category for grouping */
  category: FieldCategory;
}

export type FieldCategory =
  | "deal_core"
  | "deal_financial"
  | "deal_status"
  | "deal_dates"
  | "deal_assignment"
  | "entity_identity"
  | "entity_contact"
  | "entity_address"
  | "facility_terms"
  | "facility_rates"
  | "document_meta"
  | "covenant"
  | "custom";

// =============================================================================
// Field Variations Database
// =============================================================================

export const FIELD_VARIATIONS: FieldVariation[] = [
  // =========================================================================
  // DEAL CORE FIELDS
  // =========================================================================
  {
    pattern: "deal name",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.95,
    category: "deal_core",
  },
  {
    pattern: "loan name",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.95,
    category: "deal_core",
  },
  {
    pattern: "project name",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.85,
    category: "deal_core",
  },
  {
    pattern: "project",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.7,
    category: "deal_core",
  },
  {
    pattern: "borrower name",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.98,
    category: "deal_core",
  },
  {
    pattern: "borrower",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.9,
    category: "deal_core",
  },
  {
    pattern: "client name",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.85,
    category: "deal_core",
  },
  {
    pattern: "client",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.75,
    category: "deal_core",
  },
  {
    pattern: "customer name",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.85,
    category: "deal_core",
  },
  {
    pattern: "customer",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.75,
    category: "deal_core",
  },
  {
    pattern: "applicant",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.8,
    category: "deal_core",
  },
  {
    pattern: "account name",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.7,
    category: "deal_core",
  },
  {
    pattern: "opportunity name",
    targetEntity: "deals",
    targetField: "borrower_name",
    confidence: 0.75,
    category: "deal_core",
  },

  // Purpose
  {
    pattern: "purpose",
    targetEntity: "deals",
    targetField: "purpose",
    confidence: 0.9,
    category: "deal_core",
  },
  {
    pattern: "loan purpose",
    targetEntity: "deals",
    targetField: "purpose",
    confidence: 0.95,
    category: "deal_core",
  },
  {
    pattern: "use of proceeds",
    targetEntity: "deals",
    targetField: "purpose",
    confidence: 0.9,
    category: "deal_core",
  },
  {
    pattern: "use of funds",
    targetEntity: "deals",
    targetField: "purpose",
    confidence: 0.9,
    category: "deal_core",
  },
  {
    pattern: "transaction purpose",
    targetEntity: "deals",
    targetField: "purpose",
    confidence: 0.85,
    category: "deal_core",
  },

  // Jurisdiction
  {
    pattern: "jurisdiction",
    targetEntity: "deals",
    targetField: "jurisdiction",
    confidence: 0.95,
    category: "deal_core",
  },
  {
    pattern: "state",
    targetEntity: "deals",
    targetField: "jurisdiction",
    confidence: 0.7,
    category: "deal_core",
  },
  {
    pattern: "property state",
    targetEntity: "deals",
    targetField: "jurisdiction",
    confidence: 0.85,
    category: "deal_core",
  },
  {
    pattern: "collateral state",
    targetEntity: "deals",
    targetField: "jurisdiction",
    confidence: 0.85,
    category: "deal_core",
  },

  // =========================================================================
  // DEAL FINANCIAL FIELDS
  // =========================================================================
  {
    pattern: "amount",
    targetEntity: "facilities",
    targetField: "amount",
    transform: "to_minor_units",
    confidence: 0.75,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "loan amount",
    targetEntity: "facilities",
    targetField: "amount",
    transform: "to_minor_units",
    confidence: 0.98,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "principal",
    targetEntity: "facilities",
    targetField: "amount",
    transform: "to_minor_units",
    confidence: 0.9,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "principal amount",
    targetEntity: "facilities",
    targetField: "amount",
    transform: "to_minor_units",
    confidence: 0.95,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "requested amount",
    targetEntity: "deals",
    targetField: "requested_amount",
    transform: "to_minor_units",
    confidence: 0.95,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "request amount",
    targetEntity: "deals",
    targetField: "requested_amount",
    transform: "to_minor_units",
    confidence: 0.9,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "approved amount",
    targetEntity: "facilities",
    targetField: "amount",
    transform: "to_minor_units",
    confidence: 0.9,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "commitment",
    targetEntity: "facilities",
    targetField: "amount",
    transform: "to_minor_units",
    confidence: 0.85,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "credit line",
    targetEntity: "facilities",
    targetField: "amount",
    transform: "to_minor_units",
    confidence: 0.85,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "facility amount",
    targetEntity: "facilities",
    targetField: "amount",
    transform: "to_minor_units",
    confidence: 0.95,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "funded amount",
    targetEntity: "loan_accounts",
    targetField: "principal_disbursed",
    transform: "to_minor_units",
    confidence: 0.9,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "outstanding",
    targetEntity: "loan_accounts",
    targetField: "principal_outstanding",
    transform: "to_minor_units",
    confidence: 0.85,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },
  {
    pattern: "outstanding balance",
    targetEntity: "loan_accounts",
    targetField: "principal_outstanding",
    transform: "to_minor_units",
    confidence: 0.95,
    expectedTypes: ["currency", "number"],
    category: "deal_financial",
  },

  // =========================================================================
  // DEAL STATUS FIELDS
  // =========================================================================
  {
    pattern: "status",
    targetEntity: "deals",
    targetField: "stage",
    transform: "stage_normalize",
    confidence: 0.85,
    category: "deal_status",
  },
  {
    pattern: "stage",
    targetEntity: "deals",
    targetField: "stage",
    transform: "stage_normalize",
    confidence: 0.95,
    category: "deal_status",
  },
  {
    pattern: "phase",
    targetEntity: "deals",
    targetField: "stage",
    transform: "stage_normalize",
    confidence: 0.8,
    category: "deal_status",
  },
  {
    pattern: "pipeline stage",
    targetEntity: "deals",
    targetField: "stage",
    transform: "stage_normalize",
    confidence: 0.95,
    category: "deal_status",
  },
  {
    pattern: "deal stage",
    targetEntity: "deals",
    targetField: "stage",
    transform: "stage_normalize",
    confidence: 0.95,
    category: "deal_status",
  },
  {
    pattern: "loan status",
    targetEntity: "deals",
    targetField: "stage",
    transform: "stage_normalize",
    confidence: 0.9,
    category: "deal_status",
  },
  {
    pattern: "application status",
    targetEntity: "deals",
    targetField: "stage",
    transform: "stage_normalize",
    confidence: 0.9,
    category: "deal_status",
  },
  {
    pattern: "current status",
    targetEntity: "deals",
    targetField: "stage",
    transform: "stage_normalize",
    confidence: 0.85,
    category: "deal_status",
  },
  {
    pattern: "workflow status",
    targetEntity: "deals",
    targetField: "stage",
    transform: "stage_normalize",
    confidence: 0.85,
    category: "deal_status",
  },

  // =========================================================================
  // DEAL DATES
  // =========================================================================
  {
    pattern: "closing date",
    targetEntity: "deals",
    targetField: "custom_fields.closing_date",
    transform: "parse_date",
    confidence: 0.95,
    expectedTypes: ["date", "datetime"],
    category: "deal_dates",
  },
  {
    pattern: "close date",
    targetEntity: "deals",
    targetField: "custom_fields.closing_date",
    transform: "parse_date",
    confidence: 0.95,
    expectedTypes: ["date", "datetime"],
    category: "deal_dates",
  },
  {
    pattern: "expected close",
    targetEntity: "deals",
    targetField: "custom_fields.target_close",
    transform: "parse_date",
    confidence: 0.9,
    expectedTypes: ["date", "datetime"],
    category: "deal_dates",
  },
  {
    pattern: "target close date",
    targetEntity: "deals",
    targetField: "custom_fields.target_close",
    transform: "parse_date",
    confidence: 0.95,
    expectedTypes: ["date", "datetime"],
    category: "deal_dates",
  },
  {
    pattern: "application date",
    targetEntity: "deals",
    targetField: "custom_fields.application_date",
    transform: "parse_date",
    confidence: 0.95,
    expectedTypes: ["date", "datetime"],
    category: "deal_dates",
  },
  {
    pattern: "received date",
    targetEntity: "deals",
    targetField: "custom_fields.received_date",
    transform: "parse_date",
    confidence: 0.9,
    expectedTypes: ["date", "datetime"],
    category: "deal_dates",
  },
  {
    pattern: "maturity date",
    targetEntity: "facilities",
    targetField: "custom_fields.maturity_date",
    transform: "parse_date",
    confidence: 0.95,
    expectedTypes: ["date", "datetime"],
    category: "deal_dates",
  },
  {
    pattern: "maturity",
    targetEntity: "facilities",
    targetField: "custom_fields.maturity_date",
    transform: "parse_date",
    confidence: 0.75,
    expectedTypes: ["date", "datetime"],
    category: "deal_dates",
  },
  {
    pattern: "funding date",
    targetEntity: "loan_accounts",
    targetField: "disbursed_at",
    transform: "parse_date",
    confidence: 0.9,
    expectedTypes: ["date", "datetime"],
    category: "deal_dates",
  },
  {
    pattern: "disbursement date",
    targetEntity: "loan_accounts",
    targetField: "disbursed_at",
    transform: "parse_date",
    confidence: 0.95,
    expectedTypes: ["date", "datetime"],
    category: "deal_dates",
  },

  // =========================================================================
  // DEAL ASSIGNMENT
  // =========================================================================
  {
    pattern: "assigned to",
    targetEntity: "deals",
    targetField: "assigned_to",
    confidence: 0.95,
    category: "deal_assignment",
  },
  {
    pattern: "owner",
    targetEntity: "deals",
    targetField: "assigned_to",
    confidence: 0.75,
    category: "deal_assignment",
  },
  {
    pattern: "deal owner",
    targetEntity: "deals",
    targetField: "assigned_to",
    confidence: 0.9,
    category: "deal_assignment",
  },
  {
    pattern: "loan officer",
    targetEntity: "deals",
    targetField: "assigned_to",
    confidence: 0.95,
    category: "deal_assignment",
  },
  {
    pattern: "lo",
    targetEntity: "deals",
    targetField: "assigned_to",
    confidence: 0.7,
    category: "deal_assignment",
  },
  {
    pattern: "originator",
    targetEntity: "deals",
    targetField: "assigned_to",
    confidence: 0.9,
    category: "deal_assignment",
  },
  {
    pattern: "relationship manager",
    targetEntity: "deals",
    targetField: "assigned_to",
    confidence: 0.9,
    category: "deal_assignment",
  },
  {
    pattern: "rm",
    targetEntity: "deals",
    targetField: "assigned_to",
    confidence: 0.7,
    category: "deal_assignment",
  },
  {
    pattern: "account manager",
    targetEntity: "deals",
    targetField: "assigned_to",
    confidence: 0.85,
    category: "deal_assignment",
  },
  {
    pattern: "processor",
    targetEntity: "deals",
    targetField: "custom_fields.processor",
    confidence: 0.85,
    category: "deal_assignment",
  },
  {
    pattern: "underwriter",
    targetEntity: "deals",
    targetField: "custom_fields.underwriter",
    confidence: 0.9,
    category: "deal_assignment",
  },
  {
    pattern: "closer",
    targetEntity: "deals",
    targetField: "custom_fields.closer",
    confidence: 0.85,
    category: "deal_assignment",
  },

  // =========================================================================
  // ENTITY IDENTITY FIELDS
  // =========================================================================
  {
    pattern: "company name",
    targetEntity: "entities",
    targetField: "name",
    confidence: 0.95,
    category: "entity_identity",
  },
  {
    pattern: "company",
    targetEntity: "entities",
    targetField: "name",
    confidence: 0.8,
    category: "entity_identity",
  },
  {
    pattern: "business name",
    targetEntity: "entities",
    targetField: "name",
    confidence: 0.9,
    category: "entity_identity",
  },
  {
    pattern: "legal name",
    targetEntity: "entities",
    targetField: "legal_name",
    confidence: 0.95,
    category: "entity_identity",
  },
  {
    pattern: "dba",
    targetEntity: "entities",
    targetField: "custom_fields.dba",
    confidence: 0.9,
    category: "entity_identity",
  },
  {
    pattern: "doing business as",
    targetEntity: "entities",
    targetField: "custom_fields.dba",
    confidence: 0.95,
    category: "entity_identity",
  },
  {
    pattern: "ein",
    targetEntity: "entities",
    targetField: "registration_number",
    confidence: 0.95,
    category: "entity_identity",
  },
  {
    pattern: "tax id",
    targetEntity: "entities",
    targetField: "registration_number",
    confidence: 0.9,
    category: "entity_identity",
  },
  {
    pattern: "federal tax id",
    targetEntity: "entities",
    targetField: "registration_number",
    confidence: 0.95,
    category: "entity_identity",
  },
  {
    pattern: "fein",
    targetEntity: "entities",
    targetField: "registration_number",
    confidence: 0.95,
    category: "entity_identity",
  },
  {
    pattern: "ssn",
    targetEntity: "entities",
    targetField: "identifiers.ssn",
    confidence: 0.95,
    category: "entity_identity",
  },
  {
    pattern: "social security",
    targetEntity: "entities",
    targetField: "identifiers.ssn",
    confidence: 0.9,
    category: "entity_identity",
  },
  {
    pattern: "contact name",
    targetEntity: "entities",
    targetField: "name",
    confidence: 0.85,
    category: "entity_identity",
  },
  {
    pattern: "first name",
    targetEntity: "entities",
    targetField: "custom_fields.first_name",
    confidence: 0.9,
    category: "entity_identity",
  },
  {
    pattern: "last name",
    targetEntity: "entities",
    targetField: "custom_fields.last_name",
    confidence: 0.9,
    category: "entity_identity",
  },

  // =========================================================================
  // ENTITY CONTACT FIELDS
  // =========================================================================
  {
    pattern: "email",
    targetEntity: "entities",
    targetField: "identifiers.email",
    confidence: 0.9,
    expectedTypes: ["email"],
    category: "entity_contact",
  },
  {
    pattern: "email address",
    targetEntity: "entities",
    targetField: "identifiers.email",
    confidence: 0.95,
    expectedTypes: ["email"],
    category: "entity_contact",
  },
  {
    pattern: "contact email",
    targetEntity: "entities",
    targetField: "identifiers.email",
    confidence: 0.95,
    expectedTypes: ["email"],
    category: "entity_contact",
  },
  {
    pattern: "phone",
    targetEntity: "entities",
    targetField: "identifiers.phone",
    transform: "parse_phone",
    confidence: 0.9,
    expectedTypes: ["phone"],
    category: "entity_contact",
  },
  {
    pattern: "phone number",
    targetEntity: "entities",
    targetField: "identifiers.phone",
    transform: "parse_phone",
    confidence: 0.95,
    expectedTypes: ["phone"],
    category: "entity_contact",
  },
  {
    pattern: "contact phone",
    targetEntity: "entities",
    targetField: "identifiers.phone",
    transform: "parse_phone",
    confidence: 0.95,
    expectedTypes: ["phone"],
    category: "entity_contact",
  },
  {
    pattern: "mobile",
    targetEntity: "entities",
    targetField: "identifiers.mobile",
    transform: "parse_phone",
    confidence: 0.9,
    expectedTypes: ["phone"],
    category: "entity_contact",
  },
  {
    pattern: "cell",
    targetEntity: "entities",
    targetField: "identifiers.mobile",
    transform: "parse_phone",
    confidence: 0.85,
    expectedTypes: ["phone"],
    category: "entity_contact",
  },
  {
    pattern: "fax",
    targetEntity: "entities",
    targetField: "identifiers.fax",
    transform: "parse_phone",
    confidence: 0.9,
    expectedTypes: ["phone"],
    category: "entity_contact",
  },
  {
    pattern: "website",
    targetEntity: "entities",
    targetField: "identifiers.website",
    confidence: 0.9,
    expectedTypes: ["url"],
    category: "entity_contact",
  },

  // =========================================================================
  // ENTITY ADDRESS FIELDS
  // =========================================================================
  {
    pattern: "address",
    targetEntity: "entities",
    targetField: "custom_fields.address",
    confidence: 0.8,
    category: "entity_address",
  },
  {
    pattern: "street address",
    targetEntity: "entities",
    targetField: "custom_fields.address",
    confidence: 0.9,
    category: "entity_address",
  },
  {
    pattern: "address line 1",
    targetEntity: "entities",
    targetField: "custom_fields.address_line1",
    confidence: 0.95,
    category: "entity_address",
  },
  {
    pattern: "address line 2",
    targetEntity: "entities",
    targetField: "custom_fields.address_line2",
    confidence: 0.95,
    category: "entity_address",
  },
  {
    pattern: "city",
    targetEntity: "entities",
    targetField: "custom_fields.city",
    confidence: 0.9,
    category: "entity_address",
  },
  {
    pattern: "state",
    targetEntity: "entities",
    targetField: "custom_fields.state",
    confidence: 0.7,
    category: "entity_address",
  },
  {
    pattern: "zip",
    targetEntity: "entities",
    targetField: "custom_fields.zip",
    confidence: 0.9,
    category: "entity_address",
  },
  {
    pattern: "zip code",
    targetEntity: "entities",
    targetField: "custom_fields.zip",
    confidence: 0.95,
    category: "entity_address",
  },
  {
    pattern: "postal code",
    targetEntity: "entities",
    targetField: "custom_fields.zip",
    confidence: 0.9,
    category: "entity_address",
  },
  {
    pattern: "country",
    targetEntity: "entities",
    targetField: "custom_fields.country",
    confidence: 0.9,
    category: "entity_address",
  },

  // =========================================================================
  // FACILITY TERMS
  // =========================================================================
  {
    pattern: "loan type",
    targetEntity: "facilities",
    targetField: "type",
    confidence: 0.95,
    category: "facility_terms",
  },
  {
    pattern: "product type",
    targetEntity: "facilities",
    targetField: "type",
    confidence: 0.9,
    category: "facility_terms",
  },
  {
    pattern: "facility type",
    targetEntity: "facilities",
    targetField: "type",
    confidence: 0.95,
    category: "facility_terms",
  },
  {
    pattern: "product",
    targetEntity: "facilities",
    targetField: "type",
    confidence: 0.7,
    category: "facility_terms",
  },
  {
    pattern: "term",
    targetEntity: "facilities",
    targetField: "term_months",
    confidence: 0.75,
    category: "facility_terms",
  },
  {
    pattern: "loan term",
    targetEntity: "facilities",
    targetField: "term_months",
    confidence: 0.95,
    category: "facility_terms",
  },
  {
    pattern: "term months",
    targetEntity: "facilities",
    targetField: "term_months",
    confidence: 0.95,
    category: "facility_terms",
  },
  {
    pattern: "term (months)",
    targetEntity: "facilities",
    targetField: "term_months",
    confidence: 0.95,
    category: "facility_terms",
  },
  {
    pattern: "amortization",
    targetEntity: "facilities",
    targetField: "custom_fields.amortization",
    confidence: 0.9,
    category: "facility_terms",
  },
  {
    pattern: "payment frequency",
    targetEntity: "facilities",
    targetField: "custom_fields.payment_frequency",
    confidence: 0.9,
    category: "facility_terms",
  },
  {
    pattern: "collateral",
    targetEntity: "facilities",
    targetField: "custom_fields.collateral",
    confidence: 0.85,
    category: "facility_terms",
  },
  {
    pattern: "collateral type",
    targetEntity: "facilities",
    targetField: "custom_fields.collateral_type",
    confidence: 0.9,
    category: "facility_terms",
  },
  {
    pattern: "security",
    targetEntity: "facilities",
    targetField: "custom_fields.security",
    confidence: 0.8,
    category: "facility_terms",
  },
  {
    pattern: "ltv",
    targetEntity: "facilities",
    targetField: "custom_fields.ltv",
    confidence: 0.95,
    expectedTypes: ["percentage", "number"],
    category: "facility_terms",
  },
  {
    pattern: "loan to value",
    targetEntity: "facilities",
    targetField: "custom_fields.ltv",
    confidence: 0.95,
    expectedTypes: ["percentage", "number"],
    category: "facility_terms",
  },
  {
    pattern: "dscr",
    targetEntity: "facilities",
    targetField: "custom_fields.dscr",
    confidence: 0.95,
    expectedTypes: ["number"],
    category: "facility_terms",
  },
  {
    pattern: "debt service coverage",
    targetEntity: "facilities",
    targetField: "custom_fields.dscr",
    confidence: 0.95,
    expectedTypes: ["number"],
    category: "facility_terms",
  },

  // =========================================================================
  // FACILITY RATES
  // =========================================================================
  {
    pattern: "rate",
    targetEntity: "facilities",
    targetField: "interest_rate_value",
    transform: "parse_percentage",
    confidence: 0.75,
    expectedTypes: ["percentage", "number"],
    category: "facility_rates",
  },
  {
    pattern: "interest rate",
    targetEntity: "facilities",
    targetField: "interest_rate_value",
    transform: "parse_percentage",
    confidence: 0.98,
    expectedTypes: ["percentage", "number"],
    category: "facility_rates",
  },
  {
    pattern: "coupon",
    targetEntity: "facilities",
    targetField: "interest_rate_value",
    transform: "parse_percentage",
    confidence: 0.85,
    expectedTypes: ["percentage", "number"],
    category: "facility_rates",
  },
  {
    pattern: "note rate",
    targetEntity: "facilities",
    targetField: "interest_rate_value",
    transform: "parse_percentage",
    confidence: 0.9,
    expectedTypes: ["percentage", "number"],
    category: "facility_rates",
  },
  {
    pattern: "spread",
    targetEntity: "facilities",
    targetField: "spread",
    transform: "parse_percentage",
    confidence: 0.9,
    expectedTypes: ["percentage", "number"],
    category: "facility_rates",
  },
  {
    pattern: "margin",
    targetEntity: "facilities",
    targetField: "spread",
    transform: "parse_percentage",
    confidence: 0.85,
    expectedTypes: ["percentage", "number"],
    category: "facility_rates",
  },
  {
    pattern: "index",
    targetEntity: "facilities",
    targetField: "custom_fields.index",
    confidence: 0.75,
    category: "facility_rates",
  },
  {
    pattern: "base rate",
    targetEntity: "facilities",
    targetField: "custom_fields.base_rate",
    confidence: 0.85,
    category: "facility_rates",
  },
  {
    pattern: "floor",
    targetEntity: "facilities",
    targetField: "custom_fields.floor_rate",
    transform: "parse_percentage",
    confidence: 0.85,
    expectedTypes: ["percentage", "number"],
    category: "facility_rates",
  },
  {
    pattern: "ceiling",
    targetEntity: "facilities",
    targetField: "custom_fields.ceiling_rate",
    transform: "parse_percentage",
    confidence: 0.85,
    expectedTypes: ["percentage", "number"],
    category: "facility_rates",
  },
  {
    pattern: "cap",
    targetEntity: "facilities",
    targetField: "custom_fields.ceiling_rate",
    transform: "parse_percentage",
    confidence: 0.8,
    expectedTypes: ["percentage", "number"],
    category: "facility_rates",
  },

  // =========================================================================
  // DOCUMENT METADATA
  // =========================================================================
  {
    pattern: "document type",
    targetEntity: "documents",
    targetField: "doc_type",
    confidence: 0.95,
    category: "document_meta",
  },
  {
    pattern: "doc type",
    targetEntity: "documents",
    targetField: "doc_type",
    confidence: 0.9,
    category: "document_meta",
  },
  {
    pattern: "filename",
    targetEntity: "documents",
    targetField: "filename",
    confidence: 0.9,
    category: "document_meta",
  },
  {
    pattern: "file name",
    targetEntity: "documents",
    targetField: "filename",
    confidence: 0.95,
    category: "document_meta",
  },
  {
    pattern: "document name",
    targetEntity: "documents",
    targetField: "filename",
    confidence: 0.9,
    category: "document_meta",
  },

  // =========================================================================
  // COVENANT FIELDS
  // =========================================================================
  {
    pattern: "covenant name",
    targetEntity: "covenants",
    targetField: "name",
    confidence: 0.95,
    category: "covenant",
  },
  {
    pattern: "covenant type",
    targetEntity: "covenants",
    targetField: "type",
    confidence: 0.95,
    category: "covenant",
  },
  {
    pattern: "threshold",
    targetEntity: "covenants",
    targetField: "threshold",
    confidence: 0.85,
    category: "covenant",
  },
  {
    pattern: "metric",
    targetEntity: "covenants",
    targetField: "metric",
    confidence: 0.75,
    category: "covenant",
  },
];

// =============================================================================
// Stage Value Normalization Map
// =============================================================================

export const STAGE_NORMALIZATION_MAP: Record<string, string> = {
  // Broker / Lead stage
  lead: "broker",
  prospect: "broker",
  inquiry: "broker",
  new: "broker",
  "new lead": "broker",
  referral: "broker",
  initial: "broker",
  intake: "broker",
  "pre-qualification": "broker",
  prequalification: "broker",
  prequal: "broker",
  "pre-qual": "broker",
  interested: "broker",
  contacted: "broker",

  // Origination stage
  application: "origination",
  "in process": "origination",
  "in-process": "origination",
  processing: "origination",
  active: "origination",
  "application received": "origination",
  submitted: "origination",
  "document collection": "origination",
  "doc collection": "origination",
  "gathering docs": "origination",
  "in progress": "origination",
  "in-progress": "origination",
  pending: "origination",

  // Underwriting stage
  underwriting: "underwriting",
  uw: "underwriting",
  review: "underwriting",
  analysis: "underwriting",
  "credit review": "underwriting",
  "credit analysis": "underwriting",
  "risk review": "underwriting",
  "risk assessment": "underwriting",
  "under review": "underwriting",
  "in underwriting": "underwriting",
  evaluation: "underwriting",
  assessment: "underwriting",

  // Closing stage
  closing: "closing",
  approved: "closing",
  "approved pending closing": "closing",
  "pre-close": "closing",
  preclose: "closing",
  "closing scheduled": "closing",
  "ready to close": "closing",
  "clear to close": "closing",
  ctc: "closing",
  "docs out": "closing",
  "loan docs": "closing",
  "final approval": "closing",

  // Monitoring stage (post-close)
  monitoring: "monitoring",
  funded: "monitoring",
  closed: "monitoring",
  "closed funded": "monitoring",
  active_loan: "monitoring",
  "active loan": "monitoring",
  servicing: "monitoring",
  "in servicing": "monitoring",
  booked: "monitoring",
  disbursed: "monitoring",
  performing: "monitoring",

  // Declined / Withdrawn (would need custom handling)
  declined: "closed",
  denied: "closed",
  rejected: "closed",
  withdrawn: "closed",
  cancelled: "closed",
  lost: "closed",
  dead: "closed",
  "no go": "closed",
  "not qualified": "closed",
  disqualified: "closed",
};

// =============================================================================
// Matching Functions
// =============================================================================

/**
 * Find the best field mapping for a given column header
 */
export function findBestFieldMapping(
  header: string,
  dataType?: SpreadsheetDataType
): FieldVariation | null {
  const normalizedHeader = header.toLowerCase().trim();

  let bestMatch: FieldVariation | null = null;
  let bestScore = 0;

  for (const variation of FIELD_VARIATIONS) {
    let score = 0;

    if (variation.isRegex) {
      const regex = new RegExp(variation.pattern, "i");
      if (regex.test(normalizedHeader)) {
        score = variation.confidence * 0.9; // Slightly lower for regex matches
      }
    } else {
      // Exact match
      if (normalizedHeader === variation.pattern) {
        score = variation.confidence;
      }
      // Contains match
      else if (normalizedHeader.includes(variation.pattern)) {
        score = variation.confidence * 0.7;
      }
      // Pattern contains header
      else if (variation.pattern.includes(normalizedHeader)) {
        score = variation.confidence * 0.6;
      }
    }

    // Boost score if data type matches expected type
    if (score > 0 && dataType && variation.expectedTypes) {
      if (variation.expectedTypes.includes(dataType)) {
        score *= 1.15; // 15% boost for matching data type
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = variation;
    }
  }

  return bestMatch;
}

/**
 * Normalize a stage/status value to Open LOS stage
 */
export function normalizeStageValue(value: string): string | null {
  const normalized = value.toLowerCase().trim();
  return STAGE_NORMALIZATION_MAP[normalized] || null;
}

/**
 * Get all variations for a target field
 */
export function getVariationsForField(
  targetEntity: TargetEntity,
  targetField: string
): FieldVariation[] {
  return FIELD_VARIATIONS.filter(
    (v) => v.targetEntity === targetEntity && v.targetField === targetField
  );
}

/**
 * Get all variations by category
 */
export function getVariationsByCategory(
  category: FieldCategory
): FieldVariation[] {
  return FIELD_VARIATIONS.filter((v) => v.category === category);
}
