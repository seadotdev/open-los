import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const listDeals = vi.fn();
const createDeal = vi.fn();
const advanceStage = vi.fn();

vi.mock("../client.js", () => ({
  getClient: () => ({
    listDeals,
    createDeal,
    advanceStage,
  }),
}));

describe("registerDealCommands", () => {
  beforeEach(() => {
    listDeals.mockReset();
    createDeal.mockReset();
    advanceStage.mockReset();
  });

  it("prints the pagination cursor returned by the API in table mode", async () => {
    listDeals.mockResolvedValue({
      deals: [{ id: "deal_1", borrower_name: "Acme Corp" }],
      cursor: "deal_1",
    });

    const { registerDealCommands } = await import("./deals.js");
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    const program = new Command();
    program
      .exitOverride()
      .option("--api-url <url>")
      .option("--actor <id>")
      .option("--tenant-id <id>")
      .option("--format <format>", "Output format", "json");

    registerDealCommands(program);

    await program.parseAsync(["node", "los", "--format", "table", "deal", "list"], {
      from: "node",
    });

    expect(listDeals).toHaveBeenCalledWith({
      stage: undefined,
      limit: 20,
      cursor: undefined,
    });
    expect(stdout).toHaveBeenCalledWith("\nNext cursor: deal_1");

    stdout.mockRestore();
    stderr.mockRestore();
  });

  it("parses deal create amounts into minor units for the API client", async () => {
    createDeal.mockResolvedValue({
      id: "deal_1",
      borrower_name: "Acme Corp",
    });

    const { registerDealCommands } = await import("./deals.js");
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    const program = new Command();
    program
      .exitOverride()
      .option("--api-url <url>")
      .option("--actor <id>")
      .option("--tenant-id <id>")
      .option("--format <format>", "Output format", "json");

    registerDealCommands(program);

    await program.parseAsync(
      [
        "node",
        "los",
        "deal",
        "create",
        "--borrower",
        "Acme Corp",
        "--amount",
        "5m",
        "--purpose",
        "working_capital",
        "--jurisdiction",
        "US",
      ],
      { from: "node" }
    );

    expect(createDeal).toHaveBeenCalledWith({
      borrower_name: "Acme Corp",
      requested_amount: 500000000,
      purpose: "working_capital",
      jurisdiction: "US",
    });

    stdout.mockRestore();
    stderr.mockRestore();
  });

  it("passes approved gate records through the deal advance command", async () => {
    advanceStage.mockResolvedValue({
      id: "transition_1",
      to_stage: "underwriting",
    });

    const { registerDealCommands } = await import("./deals.js");
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    const program = new Command();
    program
      .exitOverride()
      .option("--api-url <url>")
      .option("--actor <id>")
      .option("--tenant-id <id>")
      .option("--format <format>", "Output format", "json");

    registerDealCommands(program);

    await program.parseAsync(
      [
        "node",
        "los",
        "deal",
        "advance",
        "deal_1",
        "--to",
        "underwriting",
        "--rationale",
        "Approved move",
        "--gate-record-id",
        "gate_1",
      ],
      { from: "node" }
    );

    expect(advanceStage).toHaveBeenCalledWith("deal_1", {
      to_stage: "underwriting",
      rationale: "Approved move",
      gate_record_id: "gate_1",
      override: undefined,
      override_rationale: undefined,
    });

    stdout.mockRestore();
    stderr.mockRestore();
  });
});
