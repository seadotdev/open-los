import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";

export function sandboxRoutes(ctx: AppContext) {
  const app = new Hono();

  // ─── Sandbox CRUD ─────────────────────────────────────────────────────────

  // POST /v1/sandboxes - Create a new sandbox
  app.post("/sandboxes", async (c) => {
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const sandbox = await ctx.sandboxService.create(body, actor, tenantId);
    return c.json(stripNulls(sandbox), 201);
  });

  // GET /v1/sandboxes - List sandboxes
  app.get("/sandboxes", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const status = c.req.query("status") as "active" | "archived" | "merged" | "discarded" | undefined;
    const parentType = c.req.query("parent_type") as "deal" | "portfolio" | "analysis" | undefined;
    const parentId = c.req.query("parent_id");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : undefined;
    const cursor = c.req.query("cursor");

    const result = await ctx.sandboxService.list(tenantId, {
      status,
      parent_type: parentType,
      parent_id: parentId,
      limit,
      cursor,
    });

    return c.json(stripNulls(result), 200);
  });

  // GET /v1/sandboxes/:sandboxId - Get sandbox by ID
  app.get("/sandboxes/:sandboxId", async (c) => {
    const sandboxId = c.req.param("sandboxId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const sandbox = await ctx.sandboxService.getById(sandboxId, tenantId);
    return c.json(stripNulls(sandbox), 200);
  });

  // PATCH /v1/sandboxes/:sandboxId/status - Update sandbox status
  app.patch("/sandboxes/:sandboxId/status", async (c) => {
    const sandboxId = c.req.param("sandboxId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const sandbox = await ctx.sandboxService.updateStatus(sandboxId, body.status, actor, tenantId);
    return c.json(stripNulls(sandbox), 200);
  });

  // ─── Checkpoint Operations ────────────────────────────────────────────────

  // POST /v1/sandboxes/:sandboxId/checkpoints - Create a checkpoint
  app.post("/sandboxes/:sandboxId/checkpoints", async (c) => {
    const sandboxId = c.req.param("sandboxId");
    const actor = c.req.header("X-Actor") ?? "system";
    const body = await c.req.json();
    const checkpoint = await ctx.sandboxService.createCheckpoint(
      { ...body, sandbox_id: sandboxId },
      actor
    );
    return c.json(stripNulls(checkpoint), 201);
  });

  // GET /v1/sandboxes/:sandboxId/checkpoints - List checkpoints
  app.get("/sandboxes/:sandboxId/checkpoints", async (c) => {
    const sandboxId = c.req.param("sandboxId");
    const checkpoints = await ctx.sandboxService.listCheckpoints(sandboxId);
    return c.json(stripNulls({ items: checkpoints }), 200);
  });

  // GET /v1/sandboxes/:sandboxId/checkpoints/:checkpointId - Get checkpoint
  app.get("/sandboxes/:sandboxId/checkpoints/:checkpointId", async (c) => {
    const checkpointId = c.req.param("checkpointId");
    const checkpoint = await ctx.sandboxService.getCheckpoint(checkpointId);
    return c.json(stripNulls(checkpoint), 200);
  });

  // POST /v1/sandboxes/:sandboxId/checkpoints/:checkpointId/restore - Restore checkpoint
  app.post("/sandboxes/:sandboxId/checkpoints/:checkpointId/restore", async (c) => {
    const checkpointId = c.req.param("checkpointId");
    const actor = c.req.header("X-Actor") ?? "system";
    const checkpoint = await ctx.sandboxService.restoreCheckpoint(checkpointId, actor);
    return c.json(stripNulls(checkpoint), 200);
  });

  // POST /v1/sandboxes/:sandboxId/checkpoints/compare - Compare two checkpoints
  app.post("/sandboxes/:sandboxId/checkpoints/compare", async (c) => {
    const body = await c.req.json();
    const comparison = await ctx.sandboxService.compareCheckpoints(
      body.from_checkpoint_id,
      body.to_checkpoint_id
    );
    return c.json(stripNulls(comparison), 200);
  });

  // ─── Entity Operations ────────────────────────────────────────────────────

  // POST /v1/sandboxes/:sandboxId/entities/clone - Clone an entity into sandbox
  app.post("/sandboxes/:sandboxId/entities/clone", async (c) => {
    const sandboxId = c.req.param("sandboxId");
    const actor = c.req.header("X-Actor") ?? "system";
    const body = await c.req.json();
    const entity = await ctx.sandboxService.cloneEntity(
      { sandbox_id: sandboxId, entity_type: body.entity_type, entity_id: body.entity_id },
      actor
    );
    return c.json(stripNulls(entity), 201);
  });

  // POST /v1/sandboxes/:sandboxId/entities - Create an entity in sandbox
  app.post("/sandboxes/:sandboxId/entities", async (c) => {
    const sandboxId = c.req.param("sandboxId");
    const actor = c.req.header("X-Actor") ?? "system";
    const body = await c.req.json();
    const entity = await ctx.sandboxService.createEntity(
      sandboxId,
      body.entity_type,
      body.entity_id,
      body.state,
      actor
    );
    return c.json(stripNulls(entity), 201);
  });

  // GET /v1/sandboxes/:sandboxId/entities - List entities in sandbox
  app.get("/sandboxes/:sandboxId/entities", async (c) => {
    const sandboxId = c.req.param("sandboxId");
    const entityType = c.req.query("entity_type");
    const entities = await ctx.sandboxService.listEntities(sandboxId, entityType);
    return c.json(stripNulls({ items: entities }), 200);
  });

  // PATCH /v1/sandboxes/:sandboxId/entities/:entityType/:entityId - Update entity
  app.patch("/sandboxes/:sandboxId/entities/:entityType/:entityId", async (c) => {
    const sandboxId = c.req.param("sandboxId");
    const entityType = c.req.param("entityType");
    const entityId = c.req.param("entityId");
    const actor = c.req.header("X-Actor") ?? "system";
    const body = await c.req.json();
    const entity = await ctx.sandboxService.updateEntity(
      {
        sandbox_id: sandboxId,
        entity_type: entityType,
        entity_id: entityId,
        state: body.state,
      },
      actor
    );
    return c.json(stripNulls(entity), 200);
  });

  // DELETE /v1/sandboxes/:sandboxId/entities/:entityType/:entityId - Delete entity
  app.delete("/sandboxes/:sandboxId/entities/:entityType/:entityId", async (c) => {
    const sandboxId = c.req.param("sandboxId");
    const entityType = c.req.param("entityType");
    const entityId = c.req.param("entityId");
    const actor = c.req.header("X-Actor") ?? "system";
    const result = await ctx.sandboxService.deleteEntity(sandboxId, entityType, entityId, actor);
    return c.json(stripNulls(result), 200);
  });

  // ─── History Operations ───────────────────────────────────────────────────

  // GET /v1/sandboxes/:sandboxId/history - Get git history
  app.get("/sandboxes/:sandboxId/history", async (c) => {
    const sandboxId = c.req.param("sandboxId");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : 20;
    const history = await ctx.sandboxService.getHistory(sandboxId, limit);
    return c.json(stripNulls({ items: history }), 200);
  });

  // POST /v1/sandboxes/:sandboxId/diff - Get diff between checkpoints
  app.post("/sandboxes/:sandboxId/diff", async (c) => {
    const sandboxId = c.req.param("sandboxId");
    const body = await c.req.json();
    const diff = await ctx.sandboxService.getDiff(
      sandboxId,
      body.from_checkpoint_id,
      body.to_checkpoint_id
    );
    return c.json({ diff }, 200);
  });

  return app;
}
