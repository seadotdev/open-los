/**
 * Sync Plan Generator
 *
 * Generates a preview plan of what would happen during a sync,
 * without executing any mutations. This is the core of the
 * `los shadow sync --dry-run` command.
 *
 * The plan compares records from the external system against
 * the local shadow ledger and produces a list of operations
 * (create, update, delete) with full field-level diffs.
 */

import { randomUUID } from "node:crypto";
import type { ShadowAdapter, ExternalRecord, FieldMapping, CanonicalEntity } from "../adapters/types.js";
import type { SyncPlan, SyncOperation, SyncConflict, SyncPlanSummary, FieldChange, ConflictStrategy, SyncRecord } from "./types.js";

export interface PlanOptions {
  /** Only plan for specific entity types */
  entities?: CanonicalEntity[];
  /** Only plan for records modified since this time */
  modifiedSince?: string;
  /** Direction: inbound only, outbound only, or both */
  direction?: "inbound" | "outbound" | "bidirectional";
  /** Maximum records to include in the plan */
  limit?: number;
}

export interface ShadowLedger {
  /** Get all sync records for a connection */
  getSyncRecords(connectionId: string, entity?: CanonicalEntity): Promise<SyncRecord[]>;
  /** Get a sync record by external ID */
  getSyncRecordByExternalId(connectionId: string, externalId: string): Promise<SyncRecord | null>;
  /** Get the current canonical record for diff comparison */
  getCanonicalRecord(entity: CanonicalEntity, internalId: string): Promise<Record<string, unknown> | null>;
}

/**
 * Generate a sync plan by comparing external records against the shadow ledger.
 *
 * This function:
 * 1. Fetches records from the external system via the adapter
 * 2. Looks up each record's sync state in the shadow ledger
 * 3. Computes field-level diffs using confirmed mappings
 * 4. Detects conflicts (both sides changed since last sync)
 * 5. Returns a plan with operations and conflicts
 */
export async function generateSyncPlan(
  adapter: ShadowAdapter,
  ledger: ShadowLedger,
  connectionId: string,
  mappings: FieldMapping[],
  conflictStrategy: ConflictStrategy,
  options: PlanOptions = {},
): Promise<SyncPlan> {
  const direction = options.direction ?? "inbound";
  const operations: SyncOperation[] = [];
  const conflicts: SyncConflict[] = [];

  // Group mappings by source object
  const mappingsByObject = groupMappingsByObject(mappings);

  // For each mapped object type, fetch and compare
  for (const [objectType, objectMappings] of Object.entries(mappingsByObject)) {
    // Determine the target entity
    const targetEntity = objectMappings[0]?.targetEntity;
    if (!targetEntity) continue;
    if (options.entities && !options.entities.includes(targetEntity)) continue;

    // Fetch external records
    const fetchResult = await adapter.fetchRecords({
      objectType,
      modifiedSince: options.modifiedSince,
      limit: options.limit,
    });

    // Compare each external record against the shadow ledger
    for (const externalRecord of fetchResult.records) {
      const syncRecord = await ledger.getSyncRecordByExternalId(
        connectionId,
        externalRecord.externalId,
      );

      if (!syncRecord) {
        // New record — create operation
        const changes = mapExternalToCanonical(externalRecord, objectMappings);
        operations.push({
          type: "create",
          direction: "inbound",
          entity: targetEntity,
          externalId: externalRecord.externalId,
          changes,
        });
      } else {
        // Existing record — check for changes
        const canonicalRecord = await ledger.getCanonicalRecord(
          targetEntity,
          syncRecord.internalId,
        );

        if (!canonicalRecord) continue;

        const { fieldChanges, fieldConflicts } = diffRecords(
          externalRecord,
          canonicalRecord,
          syncRecord,
          objectMappings,
          conflictStrategy,
        );

        if (fieldChanges.length > 0) {
          operations.push({
            type: "update",
            direction: "inbound",
            entity: targetEntity,
            externalId: externalRecord.externalId,
            internalId: syncRecord.internalId,
            changes: fieldChanges,
          });
        }

        conflicts.push(...fieldConflicts);
      }
    }
  }

  return {
    planId: randomUUID(),
    connectionId,
    generatedAt: new Date().toISOString(),
    direction,
    operations,
    conflicts,
    summary: computeSummary(operations, conflicts),
  };
}

// =============================================================================
// Internal Helpers
// =============================================================================

function groupMappingsByObject(
  mappings: FieldMapping[],
): Record<string, FieldMapping[]> {
  const grouped: Record<string, FieldMapping[]> = {};
  for (const m of mappings) {
    if (!m.enabled) continue;
    if (!grouped[m.sourceObject]) grouped[m.sourceObject] = [];
    grouped[m.sourceObject].push(m);
  }
  return grouped;
}

function mapExternalToCanonical(
  record: ExternalRecord,
  mappings: FieldMapping[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const mapping of mappings) {
    if (mapping.direction === "outbound") continue;
    const value = record.fields[mapping.sourceField];
    if (value !== undefined) {
      changes.push({
        field: mapping.targetField,
        oldValue: null,
        newValue: value,
        source: `${record.objectType}.${mapping.sourceField}`,
      });
    }
  }
  return changes;
}

function diffRecords(
  external: ExternalRecord,
  canonical: Record<string, unknown>,
  syncRecord: SyncRecord,
  mappings: FieldMapping[],
  conflictStrategy: ConflictStrategy,
): { fieldChanges: FieldChange[]; fieldConflicts: SyncConflict[] } {
  const fieldChanges: FieldChange[] = [];
  const fieldConflicts: SyncConflict[] = [];

  for (const mapping of mappings) {
    if (mapping.direction === "outbound") continue;

    const externalValue = external.fields[mapping.sourceField];
    const canonicalValue = canonical[mapping.targetField];

    // Skip if values are the same
    if (JSON.stringify(externalValue) === JSON.stringify(canonicalValue)) continue;

    // Check if this is a conflict (both sides changed since last sync)
    const provenance = syncRecord.fieldProvenance[mapping.targetField];
    const lastSyncedAt = provenance?.lastSyncedAt;

    const externalChanged = external.lastModifiedAt && lastSyncedAt
      ? external.lastModifiedAt > lastSyncedAt
      : true;

    const internalChanged = syncRecord.updatedAt > (lastSyncedAt ?? "");

    if (externalChanged && internalChanged) {
      // Conflict
      const strategyKey = `${mapping.targetEntity}.${mapping.targetField}`;
      const resolution = conflictStrategy.overrides[strategyKey] ?? conflictStrategy.default;

      fieldConflicts.push({
        id: randomUUID(),
        entity: mapping.targetEntity,
        externalId: external.externalId,
        internalId: syncRecord.internalId,
        field: mapping.targetField,
        externalValue,
        internalValue: canonicalValue,
        externalModifiedAt: external.lastModifiedAt,
        internalModifiedAt: syncRecord.updatedAt,
        suggestedResolution: resolution,
      });
    } else if (externalChanged) {
      // External changed, internal didn't — inbound update
      fieldChanges.push({
        field: mapping.targetField,
        oldValue: canonicalValue,
        newValue: externalValue,
        source: `${external.objectType}.${mapping.sourceField}`,
      });
    }
  }

  return { fieldChanges, fieldConflicts };
}

function computeSummary(
  operations: SyncOperation[],
  conflicts: SyncConflict[],
): SyncPlanSummary {
  const summary: SyncPlanSummary = {
    creates: 0,
    updates: 0,
    deletes: 0,
    unchanged: 0,
    conflicts: conflicts.length,
    errors: 0,
    byEntity: {},
  };

  for (const op of operations) {
    summary[`${op.type}s` as "creates" | "updates" | "deletes"]++;

    if (!summary.byEntity[op.entity]) {
      summary.byEntity[op.entity] = { creates: 0, updates: 0, deletes: 0 };
    }
    summary.byEntity[op.entity][`${op.type}s` as "creates" | "updates" | "deletes"]++;
  }

  return summary;
}
