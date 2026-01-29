import { eq, and, or } from "drizzle-orm";
import { entities, relationships } from "../schema/tables.js";
import { NotFoundError, ValidationError, ConflictError } from "./errors.js";
const VALID_ENTITY_TYPES = ["company", "person"];
// Helper to strip tenant_id and deleted_at from entity responses (not in API schema)
function toApiEntity(entity) {
    const { tenant_id, deleted_at, ...rest } = entity;
    return rest;
}
export class EntityService {
    db;
    audit;
    getNow;
    constructor(db, audit, getNow) {
        this.db = db;
        this.audit = audit;
        this.getNow = getNow;
    }
    async create(input, actor, dealId, tenantId = "default") {
        if (!input.name || input.name.trim() === "") {
            throw new ValidationError("name is required");
        }
        if (!input.type || !VALID_ENTITY_TYPES.includes(input.type)) {
            throw new ValidationError("type must be 'company' or 'person'");
        }
        const id = crypto.randomUUID();
        const now = this.getNow();
        const entity = {
            id,
            tenant_id: tenantId,
            type: input.type,
            name: input.name,
            legal_name: input.legal_name ?? null,
            registration_number: input.registration_number ?? null,
            lei: input.lei ?? null,
            jurisdiction: input.jurisdiction ?? null,
            identifiers: input.identifiers ?? null,
            created_at: now,
            updated_at: now,
            deleted_at: null,
        };
        await this.db.insert(entities).values(entity);
        // Record audit event if linked to a deal
        if (dealId) {
            await this.audit.record({
                deal_id: dealId,
                type: "ENTITY_CREATED",
                actor,
                timestamp: now,
                object_type: "entity",
                object_id: id,
                metadata: { entity_type: input.type, name: input.name },
            });
        }
        return toApiEntity(entity);
    }
    async getById(id, tenantId = "default") {
        const rows = await this.db
            .select()
            .from(entities)
            .where(and(eq(entities.id, id), eq(entities.tenant_id, tenantId)));
        if (rows.length === 0) {
            throw new NotFoundError(`Entity ${id} not found`);
        }
        return toApiEntity(rows[0]);
    }
    async update(id, input, actor, dealId, tenantId = "default") {
        const existing = await this.getById(id, tenantId);
        const now = this.getNow();
        // Entity type cannot be changed after creation
        if (input.type !== undefined && input.type !== existing.type) {
            throw new ValidationError("Entity type cannot be changed after creation");
        }
        const changes = [];
        const updates = { updated_at: now };
        // Only allow updating certain fields (not type)
        const allowedFields = ["name", "legal_name", "registration_number", "lei", "jurisdiction"];
        for (const field of allowedFields) {
            const value = input[field];
            if (value !== undefined) {
                const existingValue = existing[field];
                if (existingValue !== value) {
                    changes.push({ field, before: existingValue ?? null, after: value });
                    updates[field] = value;
                }
            }
        }
        if (changes.length > 0) {
            await this.db.update(entities).set(updates).where(and(eq(entities.id, id), eq(entities.tenant_id, tenantId)));
            // Record audit event if linked to a deal
            if (dealId) {
                await this.audit.record({
                    deal_id: dealId,
                    type: "ENTITY_UPDATED",
                    actor,
                    timestamp: now,
                    object_type: "entity",
                    object_id: id,
                    changes,
                });
            }
        }
        return this.getById(id, tenantId);
    }
    async list(tenantId = "default", filters) {
        let rows;
        if (filters?.type) {
            // Filter by both tenant and type
            rows = await this.db
                .select()
                .from(entities)
                .where(and(eq(entities.tenant_id, tenantId), eq(entities.type, filters.type)));
        }
        else {
            // Filter by tenant only
            rows = await this.db
                .select()
                .from(entities)
                .where(eq(entities.tenant_id, tenantId));
        }
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
        return { entities: rows.map(toApiEntity), cursor };
    }
    async delete(id, tenantId = "default") {
        // Check if entity has relationships
        const relatedRows = await this.db
            .select()
            .from(relationships)
            .where(or(eq(relationships.from_entity_id, id), eq(relationships.to_entity_id, id)));
        if (relatedRows.length > 0) {
            throw new ConflictError("Cannot delete entity with existing relationships");
        }
        const existing = await this.getById(id, tenantId);
        await this.db.delete(entities).where(and(eq(entities.id, id), eq(entities.tenant_id, tenantId)));
        return existing; // Already transformed by getById
    }
    async findDealIdByEntity(entityId) {
        // This is a helper to find the deal associated with an entity
        // Look up any deal where this entity is the primary_entity_id
        const { deals } = await import("../schema/tables.js");
        const rows = await this.db
            .select()
            .from(deals)
            .where(eq(deals.primary_entity_id, entityId));
        return rows[0]?.id ?? null;
    }
}
//# sourceMappingURL=entity.js.map