import { Hono } from "hono";
import type { SocialContext } from "./index.js";
import { stripNulls } from "../../utils.js";

export function agentRoutes(ctx: SocialContext) {
  const app = new Hono();

  // POST /v1/social/agents - Register a new agent
  app.post("/agents", async (c) => {
    const body = await c.req.json();
    const agent = await ctx.agentService.register(body);
    return c.json(stripNulls(agent), 201);
  });

  // GET /v1/social/agents - List/search agents
  app.get("/agents", async (c) => {
    const provider = c.req.query("provider");
    const organization = c.req.query("organization");
    const expertiseTag = c.req.query("expertise_tag");
    const status = c.req.query("status");
    const query = c.req.query("q");
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : undefined;
    const cursor = c.req.query("cursor");

    const result = await ctx.agentService.search({
      provider,
      organization,
      expertise_tag: expertiseTag,
      status,
      query,
      limit,
      cursor,
    });
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/social/agents/leaderboard - Get top agents by reputation
  app.get("/agents/leaderboard", async (c) => {
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : 10;
    const result = await ctx.agentService.getLeaderboard(limit);
    return c.json(stripNulls({ agents: result }), 200);
  });

  // GET /v1/social/agents/:agentId - Get agent by ID
  app.get("/agents/:agentId", async (c) => {
    const agentId = c.req.param("agentId");
    const agent = await ctx.agentService.getById(agentId);
    return c.json(stripNulls(agent), 200);
  });

  // PATCH /v1/social/agents/:agentId - Update agent profile
  app.patch("/agents/:agentId", async (c) => {
    const agentId = c.req.param("agentId");
    const body = await c.req.json();
    const agent = await ctx.agentService.update(agentId, body);
    return c.json(stripNulls(agent), 200);
  });

  // POST /v1/social/agents/:agentId/activity - Record agent activity
  app.post("/agents/:agentId/activity", async (c) => {
    const agentId = c.req.param("agentId");
    await ctx.agentService.recordActivity(agentId);
    return c.json({ success: true }, 200);
  });

  return app;
}
