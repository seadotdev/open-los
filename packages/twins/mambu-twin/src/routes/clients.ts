import { Hono } from "hono";
import type { MambuStore } from "../store/index.js";
import { generateEncodedKey } from "../store/index.js";
import type { Client, CreateClientInput } from "../types/client.js";
import { mambuError, parsePagination } from "./helpers.js";

export function clientRoutes(store: MambuStore) {
  const app = new Hono();

  // GET /clients — list clients
  app.get("/", (c) => {
    const { offset, limit } = parsePagination(c);
    const state = c.req.query("state");
    const firstName = c.req.query("firstName");
    const lastName = c.req.query("lastName");
    const branchId = c.req.query("branchId");

    let items = Array.from(store.clients.values());

    if (state) items = items.filter((cl) => cl.state === state);
    if (firstName) items = items.filter((cl) => cl.firstName === firstName);
    if (lastName) items = items.filter((cl) => cl.lastName === lastName);
    if (branchId) items = items.filter((cl) => cl.assignedBranchKey === branchId);

    items.sort((a, b) => a.creationDate.localeCompare(b.creationDate));
    const page = store.paginate(items, offset, limit);
    return c.json(page, 200);
  });

  // POST /clients — create client
  app.post("/", async (c) => {
    const body = (await c.req.json()) as CreateClientInput;

    if (!body.firstName || !body.lastName) {
      return c.json(mambuError(400, "VALIDATION", "firstName and lastName are required"), 400);
    }

    const now = store.now();
    const encodedKey = generateEncodedKey();
    const id = body.id ?? store.nextClientId();

    const client: Client = {
      encodedKey,
      id,
      state: "PENDING_APPROVAL",
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName,
      gender: body.gender,
      birthDate: body.birthDate,
      emailAddress: body.emailAddress,
      mobilePhone: body.mobilePhone,
      mobilePhone2: body.mobilePhone2,
      homePhone: body.homePhone,
      preferredLanguage: body.preferredLanguage,
      notes: body.notes,
      clientRoleKey: body.clientRoleKey,
      assignedBranchKey: body.assignedBranchKey,
      assignedCentreKey: body.assignedCentreKey,
      assignedUserKey: body.assignedUserKey,
      addresses: body.addresses,
      idDocuments: body.idDocuments,
      loanCycle: 0,
      groupLoanCycle: 0,
      creationDate: now,
      lastModifiedDate: now,
    };

    store.clients.set(encodedKey, client);
    return c.json(client, 201);
  });

  // GET /clients/:clientId — get client by id or encodedKey
  app.get("/:clientId", (c) => {
    const clientId = c.req.param("clientId");
    const client = findClient(store, clientId);
    if (!client) {
      return c.json(mambuError(404, "NOT_FOUND", `Client ${clientId} not found`), 404);
    }
    return c.json(client, 200);
  });

  // PATCH /clients/:clientId — update client
  app.patch("/:clientId", async (c) => {
    const clientId = c.req.param("clientId");
    const client = findClient(store, clientId);
    if (!client) {
      return c.json(mambuError(404, "NOT_FOUND", `Client ${clientId} not found`), 404);
    }

    const body = await c.req.json();

    // Mambu PATCH supports JSON Patch (array of ops) or simple merge
    if (Array.isArray(body)) {
      for (const op of body) {
        applyPatchOp(client, op);
      }
    } else {
      Object.assign(client, body);
    }

    client.lastModifiedDate = store.now();
    return c.json(client, 200);
  });

  // POST /clients:search — search clients
  app.post("/\\:search", async (c) => {
    const body = await c.req.json();
    const { offset, limit } = parsePagination(c);

    let items = Array.from(store.clients.values());
    items = store.applyFilters(items as unknown as Record<string, unknown>[], body.filterCriteria) as unknown as Client[];
    if (body.sortingCriteria) {
      items = store.applySorting(items as unknown as Record<string, unknown>[], body.sortingCriteria) as unknown as Client[];
    }

    const page = store.paginate(items, offset, limit);
    return c.json(page, 200);
  });

  return app;
}

function findClient(store: MambuStore, idOrKey: string): Client | undefined {
  // Try encodedKey first
  const byKey = store.clients.get(idOrKey);
  if (byKey) return byKey;

  // Try by id
  for (const client of store.clients.values()) {
    if (client.id === idOrKey) return client;
  }
  return undefined;
}

function applyPatchOp(target: Record<string, unknown>, op: { op: string; path: string; value?: unknown }): void {
  const path = op.path.replace(/^\//, "").replace(/\//g, ".");
  if (op.op === "REPLACE" || op.op === "ADD") {
    setNestedValue(target, path, op.value);
  } else if (op.op === "REMOVE") {
    setNestedValue(target, path, undefined);
  }
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== "object") {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}
