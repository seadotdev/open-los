import { eq, and, asc, gt, or, sql } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { deals } from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import { NotFoundError, ValidationError } from "./errors.js";

export interface CreateDealInput {
  borrower_name: string;
  borrower_registration_number?: string;
  jurisdiction?: string;
  requested_amount?: number;
  purpose?: string;
  assigned_to?: string;
  custom_fields?: Record<string, unknown>;
}

export interface UpdateDealInput {
  borrower_name?: string;
  borrower_registration_number?: string;
  jurisdiction?: string;
  requested_amount?: number;
  purpose?: string;
  assigned_to?: string;
  origination_outcome?: string;
  primary_entity_id?: string;
  custom_fields?: Record<string, unknown>;
}

export class DealService {
  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string
  ) {}

  async create(input: CreateDealInput, actor: string, tenantId = "default") {
    if (!input.borrower_name || input.borrower_name.trim() === "") {
      throw new ValidationError("borrower_name is required");
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    const deal = {
      id,
      tenant_id: tenantId,
      borrower_name: input.borrower_name,
      borrower_registration_number: input.borrower_registration_number ?? null,
      jurisdiction: input.jurisdiction ?? null,
      requested_amount: input.requested_amount ?? null,
      purpose: input.purpose ?? null,
      stage: "broker",
      origination_outcome: null,
      assigned_to: input.assigned_to ?? null,
      primary_entity_id: null,
      custom_fields: input.custom_fields ?? null,
      created_at: now,
      updated_at: now,
    };

    await this.db.insert(deals).values(deal);

    await this.audit.record({
      deal_id: id,
      type: "DEAL_CREATED",
      actor,
      timestamp: now,
      object_type: "deal",
      object_id: id,
    });

    return deal;
  }

  async getById(id: string, tenantId = "default") {
    const rows = await this.db
      .select()
      .from(deals)
      .where(and(eq(deals.id, id), eq(deals.tenant_id, tenantId)));
    if (rows.length === 0) {
      throw new NotFoundError(`Deal ${id} not found`);
    }
    return rows[0];
  }

  async update(id: string, input: UpdateDealInput, actor: string, tenantId = "default") {
    const existing = await this.getById(id, tenantId);
    const now = this.getNow();

    const changes: Array<{ field: string; before: unknown; after: unknown }> = [];
    const updates: Record<string, unknown> = { updated_at: now };

    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        const existingValue = (existing as Record<string, unknown>)[key];
        if (existingValue !== value) {
          changes.push({ field: key, before: existingValue ?? null, after: value });
          updates[key] = value;
        }
      }
    }

    if (changes.length > 0) {
      await this.db.update(deals).set(updates).where(and(eq(deals.id, id), eq(deals.tenant_id, tenantId)));

      await this.audit.record({
        deal_id: id,
        type: "DEAL_UPDATED",
        actor,
        timestamp: now,
        object_type: "deal",
        object_id: id,
        changes,
      });
    }

    return this.getById(id, tenantId);
  }

  async list(tenantId = "default", filters?: { stage?: string; limit?: number; cursor?: string }) {
    const conditions = [eq(deals.tenant_id, tenantId)];

    if (filters?.stage) {
      conditions.push(eq(deals.stage, filters.stage));
    }

    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(deals)
      .where(and(...conditions));

    if (filters?.cursor) {
      const [cursorRow] = await this.db
        .select({ id: deals.id, created_at: deals.created_at })
        .from(deals)
        .where(and(eq(deals.id, filters.cursor), ...conditions))
        .limit(1);
      if (cursorRow) {
        conditions.push(
          or(
            gt(deals.created_at, cursorRow.created_at),
            and(eq(deals.created_at, cursorRow.created_at), gt(deals.id, cursorRow.id))
          )
        );
      }
    }

    const limit = filters?.limit ?? 50;
    const rows = await this.db
      .select()
      .from(deals)
      .where(and(...conditions))
      .orderBy(asc(deals.created_at), asc(deals.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const dealsPage = hasMore ? rows.slice(0, limit) : rows;
    const cursor = hasMore ? dealsPage[dealsPage.length - 1]?.id : undefined;

    return { deals: dealsPage, total, cursor };
  }
}
