import type { Database } from "../schema/db.js";
import type { LoanAccountService } from "./loan-account.js";
export interface CreateLoanFromFacilityInput {
    facility_id: string;
    deal_id: string;
    account_holder_id: string;
    first_repayment_date?: string;
    repayment_frequency?: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
    grace_period_days?: number;
    custom_fields?: Record<string, unknown>;
}
/**
 * Creates a loan account from an approved facility.
 * This should be called when a facility transitions to 'approved' or 'active' status.
 *
 * @param db Database instance
 * @param loanAccountService LoanAccountService instance
 * @param input Configuration for creating the loan
 * @param actor The user/system creating the loan
 * @param tenantId Tenant ID
 * @returns The created loan account
 */
export declare function createLoanAccountFromFacility(db: Database, loanAccountService: LoanAccountService, input: CreateLoanFromFacilityInput, actor: string, tenantId?: string): Promise<{
    id: string;
    encoded_key: string;
    account_id: string;
    deal_id: string | null;
    facility_id: string | null;
    account_holder_type: string;
    account_holder_id: string;
    state: string;
    sub_state: string | null;
    loan_amount: number;
    currency: string;
    interest_rate: number | null;
    interest_rate_type: string | null;
    interest_rate_spread: number | null;
    interest_calculation_method: string | null;
    repayment_method: string | null;
    repayment_frequency: string | null;
    term_months: number | null;
    grace_period_days: number | null;
    first_repayment_date: string | null;
    principal_disbursed: number | null;
    principal_outstanding: number | null;
    principal_paid: number | null;
    interest_accrued: number | null;
    interest_paid: number | null;
    fees_outstanding: number | null;
    fees_paid: number | null;
    penalties_outstanding: number | null;
    penalties_paid: number | null;
    days_in_arrears: number | null;
    arrears_since: string | null;
    approved_at: string | null;
    approved_by: string | null;
    disbursed_at: string | null;
    disbursed_by: string | null;
    closed_at: string | null;
    closed_by: string | null;
    locked_at: string | null;
    custom_fields: unknown;
    created_at: string;
    updated_at: string | null;
}>;
/**
 * Helper to auto-approve a loan account after creation (for streamlined workflow)
 */
export declare function approveLoanAccount(loanAccountService: LoanAccountService, loanAccountId: string, notes: string, actor: string, tenantId?: string): Promise<{
    id: string;
    encoded_key: string;
    loan_account_id: string;
    type: string;
    entry_date: string;
    value_date: string;
    booking_date: string | null;
    amount: number;
    principal_amount: number | null;
    interest_amount: number | null;
    fees_amount: number | null;
    penalties_amount: number | null;
    balance_principal: number | null;
    balance_interest: number | null;
    balance_fees: number | null;
    balance_total: number | null;
    original_transaction_id: string | null;
    reversed_by_transaction_id: string | null;
    disbursement_details: unknown;
    repayment_allocation: unknown;
    idempotency_key: string | null;
    actor: string;
    notes: string | null;
    created_at: string;
}>;
/**
 * Full workflow: Create and approve loan from facility
 * Use this when the facility has been approved and you want to immediately
 * create an approved loan account ready for disbursement.
 */
export declare function createApprovedLoanFromFacility(db: Database, loanAccountService: LoanAccountService, input: CreateLoanFromFacilityInput, approvalNotes: string, actor: string, tenantId?: string): Promise<{
    id: string;
    encoded_key: string;
    account_id: string;
    deal_id: string | null;
    facility_id: string | null;
    account_holder_type: string;
    account_holder_id: string;
    state: string;
    sub_state: string | null;
    loan_amount: number;
    currency: string;
    interest_rate: number | null;
    interest_rate_type: string | null;
    interest_rate_spread: number | null;
    interest_calculation_method: string | null;
    repayment_method: string | null;
    repayment_frequency: string | null;
    term_months: number | null;
    grace_period_days: number | null;
    first_repayment_date: string | null;
    principal_disbursed: number | null;
    principal_outstanding: number | null;
    principal_paid: number | null;
    interest_accrued: number | null;
    interest_paid: number | null;
    fees_outstanding: number | null;
    fees_paid: number | null;
    penalties_outstanding: number | null;
    penalties_paid: number | null;
    days_in_arrears: number | null;
    arrears_since: string | null;
    approved_at: string | null;
    approved_by: string | null;
    disbursed_at: string | null;
    disbursed_by: string | null;
    closed_at: string | null;
    closed_by: string | null;
    locked_at: string | null;
    custom_fields: unknown;
    created_at: string;
    updated_at: string | null;
}>;
/**
 * Get loan balance for covenant testing
 * Returns the total outstanding balance for a loan associated with a deal
 */
export declare function getLoanBalanceForDeal(loanAccountService: LoanAccountService, dealId: string, tenantId?: string): Promise<{
    total_outstanding: number;
    principal_outstanding: number;
}>;
/**
 * Check arrears for all loans in a deal
 * Returns arrears status aggregated across all loans
 */
export declare function checkDealArrearsStatus(loanAccountService: LoanAccountService, dealId: string, asOfDate: string, tenantId?: string): Promise<{
    any_in_arrears: boolean;
    max_days_in_arrears: number;
    total_overdue_amount: number;
    accounts_in_arrears: number;
}>;
//# sourceMappingURL=loan-integration.d.ts.map