import { describe, expect, it, vi } from "vitest";
import { handleStageHistory, handleStageTransition } from "./stages.js";

describe("handleStageTransition", () => {
  it("passes tenant-aware gate context and stage transition arguments through", async () => {
    const buildDealContext = vi.fn(async () => ({ deal_id: "deal_1", deal_stage: "broker" }));
    const check = vi.fn(async () => ({ allowed: true }));
    const transition = vi.fn(async () => ({ id: "tr_1" }));

    const result = await handleStageTransition(
      {
        approvalGateService: {
          buildDealContext,
          check,
        },
        stageService: {
          transition,
        },
      } as any,
      {
        deal_id: "deal_1",
        to_stage: "origination",
        rationale: "Advance deal",
        tenant_id: "tenant_1",
        actor: "mcp-user",
      }
    );

    expect(buildDealContext).toHaveBeenCalledWith("deal_1", "tenant_1");
    expect(check).toHaveBeenCalledWith(
      "deal.stage_advance",
      { deal_id: "deal_1", deal_stage: "broker" },
      "mcp-user",
      undefined,
      "tenant_1"
    );
    expect(transition).toHaveBeenCalledWith(
      "deal_1",
      expect.objectContaining({
        to_stage: "origination",
        rationale: "Advance deal",
      }),
      "mcp-user",
      { id: "mcp-user", role: "credit_lead" },
      "tenant_1"
    );
    expect(result).toEqual({ id: "tr_1" });
  });
});

describe("handleStageHistory", () => {
  it("forwards tenant_id when listing stage history", async () => {
    const listByDeal = vi.fn(async () => []);

    await handleStageHistory(
      {
        stageService: {
          listByDeal,
        },
      } as any,
      { deal_id: "deal_1", tenant_id: "tenant_2" }
    );

    expect(listByDeal).toHaveBeenCalledWith("deal_1", "tenant_2");
  });
});
