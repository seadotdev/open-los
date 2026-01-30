import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
export interface CreateEntityInput {
    type: "company" | "person";
    name: string;
    legal_name?: string;
    registration_number?: string;
    lei?: string;
    jurisdiction?: string;
    identifiers?: Array<{
        scheme: string;
        value: string;
        authority?: string;
        confidence?: number;
    }>;
}
export interface UpdateEntityInput {
    name?: string;
    legal_name?: string;
    registration_number?: string;
    lei?: string;
    jurisdiction?: string;
    type?: string;
}
export declare class EntityService {
    private db;
    private audit;
    private getNow;
    constructor(db: Database, audit: AuditService, getNow: () => string);
    create(input: CreateEntityInput, actor: string, dealId?: string, tenantId?: string): Promise<{
        id: string;
        name: string;
        jurisdiction: string | null;
        created_at: string;
        updated_at: string | null;
        type: string;
        legal_name: string | null;
        registration_number: string | null;
        lei: string | null;
        identifiers: unknown;
    }>;
    getById(id: string, tenantId?: string): Promise<{
        id: string;
        name: string;
        jurisdiction: string | null;
        created_at: string;
        updated_at: string | null;
        type: string;
        legal_name: string | null;
        registration_number: string | null;
        lei: string | null;
        identifiers: unknown;
    }>;
    update(id: string, input: UpdateEntityInput, actor: string, dealId?: string, tenantId?: string): Promise<{
        id: string;
        name: string;
        jurisdiction: string | null;
        created_at: string;
        updated_at: string | null;
        type: string;
        legal_name: string | null;
        registration_number: string | null;
        lei: string | null;
        identifiers: unknown;
    }>;
    list(tenantId?: string, filters?: {
        type?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{
        entities: {
            id: string;
            name: string;
            jurisdiction: string | null;
            created_at: string;
            updated_at: string | null;
            type: string;
            legal_name: string | null;
            registration_number: string | null;
            lei: string | null;
            identifiers: unknown;
        }[];
        cursor: string | undefined;
    }>;
    delete(id: string, tenantId?: string): Promise<{
        id: string;
        name: string;
        jurisdiction: string | null;
        created_at: string;
        updated_at: string | null;
        type: string;
        legal_name: string | null;
        registration_number: string | null;
        lei: string | null;
        identifiers: unknown;
    }>;
    findDealIdByEntity(entityId: string): Promise<string | null>;
}
//# sourceMappingURL=entity.d.ts.map