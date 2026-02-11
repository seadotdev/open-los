/**
 * Mambu Digital Twin — API v2 Loan Lifecycle Subset
 *
 * A behavioral clone of the Mambu Banking Engine API v2, scoped to:
 * - Clients (borrower management)
 * - Loan Products (product templates)
 * - Loan Accounts (lifecycle management)
 * - Loan Transactions (disbursement, repayment, fee, refund, adjustments)
 * - Repayment Schedules
 * - Credit Arrangements (facility/line management)
 *
 * Compatibility target: skyleague/mambu-sdk (TypeScript)
 * Content-Type: application/vnd.mambu.v2+json
 *
 * @see https://api.mambu.com/
 * @see https://github.com/skyleague/mambu-sdk
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { MambuStore } from "./store/index.js";
import { clientRoutes } from "./routes/clients.js";
import { loanProductRoutes } from "./routes/loan-products.js";
import { loanAccountRoutes } from "./routes/loan-accounts.js";
import { loanTransactionRoutes } from "./routes/loan-transactions.js";
import { creditArrangementRoutes } from "./routes/credit-arrangements.js";
import { colonActionRoutes } from "./routes/colon-actions.js";

export interface MambuTwinOptions {
  getNow?: () => string;
}

/**
 * Mambu uses colon-action URL patterns like `/loans:search` and
 * `/loans/{id}:changeState`. Hono's router can't match these natively.
 * We wrap the app with a fetch handler that rewrites these patterns
 * before they reach the router.
 *
 * `/api/loans:search` → `/api/loans/_action/search`
 * `/api/loans/LA001:changeState` → `/api/loans/LA001/_action/changeState`
 * `/api/loans/transactions/TX001:adjust` → `/api/loans/transactions/TX001/_action/adjust`
 */
function rewriteColonActions(request: Request): Request {
  const url = new URL(request.url);
  const original = url.pathname;

  // Match patterns like /something:action at the end of the path
  const rewritten = original.replace(/([^/]+):(\w+)$/, "$1/_action/$2");

  if (rewritten !== original) {
    url.pathname = rewritten;
    return new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      // @ts-expect-error duplex needed for streaming body
      duplex: "half",
    });
  }

  return request;
}

export function createMambuTwin(options?: MambuTwinOptions) {
  const store = new MambuStore(options?.getNow);
  const inner = new Hono();

  // CORS
  inner.use("*", cors());

  // Mambu v2 content-type versioning middleware
  inner.use("*", async (c, next) => {
    await next();
    if (c.res.headers.get("content-type")?.includes("application/json")) {
      c.res.headers.set("content-type", "application/vnd.mambu.v2+json; charset=utf-8");
    }
  });

  // Auth middleware (permissive for twin)
  inner.use("/api/*", async (c, next) => {
    await next();
  });

  // Colon-action routes (rewritten paths: /loans/_action/search, etc.)
  inner.route("/api", colonActionRoutes(store));

  // Standard CRUD routes
  inner.route("/api/clients", clientRoutes(store));
  inner.route("/api/loanproducts", loanProductRoutes(store));
  inner.route("/api/loans", loanAccountRoutes(store));
  inner.route("/api/loans", loanTransactionRoutes(store));
  inner.route("/api/creditarrangements", creditArrangementRoutes(store));

  // Status endpoint
  inner.get("/api/application/status", (c) => {
    return c.json({
      state: "RUNNING",
      version: "twin-0.1.0",
      implementation: "open-los/mambu-twin",
    });
  });

  // POST /api/database/backup (no-op for twin)
  inner.post("/api/database/backup", (c) => {
    return c.json({ status: "COMPLETED" }, 200);
  });

  // POST /_twin/reset — twin-specific: reset all state
  inner.post("/_twin/reset", (c) => {
    store.reset();
    return c.json({ status: "RESET" }, 200);
  });

  // GET /_twin/stats — twin-specific: state counts
  inner.get("/_twin/stats", (c) => {
    return c.json({
      clients: store.clients.size,
      loanProducts: store.loanProducts.size,
      loanAccounts: store.loanAccounts.size,
      transactions: Array.from(store.loanTransactions.values()).reduce(
        (sum, txns) => sum + txns.length,
        0
      ),
      creditArrangements: store.creditArrangements.size,
    });
  });

  // Wrap inner app with colon-action URL rewriting
  const app = {
    fetch: (request: Request, ...rest: unknown[]) => {
      return inner.fetch(rewriteColonActions(request), ...rest);
    },
    request: (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === "string") {
        const req = new Request(input, init);
        return inner.request(rewriteColonActions(req));
      }
      if (input instanceof Request) {
        return inner.request(rewriteColonActions(input));
      }
      const req = new Request(input.toString(), init);
      return inner.request(rewriteColonActions(req));
    },
    // Expose inner for direct route testing (non-colon routes)
    inner,
  };

  return { app, store };
}
