import { beforeEach, describe, expect, it, vi } from "vitest";
import { LosClient } from "./client.js";

describe("LosClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends an approved gate record header for stage transitions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "transition_1" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new LosClient({
      baseUrl: "http://localhost:3100",
      actor: "system",
      tenantId: "default",
    });

    await client.advanceStage("deal_1", {
      to_stage: "underwriting",
      rationale: "Approved move",
      gate_record_id: "gate_1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/v1/deals/deal_1/stage-transitions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Actor": "system",
          "X-Tenant-Id": "default",
          "X-Gate-Record-Id": "gate_1",
        }),
        body: JSON.stringify({
          to_stage: "underwriting",
          rationale: "Approved move",
        }),
      })
    );
  });
});
