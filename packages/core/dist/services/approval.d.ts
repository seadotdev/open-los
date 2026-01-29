import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
export interface CreateApprovalRequestInput {
    type: string;
    payload?: unknown;
}
export interface DecideApprovalInput {
    decision: "approved" | "rejected";
    rationale?: string;
}
export declare class ApprovalService {
    private db;
    private audit;
    private getNow;
    constructor(db: Database, audit: AuditService, getNow: () => string);
    request(dealId: string, input: CreateApprovalRequestInput, requestedBy: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        deal_id: string;
        type: string;
        requested_by: string;
        requested_at: string;
        status: string;
        payload: unknown;
    }>;
    getById(dealId: string, requestId: string): Promise<{
        id: string;
        deal_id: string;
        type: string;
        requested_by: string;
        requested_at: string;
        status: string;
        decided_by: string | null;
        decided_at: string | null;
        decision_rationale: string | null;
        payload: unknown;
    }>;
    list(dealId: string, filters?: {
        status?: string;
        type?: string;
    }): Promise<{
        requests: {
            id: string;
            deal_id: string;
            type: string;
            requested_by: string;
            requested_at: string;
            status: string;
            decided_by: string | null;
            decided_at: string | null;
            decision_rationale: string | null;
            payload: unknown;
        }[];
    }>;
    approve(dealId: string, requestId: string, decidedBy: string, rationale?: string): Promise<{
        id: string;
        deal_id: string;
        type: string;
        requested_by: string;
        requested_at: string;
        status: string;
        decided_by: string | null;
        decided_at: string | null;
        decision_rationale: string | null;
        payload: unknown;
    }>;
    reject(dealId: string, requestId: string, decidedBy: string, rationale?: string): Promise<{
        id: string;
        deal_id: string;
        type: string;
        requested_by: string;
        requested_at: string;
        status: string;
        decided_by: string | null;
        decided_at: string | null;
        decision_rationale: string | null;
        payload: unknown;
    }>;
    decide(dealId: string, requestId: string, input: DecideApprovalInput, decidedBy: string): Promise<{
        id: string;
        deal_id: string;
        type: string;
        requested_by: string;
        requested_at: string;
        status: string;
        decided_by: string | null;
        decided_at: string | null;
        decision_rationale: string | null;
        payload: unknown;
    }>;
    cancel(dealId: string, requestId: string, cancelledBy: string): Promise<{
        id: string;
        deal_id: string;
        type: string;
        requested_by: string;
        requested_at: string;
        status: string;
        decided_by: string | null;
        decided_at: string | null;
        decision_rationale: string | null;
        payload: unknown;
    }>;
}
//# sourceMappingURL=approval.d.ts.map