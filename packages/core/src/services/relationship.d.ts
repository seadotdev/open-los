import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
export interface CreateRelationshipInput {
    from_entity_id: string;
    to_entity_id: string;
    type: "owns" | "guarantees" | "directs";
    ownership_pct?: number;
    metadata?: Record<string, unknown>;
}
export declare class RelationshipService {
    private db;
    private audit;
    private getNow;
    constructor(db: Database, audit: AuditService, getNow: () => string);
    create(input: CreateRelationshipInput, actor: string, dealId?: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        from_entity_id: string;
        to_entity_id: string;
        type: "owns" | "guarantees" | "directs";
        ownership_pct: number | null;
        metadata: Record<string, unknown> | null;
        created_at: string;
    }>;
    listByEntity(entityId: string): Promise<{
        id: string;
        from_entity_id: string;
        to_entity_id: string;
        type: string;
        ownership_pct: number | null;
        metadata: unknown;
        created_at: string;
    }[]>;
    getBorrowerGroup(primaryEntityId: string): Promise<{
        entities: {
            id: string;
            name: string;
            jurisdiction: string | null;
            created_at: string;
            updated_at: string | null;
            deleted_at: string | null;
            type: string;
            legal_name: string | null;
            registration_number: string | null;
            lei: string | null;
            identifiers: unknown;
        }[];
        relationships: {
            id: string;
            created_at: string;
            type: string;
            metadata: unknown;
            from_entity_id: string;
            to_entity_id: string;
            ownership_pct: number | null;
        }[];
    }>;
}
//# sourceMappingURL=relationship.d.ts.map