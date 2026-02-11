export type LoanTransactionType =
  | "IMPORT"
  | "DISBURSEMENT"
  | "DISBURSEMENT_ADJUSTMENT"
  | "WRITE_OFF"
  | "WRITE_OFF_ADJUSTMENT"
  | "REPAYMENT"
  | "PAYMENT_MADE"
  | "WITHDRAWAL_REDRAW"
  | "WITHDRAWAL_REDRAW_ADJUSTMENT"
  | "FEE_APPLIED"
  | "FEE_CHARGED"
  | "FEE_CAPITALISED"
  | "FEE_ADJUSTMENT"
  | "FEE_CAPITALISED_ADJUSTMENT"
  | "PENALTY_APPLIED"
  | "PENALTY_ADJUSTMENT"
  | "INTEREST_APPLIED"
  | "INTEREST_APPLIED_ADJUSTMENT"
  | "TRANSFER"
  | "TRANSFER_ADJUSTMENT"
  | "BRANCH_CHANGED"
  | "TERMS_CHANGED"
  | "REFUND"
  | "REFUND_ADJUSTMENT"
  | "PRINCIPAL_OVERPAYMENT"
  | "PRINCIPAL_OVERPAYMENT_ADJUSTMENT"
  | "REDRAW_REPAYMENT"
  | "REDRAW_REPAYMENT_ADJUSTMENT"
  | "REDRAW_TRANSFER"
  | "REDRAW_TRANSFER_ADJUSTMENT"
  | "INTEREST_LOCKED"
  | "INTEREST_UNLOCKED"
  | "FEE_LOCKED"
  | "FEE_UNLOCKED"
  | "PENALTY_LOCKED"
  | "PENALTY_UNLOCKED"
  | "CARD_TRANSACTION_REVERSAL"
  | "CARD_TRANSACTION_REVERSAL_ADJUSTMENT"
  | "SCHEDULE_FIX_APPLIED"
  | "ACCOUNT_TERMINATED"
  | "ACCOUNT_TERMINATED_ADJUSTMENT";

export interface AffectedAmounts {
  principalAmount: number;
  interestAmount: number;
  feesAmount: number;
  penaltyAmount: number;
  fundsAmount: number;
  fractionAmount: number;
  overdraftAmount: number;
  overdraftFeesAmount: number;
  overdraftInterestAmount: number;
  technicalOverdraftAmount: number;
  technicalOverdraftInterestAmount: number;
}

export interface AccountBalancesSnapshot {
  principalBalance: number;
  redrawBalance: number;
  totalBalance: number;
  advancePosition: number;
  arrearsPosition: number;
  expectedPrincipalRedraw: number;
}

export interface LoanTransaction {
  encodedKey: string;
  id: string;
  externalId?: string;
  type: LoanTransactionType;
  amount: number;
  valueDate: string;
  bookingDate: string;
  creationDate: string;
  parentAccountKey: string;
  affectedAmounts: AffectedAmounts;
  accountBalances: AccountBalancesSnapshot;
  taxes?: {
    taxRate?: number;
    deferredTaxOnInterestAmount?: number;
    taxOnFeesAmount?: number;
    taxOnInterestAmount?: number;
    taxOnInterestFromArrearsAmount?: number;
    taxOnPenaltyAmount?: number;
  };
  terms?: {
    interestSettings?: {
      interestRate?: number;
      indexInterestRate?: number;
      interestSpread?: number;
    };
  };
  fees?: Array<{
    name?: string;
    amount?: number;
    predefinedFeeKey?: string;
    trigger?: string;
    taxAmount?: number;
  }>;
  transactionDetails?: {
    transactionChannelId?: string;
    transactionChannelKey?: string;
  };
  transferDetails?: {
    linkedLoanTransactionKey?: string;
    linkedDepositTransactionKey?: string;
  };
  originalTransactionKey?: string;
  adjustmentTransactionKey?: string;
  notes?: string;
  userKey?: string;
  branchKey?: string;
  centreKey?: string;
  migrationEventKey?: string;
}

export interface DisbursementInput {
  amount?: number;
  notes?: string;
  valueDate?: string;
  bookingDate?: string;
  externalId?: string;
  transactionDetails?: {
    transactionChannelId?: string;
    transactionChannelKey?: string;
  };
  firstRepaymentDate?: string;
  fees?: Array<{ predefinedFeeEncodedKey?: string; amount?: number }>;
}

export interface RepaymentInput {
  amount: number;
  notes?: string;
  valueDate?: string;
  bookingDate?: string;
  externalId?: string;
  transactionDetails?: {
    transactionChannelId?: string;
    transactionChannelKey?: string;
  };
  prepaymentRecalculationMethod?: string;
}

export interface FeeInput {
  amount: number;
  notes?: string;
  valueDate?: string;
  bookingDate?: string;
  externalId?: string;
  predefinedFeeKey?: string;
  installmentNumber?: number;
}
