import { describe, expect, it, vi } from "vitest";
import { handleDocumentUpload } from "./documents.js";

describe("handleDocumentUpload", () => {
  it("maps MCP content to the core document service content_base64 field", async () => {
    const upload = vi.fn(async () => ({ id: "doc_1" }));

    const result = await handleDocumentUpload(
      {
        documentService: {
          upload,
        },
      } as any,
      {
        deal_id: "deal_1",
        doc_type: "bank_statement",
        filename: "statement.csv",
        content: "YmFzZTY0LWRvYw==",
        tenant_id: "tenant_1",
        actor: "mcp-agent",
      }
    );

    expect(upload).toHaveBeenCalledWith(
      "deal_1",
      expect.objectContaining({
        doc_type: "bank_statement",
        filename: "statement.csv",
        content_base64: "YmFzZTY0LWRvYw==",
      }),
      "mcp-agent",
      "tenant_1"
    );
    expect(result).toEqual({ id: "doc_1" });
  });
});
