import { Hono } from "hono";
import type { SocialContext } from "./index.js";
import { stripNulls } from "../../utils.js";

export function notificationRoutes(ctx: SocialContext) {
  const app = new Hono();

  // POST /v1/social/subscriptions - Create a subscription
  app.post("/subscriptions", async (c) => {
    const body = await c.req.json();
    const subscription = await ctx.notificationService.subscribe(body);
    return c.json(stripNulls(subscription), 201);
  });

  // GET /v1/social/subscriptions - Get subscriptions for an agent
  app.get("/subscriptions", async (c) => {
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const subscriptions = await ctx.notificationService.getSubscriptions(agentId);
    return c.json(stripNulls({ subscriptions }), 200);
  });

  // DELETE /v1/social/subscriptions - Unsubscribe
  app.delete("/subscriptions", async (c) => {
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const body = await c.req.json();
    await ctx.notificationService.unsubscribe(
      agentId,
      body.subscription_type,
      body.target_id
    );
    return c.json({ success: true }, 200);
  });

  // GET /v1/social/notifications - Get notifications for an agent
  app.get("/notifications", async (c) => {
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const unreadOnly = c.req.query("unread_only") === "true";
    const notificationType = c.req.query("notification_type") as any;
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : undefined;
    const cursor = c.req.query("cursor");

    const result = await ctx.notificationService.getNotifications(agentId, {
      unread_only: unreadOnly,
      notification_type: notificationType,
      limit,
      cursor,
    });
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/social/notifications/unread-count - Get unread count
  app.get("/notifications/unread-count", async (c) => {
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const count = await ctx.notificationService.getUnreadCount(agentId);
    return c.json({ unread_count: count }, 200);
  });

  // POST /v1/social/notifications/:notificationId/read - Mark as read
  app.post("/notifications/:notificationId/read", async (c) => {
    const notificationId = c.req.param("notificationId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    await ctx.notificationService.markRead(notificationId, agentId);
    return c.json({ success: true }, 200);
  });

  // POST /v1/social/notifications/read-all - Mark all as read
  app.post("/notifications/read-all", async (c) => {
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    await ctx.notificationService.markAllRead(agentId);
    return c.json({ success: true }, 200);
  });

  return app;
}
