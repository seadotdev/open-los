/**
 * Validation Framework
 *
 * Validates extracted API calls against expected patterns and touchpoints.
 */

import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import type {
  ValidationRule,
  ValidationResult,
  ExtractedApiCall,
  TestScenario,
  Touchpoint,
  TOUCHPOINTS,
} from '../types.js';

// Initialize AJV with common settings
const ajv = new Ajv({ allErrors: true, strict: false });

// ============================================================================
// JSON Schemas for API Request Bodies (derived from OpenAPI spec)
// ============================================================================

const API_SCHEMAS: Record<string, object> = {
  // Create Deal - POST /v1/deals
  'POST /v1/deals': {
    type: 'object',
    required: ['borrower_name'],
    properties: {
      borrower_name: { type: 'string', minLength: 1 },
      jurisdiction: { type: 'string' },
      requested_amount: { type: 'integer', minimum: 0 },
      purpose: { type: 'string' },
      borrower_registration_number: { type: 'string' },
      assigned_to: { type: 'string' },
      custom_fields: { type: 'object' },
    },
  },

  // Update Deal - PATCH /v1/deals/{id}
  'PATCH /v1/deals/{id}': {
    type: 'object',
    properties: {
      borrower_name: { type: 'string', minLength: 1 },
      jurisdiction: { type: 'string' },
      requested_amount: { type: 'integer', minimum: 0 },
      purpose: { type: 'string' },
      borrower_registration_number: { type: 'string' },
      assigned_to: { type: 'string' },
      origination_outcome: { type: 'string' },
      custom_fields: { type: 'object' },
    },
  },

  // Stage Transition - POST /v1/deals/{id}/stage-transitions
  'POST /v1/deals/{id}/stage-transitions': {
    type: 'object',
    required: ['to_stage'],
    properties: {
      to_stage: {
        type: 'string',
        enum: ['lead', 'origination', 'underwriting', 'approval', 'documentation', 'closing', 'funded', 'servicing', 'closed'],
      },
      rationale: { type: 'string' },
      override: { type: 'boolean' },
      override_rationale: { type: 'string' },
    },
  },

  // Create Entity - POST /v1/entities
  'POST /v1/entities': {
    type: 'object',
    required: ['type', 'name'],
    properties: {
      type: { type: 'string', enum: ['company', 'person'] },
      name: { type: 'string', minLength: 1 },
      legal_name: { type: 'string' },
      jurisdiction: { type: 'string' },
      registration_number: { type: 'string' },
      tax_id: { type: 'string' },
      address: { type: 'object' },
    },
  },

  // Create Relationship - POST /v1/relationships
  'POST /v1/relationships': {
    type: 'object',
    required: ['deal_id', 'entity_id', 'relationship_type'],
    properties: {
      deal_id: { type: 'string' },
      entity_id: { type: 'string' },
      relationship_type: {
        type: 'string',
        enum: ['borrower', 'guarantor', 'sponsor', 'owner', 'subsidiary', 'parent'],
      },
      ownership_pct: { type: 'number', minimum: 0, maximum: 100 },
      role: { type: 'string' },
    },
  },

  // Create Covenant - POST /v1/deals/{id}/covenants
  'POST /v1/deals/{id}/covenants': {
    type: 'object',
    required: ['name', 'type', 'metric', 'operator', 'threshold'],
    properties: {
      name: { type: 'string', minLength: 1 },
      type: { type: 'string', enum: ['financial', 'affirmative', 'negative', 'reporting'] },
      metric: { type: 'string' },
      operator: { type: 'string', enum: ['lt', 'lte', 'gt', 'gte', 'eq', 'neq', 'between'] },
      threshold: { type: 'number' },
      threshold_max: { type: 'number' },
      frequency: { type: 'string' },
      grace_period_days: { type: 'integer', minimum: 0 },
      effective_date: { type: 'string' },
    },
  },

  // Create Facility - POST /v1/facilities
  'POST /v1/facilities': {
    type: 'object',
    required: ['deal_id', 'type', 'amount'],
    properties: {
      deal_id: { type: 'string' },
      type: { type: 'string' },
      amount: { type: 'integer', minimum: 0 },
      currency: { type: 'string' },
      interest_rate: { type: 'number', minimum: 0 },
      term_months: { type: 'integer', minimum: 1 },
      start_date: { type: 'string' },
    },
  },

  // Create Loan - POST /v1/loans
  'POST /v1/loans': {
    type: 'object',
    required: ['facility_id', 'principal_amount'],
    properties: {
      facility_id: { type: 'string' },
      principal_amount: { type: 'integer', minimum: 0 },
      currency: { type: 'string' },
      interest_rate: { type: 'number', minimum: 0 },
      repayment_frequency: { type: 'string' },
      term_months: { type: 'integer', minimum: 1 },
    },
  },

  // Upload Document - POST /v1/deals/{id}/documents (JSON variant)
  'POST /v1/deals/{id}/documents': {
    type: 'object',
    required: ['doc_type', 'filename'],
    properties: {
      doc_type: { type: 'string' },
      filename: { type: 'string' },
      phase: { type: 'string' },
      label: { type: 'string' },
      content_base64: { type: 'string' },
    },
  },

  // Create Spread - POST /v1/deals/{id}/spread (JSON variant)
  'POST /v1/deals/{id}/spread': {
    type: 'object',
    required: ['entity_id', 'period', 'line_items'],
    properties: {
      entity_id: { type: 'string' },
      period: { type: 'string' },
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['category', 'label', 'amount'],
          properties: {
            category: { type: 'string' },
            label: { type: 'string' },
            amount: { type: 'integer' },
          },
        },
      },
    },
  },
};

// Compile all schemas upfront
const compiledSchemas = new Map<string, ValidateFunction>();
for (const [key, schema] of Object.entries(API_SCHEMAS)) {
  compiledSchemas.set(key, ajv.compile(schema));
}

/**
 * Run all validations for a scenario result
 */
export function validateScenarioResult(
  scenario: TestScenario,
  extractedCalls: ExtractedApiCall[]
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const rule of scenario.validations) {
    const result = runValidation(rule, extractedCalls, scenario);
    results.push(result);
  }

  return results;
}

/**
 * Run a single validation rule
 */
function runValidation(
  rule: ValidationRule,
  calls: ExtractedApiCall[],
  scenario: TestScenario
): ValidationResult {
  switch (rule.type) {
    case 'api_call_made':
      return validateApiCallMade(rule, calls);

    case 'api_call_order':
      return validateApiCallOrder(rule, calls);

    case 'field_present':
      return validateFieldPresent(rule, calls);

    case 'field_value':
      return validateFieldValue(rule, calls);

    case 'field_type':
      return validateFieldType(rule, calls);

    case 'header_present':
      return validateHeaderPresent(rule, calls);

    case 'schema_compliance':
      return validateSchemaCompliance(rule, calls);

    default:
      return {
        ruleId: rule.id,
        passed: false,
        message: `Unknown validation type: ${rule.type}`,
      };
  }
}

/**
 * Validate that a specific API call was made
 */
function validateApiCallMade(
  rule: ValidationRule,
  calls: ExtractedApiCall[]
): ValidationResult {
  // Parse target to extract method and path pattern
  const targetMatch = rule.target.match(/^(GET|POST|PATCH|PUT|DELETE)\s+(.+)$/i);

  if (!targetMatch) {
    // Target is just a path pattern
    const found = calls.some(c => c.path.includes(rule.target.replace('{id}', '')));
    return {
      ruleId: rule.id,
      passed: found,
      message: found
        ? `API call matching "${rule.target}" was made`
        : rule.errorMessage,
    };
  }

  const method = targetMatch[1].toUpperCase();
  const pathPattern = targetMatch[2]
    .replace('{id}', '[^/]+')
    .replace('{dealId}', '[^/]+')
    .replace('{entityId}', '[^/]+');

  const regex = new RegExp(pathPattern);
  const found = calls.some(c => c.method === method && regex.test(c.path));

  return {
    ruleId: rule.id,
    passed: found,
    actual: calls.map(c => `${c.method} ${c.path}`),
    expected: `${method} ${pathPattern}`,
    message: found
      ? `API call ${method} ${pathPattern} was made`
      : rule.errorMessage,
  };
}

/**
 * Validate that API calls were made in a specific order
 */
function validateApiCallOrder(
  rule: ValidationRule,
  calls: ExtractedApiCall[]
): ValidationResult {
  const expectedOrder = rule.expected as string[];
  const relevantCalls = calls.filter(c =>
    c.path.includes(rule.target) || c.body
  );

  // Extract stage values from calls
  const actualOrder: string[] = [];
  for (const call of relevantCalls) {
    if (call.body && typeof call.body === 'object' && 'to_stage' in call.body) {
      actualOrder.push((call.body as Record<string, unknown>).to_stage as string);
    }
  }

  // Check if the expected values appear in order
  let lastIndex = -1;
  let inOrder = true;
  for (const expected of expectedOrder) {
    const index = actualOrder.indexOf(expected);
    if (index === -1 || index <= lastIndex) {
      inOrder = false;
      break;
    }
    lastIndex = index;
  }

  return {
    ruleId: rule.id,
    passed: inOrder,
    actual: actualOrder,
    expected: expectedOrder,
    message: inOrder
      ? `API calls made in correct order`
      : rule.errorMessage,
  };
}

/**
 * Validate that a field is present in request body
 */
function validateFieldPresent(
  rule: ValidationRule,
  calls: ExtractedApiCall[]
): ValidationResult {
  const fieldPath = rule.target.replace('body.', '').replace('covenant.body.', '').replace('relationship.body.', '');
  const parts = fieldPath.split('.');

  for (const call of calls) {
    if (!call.body || typeof call.body !== 'object') continue;

    let current: unknown = call.body;
    let found = true;

    for (const part of parts) {
      // Handle array notation like "line_items[]"
      if (part.includes('[]')) {
        const arrayField = part.replace('[]', '');
        if (current && typeof current === 'object' && arrayField in current) {
          const arr = (current as Record<string, unknown>)[arrayField];
          if (Array.isArray(arr) && arr.length > 0) {
            current = arr[0];
            continue;
          }
        }
        found = false;
        break;
      }

      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        found = false;
        break;
      }
    }

    if (found && current !== undefined) {
      return {
        ruleId: rule.id,
        passed: true,
        actual: current,
        message: `Field "${fieldPath}" is present`,
      };
    }
  }

  return {
    ruleId: rule.id,
    passed: false,
    message: rule.errorMessage,
  };
}

/**
 * Validate that a field has a specific value
 */
function validateFieldValue(
  rule: ValidationRule,
  calls: ExtractedApiCall[]
): ValidationResult {
  const fieldPath = rule.target.replace('body.', '').replace('covenant.body.', '').replace('relationship.body.', '');

  for (const call of calls) {
    if (!call.body || typeof call.body !== 'object') continue;

    const value = getNestedValue(call.body as Record<string, unknown>, fieldPath);

    if (value !== undefined) {
      const expected = rule.expected;
      let matches = false;

      if (Array.isArray(expected)) {
        matches = expected.includes(value);
      } else {
        matches = value === expected;
      }

      if (matches) {
        return {
          ruleId: rule.id,
          passed: true,
          actual: value,
          expected,
          message: `Field "${fieldPath}" has correct value`,
        };
      }
    }
  }

  return {
    ruleId: rule.id,
    passed: false,
    expected: rule.expected,
    message: rule.errorMessage,
  };
}

/**
 * Validate field type
 */
function validateFieldType(
  rule: ValidationRule,
  calls: ExtractedApiCall[]
): ValidationResult {
  const fieldPath = rule.target.replace('body.', '');
  const expectedType = rule.expected as string;

  for (const call of calls) {
    if (!call.body || typeof call.body !== 'object') continue;

    // Handle array access like line_items[].amount
    if (fieldPath.includes('[]')) {
      const [arrayField, ...rest] = fieldPath.split('[].');
      const arr = (call.body as Record<string, unknown>)[arrayField];

      if (Array.isArray(arr) && arr.length > 0) {
        const innerField = rest.join('.');
        for (const item of arr) {
          const value = getNestedValue(item as Record<string, unknown>, innerField);
          if (!checkType(value, expectedType)) {
            return {
              ruleId: rule.id,
              passed: false,
              actual: typeof value,
              expected: expectedType,
              message: rule.errorMessage,
            };
          }
        }
        return {
          ruleId: rule.id,
          passed: true,
          message: `Field "${fieldPath}" has correct type: ${expectedType}`,
        };
      }
    }

    const value = getNestedValue(call.body as Record<string, unknown>, fieldPath);
    if (value !== undefined && checkType(value, expectedType)) {
      return {
        ruleId: rule.id,
        passed: true,
        actual: typeof value,
        expected: expectedType,
        message: `Field "${fieldPath}" has correct type: ${expectedType}`,
      };
    }
  }

  return {
    ruleId: rule.id,
    passed: false,
    expected: expectedType,
    message: rule.errorMessage,
  };
}

/**
 * Validate that a header is present
 */
function validateHeaderPresent(
  rule: ValidationRule,
  calls: ExtractedApiCall[]
): ValidationResult {
  const headerName = rule.target;

  for (const call of calls) {
    if (call.headers) {
      // Case-insensitive header check
      const hasHeader = Object.keys(call.headers).some(
        h => h.toLowerCase() === headerName.toLowerCase()
      );
      if (hasHeader) {
        return {
          ruleId: rule.id,
          passed: true,
          message: `Header "${headerName}" is present`,
        };
      }
    }
  }

  return {
    ruleId: rule.id,
    passed: false,
    message: rule.errorMessage,
  };
}

/**
 * Validate schema compliance using AJV
 *
 * Validates API call bodies against JSON schemas derived from OpenAPI spec.
 * The rule.target should specify the API endpoint pattern (e.g., "POST /v1/deals")
 */
function validateSchemaCompliance(
  rule: ValidationRule,
  calls: ExtractedApiCall[]
): ValidationResult {
  const targetEndpoint = rule.target;

  // Find matching calls for this endpoint
  const matchingCalls = findMatchingCalls(calls, targetEndpoint);

  if (matchingCalls.length === 0) {
    return {
      ruleId: rule.id,
      passed: false,
      message: `No API calls found matching "${targetEndpoint}"`,
    };
  }

  // Find the schema for this endpoint
  const schemaKey = findSchemaKey(targetEndpoint);
  const validateFn = schemaKey ? compiledSchemas.get(schemaKey) : null;

  if (!validateFn) {
    // No schema defined for this endpoint - pass with warning
    return {
      ruleId: rule.id,
      passed: true,
      message: `No schema defined for "${targetEndpoint}", skipping validation`,
    };
  }

  // Validate each matching call
  const errors: string[] = [];

  for (const call of matchingCalls) {
    if (!call.body) {
      errors.push(`Call to ${call.method} ${call.path} has no body`);
      continue;
    }

    const valid = validateFn(call.body);
    if (!valid && validateFn.errors) {
      const errorMessages = validateFn.errors.map((e: ErrorObject) => {
        const path = e.instancePath || 'root';
        return `${path}: ${e.message}`;
      });
      errors.push(`${call.method} ${call.path}: ${errorMessages.join('; ')}`);
    }
  }

  if (errors.length > 0) {
    return {
      ruleId: rule.id,
      passed: false,
      actual: errors,
      message: rule.errorMessage || `Schema validation failed: ${errors.join(', ')}`,
    };
  }

  return {
    ruleId: rule.id,
    passed: true,
    message: `Schema validation passed for ${matchingCalls.length} call(s) to "${targetEndpoint}"`,
  };
}

/**
 * Find API calls matching an endpoint pattern
 */
function findMatchingCalls(
  calls: ExtractedApiCall[],
  targetEndpoint: string
): ExtractedApiCall[] {
  const match = targetEndpoint.match(/^(GET|POST|PATCH|PUT|DELETE)\s+(.+)$/i);

  if (!match) {
    // Just a path pattern
    return calls.filter((c) => c.path.includes(targetEndpoint.replace(/\{[^}]+\}/g, '')));
  }

  const method = match[1].toUpperCase();
  const pathPattern = match[2]
    .replace(/\{[^}]+\}/g, '[^/]+')  // Replace all {param} with regex
    .replace(/\//g, '\\/');          // Escape slashes

  const regex = new RegExp(`^${pathPattern}$`);

  return calls.filter((c) => c.method === method && regex.test(c.path));
}

/**
 * Find the schema key that matches a target endpoint
 */
function findSchemaKey(targetEndpoint: string): string | null {
  // Direct match
  if (compiledSchemas.has(targetEndpoint)) {
    return targetEndpoint;
  }

  // Try normalizing the path (replace actual IDs with {id})
  const match = targetEndpoint.match(/^(GET|POST|PATCH|PUT|DELETE)\s+(.+)$/i);
  if (!match) return null;

  const method = match[1].toUpperCase();
  let path = match[2];

  // Normalize common path patterns
  path = path
    .replace(/\/v1\/deals\/[^/]+\/stage-transitions/i, '/v1/deals/{id}/stage-transitions')
    .replace(/\/v1\/deals\/[^/]+\/documents/i, '/v1/deals/{id}/documents')
    .replace(/\/v1\/deals\/[^/]+\/covenants/i, '/v1/deals/{id}/covenants')
    .replace(/\/v1\/deals\/[^/]+\/spread/i, '/v1/deals/{id}/spread')
    .replace(/\/v1\/deals\/[^/]+/i, '/v1/deals/{id}');

  const normalizedKey = `${method} ${path}`;

  if (compiledSchemas.has(normalizedKey)) {
    return normalizedKey;
  }

  return null;
}

/**
 * Helper: Get nested value from object
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Helper: Check if value matches expected type
 */
function checkType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return false;
  }
}

/**
 * Analyze touchpoint failures across results
 */
export function analyzeTouchpoints(
  results: Array<{
    scenarioId: string;
    validations: ValidationResult[];
  }>
): Map<string, { failures: number; scenarios: string[] }> {
  const touchpointMap = new Map<string, { failures: number; scenarios: string[] }>();

  for (const result of results) {
    for (const validation of result.validations) {
      if (!validation.passed) {
        const existing = touchpointMap.get(validation.ruleId) || {
          failures: 0,
          scenarios: [],
        };
        existing.failures++;
        if (!existing.scenarios.includes(result.scenarioId)) {
          existing.scenarios.push(result.scenarioId);
        }
        touchpointMap.set(validation.ruleId, existing);
      }
    }
  }

  return touchpointMap;
}
