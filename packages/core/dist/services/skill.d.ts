import type { Database } from "../schema/db.js";
export interface SkillFrontmatter {
    name?: string;
    description?: string;
    trigger?: string;
    tags?: string[];
}
export interface SkillMetadata {
    id: string;
    name: string;
    description: string;
    trigger?: string | null;
    scope: "public" | "org" | "user";
    tags: string[];
    version: string;
    usageCount: number;
    lastUsedAt?: string | null;
}
export interface SkillContent {
    metadata: SkillMetadata;
    content: string;
}
export interface SkillContentWithRefs {
    metadata: SkillMetadata;
    content: string;
    references: Array<{
        name: string;
        content: string;
    }>;
}
export interface RegisterSkillInput {
    name: string;
    description: string;
    trigger?: string;
    path: string;
    scope?: "public" | "org" | "user";
    ownerId?: string;
    tags?: string[];
    version?: string;
}
export interface UpdateSkillInput {
    description?: string;
    trigger?: string;
    tags?: string[];
    version?: string;
    isActive?: boolean;
}
export interface InvocationContext {
    dealId?: string;
    entityId?: string;
    actorType?: "human" | "ai";
    aiProvider?: string;
}
export interface SyncResult {
    added: string[];
    updated: string[];
    removed: string[];
    errors: Array<{
        path: string;
        error: string;
    }>;
}
export interface ListOptions {
    scope?: "public" | "org" | "user";
    tags?: string[];
    includeInactive?: boolean;
}
/**
 * Parse YAML frontmatter from SKILL.md content.
 * Handles basic YAML without requiring a full YAML library.
 */
export declare function parseSkillMd(content: string): {
    frontmatter: SkillFrontmatter;
    body: string;
};
/**
 * Extract referenced file names from markdown content.
 * Looks for patterns like [name.md](name.md) or (see name.md)
 */
export declare function extractReferences(content: string): string[];
export declare class SkillService {
    private db;
    private getNow;
    private skillsBasePath;
    constructor(db: Database, getNow: () => string, skillsBasePath?: string);
    /**
     * List available skills (metadata only).
     */
    list(tenantId?: string, options?: ListOptions): Promise<SkillMetadata[]>;
    /**
     * Get skill metadata by name or ID.
     */
    getMetadata(nameOrId: string, tenantId?: string): Promise<SkillMetadata>;
    /**
     * Load full skill content from filesystem.
     */
    load(nameOrId: string, tenantId?: string): Promise<SkillContent>;
    /**
     * Load skill content with all referenced files.
     */
    loadWithReferences(nameOrId: string, tenantId?: string): Promise<SkillContentWithRefs>;
    /**
     * Search skills by query string.
     */
    search(query: string, tenantId?: string): Promise<SkillMetadata[]>;
    /**
     * Register a new skill in the database.
     */
    register(input: RegisterSkillInput, tenantId?: string): Promise<SkillMetadata>;
    /**
     * Update a skill's metadata.
     */
    update(nameOrId: string, input: UpdateSkillInput, tenantId?: string): Promise<SkillMetadata>;
    /**
     * Deactivate a skill (soft delete).
     */
    deactivate(nameOrId: string, tenantId?: string): Promise<void>;
    /**
     * Start an invocation (for tracking).
     */
    startInvocation(skillNameOrId: string, context: InvocationContext, actor: string, tenantId?: string): Promise<{
        id: string;
        skillId: string;
        status: string;
    }>;
    /**
     * Mark an invocation as completed.
     */
    completeInvocation(invocationId: string, summary?: string): Promise<{
        id: string;
        status: string;
    }>;
    /**
     * Mark an invocation as failed.
     */
    failInvocation(invocationId: string, error: string): Promise<{
        id: string;
        status: string;
    }>;
    /**
     * Get invocation history for a deal.
     */
    getInvocationsByDeal(dealId: string, tenantId?: string): Promise<Array<{
        id: string;
        skill: SkillMetadata;
        actor: string;
        actorType?: string | null;
        status: string;
        completedAt?: string | null;
        outputSummary?: string | null;
        createdAt: string;
    }>>;
    /**
     * Sync skills from filesystem to database.
     */
    syncFromFilesystem(basePath?: string): Promise<SyncResult>;
}
//# sourceMappingURL=skill.d.ts.map