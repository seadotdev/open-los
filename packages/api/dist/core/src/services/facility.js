import { eq, and } from "drizzle-orm";
import { facilities, deals } from "../schema/tables.js";
import { NotFoundError, ValidationError } from "./errors.js";
const VALID_TYPES = ["term_loan", "revolver", "letter_of_credit"];
const VALID_STATUSES = ["proposed", "approved", "active", "closed"];
const VALID_RATE_TYPES = ["fixed", "floating"];
export class FacilityService {
    db;
    audit;
    getNow;
    constructor(db, audit, getNow) {
        this.db = db;
        this.audit = audit;
        this.getNow = getNow;
    }
    async create(dealId, input, actor) {
        // Validate deal exists
        const dealRows = await this.db.select().from(deals).where(eq(deals.id, dealId));
        if (dealRows.length === 0) {
            throw new NotFoundError(`Deal ${dealId} not found`);
        }
        // Validate required fields
        if (!input.type) {
            throw new ValidationError("type is required");
        }
        if (!VALID_TYPES.includes(input.type)) {
            throw new ValidationError(`Invalid facility type: ${input.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
        }
        if (input.amount === undefined || input.amount <= 0) {
            throw new ValidationError("amount must be a positive number");
        }
        if (input.interest_rate_type && !VALID_RATE_TYPES.includes(input.interest_rate_type)) {
            throw new ValidationError(`Invalid interest_rate_type: ${input.interest_rate_type}. Must be one of: ${VALID_RATE_TYPES.join(", ")}`);
        }
        const id = crypto.randomUUID();
        const now = this.getNow();
        const facilityRow = {
            id,
            deal_id: dealId,
            type: input.type,
            amount: input.amount,
            currency: input.currency ?? "USD",
            interest_rate_type: input.interest_rate_type ?? null,
            interest_rate_value: input.interest_rate_value ?? null,
            interest_rate_spread: input.interest_rate_spread ?? null,
            term_months: input.term_months ?? null,
            repayment_schedule: input.repayment_schedule ?? null,
            status: "proposed",
            created_at: now,
            updated_at: now,
        };
        await this.db.insert(facilities).values(facilityRow);
        await this.audit.record({
            deal_id: dealId,
            type: "FACILITY_CREATED",
            actor,
            timestamp: now,
            object_type: "facility",
            object_id: id,
            metadata: {
                facility_id: id,
                type: input.type,
                amount: input.amount,
                currency: facilityRow.currency,
            },
        });
        return {
            id,
            deal_id: dealId,
            type: input.type,
            amount: input.amount,
            currency: facilityRow.currency,
            interest_rate_type: input.interest_rate_type,
            interest_rate_value: input.interest_rate_value,
            interest_rate_spread: input.interest_rate_spread,
            term_months: input.term_months,
            repayment_schedule: input.repayment_schedule,
            status: "proposed",
            created_at: now,
            updated_at: now,
        };
    }
    async getById(dealId, facilityId) {
        const rows = await this.db
            .select()
            .from(facilities)
            .where(and(eq(facilities.id, facilityId), eq(facilities.deal_id, dealId)));
        if (rows.length === 0) {
            throw new NotFoundError(`Facility ${facilityId} not found`);
        }
        return rows[0];
    }
    async list(dealId) {
        // Validate deal exists
        const dealRows = await this.db.select().from(deals).where(eq(deals.id, dealId));
        if (dealRows.length === 0) {
            throw new NotFoundError(`Deal ${dealId} not found`);
        }
        const rows = await this.db.select().from(facilities).where(eq(facilities.deal_id, dealId));
        return { facilities: rows };
    }
    async update(dealId, facilityId, input, actor) {
        const existing = await this.getById(dealId, facilityId);
        const now = this.getNow();
        // Validate status if provided
        if (input.status && !VALID_STATUSES.includes(input.status)) {
            throw new ValidationError(`Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(", ")}`);
        }
        // Validate type if provided
        if (input.type && !VALID_TYPES.includes(input.type)) {
            throw new ValidationError(`Invalid facility type: ${input.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
        }
        const changes = [];
        const updates = { updated_at: now };
        const allowedFields = [
            "type", "amount", "currency", "interest_rate_type", "interest_rate_value",
            "interest_rate_spread", "term_months", "repayment_schedule", "status"
        ];
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
            await this.db.update(facilities).set(updates).where(eq(facilities.id, facilityId));
            await this.audit.record({
                deal_id: dealId,
                type: "FACILITY_UPDATED",
                actor,
                timestamp: now,
                object_type: "facility",
                object_id: facilityId,
                changes,
            });
        }
        return this.getById(dealId, facilityId);
    }
    async delete(dealId, facilityId, actor) {
        const existing = await this.getById(dealId, facilityId);
        await this.db.delete(facilities).where(eq(facilities.id, facilityId));
        await this.audit.record({
            deal_id: dealId,
            type: "FACILITY_DELETED",
            actor,
            timestamp: this.getNow(),
            object_type: "facility",
            object_id: facilityId,
            metadata: {
                type: existing.type,
                amount: existing.amount,
            },
        });
        return existing;
    }
}
//# sourceMappingURL=facility.js.map