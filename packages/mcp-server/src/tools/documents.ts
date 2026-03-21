import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schemas

export const documentUploadSchema = {
  deal_id: z.string(),
  doc_type: z.string(),
  filename: z.string(),
  content: z.string().describe("Base64-encoded file content"),
  mime_type: z.string().optional(),
  tenant_id: z.string().optional().default("default"),
  actor: z.string().optional().default("mcp-agent"),
};

export const documentListSchema = {
  deal_id: z.string(),
  tenant_id: z.string().optional().default("default"),
};

// Handlers

export async function handleDocumentUpload(
  ctx: ServiceContext,
  params: {
    deal_id: string;
    doc_type: string;
    filename: string;
    content: string;
    mime_type?: string;
    tenant_id?: string;
    actor?: string;
  }
) {
  const {
    deal_id: dealId,
    tenant_id = "default",
    actor = "mcp-agent",
    content,
    ...body
  } = params;
  return ctx.documentService.upload(
    dealId,
    { ...body, content_base64: content },
    actor,
    tenant_id
  );
}

export async function handleDocumentList(
  ctx: ServiceContext,
  params: { deal_id: string; tenant_id?: string }
) {
  return ctx.documentService.listByDeal(params.deal_id, params.tenant_id ?? "default");
}

// MCP registration

export function registerDocumentTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "document.upload",
    "Upload a document to a deal. Content should be base64-encoded.",
    documentUploadSchema,
    async (params) => {
      try {
        return toolResult(await handleDocumentUpload(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "document.list",
    "List documents for a deal",
    documentListSchema,
    async (params) => {
      try {
        return toolResult(await handleDocumentList(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
