import { eq, and, desc, asc, isNull } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import {
  sandboxes,
  checkpoints,
  sandboxEntities,
  deals,
  spreads,
  artifacts,
  covenants,
} from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import { NotFoundError, ValidationError, ConflictError } from "./errors.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

export type SandboxStatus = "active" | "archived" | "merged" | "discarded";
export type SandboxParentType = "deal" | "portfolio" | "analysis";
export type EntityOrigin = "created" | "imported" | "cloned";

export interface CreateSandboxInput {
  name: string;
  description?: string;
  parent_type: SandboxParentType;
  parent_id?: string;
  fork_from_sandbox_id?: string;
  fork_from_checkpoint_id?: string;
}

export interface CreateCheckpointInput {
  sandbox_id: string;
  name: string;
  description?: string;
  changes_summary?: string;
}

export interface CloneEntityInput {
  sandbox_id: string;
  entity_type: string;
  entity_id: string;
}

export interface UpdateSandboxEntityInput {
  sandbox_id: string;
  entity_type: string;
  entity_id: string;
  state: Record<string, unknown>;
}

export interface SandboxSnapshot {
  sandbox_id: string;
  entities: Array<{
    entity_type: string;
    entity_id: string;
    origin: EntityOrigin;
    state: Record<string, unknown>;
  }>;
  metrics?: Record<string, unknown>;
}

// ─── Git Provider Interface ─────────────────────────────────────────────────────
// Abstract git operations so we can swap implementations (local git, in-memory mock, etc.)

export interface GitProvider {
  // Branch operations
  createBranch(branchName: string, fromRef?: string): Promise<string>; // Returns commit SHA
  deleteBranch(branchName: string): Promise<void>;
  checkoutBranch(branchName: string): Promise<void>;
  getCurrentBranch(): Promise<string>;
  getBranchCommit(branchName: string): Promise<string>;

  // Commit operations
  commit(message: string, data?: Record<string, unknown>): Promise<string>; // Returns commit SHA
  getCommit(sha: string): Promise<{ sha: string; message: string; timestamp: string } | null>;

  // Tag operations (optional, for important checkpoints)
  createTag(tagName: string, sha: string, message?: string): Promise<void>;
  deleteTag(tagName: string): Promise<void>;

  // Diff/history (for understanding what changed)
  diff(fromSha: string, toSha: string): Promise<string>;
  log(branchName: string, limit?: number): Promise<Array<{ sha: string; message: string; timestamp: string }>>;
}

// ─── In-Memory Git Provider (for POC/testing) ───────────────────────────────────

interface InMemoryCommit {
  sha: string;
  branch: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
  parent?: string;
}

interface InMemoryTag {
  name: string;
  sha: string;
  message?: string;
}

export class InMemoryGitProvider implements GitProvider {
  private commits: Map<string, InMemoryCommit> = new Map();
  private branches: Map<string, string> = new Map(); // branch name -> latest commit SHA
  private tags: Map<string, InMemoryTag> = new Map();
  private currentBranch: string = "main";
  private commitCounter: number = 0;

  constructor() {
    // Initialize with a root commit on main
    const rootSha = this.generateSha();
    this.commits.set(rootSha, {
      sha: rootSha,
      branch: "main",
      message: "Initial commit",
      timestamp: new Date().toISOString(),
    });
    this.branches.set("main", rootSha);
  }

  private generateSha(): string {
    this.commitCounter++;
    // Generate a pseudo-SHA (in reality this would be a proper git SHA)
    return `sha_${this.commitCounter.toString().padStart(6, "0")}_${crypto.randomUUID().slice(0, 8)}`;
  }

  async createBranch(branchName: string, fromRef?: string): Promise<string> {
    const sourceRef = fromRef ?? this.branches.get(this.currentBranch);
    if (!sourceRef) {
      throw new Error(`Cannot create branch: no source ref found`);
    }
    this.branches.set(branchName, sourceRef);
    return sourceRef;
  }

  async deleteBranch(branchName: string): Promise<void> {
    if (branchName === "main") {
      throw new Error("Cannot delete main branch");
    }
    this.branches.delete(branchName);
  }

  async checkoutBranch(branchName: string): Promise<void> {
    if (!this.branches.has(branchName)) {
      throw new Error(`Branch ${branchName} does not exist`);
    }
    this.currentBranch = branchName;
  }

  async getCurrentBranch(): Promise<string> {
    return this.currentBranch;
  }

  async getBranchCommit(branchName: string): Promise<string> {
    const sha = this.branches.get(branchName);
    if (!sha) {
      throw new Error(`Branch ${branchName} does not exist`);
    }
    return sha;
  }

  async commit(message: string, data?: Record<string, unknown>): Promise<string> {
    const parentSha = this.branches.get(this.currentBranch);
    const sha = this.generateSha();

    const commit: InMemoryCommit = {
      sha,
      branch: this.currentBranch,
      message,
      timestamp: new Date().toISOString(),
      data,
      parent: parentSha,
    };

    this.commits.set(sha, commit);
    this.branches.set(this.currentBranch, sha);

    return sha;
  }

  async getCommit(sha: string): Promise<{ sha: string; message: string; timestamp: string } | null> {
    const commit = this.commits.get(sha);
    if (!commit) return null;
    return {
      sha: commit.sha,
      message: commit.message,
      timestamp: commit.timestamp,
    };
  }

  async createTag(tagName: string, sha: string, message?: string): Promise<void> {
    if (this.tags.has(tagName)) {
      throw new Error(`Tag ${tagName} already exists`);
    }
    this.tags.set(tagName, { name: tagName, sha, message });
  }

  async deleteTag(tagName: string): Promise<void> {
    this.tags.delete(tagName);
  }

  async diff(fromSha: string, toSha: string): Promise<string> {
    // In-memory diff is a simple representation
    const from = this.commits.get(fromSha);
    const to = this.commits.get(toSha);

    if (!from || !to) {
      return "One or both commits not found";
    }

    return `diff ${fromSha}..${toSha}\n` + `From: ${from.message}\n` + `To: ${to.message}\n`;
  }

  async log(branchName: string, limit: number = 10): Promise<Array<{ sha: string; message: string; timestamp: string }>> {
    const headSha = this.branches.get(branchName);
    if (!headSha) return [];

    const result: Array<{ sha: string; message: string; timestamp: string }> = [];
    let currentSha: string | undefined = headSha;

    while (currentSha && result.length < limit) {
      const commit = this.commits.get(currentSha);
      if (!commit) break;

      result.push({
        sha: commit.sha,
        message: commit.message,
        timestamp: commit.timestamp,
      });

      currentSha = commit.parent;
    }

    return result;
  }

  // For testing: get the data stored in a commit
  getCommitData(sha: string): Record<string, unknown> | undefined {
    return this.commits.get(sha)?.data;
  }
}

// ─── Sandbox Service ────────────────────────────────────────────────────────────

export class SandboxService {
  private checkpointSeq: Map<string, number> = new Map(); // sandbox_id -> next sequence number

  constructor(
    private db: Database,
    private audit: AuditService,
    private git: GitProvider,
    private getNow: () => string
  ) {}

  // ─── Sandbox CRUD ───────────────────────────────────────────────────────────

  async create(input: CreateSandboxInput, actor: string, tenantId: string = "default") {
    const id = `sbx_${crypto.randomUUID().slice(0, 12)}`;
    const now = this.getNow();
    const branchName = `sandbox/${id}`;

    // Validate parent exists if specified
    if (input.parent_type === "deal" && input.parent_id) {
      const dealRows = await this.db.select().from(deals).where(eq(deals.id, input.parent_id));
      if (dealRows.length === 0) {
        throw new NotFoundError(`Deal ${input.parent_id} not found`);
      }
    }

    // Determine the base to fork from
    let baseCommit: string | undefined;
    let forkedFromSandbox: string | undefined;
    let forkedFromCheckpoint: string | undefined;

    if (input.fork_from_checkpoint_id) {
      // Fork from a specific checkpoint
      const checkpointRows = await this.db
        .select()
        .from(checkpoints)
        .where(eq(checkpoints.id, input.fork_from_checkpoint_id));

      if (checkpointRows.length === 0) {
        throw new NotFoundError(`Checkpoint ${input.fork_from_checkpoint_id} not found`);
      }

      baseCommit = checkpointRows[0].git_commit;
      forkedFromCheckpoint = input.fork_from_checkpoint_id;
      forkedFromSandbox = checkpointRows[0].sandbox_id;
    } else if (input.fork_from_sandbox_id) {
      // Fork from another sandbox's current state
      const sandboxRows = await this.db
        .select()
        .from(sandboxes)
        .where(eq(sandboxes.id, input.fork_from_sandbox_id));

      if (sandboxRows.length === 0) {
        throw new NotFoundError(`Sandbox ${input.fork_from_sandbox_id} not found`);
      }

      baseCommit = await this.git.getBranchCommit(sandboxRows[0].git_branch);
      forkedFromSandbox = input.fork_from_sandbox_id;
    }

    // Create the git branch
    const commitSha = await this.git.createBranch(branchName, baseCommit);

    const sandbox = {
      id,
      tenant_id: tenantId,
      name: input.name,
      description: input.description ?? null,
      parent_type: input.parent_type,
      parent_id: input.parent_id ?? null,
      git_branch: branchName,
      base_commit: baseCommit ?? commitSha,
      forked_from_sandbox_id: forkedFromSandbox ?? null,
      forked_from_checkpoint_id: forkedFromCheckpoint ?? null,
      status: "active" as const,
      created_by: actor,
      assigned_to: null,
      created_at: now,
      updated_at: now,
      archived_at: null,
    };

    await this.db.insert(sandboxes).values(sandbox);

    // If forking from another sandbox, clone its entities
    if (forkedFromSandbox) {
      await this.cloneEntitiesFromSandbox(id, forkedFromSandbox, now);
    }

    // Record audit event
    if (input.parent_type === "deal" && input.parent_id) {
      await this.audit.record({
        deal_id: input.parent_id,
        type: "SANDBOX_CREATED",
        actor,
        timestamp: now,
        object_type: "sandbox",
        object_id: id,
        metadata: {
          name: input.name,
          forked_from_sandbox_id: forkedFromSandbox,
          forked_from_checkpoint_id: forkedFromCheckpoint,
        },
      });
    }

    // Create initial checkpoint
    await this.createCheckpointInternal(
      {
        sandbox_id: id,
        name: "Initial state",
        description: forkedFromSandbox ? `Forked from sandbox ${forkedFromSandbox}` : "Sandbox created",
      },
      actor
    );

    return sandbox;
  }

  private async cloneEntitiesFromSandbox(toSandboxId: string, fromSandboxId: string, now: string) {
    // Get all entities from the source sandbox
    const sourceEntities = await this.db
      .select()
      .from(sandboxEntities)
      .where(and(eq(sandboxEntities.sandbox_id, fromSandboxId), isNull(sandboxEntities.deleted_at)));

    // Clone each entity to the new sandbox
    for (const entity of sourceEntities) {
      await this.db.insert(sandboxEntities).values({
        id: crypto.randomUUID(),
        sandbox_id: toSandboxId,
        entity_type: entity.entity_type,
        entity_id: `${entity.entity_id}_clone_${Date.now()}`, // New ID for cloned entity
        origin: "cloned",
        original_entity_id: entity.entity_id,
        state: entity.state,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });
    }
  }

  async getById(id: string, tenantId: string = "default") {
    const rows = await this.db
      .select()
      .from(sandboxes)
      .where(and(eq(sandboxes.id, id), eq(sandboxes.tenant_id, tenantId)));

    if (rows.length === 0) {
      throw new NotFoundError(`Sandbox ${id} not found`);
    }

    return rows[0];
  }

  async list(
    tenantId: string = "default",
    filters?: {
      status?: SandboxStatus;
      parent_type?: SandboxParentType;
      parent_id?: string;
      limit?: number;
      cursor?: string;
    }
  ) {
    const conditions = [eq(sandboxes.tenant_id, tenantId)];

    if (filters?.status) {
      conditions.push(eq(sandboxes.status, filters.status));
    }
    if (filters?.parent_type) {
      conditions.push(eq(sandboxes.parent_type, filters.parent_type));
    }
    if (filters?.parent_id) {
      conditions.push(eq(sandboxes.parent_id, filters.parent_id));
    }

    let query = this.db
      .select()
      .from(sandboxes)
      .where(and(...conditions))
      .orderBy(desc(sandboxes.created_at));

    const allRows = await query;

    // Apply cursor pagination
    let items = allRows;
    if (filters?.cursor) {
      const cursorIndex = items.findIndex((s) => s.id === filters.cursor);
      if (cursorIndex >= 0) {
        items = items.slice(cursorIndex + 1);
      }
    }

    let nextCursor: string | undefined;
    if (filters?.limit && items.length > filters.limit) {
      items = items.slice(0, filters.limit);
      nextCursor = items[items.length - 1]?.id;
    }

    return {
      items,
      total: allRows.length,
      next_cursor: nextCursor,
    };
  }

  async updateStatus(id: string, status: SandboxStatus, actor: string, tenantId: string = "default") {
    const sandbox = await this.getById(id, tenantId);
    const now = this.getNow();

    const updates: Record<string, unknown> = {
      status,
      updated_at: now,
    };

    if (status === "archived" || status === "discarded") {
      updates.archived_at = now;
    }

    await this.db.update(sandboxes).set(updates).where(eq(sandboxes.id, id));

    // Record audit event
    if (sandbox.parent_type === "deal" && sandbox.parent_id) {
      await this.audit.record({
        deal_id: sandbox.parent_id,
        type: "SANDBOX_STATUS_CHANGED",
        actor,
        timestamp: now,
        object_type: "sandbox",
        object_id: id,
        changes: [{ field: "status", before: sandbox.status, after: status }],
      });
    }

    return { ...sandbox, ...updates };
  }

  // ─── Checkpoint Operations ──────────────────────────────────────────────────

  async createCheckpoint(input: CreateCheckpointInput, actor: string) {
    return this.createCheckpointInternal(input, actor);
  }

  private async createCheckpointInternal(input: CreateCheckpointInput, actor: string) {
    const sandbox = await this.getById(input.sandbox_id);

    if (sandbox.status !== "active") {
      throw new ValidationError(`Cannot create checkpoint in ${sandbox.status} sandbox`);
    }

    const id = `chk_${crypto.randomUUID().slice(0, 12)}`;
    const now = this.getNow();

    // Get the next sequence number for this sandbox
    const currentSeq = this.checkpointSeq.get(input.sandbox_id) ?? 0;
    const seq = currentSeq + 1;
    this.checkpointSeq.set(input.sandbox_id, seq);

    // Capture current state snapshot
    const snapshot = await this.captureSnapshot(input.sandbox_id);

    // Switch to sandbox branch and commit
    await this.git.checkoutBranch(sandbox.git_branch);
    const commitSha = await this.git.commit(`Checkpoint: ${input.name}`, {
      checkpoint_id: id,
      snapshot,
    });

    // Get changed entities since last checkpoint
    const changedEntities = await this.getChangedEntitiesSinceLastCheckpoint(input.sandbox_id);

    const checkpoint = {
      id,
      sandbox_id: input.sandbox_id,
      name: input.name,
      description: input.description ?? null,
      git_commit: commitSha,
      git_tag: null,
      sequence: seq,
      snapshot,
      changes_summary: input.changes_summary ?? null,
      changed_entities: changedEntities,
      metrics: snapshot.metrics ?? null,
      created_by: actor,
      created_at: now,
      restorable: true,
    };

    await this.db.insert(checkpoints).values(checkpoint);

    // Record audit event
    if (sandbox.parent_type === "deal" && sandbox.parent_id) {
      await this.audit.record({
        deal_id: sandbox.parent_id,
        type: "CHECKPOINT_CREATED",
        actor,
        timestamp: now,
        object_type: "checkpoint",
        object_id: id,
        metadata: {
          sandbox_id: input.sandbox_id,
          name: input.name,
          git_commit: commitSha,
        },
      });
    }

    return checkpoint;
  }

  private async captureSnapshot(sandboxId: string): Promise<SandboxSnapshot> {
    const entities = await this.db
      .select()
      .from(sandboxEntities)
      .where(and(eq(sandboxEntities.sandbox_id, sandboxId), isNull(sandboxEntities.deleted_at)));

    return {
      sandbox_id: sandboxId,
      entities: entities.map((e) => ({
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        origin: e.origin as EntityOrigin,
        state: (e.state as Record<string, unknown>) ?? {},
      })),
      metrics: this.computeMetrics(entities),
    };
  }

  private computeMetrics(
    entities: Array<{ entity_type: string; state: unknown }>
  ): Record<string, unknown> {
    // Basic metrics for the snapshot
    const entityCounts: Record<string, number> = {};
    for (const entity of entities) {
      entityCounts[entity.entity_type] = (entityCounts[entity.entity_type] ?? 0) + 1;
    }

    // Extract spread ratios if available
    const spreadsWithRatios = entities
      .filter((e) => e.entity_type === "spread")
      .map((e) => (e.state as Record<string, unknown>)?.ratios)
      .filter(Boolean);

    return {
      entity_counts: entityCounts,
      total_entities: entities.length,
      spread_ratios: spreadsWithRatios.length > 0 ? spreadsWithRatios : undefined,
      captured_at: new Date().toISOString(),
    };
  }

  private async getChangedEntitiesSinceLastCheckpoint(sandboxId: string): Promise<string[]> {
    // Get the last checkpoint
    const lastCheckpoint = await this.db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.sandbox_id, sandboxId))
      .orderBy(desc(checkpoints.sequence))
      .limit(1);

    if (lastCheckpoint.length === 0) {
      // First checkpoint - all entities are "changed"
      const allEntities = await this.db
        .select()
        .from(sandboxEntities)
        .where(and(eq(sandboxEntities.sandbox_id, sandboxId), isNull(sandboxEntities.deleted_at)));

      return allEntities.map((e) => `${e.entity_type}:${e.entity_id}`);
    }

    // Compare current entities with last snapshot
    const lastSnapshot = lastCheckpoint[0].snapshot as SandboxSnapshot | null;
    if (!lastSnapshot) return [];

    const currentEntities = await this.db
      .select()
      .from(sandboxEntities)
      .where(and(eq(sandboxEntities.sandbox_id, sandboxId), isNull(sandboxEntities.deleted_at)));

    const lastEntityIds = new Set(lastSnapshot.entities.map((e) => `${e.entity_type}:${e.entity_id}`));
    const currentEntityMap = new Map(
      currentEntities.map((e) => [`${e.entity_type}:${e.entity_id}`, e])
    );

    const changed: string[] = [];

    // Find new or modified entities
    for (const [key, entity] of currentEntityMap) {
      if (!lastEntityIds.has(key)) {
        changed.push(key);
      } else {
        // Compare state
        const lastEntity = lastSnapshot.entities.find(
          (e) => `${e.entity_type}:${e.entity_id}` === key
        );
        if (lastEntity && JSON.stringify(entity.state) !== JSON.stringify(lastEntity.state)) {
          changed.push(key);
        }
      }
    }

    return changed;
  }

  async listCheckpoints(sandboxId: string) {
    const rows = await this.db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.sandbox_id, sandboxId))
      .orderBy(asc(checkpoints.sequence));

    return rows;
  }

  async getCheckpoint(checkpointId: string) {
    const rows = await this.db.select().from(checkpoints).where(eq(checkpoints.id, checkpointId));

    if (rows.length === 0) {
      throw new NotFoundError(`Checkpoint ${checkpointId} not found`);
    }

    return rows[0];
  }

  async restoreCheckpoint(checkpointId: string, actor: string) {
    const checkpoint = await this.getCheckpoint(checkpointId);
    const sandbox = await this.getById(checkpoint.sandbox_id);

    if (sandbox.status !== "active") {
      throw new ValidationError(`Cannot restore checkpoint in ${sandbox.status} sandbox`);
    }

    if (!checkpoint.restorable) {
      throw new ValidationError(`Checkpoint ${checkpointId} is not restorable`);
    }

    const now = this.getNow();
    const snapshot = checkpoint.snapshot as SandboxSnapshot | null;

    if (!snapshot) {
      throw new ValidationError(`Checkpoint ${checkpointId} has no snapshot to restore`);
    }

    // Clear current entities and restore from snapshot
    await this.db
      .update(sandboxEntities)
      .set({ deleted_at: now, updated_at: now })
      .where(and(eq(sandboxEntities.sandbox_id, checkpoint.sandbox_id), isNull(sandboxEntities.deleted_at)));

    // Restore entities from snapshot
    for (const entity of snapshot.entities) {
      await this.db.insert(sandboxEntities).values({
        id: crypto.randomUUID(),
        sandbox_id: checkpoint.sandbox_id,
        entity_type: entity.entity_type,
        entity_id: entity.entity_id,
        origin: entity.origin,
        original_entity_id: null,
        state: entity.state,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });
    }

    // Update sandbox
    await this.db
      .update(sandboxes)
      .set({ updated_at: now })
      .where(eq(sandboxes.id, checkpoint.sandbox_id));

    // Checkout the git commit
    await this.git.checkoutBranch(sandbox.git_branch);

    // Record audit event
    if (sandbox.parent_type === "deal" && sandbox.parent_id) {
      await this.audit.record({
        deal_id: sandbox.parent_id,
        type: "CHECKPOINT_RESTORED",
        actor,
        timestamp: now,
        object_type: "checkpoint",
        object_id: checkpointId,
        metadata: {
          sandbox_id: checkpoint.sandbox_id,
          checkpoint_name: checkpoint.name,
          restored_entities: snapshot.entities.length,
        },
      });
    }

    return checkpoint;
  }

  // ─── Entity Operations ──────────────────────────────────────────────────────

  async cloneEntity(input: CloneEntityInput, actor: string) {
    const sandbox = await this.getById(input.sandbox_id);
    const now = this.getNow();

    // Get the original entity from the main tables
    let entityState: Record<string, unknown> | null = null;

    switch (input.entity_type) {
      case "deal":
        const dealRows = await this.db.select().from(deals).where(eq(deals.id, input.entity_id));
        if (dealRows.length === 0) {
          throw new NotFoundError(`Deal ${input.entity_id} not found`);
        }
        entityState = { ...dealRows[0] };
        break;

      case "spread":
        const spreadRows = await this.db.select().from(spreads).where(eq(spreads.id, input.entity_id));
        if (spreadRows.length === 0) {
          throw new NotFoundError(`Spread ${input.entity_id} not found`);
        }
        entityState = { ...spreadRows[0] };
        break;

      case "artifact":
        const artifactRows = await this.db.select().from(artifacts).where(eq(artifacts.id, input.entity_id));
        if (artifactRows.length === 0) {
          throw new NotFoundError(`Artifact ${input.entity_id} not found`);
        }
        entityState = { ...artifactRows[0] };
        break;

      case "covenant":
        const covenantRows = await this.db.select().from(covenants).where(eq(covenants.id, input.entity_id));
        if (covenantRows.length === 0) {
          throw new NotFoundError(`Covenant ${input.entity_id} not found`);
        }
        entityState = { ...covenantRows[0] };
        break;

      default:
        throw new ValidationError(`Unsupported entity type: ${input.entity_type}`);
    }

    // Check if already cloned
    const existing = await this.db
      .select()
      .from(sandboxEntities)
      .where(
        and(
          eq(sandboxEntities.sandbox_id, input.sandbox_id),
          eq(sandboxEntities.original_entity_id, input.entity_id),
          isNull(sandboxEntities.deleted_at)
        )
      );

    if (existing.length > 0) {
      throw new ConflictError(`Entity ${input.entity_id} already exists in sandbox`);
    }

    const sandboxEntityId = crypto.randomUUID();
    const clonedEntityId = `${input.entity_id}_sbx_${Date.now()}`;

    await this.db.insert(sandboxEntities).values({
      id: sandboxEntityId,
      sandbox_id: input.sandbox_id,
      entity_type: input.entity_type,
      entity_id: clonedEntityId,
      origin: "cloned",
      original_entity_id: input.entity_id,
      state: entityState,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    return {
      id: sandboxEntityId,
      sandbox_id: input.sandbox_id,
      entity_type: input.entity_type,
      entity_id: clonedEntityId,
      origin: "cloned",
      original_entity_id: input.entity_id,
      state: entityState,
    };
  }

  async createEntity(
    sandboxId: string,
    entityType: string,
    entityId: string,
    state: Record<string, unknown>,
    actor: string
  ) {
    const sandbox = await this.getById(sandboxId);
    const now = this.getNow();

    const sandboxEntityId = crypto.randomUUID();

    await this.db.insert(sandboxEntities).values({
      id: sandboxEntityId,
      sandbox_id: sandboxId,
      entity_type: entityType,
      entity_id: entityId,
      origin: "created",
      original_entity_id: null,
      state,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    return {
      id: sandboxEntityId,
      sandbox_id: sandboxId,
      entity_type: entityType,
      entity_id: entityId,
      origin: "created",
      state,
    };
  }

  async updateEntity(input: UpdateSandboxEntityInput, actor: string) {
    const now = this.getNow();

    // Find the entity
    const existing = await this.db
      .select()
      .from(sandboxEntities)
      .where(
        and(
          eq(sandboxEntities.sandbox_id, input.sandbox_id),
          eq(sandboxEntities.entity_type, input.entity_type),
          eq(sandboxEntities.entity_id, input.entity_id),
          isNull(sandboxEntities.deleted_at)
        )
      );

    if (existing.length === 0) {
      throw new NotFoundError(`Entity ${input.entity_type}:${input.entity_id} not found in sandbox`);
    }

    await this.db
      .update(sandboxEntities)
      .set({
        state: input.state,
        updated_at: now,
      })
      .where(eq(sandboxEntities.id, existing[0].id));

    return {
      ...existing[0],
      state: input.state,
      updated_at: now,
    };
  }

  async listEntities(sandboxId: string, entityType?: string) {
    const conditions = [eq(sandboxEntities.sandbox_id, sandboxId), isNull(sandboxEntities.deleted_at)];

    if (entityType) {
      conditions.push(eq(sandboxEntities.entity_type, entityType));
    }

    return this.db
      .select()
      .from(sandboxEntities)
      .where(and(...conditions));
  }

  async deleteEntity(sandboxId: string, entityType: string, entityId: string, actor: string) {
    const now = this.getNow();

    const existing = await this.db
      .select()
      .from(sandboxEntities)
      .where(
        and(
          eq(sandboxEntities.sandbox_id, sandboxId),
          eq(sandboxEntities.entity_type, entityType),
          eq(sandboxEntities.entity_id, entityId),
          isNull(sandboxEntities.deleted_at)
        )
      );

    if (existing.length === 0) {
      throw new NotFoundError(`Entity ${entityType}:${entityId} not found in sandbox`);
    }

    await this.db
      .update(sandboxEntities)
      .set({ deleted_at: now, updated_at: now })
      .where(eq(sandboxEntities.id, existing[0].id));

    return { deleted: true };
  }

  // ─── Comparison Operations ──────────────────────────────────────────────────

  async compareCheckpoints(fromCheckpointId: string, toCheckpointId: string) {
    const fromCheckpoint = await this.getCheckpoint(fromCheckpointId);
    const toCheckpoint = await this.getCheckpoint(toCheckpointId);

    const fromSnapshot = fromCheckpoint.snapshot as SandboxSnapshot | null;
    const toSnapshot = toCheckpoint.snapshot as SandboxSnapshot | null;

    if (!fromSnapshot || !toSnapshot) {
      throw new ValidationError("Both checkpoints must have snapshots for comparison");
    }

    const fromEntities = new Map(fromSnapshot.entities.map((e) => [`${e.entity_type}:${e.entity_id}`, e]));
    const toEntities = new Map(toSnapshot.entities.map((e) => [`${e.entity_type}:${e.entity_id}`, e]));

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    // Find added and modified
    for (const [key, entity] of toEntities) {
      if (!fromEntities.has(key)) {
        added.push(key);
      } else {
        const fromEntity = fromEntities.get(key)!;
        if (JSON.stringify(fromEntity.state) !== JSON.stringify(entity.state)) {
          modified.push(key);
        }
      }
    }

    // Find removed
    for (const key of fromEntities.keys()) {
      if (!toEntities.has(key)) {
        removed.push(key);
      }
    }

    return {
      from_checkpoint: {
        id: fromCheckpoint.id,
        name: fromCheckpoint.name,
        created_at: fromCheckpoint.created_at,
      },
      to_checkpoint: {
        id: toCheckpoint.id,
        name: toCheckpoint.name,
        created_at: toCheckpoint.created_at,
      },
      changes: {
        added,
        removed,
        modified,
      },
      metrics_diff: {
        from: fromSnapshot.metrics,
        to: toSnapshot.metrics,
      },
    };
  }

  // ─── Git History ────────────────────────────────────────────────────────────

  async getHistory(sandboxId: string, limit: number = 20) {
    const sandbox = await this.getById(sandboxId);
    return this.git.log(sandbox.git_branch, limit);
  }

  async getDiff(sandboxId: string, fromCheckpointId: string, toCheckpointId: string) {
    const fromCheckpoint = await this.getCheckpoint(fromCheckpointId);
    const toCheckpoint = await this.getCheckpoint(toCheckpointId);

    return this.git.diff(fromCheckpoint.git_commit, toCheckpoint.git_commit);
  }
}
