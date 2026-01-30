import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
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
export declare class CovenantService {
    private db;
    private audit;
    private getNow;
    constructor(db: Database, audit: AuditService, getNow: () => string);
    create(dealId: string, input: CreateCovenantInput, actor: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        deal_id: string;
        name: string;
        type: string;
        metric: string;
        operator: string | undefined;
        threshold: number | undefined;
        frequency: string | undefined;
        grace_period_days: number;
        notes: string | undefined;
        reporting_deadline_days: number | undefined;
        created_at: string;
    }>;
    list(dealId: string): Promise<{
        covenants: {
            id: string;
            deal_id: string;
            name: string;
            type: string;
            metric: string;
            operator: string | null;
            threshold: number | null;
            frequency: string | null;
            grace_period_days: number | null;
            notes: string | null;
            reporting_deadline_days: number | null;
            created_at: string;
        }[];
    }>;
    test(dealId: string, actor: string, options?: {
        covenant_ids?: string[];
        as_of?: string;
        as_of_period?: string;
    }): Promise<{
        results: CovenantTestResult[];
    }>;
    private getMetricValue;
    private getActiveWaiver;
    createWaiver(covenantId: string, input: CreateWaiverInput, actor: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        covenant_id: string;
        reason: string;
        approved_by: string;
        valid_from: string | undefined;
        valid_until: string | undefined;
        created_at: string;
    }>;
}
//# sourceMappingURL=covenant.d.ts.map