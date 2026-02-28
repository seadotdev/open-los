import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";

export function documentRoutes(ctx: AppContext) {
  const app = new Hono();

  // POST /v1/deals/:dealId/documents
  app.post("/deals/:dealId/documents", async (c) => {
    const dealId = c.req.param("dealId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const doc = await ctx.documentService.upload(dealId, body, actor, tenantId);
    return c.json(stripNulls(doc), 202);
  });

  // GET /v1/deals/:dealId/documents
  app.get("/deals/:dealId/documents", async (c) => {
    const dealId = c.req.param("dealId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const docs = await ctx.documentService.listByDeal(dealId, tenantId);
    return c.json(stripNulls({ documents: docs }), 200);
  });

  // GET /v1/deals/:dealId/documents/:docId
  app.get("/deals/:dealId/documents/:docId", async (c) => {
    const dealId = c.req.param("dealId");
    const docId = c.req.param("docId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const doc = await ctx.documentService.getById(dealId, docId, tenantId);
    return c.json(stripNulls(doc), 200);
  });

  // GET /v1/documents/:docId/content
  app.get("/documents/:docId/content", async (c) => {
    const docId = c.req.param("docId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await ctx.documentService.getContent(docId, tenantId);
    if (!result) {
      return c.json({ error: "Document not found" }, 404);
    }
    return c.json(result, 200);
  });

  return app;
}
