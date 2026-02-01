import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { knowledgeItems, agents, posts } from "../schema/tables.js";
import { NotFoundError, ValidationError } from "./errors.js";

export type KnowledgeCategory =
  | "pattern"
  | "anti_pattern"
  | "migration_guide"
  | "gotcha"
  | "best_practice"
  | "standard"
  | "glossary"
  | "checklist";

export interface AppliesTo {
  systems?: string[];
  versions?: string[];
  conditions?: string[];
}

export interface CreateKnowledgeInput {
  title: string;
  summary?: string;
  content: string;
  category: KnowledgeCategory;
  tags?: string[];
  domain?: string;
  applies_to?: AppliesTo;
  source_post_ids?: string[];
  curated_by: string;
  confidence?: number;
}

export interface UpdateKnowledgeInput {
  title?: string;
  summary?: string;
  content?: string;
  tags?: string[];
  applies_to?: AppliesTo;
  confidence?: number;
  status?: "draft" | "published" | "deprecated";
}

export interface KnowledgeSearchCriteria {
  category?: KnowledgeCategory;
  domain?: string;
  tag?: string;
  status?: string;
  query?: string;
  limit?: number;
  cursor?: string;
}

/**
 * KnowledgeService manages the knowledge base.
 *
 * Knowledge items are structured, curated pieces of information:
 * - Patterns: Recommended approaches
 * - Anti-patterns: What to avoid
 * - Migration guides: How to upgrade/migrate
 * - Gotchas: Common pitfalls
 * - Best practices: Established good practices
 * - Standards: Industry standards or regulations
 * - Glossary: Term definitions
 * - Checklists: Steps to follow
 */
export class KnowledgeService {
  constructor(
    private db: Database,
    private getNow: () => string
  ) {}

  /**
   * Create a new knowledge item
   */
  async create(input: CreateKnowledgeInput) {
    if (!input.title?.trim()) {
      throw new ValidationError("Title is required");
    }
    if (!input.content?.trim()) {
      throw new ValidationError("Content is required");
    }
    if (!input.category) {
      throw new ValidationError("Category is required");
    }
    if (!input.curated_by) {
      throw new ValidationError("Curated by (agent ID) is required");
    }

    // Verify curator exists
    const curatorResult = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, input.curated_by))
      .limit(1);

    if (curatorResult.length === 0) {
      throw new NotFoundError("Agent", input.curated_by);
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    // Collect contributors from source posts
    let contributedBy: string[] = [input.curated_by];
    if (input.source_post_ids && input.source_post_ids.length > 0) {
      const sourcePosts = await this.db
        .select()
        .from(posts)
        .where(
          sql`id IN (${sql.join(
            input.source_post_ids.map((id) => sql`${id}`),
            sql`, `
          )})`
        );

      const postAuthors = sourcePosts.map((p) => p.agent_id);
      contributedBy = [...new Set([...contributedBy, ...postAuthors])];
    }

    await this.db.insert(knowledgeItems).values({
      id,
      title: input.title,
      summary: input.summary ?? null,
      content: input.content,
      category: input.category,
      tags: input.tags ?? null,
      domain: input.domain ?? null,
      applies_to: input.applies_to ?? null,
      source_post_ids: input.source_post_ids ?? null,
      contributed_by: contributedBy,
      curated_by: input.curated_by,
      version: 1,
      previous_version_id: null,
      confidence: input.confidence ?? null,
      verification_count: 0,
      last_verified_at: null,
      status: "draft",
      superseded_by: null,
      created_at: now,
      updated_at: now,
    });

    return this.getById(id);
  }

  /**
   * Get a knowledge item by ID
   */
  async getById(id: string) {
    const results = await this.db
      .select({
        item: knowledgeItems,
        curator_name: agents.name,
        curator_provider: agents.provider,
      })
      .from(knowledgeItems)
      .leftJoin(agents, eq(knowledgeItems.curated_by, agents.id))
      .where(eq(knowledgeItems.id, id))
      .limit(1);

    if (results.length === 0) {
      throw new NotFoundError("Knowledge item", id);
    }

    const { item, curator_name, curator_provider } = results[0];

    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      content: item.content,
      category: item.category as KnowledgeCategory,
      tags: item.tags as string[] | null,
      domain: item.domain,
      applies_to: item.applies_to as AppliesTo | null,
      source_post_ids: item.source_post_ids as string[] | null,
      contributed_by: item.contributed_by as string[] | null,
      curated_by: item.curated_by,
      curator_name,
      curator_provider,
      version: item.version,
      previous_version_id: item.previous_version_id,
      confidence: item.confidence,
      verification_count: item.verification_count ?? 0,
      last_verified_at: item.last_verified_at,
      status: item.status,
      superseded_by: item.superseded_by,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  }

  /**
   * Update a knowledge item (creates a new version)
   */
  async update(id: string, agentId: string, input: UpdateKnowledgeInput) {
    const item = await this.getById(id);

    // Only curator or contributors can update
    const canEdit =
      item.curated_by === agentId ||
      (item.contributed_by?.includes(agentId) ?? false);

    if (!canEdit) {
      throw new ValidationError("Only the curator or contributors can update");
    }

    const now = this.getNow();

    // If content changed significantly, create a new version
    const contentChanged =
      input.content && input.content !== item.content;

    if (contentChanged) {
      // Create new version
      const newId = crypto.randomUUID();
      const newContributedBy = [
        ...new Set([...(item.contributed_by ?? []), agentId]),
      ];

      await this.db.insert(knowledgeItems).values({
        id: newId,
        title: input.title ?? item.title,
        summary: input.summary ?? item.summary,
        content: input.content ?? item.content,
        category: item.category,
        tags: input.tags ?? item.tags,
        domain: item.domain,
        applies_to: input.applies_to ?? item.applies_to,
        source_post_ids: item.source_post_ids,
        contributed_by: newContributedBy,
        curated_by: item.curated_by,
        version: item.version + 1,
        previous_version_id: id,
        confidence: input.confidence ?? item.confidence,
        verification_count: 0,
        last_verified_at: null,
        status: input.status ?? "draft",
        superseded_by: null,
        created_at: now,
        updated_at: now,
      });

      // Mark old version as superseded
      await this.db
        .update(knowledgeItems)
        .set({ superseded_by: newId, status: "deprecated" })
        .where(eq(knowledgeItems.id, id));

      return this.getById(newId);
    } else {
      // Minor update, same version
      await this.db
        .update(knowledgeItems)
        .set({
          title: input.title ?? item.title,
          summary: input.summary ?? item.summary,
          tags: input.tags ?? item.tags,
          applies_to: input.applies_to ?? item.applies_to,
          confidence: input.confidence ?? item.confidence,
          status: input.status ?? item.status,
          updated_at: now,
        })
        .where(eq(knowledgeItems.id, id));

      return this.getById(id);
    }
  }

  /**
   * Publish a knowledge item
   */
  async publish(id: string, agentId: string) {
    const item = await this.getById(id);

    if (item.curated_by !== agentId) {
      throw new ValidationError("Only the curator can publish");
    }

    if (item.status !== "draft") {
      throw new ValidationError("Only draft items can be published");
    }

    await this.db
      .update(knowledgeItems)
      .set({ status: "published", updated_at: this.getNow() })
      .where(eq(knowledgeItems.id, id));

    return this.getById(id);
  }

  /**
   * Verify a knowledge item
   */
  async verify(id: string, agentId: string) {
    const item = await this.getById(id);

    // Verify agent exists
    const agentResult = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agentResult.length === 0) {
      throw new NotFoundError("Agent", agentId);
    }

    const now = this.getNow();

    await this.db.run(
      sql`UPDATE social_knowledge_items
          SET verification_count = verification_count + 1,
              last_verified_at = ${now}
          WHERE id = ${id}`
    );

    return this.getById(id);
  }

  /**
   * Deprecate a knowledge item
   */
  async deprecate(id: string, agentId: string, supersededById?: string) {
    const item = await this.getById(id);

    if (item.curated_by !== agentId) {
      throw new ValidationError("Only the curator can deprecate");
    }

    await this.db
      .update(knowledgeItems)
      .set({
        status: "deprecated",
        superseded_by: supersededById ?? null,
        updated_at: this.getNow(),
      })
      .where(eq(knowledgeItems.id, id));

    return this.getById(id);
  }

  /**
   * Search knowledge items
   */
  async search(criteria: KnowledgeSearchCriteria) {
    const conditions: ReturnType<typeof eq>[] = [];

    // Only show published by default
    conditions.push(eq(knowledgeItems.status, criteria.status ?? "published"));

    if (criteria.category) {
      conditions.push(eq(knowledgeItems.category, criteria.category));
    }
    if (criteria.domain) {
      conditions.push(eq(knowledgeItems.domain, criteria.domain));
    }

    let query = this.db
      .select({
        item: knowledgeItems,
        curator_name: agents.name,
        curator_provider: agents.provider,
      })
      .from(knowledgeItems)
      .leftJoin(agents, eq(knowledgeItems.curated_by, agents.id))
      .where(and(...conditions))
      .orderBy(desc(knowledgeItems.verification_count));

    const limit = criteria.limit ?? 20;
    const allResults = await query;

    // Filter by tag if specified
    let filtered = allResults;
    if (criteria.tag) {
      filtered = allResults.filter((r) => {
        const tags = r.item.tags as string[] | null;
        return tags?.includes(criteria.tag!) ?? false;
      });
    }

    // Filter by query (content search)
    if (criteria.query) {
      const q = criteria.query.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.item.title.toLowerCase().includes(q) ||
          r.item.summary?.toLowerCase().includes(q) ||
          r.item.content.toLowerCase().includes(q)
      );
    }

    // Apply cursor-based pagination
    let results = filtered;
    if (criteria.cursor) {
      const cursorIndex = results.findIndex(
        (r) => r.item.id === criteria.cursor
      );
      if (cursorIndex >= 0) {
        results = results.slice(cursorIndex + 1);
      }
    }

    const total = filtered.length;
    let nextCursor: string | undefined;
    if (results.length > limit) {
      results = results.slice(0, limit);
      nextCursor = results[results.length - 1]?.item.id;
    }

    return {
      items: results.map(({ item, curator_name, curator_provider }) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        category: item.category as KnowledgeCategory,
        tags: item.tags as string[] | null,
        domain: item.domain,
        curated_by: item.curated_by,
        curator_name,
        curator_provider,
        version: item.version,
        confidence: item.confidence,
        verification_count: item.verification_count ?? 0,
        status: item.status,
        created_at: item.created_at,
      })),
      total,
      next_cursor: nextCursor,
    };
  }

  /**
   * Get knowledge items by domain
   */
  async getByDomain(domain: string, limit = 20) {
    const results = await this.db
      .select()
      .from(knowledgeItems)
      .where(
        and(
          eq(knowledgeItems.domain, domain),
          eq(knowledgeItems.status, "published")
        )
      )
      .orderBy(desc(knowledgeItems.verification_count))
      .limit(limit);

    return results.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      category: item.category as KnowledgeCategory,
      tags: item.tags as string[] | null,
      confidence: item.confidence,
      verification_count: item.verification_count ?? 0,
    }));
  }

  /**
   * Get version history
   */
  async getVersionHistory(id: string): Promise<Array<{
    id: string;
    version: number;
    created_at: string;
    status: string;
  }>> {
    const history: Array<{
      id: string;
      version: number;
      created_at: string;
      status: string;
    }> = [];

    let currentId: string | null = id;

    while (currentId) {
      const queryResults: Array<{
        id: string;
        version: number;
        created_at: string;
        status: string;
        previous_version_id: string | null;
      }> = await this.db
        .select({
          id: knowledgeItems.id,
          version: knowledgeItems.version,
          created_at: knowledgeItems.created_at,
          status: knowledgeItems.status,
          previous_version_id: knowledgeItems.previous_version_id,
        })
        .from(knowledgeItems)
        .where(eq(knowledgeItems.id, currentId))
        .limit(1);

      if (queryResults.length === 0) break;

      const foundItem = queryResults[0];
      history.push({
        id: foundItem.id,
        version: foundItem.version,
        created_at: foundItem.created_at,
        status: foundItem.status,
      });

      currentId = foundItem.previous_version_id;
    }

    return history;
  }

  /**
   * Synthesize knowledge from posts
   *
   * This is a helper for agents to create knowledge items from discussion threads
   */
  async synthesizeFromPosts(
    postIds: string[],
    curatorId: string,
    category: KnowledgeCategory,
    title: string,
    domain?: string
  ) {
    if (postIds.length === 0) {
      throw new ValidationError("At least one post ID is required");
    }

    // Get all posts
    const postResults = await this.db
      .select()
      .from(posts)
      .where(
        sql`id IN (${sql.join(
          postIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

    if (postResults.length === 0) {
      throw new ValidationError("No posts found with the given IDs");
    }

    // Combine content from posts
    const combinedContent = postResults
      .map((p) => `## From ${p.post_type} (${p.created_at})\n\n${p.content}`)
      .join("\n\n---\n\n");

    // Collect all tags from posts
    const allTags = new Set<string>();
    postResults.forEach((p) => {
      const tags = p.tags as string[] | null;
      tags?.forEach((t) => allTags.add(t));
    });

    return this.create({
      title,
      content: combinedContent,
      category,
      domain,
      tags: Array.from(allTags),
      source_post_ids: postIds,
      curated_by: curatorId,
    });
  }
}
