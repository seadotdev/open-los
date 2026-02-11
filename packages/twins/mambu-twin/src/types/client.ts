import type { Address, IdentificationDocument } from "./common.js";

export type ClientState =
  | "PENDING_APPROVAL"
  | "INACTIVE"
  | "ACTIVE"
  | "EXITED"
  | "BLACKLISTED"
  | "REJECTED";

export interface Client {
  encodedKey: string;
  id: string;
  state: ClientState;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender?: "MALE" | "FEMALE";
  birthDate?: string;
  emailAddress?: string;
  mobilePhone?: string;
  mobilePhone2?: string;
  homePhone?: string;
  preferredLanguage?: string;
  notes?: string;
  clientRoleKey?: string;
  assignedBranchKey?: string;
  assignedCentreKey?: string;
  assignedUserKey?: string;
  groupKeys?: string[];
  addresses?: Address[];
  idDocuments?: IdentificationDocument[];
  profilePictureKey?: string;
  profileSignatureKey?: string;
  loanCycle: number;
  groupLoanCycle: number;
  activationDate?: string;
  approvedDate?: string;
  closedDate?: string;
  creationDate: string;
  lastModifiedDate: string;
  _customFieldValues?: Record<string, unknown>;
}

export interface CreateClientInput {
  id?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender?: "MALE" | "FEMALE";
  birthDate?: string;
  emailAddress?: string;
  mobilePhone?: string;
  mobilePhone2?: string;
  homePhone?: string;
  preferredLanguage?: string;
  notes?: string;
  clientRoleKey?: string;
  assignedBranchKey?: string;
  assignedCentreKey?: string;
  assignedUserKey?: string;
  addresses?: Address[];
  idDocuments?: IdentificationDocument[];
}
