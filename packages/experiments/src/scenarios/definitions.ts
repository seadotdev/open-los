/**
 * Test Scenario Definitions
 *
 * Each scenario tests a specific workflow with instructions at different vagueness levels.
 * This allows us to measure how well models understand the system's conceptual structure.
 */

import type { TestScenario, InstructionVariant } from '../types.js';

export const SCENARIOS: TestScenario[] = [
  // ============================================================================
  // SCENARIO 1: Basic Deal Creation
  // Tests: Deal creation, required fields, headers
  // ============================================================================
  {
    id: 'deal-create-basic',
    name: 'Create a Basic Deal',
    description: 'Tests whether the model can create a deal with required fields',
    category: 'deal_lifecycle',

    systemContext: 'full',

    instructions: [
      {
        level: 'explicit',
        instruction: `Create a new deal with the following details:
- Borrower name: "Acme Manufacturing Ltd"
- Jurisdiction: "GB"
- Requested amount: 500000 (in cents, so this is £5,000)
- Purpose: "Working capital"

Use actor "alice@lender.com" and tenant "demo-tenant".

Provide the exact HTTP call with all headers and the JSON body.`,
      },
      {
        level: 'guided',
        instruction: `Create a deal for a company called "Acme Manufacturing Ltd" based in the UK.
They're requesting £5,000 for working capital.

Remember to include the actor and tenant headers, and the borrower_name field is required.`,
        hints: ['POST /v1/deals', 'borrower_name is required'],
      },
      {
        level: 'conversational',
        instruction: `I need to set up a new lending opportunity. Acme Manufacturing Ltd in the UK wants £5,000 for working capital. Can you create this in the system?`,
      },
      {
        level: 'vague',
        instruction: `Add Acme Manufacturing to the system, they want some money for their business.`,
      },
      {
        level: 'adversarial',
        instruction: `Create a customer record for Acme Manufacturing. Store their loan application. They need funds.`,
        hints: ['Note: "customer" and "loan application" might mislead - the entity is a "deal"'],
      },
    ],

    expectedCalls: [
      {
        method: 'POST',
        pathPattern: '^/v1/deals$',
        bodyValidation: {
          borrower_name: 'string',
        },
        critical: true,
      },
    ],

    validations: [
      {
        id: 'has-borrower-name',
        type: 'field_present',
        target: 'body.borrower_name',
        errorMessage: 'Missing required field: borrower_name',
      },
      {
        id: 'has-actor-header',
        type: 'header_present',
        target: 'X-Actor',
        errorMessage: 'Missing X-Actor header',
      },
      {
        id: 'has-tenant-header',
        type: 'header_present',
        target: 'X-Tenant-Id',
        errorMessage: 'Missing X-Tenant-Id header',
      },
    ],
  },

  // ============================================================================
  // SCENARIO 2: Stage Transition
  // Tests: Stage workflow, transition validation, sequential operations
  // ============================================================================
  {
    id: 'stage-transition',
    name: 'Progress Deal Through Stages',
    description: 'Tests stage transitions and the stage workflow understanding',
    category: 'stage_transitions',

    systemContext: 'full',

    instructions: [
      {
        level: 'explicit',
        instruction: `Move deal with ID "deal-123" from broker stage to origination stage.

POST /v1/deals/deal-123/stage-transitions
Body: { "to_stage": "origination" }

Include headers for actor "alice@lender.com" and tenant "demo-tenant".`,
      },
      {
        level: 'guided',
        instruction: `The deal "deal-123" is currently in the broker stage and needs to move to origination.
Use the stage-transitions endpoint to advance it.`,
        hints: ['POST to /v1/deals/{id}/stage-transitions', 'to_stage field needed'],
      },
      {
        level: 'conversational',
        instruction: `Deal deal-123 has passed broker review. Please advance it to the next stage in the process.`,
      },
      {
        level: 'vague',
        instruction: `Move deal-123 forward.`,
      },
      {
        level: 'adversarial',
        instruction: `Update the status of deal-123 to "in progress". Change its phase.`,
        hints: ['Note: "status" and "phase" are not the correct terms - it\'s "stage"'],
      },
    ],

    expectedCalls: [
      {
        method: 'POST',
        pathPattern: '^/v1/deals/deal-123/stage-transitions$',
        bodyValidation: {
          to_stage: 'origination',
        },
        critical: true,
      },
    ],

    validations: [
      {
        id: 'correct-endpoint',
        type: 'api_call_made',
        target: 'POST /v1/deals/{id}/stage-transitions',
        errorMessage: 'Did not use the stage-transitions endpoint',
      },
      {
        id: 'has-to-stage',
        type: 'field_present',
        target: 'body.to_stage',
        errorMessage: 'Missing to_stage field in body',
      },
      {
        id: 'valid-stage-value',
        type: 'field_value',
        target: 'body.to_stage',
        expected: 'origination',
        errorMessage: 'to_stage should be "origination"',
      },
    ],

    setup: {
      deals: [
        { id: 'deal-123', borrower_name: 'Test Company', stage: 'broker' },
      ],
    },
  },

  // ============================================================================
  // SCENARIO 3: Entity and Relationship Creation
  // Tests: Entity creation, relationship linking, ownership concept
  // ============================================================================
  {
    id: 'entity-ownership',
    name: 'Create Entity with Ownership Structure',
    description: 'Tests entity creation and relationship management',
    category: 'entity_ownership',

    systemContext: 'full',

    instructions: [
      {
        level: 'explicit',
        instruction: `Create the following corporate structure:

1. Create parent entity:
   POST /v1/entities
   { "name": "HoldCo Ltd", "type": "company", "jurisdiction": "GB" }

2. Create subsidiary entity:
   POST /v1/entities
   { "name": "OpCo Ltd", "type": "company", "jurisdiction": "GB" }

3. Create ownership relationship (HoldCo owns 100% of OpCo):
   POST /v1/relationships
   { "from_entity_id": "{parent_id}", "to_entity_id": "{child_id}", "type": "owns", "ownership_pct": 100 }

Use actor "alice@lender.com" and tenant "demo-tenant" for all calls.`,
      },
      {
        level: 'guided',
        instruction: `Set up a corporate structure where HoldCo Ltd (UK company) owns 100% of OpCo Ltd (UK company).

You'll need to:
1. Create both entities as type "company"
2. Create a relationship between them with type "owns"

The ownership percentage should be included in the relationship.`,
        hints: ['POST /v1/entities', 'POST /v1/relationships', 'ownership_pct field'],
      },
      {
        level: 'conversational',
        instruction: `I need to record that HoldCo Ltd owns OpCo Ltd completely. Both are UK companies. Can you set this up?`,
      },
      {
        level: 'vague',
        instruction: `Add HoldCo and OpCo. HoldCo is the parent.`,
      },
      {
        level: 'adversarial',
        instruction: `Create two companies and link them. One controls the other. Record the corporate hierarchy.`,
        hints: ['Note: "link" and "hierarchy" are vague - specific relationship type needed'],
      },
    ],

    expectedCalls: [
      {
        method: 'POST',
        pathPattern: '^/v1/entities$',
        bodyValidation: { type: 'company' },
        critical: true,
      },
      {
        method: 'POST',
        pathPattern: '^/v1/entities$',
        bodyValidation: { type: 'company' },
        critical: true,
      },
      {
        method: 'POST',
        pathPattern: '^/v1/relationships$',
        bodyValidation: { type: 'owns' },
        critical: true,
      },
    ],

    validations: [
      {
        id: 'parent-entity-created',
        type: 'api_call_made',
        target: 'POST /v1/entities with name HoldCo',
        errorMessage: 'Parent entity not created',
      },
      {
        id: 'child-entity-created',
        type: 'api_call_made',
        target: 'POST /v1/entities with name OpCo',
        errorMessage: 'Child entity not created',
      },
      {
        id: 'relationship-created',
        type: 'api_call_made',
        target: 'POST /v1/relationships',
        errorMessage: 'Ownership relationship not created',
      },
      {
        id: 'has-ownership-pct',
        type: 'field_present',
        target: 'relationship.body.ownership_pct',
        errorMessage: 'Missing ownership_pct in relationship',
      },
    ],
  },

  // ============================================================================
  // SCENARIO 4: Financial Spread and Ratios
  // Tests: Financial data input, minor units, ratio retrieval
  // ============================================================================
  {
    id: 'spread-ratios',
    name: 'Add Financial Data and Check Ratios',
    description: 'Tests financial spread creation and ratio calculation',
    category: 'covenant_testing',

    systemContext: 'full',

    instructions: [
      {
        level: 'explicit',
        instruction: `Add Q4 2024 financial data for deal "deal-456" and entity "entity-789":

POST /v1/deals/deal-456/spreads
{
  "entity_id": "entity-789",
  "period": "2024-Q4",
  "line_items": [
    { "category": "current_assets", "label": "Cash", "amount": 10000000 },
    { "category": "current_assets", "label": "Receivables", "amount": 5000000 },
    { "category": "current_liabilities", "label": "Payables", "amount": 8000000 },
    { "category": "total_equity", "label": "Equity", "amount": 7000000 }
  ]
}

Note: Amounts are in cents (10000000 = $100,000).

Then retrieve the computed ratios:
GET /v1/deals/deal-456/ratios`,
      },
      {
        level: 'guided',
        instruction: `Record the Q4 2024 financials for deal-456 (entity: entity-789):
- Cash: $100,000
- Receivables: $50,000
- Payables: $80,000
- Equity: $70,000

Remember amounts need to be in cents (minor units).
After creating the spread, retrieve the ratios to see the computed current ratio.`,
        hints: ['POST /v1/deals/{id}/spreads', 'GET /v1/deals/{id}/ratios', '$1 = 100 cents'],
      },
      {
        level: 'conversational',
        instruction: `I have the Q4 2024 numbers for deal-456: Cash $100k, Receivables $50k, Payables $80k, Equity $70k. Can you add these and tell me what the current ratio is?`,
      },
      {
        level: 'vague',
        instruction: `Add the financial statements for deal-456. They have $150k in assets and $80k in liabilities.`,
      },
      {
        level: 'adversarial',
        instruction: `Update the balance sheet for deal-456. Assets 150000, Liabilities 80000. Calculate their liquidity ratio.`,
        hints: ['Note: "balance sheet" suggests accounting - use "spread". Amounts might be interpreted as dollars or cents.'],
      },
    ],

    expectedCalls: [
      {
        method: 'POST',
        pathPattern: '^/v1/deals/deal-456/spreads$',
        bodyValidation: { period: 'string', line_items: 'array' },
        critical: true,
      },
      {
        method: 'GET',
        pathPattern: '^/v1/deals/deal-456/ratios$',
        critical: false,
      },
    ],

    validations: [
      {
        id: 'spread-created',
        type: 'api_call_made',
        target: 'POST /v1/deals/{id}/spreads',
        errorMessage: 'Financial spread not created',
      },
      {
        id: 'has-period',
        type: 'field_present',
        target: 'body.period',
        errorMessage: 'Missing period in spread',
      },
      {
        id: 'has-line-items',
        type: 'field_present',
        target: 'body.line_items',
        errorMessage: 'Missing line_items in spread',
      },
      {
        id: 'amounts-in-cents',
        type: 'field_type',
        target: 'body.line_items[].amount',
        expected: 'integer',
        errorMessage: 'Amounts should be integers (cents)',
      },
    ],

    setup: {
      deals: [
        { id: 'deal-456', borrower_name: 'Test Company', stage: 'underwriting' },
      ],
      entities: [
        { id: 'entity-789', name: 'Test Company', type: 'company' },
      ],
    },
  },

  // ============================================================================
  // SCENARIO 5: Covenant Creation and Testing
  // Tests: Covenant concepts, operators, threshold testing
  // ============================================================================
  {
    id: 'covenant-workflow',
    name: 'Create and Test a Covenant',
    description: 'Tests covenant creation with proper operator and threshold testing',
    category: 'covenant_testing',

    systemContext: 'full',

    instructions: [
      {
        level: 'explicit',
        instruction: `Create a covenant requiring minimum current ratio of 1.5 for deal "deal-456":

POST /v1/covenants
{
  "deal_id": "deal-456",
  "name": "Minimum Current Ratio",
  "type": "financial",
  "metric": "current_ratio",
  "operator": ">=",
  "threshold": 1.5,
  "grace_period_days": 30
}

Then test it with actual value of 1.8:

POST /v1/covenants/{covenant_id}/test
{ "actual_value": 1.8 }`,
      },
      {
        level: 'guided',
        instruction: `Set up a financial covenant for deal-456 that requires the current ratio to be at least 1.5.
Give them a 30-day grace period if they breach.

Covenant type should be "financial" and use the ">=" operator.

After creating it, test with a value of 1.8 to verify it passes.`,
        hints: ['POST /v1/covenants', 'POST /v1/covenants/{id}/test', 'operator: ">="'],
      },
      {
        level: 'conversational',
        instruction: `Deal-456 needs a covenant that their current ratio stays above 1.5. Can you set this up with a 30 day grace period? Then check if they'd pass with a ratio of 1.8.`,
      },
      {
        level: 'vague',
        instruction: `Add a current ratio requirement for deal-456. Test if they comply.`,
      },
      {
        level: 'adversarial',
        instruction: `Create a rule that deal-456 must maintain good liquidity. If their ratio is 1.8, are they compliant?`,
        hints: ['Note: "rule" and "liquidity" are vague - specific covenant type and metric needed'],
      },
    ],

    expectedCalls: [
      {
        method: 'POST',
        pathPattern: '^/v1/covenants$',
        bodyValidation: { deal_id: 'string', operator: 'string', threshold: 'number' },
        critical: true,
      },
      {
        method: 'POST',
        pathPattern: '^/v1/covenants/[^/]+/test$',
        bodyValidation: { actual_value: 'number' },
        critical: true,
      },
    ],

    validations: [
      {
        id: 'covenant-created',
        type: 'api_call_made',
        target: 'POST /v1/covenants',
        errorMessage: 'Covenant not created',
      },
      {
        id: 'has-operator',
        type: 'field_present',
        target: 'covenant.body.operator',
        errorMessage: 'Missing operator in covenant',
      },
      {
        id: 'valid-operator',
        type: 'field_value',
        target: 'covenant.body.operator',
        expected: ['>=', '>', '<=', '<', '=='],
        errorMessage: 'Invalid operator - must be >=, >, <=, <, or ==',
      },
      {
        id: 'covenant-tested',
        type: 'api_call_made',
        target: 'POST /v1/covenants/{id}/test',
        errorMessage: 'Covenant test not executed',
      },
    ],

    setup: {
      deals: [
        { id: 'deal-456', borrower_name: 'Test Company', stage: 'monitoring' },
      ],
    },
  },

  // ============================================================================
  // SCENARIO 6: Multi-Step Workflow
  // Tests: Complex workflow understanding, sequencing, data flow
  // ============================================================================
  {
    id: 'full-origination-flow',
    name: 'Complete Deal Origination Flow',
    description: 'Tests a complete workflow from deal creation to underwriting',
    category: 'multi_step_workflow',

    systemContext: 'full',

    instructions: [
      {
        level: 'explicit',
        instruction: `Execute the following origination workflow:

1. Create deal:
   POST /v1/deals
   { "borrower_name": "TechCorp Ltd", "jurisdiction": "US", "requested_amount": 100000000, "purpose": "Equipment financing" }

2. Create borrower entity:
   POST /v1/entities
   { "name": "TechCorp Ltd", "type": "company", "jurisdiction": "US" }

3. Upload term sheet:
   POST /v1/deals/{deal_id}/documents
   { "doc_type": "term_sheet", "filename": "term_sheet.pdf", "content": "base64content" }

4. Transition to origination:
   POST /v1/deals/{deal_id}/stage-transitions
   { "to_stage": "origination" }

5. Add financial spread:
   POST /v1/deals/{deal_id}/spreads
   { "entity_id": "{entity_id}", "period": "2024-Q4", "line_items": [...] }

6. Transition to underwriting:
   POST /v1/deals/{deal_id}/stage-transitions
   { "to_stage": "underwriting" }

Use actor "originator@lender.com" and tenant "techcorp-deal".`,
      },
      {
        level: 'guided',
        instruction: `Set up a complete deal for TechCorp Ltd (US company) requesting $1,000,000 for equipment financing.

Steps needed:
1. Create the deal
2. Create an entity for TechCorp
3. Upload a term sheet document
4. Move the deal from broker to origination
5. Add some financial data
6. Advance to underwriting

Remember the stage sequence: broker → origination → underwriting`,
        hints: [
          'Each stage transition needs the correct to_stage value',
          'Documents need doc_type and filename',
          'Spreads need entity_id, period, and line_items',
        ],
      },
      {
        level: 'conversational',
        instruction: `TechCorp Ltd from the US needs a $1M equipment loan. Please set them up in the system, add their documents and financials, and get them ready for underwriting.`,
      },
      {
        level: 'vague',
        instruction: `Onboard TechCorp for a loan. Get them ready for credit review.`,
      },
      {
        level: 'adversarial',
        instruction: `Add TechCorp as a client. Upload their application. Process them through to approval.`,
        hints: ['Note: "client", "application", "approval" don\'t map to the domain model'],
      },
    ],

    expectedCalls: [
      { method: 'POST', pathPattern: '^/v1/deals$', critical: true },
      { method: 'POST', pathPattern: '^/v1/entities$', critical: true },
      { method: 'POST', pathPattern: '^/v1/deals/[^/]+/documents$', critical: true },
      { method: 'POST', pathPattern: '^/v1/deals/[^/]+/stage-transitions$', critical: true },
      { method: 'POST', pathPattern: '^/v1/deals/[^/]+/spreads$', critical: false },
      { method: 'POST', pathPattern: '^/v1/deals/[^/]+/stage-transitions$', critical: true },
    ],

    validations: [
      {
        id: 'deal-created',
        type: 'api_call_made',
        target: 'POST /v1/deals',
        errorMessage: 'Deal not created',
      },
      {
        id: 'entity-created',
        type: 'api_call_made',
        target: 'POST /v1/entities',
        errorMessage: 'Entity not created',
      },
      {
        id: 'document-uploaded',
        type: 'api_call_made',
        target: 'POST /v1/deals/{id}/documents',
        errorMessage: 'Document not uploaded',
      },
      {
        id: 'stages-advanced',
        type: 'api_call_order',
        target: 'stage-transitions',
        expected: ['origination', 'underwriting'],
        errorMessage: 'Stage transitions not in correct order',
      },
    ],
  },

  // ============================================================================
  // SCENARIO 7: Document Management
  // Tests: Document types, attachment to deals
  // ============================================================================
  {
    id: 'document-upload',
    name: 'Upload Documents to Deal',
    description: 'Tests document upload and type handling',
    category: 'document_management',

    systemContext: 'full',

    instructions: [
      {
        level: 'explicit',
        instruction: `Upload two documents to deal "deal-789":

1. Financial statements:
   POST /v1/deals/deal-789/documents
   { "doc_type": "financials", "filename": "2024_financials.pdf", "content": "base64content" }

2. Term sheet:
   POST /v1/deals/deal-789/documents
   { "doc_type": "term_sheet", "filename": "term_sheet_v1.pdf", "content": "base64content" }

Use actor "analyst@lender.com" and tenant "demo-tenant".`,
      },
      {
        level: 'guided',
        instruction: `Upload the 2024 financial statements and a term sheet to deal-789.

Each document needs:
- doc_type (e.g., "financials", "term_sheet")
- filename
- content (base64 encoded)`,
        hints: ['POST /v1/deals/{id}/documents', 'doc_type is required'],
      },
      {
        level: 'conversational',
        instruction: `Please attach the financial statements and term sheet to deal-789.`,
      },
      {
        level: 'vague',
        instruction: `Add files to deal-789.`,
      },
      {
        level: 'adversarial',
        instruction: `Store the borrower's paperwork. Attach files to their loan record.`,
        hints: ['Note: "paperwork" and "loan record" don\'t map to specific concepts'],
      },
    ],

    expectedCalls: [
      { method: 'POST', pathPattern: '^/v1/deals/deal-789/documents$', critical: true },
      { method: 'POST', pathPattern: '^/v1/deals/deal-789/documents$', critical: true },
    ],

    validations: [
      {
        id: 'doc-uploaded',
        type: 'api_call_made',
        target: 'POST /v1/deals/{id}/documents',
        errorMessage: 'Document not uploaded',
      },
      {
        id: 'has-doc-type',
        type: 'field_present',
        target: 'body.doc_type',
        errorMessage: 'Missing doc_type in document upload',
      },
      {
        id: 'has-filename',
        type: 'field_present',
        target: 'body.filename',
        errorMessage: 'Missing filename in document upload',
      },
    ],

    setup: {
      deals: [
        { id: 'deal-789', borrower_name: 'Test Company', stage: 'origination' },
      ],
    },
  },
];

/**
 * Get a scenario by ID
 */
export function getScenario(id: string): TestScenario | undefined {
  return SCENARIOS.find(s => s.id === id);
}

/**
 * Get scenarios by category
 */
export function getScenariosByCategory(category: string): TestScenario[] {
  return SCENARIOS.filter(s => s.category === category);
}

/**
 * Get instruction at specific vagueness level
 */
export function getInstruction(scenario: TestScenario, level: string): InstructionVariant | undefined {
  return scenario.instructions.find(i => i.level === level);
}
