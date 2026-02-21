/**
 * CRM Test Runner
 *
 * Runs test scenarios against multiple LLMs via OpenRouter and collects results.
 * Each model gets the same system prompt + user prompt and its response is
 * validated and scored.
 *
 * Supports two modes:
 * - Text mode (default): model generates CLI commands as text
 * - Tool calling mode (--tool-calling): model receives CLI commands as tool
 *   schemas and calls them with structured arguments
 */

import type {
  TestTask,
  TaskResult,
  ModelReport,
  TestSuiteReport,
  TestRunnerConfig,
  ModelConfig,
  FailurePattern,
  TaskCategory,
  ToolCall,
} from "./types.js";
import { ALL_TASKS } from "./scenarios.js";
import { runAllValidators } from "./validators.js";
import { CLI_TOOLS, toolCallsToCli } from "./tools.js";

/** ZDR-compatible models with tool calling support (verified Feb 2026) */
export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: "nvidia/nemotron-nano-9b-v2:free",
    name: "Nemotron Nano 9B v2",
    maxTokens: 2048,
    temperature: 0.1,
  },
  {
    id: "arcee-ai/trinity-mini:free",
    name: "Trinity Mini",
    maxTokens: 2048,
    temperature: 0.1,
  },
  {
    id: "upstage/solar-pro-3:free",
    name: "Solar Pro 3",
    maxTokens: 2048,
    temperature: 0.1,
  },
  {
    id: "z-ai/glm-4.5-air:free",
    name: "GLM 4.5 Air",
    maxTokens: 2048,
    temperature: 0.1,
  },
];

/** Default runner config */
export const DEFAULT_RUNNER_CONFIG: Omit<TestRunnerConfig, "apiKey"> = {
  models: DEFAULT_MODELS,
  baseUrl: "https://openrouter.ai/api/v1",
  timeoutMs: 60_000,
  retries: 2,
  concurrency: 1,
  verbose: false,
  toolCalling: false,
};

/** Shape of the OpenRouter chat completion response */
interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
      reasoning?: string | null;
      reasoning_details?: Array<{ text: string }>;
      tool_calls?: ToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call an LLM via OpenRouter's chat completion API
 */
async function callModel(
  config: TestRunnerConfig,
  model: ModelConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<{
  content: string;
  toolCalls?: ToolCall[];
  tokens?: { prompt: number; completion: number; total: number };
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();

  const body: Record<string, unknown> = {
    model: model.id,
    max_tokens: model.maxTokens,
    temperature: model.temperature,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ],
  };

  // Add tool definitions when tool calling is enabled
  if (config.toolCalling) {
    body.tools = CLI_TOOLS;
    body.tool_choice = "auto";
  }

  for (let attempt = 0; attempt <= config.retries; attempt++) {
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "HTTP-Referer": "https://github.com/seadotdev/open-los",
          "X-Title": "Open LOS CRM Model Test",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      });

      if (!response.ok) {
        const errText = await response.text();

        // Rate limited or provider error — wait and retry
        if (
          (response.status === 429 || response.status === 502 || response.status === 503) &&
          attempt < config.retries
        ) {
          const waitMs = Math.pow(2, attempt + 1) * 1000;
          if (config.verbose) {
            console.log(
              `  ${response.status} for ${model.name}, waiting ${waitMs}ms...`
            );
          }
          await sleep(waitMs);
          continue;
        }

        return {
          content: "",
          latencyMs: Date.now() - start,
          error: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
        };
      }

      const data = (await response.json()) as ChatCompletionResponse;

      const message = data.choices?.[0]?.message;
      let content = message?.content || "";

      // For reasoning models: extract from reasoning field when content is empty
      if (!content.trim() && message?.reasoning) {
        content = message.reasoning;
      }
      if (!content.trim() && message?.reasoning_details?.length) {
        content = message.reasoning_details.map((d) => d.text).join("\n");
      }

      const toolCalls = message?.tool_calls;

      const tokens = data.usage
        ? {
            prompt: data.usage.prompt_tokens,
            completion: data.usage.completion_tokens,
            total: data.usage.total_tokens,
          }
        : undefined;

      return {
        content,
        toolCalls,
        tokens,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      if (attempt < config.retries) {
        const waitMs = Math.pow(2, attempt + 1) * 1000;
        await sleep(waitMs);
        continue;
      }

      return {
        content: "",
        latencyMs: Date.now() - start,
        error:
          err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  return {
    content: "",
    latencyMs: Date.now() - start,
    error: "Max retries exceeded",
  };
}

/**
 * Run a single task against a single model
 */
async function runTask(
  config: TestRunnerConfig,
  model: ModelConfig,
  task: TestTask
): Promise<TaskResult> {
  const response = await callModel(
    config,
    model,
    task.systemContext,
    task.prompt
  );

  // In tool calling mode, convert tool calls to CLI text for validation
  let validationContent = response.content;
  if (config.toolCalling && response.toolCalls && response.toolCalls.length > 0) {
    validationContent = toolCallsToCli(response.toolCalls);
    if (config.verbose) {
      console.log(`\n    Tool calls -> CLI: ${validationContent.replace(/\n/g, " | ")}`);
    }
  }

  // Determine response type
  let responseType: TaskResult["responseType"] = "success";
  if (response.error) {
    if (response.error.includes("timeout")) {
      responseType = "timeout";
    } else {
      responseType = "error";
    }
  } else if (
    (!validationContent || validationContent.trim().length === 0) &&
    (!response.toolCalls || response.toolCalls.length === 0)
  ) {
    responseType = "empty";
  } else if (
    validationContent.toLowerCase().includes("i cannot") ||
    validationContent.toLowerCase().includes("i can't") ||
    validationContent.toLowerCase().includes("sorry, i")
  ) {
    responseType = "refusal";
  }

  // Run validators against the CLI text (whether generated directly or from tool calls)
  const { results: validatorResults, weightedScore } = runAllValidators(
    task.validators,
    validationContent
  );

  // Build raw response for reporting
  const rawResponse = config.toolCalling && response.toolCalls?.length
    ? `[TOOL CALLS]\n${JSON.stringify(response.toolCalls, null, 2)}\n\n[RECONSTRUCTED CLI]\n${validationContent}`
    : validationContent;

  return {
    taskId: task.id,
    taskName: task.name,
    category: task.category,
    difficulty: task.difficulty,
    modelId: model.id,
    rawResponse,
    validatorResults,
    score: responseType === "success" ? weightedScore : 0,
    latencyMs: response.latencyMs,
    tokens: response.tokens,
    responseType,
    error: response.error,
  };
}

/**
 * Build a model report from task results
 */
function buildModelReport(
  model: ModelConfig,
  results: TaskResult[]
): ModelReport {
  // Category scores
  const categoryMap = new Map<
    TaskCategory,
    { scores: number[]; passed: number }
  >();
  const difficultyMap = new Map<string, { scores: number[]; passed: number }>();

  for (const r of results) {
    // By category
    if (!categoryMap.has(r.category)) {
      categoryMap.set(r.category, { scores: [], passed: 0 });
    }
    const cat = categoryMap.get(r.category)!;
    cat.scores.push(r.score);
    if (r.score >= 70) cat.passed++;

    // By difficulty
    if (!difficultyMap.has(r.difficulty)) {
      difficultyMap.set(r.difficulty, { scores: [], passed: 0 });
    }
    const diff = difficultyMap.get(r.difficulty)!;
    diff.scores.push(r.score);
    if (r.score >= 70) diff.passed++;
  }

  const categoryScores: ModelReport["categoryScores"] = {} as any;
  for (const [cat, data] of categoryMap) {
    categoryScores[cat] = {
      score: avg(data.scores),
      tasksRun: data.scores.length,
      tasksPassed: data.passed,
    };
  }

  const difficultyScores: ModelReport["difficultyScores"] = {};
  for (const [diff, data] of difficultyMap) {
    difficultyScores[diff] = {
      score: avg(data.scores),
      tasksRun: data.scores.length,
      tasksPassed: data.passed,
    };
  }

  // Failure pattern detection
  const failurePatterns = detectFailurePatterns(results);

  // Token totals
  const totalTokens = results.reduce(
    (acc, r) => ({
      prompt: acc.prompt + (r.tokens?.prompt || 0),
      completion: acc.completion + (r.tokens?.completion || 0),
    }),
    { prompt: 0, completion: 0 }
  );

  const allScores = results.map((r) => r.score);
  const avgLatency = avg(results.map((r) => r.latencyMs));

  return {
    modelId: model.id,
    modelName: model.name,
    overallScore: avg(allScores),
    categoryScores,
    difficultyScores,
    failurePatterns,
    taskResults: results,
    totalTokens,
    avgLatencyMs: avgLatency,
  };
}

/**
 * Detect common failure patterns across tasks
 */
function detectFailurePatterns(results: TaskResult[]): FailurePattern[] {
  const patterns: FailurePattern[] = [];
  const failedTasks = results.filter((r) => r.score < 70);

  // Pattern: missing flags
  const missingFlagTasks = failedTasks.filter((r) =>
    r.validatorResults.some(
      (v) =>
        !v.passed &&
        (v.validatorType === "flag_present" || v.validatorType === "flag_value")
    )
  );
  if (missingFlagTasks.length >= 2) {
    patterns.push({
      pattern: "missing_flags",
      description:
        "Model frequently omits required CLI flags or provides wrong flag names",
      occurrences: missingFlagTasks.length,
      affectedTasks: missingFlagTasks.map((t) => t.taskId),
      severity: missingFlagTasks.length > 4 ? "high" : "medium",
    });
  }

  // Pattern: wrong command
  const wrongCmdTasks = failedTasks.filter((r) =>
    r.validatorResults.some(
      (v) => !v.passed && v.validatorType === "contains_command"
    )
  );
  if (wrongCmdTasks.length >= 2) {
    patterns.push({
      pattern: "wrong_command",
      description:
        "Model uses incorrect CLI commands or invents non-existent commands",
      occurrences: wrongCmdTasks.length,
      affectedTasks: wrongCmdTasks.map((t) => t.taskId),
      severity: wrongCmdTasks.length > 3 ? "high" : "medium",
    });
  }

  // Pattern: hallucination
  const hallucinationTasks = failedTasks.filter((r) =>
    r.validatorResults.some(
      (v) => !v.passed && v.validatorType === "no_hallucination"
    )
  );
  if (hallucinationTasks.length >= 1) {
    patterns.push({
      pattern: "hallucination",
      description:
        "Model invents commands or flags that don't exist in the CLI reference",
      occurrences: hallucinationTasks.length,
      affectedTasks: hallucinationTasks.map((t) => t.taskId),
      severity: "high",
    });
  }

  // Pattern: wrong sequence
  const seqTasks = failedTasks.filter((r) =>
    r.validatorResults.some(
      (v) => !v.passed && v.validatorType === "correct_sequence"
    )
  );
  if (seqTasks.length >= 1) {
    patterns.push({
      pattern: "wrong_sequence",
      description:
        "Model produces multi-step commands in the wrong order",
      occurrences: seqTasks.length,
      affectedTasks: seqTasks.map((t) => t.taskId),
      severity: "medium",
    });
  }

  // Pattern: over-specification (not using defaults)
  const defaultsTasks = failedTasks.filter((r) =>
    r.validatorResults.some(
      (v) => !v.passed && v.validatorType === "uses_defaults"
    )
  );
  if (defaultsTasks.length >= 1) {
    patterns.push({
      pattern: "over_specification",
      description:
        "Model redundantly specifies default values instead of relying on defaults",
      occurrences: defaultsTasks.length,
      affectedTasks: defaultsTasks.map((t) => t.taskId),
      severity: "low",
    });
  }

  // Pattern: empty/refusal responses
  const emptyRefusalTasks = results.filter(
    (r) => r.responseType === "empty" || r.responseType === "refusal"
  );
  if (emptyRefusalTasks.length >= 1) {
    patterns.push({
      pattern: "refusal_or_empty",
      description:
        "Model refuses to generate commands or returns empty responses",
      occurrences: emptyRefusalTasks.length,
      affectedTasks: emptyRefusalTasks.map((t) => t.taskId),
      severity: emptyRefusalTasks.length > 2 ? "high" : "medium",
    });
  }

  return patterns;
}

/**
 * Build the full suite report comparing all models
 */
function buildSuiteReport(
  modelReports: ModelReport[],
  totalTasks: number
): TestSuiteReport {
  // Sort by overall score
  const sorted = [...modelReports].sort(
    (a, b) => b.overallScore - a.overallScore
  );

  const rankings = sorted.map((report, idx) => {
    // Determine strengths (categories where score > 80)
    const strengths = Object.entries(report.categoryScores)
      .filter(([, data]) => data.score >= 80)
      .map(([cat]) => cat);

    // Determine weaknesses (categories where score < 50)
    const weaknesses = Object.entries(report.categoryScores)
      .filter(([, data]) => data.score < 50)
      .map(([cat]) => cat);

    return {
      rank: idx + 1,
      modelId: report.modelId,
      overallScore: report.overallScore,
      strengths,
      weaknesses,
    };
  });

  // Find high-variance tasks
  const taskScoresByTask = new Map<
    string,
    { name: string; scores: Record<string, number> }
  >();
  for (const report of modelReports) {
    for (const result of report.taskResults) {
      if (!taskScoresByTask.has(result.taskId)) {
        taskScoresByTask.set(result.taskId, {
          name: result.taskName,
          scores: {},
        });
      }
      taskScoresByTask.get(result.taskId)!.scores[report.modelId] =
        result.score;
    }
  }

  const highVarianceTasks = Array.from(taskScoresByTask.entries())
    .map(([taskId, data]) => {
      const scores = Object.values(data.scores);
      const spread = Math.max(...scores) - Math.min(...scores);
      return { taskId, taskName: data.name, scores: data.scores, spread };
    })
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 10);

  return {
    runId: `crm-test-${Date.now()}`,
    runAt: new Date().toISOString(),
    models: modelReports.map((r) => r.modelId),
    totalTasks,
    modelReports,
    rankings,
    highVarianceTasks,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Run the full test suite against all configured models
 */
export async function runTestSuite(
  config: TestRunnerConfig
): Promise<TestSuiteReport> {
  // Select tasks
  let tasks = ALL_TASKS;
  if (config.taskFilter && config.taskFilter.length > 0) {
    tasks = tasks.filter((t) => config.taskFilter!.includes(t.id));
  }
  if (config.categoryFilter && config.categoryFilter.length > 0) {
    tasks = tasks.filter((t) => config.categoryFilter!.includes(t.category));
  }

  const mode = config.toolCalling ? "TOOL CALLING" : "TEXT";
  console.log(`\nCRM Model Test Suite [${mode} mode]`);
  console.log(`${"=".repeat(50)}`);
  console.log(`Tasks: ${tasks.length}`);
  console.log(`Models: ${config.models.length}`);
  console.log(
    `Models: ${config.models.map((m) => m.name).join(", ")}`
  );
  console.log(`${"=".repeat(50)}\n`);

  const modelReports: ModelReport[] = [];

  for (const model of config.models) {
    console.log(`\nTesting: ${model.name} (${model.id})`);
    console.log(`${"-".repeat(40)}`);

    const results: TaskResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (config.verbose) {
        process.stdout.write(
          `  [${i + 1}/${tasks.length}] ${task.name}...`
        );
      } else {
        process.stdout.write(
          `\r  Progress: ${i + 1}/${tasks.length}`
        );
      }

      const result = await runTask(config, model, task);
      results.push(result);

      if (config.verbose) {
        const status =
          result.score >= 70
            ? "PASS"
            : result.score >= 40
              ? "PARTIAL"
              : "FAIL";
        const icon =
          result.score >= 70 ? "+" : result.score >= 40 ? "~" : "x";
        console.log(
          ` [${icon}] ${status} (${result.score.toFixed(0)}%) ${result.latencyMs}ms`
        );
      }

      // Small delay between requests to be respectful to the API
      await sleep(500);
    }

    console.log(""); // newline after progress

    const report = buildModelReport(model, results);
    modelReports.push(report);

    // Print quick summary for this model
    console.log(
      `  Score: ${report.overallScore.toFixed(1)}/100 | ` +
        `Avg latency: ${report.avgLatencyMs.toFixed(0)}ms | ` +
        `Tokens: ${report.totalTokens.prompt + report.totalTokens.completion}`
    );

    if (report.failurePatterns.length > 0) {
      console.log(`  Failure patterns:`);
      for (const p of report.failurePatterns) {
        console.log(
          `    [${p.severity}] ${p.pattern}: ${p.description} (${p.occurrences} tasks)`
        );
      }
    }
  }

  return buildSuiteReport(modelReports, tasks.length);
}

// ============================================================================
// UTILITIES
// ============================================================================

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
