import { Hono } from "hono";
import type { MambuStore } from "../store/index.js";
import { generateEncodedKey } from "../store/index.js";
import type { LoanProduct, CreateLoanProductInput } from "../types/loan-product.js";
import { mambuError, parsePagination } from "./helpers.js";

export function loanProductRoutes(store: MambuStore) {
  const app = new Hono();

  // GET /loanproducts
  app.get("/", (c) => {
    const { offset, limit } = parsePagination(c);
    const items = Array.from(store.loanProducts.values());
    return c.json(store.paginate(items, offset, limit), 200);
  });

  // POST /loanproducts
  app.post("/", async (c) => {
    const body = (await c.req.json()) as CreateLoanProductInput;
    if (!body.name) {
      return c.json(mambuError(400, "VALIDATION", "name is required"), 400);
    }

    const now = store.now();
    const encodedKey = generateEncodedKey();

    const product: LoanProduct = {
      encodedKey,
      id: body.id ?? store.nextLoanProductId(),
      name: body.name,
      state: "ACTIVE",
      productType: body.productType ?? "FIXED_TERM",
      interestCalculationMethod: body.interestCalculationMethod,
      repaymentMethod: body.repaymentMethod,
      repaymentFrequency: body.repaymentFrequency,
      defaultTermMonths: body.defaultTermMonths,
      gracePeriodDays: body.gracePeriodDays,
      interestRateSettings: body.interestRateSettings,
      creationDate: now,
      lastModifiedDate: now,
    };

    store.loanProducts.set(encodedKey, product);
    return c.json(product, 201);
  });

  // GET /loanproducts/:productId
  app.get("/:productId", (c) => {
    const productId = c.req.param("productId");
    const product = findProduct(store, productId);
    if (!product) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan product ${productId} not found`), 404);
    }
    return c.json(product, 200);
  });

  // PATCH /loanproducts/:productId
  app.patch("/:productId", async (c) => {
    const productId = c.req.param("productId");
    const product = findProduct(store, productId);
    if (!product) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan product ${productId} not found`), 404);
    }

    const body = await c.req.json();
    if (Array.isArray(body)) {
      for (const op of body) {
        applyPatch(product as unknown as Record<string, unknown>, op);
      }
    } else {
      Object.assign(product, body);
    }
    product.lastModifiedDate = store.now();
    return c.json(product, 200);
  });

  return app;
}

function findProduct(store: MambuStore, idOrKey: string): LoanProduct | undefined {
  const byKey = store.loanProducts.get(idOrKey);
  if (byKey) return byKey;
  for (const p of store.loanProducts.values()) {
    if (p.id === idOrKey) return p;
  }
  return undefined;
}

function applyPatch(target: Record<string, unknown>, op: { op: string; path: string; value?: unknown }): void {
  const path = op.path.replace(/^\//, "");
  if (op.op === "REPLACE" || op.op === "ADD") {
    target[path] = op.value;
  } else if (op.op === "REMOVE") {
    delete target[path];
  }
}
