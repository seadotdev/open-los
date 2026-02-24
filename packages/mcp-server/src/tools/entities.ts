import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schemas

export const entityCreateSchema = {
  type: z.enum(["company", "person"]),
  name: z.string(),
  legal_name: z.string().optional(),
  registration_number: z.string().optional(),
  jurisdiction: z.string().optional(),
  lei: z.string().optional(),
  tenant_id: z.string().optional().default("default"),
  actor: z.string().optional().default("mcp-agent"),
};

export const entityGetSchema = {
  id: z.string(),
  tenant_id: z.string().optional().default("default"),
};

export const entityListSchema = {
  type: z.enum(["company", "person"]).optional(),
  limit: z.number().optional(),
  cursor: z.string().optional(),
  tenant_id: z.string().optional().default("default"),
};

export const entityUpdateSchema = {
  id: z.string(),
  name: z.string().optional(),
  legal_name: z.string().optional(),
  registration_number: z.string().optional(),
  jurisdiction: z.string().optional(),
  lei: z.string().optional(),
  tenant_id: z.string().optional().default("default"),
  actor: z.string().optional().default("mcp-agent"),
};

export const entityDeleteSchema = {
  id: z.string(),
  tenant_id: z.string().optional().default("default"),
};

// Handlers

export async function handleEntityCreate(
  ctx: ServiceContext,
  params: { type: string; name: string; tenant_id?: string; actor?: string; [k: string]: unknown }
) {
  const { tenant_id = "default", actor = "mcp-agent", ...body } = params;
  return ctx.entityService.create(
    body as { type: "company" | "person"; name: string },
    actor,
    undefined,
    tenant_id
  );
}

export async function handleEntityGet(
  ctx: ServiceContext,
  params: { id: string; tenant_id?: string }
) {
  return ctx.entityService.getById(params.id, params.tenant_id ?? "default");
}

export async function handleEntityList(
  ctx: ServiceContext,
  params: { type?: string; limit?: number; cursor?: string; tenant_id?: string }
) {
  const { tenant_id = "default", ...filters } = params;
  return ctx.entityService.list(tenant_id, filters);
}

export async function handleEntityUpdate(
  ctx: ServiceContext,
  params: { id: string; tenant_id?: string; actor?: string; [k: string]: unknown }
) {
  const { id, tenant_id = "default", actor = "mcp-agent", ...body } = params;
  const dealId = await ctx.entityService.findDealIdByEntity(id);
  return ctx.entityService.update(id, body, actor, dealId ?? undefined, tenant_id);
}

export async function handleEntityDelete(
  ctx: ServiceContext,
  params: { id: string; tenant_id?: string }
) {
  await ctx.entityService.delete(params.id, params.tenant_id ?? "default");
  return { deleted: true, id: params.id };
}

// MCP registration

export function registerEntityTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "entity.create",
    "Create a new entity (company or person)",
    entityCreateSchema,
    async (params) => {
      try {
        return toolResult(await handleEntityCreate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "entity.get",
    "Get entity by ID",
    entityGetSchema,
    async (params) => {
      try {
        return toolResult(await handleEntityGet(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "entity.list",
    "List entities, optionally filtered by type",
    entityListSchema,
    async (params) => {
      try {
        return toolResult(await handleEntityList(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "entity.update",
    "Update an entity's fields",
    entityUpdateSchema,
    async (params) => {
      try {
        return toolResult(await handleEntityUpdate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "entity.delete",
    "Delete an entity by ID",
    entityDeleteSchema,
    async (params) => {
      try {
        return toolResult(await handleEntityDelete(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
