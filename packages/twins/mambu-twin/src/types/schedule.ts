export type InstallmentState =
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "LATE"
  | "GRACE_PERIOD"
  | "DUE"
  | "OVERDUE";

export interface ScheduleEntry {
  encodedKey: string;
  parentAccountKey: string;
  installmentNumber: number;
  dueDate: string;
  state: InstallmentState;
  principalDue: number;
  principalPaid: number;
  interestDue: number;
  interestPaid: number;
  feesDue: number;
  feesPaid: number;
  penaltyDue: number;
  penaltyPaid: number;
  lastPaidDate?: string;
}

export interface LoanSchedule {
  installments: ScheduleEntry[];
  currency?: {
    code: string;
    digitsAfterDecimal: number;
  };
}
