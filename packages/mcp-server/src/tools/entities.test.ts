import { describe, expect, it, vi } from "vitest";
import { handleEntityResolve } from "./entities.js";

describe("handleEntityResolve", () => {
  it("forwards tenant-scoped resolution queries through the shared service", async () => {
    const resolve = vi.fn(async () => ({
      candidates: [{ entity_id: "entity_1", score: 1 }],
    }));

    const result = await handleEntityResolve(
      {
        entityResolutionService: {
          resolve,
        },
      } as any,
      {
        registration_number: "12345678",
        jurisdiction: "GB",
        tenant_id: "tenant_7",
        limit: 3,
      }
    );

    expect(resolve).toHaveBeenCalledWith(
      {
        registration_number: "12345678",
        jurisdiction: "GB",
        limit: 3,
      },
      "tenant_7"
    );
    expect(result).toEqual({
      candidates: [{ entity_id: "entity_1", score: 1 }],
    });
  });
});
