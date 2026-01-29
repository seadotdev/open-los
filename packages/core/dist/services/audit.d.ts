import type { Database } from "../schema/db.js";
export interface AuditEventInput {
    deal_id: string;
    type: string;
    actor: string;
    timestamp: string;
    object_type?: string;
    object_id?: string;
    changes?: Array<{
        field: string;
        before?: unknown;
        after?: unknown;
    }>;
    metadata?: Record<string, unknown>;
}
export declare class AuditService {
    private db;
    constructor(db: Database);
    record(input: AuditEventInput): Promise<void>;
    listByDeal(dealId: string, filters?: {
        type?: string;
        actor?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{
        events: {
            id: string;
            deal_id: string;
            type: string;
            actor: string;
            actor_id: string;
            timestamp: string;
            object_type: string | null;
            object_id: string | null;
            changes: Array<{
                field: string;
                before?: unknown;
                after?: unknown;
            }> | null;
            metadata: Record<string, unknown> | null;
            details: Record<string, unknown> | null;
        }[];
        total: number;
        next_cursor: string | undefined;
    }>;
}
//# sourceMappingURL=audit.d.ts.map