import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schemas

export const spreadCreateSchema = {
  deal_id: z.string(),
  entity_id: z.string().optional(),
  period: z.string().describe("Period label, e.g. '2024'"),
  line_items: z
    .array(
      z.object({
        category: z.string(),
        label: z.string(),
        amount: z.number().describe("Amount in cents (minor units)"),
      })
    )
    .optional(),
  metrics: z.record(z.number()).optional().describe("Direct metric input (e.g. { revenue: 100000 })"),
  actor: z.string().optional().default("mcp-agent"),
};

export const spreadGetRatiosSchema = {
  deal_id: z.string(),
};

// Handlers

export async function handleSpreadCreate(
  ctx: ServiceContext,
  params: {
    deal_id: string;
    entity_id?: string;
    period: string;
    line_items?: Array<{ category: string; label: string; amount: number }>;
    metrics?: Record<string, number>;
    actor?: string;
  }
) {
  const { deal_id: dealId, actor = "mcp-agent", ...input } = params;
  return ctx.spreadService.create(dealId, input, actor);
}

export async function handleSpreadGetRatios(
  ctx: ServiceContext,
  params: { deal_id: string }
) {
  return ctx.spreadService.getRatios(params.deal_id);
}

// MCP registration

export function registerSpreadTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "spread.create",
    "Create a financial spread for a deal. Amounts in cents (minor units).",
    spreadCreateSchema,
    async (params) => {
      try {
        return toolResult(await handleSpreadCreate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "spread.get_ratios",
    "Get computed financial ratios for a deal",
    spreadGetRatiosSchema,
    async (params) => {
      try {
        return toolResult(await handleSpreadGetRatios(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
