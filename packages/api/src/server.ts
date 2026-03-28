import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  AppError,
  createCoreServiceGraph,
} from "@open-los/core";
import type { CoreServiceGraph } from "@open-los/core";
import type { LLMConfig, LLMProvider, LLMRouteConfig } from "@open-los/agent";
import { dealRoutes } from "./routes/deals.js";
import { documentRoutes } from "./routes/documents.js";
import { auditRoutes } from "./routes/audit.js";
import { stageRoutes } from "./routes/stages.js";
import { entityRoutes } from "./routes/entities.js";
import { relationshipRoutes } from "./routes/relationships.js";
import { templateRoutes } from "./routes/templates.js";
import { underwritingRoutes } from "./routes/underwriting.js";
import { covenantRoutes } from "./routes/covenants.js";
import { monitoringRoutes } from "./routes/monitoring.js";
import { emailRoutes } from "./routes/email.js";
import { loanRoutes } from "./routes/loans.js";
import { facilityRoutes } from "./routes/facilities.js";
import { sandboxRoutes } from "./routes/sandboxes.js";
import { depositRoutes } from "./routes/deposits.js";
import { gateRoutes } from "./routes/gates.js";
import { settingsRoutes } from "./routes/settings.js";
import { chatRoutes } from "./routes/chat.js";
import { decisionTraceRoutes } from "./routes/decision-traces.js";

export interface AppContext extends CoreServiceGraph {
  users?: Map<string, { id: string; role: string }>;
  llmConfig?: LLMConfig;
}

const LLM_PROVIDER_ORDER: LLMProvider[] = ["anthropic", "openrouter", "openai", "vercel"];

function isLLMProvider(value: unknown): value is LLMProvider {
  return typeof value === "string" && LLM_PROVIDER_ORDER.includes(value as LLMProvider);
}

function parseRoutes(raw: string | undefined): Record<string, LLMRouteConfig> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<LLMRouteConfig>>;
    const routes: Record<string, LLMRouteConfig> = {};
    for (const [functionName, route] of Object.entries(parsed)) {
      if (!route || !isLLMProvider(route.provider) || typeof route.model !== "string") continue;
      routes[functionName] = {
        provider: route.provider,
        model: route.model,
        apiKey: route.apiKey,
        baseURL: route.baseURL,
        fallbackModels: Array.isArray(route.fallbackModels) ? route.fallbackModels : undefined,
        providerOptions: route.providerOptions,
      };
    }
    return Object.keys(routes).length > 0 ? routes : undefined;
  } catch (err) {
    console.warn("Invalid LOS_LLM_ROUTES JSON; ignoring route overrides", err);
    return undefined;
  }
}

export function buildLLMConfigFromEnv(): LLMConfig | undefined {
  const apiKeys: Record<string, string> = {
    ...(process.env.ANTHROPIC_API_KEY && { anthropic: process.env.ANTHROPIC_API_KEY }),
    ...(process.env.OPENROUTER_API_KEY && { openrouter: process.env.OPENROUTER_API_KEY }),
    ...(process.env.OPENAI_API_KEY && { openai: process.env.OPENAI_API_KEY }),
    ...(process.env.AI_GATEWAY_API_KEY && { vercel: process.env.AI_GATEWAY_API_KEY }),
  };
  if (Object.keys(apiKeys).length === 0) return undefined;

  const configuredDefault = process.env.LOS_DEFAULT_PROVIDER;
  const defaultProvider = (
    configuredDefault && isLLMProvider(configuredDefault) && apiKeys[configuredDefault]
      ? configuredDefault
      : LLM_PROVIDER_ORDER.find((provider) => apiKeys[provider])
  ) as LLMProvider;

  return {
    defaultProvider,
    defaultModel: process.env.LOS_DEFAULT_MODEL ?? "claude-sonnet-4-5-20250929",
    apiKeys,
    baseURLs: {
      ...(process.env.LOS_ANTHROPIC_BASE_URL && { anthropic: process.env.LOS_ANTHROPIC_BASE_URL }),
      ...(process.env.LOS_OPENROUTER_BASE_URL && { openrouter: process.env.LOS_OPENROUTER_BASE_URL }),
      ...(process.env.OPENAI_BASE_URL && { openai: process.env.OPENAI_BASE_URL }),
      ...(process.env.LOS_VERCEL_BASE_URL && { vercel: process.env.LOS_VERCEL_BASE_URL }),
    },
    routes: parseRoutes(process.env.LOS_LLM_ROUTES),
  };
}

function getCorsOrigins(): string[] | undefined {
  const raw = process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN;
  if (!raw || raw.trim() === "" || raw.trim() === "*") {
    return undefined;
  }
  const origins = raw.split(",").map((origin) => origin.trim()).filter(Boolean);
  return origins.length > 0 ? origins : undefined;
}

export function createApp(ctx: AppContext) {
  const app = new Hono();

  // CORS
  const corsOrigins = getCorsOrigins();
  app.use("*", cors(corsOrigins ? { origin: corsOrigins } : undefined));

  // Mount routes
  app.route("/v1", dealRoutes(ctx));
  app.route("/v1", documentRoutes(ctx));
  app.route("/v1", auditRoutes(ctx));
  app.route("/v1", stageRoutes(ctx));
  app.route("/v1", entityRoutes(ctx));
  app.route("/v1", relationshipRoutes(ctx));
  app.route("/v1", templateRoutes(ctx));
  app.route("/v1", underwritingRoutes(ctx));
  app.route("/v1", covenantRoutes(ctx));
  app.route("/v1", monitoringRoutes(ctx));
  app.route("/v1", emailRoutes(ctx));
  app.route("/v1", loanRoutes(ctx));
  app.route("/v1", facilityRoutes(ctx));
  app.route("/v1", sandboxRoutes(ctx));
  app.route("/v1", depositRoutes(ctx));
  app.route("/v1", gateRoutes(ctx));
  app.route("/v1", settingsRoutes(ctx));
  app.route("/v1", decisionTraceRoutes(ctx));

  // Chat bot webhook routes (Slack, Teams)
  app.route("/chat", chatRoutes(ctx));

  // Global error handler
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
            retryable: err.retryable,
          },
        },
        err.statusCode as 400
      );
    }

    console.error("Unhandled error:", err);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
          retryable: false,
        },
      },
      500
    );
  });

  return app;
}

export async function createAppWithDb(getNow?: () => string, dbUrl?: string) {
  const core = await createCoreServiceGraph({ dbUrl, getNow });

  // LLM config from environment (optional — only needed for mode: "full")
  const llmConfig: LLMConfig | undefined = buildLLMConfigFromEnv();

  const ctx: AppContext = {
    ...core,
    users: new Map(),
    llmConfig,
  };

  return { app: createApp(ctx), ctx };
}
