import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schemas

export const facilityCreateSchema = {
  deal_id: z.string(),
  type: z.string().describe("Facility type, e.g. 'term_loan', 'revolver'"),
  amount: z.number().describe("Facility amount in cents (minor units)"),
  currency: z.string().optional().default("USD"),
  interest_rate_type: z.string().optional().describe("'fixed' or 'floating'"),
  interest_rate_value: z.number().optional().describe("Rate as decimal, e.g. 0.095 = 9.5%"),
  term_months: z.number().optional(),
  actor: z.string().optional().default("mcp-agent"),
};

export const facilityListSchema = {
  deal_id: z.string(),
};

// Handlers

export async function handleFacilityCreate(
  ctx: ServiceContext,
  params: {
    deal_id: string;
    type: string;
    amount: number;
    currency?: string;
    interest_rate_type?: string;
    interest_rate_value?: number;
    term_months?: number;
    actor?: string;
  }
) {
  const { deal_id: dealId, actor = "mcp-agent", ...body } = params;
  return ctx.facilityService.create(dealId, body, actor);
}

export async function handleFacilityList(
  ctx: ServiceContext,
  params: { deal_id: string }
) {
  return ctx.facilityService.list(params.deal_id);
}

// MCP registration

export function registerFacilityTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "facility.create",
    "Create a loan facility for a deal. Amount in cents.",
    facilityCreateSchema,
    async (params) => {
      try {
        return toolResult(await handleFacilityCreate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "facility.list",
    "List facilities for a deal",
    facilityListSchema,
    async (params) => {
      try {
        return toolResult(await handleFacilityList(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
