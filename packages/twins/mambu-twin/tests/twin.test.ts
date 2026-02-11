/**
 * Mambu Digital Twin — Conformance Test Suite
 *
 * Tests validate that the twin behaves like the real Mambu API v2 for
 * the loan lifecycle subset. These tests serve as the specification:
 * any implementation passing them is a valid Mambu twin.
 *
 * Compatibility target: skyleague/mambu-sdk patterns
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createMambuTwin } from "../src/server.js";

const NOW = "2026-01-15T10:00:00.000Z";

function setup() {
  const { app, store } = createMambuTwin({ getNow: () => NOW });
  const base = "http://localhost/api";

  async function req(method: string, path: string, body?: unknown) {
    const url = `${base}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/vnd.mambu.v2+json",
        apiKey: "test-api-key",
      },
    };
    if (body) init.body = JSON.stringify(body);
    return app.request(url, init);
  }

  return { app, store, req };
}

/** Helper for /_twin/* endpoints that bypass colon rewriting */
function twinRequest(app: ReturnType<typeof createMambuTwin>["app"], method: string, path: string) {
  return app.inner.request(`http://localhost${path}`, { method });
}

// ── Client Endpoints ─────────────────────────────────────────────────────

describe("Clients", () => {
  it("POST /clients — creates a client", async () => {
    const { req } = setup();
    const res = await req("POST", "/clients", {
      firstName: "John",
      lastName: "Doe",
      emailAddress: "john@example.com",
    });

    expect(res.status).toBe(201);
    const client = await res.json();
    expect(client.firstName).toBe("John");
    expect(client.lastName).toBe("Doe");
    expect(client.state).toBe("PENDING_APPROVAL");
    expect(client.encodedKey).toBeTruthy();
    expect(client.id).toBeTruthy();
    expect(client.creationDate).toBe(NOW);
    expect(client.loanCycle).toBe(0);
  });

  it("POST /clients — rejects missing required fields", async () => {
    const { req } = setup();
    const res = await req("POST", "/clients", { firstName: "John" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toBeDefined();
    expect(body.errors[0].errorCode).toBe(400);
  });

  it("GET /clients — lists clients with pagination", async () => {
    const { req } = setup();

    await req("POST", "/clients", { firstName: "Alice", lastName: "A" });
    await req("POST", "/clients", { firstName: "Bob", lastName: "B" });
    await req("POST", "/clients", { firstName: "Carol", lastName: "C" });

    const res = await req("GET", "/clients?offset=0&limit=2");
    expect(res.status).toBe(200);
    const clients = await res.json();
    expect(clients).toHaveLength(2);
  });

  it("GET /clients/:id — retrieves by id", async () => {
    const { req } = setup();
    const createRes = await req("POST", "/clients", {
      firstName: "Jane",
      lastName: "Smith",
    });
    const created = await createRes.json();

    const res = await req("GET", `/clients/${created.id}`);
    expect(res.status).toBe(200);
    const client = await res.json();
    expect(client.encodedKey).toBe(created.encodedKey);
  });

  it("GET /clients/:encodedKey — retrieves by encodedKey", async () => {
    const { req } = setup();
    const createRes = await req("POST", "/clients", {
      firstName: "Jane",
      lastName: "Smith",
    });
    const created = await createRes.json();

    const res = await req("GET", `/clients/${created.encodedKey}`);
    expect(res.status).toBe(200);
    const client = await res.json();
    expect(client.id).toBe(created.id);
  });

  it("PATCH /clients/:id — updates client", async () => {
    const { req } = setup();
    const createRes = await req("POST", "/clients", {
      firstName: "Jane",
      lastName: "Smith",
    });
    const created = await createRes.json();

    const res = await req("PATCH", `/clients/${created.id}`, {
      emailAddress: "jane@example.com",
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.emailAddress).toBe("jane@example.com");
    expect(updated.firstName).toBe("Jane"); // preserved
  });

  it("PATCH /clients/:id — supports JSON Patch format", async () => {
    const { req } = setup();
    const createRes = await req("POST", "/clients", {
      firstName: "Jane",
      lastName: "Smith",
    });
    const created = await createRes.json();

    const res = await req("PATCH", `/clients/${created.id}`, [
      { op: "REPLACE", path: "/notes", value: "VIP customer" },
    ]);
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.notes).toBe("VIP customer");
  });

  it("GET /clients/:id — 404 for nonexistent", async () => {
    const { req } = setup();
    const res = await req("GET", "/clients/nonexistent");
    expect(res.status).toBe(404);
  });
});

// ── Loan Product Endpoints ───────────────────────────────────────────────

describe("Loan Products", () => {
  it("POST /loanproducts — creates a product", async () => {
    const { req } = setup();
    const res = await req("POST", "/loanproducts", {
      name: "Business Term Loan",
      productType: "FIXED_TERM",
      defaultTermMonths: 36,
      interestRateSettings: { defaultRate: 8.5, minRate: 5, maxRate: 15 },
    });

    expect(res.status).toBe(201);
    const product = await res.json();
    expect(product.name).toBe("Business Term Loan");
    expect(product.state).toBe("ACTIVE");
    expect(product.encodedKey).toBeTruthy();
  });

  it("GET /loanproducts — lists products", async () => {
    const { req } = setup();
    await req("POST", "/loanproducts", { name: "Product A" });
    await req("POST", "/loanproducts", { name: "Product B" });

    const res = await req("GET", "/loanproducts");
    expect(res.status).toBe(200);
    const products = await res.json();
    expect(products).toHaveLength(2);
  });

  it("GET /loanproducts/:id — retrieves product", async () => {
    const { req } = setup();
    const createRes = await req("POST", "/loanproducts", { name: "Test Loan" });
    const created = await createRes.json();

    const res = await req("GET", `/loanproducts/${created.id}`);
    expect(res.status).toBe(200);
    const product = await res.json();
    expect(product.name).toBe("Test Loan");
  });
});

// ── Loan Account Endpoints ───────────────────────────────────────────────

describe("Loan Accounts", () => {
  async function createPrerequisites(req: ReturnType<typeof setup>["req"]) {
    const clientRes = await req("POST", "/clients", {
      firstName: "Test",
      lastName: "Borrower",
    });
    const client = await clientRes.json();

    const productRes = await req("POST", "/loanproducts", {
      name: "Term Loan",
      defaultTermMonths: 12,
      interestRateSettings: { defaultRate: 10 },
    });
    const product = await productRes.json();

    return { client, product };
  }

  it("POST /loans — creates a loan account", async () => {
    const { req } = setup();
    const { client, product } = await createPrerequisites(req);

    const res = await req("POST", "/loans", {
      loanAmount: 100000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
    });

    expect(res.status).toBe(201);
    const loan = await res.json();
    expect(loan.loanAmount).toBe(100000);
    expect(loan.accountState).toBe("PARTIAL_APPLICATION");
    expect(loan.encodedKey).toBeTruthy();
    expect(loan.balances.totalBalance).toBe(0);
  });

  it("POST /loans — rejects missing required fields", async () => {
    const { req } = setup();
    const res = await req("POST", "/loans", { loanAmount: 100000 });
    expect(res.status).toBe(400);
  });

  it("POST /loans — rejects nonexistent product", async () => {
    const { req } = setup();
    const clientRes = await req("POST", "/clients", {
      firstName: "Test",
      lastName: "Borrower",
    });
    const client = await clientRes.json();

    const res = await req("POST", "/loans", {
      loanAmount: 100000,
      productTypeKey: "nonexistent",
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
    });
    expect(res.status).toBe(400);
  });

  it("GET /loans — lists with filtering", async () => {
    const { req } = setup();
    const { client, product } = await createPrerequisites(req);

    await req("POST", "/loans", {
      loanAmount: 50000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
    });
    await req("POST", "/loans", {
      loanAmount: 75000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
    });

    const res = await req("GET", "/loans?accountState=PARTIAL_APPLICATION");
    expect(res.status).toBe(200);
    const loans = await res.json();
    expect(loans).toHaveLength(2);
  });

  it("GET /loans/:id — retrieves by id", async () => {
    const { req } = setup();
    const { client, product } = await createPrerequisites(req);

    const createRes = await req("POST", "/loans", {
      loanAmount: 100000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
    });
    const created = await createRes.json();

    const res = await req("GET", `/loans/${created.id}`);
    expect(res.status).toBe(200);
    const loan = await res.json();
    expect(loan.loanAmount).toBe(100000);
  });

  it("GET /loans/:id?detailsLevel=FULL — includes nested objects", async () => {
    const { req } = setup();
    const { client, product } = await createPrerequisites(req);

    const createRes = await req("POST", "/loans", {
      loanAmount: 100000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
    });
    const created = await createRes.json();

    const res = await req("GET", `/loans/${created.id}?detailsLevel=FULL`);
    expect(res.status).toBe(200);
    const loan = await res.json();
    expect(loan.balances).toBeDefined();
    expect(loan.scheduleSettings).toBeDefined();
    expect(loan.interestSettings).toBeDefined();
  });

  it("DELETE /loans/:id — deletes draft loan", async () => {
    const { req } = setup();
    const { client, product } = await createPrerequisites(req);

    const createRes = await req("POST", "/loans", {
      loanAmount: 100000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
    });
    const created = await createRes.json();

    const res = await req("DELETE", `/loans/${created.id}`);
    expect(res.status).toBe(204);

    const getRes = await req("GET", `/loans/${created.id}`);
    expect(getRes.status).toBe(404);
  });

  it("POST /loans/:id:changeState — state machine transitions", async () => {
    const { req } = setup();
    const { client, product } = await createPrerequisites(req);

    const createRes = await req("POST", "/loans", {
      loanAmount: 100000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
    });
    const loan = await createRes.json();

    // PARTIAL_APPLICATION → PENDING_APPROVAL
    let res = await req("POST", `/loans/${loan.id}:changeState`, {
      action: "REQUEST_APPROVAL",
    });
    expect(res.status).toBe(200);
    let updated = await res.json();
    expect(updated.accountState).toBe("PENDING_APPROVAL");

    // PENDING_APPROVAL → APPROVED
    res = await req("POST", `/loans/${loan.id}:changeState`, {
      action: "APPROVE",
    });
    expect(res.status).toBe(200);
    updated = await res.json();
    expect(updated.accountState).toBe("APPROVED");
    expect(updated.approvedDate).toBe(NOW);
  });

  it("POST /loans/:id:changeState — rejects invalid transitions", async () => {
    const { req } = setup();
    const { client, product } = await createPrerequisites(req);

    const createRes = await req("POST", "/loans", {
      loanAmount: 100000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
    });
    const loan = await createRes.json();

    // Can't close a PARTIAL_APPLICATION directly
    const res = await req("POST", `/loans/${loan.id}:changeState`, {
      action: "CLOSE",
    });
    expect(res.status).toBe(409);
  });

  it("POST /loans:search — searches with filter criteria", async () => {
    const { req } = setup();
    const { client, product } = await createPrerequisites(req);

    await req("POST", "/loans", {
      loanAmount: 50000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
    });
    await req("POST", "/loans", {
      loanAmount: 200000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
    });

    const res = await req("POST", "/loans:search", {
      filterCriteria: [
        { field: "loanAmount", operator: "MORE_THAN", value: "100000" },
      ],
    });
    expect(res.status).toBe(200);
    const results = await res.json();
    expect(results).toHaveLength(1);
    expect(results[0].loanAmount).toBe(200000);
  });
});

// ── Loan Transactions ────────────────────────────────────────────────────

describe("Loan Transactions", () => {
  async function createActiveLoan(req: ReturnType<typeof setup>["req"]) {
    const clientRes = await req("POST", "/clients", {
      firstName: "Test",
      lastName: "Borrower",
    });
    const client = await clientRes.json();

    const productRes = await req("POST", "/loanproducts", {
      name: "Term Loan",
      defaultTermMonths: 12,
      interestRateSettings: { defaultRate: 10 },
    });
    const product = await productRes.json();

    const loanRes = await req("POST", "/loans", {
      loanAmount: 120000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
      scheduleSettings: {
        repaymentInstallments: 12,
        repaymentPeriodCount: 1,
        repaymentPeriodUnit: "MONTHS",
        gracePeriod: 0,
      },
      interestSettings: {
        interestRate: 12, // 12% annual → 1% monthly
        interestCalculationMethod: "DECLINING_BALANCE",
        interestChargeFrequency: "ANNUALIZED",
      },
    });
    const loan = await loanRes.json();

    // Approve
    await req("POST", `/loans/${loan.id}:changeState`, { action: "APPROVE" });

    return { client, product, loan };
  }

  it("POST /loans/:id/disbursement-transactions — disburses loan", async () => {
    const { req } = setup();
    const { loan } = await createActiveLoan(req);

    const res = await req(
      "POST",
      `/loans/${loan.id}/disbursement-transactions`,
      { amount: 120000, notes: "Full disbursement" }
    );

    expect(res.status).toBe(201);
    const tx = await res.json();
    expect(tx.type).toBe("DISBURSEMENT");
    expect(tx.amount).toBe(120000);
    expect(tx.affectedAmounts.principalAmount).toBe(120000);
    expect(tx.parentAccountKey).toBe(loan.encodedKey);

    // Verify loan is now ACTIVE
    const loanRes = await req("GET", `/loans/${loan.id}?detailsLevel=FULL`);
    const updatedLoan = await loanRes.json();
    expect(updatedLoan.accountState).toBe("ACTIVE");
    expect(updatedLoan.balances.principalBalance).toBe(120000);
    expect(updatedLoan.balances.totalBalance).toBe(120000);
  });

  it("POST /loans/:id/disbursement-transactions — generates schedule", async () => {
    const { req } = setup();
    const { loan } = await createActiveLoan(req);

    await req("POST", `/loans/${loan.id}/disbursement-transactions`, {
      amount: 120000,
    });

    const schedRes = await req("GET", `/loans/${loan.id}/schedule`);
    expect(schedRes.status).toBe(200);
    const schedule = await schedRes.json();
    expect(schedule.installments).toHaveLength(12);
    expect(schedule.installments[0].installmentNumber).toBe(1);
    expect(schedule.installments[0].state).toBe("PENDING");
    expect(schedule.installments[0].principalDue).toBeGreaterThan(0);
  });

  it("POST /loans/:id/repayment-transactions — records repayment", async () => {
    const { req } = setup();
    const { loan } = await createActiveLoan(req);

    await req("POST", `/loans/${loan.id}/disbursement-transactions`, {
      amount: 120000,
    });

    const res = await req(
      "POST",
      `/loans/${loan.id}/repayment-transactions`,
      { amount: 10000, notes: "Monthly payment" }
    );

    expect(res.status).toBe(201);
    const tx = await res.json();
    expect(tx.type).toBe("REPAYMENT");
    expect(tx.amount).toBe(10000);
    expect(tx.affectedAmounts.principalAmount).toBeGreaterThan(0);

    // Verify balances updated
    const loanRes = await req("GET", `/loans/${loan.id}?detailsLevel=FULL`);
    const updated = await loanRes.json();
    expect(updated.balances.principalBalance).toBeLessThan(120000);
    expect(updated.balances.principalPaid).toBeGreaterThan(0);
  });

  it("POST /loans/:id/repayment-transactions — allocates penalty→fees→interest→principal", async () => {
    const { req } = setup();
    const { loan } = await createActiveLoan(req);

    await req("POST", `/loans/${loan.id}/disbursement-transactions`, {
      amount: 120000,
    });

    // Apply fee first
    await req("POST", `/loans/${loan.id}/fee-transactions`, {
      amount: 500,
      notes: "Late fee",
    });

    // Then repay
    const res = await req(
      "POST",
      `/loans/${loan.id}/repayment-transactions`,
      { amount: 10500 }
    );

    const tx = await res.json();
    // Fee should be paid before principal
    expect(tx.affectedAmounts.feesAmount).toBe(500);
    expect(tx.affectedAmounts.principalAmount).toBeGreaterThan(0);
  });

  it("POST /loans/:id/fee-transactions — applies fee", async () => {
    const { req } = setup();
    const { loan } = await createActiveLoan(req);

    await req("POST", `/loans/${loan.id}/disbursement-transactions`, {
      amount: 120000,
    });

    const res = await req("POST", `/loans/${loan.id}/fee-transactions`, {
      amount: 250,
      notes: "Processing fee",
    });

    expect(res.status).toBe(201);
    const tx = await res.json();
    expect(tx.type).toBe("FEE_APPLIED");
    expect(tx.amount).toBe(250);

    // Verify fee added to balances
    const loanRes = await req("GET", `/loans/${loan.id}?detailsLevel=FULL`);
    const updated = await loanRes.json();
    expect(updated.balances.feesDue).toBe(250);
    expect(updated.balances.feesBalance).toBe(250);
    expect(updated.balances.totalBalance).toBe(120250);
  });

  it("full repayment closes the loan", async () => {
    const { req } = setup();
    const { loan } = await createActiveLoan(req);

    await req("POST", `/loans/${loan.id}/disbursement-transactions`, {
      amount: 120000,
    });

    // Repay full amount
    const res = await req(
      "POST",
      `/loans/${loan.id}/repayment-transactions`,
      { amount: 120000 }
    );
    expect(res.status).toBe(201);

    const loanRes = await req("GET", `/loans/${loan.id}?detailsLevel=FULL`);
    const updated = await loanRes.json();
    expect(updated.accountState).toBe("CLOSED");
    expect(updated.accountSubState).toBe("REPAID");
    expect(updated.closedDate).toBe(NOW);
  });

  it("GET /loans/:id/transactions — lists transactions", async () => {
    const { req } = setup();
    const { loan } = await createActiveLoan(req);

    await req("POST", `/loans/${loan.id}/disbursement-transactions`, {
      amount: 120000,
    });
    await req("POST", `/loans/${loan.id}/repayment-transactions`, {
      amount: 10000,
    });
    await req("POST", `/loans/${loan.id}/fee-transactions`, { amount: 100 });

    const res = await req("GET", `/loans/${loan.id}/transactions`);
    expect(res.status).toBe(200);
    const txns = await res.json();
    expect(txns).toHaveLength(3);
    expect(txns[0].type).toBe("DISBURSEMENT");
    expect(txns[1].type).toBe("REPAYMENT");
    expect(txns[2].type).toBe("FEE_APPLIED");
  });

  it("POST /loans/transactions/:txId:adjust — reverses a transaction", async () => {
    const { req } = setup();
    const { loan } = await createActiveLoan(req);

    const disbRes = await req(
      "POST",
      `/loans/${loan.id}/disbursement-transactions`,
      { amount: 120000 }
    );

    // Make a repayment
    const repayRes = await req(
      "POST",
      `/loans/${loan.id}/repayment-transactions`,
      { amount: 10000 }
    );
    const repayTx = await repayRes.json();

    // Adjust (reverse) the repayment
    const adjustRes = await req(
      "POST",
      `/loans/transactions/${repayTx.id}:adjust`,
      { notes: "Reversed by mistake" }
    );

    expect(adjustRes.status).toBe(200);
    const adjustTx = await adjustRes.json();
    expect(adjustTx.originalTransactionKey).toBe(repayTx.encodedKey);

    // Balance should be back to 120000
    const loanRes = await req("GET", `/loans/${loan.id}?detailsLevel=FULL`);
    const updated = await loanRes.json();
    expect(updated.balances.principalBalance).toBe(120000);
  });
});

// ── Credit Arrangements ──────────────────────────────────────────────────

describe("Credit Arrangements", () => {
  it("POST /creditarrangements — creates arrangement", async () => {
    const { req } = setup();
    const clientRes = await req("POST", "/clients", {
      firstName: "Test",
      lastName: "Corp",
    });
    const client = await clientRes.json();

    const res = await req("POST", "/creditarrangements", {
      creditArrangementName: "Working Capital Line",
      amount: 500000,
      holderType: "CLIENT",
      holderKey: client.encodedKey,
      startDate: "2026-01-15",
      endDate: "2027-01-15",
    });

    expect(res.status).toBe(201);
    const arrangement = await res.json();
    expect(arrangement.creditArrangementName).toBe("Working Capital Line");
    expect(arrangement.amount).toBe(500000);
    expect(arrangement.state).toBe("PENDING_APPROVAL");
    expect(arrangement.availableCreditAmount).toBe(500000);
    expect(arrangement.consumedCreditAmount).toBe(0);
  });

  it("GET /creditarrangements/:id/accounts — lists linked loans", async () => {
    const { req } = setup();
    const clientRes = await req("POST", "/clients", {
      firstName: "Test",
      lastName: "Corp",
    });
    const client = await clientRes.json();

    const productRes = await req("POST", "/loanproducts", {
      name: "Term Loan",
    });
    const product = await productRes.json();

    const arrRes = await req("POST", "/creditarrangements", {
      creditArrangementName: "Facility",
      amount: 1000000,
      holderType: "CLIENT",
      holderKey: client.encodedKey,
    });
    const arrangement = await arrRes.json();

    // Create a loan linked to this arrangement
    await req("POST", "/loans", {
      loanAmount: 250000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
      creditArrangementKey: arrangement.encodedKey,
    });

    const res = await req(
      "GET",
      `/creditarrangements/${arrangement.id}/accounts`
    );
    expect(res.status).toBe(200);
    const accounts = await res.json();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].loanAmount).toBe(250000);
  });
});

// ── Twin-Specific Endpoints ──────────────────────────────────────────────

describe("Twin Management", () => {
  it("GET /application/status — reports running", async () => {
    const { req } = setup();
    const res = await req("GET", "/application/status");
    expect(res.status).toBe(200);
    const status = await res.json();
    expect(status.state).toBe("RUNNING");
    expect(status.implementation).toBe("open-los/mambu-twin");
  });

  it("POST /_twin/reset — clears all state", async () => {
    const { app, store, req } = setup();

    await req("POST", "/clients", { firstName: "A", lastName: "B" });
    expect(store.clients.size).toBe(1);

    const resetRes = await twinRequest(app, "POST", "/_twin/reset");
    expect(resetRes.status).toBe(200);
    expect(store.clients.size).toBe(0);
  });

  it("GET /_twin/stats — reports entity counts", async () => {
    const { app, req } = setup();

    await req("POST", "/clients", { firstName: "A", lastName: "B" });
    await req("POST", "/loanproducts", { name: "P" });

    const res = await twinRequest(app, "GET", "/_twin/stats");
    expect(res.status).toBe(200);
    const stats = await res.json();
    expect(stats.clients).toBe(1);
    expect(stats.loanProducts).toBe(1);
  });
});

// ── Content-Type Verification ────────────────────────────────────────────

describe("Mambu v2 Content-Type", () => {
  it("responses use application/vnd.mambu.v2+json", async () => {
    const { req } = setup();
    const res = await req("GET", "/application/status");
    expect(res.headers.get("content-type")).toContain(
      "application/vnd.mambu.v2+json"
    );
  });
});

// ── Full Loan Lifecycle ──────────────────────────────────────────────────

describe("Full Loan Lifecycle (Integration)", () => {
  it("client creation → loan → approve → disburse → repay → close", async () => {
    const { req } = setup();

    // 1. Create client
    const clientRes = await req("POST", "/clients", {
      firstName: "Acme",
      lastName: "Corp",
      emailAddress: "acme@example.com",
    });
    const client = await clientRes.json();
    expect(client.state).toBe("PENDING_APPROVAL");

    // 2. Create loan product
    const productRes = await req("POST", "/loanproducts", {
      name: "SME Term Loan",
      defaultTermMonths: 6,
      interestRateSettings: { defaultRate: 12 },
    });
    const product = await productRes.json();

    // 3. Create loan
    const loanRes = await req("POST", "/loans", {
      loanAmount: 60000,
      productTypeKey: product.encodedKey,
      accountHolderKey: client.encodedKey,
      accountHolderType: "CLIENT",
      scheduleSettings: {
        repaymentInstallments: 6,
        repaymentPeriodCount: 1,
        repaymentPeriodUnit: "MONTHS",
      },
      interestSettings: {
        interestRate: 12,
        interestCalculationMethod: "FLAT",
        interestChargeFrequency: "ANNUALIZED",
      },
    });
    const loan = await loanRes.json();
    expect(loan.accountState).toBe("PARTIAL_APPLICATION");

    // 4. Approve loan
    await req("POST", `/loans/${loan.id}:changeState`, {
      action: "APPROVE",
    });

    // 5. Disburse
    await req("POST", `/loans/${loan.id}/disbursement-transactions`, {
      amount: 60000,
    });

    // Verify schedule generated
    const schedRes = await req("GET", `/loans/${loan.id}/schedule`);
    const schedule = await schedRes.json();
    expect(schedule.installments).toHaveLength(6);

    // 6. Make 6 repayments (principal + interest per installment)
    for (let i = 0; i < 6; i++) {
      const installment = schedule.installments[i];
      const paymentAmount = installment.principalDue + installment.interestDue;
      await req("POST", `/loans/${loan.id}/repayment-transactions`, {
        amount: paymentAmount,
      });
    }

    // 7. Verify loan is closed
    const finalRes = await req("GET", `/loans/${loan.id}?detailsLevel=FULL`);
    const finalLoan = await finalRes.json();
    expect(finalLoan.accountState).toBe("CLOSED");
    expect(finalLoan.accountSubState).toBe("REPAID");
    expect(finalLoan.balances.principalBalance).toBeLessThanOrEqual(0.01); // floating point tolerance

    // 8. Verify transaction history
    const txRes = await req("GET", `/loans/${loan.id}/transactions`);
    const txns = await txRes.json();
    expect(txns.length).toBe(7); // 1 disbursement + 6 repayments
    expect(txns[0].type).toBe("DISBURSEMENT");
    expect(txns[6].type).toBe("REPAYMENT");
  });
});
