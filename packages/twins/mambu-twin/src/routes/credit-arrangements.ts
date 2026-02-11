import { Hono } from "hono";
import type { MambuStore } from "../store/index.js";
import { generateEncodedKey } from "../store/index.js";
import type { CreditArrangement, CreateCreditArrangementInput } from "../types/credit-arrangement.js";
import { mambuError, parsePagination } from "./helpers.js";

export function creditArrangementRoutes(store: MambuStore) {
  const app = new Hono();

  // GET /creditarrangements
  app.get("/", (c) => {
    const { offset, limit } = parsePagination(c);
    const items = Array.from(store.creditArrangements.values());
    return c.json(store.paginate(items, offset, limit), 200);
  });

  // POST /creditarrangements
  app.post("/", async (c) => {
    const body = (await c.req.json()) as CreateCreditArrangementInput;
    if (!body.creditArrangementName || !body.amount || !body.holderKey || !body.holderType) {
      return c.json(
        mambuError(400, "VALIDATION", "creditArrangementName, amount, holderKey, and holderType are required"),
        400
      );
    }

    const now = store.now();
    const encodedKey = generateEncodedKey();

    const arrangement: CreditArrangement = {
      encodedKey,
      id: body.id ?? store.nextCreditArrangementId(),
      creditArrangementName: body.creditArrangementName,
      amount: body.amount,
      state: "PENDING_APPROVAL",
      holderType: body.holderType,
      holderKey: body.holderKey,
      startDate: body.startDate,
      endDate: body.endDate,
      expireDate: body.expireDate,
      notes: body.notes,
      assignedBranchKey: body.assignedBranchKey,
      assignedCentreKey: body.assignedCentreKey,
      assignedUserKey: body.assignedUserKey,
      availableCreditAmount: body.amount,
      consumedCreditAmount: 0,
      creationDate: now,
      lastModifiedDate: now,
    };

    store.creditArrangements.set(encodedKey, arrangement);
    return c.json(arrangement, 201);
  });

  // GET /creditarrangements/:creditArrangementId
  app.get("/:creditArrangementId", (c) => {
    const id = c.req.param("creditArrangementId");
    const arrangement = findArrangement(store, id);
    if (!arrangement) {
      return c.json(mambuError(404, "NOT_FOUND", `Credit arrangement ${id} not found`), 404);
    }
    return c.json(arrangement, 200);
  });

  // PATCH /creditarrangements/:creditArrangementId
  app.patch("/:creditArrangementId", async (c) => {
    const id = c.req.param("creditArrangementId");
    const arrangement = findArrangement(store, id);
    if (!arrangement) {
      return c.json(mambuError(404, "NOT_FOUND", `Credit arrangement ${id} not found`), 404);
    }

    const body = await c.req.json();
    if (Array.isArray(body)) {
      for (const op of body) {
        const path = op.path?.replace(/^\//, "") as string;
        if (op.op === "REPLACE" || op.op === "ADD") {
          (arrangement as unknown as Record<string, unknown>)[path] = op.value;
        }
      }
    } else {
      Object.assign(arrangement, body);
    }

    arrangement.lastModifiedDate = store.now();
    return c.json(arrangement, 200);
  });

  // GET /creditarrangements/:creditArrangementId/accounts — get linked accounts
  app.get("/:creditArrangementId/accounts", (c) => {
    const id = c.req.param("creditArrangementId");
    const arrangement = findArrangement(store, id);
    if (!arrangement) {
      return c.json(mambuError(404, "NOT_FOUND", `Credit arrangement ${id} not found`), 404);
    }

    const linkedKeys = store.creditArrangementAccounts.get(arrangement.encodedKey) ?? [];
    const accounts = linkedKeys
      .map((key) => store.loanAccounts.get(key))
      .filter(Boolean);

    return c.json(accounts, 200);
  });

  return app;
}

function findArrangement(store: MambuStore, idOrKey: string): CreditArrangement | undefined {
  const byKey = store.creditArrangements.get(idOrKey);
  if (byKey) return byKey;
  for (const arr of store.creditArrangements.values()) {
    if (arr.id === idOrKey) return arr;
  }
  return undefined;
}
