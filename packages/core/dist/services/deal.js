import { eq, and } from "drizzle-orm";
import { deals } from "../schema/tables.js";
import { NotFoundError, ValidationError } from "./errors.js";
export class DealService {
    db;
    audit;
    getNow;
    constructor(db, audit, getNow) {
        this.db = db;
        this.audit = audit;
        this.getNow = getNow;
    }
    async create(input, actor, tenantId = "default") {
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
    async getById(id, tenantId = "default") {
        const rows = await this.db
            .select()
            .from(deals)
            .where(and(eq(deals.id, id), eq(deals.tenant_id, tenantId)));
        if (rows.length === 0) {
            throw new NotFoundError(`Deal ${id} not found`);
        }
        return rows[0];
    }
    async update(id, input, actor, tenantId = "default") {
        const existing = await this.getById(id, tenantId);
        const now = this.getNow();
        const changes = [];
        const updates = { updated_at: now };
        for (const [key, value] of Object.entries(input)) {
            if (value !== undefined) {
                const existingValue = existing[key];
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
    async list(tenantId = "default", filters) {
        let rows = await this.db
            .select()
            .from(deals)
            .where(eq(deals.tenant_id, tenantId));
        if (filters?.stage) {
            rows = rows.filter((r) => r.stage === filters.stage);
        }
        const total = rows.length;
        // Cursor-based pagination
        if (filters?.cursor) {
            const idx = rows.findIndex((r) => r.id === filters.cursor);
            if (idx >= 0) {
                rows = rows.slice(idx + 1);
            }
        }
        const limit = filters?.limit ?? 50;
        let cursor;
        if (rows.length > limit) {
            rows = rows.slice(0, limit);
            cursor = rows[rows.length - 1]?.id;
        }
        return { deals: rows, total, cursor };
    }
}
//# sourceMappingURL=deal.js.map