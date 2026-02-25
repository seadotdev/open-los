import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schemas

export const depositCreateSchema = {
  type: z.string().describe("Account type, e.g. 'checking', 'savings'"),
  holder: z.string().describe("Account holder entity ID"),
  currency: z.string().optional().default("USD"),
  tenant_id: z.string().optional().default("default"),
  actor: z.string().optional().default("mcp-agent"),
};

export const depositListSchema = {
  tenant_id: z.string().optional().default("default"),
};

// Handlers

export async function handleDepositCreate(
  ctx: ServiceContext,
  params: {
    type: string;
    holder: string;
    currency?: string;
    tenant_id?: string;
    actor?: string;
  }
) {
  const { tenant_id = "default", actor = "mcp-agent" } = params;
  return ctx.depositAccountService.create(
    { type: params.type, account_holder: params.holder, currency: params.currency },
    actor,
    tenant_id
  );
}

export async function handleDepositList(
  ctx: ServiceContext,
  params: { tenant_id?: string }
) {
  return ctx.depositAccountService.list(params.tenant_id ?? "default");
}

// MCP registration

export function registerDepositTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "deposit.create",
    "Create a deposit account",
    depositCreateSchema,
    async (params) => {
      try {
        return toolResult(await handleDepositCreate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "deposit.list",
    "List deposit accounts",
    depositListSchema,
    async (params) => {
      try {
        return toolResult(await handleDepositList(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
