import { describe, it, expect } from "vitest";
import {
  suggestEntityMapping,
  suggestFieldMapping,
  generateMappingProposal,
  STAGE_NORMALIZATION,
} from "./mapping-engine.js";
import type { ExternalObjectSchema, ExternalFieldSchema } from "./types.js";

describe("suggestEntityMapping", () => {
  it("maps Salesforce Opportunity to deals", () => {
    const schema: ExternalObjectSchema = {
      apiName: "Opportunity",
      label: "Opportunity",
      fields: [],
    };
    const result = suggestEntityMapping(schema);
    expect(result).not.toBeNull();
    expect(result!.entity).toBe("deals");
    expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("maps HubSpot deals to deals", () => {
    const schema: ExternalObjectSchema = {
      apiName: "deals",
      label: "Deals",
      fields: [],
    };
    const result = suggestEntityMapping(schema);
    expect(result).not.toBeNull();
    expect(result!.entity).toBe("deals");
  });

  it("maps Salesforce Account to entities", () => {
    const schema: ExternalObjectSchema = {
      apiName: "Account",
      label: "Account",
      fields: [],
    };
    const result = suggestEntityMapping(schema);
    expect(result).not.toBeNull();
    expect(result!.entity).toBe("entities");
  });

  it("maps nCino Loan to deals", () => {
    const schema: ExternalObjectSchema = {
      apiName: "LLC_BI__Loan__c",
      label: "Loan",
      fields: [],
    };
    const result = suggestEntityMapping(schema);
    expect(result).not.toBeNull();
    expect(result!.entity).toBe("deals");
    expect(result!.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("maps nCino Covenant to covenants", () => {
    const schema: ExternalObjectSchema = {
      apiName: "LLC_BI__Covenant2__c",
      label: "Covenant",
      fields: [],
    };
    const result = suggestEntityMapping(schema);
    expect(result).not.toBeNull();
    expect(result!.entity).toBe("covenants");
  });

  it("returns null for unknown objects without matching fields", () => {
    const schema: ExternalObjectSchema = {
      apiName: "CompletelyUnknownObject__c",
      label: "Unknown",
      fields: [],
    };
    const result = suggestEntityMapping(schema);
    expect(result).toBeNull();
  });

  it("infers entity from field patterns for unknown objects", () => {
    const schema: ExternalObjectSchema = {
      apiName: "CustomLoanApp__c",
      label: "Custom Loan Application",
      fields: [
        { apiName: "Borrower_Name__c", label: "Borrower Name", externalType: "string", dataType: "string", required: true, isCustom: true },
        { apiName: "Loan_Amount__c", label: "Loan Amount", externalType: "currency", dataType: "currency", required: true, isCustom: true },
        { apiName: "Purpose__c", label: "Purpose", externalType: "string", dataType: "string", required: false, isCustom: true },
        { apiName: "Stage__c", label: "Stage", externalType: "picklist", dataType: "picklist", required: false, isCustom: true },
      ],
    };
    const result = suggestEntityMapping(schema);
    expect(result).not.toBeNull();
    expect(result!.entity).toBe("deals");
  });
});

describe("suggestFieldMapping", () => {
  it("maps Salesforce Amount to deals.requested_amount", () => {
    const field: ExternalFieldSchema = {
      apiName: "Amount",
      label: "Amount",
      externalType: "currency",
      dataType: "currency",
      required: false,
      isCustom: false,
    };
    const result = suggestFieldMapping(field);
    expect(result).not.toBeNull();
    expect(result!.targetEntity).toBe("deals");
    expect(result!.targetField).toBe("requested_amount");
    expect(result!.transform).toBe("to_minor_units");
  });

  it("maps Salesforce StageName to deals.stage with normalize transform", () => {
    const field: ExternalFieldSchema = {
      apiName: "StageName",
      label: "Stage",
      externalType: "picklist",
      dataType: "picklist",
      required: true,
      isCustom: false,
    };
    const result = suggestFieldMapping(field);
    expect(result).not.toBeNull();
    expect(result!.targetEntity).toBe("deals");
    expect(result!.targetField).toBe("stage");
    expect(result!.transform).toBe("stage_normalize");
  });

  it("maps HubSpot dealname to deals.borrower_name", () => {
    const field: ExternalFieldSchema = {
      apiName: "dealname",
      label: "Deal Name",
      externalType: "string",
      dataType: "string",
      required: true,
      isCustom: false,
    };
    const result = suggestFieldMapping(field);
    expect(result).not.toBeNull();
    expect(result!.targetEntity).toBe("deals");
    expect(result!.targetField).toBe("borrower_name");
  });

  it("maps nCino Amount__c to deals.requested_amount", () => {
    const field: ExternalFieldSchema = {
      apiName: "LLC_BI__Amount__c",
      label: "Amount",
      externalType: "currency",
      dataType: "currency",
      required: false,
      isCustom: true,
    };
    const result = suggestFieldMapping(field);
    expect(result).not.toBeNull();
    expect(result!.targetField).toBe("requested_amount");
  });

  it("maps Account.Name to entities.name", () => {
    const field: ExternalFieldSchema = {
      apiName: "Name",
      label: "Account Name",
      externalType: "string",
      dataType: "string",
      required: true,
      isCustom: false,
    };
    const result = suggestFieldMapping(field);
    expect(result).not.toBeNull();
    // Name matches multiple patterns — it should match something
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it("maps interest rate fields to facilities", () => {
    const field: ExternalFieldSchema = {
      apiName: "LLC_BI__InterestRate__c",
      label: "Interest Rate",
      externalType: "percent",
      dataType: "percentage",
      required: false,
      isCustom: true,
    };
    const result = suggestFieldMapping(field);
    expect(result).not.toBeNull();
    expect(result!.targetEntity).toBe("facilities");
    expect(result!.targetField).toBe("interest_rate_value");
  });

  it("returns null for unrecognized fields", () => {
    const field: ExternalFieldSchema = {
      apiName: "XYZ_Random_Field__c",
      label: "Some Random Custom Field",
      externalType: "string",
      dataType: "string",
      required: false,
      isCustom: true,
    };
    const result = suggestFieldMapping(field);
    expect(result).toBeNull();
  });
});

describe("generateMappingProposal", () => {
  it("generates mappings for a Salesforce Opportunity", () => {
    const schema: ExternalObjectSchema = {
      apiName: "Opportunity",
      label: "Opportunity",
      fields: [
        { apiName: "Id", label: "Record ID", externalType: "id", dataType: "string", required: true, isCustom: false },
        { apiName: "Name", label: "Opportunity Name", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "Amount", label: "Amount", externalType: "currency", dataType: "currency", required: false, isCustom: false },
        { apiName: "StageName", label: "Stage", externalType: "picklist", dataType: "picklist", required: true, isCustom: false },
        { apiName: "Description", label: "Description", externalType: "textarea", dataType: "textarea", required: false, isCustom: false },
      ],
    };

    const mappings = generateMappingProposal("conn-1", schema, "deals");
    expect(mappings.length).toBeGreaterThan(0);

    // Should have Amount → requested_amount
    const amountMapping = mappings.find((m) => m.sourceField === "Amount");
    expect(amountMapping).toBeDefined();
    expect(amountMapping!.targetField).toBe("requested_amount");

    // Should have StageName → stage
    const stageMapping = mappings.find((m) => m.sourceField === "StageName");
    expect(stageMapping).toBeDefined();
    expect(stageMapping!.targetField).toBe("stage");
    expect(stageMapping!.transform?.type).toBe("stage_normalize");
  });
});

describe("STAGE_NORMALIZATION", () => {
  it("normalizes common CRM stages to Open LOS stages", () => {
    expect(STAGE_NORMALIZATION["prospecting"]).toBe("broker");
    expect(STAGE_NORMALIZATION["qualification"]).toBe("broker");
    expect(STAGE_NORMALIZATION["application"]).toBe("origination");
    expect(STAGE_NORMALIZATION["credit review"]).toBe("underwriting");
    expect(STAGE_NORMALIZATION["approved"]).toBe("closing");
    expect(STAGE_NORMALIZATION["funded"]).toBe("monitoring");
    expect(STAGE_NORMALIZATION["closed won"]).toBe("monitoring");
  });

  it("maps rejected/lost stages", () => {
    expect(STAGE_NORMALIZATION["closed lost"]).toBe("broker");
    expect(STAGE_NORMALIZATION["declined"]).toBe("broker");
    expect(STAGE_NORMALIZATION["withdrawn"]).toBe("broker");
  });
});
