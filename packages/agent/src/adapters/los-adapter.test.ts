import { describe, expect, it, vi } from "vitest";
import { createAgentServices } from "./los-adapter.js";

describe("createAgentServices", () => {
  it("forwards document content from agent uploads as content_base64", async () => {
    const upload = vi.fn(async () => ({ id: "doc_1" }));

    const services = createAgentServices(
      {
        dealService: {
          getById: async () => ({ id: "deal_1" }),
          create: async () => ({ id: "deal_1" }),
          list: async () => ({ deals: [] }),
        },
        documentService: {
          upload,
          listByDeal: async () => [],
          getContent: async () => null,
        },
        stageService: {
          transition: async () => ({}),
          listByDeal: async () => [],
        },
        entityService: {
          create: async () => ({ id: "ent_1" }),
        },
        relationshipService: {
          getBorrowerGroup: async () => ({ entities: [], relationships: [] }),
        },
        spreadService: {
          create: async () => ({}),
          getRatios: async () => ({ ratios: [] }),
        },
        covenantService: {
          list: async () => ({ covenants: [] }),
        },
        facilityService: {
          create: async () => ({ id: "fac_1" }),
        },
        loanAccountService: {
          create: async () => ({ id: "loan_1" }),
        },
        monitoringService: {
          ingest: async () => ({}),
          getStatus: async () => ({}),
        },
        auditService: {
          listByDeal: async () => ({ events: [] }),
        },
      },
      { tenantId: "tenant_1", actor: "agent:test" }
    );

    await services.documents.create({
      deal_id: "deal_1",
      doc_type: "bank_statement",
      filename: "statement.csv",
      content: "YmFzZTY0LWNvbnRlbnQ=",
    });

    expect(upload).toHaveBeenCalledWith(
      "deal_1",
      expect.objectContaining({
        doc_type: "bank_statement",
        filename: "statement.csv",
        content_base64: "YmFzZTY0LWNvbnRlbnQ=",
      }),
      "agent:test",
      "tenant_1"
    );
  });
});
