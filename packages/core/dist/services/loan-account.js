import { eq, and } from "drizzle-orm";
import { loanAccounts, loanTransactions, repaymentSchedule, deals, facilities, entities, } from "../schema/tables.js";
import { NotFoundError, ValidationError, InvalidTransitionError, } from "./errors.js";
// ─── Constants ─────────────────────────────────────────────────────────────────
const VALID_STATES = [
    "PARTIAL_APPLICATION",
    "PENDING_APPROVAL",
    "APPROVED",
    "ACTIVE",
    "ACTIVE_IN_ARREARS",
    "LOCKED",
    "CLOSED",
];
const VALID_SUB_STATES = [
    "WITHDRAWN",
    "REJECTED",
    "WRITTEN_OFF",
    "PAID_OFF",
    "REFINANCED",
    "RESCHEDULED",
];
const VALID_INTEREST_RATE_TYPES = ["FIXED", "FLOATING"];
const VALID_INTEREST_CALC_METHODS = ["DECLINING_BALANCE", "FLAT"];
const VALID_REPAYMENT_METHODS = ["EQUAL_INSTALLMENTS", "BALLOON", "INTEREST_ONLY"];
const VALID_REPAYMENT_FREQUENCIES = ["MONTHLY", "QUARTERLY", "ANNUALLY"];
const VALID_ACCOUNT_HOLDER_TYPES = ["CLIENT"];
const ALLOWED_TRANSITIONS = {
    PARTIAL_APPLICATION: ["PENDING_APPROVAL"],
    PENDING_APPROVAL: ["APPROVED", "CLOSED"], // CLOSED with sub_state REJECTED/WITHDRAWN
    APPROVED: ["ACTIVE", "CLOSED"], // CLOSED with sub_state WITHDRAWN
    ACTIVE: ["ACTIVE_IN_ARREARS", "LOCKED", "CLOSED"],
    ACTIVE_IN_ARREARS: ["ACTIVE", "LOCKED", "CLOSED"],
    LOCKED: ["ACTIVE", "ACTIVE_IN_ARREARS", "CLOSED"],
    CLOSED: [], // Terminal state
};
// ─── Service ───────────────────────────────────────────────────────────────────
export class LoanAccountService {
    db;
    audit;
    getNow;
    accountIdCounter = 0;
    constructor(db, audit, getNow) {
        this.db = db;
        this.audit = audit;
        this.getNow = getNow;
    }
    // ─── ID Generation ─────────────────────────────────────────────────────────
    async generateAccountId(tenantId) {
        // Get the highest existing account ID for this tenant
        const existing = await this.db
            .select({ account_id: loanAccounts.account_id })
            .from(loanAccounts)
            .where(eq(loanAccounts.tenant_id, tenantId));
        let maxNum = 0;
        for (const row of existing) {
            const match = row.account_id.match(/^LN-(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum)
                    maxNum = num;
            }
        }
        return `LN-${String(maxNum + 1).padStart(5, "0")}`;
    }
    // ─── CRUD Operations ───────────────────────────────────────────────────────
    async create(input, actor, tenantId = "default") {
        // Validate account holder type
        if (!VALID_ACCOUNT_HOLDER_TYPES.includes(input.account_holder_type)) {
            throw new ValidationError(`Invalid account_holder_type: ${input.account_holder_type}. Must be one of: ${VALID_ACCOUNT_HOLDER_TYPES.join(", ")}`);
        }
        // Validate account holder exists (entity)
        const entityRows = await this.db
            .select()
            .from(entities)
            .where(eq(entities.id, input.account_holder_id));
        if (entityRows.length === 0) {
            throw new NotFoundError(`Entity ${input.account_holder_id} not found`);
        }
        // Validate loan amount
        if (input.loan_amount === undefined || input.loan_amount <= 0) {
            throw new ValidationError("loan_amount must be a positive number");
        }
        // Validate deal if provided
        if (input.deal_id) {
            const dealRows = await this.db
                .select()
                .from(deals)
                .where(eq(deals.id, input.deal_id));
            if (dealRows.length === 0) {
                throw new NotFoundError(`Deal ${input.deal_id} not found`);
            }
        }
        // Validate facility if provided
        if (input.facility_id) {
            const facilityRows = await this.db
                .select()
                .from(facilities)
                .where(eq(facilities.id, input.facility_id));
            if (facilityRows.length === 0) {
                throw new NotFoundError(`Facility ${input.facility_id} not found`);
            }
        }
        // Validate optional enums
        if (input.interest_rate_type &&
            !VALID_INTEREST_RATE_TYPES.includes(input.interest_rate_type)) {
            throw new ValidationError(`Invalid interest_rate_type: ${input.interest_rate_type}. Must be one of: ${VALID_INTEREST_RATE_TYPES.join(", ")}`);
        }
        if (input.interest_calculation_method &&
            !VALID_INTEREST_CALC_METHODS.includes(input.interest_calculation_method)) {
            throw new ValidationError(`Invalid interest_calculation_method: ${input.interest_calculation_method}. Must be one of: ${VALID_INTEREST_CALC_METHODS.join(", ")}`);
        }
        if (input.repayment_method &&
            !VALID_REPAYMENT_METHODS.includes(input.repayment_method)) {
            throw new ValidationError(`Invalid repayment_method: ${input.repayment_method}. Must be one of: ${VALID_REPAYMENT_METHODS.join(", ")}`);
        }
        if (input.repayment_frequency &&
            !VALID_REPAYMENT_FREQUENCIES.includes(input.repayment_frequency)) {
            throw new ValidationError(`Invalid repayment_frequency: ${input.repayment_frequency}. Must be one of: ${VALID_REPAYMENT_FREQUENCIES.join(", ")}`);
        }
        const id = crypto.randomUUID();
        const encodedKey = crypto.randomUUID();
        const accountId = await this.generateAccountId(tenantId);
        const now = this.getNow();
        const row = {
            id,
            tenant_id: tenantId,
            encoded_key: encodedKey,
            account_id: accountId,
            deal_id: input.deal_id ?? null,
            facility_id: input.facility_id ?? null,
            account_holder_type: input.account_holder_type,
            account_holder_id: input.account_holder_id,
            state: "PENDING_APPROVAL",
            sub_state: null,
            loan_amount: input.loan_amount,
            currency: input.currency ?? "USD",
            interest_rate: input.interest_rate ?? null,
            interest_rate_type: input.interest_rate_type ?? null,
            interest_rate_spread: input.interest_rate_spread ?? null,
            interest_calculation_method: input.interest_calculation_method ?? null,
            repayment_method: input.repayment_method ?? null,
            repayment_frequency: input.repayment_frequency ?? null,
            term_months: input.term_months ?? null,
            grace_period_days: input.grace_period_days ?? 0,
            first_repayment_date: input.first_repayment_date ?? null,
            principal_disbursed: 0,
            principal_outstanding: 0,
            principal_paid: 0,
            interest_accrued: 0,
            interest_paid: 0,
            fees_outstanding: 0,
            fees_paid: 0,
            penalties_outstanding: 0,
            penalties_paid: 0,
            days_in_arrears: 0,
            arrears_since: null,
            approved_at: null,
            approved_by: null,
            disbursed_at: null,
            disbursed_by: null,
            closed_at: null,
            closed_by: null,
            locked_at: null,
            custom_fields: input.custom_fields ?? null,
            created_at: now,
            updated_at: now,
        };
        await this.db.insert(loanAccounts).values(row);
        // Record audit event (linked to deal if available)
        if (input.deal_id) {
            await this.audit.record({
                deal_id: input.deal_id,
                type: "LOAN_ACCOUNT_CREATED",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: {
                    account_id: accountId,
                    loan_amount: input.loan_amount,
                    account_holder_id: input.account_holder_id,
                },
            });
        }
        return this.toApiLoanAccount(row);
    }
    async getById(id, tenantId = "default") {
        const rows = await this.db
            .select()
            .from(loanAccounts)
            .where(and(eq(loanAccounts.id, id), eq(loanAccounts.tenant_id, tenantId)));
        if (rows.length === 0) {
            throw new NotFoundError(`Loan account ${id} not found`);
        }
        return this.toApiLoanAccount(rows[0]);
    }
    async getByEncodedKey(encodedKey, tenantId = "default") {
        const rows = await this.db
            .select()
            .from(loanAccounts)
            .where(and(eq(loanAccounts.encoded_key, encodedKey), eq(loanAccounts.tenant_id, tenantId)));
        if (rows.length === 0) {
            throw new NotFoundError(`Loan account with encodedKey ${encodedKey} not found`);
        }
        return this.toApiLoanAccount(rows[0]);
    }
    async getByAccountId(accountId, tenantId = "default") {
        const rows = await this.db
            .select()
            .from(loanAccounts)
            .where(and(eq(loanAccounts.account_id, accountId), eq(loanAccounts.tenant_id, tenantId)));
        if (rows.length === 0) {
            throw new NotFoundError(`Loan account ${accountId} not found`);
        }
        return this.toApiLoanAccount(rows[0]);
    }
    async update(id, input, actor, tenantId = "default") {
        const existing = await this.getByIdRaw(id, tenantId);
        // Can only update in PENDING_APPROVAL or APPROVED states
        if (!["PENDING_APPROVAL", "APPROVED"].includes(existing.state)) {
            throw new ValidationError(`Cannot update loan account in ${existing.state} state. Updates only allowed in PENDING_APPROVAL or APPROVED states.`);
        }
        const now = this.getNow();
        const changes = [];
        const updates = { updated_at: now };
        const allowedFields = [
            "loan_amount",
            "interest_rate",
            "interest_rate_type",
            "interest_rate_spread",
            "interest_calculation_method",
            "repayment_method",
            "repayment_frequency",
            "term_months",
            "grace_period_days",
            "first_repayment_date",
            "custom_fields",
        ];
        for (const field of allowedFields) {
            const value = input[field];
            if (value !== undefined) {
                const existingValue = existing[field];
                if (existingValue !== value) {
                    changes.push({ field, before: existingValue ?? null, after: value });
                    updates[field] = value;
                }
            }
        }
        if (changes.length > 0) {
            await this.db
                .update(loanAccounts)
                .set(updates)
                .where(eq(loanAccounts.id, id));
            if (existing.deal_id) {
                await this.audit.record({
                    deal_id: existing.deal_id,
                    type: "LOAN_ACCOUNT_UPDATED",
                    actor,
                    timestamp: now,
                    object_type: "loan_account",
                    object_id: id,
                    changes,
                });
            }
        }
        return this.getById(id, tenantId);
    }
    async search(criteria, tenantId = "default") {
        let rows = await this.db
            .select()
            .from(loanAccounts)
            .where(eq(loanAccounts.tenant_id, tenantId));
        // Apply filters
        if (criteria.filter_criteria) {
            for (const filter of criteria.filter_criteria) {
                rows = rows.filter((row) => {
                    const fieldValue = row[filter.field];
                    switch (filter.operator) {
                        case "EQUALS":
                            return fieldValue === filter.value;
                        case "IN":
                            return filter.values?.includes(fieldValue);
                        case "BETWEEN":
                            return (fieldValue !== null &&
                                fieldValue !== undefined &&
                                fieldValue >= filter.value &&
                                fieldValue <= filter.second_value);
                        default:
                            return true;
                    }
                });
            }
        }
        // Apply sorting
        if (criteria.sorting_criteria) {
            const field = criteria.sorting_criteria.field;
            const order = criteria.sorting_criteria.order;
            rows.sort((a, b) => {
                const aVal = a[field];
                const bVal = b[field];
                if (aVal === bVal)
                    return 0;
                if (aVal === null || aVal === undefined)
                    return 1;
                if (bVal === null || bVal === undefined)
                    return -1;
                const cmp = aVal < bVal ? -1 : 1;
                return order === "DESC" ? -cmp : cmp;
            });
        }
        // Apply cursor pagination
        if (criteria.cursor) {
            const idx = rows.findIndex((r) => r.id === criteria.cursor);
            if (idx >= 0) {
                rows = rows.slice(idx + 1);
            }
        }
        const total = rows.length;
        const limit = criteria.limit ?? 50;
        let cursor;
        if (rows.length > limit) {
            rows = rows.slice(0, limit);
            cursor = rows[rows.length - 1]?.id;
        }
        return {
            loan_accounts: rows.map((r) => this.toApiLoanAccount(r)),
            total,
            cursor,
        };
    }
    async listByDeal(dealId, tenantId = "default") {
        const rows = await this.db
            .select()
            .from(loanAccounts)
            .where(and(eq(loanAccounts.deal_id, dealId), eq(loanAccounts.tenant_id, tenantId)));
        return { loan_accounts: rows.map((r) => this.toApiLoanAccount(r)) };
    }
    // ─── State Transitions ─────────────────────────────────────────────────────
    validateTransition(currentState, targetState) {
        const allowed = ALLOWED_TRANSITIONS[currentState] ?? [];
        if (!allowed.includes(targetState)) {
            throw new InvalidTransitionError(`Cannot transition from ${currentState} to ${targetState}. Allowed transitions: ${allowed.join(", ") || "none"}`);
        }
    }
    async requestApproval(id, notes, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        this.validateTransition(account.state, "PENDING_APPROVAL");
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        await this.db
            .update(loanAccounts)
            .set({ state: "PENDING_APPROVAL", updated_at: now })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "PENDING_APPROVAL",
            entry_date: now,
            value_date: now,
            booking_date: now,
            amount: 0,
            principal_amount: null,
            interest_amount: null,
            fees_amount: null,
            penalties_amount: null,
            balance_principal: account.principal_outstanding,
            balance_interest: account.interest_accrued,
            balance_fees: account.fees_outstanding,
            balance_total: (account.principal_outstanding ?? 0) +
                (account.interest_accrued ?? 0) +
                (account.fees_outstanding ?? 0) +
                (account.penalties_outstanding ?? 0),
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: null,
            repayment_allocation: null,
            idempotency_key: null,
            actor,
            notes,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_ACCOUNT_APPROVAL_REQUESTED",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: { notes },
            });
        }
        return this.toApiTransaction(transaction);
    }
    async approve(id, notes, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        this.validateTransition(account.state, "APPROVED");
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        await this.db
            .update(loanAccounts)
            .set({
            state: "APPROVED",
            approved_at: now,
            approved_by: actor,
            updated_at: now,
        })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "APPROVAL",
            entry_date: now,
            value_date: now,
            booking_date: now,
            amount: 0,
            principal_amount: null,
            interest_amount: null,
            fees_amount: null,
            penalties_amount: null,
            balance_principal: account.principal_outstanding,
            balance_interest: account.interest_accrued,
            balance_fees: account.fees_outstanding,
            balance_total: (account.principal_outstanding ?? 0) +
                (account.interest_accrued ?? 0) +
                (account.fees_outstanding ?? 0) +
                (account.penalties_outstanding ?? 0),
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: null,
            repayment_allocation: null,
            idempotency_key: null,
            actor,
            notes,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_ACCOUNT_APPROVED",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: { notes },
            });
        }
        return this.toApiTransaction(transaction);
    }
    async reject(id, notes, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        this.validateTransition(account.state, "CLOSED");
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        await this.db
            .update(loanAccounts)
            .set({
            state: "CLOSED",
            sub_state: "REJECTED",
            closed_at: now,
            closed_by: actor,
            updated_at: now,
        })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "REJECT",
            entry_date: now,
            value_date: now,
            booking_date: now,
            amount: 0,
            principal_amount: null,
            interest_amount: null,
            fees_amount: null,
            penalties_amount: null,
            balance_principal: 0,
            balance_interest: 0,
            balance_fees: 0,
            balance_total: 0,
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: null,
            repayment_allocation: null,
            idempotency_key: null,
            actor,
            notes,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_ACCOUNT_REJECTED",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: { notes },
            });
        }
        return this.toApiTransaction(transaction);
    }
    async withdraw(id, notes, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        this.validateTransition(account.state, "CLOSED");
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        await this.db
            .update(loanAccounts)
            .set({
            state: "CLOSED",
            sub_state: "WITHDRAWN",
            closed_at: now,
            closed_by: actor,
            updated_at: now,
        })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "WITHDRAW",
            entry_date: now,
            value_date: now,
            booking_date: now,
            amount: 0,
            principal_amount: null,
            interest_amount: null,
            fees_amount: null,
            penalties_amount: null,
            balance_principal: 0,
            balance_interest: 0,
            balance_fees: 0,
            balance_total: 0,
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: null,
            repayment_allocation: null,
            idempotency_key: null,
            actor,
            notes,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_ACCOUNT_WITHDRAWN",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: { notes },
            });
        }
        return this.toApiTransaction(transaction);
    }
    async lock(id, notes, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        this.validateTransition(account.state, "LOCKED");
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        await this.db
            .update(loanAccounts)
            .set({
            state: "LOCKED",
            locked_at: now,
            updated_at: now,
        })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "LOCK",
            entry_date: now,
            value_date: now,
            booking_date: now,
            amount: 0,
            principal_amount: null,
            interest_amount: null,
            fees_amount: null,
            penalties_amount: null,
            balance_principal: account.principal_outstanding,
            balance_interest: account.interest_accrued,
            balance_fees: account.fees_outstanding,
            balance_total: (account.principal_outstanding ?? 0) +
                (account.interest_accrued ?? 0) +
                (account.fees_outstanding ?? 0) +
                (account.penalties_outstanding ?? 0),
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: null,
            repayment_allocation: null,
            idempotency_key: null,
            actor,
            notes,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_ACCOUNT_LOCKED",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: { notes },
            });
        }
        return this.toApiTransaction(transaction);
    }
    async unlock(id, notes, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        if (account.state !== "LOCKED") {
            throw new ValidationError("Can only unlock a LOCKED account");
        }
        // Determine target state based on arrears
        const targetState = (account.days_in_arrears ?? 0) > 0 ? "ACTIVE_IN_ARREARS" : "ACTIVE";
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        await this.db
            .update(loanAccounts)
            .set({
            state: targetState,
            locked_at: null,
            updated_at: now,
        })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "UNLOCK",
            entry_date: now,
            value_date: now,
            booking_date: now,
            amount: 0,
            principal_amount: null,
            interest_amount: null,
            fees_amount: null,
            penalties_amount: null,
            balance_principal: account.principal_outstanding,
            balance_interest: account.interest_accrued,
            balance_fees: account.fees_outstanding,
            balance_total: (account.principal_outstanding ?? 0) +
                (account.interest_accrued ?? 0) +
                (account.fees_outstanding ?? 0) +
                (account.penalties_outstanding ?? 0),
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: null,
            repayment_allocation: null,
            idempotency_key: null,
            actor,
            notes,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_ACCOUNT_UNLOCKED",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: { notes, target_state: targetState },
            });
        }
        return this.toApiTransaction(transaction);
    }
    async close(id, subState, notes, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        this.validateTransition(account.state, "CLOSED");
        if (!VALID_SUB_STATES.includes(subState)) {
            throw new ValidationError(`Invalid sub_state: ${subState}. Must be one of: ${VALID_SUB_STATES.join(", ")}`);
        }
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        await this.db
            .update(loanAccounts)
            .set({
            state: "CLOSED",
            sub_state: subState,
            closed_at: now,
            closed_by: actor,
            updated_at: now,
        })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "CLOSE",
            entry_date: now,
            value_date: now,
            booking_date: now,
            amount: 0,
            principal_amount: null,
            interest_amount: null,
            fees_amount: null,
            penalties_amount: null,
            balance_principal: account.principal_outstanding,
            balance_interest: account.interest_accrued,
            balance_fees: account.fees_outstanding,
            balance_total: (account.principal_outstanding ?? 0) +
                (account.interest_accrued ?? 0) +
                (account.fees_outstanding ?? 0) +
                (account.penalties_outstanding ?? 0),
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: null,
            repayment_allocation: null,
            idempotency_key: null,
            actor,
            notes,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_ACCOUNT_CLOSED",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: { notes, sub_state: subState },
            });
        }
        return this.toApiTransaction(transaction);
    }
    // ─── Financial Operations ──────────────────────────────────────────────────
    async disburse(id, input, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        // Must be in APPROVED state to disburse
        if (account.state !== "APPROVED") {
            throw new ValidationError(`Cannot disburse loan in ${account.state} state. Must be APPROVED.`);
        }
        // Check idempotency
        if (input.idempotency_key) {
            const existing = await this.db
                .select()
                .from(loanTransactions)
                .where(eq(loanTransactions.idempotency_key, input.idempotency_key));
            if (existing.length > 0) {
                return this.toApiTransaction(existing[0]);
            }
        }
        // Validate amount
        if (input.amount <= 0) {
            throw new ValidationError("Disbursement amount must be positive");
        }
        if (input.amount > account.loan_amount) {
            throw new ValidationError(`Disbursement amount ${input.amount} exceeds approved loan amount ${account.loan_amount}`);
        }
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        const newPrincipalDisbursed = (account.principal_disbursed ?? 0) + input.amount;
        const newPrincipalOutstanding = (account.principal_outstanding ?? 0) + input.amount;
        // Update account balances and state
        await this.db
            .update(loanAccounts)
            .set({
            state: "ACTIVE",
            principal_disbursed: newPrincipalDisbursed,
            principal_outstanding: newPrincipalOutstanding,
            disbursed_at: now,
            disbursed_by: actor,
            updated_at: now,
        })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "DISBURSEMENT",
            entry_date: now,
            value_date: input.value_date,
            booking_date: now,
            amount: input.amount,
            principal_amount: input.amount,
            interest_amount: null,
            fees_amount: null,
            penalties_amount: null,
            balance_principal: newPrincipalOutstanding,
            balance_interest: account.interest_accrued,
            balance_fees: account.fees_outstanding,
            balance_total: newPrincipalOutstanding +
                (account.interest_accrued ?? 0) +
                (account.fees_outstanding ?? 0) +
                (account.penalties_outstanding ?? 0),
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: input.disbursement_details ?? null,
            repayment_allocation: null,
            idempotency_key: input.idempotency_key ?? null,
            actor,
            notes: input.notes ?? null,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        // Generate repayment schedule on first disbursement
        if (account.principal_disbursed === 0 || account.principal_disbursed === null) {
            await this.generateRepaymentSchedule(id, tenantId);
        }
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_DISBURSED",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: {
                    amount: input.amount,
                    value_date: input.value_date,
                    transaction_id: txId,
                },
            });
        }
        return this.toApiTransaction(transaction);
    }
    async repay(id, input, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        // Must be in ACTIVE or ACTIVE_IN_ARREARS state
        if (!["ACTIVE", "ACTIVE_IN_ARREARS"].includes(account.state)) {
            throw new ValidationError(`Cannot process repayment for loan in ${account.state} state. Must be ACTIVE or ACTIVE_IN_ARREARS.`);
        }
        // Check idempotency
        if (input.idempotency_key) {
            const existing = await this.db
                .select()
                .from(loanTransactions)
                .where(eq(loanTransactions.idempotency_key, input.idempotency_key));
            if (existing.length > 0) {
                return this.toApiTransaction(existing[0]);
            }
        }
        // Validate amount
        if (input.amount <= 0) {
            throw new ValidationError("Repayment amount must be positive");
        }
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        // Calculate allocation (custom or auto)
        let allocation = this.allocateRepayment(account, input.amount, input.custom_allocation);
        // Update account balances
        const newPrincipalOutstanding = (account.principal_outstanding ?? 0) - allocation.principal;
        const newPrincipalPaid = (account.principal_paid ?? 0) + allocation.principal;
        const newInterestAccrued = (account.interest_accrued ?? 0) - allocation.interest;
        const newInterestPaid = (account.interest_paid ?? 0) + allocation.interest;
        const newFeesOutstanding = (account.fees_outstanding ?? 0) - allocation.fees;
        const newFeesPaid = (account.fees_paid ?? 0) + allocation.fees;
        const newPenaltiesOutstanding = (account.penalties_outstanding ?? 0) - allocation.penalties;
        const newPenaltiesPaid = (account.penalties_paid ?? 0) + allocation.penalties;
        // Determine new state
        let newState = account.state;
        let newSubState = account.sub_state;
        // Check if loan is fully paid
        const totalOutstanding = newPrincipalOutstanding +
            Math.max(0, newInterestAccrued) +
            Math.max(0, newFeesOutstanding) +
            Math.max(0, newPenaltiesOutstanding);
        if (totalOutstanding <= 0) {
            newState = "CLOSED";
            newSubState = "PAID_OFF";
        }
        else if (account.state === "ACTIVE_IN_ARREARS") {
            // Check if arrears are cleared
            const arrearsCleared = await this.checkArrearsCleared(id, tenantId);
            if (arrearsCleared) {
                newState = "ACTIVE";
            }
        }
        await this.db
            .update(loanAccounts)
            .set({
            state: newState,
            sub_state: newSubState,
            principal_outstanding: Math.max(0, newPrincipalOutstanding),
            principal_paid: newPrincipalPaid,
            interest_accrued: Math.max(0, newInterestAccrued),
            interest_paid: newInterestPaid,
            fees_outstanding: Math.max(0, newFeesOutstanding),
            fees_paid: newFeesPaid,
            penalties_outstanding: Math.max(0, newPenaltiesOutstanding),
            penalties_paid: newPenaltiesPaid,
            closed_at: newState === "CLOSED" ? now : account.closed_at,
            closed_by: newState === "CLOSED" ? actor : account.closed_by,
            updated_at: now,
        })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "REPAYMENT",
            entry_date: now,
            value_date: input.value_date,
            booking_date: now,
            amount: input.amount,
            principal_amount: allocation.principal,
            interest_amount: allocation.interest,
            fees_amount: allocation.fees,
            penalties_amount: allocation.penalties,
            balance_principal: Math.max(0, newPrincipalOutstanding),
            balance_interest: Math.max(0, newInterestAccrued),
            balance_fees: Math.max(0, newFeesOutstanding),
            balance_total: Math.max(0, totalOutstanding),
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: null,
            repayment_allocation: {
                allocation_order: input.custom_allocation
                    ? "CUSTOM"
                    : "PENALTIES_FEES_INTEREST_PRINCIPAL",
                amounts: allocation,
            },
            idempotency_key: input.idempotency_key ?? null,
            actor,
            notes: input.notes ?? null,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        // Update repayment schedule
        await this.applyRepaymentToSchedule(id, allocation, input.value_date, tenantId);
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_REPAYMENT",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: {
                    amount: input.amount,
                    allocation,
                    value_date: input.value_date,
                    transaction_id: txId,
                    new_state: newState,
                },
            });
        }
        return this.toApiTransaction(transaction);
    }
    async applyFee(id, input, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        // Must be in ACTIVE or ACTIVE_IN_ARREARS state
        if (!["ACTIVE", "ACTIVE_IN_ARREARS"].includes(account.state)) {
            throw new ValidationError(`Cannot apply fee to loan in ${account.state} state. Must be ACTIVE or ACTIVE_IN_ARREARS.`);
        }
        // Check idempotency
        if (input.idempotency_key) {
            const existing = await this.db
                .select()
                .from(loanTransactions)
                .where(eq(loanTransactions.idempotency_key, input.idempotency_key));
            if (existing.length > 0) {
                return this.toApiTransaction(existing[0]);
            }
        }
        // Validate amount
        if (input.amount <= 0) {
            throw new ValidationError("Fee amount must be positive");
        }
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        const newFeesOutstanding = (account.fees_outstanding ?? 0) + input.amount;
        await this.db
            .update(loanAccounts)
            .set({
            fees_outstanding: newFeesOutstanding,
            updated_at: now,
        })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "FEE",
            entry_date: now,
            value_date: input.value_date,
            booking_date: now,
            amount: input.amount,
            principal_amount: null,
            interest_amount: null,
            fees_amount: input.amount,
            penalties_amount: null,
            balance_principal: account.principal_outstanding,
            balance_interest: account.interest_accrued,
            balance_fees: newFeesOutstanding,
            balance_total: (account.principal_outstanding ?? 0) +
                (account.interest_accrued ?? 0) +
                newFeesOutstanding +
                (account.penalties_outstanding ?? 0),
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: null,
            repayment_allocation: null,
            idempotency_key: input.idempotency_key ?? null,
            actor,
            notes: input.notes ?? null,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_FEE_APPLIED",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: {
                    amount: input.amount,
                    value_date: input.value_date,
                    transaction_id: txId,
                },
            });
        }
        return this.toApiTransaction(transaction);
    }
    async applyInterest(id, asOfDate, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        // Must be in ACTIVE or ACTIVE_IN_ARREARS state
        if (!["ACTIVE", "ACTIVE_IN_ARREARS"].includes(account.state)) {
            throw new ValidationError(`Cannot apply interest to loan in ${account.state} state. Must be ACTIVE or ACTIVE_IN_ARREARS.`);
        }
        // Calculate interest for the period
        const interestAmount = this.calculateInterest(account, asOfDate);
        if (interestAmount <= 0) {
            return null; // No interest to apply
        }
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        const newInterestAccrued = (account.interest_accrued ?? 0) + interestAmount;
        await this.db
            .update(loanAccounts)
            .set({
            interest_accrued: newInterestAccrued,
            updated_at: now,
        })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "INTEREST_APPLIED",
            entry_date: now,
            value_date: asOfDate,
            booking_date: now,
            amount: interestAmount,
            principal_amount: null,
            interest_amount: interestAmount,
            fees_amount: null,
            penalties_amount: null,
            balance_principal: account.principal_outstanding,
            balance_interest: newInterestAccrued,
            balance_fees: account.fees_outstanding,
            balance_total: (account.principal_outstanding ?? 0) +
                newInterestAccrued +
                (account.fees_outstanding ?? 0) +
                (account.penalties_outstanding ?? 0),
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: null,
            repayment_allocation: null,
            idempotency_key: null,
            actor,
            notes: `Interest accrual as of ${asOfDate}`,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_INTEREST_APPLIED",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: {
                    amount: interestAmount,
                    as_of_date: asOfDate,
                    transaction_id: txId,
                },
            });
        }
        return this.toApiTransaction(transaction);
    }
    async writeOff(id, notes, actor, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        // Must be in ACTIVE or ACTIVE_IN_ARREARS state
        if (!["ACTIVE", "ACTIVE_IN_ARREARS"].includes(account.state)) {
            throw new ValidationError(`Cannot write off loan in ${account.state} state. Must be ACTIVE or ACTIVE_IN_ARREARS.`);
        }
        const now = this.getNow();
        const txId = crypto.randomUUID();
        const txEncodedKey = crypto.randomUUID();
        const totalWrittenOff = (account.principal_outstanding ?? 0) +
            (account.interest_accrued ?? 0) +
            (account.fees_outstanding ?? 0) +
            (account.penalties_outstanding ?? 0);
        await this.db
            .update(loanAccounts)
            .set({
            state: "CLOSED",
            sub_state: "WRITTEN_OFF",
            principal_outstanding: 0,
            interest_accrued: 0,
            fees_outstanding: 0,
            penalties_outstanding: 0,
            closed_at: now,
            closed_by: actor,
            updated_at: now,
        })
            .where(eq(loanAccounts.id, id));
        const transaction = {
            id: txId,
            tenant_id: tenantId,
            encoded_key: txEncodedKey,
            loan_account_id: id,
            type: "WRITE_OFF",
            entry_date: now,
            value_date: now,
            booking_date: now,
            amount: totalWrittenOff,
            principal_amount: account.principal_outstanding,
            interest_amount: account.interest_accrued,
            fees_amount: account.fees_outstanding,
            penalties_amount: account.penalties_outstanding,
            balance_principal: 0,
            balance_interest: 0,
            balance_fees: 0,
            balance_total: 0,
            original_transaction_id: null,
            reversed_by_transaction_id: null,
            disbursement_details: null,
            repayment_allocation: null,
            idempotency_key: null,
            actor,
            notes,
            created_at: now,
        };
        await this.db.insert(loanTransactions).values(transaction);
        if (account.deal_id) {
            await this.audit.record({
                deal_id: account.deal_id,
                type: "LOAN_WRITTEN_OFF",
                actor,
                timestamp: now,
                object_type: "loan_account",
                object_id: id,
                metadata: {
                    amount: totalWrittenOff,
                    transaction_id: txId,
                },
            });
        }
        return this.toApiTransaction(transaction);
    }
    // ─── Queries ───────────────────────────────────────────────────────────────
    async getTransactions(id, options, tenantId = "default") {
        // Verify account exists
        await this.getByIdRaw(id, tenantId);
        let rows = await this.db
            .select()
            .from(loanTransactions)
            .where(eq(loanTransactions.loan_account_id, id));
        // Sort by created_at descending
        rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        // Apply cursor
        if (options?.cursor) {
            const idx = rows.findIndex((r) => r.id === options.cursor);
            if (idx >= 0) {
                rows = rows.slice(idx + 1);
            }
        }
        const total = rows.length;
        const limit = options?.limit ?? 50;
        let cursor;
        if (rows.length > limit) {
            rows = rows.slice(0, limit);
            cursor = rows[rows.length - 1]?.id;
        }
        return {
            transactions: rows.map((r) => this.toApiTransaction(r)),
            total,
            cursor,
        };
    }
    async getSchedule(id, tenantId = "default") {
        // Verify account exists
        await this.getByIdRaw(id, tenantId);
        const rows = await this.db
            .select()
            .from(repaymentSchedule)
            .where(eq(repaymentSchedule.loan_account_id, id));
        // Sort by installment number
        rows.sort((a, b) => a.installment_number - b.installment_number);
        return { schedule: rows };
    }
    async getBalance(id, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        return {
            principal_outstanding: account.principal_outstanding ?? 0,
            interest_accrued: account.interest_accrued ?? 0,
            fees_outstanding: account.fees_outstanding ?? 0,
            penalties_outstanding: account.penalties_outstanding ?? 0,
            total_outstanding: (account.principal_outstanding ?? 0) +
                (account.interest_accrued ?? 0) +
                (account.fees_outstanding ?? 0) +
                (account.penalties_outstanding ?? 0),
            principal_paid: account.principal_paid ?? 0,
            interest_paid: account.interest_paid ?? 0,
            total_paid: (account.principal_paid ?? 0) +
                (account.interest_paid ?? 0) +
                (account.fees_paid ?? 0) +
                (account.penalties_paid ?? 0),
        };
    }
    // ─── Arrears ───────────────────────────────────────────────────────────────
    async checkArrears(id, asOfDate, tenantId = "default") {
        await this.getByIdRaw(id, tenantId);
        const scheduleRows = await this.db
            .select()
            .from(repaymentSchedule)
            .where(eq(repaymentSchedule.loan_account_id, id));
        let overdueInstallments = 0;
        let overdueAmount = 0;
        let earliestOverdueDate = null;
        for (const installment of scheduleRows) {
            if (installment.due_date <= asOfDate && installment.state !== "PAID") {
                const amountDue = (installment.principal_due ?? 0) +
                    (installment.interest_due ?? 0) +
                    (installment.fees_due ?? 0) +
                    (installment.penalties_due ?? 0);
                const amountPaid = (installment.principal_paid ?? 0) +
                    (installment.interest_paid ?? 0) +
                    (installment.fees_paid ?? 0) +
                    (installment.penalties_paid ?? 0);
                const remaining = amountDue - amountPaid;
                if (remaining > 0) {
                    overdueInstallments++;
                    overdueAmount += remaining;
                    if (!earliestOverdueDate || installment.due_date < earliestOverdueDate) {
                        earliestOverdueDate = installment.due_date;
                    }
                }
            }
        }
        let daysInArrears = 0;
        if (earliestOverdueDate) {
            const overdueMs = new Date(asOfDate).getTime() - new Date(earliestOverdueDate).getTime();
            daysInArrears = Math.floor(overdueMs / (1000 * 60 * 60 * 24));
        }
        return {
            in_arrears: overdueInstallments > 0,
            days_in_arrears: Math.max(0, daysInArrears),
            arrears_since: earliestOverdueDate,
            overdue_installments: overdueInstallments,
            overdue_amount: overdueAmount,
        };
    }
    async updateArrearsStatus(id, asOfDate, tenantId = "default") {
        const account = await this.getByIdRaw(id, tenantId);
        // Only update if ACTIVE or ACTIVE_IN_ARREARS
        if (!["ACTIVE", "ACTIVE_IN_ARREARS"].includes(account.state)) {
            return;
        }
        const arrears = await this.checkArrears(id, asOfDate, tenantId);
        const newState = arrears.in_arrears ? "ACTIVE_IN_ARREARS" : "ACTIVE";
        await this.db
            .update(loanAccounts)
            .set({
            state: newState,
            days_in_arrears: arrears.days_in_arrears,
            arrears_since: arrears.arrears_since,
            updated_at: this.getNow(),
        })
            .where(eq(loanAccounts.id, id));
    }
    // ─── Helpers ───────────────────────────────────────────────────────────────
    async getByIdRaw(id, tenantId) {
        const rows = await this.db
            .select()
            .from(loanAccounts)
            .where(and(eq(loanAccounts.id, id), eq(loanAccounts.tenant_id, tenantId)));
        if (rows.length === 0) {
            throw new NotFoundError(`Loan account ${id} not found`);
        }
        return rows[0];
    }
    allocateRepayment(account, amount, customAllocation) {
        if (customAllocation) {
            // Validate custom allocation sums to amount
            const total = (customAllocation.principal ?? 0) +
                (customAllocation.interest ?? 0) +
                (customAllocation.fees ?? 0) +
                (customAllocation.penalties ?? 0);
            if (total !== amount) {
                throw new ValidationError(`Custom allocation total ${total} does not match payment amount ${amount}`);
            }
            return {
                principal: customAllocation.principal ?? 0,
                interest: customAllocation.interest ?? 0,
                fees: customAllocation.fees ?? 0,
                penalties: customAllocation.penalties ?? 0,
            };
        }
        // Default allocation order: penalties → fees → interest → principal
        let remaining = amount;
        const allocation = { principal: 0, interest: 0, fees: 0, penalties: 0 };
        // Penalties first
        const penaltiesOwed = account.penalties_outstanding ?? 0;
        if (remaining > 0 && penaltiesOwed > 0) {
            const penaltiesPay = Math.min(remaining, penaltiesOwed);
            allocation.penalties = penaltiesPay;
            remaining -= penaltiesPay;
        }
        // Fees second
        const feesOwed = account.fees_outstanding ?? 0;
        if (remaining > 0 && feesOwed > 0) {
            const feesPay = Math.min(remaining, feesOwed);
            allocation.fees = feesPay;
            remaining -= feesPay;
        }
        // Interest third
        const interestOwed = account.interest_accrued ?? 0;
        if (remaining > 0 && interestOwed > 0) {
            const interestPay = Math.min(remaining, interestOwed);
            allocation.interest = interestPay;
            remaining -= interestPay;
        }
        // Principal last
        const principalOwed = account.principal_outstanding ?? 0;
        if (remaining > 0 && principalOwed > 0) {
            const principalPay = Math.min(remaining, principalOwed);
            allocation.principal = principalPay;
            remaining -= principalPay;
        }
        // Any overpayment goes to principal (creates negative balance which we'll handle)
        if (remaining > 0) {
            allocation.principal += remaining;
        }
        return allocation;
    }
    calculateInterest(account, _asOfDate) {
        const principal = account.principal_outstanding ?? 0;
        const annualRate = account.interest_rate ?? 0;
        if (principal <= 0 || annualRate <= 0) {
            return 0;
        }
        // Simple daily interest calculation for now
        // In a real implementation, this would be more sophisticated
        const dailyRate = annualRate / 365;
        const dailyInterest = Math.round(principal * dailyRate);
        return dailyInterest;
    }
    async generateRepaymentSchedule(accountId, tenantId) {
        const account = await this.getByIdRaw(accountId, tenantId);
        if (!account.term_months || !account.first_repayment_date) {
            return; // Can't generate schedule without term and start date
        }
        const now = this.getNow();
        const principal = account.principal_disbursed ?? account.loan_amount;
        const annualRate = account.interest_rate ?? 0;
        const termMonths = account.term_months;
        const repaymentMethod = account.repayment_method ?? "EQUAL_INSTALLMENTS";
        const frequency = account.repayment_frequency ?? "MONTHLY";
        // Calculate number of installments based on frequency
        let installmentCount = termMonths;
        let monthsBetweenPayments = 1;
        switch (frequency) {
            case "QUARTERLY":
                installmentCount = Math.ceil(termMonths / 3);
                monthsBetweenPayments = 3;
                break;
            case "ANNUALLY":
                installmentCount = Math.ceil(termMonths / 12);
                monthsBetweenPayments = 12;
                break;
        }
        const installments = [];
        let startDate = new Date(account.first_repayment_date);
        let remainingPrincipal = principal;
        for (let i = 1; i <= installmentCount; i++) {
            const dueDate = new Date(startDate);
            dueDate.setMonth(startDate.getMonth() + (i - 1) * monthsBetweenPayments);
            let principalDue = 0;
            let interestDue = 0;
            if (repaymentMethod === "EQUAL_INSTALLMENTS") {
                // Calculate PMT (equal installments)
                const periodicRate = (annualRate * monthsBetweenPayments) / 12;
                if (periodicRate > 0) {
                    const pmt = (principal * periodicRate * Math.pow(1 + periodicRate, installmentCount)) /
                        (Math.pow(1 + periodicRate, installmentCount) - 1);
                    interestDue = Math.round(remainingPrincipal * periodicRate);
                    principalDue = Math.round(pmt - interestDue);
                }
                else {
                    principalDue = Math.round(principal / installmentCount);
                    interestDue = 0;
                }
            }
            else if (repaymentMethod === "INTEREST_ONLY") {
                interestDue = Math.round((remainingPrincipal * annualRate * monthsBetweenPayments) / 12);
                // Principal only on last installment
                principalDue = i === installmentCount ? remainingPrincipal : 0;
            }
            else if (repaymentMethod === "BALLOON") {
                interestDue = Math.round((remainingPrincipal * annualRate * monthsBetweenPayments) / 12);
                // Small amortization, bulk at end
                const regularPrincipal = Math.round(principal * 0.1 / (installmentCount - 1));
                principalDue = i === installmentCount
                    ? remainingPrincipal
                    : regularPrincipal;
            }
            // Ensure last installment covers remaining principal
            if (i === installmentCount) {
                principalDue = remainingPrincipal;
            }
            remainingPrincipal -= principalDue;
            installments.push({
                id: crypto.randomUUID(),
                loan_account_id: accountId,
                installment_number: i,
                encoded_key: crypto.randomUUID(),
                due_date: dueDate.toISOString().split("T")[0],
                principal_due: principalDue,
                interest_due: interestDue,
                fees_due: 0,
                penalties_due: 0,
                principal_paid: 0,
                interest_paid: 0,
                fees_paid: 0,
                penalties_paid: 0,
                state: "PENDING",
                last_payment_date: null,
                created_at: now,
                updated_at: null,
            });
        }
        if (installments.length > 0) {
            await this.db.insert(repaymentSchedule).values(installments);
        }
    }
    async applyRepaymentToSchedule(accountId, allocation, valueDate, tenantId) {
        const scheduleRows = await this.db
            .select()
            .from(repaymentSchedule)
            .where(eq(repaymentSchedule.loan_account_id, accountId));
        // Sort by due date
        scheduleRows.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        let remainingPrincipal = allocation.principal;
        let remainingInterest = allocation.interest;
        let remainingFees = allocation.fees;
        let remainingPenalties = allocation.penalties;
        const now = this.getNow();
        for (const installment of scheduleRows) {
            if (remainingPrincipal <= 0 &&
                remainingInterest <= 0 &&
                remainingFees <= 0 &&
                remainingPenalties <= 0) {
                break;
            }
            const principalRemaining = (installment.principal_due ?? 0) - (installment.principal_paid ?? 0);
            const interestRemaining = (installment.interest_due ?? 0) - (installment.interest_paid ?? 0);
            const feesRemaining = (installment.fees_due ?? 0) - (installment.fees_paid ?? 0);
            const penaltiesRemaining = (installment.penalties_due ?? 0) - (installment.penalties_paid ?? 0);
            // Skip fully paid installments
            if (principalRemaining <= 0 &&
                interestRemaining <= 0 &&
                feesRemaining <= 0 &&
                penaltiesRemaining <= 0) {
                continue;
            }
            // Apply payments to this installment
            const principalApply = Math.min(remainingPrincipal, principalRemaining);
            const interestApply = Math.min(remainingInterest, interestRemaining);
            const feesApply = Math.min(remainingFees, feesRemaining);
            const penaltiesApply = Math.min(remainingPenalties, penaltiesRemaining);
            remainingPrincipal -= principalApply;
            remainingInterest -= interestApply;
            remainingFees -= feesApply;
            remainingPenalties -= penaltiesApply;
            const newPrincipalPaid = (installment.principal_paid ?? 0) + principalApply;
            const newInterestPaid = (installment.interest_paid ?? 0) + interestApply;
            const newFeesPaid = (installment.fees_paid ?? 0) + feesApply;
            const newPenaltiesPaid = (installment.penalties_paid ?? 0) + penaltiesApply;
            // Determine new state
            const totalDue = (installment.principal_due ?? 0) +
                (installment.interest_due ?? 0) +
                (installment.fees_due ?? 0) +
                (installment.penalties_due ?? 0);
            const totalPaid = newPrincipalPaid + newInterestPaid + newFeesPaid + newPenaltiesPaid;
            let newState = installment.state;
            if (totalPaid >= totalDue) {
                newState = "PAID";
            }
            else if (totalPaid > 0) {
                newState = "PARTIALLY_PAID";
            }
            await this.db
                .update(repaymentSchedule)
                .set({
                principal_paid: newPrincipalPaid,
                interest_paid: newInterestPaid,
                fees_paid: newFeesPaid,
                penalties_paid: newPenaltiesPaid,
                state: newState,
                last_payment_date: valueDate,
                updated_at: now,
            })
                .where(eq(repaymentSchedule.id, installment.id));
        }
    }
    async checkArrearsCleared(accountId, tenantId) {
        const scheduleRows = await this.db
            .select()
            .from(repaymentSchedule)
            .where(eq(repaymentSchedule.loan_account_id, accountId));
        const now = this.getNow().split("T")[0]; // Get date part
        for (const installment of scheduleRows) {
            if (installment.due_date <= now && installment.state !== "PAID") {
                const remaining = (installment.principal_due ?? 0) +
                    (installment.interest_due ?? 0) +
                    (installment.fees_due ?? 0) +
                    (installment.penalties_due ?? 0) -
                    ((installment.principal_paid ?? 0) +
                        (installment.interest_paid ?? 0) +
                        (installment.fees_paid ?? 0) +
                        (installment.penalties_paid ?? 0));
                if (remaining > 0) {
                    return false;
                }
            }
        }
        return true;
    }
    // ─── API Response Helpers ──────────────────────────────────────────────────
    toApiLoanAccount(row) {
        return {
            id: row.id,
            encoded_key: row.encoded_key,
            account_id: row.account_id,
            deal_id: row.deal_id,
            facility_id: row.facility_id,
            account_holder_type: row.account_holder_type,
            account_holder_id: row.account_holder_id,
            state: row.state,
            sub_state: row.sub_state,
            loan_amount: row.loan_amount,
            currency: row.currency,
            interest_rate: row.interest_rate,
            interest_rate_type: row.interest_rate_type,
            interest_rate_spread: row.interest_rate_spread,
            interest_calculation_method: row.interest_calculation_method,
            repayment_method: row.repayment_method,
            repayment_frequency: row.repayment_frequency,
            term_months: row.term_months,
            grace_period_days: row.grace_period_days,
            first_repayment_date: row.first_repayment_date,
            principal_disbursed: row.principal_disbursed,
            principal_outstanding: row.principal_outstanding,
            principal_paid: row.principal_paid,
            interest_accrued: row.interest_accrued,
            interest_paid: row.interest_paid,
            fees_outstanding: row.fees_outstanding,
            fees_paid: row.fees_paid,
            penalties_outstanding: row.penalties_outstanding,
            penalties_paid: row.penalties_paid,
            days_in_arrears: row.days_in_arrears,
            arrears_since: row.arrears_since,
            approved_at: row.approved_at,
            approved_by: row.approved_by,
            disbursed_at: row.disbursed_at,
            disbursed_by: row.disbursed_by,
            closed_at: row.closed_at,
            closed_by: row.closed_by,
            locked_at: row.locked_at,
            custom_fields: row.custom_fields,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }
    toApiTransaction(row) {
        return {
            id: row.id,
            encoded_key: row.encoded_key,
            loan_account_id: row.loan_account_id,
            type: row.type,
            entry_date: row.entry_date,
            value_date: row.value_date,
            booking_date: row.booking_date,
            amount: row.amount,
            principal_amount: row.principal_amount,
            interest_amount: row.interest_amount,
            fees_amount: row.fees_amount,
            penalties_amount: row.penalties_amount,
            balance_principal: row.balance_principal,
            balance_interest: row.balance_interest,
            balance_fees: row.balance_fees,
            balance_total: row.balance_total,
            original_transaction_id: row.original_transaction_id,
            reversed_by_transaction_id: row.reversed_by_transaction_id,
            disbursement_details: row.disbursement_details,
            repayment_allocation: row.repayment_allocation,
            idempotency_key: row.idempotency_key,
            actor: row.actor,
            notes: row.notes,
            created_at: row.created_at,
        };
    }
}
//# sourceMappingURL=loan-account.js.map