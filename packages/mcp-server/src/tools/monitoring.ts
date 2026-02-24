import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schemas

export const monitoringIngestSchema = {
  deal_id: z.string(),
  source_type: z.string().describe("e.g. 'bank_transactions'"),
  transactions: z.array(
    z.object({
      date: z.string(),
      amount: z.number().describe("Amount in cents"),
      description: z.string(),
      category: z.string().optional(),
    })
  ),
  actor: z.string().optional().default("mcp-agent"),
};

export const monitoringStatusSchema = {
  deal_id: z.string(),
  actor: z.string().optional().default("mcp-agent"),
};

// Handlers

export async function handleMonitoringIngest(
  ctx: ServiceContext,
  params: {
    deal_id: string;
    source_type: string;
    transactions: Array<{
      date: string;
      amount: number;
      description: string;
      category?: string;
    }>;
    actor?: string;
  }
) {
  const { deal_id: dealId, actor = "mcp-agent", ...input } = params;
  return ctx.monitoringService.ingest(dealId, input, actor);
}

export async function handleMonitoringStatus(
  ctx: ServiceContext,
  params: { deal_id: string; actor?: string }
) {
  return ctx.monitoringService.getStatus(params.deal_id, params.actor ?? "mcp-agent");
}

// MCP registration

export function registerMonitoringTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "monitoring.ingest",
    "Ingest monitoring data (e.g. bank transactions) for a deal",
    monitoringIngestSchema,
    async (params) => {
      try {
        return toolResult(await handleMonitoringIngest(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "monitoring.status",
    "Get monitoring status for a deal (liquidity, alerts)",
    monitoringStatusSchema,
    async (params) => {
      try {
        return toolResult(await handleMonitoringStatus(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
