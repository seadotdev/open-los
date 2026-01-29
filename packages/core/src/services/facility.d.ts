import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
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
export declare class FacilityService {
    private db;
    private audit;
    private getNow;
    constructor(db: Database, audit: AuditService, getNow: () => string);
    create(dealId: string, input: CreateFacilityInput, actor: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        deal_id: string;
        type: string;
        amount: number;
        currency: string;
        interest_rate_type: string | undefined;
        interest_rate_value: number | undefined;
        interest_rate_spread: number | undefined;
        term_months: number | undefined;
        repayment_schedule: unknown;
        status: string;
        created_at: string;
        updated_at: string;
    }>;
    getById(dealId: string, facilityId: string): Promise<{
        id: string;
        deal_id: string;
        type: string;
        amount: number;
        currency: string;
        interest_rate_type: string | null;
        interest_rate_value: number | null;
        interest_rate_spread: number | null;
        term_months: number | null;
        repayment_schedule: unknown;
        status: string;
        created_at: string;
        updated_at: string | null;
    }>;
    list(dealId: string): Promise<{
        facilities: {
            id: string;
            deal_id: string;
            type: string;
            amount: number;
            currency: string;
            interest_rate_type: string | null;
            interest_rate_value: number | null;
            interest_rate_spread: number | null;
            term_months: number | null;
            repayment_schedule: unknown;
            status: string;
            created_at: string;
            updated_at: string | null;
        }[];
    }>;
    update(dealId: string, facilityId: string, input: UpdateFacilityInput, actor: string): Promise<{
        id: string;
        deal_id: string;
        type: string;
        amount: number;
        currency: string;
        interest_rate_type: string | null;
        interest_rate_value: number | null;
        interest_rate_spread: number | null;
        term_months: number | null;
        repayment_schedule: unknown;
        status: string;
        created_at: string;
        updated_at: string | null;
    }>;
    delete(dealId: string, facilityId: string, actor: string): Promise<{
        id: string;
        deal_id: string;
        type: string;
        amount: number;
        currency: string;
        interest_rate_type: string | null;
        interest_rate_value: number | null;
        interest_rate_spread: number | null;
        term_months: number | null;
        repayment_schedule: unknown;
        status: string;
        created_at: string;
        updated_at: string | null;
    }>;
}
//# sourceMappingURL=facility.d.ts.map