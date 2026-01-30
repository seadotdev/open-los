/**
 * Report Generation
 *
 * Aggregates simulation results and generates gap analysis reports
 * to identify where the Open LOS platform needs improvement.
 */

import type {
  SimulationResult,
  SimulationSuiteReport,
  Persona,
  BusinessModel,
} from "../types.js";

/**
 * Severity weights for priority scoring
 */
const SEVERITY_WEIGHTS = {
  blocker: 100,
  major: 50,
  minor: 10,
  enhancement: 5,
};

/**
 * Business model importance weights (based on market size/frequency)
 */
const BUSINESS_MODEL_WEIGHTS: Partial<Record<BusinessModel, number>> = {
  commercial_bank: 10,
  regional_bank: 8,
  online_lender: 7,
  equipment_finance: 6,
  asset_based_lender: 6,
  factoring_company: 5,
  trade_finance: 5,
  commercial_mortgage: 5,
  bridge_lender: 4,
  revenue_based_finance: 4,
  development_bank: 3,
  microfinance: 3,
};

/**
 * Generate a comprehensive suite report from simulation results
 */
export function generateSuiteReport(
  results: SimulationResult[],
  personas: Map<string, Persona>
): SimulationSuiteReport {
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const runAt = new Date().toISOString();

  // Calculate summary metrics
  const totalScenarios = results.length;
  const successful = results.filter((r) => r.overallSuccess).length;
  const partialSuccess = results.filter(
    (r) => !r.overallSuccess && r.summary.successfulSteps > 0
  ).length;
  const failed = results.filter(
    (r) => !r.overallSuccess && r.summary.successfulSteps === 0
  ).length;

  const totalSteps = results.reduce((sum, r) => sum + r.summary.totalSteps, 0);

  // Aggregate capability gaps
  const gapMap = new Map<
    string,
    {
      description: string;
      severity: "blocker" | "major" | "minor" | "enhancement";
      affectedPersonas: Set<string>;
      occurrences: number;
    }
  >();

  for (const result of results) {
    for (const gap of result.capabilityGaps) {
      const existing = gapMap.get(gap.capabilityId);
      if (existing) {
        existing.affectedPersonas.add(result.personaId);
        existing.occurrences++;
        // Upgrade severity if this occurrence is worse
        if (
          SEVERITY_WEIGHTS[gap.severity] > SEVERITY_WEIGHTS[existing.severity]
        ) {
          existing.severity = gap.severity;
        }
      } else {
        gapMap.set(gap.capabilityId, {
          description: gap.description,
          severity: gap.severity,
          affectedPersonas: new Set([result.personaId]),
          occurrences: 1,
        });
      }
    }
  }

  // Convert gaps to sorted list with priority scores
  const uniqueCapabilityGaps = Array.from(gapMap.entries())
    .map(([capabilityId, gap]) => {
      // Calculate priority score
      const severityScore = SEVERITY_WEIGHTS[gap.severity];
      const occurrenceScore = gap.occurrences * 5;

      // Add business model importance
      let importanceScore = 0;
      for (const personaId of gap.affectedPersonas) {
        const persona = personas.get(personaId);
        if (persona) {
          importanceScore +=
            BUSINESS_MODEL_WEIGHTS[persona.businessModel] || 1;
        }
      }

      return {
        capabilityId,
        description: gap.description,
        severity: gap.severity,
        affectedPersonas: Array.from(gap.affectedPersonas),
        occurrences: gap.occurrences,
        priorityScore: severityScore + occurrenceScore + importanceScore,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  // Group results by business model
  const resultsByBusinessModel: Record<
    string,
    { total: number; successful: number; failed: number; gaps: string[] }
  > = {};

  for (const result of results) {
    const persona = personas.get(result.personaId);
    if (!persona) continue;

    const model = persona.businessModel;
    if (!resultsByBusinessModel[model]) {
      resultsByBusinessModel[model] = {
        total: 0,
        successful: 0,
        failed: 0,
        gaps: [],
      };
    }

    resultsByBusinessModel[model].total++;
    if (result.overallSuccess) {
      resultsByBusinessModel[model].successful++;
    } else {
      resultsByBusinessModel[model].failed++;
    }

    // Add unique gaps
    for (const gap of result.capabilityGaps) {
      if (!resultsByBusinessModel[model].gaps.includes(gap.capabilityId)) {
        resultsByBusinessModel[model].gaps.push(gap.capabilityId);
      }
    }
  }

  // Group results by capability category
  const resultsByCapabilityCategory: Record<
    string,
    { tested: number; passed: number; failed: number; notSupported: number }
  > = {};

  for (const result of results) {
    for (const step of result.stepResults) {
      // Infer category from step action
      const category = inferCategoryFromAction(step.stepId);
      if (!resultsByCapabilityCategory[category]) {
        resultsByCapabilityCategory[category] = {
          tested: 0,
          passed: 0,
          failed: 0,
          notSupported: 0,
        };
      }

      resultsByCapabilityCategory[category].tested++;
      if (step.success) {
        resultsByCapabilityCategory[category].passed++;
      } else if (step.capabilityGap?.severity === "blocker") {
        resultsByCapabilityCategory[category].notSupported++;
      } else {
        resultsByCapabilityCategory[category].failed++;
      }
    }
  }

  // Generate top priority improvements
  const topPriorityImprovements = uniqueCapabilityGaps
    .slice(0, 10)
    .map((gap, index) => {
      const affectedModels = gap.affectedPersonas
        .map((pid) => personas.get(pid)?.businessModel)
        .filter((m): m is BusinessModel => !!m);

      const uniqueModels = [...new Set(affectedModels)];

      return {
        rank: index + 1,
        capabilityGap: gap.capabilityId,
        businessImpact: generateBusinessImpact(gap, uniqueModels),
        estimatedEffort: estimateEffort(gap),
        affectedBusinessModels: uniqueModels,
      };
    });

  return {
    runId,
    runAt,
    personasSimulated: new Set(results.map((r) => r.personaId)).size,
    scenariosRun: totalScenarios,
    totalSteps,
    successRate: totalScenarios > 0 ? successful / totalScenarios : 0,
    partialSuccessRate: totalScenarios > 0 ? partialSuccess / totalScenarios : 0,
    failureRate: totalScenarios > 0 ? failed / totalScenarios : 0,
    uniqueCapabilityGaps,
    resultsByBusinessModel,
    resultsByCapabilityCategory,
    topPriorityImprovements,
    results,
  };
}

/**
 * Infer capability category from step ID/action
 */
function inferCategoryFromAction(stepId: string): string {
  if (stepId.includes("deal")) return "deal_management";
  if (stepId.includes("currency") || stepId.includes("eur")) return "currency";
  if (stepId.includes("deposit")) return "deposits";
  if (stepId.includes("covenant")) return "covenants";
  if (stepId.includes("monitoring") || stepId.includes("transaction")) return "monitoring";
  if (stepId.includes("loan") || stepId.includes("disburse") || stepId.includes("repay")) return "products";
  if (stepId.includes("facility")) return "products";
  if (stepId.includes("syndic")) return "syndication";
  if (stepId.includes("stage") || stepId.includes("transition")) return "workflow";
  if (stepId.includes("entity") || stepId.includes("relationship")) return "deal_management";
  if (stepId.includes("document")) return "deal_management";
  return "other";
}

/**
 * Generate business impact description
 */
function generateBusinessImpact(
  gap: { severity: string; occurrences: number; description: string },
  affectedModels: BusinessModel[]
): string {
  const modelCount = affectedModels.length;

  if (gap.severity === "blocker") {
    return `Critical blocker affecting ${modelCount} business model(s). ${gap.description}. Must be resolved for platform to support these use cases.`;
  }

  if (gap.severity === "major") {
    return `Major functionality gap affecting ${modelCount} business model(s). ${gap.description}. Significantly limits platform capabilities for these segments.`;
  }

  return `Minor limitation affecting ${modelCount} business model(s). ${gap.description}. Would improve platform completeness.`;
}

/**
 * Estimate implementation effort
 */
function estimateEffort(gap: {
  severity: string;
  description: string;
}): "small" | "medium" | "large" | "xlarge" {
  const desc = gap.description.toLowerCase();

  // Large/XLarge efforts
  if (
    desc.includes("syndication") ||
    desc.includes("multi-currency") ||
    desc.includes("deposit")
  ) {
    return "xlarge";
  }

  if (
    desc.includes("not implemented") ||
    desc.includes("endpoint not found")
  ) {
    return "large";
  }

  // Medium efforts
  if (desc.includes("not supported") || desc.includes("validation")) {
    return "medium";
  }

  // Small efforts
  return "small";
}

/**
 * Format report as markdown
 */
export function formatReportAsMarkdown(report: SimulationSuiteReport): string {
  const lines: string[] = [];

  lines.push("# Open LOS Simulation Suite Report");
  lines.push("");
  lines.push(`**Run ID:** ${report.runId}`);
  lines.push(`**Date:** ${report.runAt}`);
  lines.push("");

  // Summary
  lines.push("## Executive Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Personas Simulated | ${report.personasSimulated} |`);
  lines.push(`| Scenarios Run | ${report.scenariosRun} |`);
  lines.push(`| Total Steps Executed | ${report.totalSteps} |`);
  lines.push(`| Success Rate | ${(report.successRate * 100).toFixed(1)}% |`);
  lines.push(`| Partial Success Rate | ${(report.partialSuccessRate * 100).toFixed(1)}% |`);
  lines.push(`| Failure Rate | ${(report.failureRate * 100).toFixed(1)}% |`);
  lines.push(`| Unique Capability Gaps | ${report.uniqueCapabilityGaps.length} |`);
  lines.push("");

  // Top Priority Improvements
  lines.push("## Top Priority Improvements");
  lines.push("");

  if (report.topPriorityImprovements.length === 0) {
    lines.push("No capability gaps detected!");
  } else {
    for (const improvement of report.topPriorityImprovements) {
      lines.push(`### ${improvement.rank}. ${improvement.capabilityGap}`);
      lines.push("");
      lines.push(`**Effort:** ${improvement.estimatedEffort.toUpperCase()}`);
      lines.push("");
      lines.push(`**Business Impact:** ${improvement.businessImpact}`);
      lines.push("");
      lines.push(`**Affected Business Models:** ${improvement.affectedBusinessModels.join(", ")}`);
      lines.push("");
    }
  }

  // Results by Business Model
  lines.push("## Results by Business Model");
  lines.push("");
  lines.push("| Business Model | Total | Success | Failed | Gap Count |");
  lines.push("|----------------|-------|---------|--------|-----------|");

  for (const [model, stats] of Object.entries(report.resultsByBusinessModel)) {
    lines.push(
      `| ${model} | ${stats.total} | ${stats.successful} | ${stats.failed} | ${stats.gaps.length} |`
    );
  }
  lines.push("");

  // Results by Capability Category
  lines.push("## Results by Capability Category");
  lines.push("");
  lines.push("| Category | Tested | Passed | Failed | Not Supported |");
  lines.push("|----------|--------|--------|--------|---------------|");

  for (const [category, stats] of Object.entries(report.resultsByCapabilityCategory)) {
    lines.push(
      `| ${category} | ${stats.tested} | ${stats.passed} | ${stats.failed} | ${stats.notSupported} |`
    );
  }
  lines.push("");

  // All Capability Gaps
  lines.push("## All Capability Gaps");
  lines.push("");

  if (report.uniqueCapabilityGaps.length === 0) {
    lines.push("No capability gaps detected!");
  } else {
    lines.push("| Capability | Severity | Occurrences | Priority Score |");
    lines.push("|------------|----------|-------------|----------------|");

    for (const gap of report.uniqueCapabilityGaps) {
      lines.push(
        `| ${gap.capabilityId} | ${gap.severity} | ${gap.occurrences} | ${gap.priorityScore} |`
      );
    }
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Format report as JSON
 */
export function formatReportAsJson(report: SimulationSuiteReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Generate a quick summary for console output
 */
export function formatQuickSummary(report: SimulationSuiteReport): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("                    SIMULATION SUITE RESULTS                    ");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`  Personas tested:     ${report.personasSimulated}`);
  lines.push(`  Scenarios run:       ${report.scenariosRun}`);
  lines.push(`  Total steps:         ${report.totalSteps}`);
  lines.push("");
  lines.push(`  Success rate:        ${(report.successRate * 100).toFixed(1)}%`);
  lines.push(`  Partial success:     ${(report.partialSuccessRate * 100).toFixed(1)}%`);
  lines.push(`  Failure rate:        ${(report.failureRate * 100).toFixed(1)}%`);
  lines.push("");

  const blockers = report.uniqueCapabilityGaps.filter(g => g.severity === "blocker");
  const majors = report.uniqueCapabilityGaps.filter(g => g.severity === "major");
  const minors = report.uniqueCapabilityGaps.filter(g => g.severity === "minor");

  lines.push("  Capability gaps:");
  lines.push(`    Blockers:          ${blockers.length}`);
  lines.push(`    Major:             ${majors.length}`);
  lines.push(`    Minor:             ${minors.length}`);
  lines.push("");

  if (report.topPriorityImprovements.length > 0) {
    lines.push("  Top 3 Priority Items:");
    for (const item of report.topPriorityImprovements.slice(0, 3)) {
      lines.push(`    ${item.rank}. [${item.estimatedEffort.toUpperCase()}] ${item.capabilityGap}`);
    }
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");

  return lines.join("\n");
}
