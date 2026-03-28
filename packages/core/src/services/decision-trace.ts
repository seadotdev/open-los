import { eq, and, desc, asc, sql } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { decisionTraces, traceSteps, traceEvidence } from "../schema/tables.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

export type TraceTrigger =
  | "stage_transition"
  | "covenant_test"
  | "document_review"
  | "risk_assessment"
  | "monitoring_alert"
  | "approval_decision"
  | "manual_query"
  | "spread_analysis";

export type TraceStepType = "thought" | "action" | "observation" | "retrieval";

export type TraceStatus = "in_progress" | "completed" | "failed" | "abandoned";

export type EvidenceRefType =
  | "entity"
  | "document"
  | "spread"
  | "covenant"
  | "alert"
  | "bank_transaction"
  | "loan_account"
  | "facility"
  | "stage_transition"
  | "approval_gate";

export interface StartTraceInput {
  deal_id: string;
  tenant_id?: string;
  trigger: TraceTrigger;
  task: string;
  actor: string;
  conversation_id?: string;
  parent_trace_id?: string;
}

export interface AddStepInput {
  trace_id: string;
  type: TraceStepType;
  content?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: Record<string, unknown>;
  duration_ms?: number;
}

export interface AddEvidenceInput {
  step_id: string;
  ref_type: EvidenceRefType;
  ref_id: string;
  relevance?: string;
}

export interface CompleteTraceInput {
  outcome: string;
  outcome_data?: Record<string, unknown>;
  status?: "completed" | "failed";
  total_duration_ms?: number;
  total_tokens_in?: number;
  total_tokens_out?: number;
}

export interface TraceQuery {
  deal_id?: string;
  tenant_id?: string;
  trigger?: TraceTrigger;
  status?: TraceStatus;
  actor?: string;
  limit?: number;
  cursor?: string;
}

// ─── Service ────────────────────────────────────────────────────────────────────

export class DecisionTraceService {
  constructor(
    private db: Database,
    private clock: () => string
  ) {}

  /** Start a new decision trace. Returns the trace ID. */
  async startTrace(input: StartTraceInput): Promise<string> {
    const id = crypto.randomUUID();
    const now = this.clock();

    await this.db.insert(decisionTraces).values({
      id,
      tenant_id: input.tenant_id ?? "default",
      deal_id: input.deal_id,
      trigger: input.trigger,
      task: input.task,
      actor: input.actor,
      conversation_id: input.conversation_id ?? null,
      parent_trace_id: input.parent_trace_id ?? null,
      status: "in_progress",
      created_at: now,
    });

    return id;
  }

  /** Add a step to an in-progress trace. Returns the step ID. */
  async addStep(input: AddStepInput): Promise<string> {
    const id = crypto.randomUUID();
    const now = this.clock();

    // Get next sequence number for this trace
    const [latest] = await this.db
      .select({ seq: traceSteps.seq })
      .from(traceSteps)
      .where(eq(traceSteps.trace_id, input.trace_id))
      .orderBy(desc(traceSteps.seq))
      .limit(1);

    const nextSeq = (latest?.seq ?? 0) + 1;

    await this.db.insert(traceSteps).values({
      id,
      trace_id: input.trace_id,
      seq: nextSeq,
      type: input.type,
      content: input.content ?? null,
      tool_name: input.tool_name ?? null,
      tool_input: input.tool_input ?? null,
      tool_output: input.tool_output ?? null,
      duration_ms: input.duration_ms ?? null,
      created_at: now,
    });

    return id;
  }

  /** Link evidence to a trace step. */
  async addEvidence(input: AddEvidenceInput): Promise<string> {
    const id = crypto.randomUUID();
    const now = this.clock();

    await this.db.insert(traceEvidence).values({
      id,
      step_id: input.step_id,
      ref_type: input.ref_type,
      ref_id: input.ref_id,
      relevance: input.relevance ?? null,
      created_at: now,
    });

    return id;
  }

  /** Complete (or fail) a trace with its outcome. */
  async completeTrace(traceId: string, input: CompleteTraceInput): Promise<void> {
    const now = this.clock();

    await this.db
      .update(decisionTraces)
      .set({
        outcome: input.outcome,
        outcome_data: input.outcome_data ?? null,
        status: input.status ?? "completed",
        total_duration_ms: input.total_duration_ms ?? null,
        total_tokens_in: input.total_tokens_in ?? null,
        total_tokens_out: input.total_tokens_out ?? null,
        completed_at: now,
      })
      .where(eq(decisionTraces.id, traceId));
  }

  /** Abandon a trace that was started but not completed. */
  async abandonTrace(traceId: string, reason?: string): Promise<void> {
    const now = this.clock();

    await this.db
      .update(decisionTraces)
      .set({
        status: "abandoned",
        outcome: reason ?? "Trace abandoned",
        completed_at: now,
      })
      .where(eq(decisionTraces.id, traceId));
  }

  /** Get a single trace with all its steps and evidence. */
  async getTrace(traceId: string) {
    const [trace] = await this.db
      .select()
      .from(decisionTraces)
      .where(eq(decisionTraces.id, traceId))
      .limit(1);

    if (!trace) return null;

    const steps = await this.db
      .select()
      .from(traceSteps)
      .where(eq(traceSteps.trace_id, traceId))
      .orderBy(asc(traceSteps.seq));

    // Fetch evidence for all steps in one query
    const stepIds = steps.map((s) => s.id);
    const evidence =
      stepIds.length > 0
        ? await this.db
            .select()
            .from(traceEvidence)
            .where(sql`${traceEvidence.step_id} IN (${sql.join(
              stepIds.map((id) => sql`${id}`),
              sql`, `
            )})`)
        : [];

    // Group evidence by step_id
    const evidenceByStep = new Map<string, typeof evidence>();
    for (const e of evidence) {
      const existing = evidenceByStep.get(e.step_id) ?? [];
      existing.push(e);
      evidenceByStep.set(e.step_id, existing);
    }

    return {
      ...trace,
      outcome_data: trace.outcome_data as Record<string, unknown> | null,
      steps: steps.map((s) => ({
        ...s,
        tool_input: s.tool_input as Record<string, unknown> | null,
        tool_output: s.tool_output as Record<string, unknown> | null,
        evidence: evidenceByStep.get(s.id) ?? [],
      })),
    };
  }

  /** List traces for a deal or tenant, with pagination. */
  async listTraces(query: TraceQuery = {}) {
    const conditions = [];

    if (query.deal_id) {
      conditions.push(eq(decisionTraces.deal_id, query.deal_id));
    }
    if (query.tenant_id) {
      conditions.push(eq(decisionTraces.tenant_id, query.tenant_id));
    }
    if (query.trigger) {
      conditions.push(eq(decisionTraces.trigger, query.trigger));
    }
    if (query.status) {
      conditions.push(eq(decisionTraces.status, query.status));
    }
    if (query.actor) {
      conditions.push(eq(decisionTraces.actor, query.actor));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(decisionTraces)
      .where(where);

    if (query.cursor) {
      const [cursorRow] = await this.db
        .select({ created_at: decisionTraces.created_at })
        .from(decisionTraces)
        .where(eq(decisionTraces.id, query.cursor))
        .limit(1);
      if (cursorRow) {
        conditions.push(
          sql`${decisionTraces.created_at} < ${cursorRow.created_at}`
        );
      }
    }

    const limit = query.limit ?? 50;
    const whereWithCursor = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(decisionTraces)
      .where(whereWithCursor)
      .orderBy(desc(decisionTraces.created_at))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const traces = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? traces[traces.length - 1]?.id : undefined;

    return {
      traces: traces.map((t) => ({
        ...t,
        outcome_data: t.outcome_data as Record<string, unknown> | null,
      })),
      total,
      next_cursor: nextCursor,
    };
  }

  /** Find all traces that reference a specific entity/document/etc. */
  async findByEvidence(refType: EvidenceRefType, refId: string) {
    const rows = await this.db
      .select({
        trace_id: traceSteps.trace_id,
        step_id: traceEvidence.step_id,
        relevance: traceEvidence.relevance,
      })
      .from(traceEvidence)
      .innerJoin(traceSteps, eq(traceEvidence.step_id, traceSteps.id))
      .where(
        and(
          eq(traceEvidence.ref_type, refType),
          eq(traceEvidence.ref_id, refId)
        )
      );

    // Return unique trace IDs
    const traceIds = [...new Set(rows.map((r) => r.trace_id))];
    return { trace_ids: traceIds, references: rows };
  }
}
