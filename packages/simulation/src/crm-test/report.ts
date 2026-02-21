/**
 * CRM Test Report Formatter
 *
 * Generates human-readable reports from test suite results,
 * highlighting where each model struggles and excels.
 */

import type { TestSuiteReport, ModelReport, TaskCategory } from "./types.js";

/** Category display names */
const CATEGORY_LABELS: Record<TaskCategory, string> = {
  deal_creation: "Deal Creation",
  deal_query: "Deal Queries",
  deal_update: "Deal Updates",
  entity_management: "Entity Management",
  relationship_management: "Relationships",
  document_management: "Documents",
  stage_transitions: "Stage Transitions",
  financial_spreading: "Financial Spreading",
  covenant_management: "Covenants",
  facility_management: "Facilities",
  loan_lifecycle: "Loan Lifecycle",
  monitoring: "Monitoring",
  multi_step_workflow: "Multi-Step Workflows",
  error_recovery: "Error Recovery",
  defaults_understanding: "Defaults Understanding",
};

/**
 * Format the full report as a console-friendly summary
 */
export function formatConsoleSummary(report: TestSuiteReport): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("=" .repeat(70));
  lines.push("  CRM MODEL TEST RESULTS");
  lines.push("=".repeat(70));
  lines.push(`  Run: ${report.runId}`);
  lines.push(`  Date: ${report.runAt}`);
  lines.push(`  Tasks: ${report.totalTasks} | Models: ${report.models.length}`);
  lines.push("=".repeat(70));

  // Rankings
  lines.push("");
  lines.push("  RANKINGS");
  lines.push("  " + "-".repeat(66));
  lines.push(
    "  " +
      "Rank".padEnd(6) +
      "Model".padEnd(30) +
      "Score".padEnd(10) +
      "Grade"
  );
  lines.push("  " + "-".repeat(66));

  for (const r of report.rankings) {
    const grade = getGrade(r.overallScore);
    const scoreStr = `${r.overallScore.toFixed(1)}%`;
    lines.push(
      "  " +
        `#${r.rank}`.padEnd(6) +
        r.modelId.slice(0, 28).padEnd(30) +
        scoreStr.padEnd(10) +
        grade
    );
  }

  // Per-model breakdown
  for (const modelReport of report.modelReports) {
    lines.push("");
    lines.push("-".repeat(70));
    lines.push(`  ${modelReport.modelName} (${modelReport.modelId})`);
    lines.push("-".repeat(70));
    lines.push(
      `  Overall: ${modelReport.overallScore.toFixed(1)}% | ` +
        `Latency: ${modelReport.avgLatencyMs.toFixed(0)}ms avg | ` +
        `Tokens: ${modelReport.totalTokens.prompt + modelReport.totalTokens.completion}`
    );

    // Category breakdown
    lines.push("");
    lines.push("  Category Scores:");
    lines.push(
      "  " +
        "Category".padEnd(25) +
        "Score".padEnd(10) +
        "Pass".padEnd(8) +
        "Bar"
    );
    lines.push("  " + "-".repeat(60));

    const sortedCategories = Object.entries(modelReport.categoryScores)
      .sort(([, a], [, b]) => b.score - a.score);

    for (const [cat, data] of sortedCategories) {
      const label = CATEGORY_LABELS[cat as TaskCategory] || cat;
      const scoreStr = `${data.score.toFixed(0)}%`;
      const passStr = `${data.tasksPassed}/${data.tasksRun}`;
      const bar = makeBar(data.score, 20);
      lines.push(
        "  " +
          label.padEnd(25) +
          scoreStr.padEnd(10) +
          passStr.padEnd(8) +
          bar
      );
    }

    // Difficulty breakdown
    lines.push("");
    lines.push("  Difficulty Scores:");
    for (const [diff, data] of Object.entries(modelReport.difficultyScores)) {
      const scoreStr = `${data.score.toFixed(0)}%`;
      const passStr = `${data.tasksPassed}/${data.tasksRun}`;
      lines.push(
        `    ${diff.padEnd(10)} ${scoreStr.padEnd(10)} ${passStr}`
      );
    }

    // Failure patterns
    if (modelReport.failurePatterns.length > 0) {
      lines.push("");
      lines.push("  Failure Patterns:");
      for (const p of modelReport.failurePatterns) {
        const icon = p.severity === "high" ? "!!!" : p.severity === "medium" ? " !!" : "  !";
        lines.push(`    ${icon} ${p.pattern} (${p.occurrences} tasks)`);
        lines.push(`        ${p.description}`);
      }
    }

    // Worst performing tasks
    const worstTasks = [...modelReport.taskResults]
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    if (worstTasks.some((t) => t.score < 70)) {
      lines.push("");
      lines.push("  Lowest Scoring Tasks:");
      for (const t of worstTasks) {
        if (t.score >= 70) continue;
        lines.push(
          `    ${t.score.toFixed(0).padStart(3)}%  ${t.taskName} [${t.category}]`
        );
      }
    }
  }

  // High variance tasks (where models differ most)
  if (report.highVarianceTasks.length > 0) {
    lines.push("");
    lines.push("=".repeat(70));
    lines.push("  HIGH VARIANCE TASKS (models differ most)");
    lines.push("=".repeat(70));

    for (const task of report.highVarianceTasks.slice(0, 5)) {
      if (task.spread < 20) continue; // Only show significant differences
      lines.push(`  ${task.taskName} (spread: ${task.spread.toFixed(0)}%)`);
      for (const [modelId, score] of Object.entries(task.scores)) {
        const shortModel = modelId.split("/").pop() || modelId;
        lines.push(`    ${shortModel.padEnd(30)} ${score.toFixed(0)}%`);
      }
      lines.push("");
    }
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Format report as JSON for file output
 */
export function formatJsonReport(report: TestSuiteReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format a detailed per-model report showing each task's response
 */
export function formatDetailedReport(report: TestSuiteReport): string {
  const lines: string[] = [];

  for (const modelReport of report.modelReports) {
    lines.push(`\n${"#".repeat(70)}`);
    lines.push(`# ${modelReport.modelName}`);
    lines.push(`${"#".repeat(70)}\n`);

    for (const task of modelReport.taskResults) {
      lines.push(`--- ${task.taskName} (${task.taskId}) ---`);
      lines.push(`Score: ${task.score.toFixed(0)}% | Category: ${task.category} | Difficulty: ${task.difficulty}`);
      lines.push(`Response type: ${task.responseType} | Latency: ${task.latencyMs}ms`);
      lines.push("");
      lines.push("Response:");
      lines.push(task.rawResponse || "(empty)");
      lines.push("");
      lines.push("Validators:");
      for (const v of task.validatorResults) {
        const icon = v.passed ? "PASS" : "FAIL";
        lines.push(
          `  [${icon}] ${v.description}: ${v.details} (score: ${v.score.toFixed(2)}, weight: ${v.weight})`
        );
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ============================================================================
// UTILITIES
// ============================================================================

function getGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  if (score >= 50) return "E";
  return "F";
}

function makeBar(score: number, width: number): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  return "[" + "#".repeat(filled) + ".".repeat(empty) + "]";
}
