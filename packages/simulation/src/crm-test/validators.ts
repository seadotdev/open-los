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
    case "identifies_gap":
      return { ...base, ...validateIdentifiesGap(response, validator.config) };
    case "creative_solution":
      return { ...base, ...validateCreativeSolution(response, validator.config) };
    case "multi_entity_graph":
      return { ...base, ...validateMultiEntityGraph(response, validator.config) };
    case "risk_awareness":
      return { ...base, ...validateRiskAwareness(response, validator.config) };
    case "scratchpad_quality":
      return { ...base, ...validateScratchpadQuality(response, validator.config) };
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
 * Check that the response identifies a gap/limitation in the CLI
 */
function validateIdentifiesGap(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const gapKeywords = (config.gapKeywords as string[]) || [];
  const normalized = normalizeResponse(response);
  const lower = normalized.toLowerCase();

  // Look for explicit gap markers
  const hasGapMarker =
    lower.includes("# gap:") ||
    lower.includes("[gap]") ||
    lower.includes("not supported") ||
    lower.includes("no command for") ||
    lower.includes("doesn't support") ||
    lower.includes("does not support") ||
    lower.includes("no way to") ||
    lower.includes("limitation") ||
    lower.includes("workaround") ||
    lower.includes("not available") ||
    lower.includes("missing feature") ||
    lower.includes("cli cannot") ||
    lower.includes("cli doesn't") ||
    lower.includes("manually");

  // Check for specific gap keywords
  const foundKeywords = gapKeywords.filter((kw) =>
    lower.includes(kw.toLowerCase())
  );

  if (gapKeywords.length > 0) {
    const ratio = foundKeywords.length / gapKeywords.length;
    if (ratio >= 0.5 || hasGapMarker) {
      return {
        passed: true,
        score: Math.min(1.0, ratio + (hasGapMarker ? 0.3 : 0)),
        details: `Identified gaps: ${foundKeywords.join(", ")}${hasGapMarker ? " (with explicit marker)" : ""}`,
      };
    }
    if (ratio > 0) {
      return {
        passed: false,
        score: ratio * 0.7,
        details: `Partial gap identification: ${foundKeywords.join(", ")}`,
      };
    }
  } else if (hasGapMarker) {
    return {
      passed: true,
      score: 1.0,
      details: "Identified CLI limitation",
    };
  }

  return {
    passed: false,
    score: 0,
    details: "Did not identify any CLI limitations or gaps",
  };
}

/**
 * Check that the response provides a creative workaround (script, manual step, etc.)
 */
function validateCreativeSolution(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const solutionPatterns = (config.solutionPatterns as string[]) || [];
  const normalized = normalizeResponse(response);
  const lower = normalized.toLowerCase();

  // Look for script blocks or creative output
  const hasScript =
    /\[SCRIPT\][\s\S]*?\[\/SCRIPT\]/i.test(normalized) ||
    /```(bash|sh|python|js|javascript|jq|typescript)[\s\S]*?```/i.test(response) ||
    /\b(curl|jq|python|node|bash|awk|sed)\b.*\|/i.test(normalized) ||
    /\bfor\b.*\bdo\b/i.test(normalized) ||
    /\bwhile\b.*\bdo\b/i.test(normalized);

  const hasWorkaround =
    lower.includes("workaround") ||
    lower.includes("alternative") ||
    lower.includes("instead") ||
    lower.includes("custom") ||
    lower.includes("script") ||
    lower.includes("manual") ||
    lower.includes("pipe") ||
    lower.includes("combine") ||
    lower.includes("chain");

  // Check specific solution patterns
  const foundPatterns = solutionPatterns.filter((p) =>
    new RegExp(p, "i").test(normalized)
  );

  const score =
    (hasScript ? 0.5 : 0) +
    (hasWorkaround ? 0.2 : 0) +
    (foundPatterns.length > 0
      ? 0.3 * (foundPatterns.length / Math.max(solutionPatterns.length, 1))
      : 0);

  if (score >= 0.5) {
    return {
      passed: true,
      score: Math.min(1.0, score),
      details: `Creative solution found: ${[
        hasScript ? "script" : null,
        hasWorkaround ? "workaround described" : null,
        foundPatterns.length > 0 ? `patterns: ${foundPatterns.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("; ")}`,
    };
  }

  return {
    passed: false,
    score,
    details: hasWorkaround
      ? "Mentions workaround but no concrete solution provided"
      : "No creative solution or workaround provided",
  };
}

/**
 * Check that the response correctly models a multi-entity corporate graph
 */
function validateMultiEntityGraph(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const expectedEntities = (config.expectedEntities as string[]) || [];
  const expectedRelationships = (config.expectedRelationships as string[]) || [];
  const normalized = normalizeResponse(response);

  // Count entity create commands
  const entityCreates = (normalized.match(/los entity create/g) || []).length;

  // Count relationship create commands
  const relCreates = (normalized.match(/los relationship create/g) || []).length;

  // Check for expected entities by name/type
  const foundEntities = expectedEntities.filter((e) =>
    normalized.toLowerCase().includes(e.toLowerCase())
  );

  // Check for expected relationship types
  const foundRels = expectedRelationships.filter((r) =>
    normalized.toLowerCase().includes(r.toLowerCase())
  );

  const entityScore =
    expectedEntities.length > 0
      ? foundEntities.length / expectedEntities.length
      : entityCreates >= 2
        ? 1.0
        : 0;

  const relScore =
    expectedRelationships.length > 0
      ? foundRels.length / expectedRelationships.length
      : relCreates >= 1
        ? 1.0
        : 0;

  const score = entityScore * 0.5 + relScore * 0.5;

  return {
    passed: score >= 0.6,
    score,
    details: `Entities: ${foundEntities.length}/${expectedEntities.length || entityCreates} | ` +
      `Relationships: ${foundRels.length}/${expectedRelationships.length || relCreates}`,
  };
}

/**
 * Check that the response flags risks and concerns
 */
function validateRiskAwareness(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const riskKeywords = (config.riskKeywords as string[]) || [];
  const lower = normalizeResponse(response).toLowerCase();

  // General risk-awareness signals
  const generalSignals = [
    "risk", "caution", "warning", "note:", "important:", "careful",
    "conflict of interest", "due diligence", "compliance", "regulatory",
    "aml", "kyc", "sanctions", "fraud", "exposure", "concentration",
    "collateral", "security", "guarantee", "covenant", "breach",
    "default", "cross-default", "material adverse", "change of control",
  ];

  const foundGeneral = generalSignals.filter((s) => lower.includes(s));
  const foundSpecific = riskKeywords.filter((kw) =>
    lower.includes(kw.toLowerCase())
  );

  if (riskKeywords.length > 0) {
    const specificRatio = foundSpecific.length / riskKeywords.length;
    const score = specificRatio * 0.7 + (foundGeneral.length > 0 ? 0.3 : 0);
    return {
      passed: score >= 0.5,
      score: Math.min(1.0, score),
      details: `Risk flags: ${foundSpecific.join(", ") || "none"} | General signals: ${foundGeneral.length}`,
    };
  }

  const score = Math.min(1.0, foundGeneral.length * 0.2);
  return {
    passed: score >= 0.4,
    score,
    details: `General risk signals: ${foundGeneral.join(", ") || "none"}`,
  };
}

/**
 * Check that the response uses scratchpad/notes to reason through complexity
 */
function validateScratchpadQuality(
  response: string,
  config: Record<string, unknown>
): ValidatorReturn {
  const expectedTopics = (config.expectedTopics as string[]) || [];
  const normalized = normalizeResponse(response);
  const lower = normalized.toLowerCase();

  // Look for scratchpad markers
  const hasScratchpad =
    /\[SCRATCHPAD\][\s\S]*?\[\/SCRATCHPAD\]/i.test(normalized) ||
    /^# NOTE:/m.test(normalized) ||
    /^## /m.test(normalized) ||
    /^- /m.test(normalized) ||
    /^Step \d/m.test(normalized) ||
    /^Phase \d/m.test(normalized);

  // Look for structured reasoning
  const hasStructure =
    /\d+\.\s/m.test(normalized) || // numbered list
    /^- /m.test(normalized) || // bullet points
    /first.*then|before.*after|step \d/i.test(lower); // sequencing words

  // Check for expected analysis topics
  const foundTopics = expectedTopics.filter((t) =>
    lower.includes(t.toLowerCase())
  );
  const topicRatio =
    expectedTopics.length > 0 ? foundTopics.length / expectedTopics.length : 0;

  // Check for analysis depth — looking for multi-line reasoning
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  const nonCommandLines = lines.filter((l) => !l.trim().startsWith("los "));
  const depthScore = Math.min(1.0, nonCommandLines.length / 5); // 5+ lines of reasoning = full marks

  const score =
    (hasScratchpad ? 0.2 : 0) +
    (hasStructure ? 0.1 : 0) +
    topicRatio * 0.4 +
    depthScore * 0.3;

  return {
    passed: score >= 0.5,
    score: Math.min(1.0, score),
    details: `Scratchpad: ${hasScratchpad ? "yes" : "no"} | Structure: ${hasStructure ? "yes" : "no"} | ` +
      `Topics: ${foundTopics.length}/${expectedTopics.length} | Depth: ${nonCommandLines.length} lines`,
  };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
