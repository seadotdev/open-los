/**
 * Validators for CRM Test Harness
 *
 * Each validator checks a specific aspect of the LLM's CLI command output.
 * Validators return a score from 0.0 to 1.0 indicating how well the response
 * matches the expectation.
 */

import type { Validator, ValidatorResult } from "./types.js";

/**
 * Run a single validator against a response
 */
export function runValidator(
  validator: Validator,
  response: string
): ValidatorResult {
  const base: Omit<ValidatorResult, "passed" | "score" | "details"> = {
    validatorType: validator.type,
    description: validator.description,
    weight: validator.weight,
  };

  switch (validator.type) {
    case "contains_command":
      return { ...base, ...validateContainsCommand(response, validator.config) };
    case "command_structure":
      return { ...base, ...validateCommandStructure(response, validator.config) };
    case "flag_present":
      return { ...base, ...validateFlagPresent(response, validator.config) };
    case "flag_value":
      return { ...base, ...validateFlagValue(response, validator.config) };
    case "no_hallucination":
      return { ...base, ...validateNoHallucination(response, validator.config) };
    case "json_parseable":
      return { ...base, ...validateJsonParseable(response, validator.config) };
    case "correct_sequence":
      return { ...base, ...validateCorrectSequence(response, validator.config) };
    case "uses_defaults":
      return { ...base, ...validateUsesDefaults(response, validator.config) };
    case "error_handling":
      return { ...base, ...validateErrorHandling(response, validator.config) };
    case "id_reference":
      return { ...base, ...validateIdReference(response, validator.config) };
    case "regex_match":
      return { ...base, ...validateRegexMatch(response, validator.config) };
    default:
      return {
        ...base,
        passed: false,
        score: 0,
        details: `Unknown validator type: ${validator.type}`,
      };
  }
}

/**
 * Run all validators for a task against a response
 */
export function runAllValidators(
  validators: Validator[],
  response: string
): { results: ValidatorResult[]; weightedScore: number } {
  const results = validators.map((v) => runValidator(v, response));

  // Calculate weighted score
  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  const weightedSum = results.reduce((sum, r) => sum + r.score * r.weight, 0);
  const weightedScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;

  return { results, weightedScore };
}

// ============================================================================
// VALIDATOR IMPLEMENTATIONS
// ============================================================================

type ValidatorReturn = Pick<ValidatorResult, "passed" | "score" | "details">;

/**
 * Check if the response contains a specific CLI command pattern
 */
function validateContainsCommand(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const pattern = config.pattern as string;
  const normalized = normalizeResponse(response);

  if (normalized.includes(pattern)) {
    return {
      passed: true,
      score: 1.0,
      details: `Found command: ${pattern}`,
    };
  }

  // Partial match — check if the words are present but maybe in wrong order
  const words = pattern.split(" ");
  const allWordsPresent = words.every((w) => normalized.includes(w));
  if (allWordsPresent) {
    return {
      passed: false,
      score: 0.5,
      details: `Words present but not as exact command: ${pattern}`,
    };
  }

  return {
    passed: false,
    score: 0,
    details: `Command not found: ${pattern}`,
  };
}

/**
 * Check if a CLI command has the correct structure
 */
function validateCommandStructure(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const command = config.command as string;
  const requiredParts = config.requiredParts as string[];
  const normalized = normalizeResponse(response);

  const hasCommand = normalized.includes(command);
  if (!hasCommand) {
    return {
      passed: false,
      score: 0,
      details: `Base command not found: ${command}`,
    };
  }

  if (!requiredParts || requiredParts.length === 0) {
    return { passed: true, score: 1.0, details: "Command structure correct" };
  }

  const found = requiredParts.filter((p) => normalized.includes(p));
  const ratio = found.length / requiredParts.length;

  return {
    passed: ratio >= 1.0,
    score: ratio,
    details:
      ratio >= 1.0
        ? "All required parts present"
        : `Missing: ${requiredParts.filter((p) => !found.includes(p)).join(", ")}`,
  };
}

/**
 * Check if a specific flag is present in any command
 */
function validateFlagPresent(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const flags = config.flags as string[];
  const normalized = normalizeResponse(response);

  for (const flag of flags) {
    // Match flag followed by space, equals, or end of string
    const flagRegex = new RegExp(`${escapeRegex(flag)}(\\s|=|$)`, "m");
    if (flagRegex.test(normalized)) {
      return {
        passed: true,
        score: 1.0,
        details: `Found flag: ${flag}`,
      };
    }
  }

  return {
    passed: false,
    score: 0,
    details: `None of these flags found: ${flags.join(", ")}`,
  };
}

/**
 * Check if a flag has a value matching a pattern
 */
function validateFlagValue(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const flags = config.flags as string[];
  const pattern = config.pattern as string;
  const normalized = normalizeResponse(response);

  for (const flag of flags) {
    // Try to extract the value after the flag
    // Handles: --flag value, --flag=value, --flag "value", --flag 'value'
    const valueRegex = new RegExp(
      `${escapeRegex(flag)}[=\\s]+(?:"([^"]*?)"|'([^']*?)'|(\\S+))`,
      "m"
    );
    const match = normalized.match(valueRegex);

    if (match) {
      const value = match[1] || match[2] || match[3] || "";
      const patternRegex = new RegExp(pattern, "i");
      if (patternRegex.test(value)) {
        return {
          passed: true,
          score: 1.0,
          details: `Flag ${flag} has matching value: "${value}"`,
        };
      } else {
        return {
          passed: false,
          score: 0.3,
          details: `Flag ${flag} present but value "${value}" doesn't match pattern "${pattern}"`,
        };
      }
    }
  }

  // Check if the pattern appears anywhere in the response (partial credit)
  const patternRegex = new RegExp(pattern, "i");
  if (patternRegex.test(normalized)) {
    return {
      passed: false,
      score: 0.2,
      details: `Pattern "${pattern}" found in response but not after expected flags: ${flags.join(", ")}`,
    };
  }

  return {
    passed: false,
    score: 0,
    details: `Pattern "${pattern}" not found after flags: ${flags.join(", ")}`,
  };
}

/**
 * Check that the response doesn't hallucinate non-existent commands or flags
 */
function validateNoHallucination(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const invalidPatterns = (config.invalidPatterns as string[]) || [];
  const validCommands = (config.validCommands as string[]) || [];
  const normalized = normalizeResponse(response);

  // Check for explicitly invalid patterns
  const foundInvalid: string[] = [];
  for (const pattern of invalidPatterns) {
    if (normalized.includes(pattern)) {
      foundInvalid.push(pattern);
    }
  }

  if (foundInvalid.length > 0) {
    return {
      passed: false,
      score: 0,
      details: `Hallucinated commands/patterns: ${foundInvalid.join(", ")}`,
    };
  }

  // If valid commands are provided, check that any "los" commands are from the valid list
  if (validCommands.length > 0) {
    const losCommands = normalized.match(/los\s+\w+(?:\s+\w+)?/g) || [];
    const invalidCmds = losCommands.filter(
      (cmd) => !validCommands.some((valid) => cmd.startsWith(valid))
    );

    if (invalidCmds.length > 0) {
      return {
        passed: false,
        score: 0.3,
        details: `Possibly invented commands: ${invalidCmds.join(", ")}`,
      };
    }
  }

  return {
    passed: true,
    score: 1.0,
    details: "No hallucinated commands detected",
  };
}

/**
 * Check if response contains parseable JSON
 */
function validateJsonParseable(
  response: string,
  _config: Record<string, unknown>
): ValidatorReturn {
  // Try to find JSON in the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      passed: false,
      score: 0,
      details: "No JSON found in response",
    };
  }

  try {
    JSON.parse(jsonMatch[0]);
    return {
      passed: true,
      score: 1.0,
      details: "Valid JSON found",
    };
  } catch {
    return {
      passed: false,
      score: 0.3,
      details: "JSON-like content found but not parseable",
    };
  }
}

/**
 * Check that multiple commands/patterns appear in the correct order
 */
function validateCorrectSequence(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const before = config.before as string;
  const after = config.after as string;
  const normalized = normalizeResponse(response);

  const beforeIdx = normalized.indexOf(before);
  const afterIdx = normalized.indexOf(after);

  if (beforeIdx === -1 && afterIdx === -1) {
    return {
      passed: false,
      score: 0,
      details: `Neither "${before}" nor "${after}" found`,
    };
  }

  if (beforeIdx === -1) {
    return {
      passed: false,
      score: 0.2,
      details: `"${before}" not found (needed before "${after}")`,
    };
  }

  if (afterIdx === -1) {
    return {
      passed: false,
      score: 0.2,
      details: `"${after}" not found (needed after "${before}")`,
    };
  }

  if (beforeIdx < afterIdx) {
    return {
      passed: true,
      score: 1.0,
      details: `Correct order: "${before}" before "${after}"`,
    };
  }

  return {
    passed: false,
    score: 0.3,
    details: `Wrong order: "${after}" appears before "${before}"`,
  };
}

/**
 * Check that the response doesn't redundantly specify default values
 */
function validateUsesDefaults(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const unnecessaryFlags = config.unnecessaryFlags as string[];
  const normalized = normalizeResponse(response);

  const foundUnnecessary: string[] = [];
  for (const flag of unnecessaryFlags) {
    if (normalized.includes(flag)) {
      foundUnnecessary.push(flag);
    }
  }

  if (foundUnnecessary.length === 0) {
    return {
      passed: true,
      score: 1.0,
      details: "Correctly relies on defaults",
    };
  }

  // Partial credit based on how many unnecessary flags were specified
  const ratio = 1 - foundUnnecessary.length / unnecessaryFlags.length;
  return {
    passed: false,
    score: Math.max(ratio, 0),
    details: `Redundantly specified defaults: ${foundUnnecessary.join(", ")}`,
  };
}

/**
 * Check error handling suggestions
 */
function validateErrorHandling(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const expectedFix = config.expectedFix as string;
  const normalized = normalizeResponse(response);

  if (normalized.includes(expectedFix)) {
    return {
      passed: true,
      score: 1.0,
      details: "Correct error recovery suggestion",
    };
  }

  return {
    passed: false,
    score: 0,
    details: `Expected fix not found: ${expectedFix}`,
  };
}

/**
 * Check that IDs from context are correctly referenced
 */
function validateIdReference(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const expectedId = config.expectedId as string;
  const normalized = normalizeResponse(response);

  if (normalized.includes(expectedId)) {
    return {
      passed: true,
      score: 1.0,
      details: `Correctly references ID: ${expectedId}`,
    };
  }

  return {
    passed: false,
    score: 0,
    details: `ID not referenced: ${expectedId}`,
  };
}

/**
 * Generic regex match validator
 */
function validateRegexMatch(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const pattern = config.pattern as string;
  const normalized = normalizeResponse(response);
  const regex = new RegExp(pattern, "i");

  if (regex.test(normalized)) {
    return {
      passed: true,
      score: 1.0,
      details: `Pattern matched: ${pattern}`,
    };
  }

  return {
    passed: false,
    score: 0,
    details: `Pattern not matched: ${pattern}`,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Normalize a response for matching:
 * - Strip markdown code blocks
 * - Collapse whitespace
 * - Lowercase where needed
 */
function normalizeResponse(response: string): string {
  return (
    response
      // Remove markdown code fences but keep content
      .replace(/```[\w]*\n?/g, "")
      // Don't lowercase — commands and flag values are case-sensitive
      // Just collapse runs of whitespace into single spaces per line
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
  );
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
