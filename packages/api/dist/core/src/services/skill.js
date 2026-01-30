import { eq, and, sql } from "drizzle-orm";
import { skills, skillInvocations } from "../schema/tables.js";
import { NotFoundError } from "./errors.js";
// ─── Parser ────────────────────────────────────────────────────────────────────
/**
 * Parse YAML frontmatter from SKILL.md content.
 * Handles basic YAML without requiring a full YAML library.
 */
export function parseSkillMd(content) {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    if (!match) {
        return { frontmatter: {}, body: content };
    }
    const [, yamlContent, body] = match;
    const frontmatter = {};
    // Simple YAML parsing for our specific fields
    const lines = yamlContent.split("\n");
    let currentKey = null;
    let inArray = false;
    const arrayBuffer = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        // Check for array item
        if (inArray && trimmed.startsWith("- ")) {
            arrayBuffer.push(trimmed.slice(2).trim());
            continue;
        }
        // If we were in an array and hit a non-array line, save it
        if (inArray && currentKey && !trimmed.startsWith("- ")) {
            if (currentKey === "tags") {
                frontmatter.tags = [...arrayBuffer];
            }
            inArray = false;
            arrayBuffer.length = 0;
        }
        // Parse key: value
        const colonIndex = trimmed.indexOf(":");
        if (colonIndex > 0) {
            const key = trimmed.slice(0, colonIndex).trim();
            const value = trimmed.slice(colonIndex + 1).trim();
            currentKey = key;
            if (!value) {
                // Empty value might mean an array follows
                if (key === "tags") {
                    inArray = true;
                }
                continue;
            }
            // Remove surrounding quotes if present
            const cleanValue = value.replace(/^["']|["']$/g, "");
            switch (key) {
                case "name":
                    frontmatter.name = cleanValue;
                    break;
                case "description":
                    frontmatter.description = cleanValue;
                    break;
                case "trigger":
                    frontmatter.trigger = cleanValue;
                    break;
                case "tags":
                    // Inline array format: [tag1, tag2]
                    if (value.startsWith("[")) {
                        const arrayMatch = value.match(/\[(.*)\]/);
                        if (arrayMatch) {
                            frontmatter.tags = arrayMatch[1]
                                .split(",")
                                .map((t) => t.trim().replace(/^["']|["']$/g, ""));
                        }
                    }
                    break;
            }
        }
    }
    // Handle trailing array
    if (inArray && currentKey === "tags" && arrayBuffer.length > 0) {
        frontmatter.tags = [...arrayBuffer];
    }
    return { frontmatter, body: body.trim() };
}
/**
 * Extract referenced file names from markdown content.
 * Looks for patterns like [name.md](name.md) or (see name.md)
 */
export function extractReferences(content) {
    const refs = new Set();
    // Match markdown links: [text](file.md)
    const linkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
        refs.add(match[2]);
    }
    // Match inline references: see file.md or See file.md
    const seeRegex = /[Ss]ee\s+\[?([a-zA-Z0-9_-]+\.md)/g;
    while ((match = seeRegex.exec(content)) !== null) {
        refs.add(match[1]);
    }
    return Array.from(refs);
}
// ─── Service ───────────────────────────────────────────────────────────────────
export class SkillService {
    db;
    getNow;
    skillsBasePath;
    constructor(db, getNow, skillsBasePath = "./skills") {
        this.db = db;
        this.getNow = getNow;
        this.skillsBasePath = skillsBasePath;
    }
    /**
     * List available skills (metadata only).
     */
    async list(tenantId = "default", options = {}) {
        const conditions = [eq(skills.tenant_id, tenantId)];
        if (options.scope) {
            conditions.push(eq(skills.scope, options.scope));
        }
        if (!options.includeInactive) {
            conditions.push(eq(skills.is_active, true));
        }
        const results = await this.db
            .select()
            .from(skills)
            .where(and(...conditions));
        let filtered = results;
        // Filter by tags if specified
        if (options.tags && options.tags.length > 0) {
            filtered = results.filter((s) => {
                const skillTags = s.tags || [];
                return options.tags.some((t) => skillTags.includes(t));
            });
        }
        return filtered.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            trigger: s.trigger,
            scope: s.scope,
            tags: s.tags || [],
            version: s.version || "1.0.0",
            usageCount: s.usage_count || 0,
            lastUsedAt: s.last_used_at,
        }));
    }
    /**
     * Get skill metadata by name or ID.
     */
    async getMetadata(nameOrId, tenantId = "default") {
        const results = await this.db
            .select()
            .from(skills)
            .where(and(eq(skills.tenant_id, tenantId), sql `(${skills.id} = ${nameOrId} OR ${skills.name} = ${nameOrId})`))
            .limit(1);
        if (results.length === 0) {
            throw new NotFoundError(`Skill not found: ${nameOrId}`);
        }
        const s = results[0];
        return {
            id: s.id,
            name: s.name,
            description: s.description,
            trigger: s.trigger,
            scope: s.scope,
            tags: s.tags || [],
            version: s.version || "1.0.0",
            usageCount: s.usage_count || 0,
            lastUsedAt: s.last_used_at,
        };
    }
    /**
     * Load full skill content from filesystem.
     */
    async load(nameOrId, tenantId = "default") {
        const metadata = await this.getMetadata(nameOrId, tenantId);
        // Read SKILL.md from filesystem
        const skillPath = `${this.skillsBasePath}${metadata.scope === "public" ? "/public" : ""}/${metadata.name}/SKILL.md`;
        let content;
        try {
            const fs = await import("fs/promises");
            content = await fs.readFile(skillPath, "utf-8");
        }
        catch (err) {
            throw new NotFoundError(`Skill file not found at: ${skillPath}`);
        }
        return {
            metadata,
            content,
        };
    }
    /**
     * Load skill content with all referenced files.
     */
    async loadWithReferences(nameOrId, tenantId = "default") {
        const { metadata, content } = await this.load(nameOrId, tenantId);
        // Extract and load referenced files
        const refNames = extractReferences(content);
        const references = [];
        const fs = await import("fs/promises");
        const basePath = `${this.skillsBasePath}${metadata.scope === "public" ? "/public" : ""}/${metadata.name}`;
        for (const refName of refNames) {
            try {
                const refPath = `${basePath}/${refName}`;
                const refContent = await fs.readFile(refPath, "utf-8");
                references.push({ name: refName, content: refContent });
            }
            catch {
                // Skip missing references - they might be external links
            }
        }
        return {
            metadata,
            content,
            references,
        };
    }
    /**
     * Search skills by query string.
     */
    async search(query, tenantId = "default") {
        const searchPattern = `%${query}%`;
        const results = await this.db
            .select()
            .from(skills)
            .where(and(eq(skills.tenant_id, tenantId), eq(skills.is_active, true), sql `(
            ${skills.name} LIKE ${searchPattern} OR
            ${skills.description} LIKE ${searchPattern} OR
            ${skills.trigger} LIKE ${searchPattern}
          )`));
        return results.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            trigger: s.trigger,
            scope: s.scope,
            tags: s.tags || [],
            version: s.version || "1.0.0",
            usageCount: s.usage_count || 0,
            lastUsedAt: s.last_used_at,
        }));
    }
    /**
     * Register a new skill in the database.
     */
    async register(input, tenantId = "default") {
        const id = `sk_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
        const now = this.getNow();
        await this.db.insert(skills).values({
            id,
            tenant_id: tenantId,
            name: input.name,
            description: input.description,
            trigger: input.trigger ?? null,
            path: input.path,
            scope: input.scope ?? "public",
            owner_id: input.ownerId ?? null,
            version: input.version ?? "1.0.0",
            tags: input.tags ?? [],
            usage_count: 0,
            is_active: true,
            created_at: now,
            updated_at: now,
        });
        return {
            id,
            name: input.name,
            description: input.description,
            trigger: input.trigger,
            scope: (input.scope ?? "public"),
            tags: input.tags ?? [],
            version: input.version ?? "1.0.0",
            usageCount: 0,
        };
    }
    /**
     * Update a skill's metadata.
     */
    async update(nameOrId, input, tenantId = "default") {
        const metadata = await this.getMetadata(nameOrId, tenantId);
        const now = this.getNow();
        const updates = { updated_at: now };
        if (input.description !== undefined)
            updates.description = input.description;
        if (input.trigger !== undefined)
            updates.trigger = input.trigger;
        if (input.tags !== undefined)
            updates.tags = input.tags;
        if (input.version !== undefined)
            updates.version = input.version;
        if (input.isActive !== undefined)
            updates.is_active = input.isActive;
        await this.db
            .update(skills)
            .set(updates)
            .where(eq(skills.id, metadata.id));
        return this.getMetadata(metadata.id, tenantId);
    }
    /**
     * Deactivate a skill (soft delete).
     */
    async deactivate(nameOrId, tenantId = "default") {
        const metadata = await this.getMetadata(nameOrId, tenantId);
        await this.db
            .update(skills)
            .set({ is_active: false, updated_at: this.getNow() })
            .where(eq(skills.id, metadata.id));
    }
    /**
     * Start an invocation (for tracking).
     */
    async startInvocation(skillNameOrId, context, actor, tenantId = "default") {
        const skill = await this.getMetadata(skillNameOrId, tenantId);
        const id = `inv_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
        const now = this.getNow();
        await this.db.insert(skillInvocations).values({
            id,
            tenant_id: tenantId,
            skill_id: skill.id,
            skill_version: skill.version,
            deal_id: context.dealId ?? null,
            entity_id: context.entityId ?? null,
            actor,
            actor_type: context.actorType ?? null,
            ai_provider: context.aiProvider ?? null,
            status: "started",
            created_at: now,
        });
        // Update usage stats
        await this.db
            .update(skills)
            .set({
            usage_count: sql `${skills.usage_count} + 1`,
            last_used_at: now,
        })
            .where(eq(skills.id, skill.id));
        return {
            id,
            skillId: skill.id,
            status: "started",
        };
    }
    /**
     * Mark an invocation as completed.
     */
    async completeInvocation(invocationId, summary) {
        const now = this.getNow();
        await this.db
            .update(skillInvocations)
            .set({
            status: "completed",
            completed_at: now,
            output_summary: summary ?? null,
        })
            .where(eq(skillInvocations.id, invocationId));
        return { id: invocationId, status: "completed" };
    }
    /**
     * Mark an invocation as failed.
     */
    async failInvocation(invocationId, error) {
        const now = this.getNow();
        await this.db
            .update(skillInvocations)
            .set({
            status: "failed",
            completed_at: now,
            output_summary: `Error: ${error}`,
        })
            .where(eq(skillInvocations.id, invocationId));
        return { id: invocationId, status: "failed" };
    }
    /**
     * Get invocation history for a deal.
     */
    async getInvocationsByDeal(dealId, tenantId = "default") {
        const results = await this.db
            .select({
            invocation: skillInvocations,
            skill: skills,
        })
            .from(skillInvocations)
            .innerJoin(skills, eq(skillInvocations.skill_id, skills.id))
            .where(and(eq(skillInvocations.tenant_id, tenantId), eq(skillInvocations.deal_id, dealId)));
        return results.map((r) => ({
            id: r.invocation.id,
            skill: {
                id: r.skill.id,
                name: r.skill.name,
                description: r.skill.description,
                trigger: r.skill.trigger,
                scope: r.skill.scope,
                tags: r.skill.tags || [],
                version: r.skill.version || "1.0.0",
                usageCount: r.skill.usage_count || 0,
                lastUsedAt: r.skill.last_used_at,
            },
            actor: r.invocation.actor,
            actorType: r.invocation.actor_type,
            status: r.invocation.status,
            completedAt: r.invocation.completed_at,
            outputSummary: r.invocation.output_summary,
            createdAt: r.invocation.created_at,
        }));
    }
    /**
     * Sync skills from filesystem to database.
     */
    async syncFromFilesystem(basePath) {
        const path = basePath ?? this.skillsBasePath;
        const result = {
            added: [],
            updated: [],
            removed: [],
            errors: [],
        };
        const fs = await import("fs/promises");
        const pathModule = await import("path");
        // Scan public skills directory
        const publicPath = pathModule.join(path, "public");
        let dirs;
        try {
            dirs = await fs.readdir(publicPath);
        }
        catch {
            result.errors.push({
                path: publicPath,
                error: "Could not read skills directory",
            });
            return result;
        }
        const foundSkills = new Set();
        for (const dir of dirs) {
            const skillMdPath = pathModule.join(publicPath, dir, "SKILL.md");
            try {
                const content = await fs.readFile(skillMdPath, "utf-8");
                const { frontmatter } = parseSkillMd(content);
                const name = frontmatter.name || dir;
                foundSkills.add(name);
                // Check if skill already exists
                const existing = await this.db
                    .select()
                    .from(skills)
                    .where(and(eq(skills.name, name), eq(skills.scope, "public")))
                    .limit(1);
                if (existing.length === 0) {
                    // Register new skill
                    await this.register({
                        name,
                        description: frontmatter.description || `Skill: ${name}`,
                        trigger: frontmatter.trigger,
                        path: `/public/${dir}`,
                        scope: "public",
                        tags: frontmatter.tags,
                    });
                    result.added.push(name);
                }
                else {
                    // Update existing skill
                    const skill = existing[0];
                    const updates = {
                        updated_at: this.getNow(),
                    };
                    if (frontmatter.description && frontmatter.description !== skill.description) {
                        updates.description = frontmatter.description;
                    }
                    if (frontmatter.trigger !== skill.trigger) {
                        updates.trigger = frontmatter.trigger ?? null;
                    }
                    if (frontmatter.tags) {
                        updates.tags = frontmatter.tags;
                    }
                    if (Object.keys(updates).length > 1) {
                        await this.db
                            .update(skills)
                            .set(updates)
                            .where(eq(skills.id, skill.id));
                        result.updated.push(name);
                    }
                }
            }
            catch (err) {
                // Directory exists but no SKILL.md or parse error
                if (err.code !== "ENOENT") {
                    result.errors.push({
                        path: skillMdPath,
                        error: String(err),
                    });
                }
            }
        }
        // Mark skills as inactive if they no longer exist on filesystem
        const allPublicSkills = await this.db
            .select()
            .from(skills)
            .where(and(eq(skills.scope, "public"), eq(skills.is_active, true)));
        for (const skill of allPublicSkills) {
            if (!foundSkills.has(skill.name)) {
                await this.db
                    .update(skills)
                    .set({ is_active: false, updated_at: this.getNow() })
                    .where(eq(skills.id, skill.id));
                result.removed.push(skill.name);
            }
        }
        return result;
    }
}
//# sourceMappingURL=skill.js.map