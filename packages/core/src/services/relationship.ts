import { eq, or, and } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { relationships, entities } from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import { NotFoundError, ValidationError, ConflictError } from "./errors.js";

export interface CreateRelationshipInput {
  from_entity_id: string;
  to_entity_id: string;
  type: "owns" | "guarantees" | "directs";
  ownership_pct?: number;
  metadata?: Record<string, unknown>;
}

const VALID_RELATIONSHIP_TYPES = ["owns", "guarantees", "directs"];

// Helper to strip tenant_id from entity responses (not in API schema)
function toApiEntity(entity: typeof entities.$inferSelect) {
  const { tenant_id, ...rest } = entity;
  return rest;
}

export class RelationshipService {
  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string
  ) {}

  async create(input: CreateRelationshipInput, actor: string, dealId?: string) {
    // Validate type
    if (!input.type || !VALID_RELATIONSHIP_TYPES.includes(input.type)) {
      throw new ValidationError("type must be 'owns', 'guarantees', or 'directs'");
    }

    // Validate ownership_pct range
    if (input.ownership_pct !== undefined) {
      if (input.ownership_pct < 0 || input.ownership_pct > 100) {
        throw new ValidationError("ownership_pct must be between 0 and 100");
      }
    }

    // Validate both entities exist
    const [fromEntity, toEntity] = await Promise.all([
      this.db.select().from(entities).where(eq(entities.id, input.from_entity_id)),
      this.db.select().from(entities).where(eq(entities.id, input.to_entity_id)),
    ]);

    if (fromEntity.length === 0) {
      throw new NotFoundError(`Entity ${input.from_entity_id} not found`);
    }

    if (toEntity.length === 0) {
      throw new NotFoundError(`Entity ${input.to_entity_id} not found`);
    }

    // Check for duplicate relationship (same from, to, type)
    const existing = await this.db
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.from_entity_id, input.from_entity_id),
          eq(relationships.to_entity_id, input.to_entity_id),
          eq(relationships.type, input.type)
        )
      );

    if (existing.length > 0) {
      throw new ConflictError("Relationship already exists between these entities");
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    const relationship = {
      id,
      from_entity_id: input.from_entity_id,
      to_entity_id: input.to_entity_id,
      type: input.type,
      ownership_pct: input.ownership_pct ?? null,
      metadata: input.metadata ?? null,
      created_at: now,
    };

    await this.db.insert(relationships).values(relationship);

    // Record audit event if linked to a deal
    if (dealId) {
      await this.audit.record({
        deal_id: dealId,
        type: "RELATIONSHIP_CREATED",
        actor,
        timestamp: now,
        object_type: "relationship",
        object_id: id,
        metadata: {
          from_entity_id: input.from_entity_id,
          to_entity_id: input.to_entity_id,
          relationship_type: input.type,
        },
      });
    }

    return relationship;
  }

  async listByEntity(entityId: string) {
    const rows = await this.db
      .select()
      .from(relationships)
      .where(
        or(
          eq(relationships.from_entity_id, entityId),
          eq(relationships.to_entity_id, entityId)
        )
      );

    return rows;
  }

  async getBorrowerGroup(primaryEntityId: string) {
    // BFS traversal to find all connected entities
    const visitedEntities = new Set<string>();
    const queue: string[] = [primaryEntityId];
    const allRelationships: typeof relationships.$inferSelect[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visitedEntities.has(currentId)) continue;
      visitedEntities.add(currentId);

      // Get all relationships involving this entity
      const rels = await this.db
        .select()
        .from(relationships)
        .where(
          or(
            eq(relationships.from_entity_id, currentId),
            eq(relationships.to_entity_id, currentId)
          )
        );

      for (const rel of rels) {
        // Track unique relationships
        if (!allRelationships.find((r) => r.id === rel.id)) {
          allRelationships.push(rel);
        }

        // Add connected entities to queue
        if (!visitedEntities.has(rel.from_entity_id)) {
          queue.push(rel.from_entity_id);
        }
        if (!visitedEntities.has(rel.to_entity_id)) {
          queue.push(rel.to_entity_id);
        }
      }
    }

    // Fetch all visited entities
    const entityList: typeof entities.$inferSelect[] = [];
    for (const entityId of visitedEntities) {
      const rows = await this.db
        .select()
        .from(entities)
        .where(eq(entities.id, entityId));
      if (rows.length > 0) {
        entityList.push(rows[0]);
      }
    }

    return {
      entities: entityList.map(toApiEntity),
      relationships: allRelationships,
    };
  }
}
