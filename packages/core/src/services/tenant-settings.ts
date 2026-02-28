import { eq } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { tenantSettings } from "../schema/tables.js";

export interface TenantSettingsInput {
  disabled_guards?: string[];
}

export class TenantSettingsService {
  constructor(
    private db: Database,
    private getNow: () => string
  ) {}

  async get(tenantId: string) {
    const rows = await this.db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenant_id, tenantId));

    if (rows.length === 0) return null;
    return rows[0];
  }

  async upsert(tenantId: string, input: TenantSettingsInput) {
    const now = this.getNow();
    const existing = await this.get(tenantId);

    if (existing) {
      await this.db
        .update(tenantSettings)
        .set({
          disabled_guards: input.disabled_guards ?? existing.disabled_guards,
          updated_at: now,
        })
        .where(eq(tenantSettings.tenant_id, tenantId));
    } else {
      await this.db.insert(tenantSettings).values({
        tenant_id: tenantId,
        disabled_guards: input.disabled_guards ?? [],
        created_at: now,
        updated_at: now,
      });
    }

    return this.get(tenantId);
  }

  async getDisabledGuards(tenantId: string): Promise<Set<string>> {
    const settings = await this.get(tenantId);
    if (!settings || !settings.disabled_guards) return new Set();
    const guards = settings.disabled_guards as string[];
    return new Set(guards);
  }
}
