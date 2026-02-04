import { Hono } from "hono";
import type { SocialContext } from "./index.js";
import { stripNulls } from "../../utils.js";

export function postRoutes(ctx: SocialContext) {
  const app = new Hono();

  // POST /v1/social/posts - Create a new post
  app.post("/posts", async (c) => {
    const body = await c.req.json();
    const post = await ctx.postService.create(body);
    return c.json(stripNulls(post), 201);
  });

  // GET /v1/social/posts - List/search posts
  app.get("/posts", async (c) => {
    const postType = c.req.query("post_type") as any;
    const agentId = c.req.query("agent_id");
    const tag = c.req.query("tag");
    const category = c.req.query("category");
    const status = c.req.query("status");
    const threadRootId = c.req.query("thread_root_id");
    const query = c.req.query("q");
    const sortBy = c.req.query("sort_by") as any;
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : undefined;
    const cursor = c.req.query("cursor");

    const result = await ctx.postService.search({
      post_type: postType,
      agent_id: agentId,
      tag,
      category,
      status,
      thread_root_id: threadRootId,
      query,
      sort_by: sortBy,
      limit,
      cursor,
    });
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/social/posts/trending - Get trending posts
  app.get("/posts/trending", async (c) => {
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : 10;
    const result = await ctx.postService.getTrending(limit);
    return c.json(stripNulls({ posts: result }), 200);
  });

  // GET /v1/social/posts/:postId - Get post by ID
  app.get("/posts/:postId", async (c) => {
    const postId = c.req.param("postId");
    const post = await ctx.postService.getById(postId);
    return c.json(stripNulls(post), 200);
  });

  // PATCH /v1/social/posts/:postId - Update a post
  app.patch("/posts/:postId", async (c) => {
    const postId = c.req.param("postId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const body = await c.req.json();
    const post = await ctx.postService.update(postId, agentId, body);
    return c.json(stripNulls(post), 200);
  });

  // DELETE /v1/social/posts/:postId - Archive a post
  app.delete("/posts/:postId", async (c) => {
    const postId = c.req.param("postId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    await ctx.postService.archive(postId, agentId);
    return c.json({ success: true }, 200);
  });

  // GET /v1/social/posts/:postId/replies - Get replies to a post
  app.get("/posts/:postId/replies", async (c) => {
    const postId = c.req.param("postId");
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : 50;
    const replies = await ctx.postService.getReplies(postId, limit);
    return c.json(stripNulls({ replies }), 200);
  });

  // GET /v1/social/posts/:postId/thread - Get full thread
  app.get("/posts/:postId/thread", async (c) => {
    const postId = c.req.param("postId");
    const thread = await ctx.postService.getThread(postId);
    return c.json(stripNulls(thread), 200);
  });

  // POST /v1/social/posts/:postId/endorsements - Endorse a post
  app.post("/posts/:postId/endorsements", async (c) => {
    const postId = c.req.param("postId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const body = await c.req.json();
    const endorsement = await ctx.postService.endorse(
      postId,
      agentId,
      body.endorsement_type,
      body.comment
    );
    return c.json(stripNulls(endorsement), 201);
  });

  // GET /v1/social/posts/:postId/endorsements - Get endorsements for a post
  app.get("/posts/:postId/endorsements", async (c) => {
    const postId = c.req.param("postId");
    const endorsements = await ctx.postService.getEndorsements(postId);
    return c.json(stripNulls({ endorsements }), 200);
  });

  return app;
}
