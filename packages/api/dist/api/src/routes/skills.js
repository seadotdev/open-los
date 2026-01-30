import { Hono } from "hono";
import { stripNulls } from "../utils.js";
export function skillRoutes(ctx) {
    const app = new Hono();
    // GET /v1/skills - List available skills (metadata only)
    app.get("/skills", async (c) => {
        const tenantId = c.req.header("X-Tenant-Id") ?? "default";
        const scope = c.req.query("scope");
        const tagsParam = c.req.query("tags");
        const tags = tagsParam ? tagsParam.split(",") : undefined;
        const includeInactive = c.req.query("includeInactive") === "true";
        const skills = await ctx.skillService.list(tenantId, {
            scope,
            tags,
            includeInactive,
        });
        return c.json({ skills: stripNulls(skills) }, 200);
    });
    // POST /v1/skills:search - Search skills
    app.post("/skills\\:search", async (c) => {
        const tenantId = c.req.header("X-Tenant-Id") ?? "default";
        const body = await c.req.json();
        const { query, scope } = body;
        if (!query) {
            return c.json({ error: { code: "VALIDATION_ERROR", message: "query is required" } }, 400);
        }
        let skills = await ctx.skillService.search(query, tenantId);
        // Filter by scope if specified
        if (scope) {
            skills = skills.filter((s) => s.scope === scope);
        }
        return c.json({ skills: stripNulls(skills) }, 200);
    });
    // GET /v1/skills/:nameOrId - Get skill metadata
    app.get("/skills/:nameOrId", async (c) => {
        const tenantId = c.req.header("X-Tenant-Id") ?? "default";
        const nameOrId = c.req.param("nameOrId");
        const skill = await ctx.skillService.getMetadata(nameOrId, tenantId);
        return c.json(stripNulls(skill), 200);
    });
    // GET /v1/skills/:nameOrId/content - Load full skill content
    app.get("/skills/:nameOrId/content", async (c) => {
        const tenantId = c.req.header("X-Tenant-Id") ?? "default";
        const nameOrId = c.req.param("nameOrId");
        const includeReferences = c.req.query("includeReferences") === "true";
        let result;
        if (includeReferences) {
            result = await ctx.skillService.loadWithReferences(nameOrId, tenantId);
        }
        else {
            result = await ctx.skillService.load(nameOrId, tenantId);
        }
        return c.json(stripNulls(result), 200);
    });
    // POST /v1/skills - Register a new skill (admin)
    app.post("/skills", async (c) => {
        const tenantId = c.req.header("X-Tenant-Id") ?? "default";
        const body = await c.req.json();
        if (!body.name || !body.description || !body.path) {
            return c.json({ error: { code: "VALIDATION_ERROR", message: "name, description, and path are required" } }, 400);
        }
        const skill = await ctx.skillService.register({
            name: body.name,
            description: body.description,
            trigger: body.trigger,
            path: body.path,
            scope: body.scope,
            ownerId: body.ownerId,
            tags: body.tags,
            version: body.version,
        }, tenantId);
        return c.json(stripNulls(skill), 201);
    });
    // PATCH /v1/skills/:nameOrId - Update a skill
    app.patch("/skills/:nameOrId", async (c) => {
        const tenantId = c.req.header("X-Tenant-Id") ?? "default";
        const nameOrId = c.req.param("nameOrId");
        const body = await c.req.json();
        const skill = await ctx.skillService.update(nameOrId, {
            description: body.description,
            trigger: body.trigger,
            tags: body.tags,
            version: body.version,
            isActive: body.isActive,
        }, tenantId);
        return c.json(stripNulls(skill), 200);
    });
    // DELETE /v1/skills/:nameOrId - Deactivate a skill
    app.delete("/skills/:nameOrId", async (c) => {
        const tenantId = c.req.header("X-Tenant-Id") ?? "default";
        const nameOrId = c.req.param("nameOrId");
        await ctx.skillService.deactivate(nameOrId, tenantId);
        return c.json({ success: true }, 200);
    });
    // POST /v1/skills/:nameOrId/invocations - Start skill invocation
    app.post("/skills/:nameOrId/invocations", async (c) => {
        const tenantId = c.req.header("X-Tenant-Id") ?? "default";
        const actor = c.req.header("X-Actor") ?? "system";
        const nameOrId = c.req.param("nameOrId");
        const body = await c.req.json();
        const invocation = await ctx.skillService.startInvocation(nameOrId, {
            dealId: body.dealId,
            entityId: body.entityId,
            actorType: body.actorType,
            aiProvider: body.aiProvider,
        }, actor, tenantId);
        return c.json(stripNulls({ invocationId: invocation.id, ...invocation }), 201);
    });
    // PATCH /v1/skills/invocations/:invocationId - Complete/fail invocation
    app.patch("/skills/invocations/:invocationId", async (c) => {
        const invocationId = c.req.param("invocationId");
        const body = await c.req.json();
        if (!body.status || !["completed", "failed"].includes(body.status)) {
            return c.json({ error: { code: "VALIDATION_ERROR", message: "status must be 'completed' or 'failed'" } }, 400);
        }
        let result;
        if (body.status === "completed") {
            result = await ctx.skillService.completeInvocation(invocationId, body.outputSummary);
        }
        else {
            result = await ctx.skillService.failInvocation(invocationId, body.error || "Unknown error");
        }
        return c.json(stripNulls(result), 200);
    });
    // GET /v1/deals/:dealId/skill-invocations - Get invocation history for a deal
    app.get("/deals/:dealId/skill-invocations", async (c) => {
        const tenantId = c.req.header("X-Tenant-Id") ?? "default";
        const dealId = c.req.param("dealId");
        const invocations = await ctx.skillService.getInvocationsByDeal(dealId, tenantId);
        return c.json({ invocations: stripNulls(invocations) }, 200);
    });
    // POST /v1/skills:sync - Sync skills from filesystem (admin)
    app.post("/skills\\:sync", async (c) => {
        const result = await ctx.skillService.syncFromFilesystem();
        return c.json(stripNulls(result), 200);
    });
    return app;
}
//# sourceMappingURL=skills.js.map