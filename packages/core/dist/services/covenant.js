import { eq, and } from "drizzle-orm";
import { covenants, covenantTests, waivers, deals, spreads } from "../schema/tables.js";
import { NotFoundError, ValidationError } from "./errors.js";
const VALID_OPERATORS = [">=", "<=", ">", "<", "=="];
const VALID_TYPES = ["financial", "reporting", "information"];
const VALID_FREQUENCIES = ["monthly", "quarterly", "annually"];
function compareValue(actual, operator, threshold) {
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
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
export class CovenantService {
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
            if (input.operator && !VALID_OPERATORS.includes(input.operator)) {
                throw new ValidationError(`Invalid operator: ${input.operator}. Must be one of: ${VALID_OPERATORS.join(", ")}`);
            }
            if (input.operator && input.threshold === undefined) {
                throw new ValidationError("threshold is required when operator is provided");
            }
        }
        // Validate operator if provided
        if (input.operator && !VALID_OPERATORS.includes(input.operator)) {
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
    async list(dealId) {
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
    async test(dealId, actor, options) {
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
            covenantRows = covenantRows.filter((c) => options.covenant_ids.includes(c.id));
        }
        // Get latest spread for the deal to retrieve ratios
        const spreadRows = await this.db
            .select()
            .from(spreads)
            .where(eq(spreads.deal_id, dealId));
        // Get the spread with the most recent created_at, or by matching period
        let latestSpread = spreadRows[spreadRows.length - 1] ?? null;
        const now = new Date(this.getNow());
        const results = [];
        for (const covenant of covenantRows) {
            // Skip non-financial covenants for now (no automated testing)
            if (covenant.type !== "financial") {
                continue;
            }
            // Get actual value for the metric
            let actualValue = this.getMetricValue(covenant.metric, latestSpread?.ratios, latestSpread?.line_items);
            const threshold = covenant.threshold ?? 0;
            const operator = covenant.operator ?? ">=";
            // Check if waiver is active
            const activeWaiver = await this.getActiveWaiver(covenant.id, now);
            // Check for previous grace period entry
            const prevTests = await this.db
                .select()
                .from(covenantTests)
                .where(and(eq(covenantTests.covenant_id, covenant.id), eq(covenantTests.deal_id, dealId)));
            const prevGracePeriodTest = prevTests.find((t) => t.status === "grace_period");
            let status;
            let gracePeriodExpires;
            if (activeWaiver) {
                status = "waived";
            }
            else if (actualValue !== null && compareValue(actualValue, operator, threshold)) {
                status = "pass";
            }
            else {
                // Failed - check grace period
                const graceDays = covenant.grace_period_days ?? 0;
                if (graceDays > 0) {
                    if (prevGracePeriodTest && prevGracePeriodTest.grace_period_expires) {
                        // Check if grace period has expired
                        const gracePeriodExpiry = new Date(prevGracePeriodTest.grace_period_expires);
                        if (now >= gracePeriodExpiry) {
                            status = "fail";
                        }
                        else {
                            status = "grace_period";
                            gracePeriodExpires = prevGracePeriodTest.grace_period_expires;
                        }
                    }
                    else {
                        // First time failing, enter grace period
                        status = "grace_period";
                        gracePeriodExpires = addDays(now, graceDays).toISOString().replace(".000Z", "Z");
                    }
                }
                else {
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
    getMetricValue(metric, ratios, lineItems) {
        if (!ratios && !lineItems)
            return null;
        switch (metric) {
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
    async getActiveWaiver(covenantId, asOf) {
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
    async createWaiver(covenantId, input, actor) {
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
//# sourceMappingURL=covenant.js.map