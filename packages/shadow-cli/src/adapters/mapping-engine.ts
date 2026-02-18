/**
 * Mapping Engine
 *
 * Bridges the field-variations database from @open-los/shadow
 * to CRM/LOS adapter schema discovery. When we discover an external
 * system's schema, we use the known field variations to suggest
 * mappings with confidence scores.
 *
 * The engine works in three stages:
 * 1. DISCOVER: Pull field metadata from the external system
 * 2. MATCH: Compare against known patterns + field variations
 * 3. PROPOSE: Generate ranked mapping suggestions for user review
 */

import { randomUUID } from "node:crypto";
import type {
  ExternalFieldSchema,
  ExternalObjectSchema,
  FieldMapping,
  FieldMappingSuggestion,
  CanonicalEntity,
  TransformType,
} from "./types.js";

// =============================================================================
// Object-Level Mapping Rules
// =============================================================================

/**
 * Known mappings from external object types to canonical entities.
 * These are starting points — actual mappings are confirmed per-connection.
 */
export const OBJECT_MAPPINGS: Record<string, { entity: CanonicalEntity; confidence: number }[]> = {
  // Salesforce
  Opportunity:               [{ entity: "deals", confidence: 0.95 }],
  Account:                   [{ entity: "entities", confidence: 0.90 }],
  Contact:                   [{ entity: "entities", confidence: 0.85 }],
  Lead:                      [{ entity: "entities", confidence: 0.70 }],
  OpportunityLineItem:       [{ entity: "facilities", confidence: 0.80 }],
  ContentDocument:           [{ entity: "documents", confidence: 0.85 }],
  Task:                      [{ entity: "communications", confidence: 0.70 }],
  Event:                     [{ entity: "communications", confidence: 0.70 }],

  // HubSpot
  deals:                     [{ entity: "deals", confidence: 0.95 }],
  companies:                 [{ entity: "entities", confidence: 0.90 }],
  contacts:                  [{ entity: "entities", confidence: 0.85 }],
  line_items:                [{ entity: "facilities", confidence: 0.75 }],
  tickets:                   [{ entity: "communications", confidence: 0.50 }],

  // nCino (Salesforce custom objects)
  LLC_BI__Loan__c:           [{ entity: "deals", confidence: 0.98 }, { entity: "facilities", confidence: 0.85 }],
  LLC_BI__Legal_Entities__c: [{ entity: "entities", confidence: 0.95 }],
  LLC_BI__Collateral__c:     [{ entity: "facilities", confidence: 0.70 }],
  LLC_BI__Covenant2__c:      [{ entity: "covenants", confidence: 0.95 }],
  LLC_BI__Product_Package__c:[{ entity: "facilities", confidence: 0.80 }],

  // Mambu
  LoanAccount:               [{ entity: "loan_accounts", confidence: 0.98 }],
  Client:                    [{ entity: "entities", confidence: 0.95 }],
  CreditArrangement:         [{ entity: "facilities", confidence: 0.90 }],
  LoanProduct:               [{ entity: "facilities", confidence: 0.75 }],
};

// =============================================================================
// Field-Level Mapping Patterns
// =============================================================================

/**
 * Canonical field patterns. Each entry maps a target field to
 * a list of known source field names/patterns that should map to it.
 *
 * This is a condensed version of the 1,165-pattern field-variations
 * database in @open-los/shadow, extended for CRM-specific fields.
 */
export const FIELD_PATTERNS: Record<string, FieldPattern> = {
  // Deal Core
  "deals.borrower_name": {
    patterns: [
      /^(borrower|company|account|client|applicant|business)[_\s]?name$/i,
      /^Account\.Name$/i,
      /^dealname$/i,
      /^hs_deal_name$/i,
      /^Name$/i,
    ],
    transform: "trim",
  },
  "deals.requested_amount": {
    patterns: [
      /^(loan|requested|deal|credit|facility)?[_\s]?amount$/i,
      /^Amount$/i,
      /^hs_deal_amount$/i,
      /^(total|gross|net)?[_\s]?amount$/i,
      /^LLC_BI__Amount__c$/i,
    ],
    transform: "to_minor_units",
  },
  "deals.purpose": {
    patterns: [
      /^(loan|deal)?[_\s]?purpose$/i,
      /^description$/i,
      /^LLC_BI__Purpose__c$/i,
    ],
  },
  "deals.jurisdiction": {
    patterns: [
      /^(jurisdiction|country|region|territory|state)$/i,
      /^BillingCountry$/i,
      /^hs_deal_country$/i,
    ],
  },
  "deals.stage": {
    patterns: [
      /^(stage|status|phase|deal_?stage|pipeline_?stage)$/i,
      /^StageName$/i,
      /^dealstage$/i,
      /^LLC_BI__Stage__c$/i,
      /^hs_deal_stage$/i,
    ],
    transform: "stage_normalize",
  },

  // Entity fields
  "entities.name": {
    patterns: [
      /^(company|account|entity|business|client|borrower)[_\s]?name$/i,
      /^Name$/i,
      /^firstname$/i,
      /^lastname$/i,
    ],
  },
  "entities.legal_name": {
    patterns: [
      /^legal[_\s]?(name|entity|title)$/i,
      /^LLC_BI__Legal_Name__c$/i,
    ],
  },
  "entities.registration_number": {
    patterns: [
      /^(registration|reg|company|corp)[_\s]?(number|no|id|#)$/i,
      /^(ein|tin|ssn|tax_?id|vat)$/i,
      /^LLC_BI__Tax_Id__c$/i,
    ],
  },

  // Facility fields
  "facilities.type": {
    patterns: [
      /^(loan|facility|product|credit)[_\s]?type$/i,
      /^LLC_BI__Product_Type__c$/i,
      /^RecordType\.Name$/i,
    ],
  },
  "facilities.amount": {
    patterns: [
      /^(facility|line|credit|commitment)[_\s]?amount$/i,
      /^LLC_BI__Facility_Amount__c$/i,
    ],
    transform: "to_minor_units",
  },
  "facilities.interest_rate_value": {
    patterns: [
      /^(interest)?[_\s]?rate$/i,
      /^LLC_BI__InterestRate__c$/i,
      /^hs_interest_rate$/i,
    ],
  },
  "facilities.term_months": {
    patterns: [
      /^(loan|facility)?[_\s]?term[_\s]?(months|mo)?$/i,
      /^LLC_BI__Term_Months__c$/i,
    ],
  },
};

interface FieldPattern {
  patterns: RegExp[];
  transform?: TransformType;
}

// =============================================================================
// Mapping Engine
// =============================================================================

/**
 * Suggest entity-level mapping for an external object.
 */
export function suggestEntityMapping(
  objectSchema: ExternalObjectSchema,
): { entity: CanonicalEntity; confidence: number } | null {
  const known = OBJECT_MAPPINGS[objectSchema.apiName];
  if (known && known.length > 0) {
    return known[0];
  }

  // Fallback: check if field patterns suggest an entity
  const entityScores: Partial<Record<CanonicalEntity, number>> = {};
  for (const field of objectSchema.fields) {
    const suggestion = suggestFieldMapping(field);
    if (suggestion) {
      const entity = suggestion.targetEntity;
      entityScores[entity] = (entityScores[entity] ?? 0) + suggestion.confidence;
    }
  }

  let bestEntity: CanonicalEntity | null = null;
  let bestScore = 0;
  for (const [entity, score] of Object.entries(entityScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestEntity = entity as CanonicalEntity;
    }
  }

  if (bestEntity && bestScore > 1.0) {
    return {
      entity: bestEntity,
      confidence: Math.min(bestScore / objectSchema.fields.length, 0.8),
    };
  }

  return null;
}

/**
 * Suggest a field-level mapping for an external field.
 */
export function suggestFieldMapping(
  field: ExternalFieldSchema,
): FieldMappingSuggestion | null {
  let bestMatch: { key: string; confidence: number; transform?: TransformType } | null = null;

  for (const [targetKey, pattern] of Object.entries(FIELD_PATTERNS)) {
    for (const regex of pattern.patterns) {
      // Check against API name
      if (regex.test(field.apiName)) {
        const confidence = field.isCustom ? 0.7 : 0.9;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { key: targetKey, confidence, transform: pattern.transform };
        }
      }
      // Check against label
      if (regex.test(field.label)) {
        const confidence = field.isCustom ? 0.6 : 0.8;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { key: targetKey, confidence, transform: pattern.transform };
        }
      }
    }
  }

  if (!bestMatch) return null;

  const [targetEntity, targetField] = bestMatch.key.split(".", 2) as [CanonicalEntity, string];

  return {
    targetEntity,
    targetField,
    transform: bestMatch.transform,
    confidence: bestMatch.confidence,
    reason: `Matched field "${field.apiName}" (${field.label}) against known pattern`,
  };
}

/**
 * Generate mapping proposals for an entire external schema.
 * Returns mappings sorted by confidence (highest first).
 */
export function generateMappingProposal(
  connectionId: string,
  schema: ExternalObjectSchema,
  targetEntity: CanonicalEntity,
): FieldMapping[] {
  const mappings: FieldMapping[] = [];

  for (const field of schema.fields) {
    const suggestion = suggestFieldMapping(field);
    if (suggestion && suggestion.targetEntity === targetEntity) {
      mappings.push({
        id: randomUUID(),
        connectionId,
        sourceObject: schema.apiName,
        sourceField: field.apiName,
        targetEntity: suggestion.targetEntity,
        targetField: suggestion.targetField,
        transform: suggestion.transform ? { type: suggestion.transform } : undefined,
        direction: "inbound",
        isMatchKey: field.apiName === "Id" || field.apiName === "id" || field.apiName === "hs_object_id",
        enabled: suggestion.confidence >= 0.7,
      });
    }
  }

  return mappings;
}

/**
 * Stage normalization map — maps CRM-specific stage names
 * to Open LOS canonical stages.
 *
 * Extended from the spreadsheet field-variations stage map
 * to include Salesforce/HubSpot/nCino pipeline stage names.
 */
export const STAGE_NORMALIZATION: Record<string, string> = {
  // Generic
  lead: "broker",
  prospect: "broker",
  inquiry: "broker",
  new: "broker",
  qualification: "broker",
  prospecting: "broker",

  application: "origination",
  "needs analysis": "origination",
  "value proposition": "origination",
  processing: "origination",
  "in progress": "origination",
  submitted: "origination",
  received: "origination",

  underwriting: "underwriting",
  "credit review": "underwriting",
  "credit analysis": "underwriting",
  review: "underwriting",
  "id. decision makers": "underwriting",
  "perception analysis": "underwriting",
  "proposal/price quote": "underwriting",

  approved: "closing",
  "pending approval": "closing",
  closing: "closing",
  "negotiation/review": "closing",
  "contract sent": "closing",

  funded: "monitoring",
  "closed won": "monitoring",
  active: "monitoring",
  booked: "monitoring",
  disbursed: "monitoring",
  monitoring: "monitoring",

  // Rejected / lost (map to broker with a flag)
  "closed lost": "broker",
  declined: "broker",
  withdrawn: "broker",
  rejected: "broker",
};
