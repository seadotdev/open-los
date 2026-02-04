import { describe, expect, it, vi } from "vitest";
import { createSpreadsheetSyncEngine } from "./sync-engine";
import {
  FieldMapping,
  SpreadsheetAdapter,
  SpreadsheetRow,
  SpreadsheetSchema,
  SpreadsheetSyncInput,
} from "./types";

class FakeAdapter implements SpreadsheetAdapter {
  readonly type = "excel" as const;
  readonly name = "Fake Adapter";
  readonly features = {
    watchChanges: false,
    realtime: false,
    documents: false,
    incrementalSync: true,
  };

  constructor(
    private schema: SpreadsheetSchema,
    private rowsByWorksheet: Record<string, SpreadsheetRow[]>
  ) {}

  async initialize(): Promise<void> {
    return;
  }

  async testConnection() {
    return { success: true, message: "ok" };
  }

  async discoverSchema(): Promise<SpreadsheetSchema> {
    return this.schema;
  }

  async previewData(worksheet: string): Promise<SpreadsheetRow[]> {
    return this.rowsByWorksheet[worksheet] ?? [];
  }

  async fetchRows(worksheet: string, options?: { limit?: number; cursor?: string }) {
    const rows = this.rowsByWorksheet[worksheet] ?? [];
    const start = options?.cursor ? Number(options.cursor) : 0;
    const limit = options?.limit ?? rows.length;
    const slice = rows.slice(start, start + limit);
    const nextCursor = start + slice.length;
    return {
      rows: slice,
      cursor: nextCursor < rows.length ? String(nextCursor) : undefined,
      hasMore: nextCursor < rows.length,
      totalCount: rows.length,
    };
  }

  async getRow(worksheet: string, rowId: string): Promise<SpreadsheetRow | null> {
    const rows = this.rowsByWorksheet[worksheet] ?? [];
    return rows.find((row) => String(row.rowNumber) === rowId) ?? null;
  }

  async getRowCount(worksheet: string): Promise<number> {
    return (this.rowsByWorksheet[worksheet] ?? []).length;
  }

  async dispose(): Promise<void> {
    return;
  }
}

const createFakeDb = (mappings: FieldMapping[]) => {
  const tracking = new Map<string, any>();
  const createDeal = vi.fn(async () => "deal-1");
  const updateDeal = vi.fn(async () => undefined);
  const createEntity = vi.fn(async () => "entity-1");
  const updateEntity = vi.fn(async () => undefined);
  const createFacility = vi.fn(async () => "facility-1");
  const updateFacility = vi.fn(async () => undefined);
  const createDocument = vi.fn(async () => "document-1");
  const updateDocument = vi.fn(async () => undefined);

  return {
    getRowTracking: vi.fn(async (connectionId: string, worksheet: string, sourceRowId: string) => {
      return tracking.get(`${connectionId}:${worksheet}:${sourceRowId}`) ?? null;
    }),
    upsertRowTracking: vi.fn(async (record: any) => {
      tracking.set(`${record.connectionId}:${record.worksheet}:${record.sourceRowId}`, record);
    }),
    listRowTrackings: vi.fn(async (connectionId: string, worksheet: string) => {
      return Array.from(tracking.values()).filter(
        (item) => item.connectionId === connectionId && item.worksheet === worksheet
      );
    }),
    getMappings: vi.fn(async () => mappings),
    createDeal,
    updateDeal,
    createEntity,
    updateEntity,
    createFacility,
    updateFacility,
    createDocument,
    updateDocument,
  };
};

describe("SpreadsheetSyncEngine", () => {
  it("creates deal records with transforms applied", async () => {
    const mappings: FieldMapping[] = [
      {
        id: "m1",
        connectionId: "conn-1",
        sourceWorksheet: "Deals",
        sourceColumn: "Borrower",
        targetEntity: "deals",
        targetField: "borrower_name",
        enabled: true,
      },
      {
        id: "m2",
        connectionId: "conn-1",
        sourceWorksheet: "Deals",
        sourceColumn: "Stage",
        targetEntity: "deals",
        targetField: "stage",
        transform: { type: "stage_normalize" },
        enabled: true,
      },
      {
        id: "m3",
        connectionId: "conn-1",
        sourceWorksheet: "Deals",
        sourceColumn: "Amount",
        targetEntity: "deals",
        targetField: "loan_amount_minor",
        transform: { type: "to_minor_units" },
        enabled: true,
      },
      {
        id: "m4",
        connectionId: "conn-1",
        sourceWorksheet: "Deals",
        sourceColumn: "CloseDate",
        targetEntity: "deals",
        targetField: "close_date",
        transform: { type: "parse_date" },
        enabled: true,
      },
      {
        id: "m5",
        connectionId: "conn-1",
        sourceWorksheet: "Deals",
        sourceColumn: "Active",
        targetEntity: "deals",
        targetField: "is_active",
        transform: { type: "parse_boolean" },
        enabled: true,
      },
    ];

    const db = createFakeDb(mappings);
    const schema: SpreadsheetSchema = {
      sourceType: "excel",
      version: "1.0",
      discoveredAt: new Date(),
      worksheets: [
        {
          name: "Deals",
          displayName: "Deals",
          rowCount: 1,
          columns: [
            { header: "Borrower", dataType: "text", index: 0, letter: "A", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
            { header: "Stage", dataType: "text", index: 1, letter: "B", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
            { header: "Amount", dataType: "currency", index: 2, letter: "C", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
            { header: "CloseDate", dataType: "date", index: 3, letter: "D", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
            { header: "Active", dataType: "boolean", index: 4, letter: "E", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
          ],
          headerRowIndex: 0,
          dataRowIndex: 1,
        },
      ],
    };

    const rows: SpreadsheetRow[] = [
      {
        rowIndex: 0,
        rowNumber: 2,
        data: {
          Borrower: "Acme Co",
          Stage: "UW",
          Amount: "$1,234.50",
          CloseDate: "2/1/2024",
          Active: "Yes",
        },
        hash: "hash-1",
      },
    ];

    const adapter = new FakeAdapter(schema, { Deals: rows });
    const engine = createSpreadsheetSyncEngine({
      db,
      tenantId: "tenant-1",
      actorId: "actor-1",
    });

    (engine as any).adapters.set("conn-1", adapter);

    const input: SpreadsheetSyncInput = {
      connectionId: "conn-1",
      mode: "full",
      continueOnError: true,
    };

    const result = await engine.runSync("conn-1", input);

    expect(result.summary.createdRecords).toBe(1);
    expect(db.createDeal).toHaveBeenCalledWith(
      {
        borrower_name: "Acme Co",
        stage: "underwriting",
        loan_amount_minor: 123450,
        close_date: "2024-02-01",
        is_active: true,
        tenant_id: "tenant-1",
      },
      "actor-1"
    );
  });

  it("skips unchanged rows and preserves array-mapped identifiers", async () => {
    const mappings: FieldMapping[] = [
      {
        id: "m1",
        connectionId: "conn-2",
        sourceWorksheet: "Entities",
        sourceColumn: "Name",
        targetEntity: "entities",
        targetField: "name",
        enabled: true,
      },
      {
        id: "m2",
        connectionId: "conn-2",
        sourceWorksheet: "Entities",
        sourceColumn: "Email",
        targetEntity: "entities",
        targetField: "identifiers[email]",
        enabled: true,
      },
      {
        id: "m3",
        connectionId: "conn-2",
        sourceWorksheet: "Entities",
        sourceColumn: "Phone",
        targetEntity: "entities",
        targetField: "phone",
        transform: { type: "parse_phone" },
        enabled: true,
      },
    ];

    const db = createFakeDb(mappings);
    const schema: SpreadsheetSchema = {
      sourceType: "excel",
      version: "1.0",
      discoveredAt: new Date(),
      worksheets: [
        {
          name: "Entities",
          displayName: "Entities",
          rowCount: 1,
          columns: [
            { header: "Name", dataType: "text", index: 0, letter: "A", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
            { header: "Email", dataType: "email", index: 1, letter: "B", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
            { header: "Phone", dataType: "phone", index: 2, letter: "C", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
          ],
          headerRowIndex: 0,
          dataRowIndex: 1,
        },
      ],
    };

    const rows: SpreadsheetRow[] = [
      {
        rowIndex: 0,
        rowNumber: 1,
        data: {
          Name: "Zeta Holdings",
          Email: "team@zeta.test",
          Phone: "(212) 555-0100",
        },
        hash: "hash-entity-1",
      },
    ];

    const adapter = new FakeAdapter(schema, { Entities: rows });
    const engine = createSpreadsheetSyncEngine({
      db,
      tenantId: "tenant-2",
      actorId: "actor-2",
    });

    (engine as any).adapters.set("conn-2", adapter);

    const input: SpreadsheetSyncInput = {
      connectionId: "conn-2",
      mode: "full",
      continueOnError: true,
    };

    const firstRun = await engine.runSync("conn-2", input);
    const secondRun = await engine.runSync("conn-2", input);

    expect(firstRun.summary.createdRecords).toBe(1);
    expect(db.createEntity).toHaveBeenCalledWith(
      {
        name: "Zeta Holdings",
        identifiers: [{ scheme: "email", value: "team@zeta.test" }],
        phone: "+12125550100",
        tenant_id: "tenant-2",
      },
      "actor-2"
    );
    expect(secondRun.summary.skippedRows).toBe(1);
    expect(db.updateEntity).not.toHaveBeenCalled();
  });

  it("supports concatenate, split, regex extract, and lookup transforms", async () => {
    const mappings: FieldMapping[] = [
      {
        id: "m1",
        connectionId: "conn-3",
        sourceWorksheet: "Pipeline",
        sourceColumn: "First Name",
        targetEntity: "deals",
        targetField: "borrower_name",
        transform: {
          type: "concatenate",
          params: { fields: ["First Name", "Last Name"], separator: " " },
        },
        enabled: true,
      },
      {
        id: "m2",
        connectionId: "conn-3",
        sourceWorksheet: "Pipeline",
        sourceColumn: "Contact",
        targetEntity: "deals",
        targetField: "primary_contact.last_name",
        transform: { type: "split", params: { delimiter: ",", index: 1 } },
        enabled: true,
      },
      {
        id: "m3",
        connectionId: "conn-3",
        sourceWorksheet: "Pipeline",
        sourceColumn: "Deal Code",
        targetEntity: "deals",
        targetField: "external_id",
        transform: { type: "regex_extract", params: { pattern: "DEAL-(\\d+)" } },
        enabled: true,
      },
      {
        id: "m4",
        connectionId: "conn-3",
        sourceWorksheet: "Pipeline",
        sourceColumn: "Risk",
        targetEntity: "deals",
        targetField: "risk_level",
        transform: {
          type: "lookup",
          params: { map: { H: "high", M: "medium", L: "low" }, fallback: "unknown" },
        },
        enabled: true,
      },
    ];

    const db = createFakeDb(mappings);
    const schema: SpreadsheetSchema = {
      sourceType: "excel",
      version: "1.0",
      discoveredAt: new Date(),
      worksheets: [
        {
          name: "Pipeline",
          displayName: "Pipeline",
          rowCount: 1,
          columns: [
            { header: "First Name", dataType: "text", index: 0, letter: "A", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
            { header: "Last Name", dataType: "text", index: 1, letter: "B", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
            { header: "Contact", dataType: "text", index: 2, letter: "C", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
            { header: "Deal Code", dataType: "text", index: 3, letter: "D", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
            { header: "Risk", dataType: "text", index: 4, letter: "E", sampleValues: [], isPrimaryKeyCandidate: false, fillRate: 1 },
          ],
          headerRowIndex: 0,
          dataRowIndex: 1,
        },
      ],
    };

    const rows: SpreadsheetRow[] = [
      {
        rowIndex: 0,
        rowNumber: 2,
        data: {
          "First Name": "Ada",
          "Last Name": "Lovelace",
          Contact: "Ada, Lovelace",
          "Deal Code": "DEAL-4242",
          Risk: "H",
        },
        hash: "hash-3",
      },
    ];

    const adapter = new FakeAdapter(schema, { Pipeline: rows });
    const engine = createSpreadsheetSyncEngine({
      db,
      tenantId: "tenant-3",
      actorId: "actor-3",
    });

    (engine as any).adapters.set("conn-3", adapter);

    const input: SpreadsheetSyncInput = {
      connectionId: "conn-3",
      mode: "full",
      continueOnError: true,
    };

    const result = await engine.runSync("conn-3", input);

    expect(result.summary.createdRecords).toBe(1);
    expect(db.createDeal).toHaveBeenCalledWith(
      {
        borrower_name: "Ada Lovelace",
        primary_contact: { last_name: "Lovelace" },
        external_id: "4242",
        risk_level: "high",
        tenant_id: "tenant-3",
      },
      "actor-3"
    );
  });
});
