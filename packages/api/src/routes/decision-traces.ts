import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";
import type { TraceTrigger, TraceStepType, EvidenceRefType, TraceStatus } from "@open-los/core";

export function decisionTraceRoutes(ctx: AppContext) {
  const app = new Hono();

  // POST /v1/deals/:dealId/traces — Start a new decision trace
  app.post("/deals/:dealId/traces", async (c) => {
    const dealId = c.req.param("dealId");
    const body = await c.req.json<{
      trigger: TraceTrigger;
      task: string;
      actor: string;
      tenant_id?: string;
      conversation_id?: string;
      parent_trace_id?: string;
    }>();

    const traceId = await ctx.decisionTraceService.startTrace({
      deal_id: dealId,
      tenant_id: body.tenant_id,
      trigger: body.trigger,
      task: body.task,
      actor: body.actor,
      conversation_id: body.conversation_id,
      parent_trace_id: body.parent_trace_id,
    });

    return c.json({ id: traceId }, 201);
  });

  // POST /v1/traces/:traceId/steps — Add a step to a trace
  app.post("/traces/:traceId/steps", async (c) => {
    const traceId = c.req.param("traceId");
    const body = await c.req.json<{
      type: TraceStepType;
      content?: string;
      tool_name?: string;
      tool_input?: Record<string, unknown>;
      tool_output?: Record<string, unknown>;
      duration_ms?: number;
    }>();

    const stepId = await ctx.decisionTraceService.addStep({
      trace_id: traceId,
      type: body.type,
      content: body.content,
      tool_name: body.tool_name,
      tool_input: body.tool_input,
      tool_output: body.tool_output,
      duration_ms: body.duration_ms,
    });

    return c.json({ id: stepId }, 201);
  });

  // POST /v1/traces/steps/:stepId/evidence — Link evidence to a step
  app.post("/traces/steps/:stepId/evidence", async (c) => {
    const stepId = c.req.param("stepId");
    const body = await c.req.json<{
      ref_type: EvidenceRefType;
      ref_id: string;
      relevance?: string;
    }>();

    const evidenceId = await ctx.decisionTraceService.addEvidence({
      step_id: stepId,
      ref_type: body.ref_type,
      ref_id: body.ref_id,
      relevance: body.relevance,
    });

    return c.json({ id: evidenceId }, 201);
  });

  // PATCH /v1/traces/:traceId/complete — Complete a trace
  app.patch("/traces/:traceId/complete", async (c) => {
    const traceId = c.req.param("traceId");
    const body = await c.req.json<{
      outcome: string;
      outcome_data?: Record<string, unknown>;
      status?: "completed" | "failed";
      total_duration_ms?: number;
      total_tokens_in?: number;
      total_tokens_out?: number;
    }>();

    await ctx.decisionTraceService.completeTrace(traceId, body);

    return c.json({ id: traceId, status: body.status ?? "completed" }, 200);
  });

  // PATCH /v1/traces/:traceId/abandon — Abandon a trace
  app.patch("/traces/:traceId/abandon", async (c) => {
    const traceId = c.req.param("traceId");
    const body = await c.req.json<{ reason?: string }>().catch(() => ({}));

    await ctx.decisionTraceService.abandonTrace(traceId, (body as { reason?: string }).reason);

    return c.json({ id: traceId, status: "abandoned" }, 200);
  });

  // GET /v1/traces/:traceId — Get a single trace with steps and evidence
  app.get("/traces/:traceId", async (c) => {
    const traceId = c.req.param("traceId");
    const trace = await ctx.decisionTraceService.getTrace(traceId);

    if (!trace) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Trace not found", retryable: false } },
        404
      );
    }

    return c.json(stripNulls(trace), 200);
  });

  // GET /v1/deals/:dealId/traces — List traces for a deal
  app.get("/deals/:dealId/traces", async (c) => {
    const dealId = c.req.param("dealId");
    const trigger = c.req.query("trigger") as TraceTrigger | undefined;
    const status = c.req.query("status") as TraceStatus | undefined;
    const actor = c.req.query("actor");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : undefined;
    const cursor = c.req.query("cursor");

    const result = await ctx.decisionTraceService.listTraces({
      deal_id: dealId,
      trigger,
      status,
      actor,
      limit,
      cursor,
    });

    return c.json(stripNulls(result), 200);
  });

  // GET /v1/traces/by-evidence — Find traces that reference a specific entity/document/etc.
  app.get("/traces/by-evidence", async (c) => {
    const refType = c.req.query("ref_type") as EvidenceRefType;
    const refId = c.req.query("ref_id");

    if (!refType || !refId) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "ref_type and ref_id are required", retryable: false } },
        400
      );
    }

    const result = await ctx.decisionTraceService.findByEvidence(refType, refId);
    return c.json(result, 200);
  });

  return app;
}
