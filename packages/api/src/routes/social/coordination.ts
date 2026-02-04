import { Hono } from "hono";
import type { SocialContext } from "./index.js";
import { stripNulls } from "../../utils.js";

export function coordinationRoutes(ctx: SocialContext) {
  const app = new Hono();

  // POST /v1/social/coordination - Create a coordination task
  app.post("/coordination", async (c) => {
    const body = await c.req.json();
    const task = await ctx.coordinationService.create(body);
    return c.json(stripNulls(task), 201);
  });

  // GET /v1/social/coordination - List coordination tasks
  app.get("/coordination", async (c) => {
    const taskType = c.req.query("task_type") as any;
    const status = c.req.query("status") as any;
    const coordinatorId = c.req.query("coordinator_id");
    const participantId = c.req.query("participant_id");
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : undefined;
    const cursor = c.req.query("cursor");

    const result = await ctx.coordinationService.list({
      task_type: taskType,
      status,
      coordinator_id: coordinatorId,
      participant_id: participantId,
      limit,
      cursor,
    });
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/social/coordination/rollouts - Get active rollouts
  app.get("/coordination/rollouts", async (c) => {
    const system = c.req.query("system");
    const rollouts = await ctx.coordinationService.getActiveRollouts(system);
    return c.json(stripNulls({ rollouts }), 200);
  });

  // GET /v1/social/coordination/:taskId - Get task by ID
  app.get("/coordination/:taskId", async (c) => {
    const taskId = c.req.param("taskId");
    const task = await ctx.coordinationService.getById(taskId);
    return c.json(stripNulls(task), 200);
  });

  // PATCH /v1/social/coordination/:taskId - Update a task
  app.patch("/coordination/:taskId", async (c) => {
    const taskId = c.req.param("taskId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const body = await c.req.json();
    const task = await ctx.coordinationService.update(taskId, agentId, body);
    return c.json(stripNulls(task), 200);
  });

  // POST /v1/social/coordination/:taskId/join - Join a task
  app.post("/coordination/:taskId/join", async (c) => {
    const taskId = c.req.param("taskId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const task = await ctx.coordinationService.join(taskId, agentId);
    return c.json(stripNulls(task), 200);
  });

  // POST /v1/social/coordination/:taskId/leave - Leave a task
  app.post("/coordination/:taskId/leave", async (c) => {
    const taskId = c.req.param("taskId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const task = await ctx.coordinationService.leave(taskId, agentId);
    return c.json(stripNulls(task), 200);
  });

  // PATCH /v1/social/coordination/:taskId/steps/:stepId - Update a step
  app.patch("/coordination/:taskId/steps/:stepId", async (c) => {
    const taskId = c.req.param("taskId");
    const stepId = c.req.param("stepId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const body = await c.req.json();
    const task = await ctx.coordinationService.updateStep(
      taskId,
      agentId,
      stepId,
      body.status,
      body.notes
    );
    return c.json(stripNulls(task), 200);
  });

  // POST /v1/social/coordination/:taskId/progress - Add progress update
  app.post("/coordination/:taskId/progress", async (c) => {
    const taskId = c.req.param("taskId");
    const agentId = c.req.header("X-Agent-Id");
    if (!agentId) {
      return c.json({ error: { code: "MISSING_AGENT_ID", message: "X-Agent-Id header required" } }, 400);
    }
    const body = await c.req.json();
    const update = await ctx.coordinationService.addProgress({
      task_id: taskId,
      agent_id: agentId,
      update_type: body.update_type,
      message: body.message,
      step_id: body.step_id,
      attachments: body.attachments,
    });
    return c.json(stripNulls(update), 201);
  });

  // GET /v1/social/coordination/:taskId/progress - Get progress updates
  app.get("/coordination/:taskId/progress", async (c) => {
    const taskId = c.req.param("taskId");
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : 50;
    const updates = await ctx.coordinationService.getProgress(taskId, limit);
    return c.json(stripNulls({ updates }), 200);
  });

  return app;
}
