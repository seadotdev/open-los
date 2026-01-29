import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
export interface CreateDealInput {
    borrower_name: string;
    borrower_registration_number?: string;
    jurisdiction?: string;
    requested_amount?: number;
    purpose?: string;
    assigned_to?: string;
    custom_fields?: Record<string, unknown>;
}
export interface UpdateDealInput {
    borrower_name?: string;
    borrower_registration_number?: string;
    jurisdiction?: string;
    requested_amount?: number;
    purpose?: string;
    assigned_to?: string;
    origination_outcome?: string;
    primary_entity_id?: string;
    custom_fields?: Record<string, unknown>;
}
export declare class DealService {
    private db;
    private audit;
    private getNow;
    constructor(db: Database, audit: AuditService, getNow: () => string);
    create(input: CreateDealInput, actor: string, tenantId?: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        tenant_id: string;
        borrower_name: string;
        borrower_registration_number: string | null;
        jurisdiction: string | null;
        requested_amount: number | null;
        purpose: string | null;
        stage: string;
        origination_outcome: null;
        assigned_to: string | null;
        primary_entity_id: null;
        custom_fields: Record<string, unknown> | null;
        created_at: string;
        updated_at: string;
    }>;
    getById(id: string, tenantId?: string): Promise<{
        id: string;
        tenant_id: string;
        borrower_name: string;
        borrower_registration_number: string | null;
        jurisdiction: string | null;
        requested_amount: number | null;
        purpose: string | null;
        stage: string;
        origination_outcome: string | null;
        assigned_to: string | null;
        primary_entity_id: string | null;
        custom_fields: unknown;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
    }>;
    update(id: string, input: UpdateDealInput, actor: string, tenantId?: string): Promise<{
        id: string;
        tenant_id: string;
        borrower_name: string;
        borrower_registration_number: string | null;
        jurisdiction: string | null;
        requested_amount: number | null;
        purpose: string | null;
        stage: string;
        origination_outcome: string | null;
        assigned_to: string | null;
        primary_entity_id: string | null;
        custom_fields: unknown;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
    }>;
    list(tenantId?: string, filters?: {
        stage?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{
        deals: {
            id: string;
            tenant_id: string;
            borrower_name: string;
            borrower_registration_number: string | null;
            jurisdiction: string | null;
            requested_amount: number | null;
            purpose: string | null;
            stage: string;
            origination_outcome: string | null;
            assigned_to: string | null;
            primary_entity_id: string | null;
            custom_fields: unknown;
            created_at: string;
            updated_at: string;
            deleted_at: string | null;
        }[];
        total: number;
        cursor: string | undefined;
    }>;
}
//# sourceMappingURL=deal.d.ts.map