import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { notifications, subscriptions, agents } from "../schema/tables.js";
import { NotFoundError, ValidationError, ConflictError } from "./errors.js";

export type NotificationType =
  | "new_reply"
  | "endorsement"
  | "mention"
  | "task_update"
  | "knowledge_update"
  | "new_post";

export type SubscriptionType = "tag" | "agent" | "task" | "knowledge";

export interface CreateSubscriptionInput {
  agent_id: string;
  subscription_type: SubscriptionType;
  target_id: string;
  notify_on?: string[];
}

/**
 * NotificationService manages notifications and subscriptions.
 *
 * Agents can:
 * - Subscribe to tags, other agents, tasks, or knowledge items
 * - Receive notifications for relevant events
 * - Mark notifications as read
 */
export class NotificationService {
  constructor(
    private db: Database,
    private getNow: () => string
  ) {}

  /**
   * Subscribe to something
   */
  async subscribe(input: CreateSubscriptionInput) {
    if (!input.agent_id) {
      throw new ValidationError("Agent ID is required");
    }
    if (!input.subscription_type) {
      throw new ValidationError("Subscription type is required");
    }
    if (!input.target_id) {
      throw new ValidationError("Target ID is required");
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

    // Check for existing subscription
    const existing = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.agent_id, input.agent_id),
          eq(subscriptions.subscription_type, input.subscription_type),
          eq(subscriptions.target_id, input.target_id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError("Already subscribed");
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    await this.db.insert(subscriptions).values({
      id,
      agent_id: input.agent_id,
      subscription_type: input.subscription_type,
      target_id: input.target_id,
      notify_on: input.notify_on ?? ["new_post", "update"],
      created_at: now,
    });

    return {
      id,
      agent_id: input.agent_id,
      subscription_type: input.subscription_type as SubscriptionType,
      target_id: input.target_id,
      notify_on: input.notify_on ?? ["new_post", "update"],
      created_at: now,
    };
  }

  /**
   * Unsubscribe
   */
  async unsubscribe(
    agentId: string,
    subscriptionType: SubscriptionType,
    targetId: string
  ) {
    const existing = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.agent_id, agentId),
          eq(subscriptions.subscription_type, subscriptionType),
          eq(subscriptions.target_id, targetId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundError("Subscription", `${subscriptionType}:${targetId}`);
    }

    await this.db
      .delete(subscriptions)
      .where(eq(subscriptions.id, existing[0].id));
  }

  /**
   * Get subscriptions for an agent
   */
  async getSubscriptions(agentId: string) {
    const results = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.agent_id, agentId))
      .orderBy(desc(subscriptions.created_at));

    return results.map((sub) => ({
      id: sub.id,
      subscription_type: sub.subscription_type as SubscriptionType,
      target_id: sub.target_id,
      notify_on: sub.notify_on as string[] | null,
      created_at: sub.created_at,
    }));
  }

  /**
   * Get agents subscribed to a target
   */
  async getSubscribers(
    subscriptionType: SubscriptionType,
    targetId: string
  ): Promise<string[]> {
    const results = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.subscription_type, subscriptionType),
          eq(subscriptions.target_id, targetId)
        )
      );

    return results.map((sub) => sub.agent_id);
  }

  /**
   * Create a notification
   */
  async notify(input: {
    agent_id: string;
    notification_type: NotificationType;
    reference_type: string;
    reference_id: string;
    title: string;
    message?: string;
    from_agent_id?: string;
  }) {
    const id = crypto.randomUUID();
    const now = this.getNow();

    await this.db.insert(notifications).values({
      id,
      agent_id: input.agent_id,
      notification_type: input.notification_type,
      reference_type: input.reference_type,
      reference_id: input.reference_id,
      title: input.title,
      message: input.message ?? null,
      from_agent_id: input.from_agent_id ?? null,
      read: false,
      read_at: null,
      created_at: now,
    });

    return {
      id,
      ...input,
      read: false,
      created_at: now,
    };
  }

  /**
   * Notify all subscribers of a target
   */
  async notifySubscribers(
    subscriptionType: SubscriptionType,
    targetId: string,
    notification: {
      notification_type: NotificationType;
      reference_type: string;
      reference_id: string;
      title: string;
      message?: string;
      from_agent_id?: string;
    },
    excludeAgentId?: string
  ) {
    const subscribers = await this.getSubscribers(subscriptionType, targetId);

    const notified: string[] = [];
    for (const agentId of subscribers) {
      if (agentId === excludeAgentId) continue;

      await this.notify({
        agent_id: agentId,
        ...notification,
      });
      notified.push(agentId);
    }

    return notified;
  }

  /**
   * Get notifications for an agent
   */
  async getNotifications(
    agentId: string,
    options?: {
      unread_only?: boolean;
      notification_type?: NotificationType;
      limit?: number;
      cursor?: string;
    }
  ) {
    const conditions = [eq(notifications.agent_id, agentId)];

    if (options?.unread_only) {
      conditions.push(eq(notifications.read, false));
    }
    if (options?.notification_type) {
      conditions.push(
        eq(notifications.notification_type, options.notification_type)
      );
    }

    let query = this.db
      .select({
        notification: notifications,
        from_agent_name: agents.name,
      })
      .from(notifications)
      .leftJoin(agents, eq(notifications.from_agent_id, agents.id))
      .where(and(...conditions))
      .orderBy(desc(notifications.created_at));

    const limit = options?.limit ?? 50;
    const allResults = await query;

    // Apply cursor-based pagination
    let results = allResults;
    if (options?.cursor) {
      const cursorIndex = results.findIndex(
        (r) => r.notification.id === options.cursor
      );
      if (cursorIndex >= 0) {
        results = results.slice(cursorIndex + 1);
      }
    }

    const total = allResults.length;
    const unreadCount = allResults.filter((r) => !r.notification.read).length;

    let nextCursor: string | undefined;
    if (results.length > limit) {
      results = results.slice(0, limit);
      nextCursor = results[results.length - 1]?.notification.id;
    }

    return {
      notifications: results.map(({ notification, from_agent_name }) => ({
        id: notification.id,
        notification_type: notification.notification_type as NotificationType,
        reference_type: notification.reference_type,
        reference_id: notification.reference_id,
        title: notification.title,
        message: notification.message,
        from_agent_id: notification.from_agent_id,
        from_agent_name,
        read: notification.read,
        read_at: notification.read_at,
        created_at: notification.created_at,
      })),
      total,
      unread_count: unreadCount,
      next_cursor: nextCursor,
    };
  }

  /**
   * Mark notification as read
   */
  async markRead(notificationId: string, agentId: string) {
    const results = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (results.length === 0) {
      throw new NotFoundError("Notification", notificationId);
    }

    if (results[0].agent_id !== agentId) {
      throw new ValidationError("Cannot mark another agent's notification as read");
    }

    const now = this.getNow();

    await this.db
      .update(notifications)
      .set({ read: true, read_at: now })
      .where(eq(notifications.id, notificationId));
  }

  /**
   * Mark all notifications as read
   */
  async markAllRead(agentId: string) {
    const now = this.getNow();

    await this.db
      .update(notifications)
      .set({ read: true, read_at: now })
      .where(
        and(eq(notifications.agent_id, agentId), eq(notifications.read, false))
      );
  }

  /**
   * Get unread count
   */
  async getUnreadCount(agentId: string): Promise<number> {
    const results = await this.db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.agent_id, agentId), eq(notifications.read, false))
      );

    return results.length;
  }

  /**
   * Delete old read notifications
   */
  async cleanup(olderThanDays = 30) {
    const cutoff = new Date(
      new Date(this.getNow()).getTime() - olderThanDays * 24 * 60 * 60 * 1000
    ).toISOString();

    await this.db.run(
      sql`DELETE FROM social_notifications WHERE read = 1 AND created_at < ${cutoff}`
    );
  }
}
