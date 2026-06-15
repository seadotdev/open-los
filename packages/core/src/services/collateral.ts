import { eq, and, desc } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { collateralItems, collateralValuations, deals } from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import { NotFoundError, ValidationError } from "./errors.js";

const VALID_ASSET_TYPES = [
  "real_estate",
  "vehicle",
  "inventory",
  "equipment",
  "other",
] as const;

const VALID_STATUSES = ["active", "released", "substituted"] as const;
const VALID_PURPOSES = ["ltv", "gdv", "insurance", "appraisal"] as const;
const VALID_VALUATION_METHODS = [
  "independent_appraisal",
  "automated_valuation",
  "comparable_sales",
  "cost_approach",
] as const;
const VALID_SOURCES = [
  "borrower_provided",
  "appraiser",
  "bank_internal",
  "regulatory",
] as const;
const VALID_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export interface CreateCollateralItemInput {
  name: string;
  asset_type: string;
  description?: string;
  jurisdiction?: string;
  address?: string;
  collateral_reference?: string;
  secured_parties?: Array<{ name: string; role: string; priority?: number }>;
}

export interface AddValuationInput {
  value: number;
  purpose: string;
  valuation_date: string;
  valuation_method?: string;
  source?: string;
  appraiser?: string;
  confidence_level?: string;
  notes?: string;
}

export interface CollateralItem {
  id: string;
  deal_id: string;
  name: string;
  asset_type: string;
  description?: string | null;
  jurisdiction?: string | null;
  address?: string | null;
  collateral_reference?: string | null;
  secured_parties?: Array<{ name: string; role: string; priority?: number }> | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface CollateralValuation {
  id: string;
  collateral_item_id: string;
  deal_id: string;
  value: number;
  purpose: string;
  valuation_date: string;
  valuation_method?: string | null;
  source?: string | null;
  appraiser?: string | null;
  confidence_level?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
}

export class CollateralService {
  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string
  ) {}

  // ─── Collateral Items ─────────────────────────────────────────────────

  async createItem(
    dealId: string,
    input: CreateCollateralItemInput,
    actor: string
  ): Promise<CollateralItem> {
    // Validate deal exists
    const dealRows = await this.db
      .select()
      .from(deals)
      .where(eq(deals.id, dealId));
    if (dealRows.length === 0) {
      throw new NotFoundError(`Deal ${dealId} not found`);
    }

    // Validate required fields
    if (!input.name || input.name.trim() === "") {
      throw new ValidationError("name is required");
    }
    if (!input.asset_type) {
      throw new ValidationError("asset_type is required");
    }
    if (
      !VALID_ASSET_TYPES.includes(
        input.asset_type as (typeof VALID_ASSET_TYPES)[number]
      )
    ) {
      throw new ValidationError(
        `Invalid asset_type: ${input.asset_type}. Must be one of: ${VALID_ASSET_TYPES.join(", ")}`
      );
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    const row = {
      id,
      deal_id: dealId,
      name: input.name,
      asset_type: input.asset_type,
      description: input.description ?? null,
      jurisdiction: input.jurisdiction ?? null,
      address: input.address ?? null,
      collateral_reference: input.collateral_reference ?? null,
      secured_parties: input.secured_parties ?? null,
      status: "active" as const,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await this.db.insert(collateralItems).values(row);

    await this.audit.record({
      deal_id: dealId,
      type: "COLLATERAL_ITEM_CREATED",
      actor,
      timestamp: now,
      object_type: "collateral_item",
      object_id: id,
      metadata: {
        collateral_id: id,
        name: input.name,
        asset_type: input.asset_type,
      },
    });

    return {
      id,
      deal_id: dealId,
      name: input.name,
      asset_type: input.asset_type,
      description: input.description,
      jurisdiction: input.jurisdiction,
      address: input.address,
      collateral_reference: input.collateral_reference,
      secured_parties: input.secured_parties,
      status: "active",
      created_at: now,
      updated_at: now,
    };
  }

  async getItemById(
    collateralId: string,
    dealId: string
  ): Promise<CollateralItem> {
    const rows = await this.db
      .select()
      .from(collateralItems)
      .where(
        and(
          eq(collateralItems.id, collateralId),
          eq(collateralItems.deal_id, dealId)
        )
      );

    if (rows.length === 0) {
      throw new NotFoundError(`Collateral item ${collateralId} not found`);
    }

    return rows[0] as CollateralItem;
  }

  async listItems(dealId: string): Promise<CollateralItem[]> {
    // Validate deal exists
    const dealRows = await this.db
      .select()
      .from(deals)
      .where(eq(deals.id, dealId));
    if (dealRows.length === 0) {
      throw new NotFoundError(`Deal ${dealId} not found`);
    }

    const rows = await this.db
      .select()
      .from(collateralItems)
      .where(eq(collateralItems.deal_id, dealId));

    return rows as CollateralItem[];
  }

  async releaseCollateral(
    collateralId: string,
    dealId: string,
    actor: string
  ): Promise<CollateralItem> {
    const existing = await this.getItemById(collateralId, dealId);
    const now = this.getNow();

    await this.db
      .update(collateralItems)
      .set({ status: "released", updated_at: now })
      .where(eq(collateralItems.id, collateralId));

    await this.audit.record({
      deal_id: dealId,
      type: "COLLATERAL_RELEASED",
      actor,
      timestamp: now,
      object_type: "collateral_item",
      object_id: collateralId,
      metadata: {
        collateral_id: collateralId,
        previous_status: existing.status,
        new_status: "released",
      },
    });

    return this.getItemById(collateralId, dealId);
  }

  // ─── Collateral Valuations ────────────────────────────────────────────

  async addValuation(
    collateralId: string,
    dealId: string,
    input: AddValuationInput,
    actor: string
  ): Promise<CollateralValuation> {
    // Validate collateral exists
    await this.getItemById(collateralId, dealId);

    // Validate required fields
    if (input.value === undefined || input.value <= 0) {
      throw new ValidationError("value must be a positive number");
    }
    if (!input.purpose) {
      throw new ValidationError("purpose is required");
    }
    if (
      !VALID_PURPOSES.includes(input.purpose as (typeof VALID_PURPOSES)[number])
    ) {
      throw new ValidationError(
        `Invalid purpose: ${input.purpose}. Must be one of: ${VALID_PURPOSES.join(", ")}`
      );
    }
    if (!input.valuation_date) {
      throw new ValidationError("valuation_date is required");
    }

    // Validate optional enum fields
    if (
      input.valuation_method &&
      !VALID_VALUATION_METHODS.includes(
        input.valuation_method as (typeof VALID_VALUATION_METHODS)[number]
      )
    ) {
      throw new ValidationError(
        `Invalid valuation_method: ${input.valuation_method}. Must be one of: ${VALID_VALUATION_METHODS.join(", ")}`
      );
    }
    if (
      input.source &&
      !VALID_SOURCES.includes(input.source as (typeof VALID_SOURCES)[number])
    ) {
      throw new ValidationError(
        `Invalid source: ${input.source}. Must be one of: ${VALID_SOURCES.join(", ")}`
      );
    }
    if (
      input.confidence_level &&
      !VALID_CONFIDENCE_LEVELS.includes(
        input.confidence_level as (typeof VALID_CONFIDENCE_LEVELS)[number]
      )
    ) {
      throw new ValidationError(
        `Invalid confidence_level: ${input.confidence_level}. Must be one of: ${VALID_CONFIDENCE_LEVELS.join(", ")}`
      );
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    const row = {
      id,
      collateral_item_id: collateralId,
      deal_id: dealId,
      value: input.value,
      purpose: input.purpose,
      valuation_date: input.valuation_date,
      valuation_method: input.valuation_method ?? null,
      source: input.source ?? null,
      appraiser: input.appraiser ?? null,
      confidence_level: input.confidence_level ?? null,
      notes: input.notes ?? null,
      created_by: actor,
      created_at: now,
    };

    await this.db.insert(collateralValuations).values(row);

    await this.audit.record({
      deal_id: dealId,
      type: "COLLATERAL_VALUATION_ADDED",
      actor,
      timestamp: now,
      object_type: "collateral_valuation",
      object_id: id,
      metadata: {
        valuation_id: id,
        collateral_id: collateralId,
        value: input.value,
        purpose: input.purpose,
      },
    });

    return {
      id,
      collateral_item_id: collateralId,
      deal_id: dealId,
      value: input.value,
      purpose: input.purpose,
      valuation_date: input.valuation_date,
      valuation_method: input.valuation_method,
      source: input.source,
      appraiser: input.appraiser,
      confidence_level: input.confidence_level,
      notes: input.notes,
      created_by: actor,
      created_at: now,
    };
  }

  async listValuations(
    collateralId: string,
    dealId: string,
    filters?: { purpose?: string | string[]; limit?: number; cursor?: string }
  ): Promise<{
    valuations: CollateralValuation[];
    next_cursor?: string;
  }> {
    // Validate collateral exists
    await this.getItemById(collateralId, dealId);

    let query = this.db
      .select()
      .from(collateralValuations)
      .where(
        and(
          eq(collateralValuations.collateral_item_id, collateralId),
          eq(collateralValuations.deal_id, dealId)
        )
      );

    // Filter by purpose if provided
    if (filters?.purpose) {
      const purposes = Array.isArray(filters.purpose)
        ? filters.purpose
        : [filters.purpose];
      query = query.where((collateralValuations.purpose as any).in(purposes));
    }

    const limit = filters?.limit ?? 50;
    const rows = (await query
      .orderBy(desc(collateralValuations.created_at))
      .limit(limit + 1)) as CollateralValuation[];

    let next_cursor: string | undefined;
    if (rows.length > limit) {
      next_cursor = rows[limit - 1].id;
      rows.pop();
    }

    return {
      valuations: rows,
      next_cursor,
    };
  }

  async getLatestValuation(
    collateralId: string,
    dealId: string,
    purpose?: string | string[]
  ): Promise<CollateralValuation | null> {
    // Validate collateral exists
    await this.getItemById(collateralId, dealId);

    let query = this.db
      .select()
      .from(collateralValuations)
      .where(
        and(
          eq(collateralValuations.collateral_item_id, collateralId),
          eq(collateralValuations.deal_id, dealId)
        )
      );

    if (purpose) {
      const purposes = Array.isArray(purpose) ? purpose : [purpose];
      query = query.where(
        (collateralValuations.purpose as any).in(purposes)
      );
    }

    const rows = (await query.orderBy(
      desc(collateralValuations.created_at)
    ).limit(1)) as CollateralValuation[];

    return rows.length > 0 ? rows[0] : null;
  }
}
