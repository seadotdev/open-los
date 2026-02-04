import { Hono } from "hono";
import type { SocialContext } from "./index.js";
import { stripNulls } from "../../utils.js";

export function knowledgeRoutes(ctx: SocialContext) {
  const app = new Hono();

  // POST /v1/social/knowledge - Create a knowledge item
  app.post("/knowledge", async (c) => {
    const body = await c.req.json();
    const item = await ctx.knowledgeService.create(body);
    return c.json(stripNulls(item), 201);
  });

  // GET /v1/social/knowledge - Search knowledge items
  app.get("/knowledge", async (c) => {
    const category = c.req.query("category") as any;
    const domain = c.req.query("domain");
    const tag = c.req.query("tag");
    const status = c.req.query("status");
    const query = c.req.query("q");
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : undefined;
    const cursor = c.req.query("cursor");

    const result = await ctx.knowledgeService.search({
      category,
      domain,
      tag,
      status,
      query,
      limit,
      cursor,
    });
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/social/knowledge/domain/:domain - Get knowledge by domain
  app.get("/knowledge/domain/:domain", async (c) => {
    const domain = c.req.param("domain");
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : 20;
    const items = await ctx.knowledgeService.getByDomain(domain, limit);
    return c.json(stripNulls({ items }), 200);
  });

  // GET /v1/social/knowledge/:itemId - Get knowledge item by ID
  app.get("/knowledge/:itemId", async (c) => {
    const itemId = c.req.param("itemId");
    const item = await ctx.knowledgeService.getById(itemId);
    return c.json(stripNulls(item), 200);
  });

  // PATCH /v1/social/knowledge/:itemId - Update a knowledge item
  app.patch("/knowledge/:itemId", async (c) => {
    const itemId = c.req.param("itemId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const body = await c.req.json();
    const item = await ctx.knowledgeService.update(itemId, agentId, body);
    return c.json(stripNulls(item), 200);
  });

  // POST /v1/social/knowledge/:itemId/publish - Publish a knowledge item
  app.post("/knowledge/:itemId/publish", async (c) => {
    const itemId = c.req.param("itemId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const item = await ctx.knowledgeService.publish(itemId, agentId);
    return c.json(stripNulls(item), 200);
  });

  // POST /v1/social/knowledge/:itemId/verify - Verify a knowledge item
  app.post("/knowledge/:itemId/verify", async (c) => {
    const itemId = c.req.param("itemId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const item = await ctx.knowledgeService.verify(itemId, agentId);
    return c.json(stripNulls(item), 200);
  });

  // POST /v1/social/knowledge/:itemId/deprecate - Deprecate a knowledge item
  app.post("/knowledge/:itemId/deprecate", async (c) => {
    const itemId = c.req.param("itemId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const body = await c.req.json();
    const item = await ctx.knowledgeService.deprecate(
      itemId,
      agentId,
      body.superseded_by
    );
    return c.json(stripNulls(item), 200);
  });

  // GET /v1/social/knowledge/:itemId/history - Get version history
  app.get("/knowledge/:itemId/history", async (c) => {
    const itemId = c.req.param("itemId");
    const history = await ctx.knowledgeService.getVersionHistory(itemId);
    return c.json(stripNulls({ history }), 200);
  });

  // POST /v1/social/knowledge/synthesize - Create knowledge from posts
  app.post("/knowledge/synthesize", async (c) => {
    const body = await c.req.json();
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const item = await ctx.knowledgeService.synthesizeFromPosts(
      body.post_ids,
      agentId,
      body.category,
      body.title,
      body.domain
    );
    return c.json(stripNulls(item), 201);
  });

  return app;
}
