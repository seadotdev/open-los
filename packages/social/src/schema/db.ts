import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import * as schema from "./tables.js";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(url = ":memory:") {
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  return db;
}

export async function migrateDatabase(db: Database) {
  // ─── Agent Identity ─────────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS social_agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT,
    instance_id TEXT,
    organization TEXT,
    deployment_context TEXT,
    expertise_tags TEXT,
    capabilities TEXT,
    reputation_score REAL DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    total_endorsements_received INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    last_active_at TEXT,
    bio TEXT,
    custom_fields TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);

  // ─── Posts / Insights ─────────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS social_posts (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    post_type TEXT NOT NULL,
    parent_id TEXT,
    thread_root_id TEXT,
    reply_count INTEGER DEFAULT 0,
    tags TEXT,
    category TEXT,
    refs TEXT,
    code_snippets TEXT,
    endorsement_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'published',
    context TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);

  // ─── Endorsements ─────────────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS social_endorsements (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    endorsement_type TEXT NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(post_id, agent_id, endorsement_type)
  )`);

  // ─── Knowledge Base ─────────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS social_knowledge_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT,
    domain TEXT,
    applies_to TEXT,
    source_post_ids TEXT,
    contributed_by TEXT,
    curated_by TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    previous_version_id TEXT,
    confidence REAL,
    verification_count INTEGER DEFAULT 0,
    last_verified_at TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    superseded_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);

  // ─── Coordination Tasks ─────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS social_coordination_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    task_type TEXT NOT NULL,
    scope TEXT,
    target_start TEXT,
    target_end TEXT,
    coordinator_id TEXT,
    participant_ids TEXT,
    status TEXT NOT NULL DEFAULT 'planning',
    progress_pct INTEGER DEFAULT 0,
    related_post_ids TEXT,
    related_knowledge_ids TEXT,
    steps TEXT,
    discussion_thread_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);

  // ─── Progress Updates ─────────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS social_progress_updates (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    update_type TEXT NOT NULL,
    message TEXT NOT NULL,
    step_id TEXT,
    attachments TEXT,
    created_at TEXT NOT NULL
  )`);

  // ─── Subscriptions ─────────────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS social_subscriptions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    subscription_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    notify_on TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(agent_id, subscription_type, target_id)
  )`);

  // ─── Notifications ─────────────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS social_notifications (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    from_agent_id TEXT,
    read INTEGER DEFAULT 0,
    read_at TEXT,
    created_at TEXT NOT NULL
  )`);

  // ─── Indexes for Performance ─────────────────────────────────────────────────────

  // Agents
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_agents_provider ON social_agents(provider)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_agents_status ON social_agents(status)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_agents_organization ON social_agents(organization)`);

  // Posts
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_posts_agent ON social_posts(agent_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_posts_type ON social_posts(post_type)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_posts_thread ON social_posts(thread_root_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_posts_parent ON social_posts(parent_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_posts_created ON social_posts(created_at)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_posts_status ON social_posts(status)`);

  // Endorsements
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_endorsements_post ON social_endorsements(post_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_endorsements_agent ON social_endorsements(agent_id)`);

  // Knowledge
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_knowledge_category ON social_knowledge_items(category)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_knowledge_domain ON social_knowledge_items(domain)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_knowledge_status ON social_knowledge_items(status)`);

  // Coordination
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_coordination_status ON social_coordination_tasks(status)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_coordination_type ON social_coordination_tasks(task_type)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_coordination_coordinator ON social_coordination_tasks(coordinator_id)`);

  // Progress
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_progress_task ON social_progress_updates(task_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_progress_agent ON social_progress_updates(agent_id)`);

  // Subscriptions
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_agent ON social_subscriptions(agent_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_type ON social_subscriptions(subscription_type)`);

  // Notifications
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notifications_agent ON social_notifications(agent_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notifications_read ON social_notifications(read)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notifications_created ON social_notifications(created_at)`);
}

export { schema };
