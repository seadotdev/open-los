import { eq } from "drizzle-orm";
import { spreads, deals } from "../schema/tables.js";
import { NotFoundError, ValidationError } from "./errors.js";
function round3(value) {
    if (value === null)
        return null;
    return Math.round(value * 1000) / 1000;
}
function safeDivide(numerator, denominator) {
    if (denominator === 0)
        return null;
    return numerator / denominator;
}
export function computeRatios(lineItems) {
    // Aggregate line items by category (sum amounts for same category)
    const totals = {};
    for (const item of lineItems) {
        const cat = item.category;
        totals[cat] = (totals[cat] ?? 0) + item.amount;
    }
    const get = (cat) => totals[cat] ?? 0;
    const revenue = get("revenue");
    const cogs = get("cogs");
    const operatingExpense = get("operating_expense");
    const interestExpense = get("interest_expense");
    const tax = get("tax");
    const depreciation = get("depreciation");
    const currentAssets = get("current_assets");
    const currentLiabilities = get("current_liabilities");
    const totalDebt = get("total_debt");
    const totalEquity = get("total_equity");
    // Compute net income
    const netIncome = revenue - cogs - operatingExpense - interestExpense - tax;
    // Compute ratios
    const currentRatio = safeDivide(currentAssets, currentLiabilities);
    const debtToEquity = safeDivide(totalDebt, totalEquity);
    const dscr = safeDivide(netIncome + depreciation + interestExpense, interestExpense);
    const grossMargin = safeDivide(revenue - cogs, revenue);
    const netMargin = safeDivide(netIncome, revenue);
    // Leverage is only meaningful if total_debt > 0; otherwise return null
    const leverage = totalDebt === 0 ? null : safeDivide(totalDebt, netIncome + depreciation);
    return {
        current_ratio: round3(currentRatio),
        debt_to_equity: round3(debtToEquity),
        dscr: round3(dscr),
        gross_margin: round3(grossMargin),
        net_margin: round3(netMargin),
        leverage: round3(leverage),
    };
}
export function computeRatiosFromMetrics(metrics) {
    const revenue = metrics.revenue ?? 0;
    const cogs = metrics.cogs ?? 0;
    const operatingExpense = metrics.operating_expense ?? 0;
    const interestExpense = metrics.interest_expense ?? 0;
    const tax = metrics.tax ?? 0;
    const depreciation = metrics.depreciation ?? 0;
    const currentAssets = metrics.current_assets ?? 0;
    const currentLiabilities = metrics.current_liabilities ?? 0;
    const totalDebt = metrics.total_debt ?? 0;
    const totalEquity = metrics.total_equity ?? 0;
    const debtService = metrics.debt_service ?? 0;
    const ebitda = metrics.ebitda ?? 0;
    const netIncome = metrics.net_income ?? (revenue - cogs - operatingExpense - interestExpense - tax);
    // Compute ratios
    const currentRatio = safeDivide(currentAssets, currentLiabilities);
    const debtToEquity = safeDivide(totalDebt, totalEquity);
    // DSCR = EBITDA / debt_service (when both are provided)
    // or (net_income + depreciation + interest) / interest when only interest is available
    let dscr;
    if (debtService > 0 && ebitda > 0) {
        dscr = safeDivide(ebitda, debtService);
    }
    else if (interestExpense > 0) {
        dscr = safeDivide(netIncome + depreciation + interestExpense, interestExpense);
    }
    else if (debtService > 0) {
        // Use net_income + depreciation for debt coverage
        dscr = safeDivide(netIncome + depreciation, debtService);
    }
    else {
        dscr = null;
    }
    const grossMargin = safeDivide(revenue - cogs, revenue);
    const netMargin = safeDivide(netIncome, revenue);
    // Leverage = total_debt / EBITDA when EBITDA is provided (for metrics format)
    // Otherwise use total_debt / (net_income + depreciation)
    // If total_debt is 0, leverage is null (meaningless ratio)
    let leverage;
    if (totalDebt === 0) {
        leverage = null;
    }
    else if (ebitda > 0) {
        leverage = safeDivide(totalDebt, ebitda);
    }
    else {
        leverage = safeDivide(totalDebt, netIncome + depreciation);
    }
    return {
        current_ratio: round3(currentRatio),
        debt_to_equity: round3(debtToEquity),
        dscr: round3(dscr),
        gross_margin: round3(grossMargin),
        net_margin: round3(netMargin),
        leverage: round3(leverage),
    };
}
export class SpreadService {
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
        // entity_id is only required when line_items format is used
        const hasLineItems = input.line_items && input.line_items.length > 0;
        const hasMetrics = input.metrics && Object.keys(input.metrics).length > 0;
        if (hasLineItems && !input.entity_id) {
            throw new ValidationError("entity_id is required");
        }
        if (!input.period) {
            throw new ValidationError("period is required");
        }
        let lineItems = [];
        let ratios;
        if (hasMetrics) {
            // metrics format - compute ratios from metrics object
            ratios = computeRatiosFromMetrics(input.metrics);
            // Convert metrics to line items for storage
            lineItems = this.metricsToLineItems(input.metrics);
        }
        else {
            // line_items format
            lineItems = input.line_items ?? [];
            ratios = computeRatios(lineItems);
        }
        const id = crypto.randomUUID();
        const now = this.getNow();
        const entityId = input.entity_id ?? "default";
        await this.db.insert(spreads).values({
            id,
            deal_id: dealId,
            entity_id: entityId,
            period: input.period,
            line_items: lineItems,
            ratios,
            created_at: now,
        });
        await this.audit.record({
            deal_id: dealId,
            type: "SPREAD_CREATED",
            actor,
            timestamp: now,
            object_type: "spread",
            object_id: id,
            metadata: {
                spread_id: id,
                entity_id: entityId,
                period: input.period,
            },
        });
        return {
            id,
            spread_id: id,
            entity_id: entityId,
            period: input.period,
            line_items: lineItems,
            ratios,
        };
    }
    metricsToLineItems(metrics) {
        const items = [];
        const mapping = {
            revenue: "revenue",
            cogs: "cogs",
            operating_expense: "operating_expense",
            interest_expense: "interest_expense",
            tax: "tax",
            depreciation: "depreciation",
            current_assets: "current_assets",
            current_liabilities: "current_liabilities",
            total_debt: "total_debt",
            total_equity: "total_equity",
            cash: "cash",
            cash_and_equivalents: "cash",
            net_income: "net_income",
            ebitda: "ebitda",
            debt_service: "debt_service",
        };
        for (const [key, value] of Object.entries(metrics)) {
            if (value !== undefined && value !== null) {
                const category = mapping[key] ?? key;
                items.push({
                    category,
                    label: key.replace(/_/g, " "),
                    amount: value,
                });
            }
        }
        return items;
    }
    async getRatios(dealId) {
        // Validate deal exists
        const dealRows = await this.db
            .select()
            .from(deals)
            .where(eq(deals.id, dealId));
        if (dealRows.length === 0) {
            throw new NotFoundError(`Deal ${dealId} not found`);
        }
        const spreadRows = await this.db
            .select()
            .from(spreads)
            .where(eq(spreads.deal_id, dealId));
        const ratios = spreadRows.map((row) => {
            const storedRatios = row.ratios;
            return {
                entity_id: row.entity_id,
                period: row.period,
                current_ratio: storedRatios?.current_ratio ?? null,
                debt_to_equity: storedRatios?.debt_to_equity ?? null,
                dscr: storedRatios?.dscr ?? null,
                gross_margin: storedRatios?.gross_margin ?? null,
                net_margin: storedRatios?.net_margin ?? null,
                leverage: storedRatios?.leverage ?? null,
            };
        });
        return { ratios };
    }
    async getLatestSpread(dealId, entityId) {
        const rows = await this.db
            .select()
            .from(spreads)
            .where(eq(spreads.deal_id, dealId));
        // Filter by entity if provided
        let filtered = rows;
        if (entityId) {
            filtered = rows.filter((r) => r.entity_id === entityId);
        }
        // Return the most recent (last created)
        if (filtered.length === 0)
            return null;
        return filtered[filtered.length - 1];
    }
}
//# sourceMappingURL=spread.js.map