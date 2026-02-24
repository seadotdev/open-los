import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schema

export const relationshipCreateSchema = {
  from_entity_id: z.string(),
  to_entity_id: z.string(),
  type: z.string().describe("Relationship type, e.g. 'subsidiary', 'guarantor', 'ubo'"),
  ownership_pct: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
  actor: z.string().optional().default("mcp-agent"),
};

// Handler

export async function handleRelationshipCreate(
  ctx: ServiceContext,
  params: {
    from_entity_id: string;
    to_entity_id: string;
    type: string;
    ownership_pct?: number;
    metadata?: Record<string, unknown>;
    actor?: string;
  }
) {
  const { actor = "mcp-agent", ...body } = params;
  return ctx.relationshipService.create(
    body as { from_entity_id: string; to_entity_id: string; type: "owns" | "guarantees" | "directs"; ownership_pct?: number; metadata?: Record<string, unknown> },
    actor
  );
}

// MCP registration

export function registerRelationshipTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "relationship.create",
    "Create a relationship between two entities (e.g. subsidiary, guarantor, UBO)",
    relationshipCreateSchema,
    async (params) => {
      try {
        return toolResult(await handleRelationshipCreate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
