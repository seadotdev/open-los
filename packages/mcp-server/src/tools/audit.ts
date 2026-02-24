import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schema

export const auditListSchema = {
  deal_id: z.string(),
  type: z.string().optional().describe("Filter by event type"),
  actor: z.string().optional().describe("Filter by actor"),
  limit: z.number().optional(),
  cursor: z.string().optional(),
};

// Handler

export async function handleAuditList(
  ctx: ServiceContext,
  params: {
    deal_id: string;
    type?: string;
    actor?: string;
    limit?: number;
    cursor?: string;
  }
) {
  const { deal_id: dealId, ...filters } = params;
  return ctx.auditService.listByDeal(dealId, filters);
}

// MCP registration

export function registerAuditTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "audit.list",
    "List audit events for a deal. Audit events are immutable.",
    auditListSchema,
    async (params) => {
      try {
        return toolResult(await handleAuditList(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
