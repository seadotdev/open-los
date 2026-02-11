/**
 * Mambu API v2 common types — derived from openapi/mambu-v2.yaml
 */

export interface Address {
  encodedKey?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
  parentKey?: string;
  indexInList?: number;
}

export interface IdentificationDocument {
  encodedKey?: string;
  documentId?: string;
  documentType?: string;
  identificationDocumentTemplateKey?: string;
  issuingAuthority?: string;
  validUntil?: string;
  indexInList?: number;
  attachments?: Array<{
    encodedKey?: string;
    fileName?: string;
    fileSize?: number;
    name?: string;
    type?: string;
  }>;
}

export interface ErrorResponse {
  errors: Array<{
    errorCode: number;
    errorSource: string;
    errorReason: string;
  }>;
}

export interface FilterCriterion {
  field: string;
  operator:
    | "EQUALS"
    | "EQUALS_CASE_SENSITIVE"
    | "DIFFERENT_THAN"
    | "MORE_THAN"
    | "LESS_THAN"
    | "BETWEEN"
    | "ON"
    | "AFTER"
    | "AFTER_INCLUSIVE"
    | "BEFORE"
    | "BEFORE_INCLUSIVE"
    | "STARTS_WITH"
    | "STARTS_WITH_CASE_SENSITIVE"
    | "IN"
    | "TODAY"
    | "THIS_WEEK"
    | "THIS_MONTH"
    | "THIS_YEAR"
    | "LAST_DAYS"
    | "EMPTY"
    | "NOT_EMPTY";
  value?: string;
  secondValue?: string;
  values?: string[];
}

export interface SortingCriteria {
  field: string;
  order: "ASC" | "DESC";
}

export interface SearchCriteria {
  filterCriteria?: FilterCriterion[];
  sortingCriteria?: SortingCriteria;
}

export interface PatchOperation {
  op: "ADD" | "REPLACE" | "REMOVE" | "MOVE";
  path: string;
  from?: string;
  value?: unknown;
}

export type DetailsLevel = "BASIC" | "FULL";
export type PaginationDetails = "ON" | "OFF";
