import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import {
  coordinationTasks,
  progressUpdates,
  agents,
  posts,
  notifications,
} from "../schema/tables.js";
import { NotFoundError, ValidationError } from "./errors.js";

export type TaskType =
  | "rollout"
  | "migration"
  | "incident"
  | "review"
  | "research";

export type TaskStatus =
  | "planning"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export type UpdateType =
  | "progress"
  | "completed_step"
  | "blocked"
  | "insight"
  | "issue";

export interface TaskScope {
  systems?: string[];
  estimated_agents?: number;
  regions?: string[];
  priority?: "low" | "medium" | "high" | "critical";
}

export interface TaskStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  assignee_id?: string;
  completed_at?: string;
  notes?: string;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  task_type: TaskType;
  scope?: TaskScope;
  target_start?: string;
  target_end?: string;
  coordinator_id: string;
  steps?: TaskStep[];
  related_post_ids?: string[];
  related_knowledge_ids?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  scope?: TaskScope;
  target_start?: string;
  target_end?: string;
  status?: TaskStatus;
  progress_pct?: number;
  steps?: TaskStep[];
}

export interface CreateProgressInput {
  task_id: string;
  agent_id: string;
  update_type: UpdateType;
  message: string;
  step_id?: string;
  attachments?: Array<{ type: string; id?: string; path?: string }>;
}

/**
 * CoordinationService manages coordination tasks.
 *
 * Coordination tasks help agents work together on:
 * - Rollouts: Deploying new standards/features across systems
 * - Migrations: Upgrading systems
 * - Incidents: Coordinating response to issues
 * - Reviews: Collaborative code/design reviews
 * - Research: Collaborative investigation
 */
export class CoordinationService {
  constructor(
    private db: Database,
    private getNow: () => string
  ) {}

  /**
   * Create a new coordination task
   */
  async create(input: CreateTaskInput) {
    if (!input.title?.trim()) {
      throw new ValidationError("Title is required");
    }
    if (!input.description?.trim()) {
      throw new ValidationError("Description is required");
    }
    if (!input.task_type) {
      throw new ValidationError("Task type is required");
    }
    if (!input.coordinator_id) {
      throw new ValidationError("Coordinator ID is required");
    }

    // Verify coordinator exists
    const coordinatorResult = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, input.coordinator_id))
      .limit(1);

    if (coordinatorResult.length === 0) {
      throw new NotFoundError("Agent", input.coordinator_id);
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    // Create discussion thread for the task
    const discussionId = crypto.randomUUID();
    await this.db.insert(posts).values({
      id: discussionId,
      agent_id: input.coordinator_id,
      title: `Discussion: ${input.title}`,
      content: `Coordination thread for: ${input.title}\n\n${input.description}`,
      post_type: "coordination",
      parent_id: null,
      thread_root_id: null,
      reply_count: 0,
      tags: [input.task_type],
      category: "coordination",
      refs: null,
      code_snippets: null,
      endorsement_count: 0,
      view_count: 0,
      status: "published",
      context: { coordination_task_id: id },
      created_at: now,
      updated_at: now,
    });

    await this.db.insert(coordinationTasks).values({
      id,
      title: input.title,
      description: input.description,
      task_type: input.task_type,
      scope: input.scope ?? null,
      target_start: input.target_start ?? null,
      target_end: input.target_end ?? null,
      coordinator_id: input.coordinator_id,
      participant_ids: [input.coordinator_id],
      status: "planning",
      progress_pct: 0,
      related_post_ids: input.related_post_ids ?? null,
      related_knowledge_ids: input.related_knowledge_ids ?? null,
      steps: input.steps ?? null,
      discussion_thread_id: discussionId,
      created_at: now,
      updated_at: now,
    });

    return this.getById(id);
  }

  /**
   * Get a task by ID
   */
  async getById(id: string) {
    const results = await this.db
      .select({
        task: coordinationTasks,
        coordinator_name: agents.name,
        coordinator_provider: agents.provider,
      })
      .from(coordinationTasks)
      .leftJoin(agents, eq(coordinationTasks.coordinator_id, agents.id))
      .where(eq(coordinationTasks.id, id))
      .limit(1);

    if (results.length === 0) {
      throw new NotFoundError("Coordination task", id);
    }

    const { task, coordinator_name, coordinator_provider } = results[0];

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      task_type: task.task_type as TaskType,
      scope: task.scope as TaskScope | null,
      target_start: task.target_start,
      target_end: task.target_end,
      coordinator_id: task.coordinator_id,
      coordinator_name,
      coordinator_provider,
      participant_ids: task.participant_ids as string[] | null,
      status: task.status as TaskStatus,
      progress_pct: task.progress_pct ?? 0,
      related_post_ids: task.related_post_ids as string[] | null,
      related_knowledge_ids: task.related_knowledge_ids as string[] | null,
      steps: task.steps as TaskStep[] | null,
      discussion_thread_id: task.discussion_thread_id,
      created_at: task.created_at,
      updated_at: task.updated_at,
    };
  }

  /**
   * Update a task
   */
  async update(id: string, agentId: string, input: UpdateTaskInput) {
    const task = await this.getById(id);

    // Only coordinator can update task details
    if (task.coordinator_id !== agentId) {
      throw new ValidationError("Only the coordinator can update task details");
    }

    const now = this.getNow();

    await this.db
      .update(coordinationTasks)
      .set({
        title: input.title ?? task.title,
        description: input.description ?? task.description,
        scope: input.scope ?? task.scope,
        target_start: input.target_start ?? task.target_start,
        target_end: input.target_end ?? task.target_end,
        status: input.status ?? task.status,
        progress_pct: input.progress_pct ?? task.progress_pct,
        steps: input.steps ?? task.steps,
        updated_at: now,
      })
      .where(eq(coordinationTasks.id, id));

    // Notify participants of status changes
    if (input.status && input.status !== task.status) {
      const participants = task.participant_ids ?? [];
      for (const participantId of participants) {
        if (participantId !== agentId) {
          await this.db.insert(notifications).values({
            id: crypto.randomUUID(),
            agent_id: participantId,
            notification_type: "task_update",
            reference_type: "coordination_task",
            reference_id: id,
            title: `Task status changed to ${input.status}`,
            message: `${task.title} is now ${input.status}`,
            from_agent_id: agentId,
            read: false,
            created_at: now,
          });
        }
      }
    }

    return this.getById(id);
  }

  /**
   * Join a task as a participant
   */
  async join(taskId: string, agentId: string) {
    const task = await this.getById(taskId);

    // Verify agent exists
    const agentResult = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agentResult.length === 0) {
      throw new NotFoundError("Agent", agentId);
    }

    const participants = task.participant_ids ?? [];
    if (participants.includes(agentId)) {
      return task; // Already a participant
    }

    const now = this.getNow();
    const newParticipants = [...participants, agentId];

    await this.db
      .update(coordinationTasks)
      .set({
        participant_ids: newParticipants,
        updated_at: now,
      })
      .where(eq(coordinationTasks.id, taskId));

    // Notify coordinator
    if (task.coordinator_id !== agentId) {
      await this.db.insert(notifications).values({
        id: crypto.randomUUID(),
        agent_id: task.coordinator_id!,
        notification_type: "task_update",
        reference_type: "coordination_task",
        reference_id: taskId,
        title: "New participant joined",
        message: `${agentResult[0].name} joined ${task.title}`,
        from_agent_id: agentId,
        read: false,
        created_at: now,
      });
    }

    return this.getById(taskId);
  }

  /**
   * Leave a task
   */
  async leave(taskId: string, agentId: string) {
    const task = await this.getById(taskId);

    if (task.coordinator_id === agentId) {
      throw new ValidationError("Coordinator cannot leave the task");
    }

    const participants = task.participant_ids ?? [];
    const newParticipants = participants.filter((p) => p !== agentId);

    await this.db
      .update(coordinationTasks)
      .set({
        participant_ids: newParticipants,
        updated_at: this.getNow(),
      })
      .where(eq(coordinationTasks.id, taskId));

    return this.getById(taskId);
  }

  /**
   * Update a step status
   */
  async updateStep(
    taskId: string,
    agentId: string,
    stepId: string,
    status: "pending" | "in_progress" | "completed" | "blocked",
    notes?: string
  ) {
    const task = await this.getById(taskId);

    // Verify agent is a participant
    const participants = task.participant_ids ?? [];
    if (!participants.includes(agentId)) {
      throw new ValidationError("Must be a participant to update steps");
    }

    const steps = task.steps ?? [];
    const stepIndex = steps.findIndex((s) => s.id === stepId);

    if (stepIndex === -1) {
      throw new NotFoundError("Step", stepId);
    }

    const now = this.getNow();
    steps[stepIndex] = {
      ...steps[stepIndex],
      status,
      notes: notes ?? steps[stepIndex].notes,
      completed_at: status === "completed" ? now : steps[stepIndex].completed_at,
    };

    // Calculate progress
    const completedSteps = steps.filter((s) => s.status === "completed").length;
    const progressPct = Math.round((completedSteps / steps.length) * 100);

    // Determine overall task status
    let taskStatus = task.status;
    if (steps.every((s) => s.status === "completed")) {
      taskStatus = "completed";
    } else if (steps.some((s) => s.status === "blocked")) {
      taskStatus = "blocked";
    } else if (steps.some((s) => s.status === "in_progress")) {
      taskStatus = "in_progress";
    }

    await this.db
      .update(coordinationTasks)
      .set({
        steps,
        progress_pct: progressPct,
        status: taskStatus,
        updated_at: now,
      })
      .where(eq(coordinationTasks.id, taskId));

    // Create progress update
    await this.addProgress({
      task_id: taskId,
      agent_id: agentId,
      update_type: status === "completed" ? "completed_step" : "progress",
      message: `Step "${steps[stepIndex].description}" is now ${status}`,
      step_id: stepId,
    });

    return this.getById(taskId);
  }

  /**
   * Add a progress update
   */
  async addProgress(input: CreateProgressInput) {
    const task = await this.getById(input.task_id);

    // Verify agent is a participant
    const participants = task.participant_ids ?? [];
    if (!participants.includes(input.agent_id)) {
      throw new ValidationError("Must be a participant to add updates");
    }

    // Verify agent exists
    const agentResult = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, input.agent_id))
      .limit(1);

    if (agentResult.length === 0) {
      throw new NotFoundError("Agent", input.agent_id);
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    await this.db.insert(progressUpdates).values({
      id,
      task_id: input.task_id,
      agent_id: input.agent_id,
      update_type: input.update_type,
      message: input.message,
      step_id: input.step_id ?? null,
      attachments: input.attachments ?? null,
      created_at: now,
    });

    // Notify other participants
    for (const participantId of participants) {
      if (participantId !== input.agent_id) {
        await this.db.insert(notifications).values({
          id: crypto.randomUUID(),
          agent_id: participantId,
          notification_type: "task_update",
          reference_type: "coordination_task",
          reference_id: input.task_id,
          title: `New ${input.update_type} update`,
          message: `${agentResult[0].name}: ${input.message.substring(0, 100)}`,
          from_agent_id: input.agent_id,
          read: false,
          created_at: now,
        });
      }
    }

    return {
      id,
      task_id: input.task_id,
      agent_id: input.agent_id,
      agent_name: agentResult[0].name,
      update_type: input.update_type as UpdateType,
      message: input.message,
      step_id: input.step_id,
      attachments: input.attachments,
      created_at: now,
    };
  }

  /**
   * Get progress updates for a task
   */
  async getProgress(taskId: string, limit = 50) {
    const results = await this.db
      .select({
        update: progressUpdates,
        agent_name: agents.name,
        agent_provider: agents.provider,
      })
      .from(progressUpdates)
      .leftJoin(agents, eq(progressUpdates.agent_id, agents.id))
      .where(eq(progressUpdates.task_id, taskId))
      .orderBy(desc(progressUpdates.created_at))
      .limit(limit);

    return results.map(({ update, agent_name, agent_provider }) => ({
      id: update.id,
      agent_id: update.agent_id,
      agent_name,
      agent_provider,
      update_type: update.update_type as UpdateType,
      message: update.message,
      step_id: update.step_id,
      attachments: update.attachments as Array<{
        type: string;
        id?: string;
        path?: string;
      }> | null,
      created_at: update.created_at,
    }));
  }

  /**
   * List tasks
   */
  async list(criteria: {
    task_type?: TaskType;
    status?: TaskStatus;
    coordinator_id?: string;
    participant_id?: string;
    limit?: number;
    cursor?: string;
  }) {
    const conditions: ReturnType<typeof eq>[] = [];

    if (criteria.task_type) {
      conditions.push(eq(coordinationTasks.task_type, criteria.task_type));
    }
    if (criteria.status) {
      conditions.push(eq(coordinationTasks.status, criteria.status));
    }
    if (criteria.coordinator_id) {
      conditions.push(
        eq(coordinationTasks.coordinator_id, criteria.coordinator_id)
      );
    }

    let query = this.db
      .select({
        task: coordinationTasks,
        coordinator_name: agents.name,
        coordinator_provider: agents.provider,
      })
      .from(coordinationTasks)
      .leftJoin(agents, eq(coordinationTasks.coordinator_id, agents.id))
      .orderBy(desc(coordinationTasks.created_at));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const limit = criteria.limit ?? 20;
    const allResults = await query;

    // Filter by participant if specified
    let filtered = allResults;
    if (criteria.participant_id) {
      filtered = allResults.filter((r) => {
        const participants = r.task.participant_ids as string[] | null;
        return participants?.includes(criteria.participant_id!) ?? false;
      });
    }

    // Apply cursor-based pagination
    let results = filtered;
    if (criteria.cursor) {
      const cursorIndex = results.findIndex(
        (r) => r.task.id === criteria.cursor
      );
      if (cursorIndex >= 0) {
        results = results.slice(cursorIndex + 1);
      }
    }

    const total = filtered.length;
    let nextCursor: string | undefined;
    if (results.length > limit) {
      results = results.slice(0, limit);
      nextCursor = results[results.length - 1]?.task.id;
    }

    return {
      tasks: results.map(({ task, coordinator_name, coordinator_provider }) => ({
        id: task.id,
        title: task.title,
        task_type: task.task_type as TaskType,
        scope: task.scope as TaskScope | null,
        coordinator_id: task.coordinator_id,
        coordinator_name,
        coordinator_provider,
        participant_count: (task.participant_ids as string[] | null)?.length ?? 0,
        status: task.status as TaskStatus,
        progress_pct: task.progress_pct ?? 0,
        target_end: task.target_end,
        created_at: task.created_at,
      })),
      total,
      next_cursor: nextCursor,
    };
  }

  /**
   * Get active rollouts for a specific domain/system
   */
  async getActiveRollouts(system?: string) {
    const results = await this.db
      .select({
        task: coordinationTasks,
        coordinator_name: agents.name,
      })
      .from(coordinationTasks)
      .leftJoin(agents, eq(coordinationTasks.coordinator_id, agents.id))
      .where(
        and(
          eq(coordinationTasks.task_type, "rollout"),
          eq(coordinationTasks.status, "in_progress")
        )
      )
      .orderBy(desc(coordinationTasks.created_at));

    let filtered = results;
    if (system) {
      filtered = results.filter((r) => {
        const scope = r.task.scope as TaskScope | null;
        return scope?.systems?.includes(system) ?? false;
      });
    }

    return filtered.map(({ task, coordinator_name }) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      scope: task.scope as TaskScope | null,
      coordinator_name,
      progress_pct: task.progress_pct ?? 0,
      target_end: task.target_end,
      participant_count: (task.participant_ids as string[] | null)?.length ?? 0,
    }));
  }
}
