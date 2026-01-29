import { eq, and } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { facilities, deals } from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import { NotFoundError, ValidationError } from "./errors.js";

const VALID_TYPES = ["term_loan", "revolver", "letter_of_credit"] as const;
const VALID_STATUSES = ["proposed", "approved", "active", "closed"] as const;
const VALID_RATE_TYPES = ["fixed", "floating"] as const;

export interface CreateFacilityInput {
  type: string;
  amount: number;
  currency?: string;
  interest_rate_type?: string;
  interest_rate_value?: number;
  interest_rate_spread?: number;
  term_months?: number;
  repayment_schedule?: unknown;
}

export interface UpdateFacilityInput {
  type?: string;
  amount?: number;
  currency?: string;
  interest_rate_type?: string;
  interest_rate_value?: number;
  interest_rate_spread?: number;
  term_months?: number;
  repayment_schedule?: unknown;
  status?: string;
}

export class FacilityService {
  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string
  ) {}

  async create(dealId: string, input: CreateFacilityInput, actor: string) {
    // Validate deal exists
    const dealRows = await this.db.select().from(deals).where(eq(deals.id, dealId));
    if (dealRows.length === 0) {
      throw new NotFoundError(`Deal ${dealId} not found`);
    }

    // Validate required fields
    if (!input.type) {
      throw new ValidationError("type is required");
    }
    if (!VALID_TYPES.includes(input.type as typeof VALID_TYPES[number])) {
      throw new ValidationError(`Invalid facility type: ${input.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
    }
    if (input.amount === undefined || input.amount <= 0) {
      throw new ValidationError("amount must be a positive number");
    }
    if (input.interest_rate_type && !VALID_RATE_TYPES.includes(input.interest_rate_type as typeof VALID_RATE_TYPES[number])) {
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
      status: "proposed" as const,
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

  async getById(dealId: string, facilityId: string) {
    const rows = await this.db
      .select()
      .from(facilities)
      .where(and(eq(facilities.id, facilityId), eq(facilities.deal_id, dealId)));
    if (rows.length === 0) {
      throw new NotFoundError(`Facility ${facilityId} not found`);
    }
    return rows[0];
  }

  async list(dealId: string) {
    // Validate deal exists
    const dealRows = await this.db.select().from(deals).where(eq(deals.id, dealId));
    if (dealRows.length === 0) {
      throw new NotFoundError(`Deal ${dealId} not found`);
    }

    const rows = await this.db.select().from(facilities).where(eq(facilities.deal_id, dealId));
    return { facilities: rows };
  }

  async update(dealId: string, facilityId: string, input: UpdateFacilityInput, actor: string) {
    const existing = await this.getById(dealId, facilityId);
    const now = this.getNow();

    // Validate status if provided
    if (input.status && !VALID_STATUSES.includes(input.status as typeof VALID_STATUSES[number])) {
      throw new ValidationError(`Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    // Validate type if provided
    if (input.type && !VALID_TYPES.includes(input.type as typeof VALID_TYPES[number])) {
      throw new ValidationError(`Invalid facility type: ${input.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
    }

    const changes: Array<{ field: string; before: unknown; after: unknown }> = [];
    const updates: Record<string, unknown> = { updated_at: now };

    const allowedFields = [
      "type", "amount", "currency", "interest_rate_type", "interest_rate_value",
      "interest_rate_spread", "term_months", "repayment_schedule", "status"
    ];

    for (const field of allowedFields) {
      const value = (input as Record<string, unknown>)[field];
      if (value !== undefined) {
        const existingValue = (existing as Record<string, unknown>)[field];
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

  async delete(dealId: string, facilityId: string, actor: string) {
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
