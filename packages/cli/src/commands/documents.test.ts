import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const uploadDocument = vi.fn();

vi.mock("../client.js", () => ({
  getClient: () => ({
    uploadDocument,
    listDocuments: vi.fn(),
  }),
}));

describe("registerDocumentCommands", () => {
  let tempDir: string;

  beforeEach(() => {
    uploadDocument.mockReset();
    tempDir = mkdtempSync(join(tmpdir(), "open-los-cli-docs-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("uploads base64 content with inferred mime type", async () => {
    const filePath = join(tempDir, "statement.csv");
    writeFileSync(filePath, "date,amount\n2026-01-15,12345\n", "utf8");
    uploadDocument.mockResolvedValue({ id: "doc_1" });

    const { registerDocumentCommands } = await import("./documents.js");
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    const program = new Command();
    program
      .exitOverride()
      .option("--api-url <url>")
      .option("--actor <id>")
      .option("--tenant-id <id>")
      .option("--format <format>", "Output format", "json");

    registerDocumentCommands(program);

    await program.parseAsync(
      [
        "node",
        "los",
        "document",
        "upload",
        "deal_1",
        "--file",
        filePath,
        "--type",
        "bank_statement",
      ],
      { from: "node" }
    );

    expect(uploadDocument).toHaveBeenCalledWith(
      "deal_1",
      expect.objectContaining({
        doc_type: "bank_statement",
        filename: "statement.csv",
        mime_type: "text/csv",
        content: Buffer.from("date,amount\n2026-01-15,12345\n").toString("base64"),
      })
    );

    stdout.mockRestore();
    stderr.mockRestore();
  });
});
