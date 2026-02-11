export type CreditArrangementState =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ACTIVE"
  | "CLOSED"
  | "WITHDRAWN"
  | "REJECTED";

export interface CreditArrangement {
  encodedKey: string;
  id: string;
  creditArrangementName: string;
  amount: number;
  state: CreditArrangementState;
  subState?: string;
  startDate?: string;
  endDate?: string;
  expireDate?: string;
  closedDate?: string;
  notes?: string;
  holderType: "CLIENT" | "GROUP";
  holderKey: string;
  assignedBranchKey?: string;
  assignedCentreKey?: string;
  assignedUserKey?: string;
  availableCreditAmount?: number;
  consumedCreditAmount?: number;
  creationDate: string;
  lastModifiedDate: string;
}

export interface CreateCreditArrangementInput {
  id?: string;
  creditArrangementName: string;
  amount: number;
  holderType: "CLIENT" | "GROUP";
  holderKey: string;
  startDate?: string;
  endDate?: string;
  expireDate?: string;
  notes?: string;
  assignedBranchKey?: string;
  assignedCentreKey?: string;
  assignedUserKey?: string;
}
