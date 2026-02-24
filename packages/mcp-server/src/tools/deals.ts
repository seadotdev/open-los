import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schemas

export const dealCreateSchema = {
  borrower_name: z.string(),
  jurisdiction: z.string().optional(),
  requested_amount: z.number().optional().describe("Amount in cents (minor units)"),
  purpose: z.string().optional(),
  custom_fields: z.record(z.unknown()).optional(),
  primary_entity_id: z.string().optional(),
  tenant_id: z.string().optional().default("default"),
  actor: z.string().optional().default("mcp-agent"),
};

export const dealGetSchema = {
  id: z.string(),
  tenant_id: z.string().optional().default("default"),
};

export const dealUpdateSchema = {
  id: z.string(),
  borrower_name: z.string().optional(),
  jurisdiction: z.string().optional(),
  requested_amount: z.number().optional().describe("Amount in cents (minor units)"),
  purpose: z.string().optional(),
  assigned_to: z.string().optional(),
  origination_outcome: z.string().optional(),
  primary_entity_id: z.string().optional(),
  custom_fields: z.record(z.unknown()).optional(),
  tenant_id: z.string().optional().default("default"),
  actor: z.string().optional().default("mcp-agent"),
};

export const dealListSchema = {
  stage: z.string().optional(),
  limit: z.number().optional(),
  cursor: z.string().optional(),
  tenant_id: z.string().optional().default("default"),
};

// Handlers

export async function handleDealCreate(
  ctx: ServiceContext,
  params: { borrower_name: string; tenant_id?: string; actor?: string; [k: string]: unknown }
) {
  const { tenant_id = "default", actor = "mcp-agent", ...body } = params;
  return ctx.dealService.create(body, actor, tenant_id);
}

export async function handleDealGet(
  ctx: ServiceContext,
  params: { id: string; tenant_id?: string }
) {
  return ctx.dealService.getById(params.id, params.tenant_id ?? "default");
}

export async function handleDealUpdate(
  ctx: ServiceContext,
  params: { id: string; tenant_id?: string; actor?: string; [k: string]: unknown }
) {
  const { id, tenant_id = "default", actor = "mcp-agent", ...body } = params;
  return ctx.dealService.update(id, body, actor, tenant_id);
}

export async function handleDealList(
  ctx: ServiceContext,
  params: { stage?: string; limit?: number; cursor?: string; tenant_id?: string }
) {
  const { tenant_id = "default", ...filters } = params;
  return ctx.dealService.list(tenant_id, filters);
}

// MCP registration

export function registerDealTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "deal.create",
    "Create a new lending deal. requested_amount is in cents (minor units). E.g. $500,000 = 50000000",
    dealCreateSchema,
    async (params) => {
      try {
        return toolResult(await handleDealCreate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "deal.get",
    "Get deal details by ID",
    dealGetSchema,
    async (params) => {
      try {
        return toolResult(await handleDealGet(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "deal.update",
    "Update deal fields. Amounts in cents.",
    dealUpdateSchema,
    async (params) => {
      try {
        return toolResult(await handleDealUpdate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "deal.list",
    "List deals, optionally filtered by stage",
    dealListSchema,
    async (params) => {
      try {
        return toolResult(await handleDealList(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
