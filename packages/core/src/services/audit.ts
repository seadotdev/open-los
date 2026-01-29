import { eq, and, asc } from "drizzle-orm";
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

let globalSeq = 0;

export class AuditService {
  constructor(private db: Database) {}

  async record(input: AuditEventInput): Promise<void> {
    const id = crypto.randomUUID();
    const seq = ++globalSeq;
    await this.db.insert(auditEvents).values({
      id,
      seq,
      deal_id: input.deal_id,
      type: input.type,
      actor: input.actor,
      timestamp: input.timestamp,
      object_type: input.object_type ?? null,
      object_id: input.object_id ?? null,
      changes: input.changes ?? null,
      metadata: input.metadata ?? null,
    });
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

    // Get all matching, ordered by sequence
    const allMatching = await this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(asc(auditEvents.seq));

    const total = allMatching.length;

    // Apply cursor-based pagination
    let events = allMatching;
    if (filters?.cursor) {
      const cursorIndex = events.findIndex((e) => e.id === filters.cursor);
      if (cursorIndex >= 0) {
        events = events.slice(cursorIndex + 1);
      }
    }

    // Apply limit
    let nextCursor: string | undefined;
    if (filters?.limit && events.length > filters.limit) {
      events = events.slice(0, filters.limit);
      nextCursor = events[events.length - 1]?.id;
    } else if (
      filters?.limit &&
      events.length === filters.limit &&
      events.length < total
    ) {
      nextCursor = events[events.length - 1]?.id;
    }

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
