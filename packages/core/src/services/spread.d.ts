import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
export interface LineItem {
    category: string;
    label: string;
    amount: number;
}
export interface MetricsInput {
    revenue?: number;
    ebitda?: number;
    net_income?: number;
    total_debt?: number;
    total_equity?: number;
    current_assets?: number;
    current_liabilities?: number;
    debt_service?: number;
    cash_and_equivalents?: number;
    cogs?: number;
    operating_expense?: number;
    interest_expense?: number;
    tax?: number;
    depreciation?: number;
    cash?: number;
}
export interface CreateSpreadInput {
    entity_id?: string;
    period: string;
    line_items?: LineItem[];
    metrics?: MetricsInput;
}
export interface Ratios {
    current_ratio: number | null;
    debt_to_equity: number | null;
    dscr: number | null;
    gross_margin: number | null;
    net_margin: number | null;
    leverage: number | null;
}
export declare function computeRatios(lineItems: LineItem[]): Ratios;
export declare function computeRatiosFromMetrics(metrics: MetricsInput): Ratios;
export declare class SpreadService {
    private db;
    private audit;
    private getNow;
    constructor(db: Database, audit: AuditService, getNow: () => string);
    create(dealId: string, input: CreateSpreadInput, actor: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        spread_id: `${string}-${string}-${string}-${string}-${string}`;
        entity_id: string;
        period: string;
        line_items: LineItem[];
        ratios: Ratios;
    }>;
    private metricsToLineItems;
    getRatios(dealId: string): Promise<{
        ratios: {
            entity_id: string;
            period: string;
            current_ratio: number | null;
            debt_to_equity: number | null;
            dscr: number | null;
            gross_margin: number | null;
            net_margin: number | null;
            leverage: number | null;
        }[];
    }>;
    getLatestSpread(dealId: string, entityId?: string): Promise<{
        id: string;
        deal_id: string;
        entity_id: string;
        period: string;
        line_items: unknown;
        ratios: unknown;
        created_at: string;
    } | null>;
}
//# sourceMappingURL=spread.d.ts.map