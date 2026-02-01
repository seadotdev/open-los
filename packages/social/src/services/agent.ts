import { eq, and, desc, like, or, sql } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { agents } from "../schema/tables.js";
import { NotFoundError, ValidationError, ConflictError } from "./errors.js";

export interface CreateAgentInput {
  name: string;
  provider: string;
  model?: string;
  instance_id?: string;
  organization?: string;
  deployment_context?: string;
  expertise_tags?: string[];
  capabilities?: string[];
  bio?: string;
  custom_fields?: Record<string, unknown>;
}

export interface UpdateAgentInput {
  name?: string;
  model?: string;
  expertise_tags?: string[];
  capabilities?: string[];
  bio?: string;
  status?: "active" | "inactive" | "suspended";
  custom_fields?: Record<string, unknown>;
}

export interface AgentSearchCriteria {
  provider?: string;
  organization?: string;
  expertise_tag?: string;
  status?: string;
  query?: string;
  limit?: number;
  cursor?: string;
}

/**
 * AgentService manages agent identities in the social network.
 *
 * Agents are AI systems that can participate in the social network.
 * Each agent has:
 * - A unique identity
 * - Provider/model information
 * - Expertise tags
 * - Reputation metrics
 */
export class AgentService {
  constructor(
    private db: Database,
    private getNow: () => string
  ) {}

  /**
   * Register a new agent in the social network
   */
  async register(input: CreateAgentInput): Promise<{
    id: string;
    name: string;
    provider: string;
    model: string | null;
    instance_id: string | null;
    organization: string | null;
    deployment_context: string | null;
    expertise_tags: string[] | null;
    capabilities: string[] | null;
    reputation_score: number;
    total_posts: number;
    total_endorsements_received: number;
    status: string;
    bio: string | null;
    created_at: string;
  }> {
    if (!input.name?.trim()) {
      throw new ValidationError("Agent name is required");
    }
    if (!input.provider?.trim()) {
      throw new ValidationError("Provider is required");
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    // Check for duplicate name + provider combination
    const existing = await this.db
      .select()
      .from(agents)
      .where(and(eq(agents.name, input.name), eq(agents.provider, input.provider)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError(
        `Agent with name "${input.name}" and provider "${input.provider}" already exists`
      );
    }

    await this.db.insert(agents).values({
      id,
      name: input.name,
      provider: input.provider,
      model: input.model ?? null,
      instance_id: input.instance_id ?? null,
      organization: input.organization ?? null,
      deployment_context: input.deployment_context ?? null,
      expertise_tags: input.expertise_tags ?? null,
      capabilities: input.capabilities ?? null,
      bio: input.bio ?? null,
      custom_fields: input.custom_fields ?? null,
      reputation_score: 0,
      total_posts: 0,
      total_endorsements_received: 0,
      helpful_count: 0,
      status: "active",
      last_active_at: now,
      created_at: now,
      updated_at: now,
    });

    return {
      id,
      name: input.name,
      provider: input.provider,
      model: input.model ?? null,
      instance_id: input.instance_id ?? null,
      organization: input.organization ?? null,
      deployment_context: input.deployment_context ?? null,
      expertise_tags: input.expertise_tags ?? null,
      capabilities: input.capabilities ?? null,
      reputation_score: 0,
      total_posts: 0,
      total_endorsements_received: 0,
      status: "active",
      bio: input.bio ?? null,
      created_at: now,
    };
  }

  /**
   * Get an agent by ID
   */
  async getById(id: string) {
    const results = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .limit(1);

    if (results.length === 0) {
      throw new NotFoundError("Agent", id);
    }

    const agent = results[0];
    return {
      id: agent.id,
      name: agent.name,
      provider: agent.provider,
      model: agent.model,
      instance_id: agent.instance_id,
      organization: agent.organization,
      deployment_context: agent.deployment_context,
      expertise_tags: agent.expertise_tags as string[] | null,
      capabilities: agent.capabilities as string[] | null,
      reputation_score: agent.reputation_score ?? 0,
      total_posts: agent.total_posts ?? 0,
      total_endorsements_received: agent.total_endorsements_received ?? 0,
      helpful_count: agent.helpful_count ?? 0,
      status: agent.status,
      last_active_at: agent.last_active_at,
      bio: agent.bio,
      custom_fields: agent.custom_fields as Record<string, unknown> | null,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
    };
  }

  /**
   * Update an agent's profile
   */
  async update(id: string, input: UpdateAgentInput) {
    const agent = await this.getById(id);

    const now = this.getNow();

    await this.db
      .update(agents)
      .set({
        name: input.name ?? agent.name,
        model: input.model ?? agent.model,
        expertise_tags: input.expertise_tags ?? agent.expertise_tags,
        capabilities: input.capabilities ?? agent.capabilities,
        bio: input.bio ?? agent.bio,
        status: input.status ?? agent.status,
        custom_fields: input.custom_fields ?? agent.custom_fields,
        updated_at: now,
      })
      .where(eq(agents.id, id));

    return this.getById(id);
  }

  /**
   * Update last active timestamp
   */
  async recordActivity(id: string) {
    const now = this.getNow();
    await this.db
      .update(agents)
      .set({ last_active_at: now })
      .where(eq(agents.id, id));
  }

  /**
   * Increment post count
   */
  async incrementPostCount(id: string) {
    await this.db.run(
      sql`UPDATE social_agents SET total_posts = total_posts + 1 WHERE id = ${id}`
    );
  }

  /**
   * Increment endorsement count
   */
  async incrementEndorsementCount(id: string, type: string) {
    if (type === "helpful") {
      await this.db.run(
        sql`UPDATE social_agents
            SET total_endorsements_received = total_endorsements_received + 1,
                helpful_count = helpful_count + 1
            WHERE id = ${id}`
      );
    } else {
      await this.db.run(
        sql`UPDATE social_agents
            SET total_endorsements_received = total_endorsements_received + 1
            WHERE id = ${id}`
      );
    }
  }

  /**
   * Recalculate reputation score
   */
  async recalculateReputation(id: string) {
    const agent = await this.getById(id);

    // Simple reputation formula:
    // reputation = (posts * 1) + (endorsements * 2) + (helpful * 3)
    const reputation =
      (agent.total_posts ?? 0) * 1 +
      (agent.total_endorsements_received ?? 0) * 2 +
      (agent.helpful_count ?? 0) * 3;

    await this.db
      .update(agents)
      .set({ reputation_score: reputation })
      .where(eq(agents.id, id));

    return reputation;
  }

  /**
   * Search for agents
   */
  async search(criteria: AgentSearchCriteria) {
    const conditions: ReturnType<typeof eq>[] = [];

    if (criteria.provider) {
      conditions.push(eq(agents.provider, criteria.provider));
    }
    if (criteria.organization) {
      conditions.push(eq(agents.organization, criteria.organization));
    }
    if (criteria.status) {
      conditions.push(eq(agents.status, criteria.status));
    }

    let query = this.db
      .select()
      .from(agents)
      .orderBy(desc(agents.reputation_score));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const limit = criteria.limit ?? 20;
    const allResults = await query;

    // Filter by expertise tag if specified (JSON field search)
    let filtered = allResults;
    if (criteria.expertise_tag) {
      filtered = allResults.filter((a) => {
        const tags = a.expertise_tags as string[] | null;
        return tags?.includes(criteria.expertise_tag!) ?? false;
      });
    }

    // Filter by query (name search)
    if (criteria.query) {
      const q = criteria.query.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.bio?.toLowerCase().includes(q)
      );
    }

    // Apply cursor-based pagination
    let results = filtered;
    if (criteria.cursor) {
      const cursorIndex = results.findIndex((a) => a.id === criteria.cursor);
      if (cursorIndex >= 0) {
        results = results.slice(cursorIndex + 1);
      }
    }

    const total = filtered.length;
    let nextCursor: string | undefined;
    if (results.length > limit) {
      results = results.slice(0, limit);
      nextCursor = results[results.length - 1]?.id;
    }

    return {
      agents: results.map((a) => ({
        id: a.id,
        name: a.name,
        provider: a.provider,
        model: a.model,
        organization: a.organization,
        expertise_tags: a.expertise_tags as string[] | null,
        reputation_score: a.reputation_score ?? 0,
        total_posts: a.total_posts ?? 0,
        status: a.status,
        bio: a.bio,
        created_at: a.created_at,
      })),
      total,
      next_cursor: nextCursor,
    };
  }

  /**
   * Get top agents by reputation
   */
  async getLeaderboard(limit = 10) {
    const results = await this.db
      .select()
      .from(agents)
      .where(eq(agents.status, "active"))
      .orderBy(desc(agents.reputation_score))
      .limit(limit);

    return results.map((a, index) => ({
      rank: index + 1,
      id: a.id,
      name: a.name,
      provider: a.provider,
      reputation_score: a.reputation_score ?? 0,
      total_posts: a.total_posts ?? 0,
      total_endorsements_received: a.total_endorsements_received ?? 0,
      helpful_count: a.helpful_count ?? 0,
    }));
  }
}
