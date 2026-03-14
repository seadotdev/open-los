import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";
import { DEFAULT_DIMENSIONS, validateEntityTags } from "@open-los/core/src/services/entity-categories.js";

export function screeningRoutes(ctx: AppContext) {
  const app = new Hono();

  // ─── Resolve: stateless entity lookup against reference data ───────────────
  // POST /v1/resolve
  app.post("/resolve", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const result = await ctx.entityResolutionService.resolve(body, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // ─── Screen an entity ─────────────────────────────────────────────────────
  // POST /v1/entities/:entityId/screen
  app.post("/entities/:entityId/screen", async (c) => {
    const entityId = c.req.param("entityId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json().catch(() => ({}));
    const results = await ctx.entityResolutionService.screen(
      { entity_id: entityId, sources: body.sources },
      actor,
      tenantId
    );
    return c.json(stripNulls(results), 201);
  });

  // ─── Get screening results for an entity ──────────────────────────────────
  // GET /v1/entities/:entityId/screening
  app.get("/entities/:entityId/screening", async (c) => {
    const entityId = c.req.param("entityId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const source = c.req.query("source");
    const status = c.req.query("status");
    const results = await ctx.entityResolutionService.getByEntity(
      entityId,
      tenantId,
      { source, status }
    );
    return c.json(stripNulls({ screenings: results }), 200);
  });

  // ─── Get a single screening result ────────────────────────────────────────
  // GET /v1/screening/:screeningId
  app.get("/screening/:screeningId", async (c) => {
    const screeningId = c.req.param("screeningId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await ctx.entityResolutionService.getById(screeningId, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // ─── Review (confirm/reject) a screening result ──────────────────────────
  // POST /v1/screening/:screeningId/review
  app.post("/screening/:screeningId/review", async (c) => {
    const screeningId = c.req.param("screeningId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const result = await ctx.entityResolutionService.review(
      screeningId,
      body,
      actor,
      tenantId
    );
    return c.json(stripNulls(result), 200);
  });

  // ─── Import reference data ────────────────────────────────────────────────
  // POST /v1/reference-data/import
  app.post("/reference-data/import", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const result = await ctx.entityResolutionService.importReferenceData(
      body,
      tenantId
    );
    return c.json(result, 201);
  });

  // ─── Search reference data ────────────────────────────────────────────────
  // GET /v1/reference-data/search?q=...&source=...
  app.get("/reference-data/search", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const q = c.req.query("q");
    const source = c.req.query("source");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : 20;
    if (!q) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "q parameter is required" } }, 400);
    }
    const results = await ctx.entityResolutionService.searchReference(
      q,
      source as any,
      tenantId,
      limit
    );
    return c.json(stripNulls({ results }), 200);
  });

  // ─── Get reference data stats ─────────────────────────────────────────────
  // GET /v1/reference-data/stats
  app.get("/reference-data/stats", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const stats = await ctx.entityResolutionService.getReferenceStats(tenantId);
    return c.json(stats, 200);
  });

  // ─── Train on internal data ───────────────────────────────────────────────
  // POST /v1/reference-data/train
  app.post("/reference-data/train", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await ctx.entityResolutionService.trainOnInternalData(tenantId);
    return c.json(result, 200);
  });

  // ─── Category dimensions (tag cloud) ───────────────────────────────────
  // GET /v1/category-dimensions
  app.get("/category-dimensions", async (c) => {
    return c.json({ dimensions: DEFAULT_DIMENSIONS }, 200);
  });

  // POST /v1/entities/:entityId/tags — apply tags to an entity
  app.post("/entities/:entityId/tags", async (c) => {
    const entityId = c.req.param("entityId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const { tags } = body as { tags: Array<{ dimension: string; tag: string; confidence?: number; source?: string }> };

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "tags array is required" } }, 400);
    }

    // Validate tags against known dimensions
    const errors = validateEntityTags(tags, DEFAULT_DIMENSIONS);
    if (errors.length > 0) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: errors.join("; ") } }, 400);
    }

    // Get entity and merge tags
    const entity = await ctx.entityService.getById(entityId, tenantId);
    const existingTags = (entity.tags as Array<{ dimension: string; tag: string; confidence?: number; source?: string }>) ?? [];

    // Merge: new tags override existing ones for the same dimension+tag
    const tagMap = new Map(existingTags.map((t) => [`${t.dimension}:${t.tag}`, t]));
    for (const tag of tags) {
      tagMap.set(`${tag.dimension}:${tag.tag}`, {
        ...tag,
        source: tag.source ?? "manual",
      });
    }

    const mergedTags = Array.from(tagMap.values());

    // Update entity with raw db access since EntityService.update doesn't handle tags
    const { entities } = await import("@open-los/core");
    const { eq, and } = await import("drizzle-orm");
    await ctx.db.update(entities)
      .set({ tags: mergedTags, updated_at: ctx.getNow() })
      .where(and(eq(entities.id, entityId), eq(entities.tenant_id, tenantId)));

    const updated = await ctx.entityService.getById(entityId, tenantId);
    return c.json(stripNulls(updated), 200);
  });

  return app;
}
