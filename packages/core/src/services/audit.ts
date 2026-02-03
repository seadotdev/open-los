import { eq, and, asc, desc, sql } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { auditEvents } from "../schema/tables.js";

export interface AuditEventInput {
  deal_id: string;
  type: string;
  actor: string;
  timestamp: string;
  object_type?: string;
  object_id?: string;
  changes?: Array<{ field: string; before?: unknown; after?: unknown }>;
  metadata?: Record<string, unknown>;
}

type AuditExecutor = Pick<Database, "select" | "insert">;
type AuditDb = AuditExecutor & Partial<Pick<Database, "transaction">>;

export class AuditService {
  constructor(private db: Database) {}

  async record(input: AuditEventInput, db: AuditDb = this.db): Promise<void> {
    const runInsert = async (executor: AuditExecutor) => {
      const [latest] = await executor
        .select({ seq: auditEvents.seq })
        .from(auditEvents)
        .orderBy(desc(auditEvents.seq))
        .limit(1);
      const nextSeq = (latest?.seq ?? 0) + 1;
      const id = crypto.randomUUID();
      await executor.insert(auditEvents).values({
        id,
        seq: nextSeq,
        deal_id: input.deal_id,
        type: input.type,
        actor: input.actor,
        timestamp: input.timestamp,
        object_type: input.object_type ?? null,
        object_id: input.object_id ?? null,
        changes: input.changes ?? null,
        metadata: input.metadata ?? null,
      });
    };

    if (db.transaction) {
      await db.transaction(async (tx) => {
        await runInsert(tx);
      });
      return;
    }

    await runInsert(db);
  }

  async listByDeal(
    dealId: string,
    filters?: {
      type?: string;
      actor?: string;
      limit?: number;
      cursor?: string;
    }
  ) {
    const conditions = [eq(auditEvents.deal_id, dealId)];

    if (filters?.type) {
      conditions.push(eq(auditEvents.type, filters.type));
    }
    if (filters?.actor) {
      conditions.push(eq(auditEvents.actor, filters.actor));
    }

    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(auditEvents)
      .where(and(...conditions));

    if (filters?.cursor) {
      const [cursorRow] = await this.db
        .select({ seq: auditEvents.seq })
        .from(auditEvents)
        .where(and(eq(auditEvents.id, filters.cursor), ...conditions))
        .limit(1);
      if (cursorRow) {
        conditions.push(sql`${auditEvents.seq} > ${cursorRow.seq}`);
      }
    }

    const limit = filters?.limit ?? 50;
    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(asc(auditEvents.seq))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const events = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? events[events.length - 1]?.id : undefined;

    return {
      events: events.map((e) => ({
        id: e.id,
        deal_id: e.deal_id,
        type: e.type,
        actor: e.actor,
        actor_id: e.actor,
        timestamp: e.timestamp,
        object_type: e.object_type,
        object_id: e.object_id,
        changes: e.changes as Array<{
          field: string;
          before?: unknown;
          after?: unknown;
        }> | null,
        metadata: e.metadata as Record<string, unknown> | null,
        details: e.metadata as Record<string, unknown> | null,
      })),
      total,
      next_cursor: nextCursor,
    };
  }
}
