import { describe, it, expect } from "vitest"
import { LoanOriginationAgent } from "./agent.js"

function makeLosServices() {
  return {
    deals: {
      create: async () => ({}),
      get: async () => ({
        id: "deal_1",
        borrower_name: "Acme Co",
        requested_amount: 10_000_000,
        purpose: "working capital",
        jurisdiction: "US",
        stage: "underwriting",
        custom_fields: { sector: "manufacturing" },
      }),
      list: async () => [],
      getPendingApprovals: async () => [],
    },
    stages: {
      checkGuards: async () => ({ satisfied: true, unsatisfied: [] }),
      checkGuard: async () => true,
      getGuards: async () => [],
      transition: async () => {},
    },
    documents: {
      create: async () => ({}),
      listByDeal: async () => [],
    },
    entities: {
      create: async () => ({}),
    },
    relationships: {
      getBorrowerGroup: async () => ({ entities: [], relationships: [] }),
    },
    spreads: {
      create: async () => ({}),
      getRatios: async () => ({ dscr: 1.4, gross_margin: 0.2, net_margin: 0.1, current_ratio: 1.3 }),
    },
    covenants: {
      list: async () => [],
    },
    facilities: {
      create: async () => ({}),
    },
    loans: {
      create: async () => ({}),
    },
    monitoring: {
      ingestTransactions: async () => {},
      getAlerts: async () => [],
    },
    audit: {
      listByDeal: async () => [],
    },
    approvals: {
      get: async () => ({}),
      decide: async () => {},
    },
  }
}

describe("LoanOriginationAgent.evaluate fallback behavior", () => {
  it("fails closed by default when LLM evaluation fails", async () => {
    const agent = new LoanOriginationAgent({
      los: makeLosServices() as any,
      llm: {
        complete: async () => "",
        structured: async () => {
          throw new Error("llm unavailable")
        },
      },
      tenantId: "default",
    })

    await expect(
      agent.evaluate("deal_1", { policy_id: "p1", model: "m1", params: {} })
    ).rejects.toThrow(/fallback disabled/i)
  })

  it("falls back to deterministic rules when explicitly enabled", async () => {
    const agent = new LoanOriginationAgent({
      los: makeLosServices() as any,
      llm: {
        complete: async () => "",
        structured: async () => {
          throw new Error("llm unavailable")
        },
      },
      tenantId: "default",
    })

    const run = await agent.evaluate(
      "deal_1",
      { policy_id: "p1", model: "m1", params: {} },
      undefined,
      { allowRulesFallback: true }
    )

    expect(run.policy.policy_id).toBe("p1")
    expect(run.decision.action).toMatch(/approve|decline|refer|counter/)
    expect(run.trace?.steps?.some((s) => s.name === "llm_fallback")).toBe(true)
  })
})
