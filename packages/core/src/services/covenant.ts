import { eq, and } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { covenants, covenantTests, waivers, deals, spreads, loanAccounts } from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import type { CollateralService } from "./collateral.js";
import { NotFoundError, ValidationError } from "./errors.js";
import type { Ratios } from "./spread.js";

const VALID_OPERATORS = [">=", "<=", ">", "<", "=="] as const;
const VALID_TYPES = ["financial", "reporting", "information"] as const;
const VALID_FREQUENCIES = ["monthly", "quarterly", "annually"] as const;

export interface CreateCovenantInput {
  name: string;
  type: string;
  metric: string;
  operator?: string;
  threshold?: number;
  frequency?: string;
  grace_period_days?: number;
  notes?: string;
  reporting_deadline_days?: number;
}

export interface CreateWaiverInput {
  reason: string;
  approved_by: string;
  valid_from?: string;
  valid_until?: string;
}

export interface CovenantTestResult {
  covenant_id: string;
  covenant_name?: string;
  status: "pass" | "fail" | "warning" | "grace_period" | "waived";
  actual_value: number;
  threshold: number;
  operator: string;
  metric: string;
  tested_at: string;
  grace_period_expires?: string;
}

function compareValue(
  actual: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case ">=":
      return actual >= threshold;
    case "<=":
      return actual <= threshold;
    case ">":
      return actual > threshold;
    case "<":
      return actual < threshold;
    case "==":
      return actual === threshold;
    default:
      return false;
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export class CovenantService {
  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string,
    private collateralService?: CollateralService
  ) {}

  async create(dealId: string, input: CreateCovenantInput, actor: string) {
    // Validate deal exists
    const dealRows = await this.db
      .select()
      .from(deals)
      .where(eq(deals.id, dealId));
    if (dealRows.length === 0) {
      throw new NotFoundError(`Deal ${dealId} not found`);
    }

    // Validate required fields
    if (!input.name) {
      throw new ValidationError("name is required");
    }
    if (!input.type) {
      throw new ValidationError("type is required");
    }
    if (!input.metric) {
      throw new ValidationError("metric is required");
    }

    // For financial covenants, validate operator and threshold
    if (input.type === "financial") {
      if (input.operator && !VALID_OPERATORS.includes(input.operator as typeof VALID_OPERATORS[number])) {
        throw new ValidationError(`Invalid operator: ${input.operator}. Must be one of: ${VALID_OPERATORS.join(", ")}`);
      }
      if (input.operator && input.threshold === undefined) {
        throw new ValidationError("threshold is required when operator is provided");
      }
    }

    // Validate operator if provided
    if (input.operator && !VALID_OPERATORS.includes(input.operator as typeof VALID_OPERATORS[number])) {
      throw new ValidationError(`Invalid operator: ${input.operator}. Must be one of: ${VALID_OPERATORS.join(", ")}`);
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    const covenantRow = {
      id,
      deal_id: dealId,
      name: input.name,
      type: input.type,
      metric: input.metric,
      operator: input.operator ?? null,
      threshold: input.threshold ?? null,
      frequency: input.frequency ?? null,
      grace_period_days: input.grace_period_days ?? 0,
      notes: input.notes ?? null,
      reporting_deadline_days: input.reporting_deadline_days ?? null,
      created_at: now,
    };

    await this.db.insert(covenants).values(covenantRow);

    await this.audit.record({
      deal_id: dealId,
      type: "COVENANT_CREATED",
      actor,
      timestamp: now,
      object_type: "covenant",
      object_id: id,
      metadata: {
        covenant_id: id,
        name: input.name,
        type: input.type,
        metric: input.metric,
      },
    });

    return {
      id,
      deal_id: dealId,
      name: input.name,
      type: input.type,
      metric: input.metric,
      operator: input.operator,
      threshold: input.threshold,
      frequency: input.frequency,
      grace_period_days: input.grace_period_days ?? 0,
      notes: input.notes,
      reporting_deadline_days: input.reporting_deadline_days,
      created_at: now,
    };
  }

  async list(dealId: string) {
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
      .from(covenants)
      .where(eq(covenants.deal_id, dealId));

    return {
      covenants: rows.map((row) => ({
        id: row.id,
        deal_id: row.deal_id,
        name: row.name,
        type: row.type,
        metric: row.metric,
        operator: row.operator,
        threshold: row.threshold,
        frequency: row.frequency,
        grace_period_days: row.grace_period_days,
        notes: row.notes,
        reporting_deadline_days: row.reporting_deadline_days,
        created_at: row.created_at,
      })),
    };
  }

  async test(
    dealId: string,
    actor: string,
    options?: { covenant_ids?: string[]; as_of?: string; as_of_period?: string }
  ) {
    // Validate deal exists
    const dealRows = await this.db
      .select()
      .from(deals)
      .where(eq(deals.id, dealId));
    if (dealRows.length === 0) {
      throw new NotFoundError(`Deal ${dealId} not found`);
    }

    // Get all covenants for deal (or filtered by IDs)
    let covenantRows = await this.db
      .select()
      .from(covenants)
      .where(eq(covenants.deal_id, dealId));

    if (options?.covenant_ids && options.covenant_ids.length > 0) {
      covenantRows = covenantRows.filter((c) =>
        options.covenant_ids!.includes(c.id)
      );
    }

    // Get latest spread for the deal to retrieve ratios
    const spreadRows = await this.db
      .select()
      .from(spreads)
      .where(eq(spreads.deal_id, dealId));

    // Get the spread with the most recent created_at, or by matching period
    let latestSpread = spreadRows[spreadRows.length - 1] ?? null;

    const now = new Date(this.getNow());
    const results: CovenantTestResult[] = [];

    for (const covenant of covenantRows) {
      // Skip non-financial covenants for now (no automated testing)
      if (covenant.type !== "financial") {
        continue;
      }

      // Get actual value for the metric
      let actualValue = await this.getMetricValue(
        covenant.metric,
        dealId,
        latestSpread?.ratios as Ratios | null,
        latestSpread?.line_items as Array<{ category: string; label: string; amount: number }> | null
      );

      const threshold = covenant.threshold ?? 0;
      const operator = covenant.operator ?? ">=";

      // Check if waiver is active
      const activeWaiver = await this.getActiveWaiver(covenant.id, now);

      // Check for previous grace period entry
      const prevTests = await this.db
        .select()
        .from(covenantTests)
        .where(
          and(
            eq(covenantTests.covenant_id, covenant.id),
            eq(covenantTests.deal_id, dealId)
          )
        );

      const prevGracePeriodTest = prevTests.find(
        (t) => t.status === "grace_period"
      );

      let status: CovenantTestResult["status"];
      let gracePeriodExpires: string | undefined;

      if (activeWaiver) {
        status = "waived";
      } else if (actualValue !== null && compareValue(actualValue, operator, threshold)) {
        status = "pass";
      } else {
        // Failed - check grace period
        const graceDays = covenant.grace_period_days ?? 0;
        if (graceDays > 0) {
          if (prevGracePeriodTest && prevGracePeriodTest.grace_period_expires) {
            // Check if grace period has expired
            const gracePeriodExpiry = new Date(prevGracePeriodTest.grace_period_expires);
            if (now >= gracePeriodExpiry) {
              status = "fail";
            } else {
              status = "grace_period";
              gracePeriodExpires = prevGracePeriodTest.grace_period_expires;
            }
          } else {
            // First time failing, enter grace period
            status = "grace_period";
            gracePeriodExpires = addDays(now, graceDays).toISOString().replace(".000Z", "Z");
          }
        } else {
          status = "fail";
        }
      }

      const testId = crypto.randomUUID();
      const testedAt = this.getNow();

      await this.db.insert(covenantTests).values({
        id: testId,
        covenant_id: covenant.id,
        deal_id: dealId,
        status,
        actual_value: actualValue,
        threshold,
        operator,
        metric: covenant.metric,
        tested_at: testedAt,
        grace_period_expires: gracePeriodExpires ?? null,
      });

      results.push({
        covenant_id: covenant.id,
        covenant_name: covenant.name,
        status,
        actual_value: actualValue ?? 0,
        threshold,
        operator,
        metric: covenant.metric,
        tested_at: testedAt,
        grace_period_expires: gracePeriodExpires,
      });
    }

    await this.audit.record({
      deal_id: dealId,
      type: "COVENANT_TESTED",
      actor,
      timestamp: this.getNow(),
      object_type: "covenant_test",
      metadata: {
        results_count: results.length,
        passed: results.filter((r) => r.status === "pass").length,
        failed: results.filter((r) => r.status === "fail").length,
      },
    });

    return { results };
  }

  private async getMetricValue(
    metric: string,
    dealId: string,
    ratios: Ratios | null,
    lineItems: Array<{ category: string; label: string; amount: number }> | null
  ): Promise<number | null> {
    switch (metric) {
      case "loan_to_value":
        return await this.computeLTV(dealId);
      case "dscr":
        return ratios?.dscr ?? null;
      case "leverage":
        return ratios?.leverage ?? null;
      case "gross_margin":
        return ratios?.gross_margin ?? null;
      case "current_ratio":
        return ratios?.current_ratio ?? null;
      case "debt_to_equity":
        return ratios?.debt_to_equity ?? null;
      case "net_margin":
        return ratios?.net_margin ?? null;
      case "min_liquidity":
        // Get cash from line items
        if (lineItems) {
          const cashItems = lineItems.filter((i) => i.category === "cash");
          const total = cashItems.reduce((sum, i) => sum + i.amount, 0);
          return total;
        }
        return null;
      default:
        return null;
    }
  }

  private async computeLTV(dealId: string): Promise<number | null> {
    if (!this.collateralService) return null;

    try {
      // Get all active collateral items for deal
      const items = await this.collateralService.listItems(dealId);
      const activeItems = items.filter((item) => item.status === "active");

      if (activeItems.length === 0) return null;

      // Get total collateral value (latest ltv or gdv valuation)
      let collateralValue = 0;
      for (const item of activeItems) {
        const valuation = await this.collateralService.getLatestValuation(
          item.id,
          dealId,
          ["ltv", "gdv"]
        );
        if (valuation) {
          collateralValue += valuation.value;
        }
      }

      if (collateralValue === 0) return null;

      // Get total loan disbursements across all loans in the deal
      const loanRows = await this.db
        .select({ principal_disbursed: loanAccounts.principal_disbursed })
        .from(loanAccounts)
        .where(eq(loanAccounts.deal_id, dealId));

      const loanAmount = loanRows.reduce(
        (sum, l) => sum + (l.principal_disbursed ?? 0),
        0
      );

      // Return LTV = loanAmount / collateralValue
      return collateralValue > 0 ? loanAmount / collateralValue : null;
    } catch {
      // If collateral service is not available or errors occur, return null
      return null;
    }
  }

  private async getActiveWaiver(
    covenantId: string,
    asOf: Date
  ) {
    const waiverRows = await this.db
      .select()
      .from(waivers)
      .where(eq(waivers.covenant_id, covenantId));

    for (const waiver of waiverRows) {
      const validFrom = waiver.valid_from
        ? new Date(waiver.valid_from)
        : new Date(waiver.created_at);
      const validUntil = waiver.valid_until ? new Date(waiver.valid_until) : null;

      if (asOf >= validFrom) {
        if (!validUntil || asOf <= validUntil) {
          return waiver;
        }
      }
    }

    return null;
  }

  async createWaiver(
    covenantId: string,
    input: CreateWaiverInput,
    actor: string
  ) {
    // Validate covenant exists
    const covenantRows = await this.db
      .select()
      .from(covenants)
      .where(eq(covenants.id, covenantId));
    if (covenantRows.length === 0) {
      throw new NotFoundError(`Covenant ${covenantId} not found`);
    }

    const covenant = covenantRows[0];

    // Validate required fields
    if (!input.reason) {
      throw new ValidationError("reason is required");
    }
    if (!input.approved_by) {
      throw new ValidationError("approved_by is required");
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    await this.db.insert(waivers).values({
      id,
      covenant_id: covenantId,
      reason: input.reason,
      approved_by: input.approved_by,
      valid_from: input.valid_from ?? null,
      valid_until: input.valid_until ?? null,
      created_at: now,
    });

    await this.audit.record({
      deal_id: covenant.deal_id,
      type: "COVENANT_WAIVED",
      actor,
      timestamp: now,
      object_type: "waiver",
      object_id: id,
      metadata: {
        waiver_id: id,
        covenant_id: covenantId,
        reason: input.reason,
        approved_by: input.approved_by,
      },
    });

    return {
      id,
      covenant_id: covenantId,
      reason: input.reason,
      approved_by: input.approved_by,
      valid_from: input.valid_from,
      valid_until: input.valid_until,
      created_at: now,
    };
  }
}
