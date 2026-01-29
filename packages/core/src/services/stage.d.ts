import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
/** Context available for evaluating stage guards */
export interface GuardContext {
    deal: Record<string, unknown>;
    docCount: number;
}
/** Stage guard configuration */
export interface StageGuard {
    item: string;
    check: (ctx: GuardContext) => boolean;
}
/**
 * Stage guards configuration: defines what must be satisfied before entering each stage.
 * Each guard has an item name and a check function that receives the guard context.
 */
export declare const STAGE_GUARDS: Record<string, StageGuard[]>;
interface TransitionInput {
    to_stage: string;
    rationale?: string;
    override?: boolean;
    override_rationale?: string;
}
export interface UserContext {
    id: string;
    role: string;
}
export declare class StageService {
    private db;
    private audit;
    private getNow;
    constructor(db: Database, audit: AuditService, getNow: () => string);
    transition(dealId: string, input: TransitionInput, actor: string, user?: UserContext): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        deal_id: string;
        from_stage: string;
        to_stage: string;
        actor: string;
        rationale: string | null;
        override: boolean;
        override_rationale: string | null;
        checklist_snapshot: {
            item: string;
            satisfied: boolean;
        }[];
        transitioned_at: string;
    }>;
    listByDeal(dealId: string): Promise<{
        id: string;
        deal_id: string;
        from_stage: string;
        to_stage: string;
        actor: string;
        rationale: string | null;
        override: boolean | null;
        override_rationale: string | null;
        checklist_snapshot: unknown;
        transitioned_at: string;
    }[]>;
    private getChecklist;
}
export {};
//# sourceMappingURL=stage.d.ts.map