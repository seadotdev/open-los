import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const listDeals = vi.fn();
const createDeal = vi.fn();

vi.mock("../client.js", () => ({
  getClient: () => ({
    listDeals,
    createDeal,
  }),
}));

describe("registerDealCommands", () => {
  beforeEach(() => {
    listDeals.mockReset();
    createDeal.mockReset();
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
});
