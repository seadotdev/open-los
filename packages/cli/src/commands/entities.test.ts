import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const resolveEntity = vi.fn();

vi.mock("../client.js", () => ({
  getClient: () => ({
    resolveEntity,
  }),
}));

describe("registerEntityCommands", () => {
  beforeEach(() => {
    resolveEntity.mockReset();
  });

  it("passes entity resolution queries through the CLI client", async () => {
    resolveEntity.mockResolvedValue({
      candidates: [{ entity_id: "entity_1", score: 1 }],
    });

    const { registerEntityCommands } = await import("./entities.js");
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    const program = new Command();
    program
      .exitOverride()
      .option("--api-url <url>")
      .option("--actor <id>")
      .option("--tenant-id <id>")
      .option("--format <format>", "Output format", "json");

    registerEntityCommands(program);

    await program.parseAsync(
      [
        "node",
        "los",
        "entity",
        "resolve",
        "--reg-number",
        "12345678",
        "--jurisdiction",
        "GB",
        "--limit",
        "3",
      ],
      { from: "node" }
    );

    expect(resolveEntity).toHaveBeenCalledWith({
      name: undefined,
      registration_number: "12345678",
      jurisdiction: "GB",
      lei: undefined,
      limit: 3,
    });

    stdout.mockRestore();
    stderr.mockRestore();
  });
});
