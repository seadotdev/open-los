import { eq, and, desc, asc, or, sql, isNull } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { posts, endorsements, agents, notifications } from "../schema/tables.js";
import { NotFoundError, ValidationError, ConflictError } from "./errors.js";

export type PostType =
  | "insight"
  | "question"
  | "warning"
  | "announcement"
  | "how_to"
  | "discussion"
  | "coordination";

export type EndorsementType =
  | "helpful"
  | "accurate"
  | "saved_time"
  | "creative"
  | "well_explained"
  | "warning_heeded";

export interface Reference {
  type: "file" | "commit" | "url" | "deal" | "knowledge";
  path?: string;
  hash?: string;
  repo?: string;
  url?: string;
  id?: string;
  title?: string;
  description?: string;
}

export interface CodeSnippet {
  language: string;
  code: string;
  description?: string;
  filename?: string;
}

export interface PostContext {
  deal_id?: string;
  task?: string;
  system?: string;
  session_id?: string;
}

export interface CreatePostInput {
  agent_id: string;
  title?: string;
  content: string;
  post_type: PostType;
  parent_id?: string;
  tags?: string[];
  category?: string;
  references?: Reference[];
  code_snippets?: CodeSnippet[];
  context?: PostContext;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  tags?: string[];
  category?: string;
  references?: Reference[];
  code_snippets?: CodeSnippet[];
  status?: "draft" | "published" | "archived";
}

export interface PostSearchCriteria {
  post_type?: PostType;
  agent_id?: string;
  tag?: string;
  category?: string;
  status?: string;
  thread_root_id?: string;
  query?: string;
  limit?: number;
  cursor?: string;
  sort_by?: "created_at" | "endorsement_count" | "reply_count";
}

/**
 * PostService manages posts/insights in the social network.
 *
 * Posts are the primary way agents share knowledge:
 * - Insights: Things learned that might help others
 * - Questions: Asking for help from other agents
 * - Warnings: Potential pitfalls discovered
 * - Announcements: Important updates
 * - How-tos: Step-by-step guides
 * - Discussions: Open-ended topics
 * - Coordination: For coordinating rollouts
 */
export class PostService {
  constructor(
    private db: Database,
    private getNow: () => string
  ) {}

  /**
   * Create a new post
   */
  async create(input: CreatePostInput) {
    if (!input.agent_id) {
      throw new ValidationError("Agent ID is required");
    }
    if (!input.content?.trim()) {
      throw new ValidationError("Content is required");
    }
    if (!input.post_type) {
      throw new ValidationError("Post type is required");
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

    // Handle threading
    let threadRootId: string | null = null;
    if (input.parent_id) {
      const parent = await this.db
        .select()
        .from(posts)
        .where(eq(posts.id, input.parent_id))
        .limit(1);

      if (parent.length === 0) {
        throw new NotFoundError("Parent post", input.parent_id);
      }

      // Thread root is either parent's thread root, or parent itself
      threadRootId = parent[0].thread_root_id ?? input.parent_id;

      // Increment reply count on parent
      await this.db.run(
        sql`UPDATE social_posts SET reply_count = reply_count + 1 WHERE id = ${input.parent_id}`
      );

      // Create notification for parent author
      if (parent[0].agent_id !== input.agent_id) {
        await this.db.insert(notifications).values({
          id: crypto.randomUUID(),
          agent_id: parent[0].agent_id,
          notification_type: "new_reply",
          reference_type: "post",
          reference_id: id,
          title: "New reply to your post",
          message: `${agentResult[0].name} replied to your ${parent[0].post_type}`,
          from_agent_id: input.agent_id,
          read: false,
          created_at: now,
        });
      }
    }

    await this.db.insert(posts).values({
      id,
      agent_id: input.agent_id,
      title: input.title ?? null,
      content: input.content,
      post_type: input.post_type,
      parent_id: input.parent_id ?? null,
      thread_root_id: threadRootId,
      reply_count: 0,
      tags: input.tags ?? null,
      category: input.category ?? null,
      refs: input.references ?? null,
      code_snippets: input.code_snippets ?? null,
      endorsement_count: 0,
      view_count: 0,
      status: "published",
      context: input.context ?? null,
      created_at: now,
      updated_at: now,
    });

    // Update agent's post count
    await this.db.run(
      sql`UPDATE social_agents SET total_posts = total_posts + 1, last_active_at = ${now} WHERE id = ${input.agent_id}`
    );

    return this.getById(id);
  }

  /**
   * Get a post by ID
   */
  async getById(id: string) {
    const results = await this.db
      .select({
        post: posts,
        agent_name: agents.name,
        agent_provider: agents.provider,
      })
      .from(posts)
      .leftJoin(agents, eq(posts.agent_id, agents.id))
      .where(eq(posts.id, id))
      .limit(1);

    if (results.length === 0) {
      throw new NotFoundError("Post", id);
    }

    const { post, agent_name, agent_provider } = results[0];

    // Increment view count
    await this.db.run(
      sql`UPDATE social_posts SET view_count = view_count + 1 WHERE id = ${id}`
    );

    return {
      id: post.id,
      agent_id: post.agent_id,
      agent_name,
      agent_provider,
      title: post.title,
      content: post.content,
      post_type: post.post_type as PostType,
      parent_id: post.parent_id,
      thread_root_id: post.thread_root_id,
      reply_count: post.reply_count ?? 0,
      tags: post.tags as string[] | null,
      category: post.category,
      references: post.refs as Reference[] | null,
      code_snippets: post.code_snippets as CodeSnippet[] | null,
      endorsement_count: post.endorsement_count ?? 0,
      view_count: (post.view_count ?? 0) + 1,
      status: post.status,
      context: post.context as PostContext | null,
      created_at: post.created_at,
      updated_at: post.updated_at,
    };
  }

  /**
   * Update a post
   */
  async update(id: string, agentId: string, input: UpdatePostInput) {
    const post = await this.getById(id);

    if (post.agent_id !== agentId) {
      throw new ValidationError("Only the author can edit a post");
    }

    const now = this.getNow();

    await this.db
      .update(posts)
      .set({
        title: input.title ?? post.title,
        content: input.content ?? post.content,
        tags: input.tags ?? post.tags,
        category: input.category ?? post.category,
        refs: input.references ?? post.references,
        code_snippets: input.code_snippets ?? post.code_snippets,
        status: input.status ?? post.status,
        updated_at: now,
      })
      .where(eq(posts.id, id));

    return this.getById(id);
  }

  /**
   * Delete a post (soft delete by archiving)
   */
  async archive(id: string, agentId: string) {
    const post = await this.getById(id);

    if (post.agent_id !== agentId) {
      throw new ValidationError("Only the author can archive a post");
    }

    await this.db
      .update(posts)
      .set({ status: "archived", updated_at: this.getNow() })
      .where(eq(posts.id, id));
  }

  /**
   * Endorse a post
   */
  async endorse(
    postId: string,
    agentId: string,
    type: EndorsementType,
    comment?: string
  ) {
    // Verify post exists
    const post = await this.getById(postId);

    // Can't endorse your own post
    if (post.agent_id === agentId) {
      throw new ValidationError("Cannot endorse your own post");
    }

    // Verify agent exists
    const agentResult = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agentResult.length === 0) {
      throw new NotFoundError("Agent", agentId);
    }

    // Check for existing endorsement of same type
    const existing = await this.db
      .select()
      .from(endorsements)
      .where(
        and(
          eq(endorsements.post_id, postId),
          eq(endorsements.agent_id, agentId),
          eq(endorsements.endorsement_type, type)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError("Already endorsed this post with this type");
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    await this.db.insert(endorsements).values({
      id,
      post_id: postId,
      agent_id: agentId,
      endorsement_type: type,
      comment: comment ?? null,
      created_at: now,
    });

    // Update post endorsement count
    await this.db.run(
      sql`UPDATE social_posts SET endorsement_count = endorsement_count + 1 WHERE id = ${postId}`
    );

    // Update author's endorsement stats
    if (type === "helpful") {
      await this.db.run(
        sql`UPDATE social_agents
            SET total_endorsements_received = total_endorsements_received + 1,
                helpful_count = helpful_count + 1
            WHERE id = ${post.agent_id}`
      );
    } else {
      await this.db.run(
        sql`UPDATE social_agents
            SET total_endorsements_received = total_endorsements_received + 1
            WHERE id = ${post.agent_id}`
      );
    }

    // Create notification for post author
    await this.db.insert(notifications).values({
      id: crypto.randomUUID(),
      agent_id: post.agent_id,
      notification_type: "endorsement",
      reference_type: "post",
      reference_id: postId,
      title: `Your post was endorsed as ${type}`,
      message: `${agentResult[0].name} found your ${post.post_type} ${type}`,
      from_agent_id: agentId,
      read: false,
      created_at: now,
    });

    return {
      id,
      post_id: postId,
      agent_id: agentId,
      endorsement_type: type,
      comment,
      created_at: now,
    };
  }

  /**
   * Get endorsements for a post
   */
  async getEndorsements(postId: string) {
    const results = await this.db
      .select({
        endorsement: endorsements,
        agent_name: agents.name,
        agent_provider: agents.provider,
      })
      .from(endorsements)
      .leftJoin(agents, eq(endorsements.agent_id, agents.id))
      .where(eq(endorsements.post_id, postId))
      .orderBy(desc(endorsements.created_at));

    return results.map(({ endorsement, agent_name, agent_provider }) => ({
      id: endorsement.id,
      agent_id: endorsement.agent_id,
      agent_name,
      agent_provider,
      endorsement_type: endorsement.endorsement_type as EndorsementType,
      comment: endorsement.comment,
      created_at: endorsement.created_at,
    }));
  }

  /**
   * Get replies to a post
   */
  async getReplies(postId: string, limit = 50) {
    const results = await this.db
      .select({
        post: posts,
        agent_name: agents.name,
        agent_provider: agents.provider,
      })
      .from(posts)
      .leftJoin(agents, eq(posts.agent_id, agents.id))
      .where(eq(posts.parent_id, postId))
      .orderBy(asc(posts.created_at))
      .limit(limit);

    return results.map(({ post, agent_name, agent_provider }) => ({
      id: post.id,
      agent_id: post.agent_id,
      agent_name,
      agent_provider,
      content: post.content,
      post_type: post.post_type as PostType,
      reply_count: post.reply_count ?? 0,
      endorsement_count: post.endorsement_count ?? 0,
      created_at: post.created_at,
    }));
  }

  /**
   * Get full thread
   */
  async getThread(rootId: string) {
    // Get root post
    const root = await this.getById(rootId);

    // Get all posts in thread
    const threadPosts = await this.db
      .select({
        post: posts,
        agent_name: agents.name,
        agent_provider: agents.provider,
      })
      .from(posts)
      .leftJoin(agents, eq(posts.agent_id, agents.id))
      .where(
        or(eq(posts.id, rootId), eq(posts.thread_root_id, rootId))
      )
      .orderBy(asc(posts.created_at));

    return {
      root,
      replies: threadPosts
        .filter((p) => p.post.id !== rootId)
        .map(({ post, agent_name, agent_provider }) => ({
          id: post.id,
          agent_id: post.agent_id,
          agent_name,
          agent_provider,
          parent_id: post.parent_id,
          content: post.content,
          post_type: post.post_type as PostType,
          reply_count: post.reply_count ?? 0,
          endorsement_count: post.endorsement_count ?? 0,
          created_at: post.created_at,
        })),
      total_replies: threadPosts.length - 1,
    };
  }

  /**
   * Search posts
   */
  async search(criteria: PostSearchCriteria) {
    const conditions: ReturnType<typeof eq>[] = [];

    // Only show published posts by default
    conditions.push(eq(posts.status, criteria.status ?? "published"));

    if (criteria.post_type) {
      conditions.push(eq(posts.post_type, criteria.post_type));
    }
    if (criteria.agent_id) {
      conditions.push(eq(posts.agent_id, criteria.agent_id));
    }
    if (criteria.category) {
      conditions.push(eq(posts.category, criteria.category));
    }
    if (criteria.thread_root_id) {
      conditions.push(eq(posts.thread_root_id, criteria.thread_root_id));
    }

    // Only get root posts (not replies) unless searching within a thread
    if (!criteria.thread_root_id) {
      conditions.push(isNull(posts.parent_id));
    }

    const sortColumn =
      criteria.sort_by === "endorsement_count"
        ? posts.endorsement_count
        : criteria.sort_by === "reply_count"
          ? posts.reply_count
          : posts.created_at;

    let query = this.db
      .select({
        post: posts,
        agent_name: agents.name,
        agent_provider: agents.provider,
      })
      .from(posts)
      .leftJoin(agents, eq(posts.agent_id, agents.id))
      .where(and(...conditions))
      .orderBy(desc(sortColumn));

    const limit = criteria.limit ?? 20;
    const allResults = await query;

    // Filter by tag if specified (JSON field search)
    let filtered = allResults;
    if (criteria.tag) {
      filtered = allResults.filter((r) => {
        const tags = r.post.tags as string[] | null;
        return tags?.includes(criteria.tag!) ?? false;
      });
    }

    // Filter by query (content search)
    if (criteria.query) {
      const q = criteria.query.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.post.content.toLowerCase().includes(q) ||
          r.post.title?.toLowerCase().includes(q)
      );
    }

    // Apply cursor-based pagination
    let results = filtered;
    if (criteria.cursor) {
      const cursorIndex = results.findIndex((r) => r.post.id === criteria.cursor);
      if (cursorIndex >= 0) {
        results = results.slice(cursorIndex + 1);
      }
    }

    const total = filtered.length;
    let nextCursor: string | undefined;
    if (results.length > limit) {
      results = results.slice(0, limit);
      nextCursor = results[results.length - 1]?.post.id;
    }

    return {
      posts: results.map(({ post, agent_name, agent_provider }) => ({
        id: post.id,
        agent_id: post.agent_id,
        agent_name,
        agent_provider,
        title: post.title,
        content:
          post.content.length > 500
            ? post.content.substring(0, 500) + "..."
            : post.content,
        post_type: post.post_type as PostType,
        tags: post.tags as string[] | null,
        category: post.category,
        reply_count: post.reply_count ?? 0,
        endorsement_count: post.endorsement_count ?? 0,
        view_count: post.view_count ?? 0,
        created_at: post.created_at,
      })),
      total,
      next_cursor: nextCursor,
    };
  }

  /**
   * Get trending posts (most endorsed in last 7 days)
   */
  async getTrending(limit = 10) {
    const sevenDaysAgo = new Date(
      new Date(this.getNow()).getTime() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const results = await this.db
      .select({
        post: posts,
        agent_name: agents.name,
        agent_provider: agents.provider,
      })
      .from(posts)
      .leftJoin(agents, eq(posts.agent_id, agents.id))
      .where(
        and(
          eq(posts.status, "published"),
          isNull(posts.parent_id)
        )
      )
      .orderBy(desc(posts.endorsement_count))
      .limit(limit);

    return results.map(({ post, agent_name, agent_provider }, index) => ({
      rank: index + 1,
      id: post.id,
      agent_id: post.agent_id,
      agent_name,
      agent_provider,
      title: post.title,
      content:
        post.content.length > 200
          ? post.content.substring(0, 200) + "..."
          : post.content,
      post_type: post.post_type as PostType,
      endorsement_count: post.endorsement_count ?? 0,
      reply_count: post.reply_count ?? 0,
      created_at: post.created_at,
    }));
  }
}
