import { eq, and } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { depositAccounts } from "../schema/tables.js";
import { NotFoundError, ValidationError } from "./errors.js";

export interface CreateDepositAccountInput {
  type: string;
  account_holder: string;
  account_holder_id?: string;
  currency?: string;
  interest_rate?: number;
  maturity_date?: string;
  custom_fields?: Record<string, unknown>;
}

export class DepositAccountService {
  private counter = 0;

  constructor(
    private db: Database,
    private getNow: () => string
  ) {}

  async create(input: CreateDepositAccountInput, actor: string, tenantId = "default") {
    if (!input.type) {
      throw new ValidationError("type is required");
    }
    if (!input.account_holder) {
      throw new ValidationError("account_holder is required");
    }

    const validTypes = ["demand_deposit", "time_deposit", "certificate_of_deposit"];
    if (!validTypes.includes(input.type)) {
      throw new ValidationError(`type must be one of: ${validTypes.join(", ")}`);
    }

    const id = crypto.randomUUID();
    const now = this.getNow();
    this.counter++;
    const accountId = `DEP-${String(this.counter).padStart(5, "0")}`;

    const account = {
      id,
      tenant_id: tenantId,
      account_id: accountId,
      type: input.type,
      account_holder: input.account_holder,
      account_holder_id: input.account_holder_id ?? null,
      currency: input.currency ?? "USD",
      balance: 0,
      interest_rate: input.interest_rate ?? null,
      maturity_date: input.maturity_date ?? null,
      status: "ACTIVE",
      custom_fields: input.custom_fields ?? null,
      created_at: now,
      updated_at: now,
    };

    await this.db.insert(depositAccounts).values(account);

    return account;
  }

  async getById(id: string, tenantId = "default") {
    const rows = await this.db
      .select()
      .from(depositAccounts)
      .where(and(eq(depositAccounts.id, id), eq(depositAccounts.tenant_id, tenantId)));
    if (rows.length === 0) {
      throw new NotFoundError(`Deposit account ${id} not found`);
    }
    return rows[0];
  }

  async list(tenantId = "default") {
    return this.db
      .select()
      .from(depositAccounts)
      .where(eq(depositAccounts.tenant_id, tenantId));
  }
}
