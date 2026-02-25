import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schemas

export const covenantCreateSchema = {
  deal_id: z.string(),
  name: z.string(),
  type: z.string().describe("Covenant type, e.g. 'financial', 'reporting'"),
  metric: z.string().describe("Metric to measure, e.g. 'dscr', 'current_ratio'"),
  operator: z.string().optional().describe("e.g. '>=', '<=', '>'"),
  threshold: z.number().optional(),
  frequency: z.string().optional().describe("e.g. 'quarterly', 'annual'"),
  grace_period_days: z.number().optional(),
  actor: z.string().optional().default("mcp-agent"),
};

export const covenantListSchema = {
  deal_id: z.string(),
};

export const covenantTestSchema = {
  deal_id: z.string(),
  covenant_ids: z.array(z.string()).optional(),
  as_of: z.string().optional(),
  as_of_period: z.string().optional(),
  actor: z.string().optional().default("mcp-agent"),
};

// Handlers

export async function handleCovenantCreate(
  ctx: ServiceContext,
  params: {
    deal_id: string;
    name: string;
    type: string;
    metric: string;
    operator?: string;
    threshold?: number;
    frequency?: string;
    grace_period_days?: number;
    actor?: string;
  }
) {
  const { deal_id: dealId, actor = "mcp-agent", ...body } = params;
  return ctx.covenantService.create(dealId, body, actor);
}

export async function handleCovenantList(
  ctx: ServiceContext,
  params: { deal_id: string }
) {
  return ctx.covenantService.list(params.deal_id);
}

export async function handleCovenantTest(
  ctx: ServiceContext,
  params: {
    deal_id: string;
    covenant_ids?: string[];
    as_of?: string;
    as_of_period?: string;
    actor?: string;
  }
) {
  const { deal_id: dealId, actor = "mcp-agent", ...opts } = params;
  return ctx.covenantService.test(dealId, actor, opts);
}

// MCP registration

export function registerCovenantTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "covenant.create",
    "Create a covenant for a deal",
    covenantCreateSchema,
    async (params) => {
      try {
        return toolResult(await handleCovenantCreate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "covenant.list",
    "List covenants for a deal",
    covenantListSchema,
    async (params) => {
      try {
        return toolResult(await handleCovenantList(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "covenant.test",
    "Test covenant compliance for a deal",
    covenantTestSchema,
    async (params) => {
      try {
        return toolResult(await handleCovenantTest(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
