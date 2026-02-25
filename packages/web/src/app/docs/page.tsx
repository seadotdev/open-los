"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";

interface Endpoint {
  method: string;
  path: string;
  description: string;
  body?: string;
  response?: string;
}

interface Section {
  name: string;
  endpoints: Endpoint[];
}

const API_SECTIONS: Section[] = [
  {
    name: "Deals",
    endpoints: [
      {
        method: "POST",
        path: "/v1/deals",
        description: "Create a new deal",
        body: '{\n  "borrower_name": "Acme Corp",\n  "requested_amount": 50000000,\n  "purpose": "Working capital",\n  "jurisdiction": "US-CA"\n}',
        response: '{\n  "id": "deal_abc123",\n  "borrower_name": "Acme Corp",\n  "stage": "broker",\n  "requested_amount": 50000000,\n  "created_at": "2025-01-15T10:00:00Z"\n}',
      },
      { method: "GET", path: "/v1/deals", description: "List deals. Query params: stage, limit, cursor" },
      { method: "GET", path: "/v1/deals/:dealId", description: "Get deal by ID" },
      { method: "PATCH", path: "/v1/deals/:dealId", description: "Update deal fields" },
    ],
  },
  {
    name: "Stage Transitions",
    endpoints: [
      {
        method: "POST",
        path: "/v1/deals/:dealId/stage-transitions",
        description: "Advance deal to next stage",
        body: '{\n  "to_stage": "origination",\n  "rationale": "Initial docs received"\n}',
      },
      { method: "GET", path: "/v1/deals/:dealId/stage-transitions", description: "List stage history" },
    ],
  },
  {
    name: "Entities",
    endpoints: [
      {
        method: "POST",
        path: "/v1/entities",
        description: "Create entity (company or person)",
        body: '{\n  "type": "company",\n  "name": "Acme Corp",\n  "legal_name": "Acme Corporation Ltd",\n  "jurisdiction": "US-CA"\n}',
      },
      { method: "GET", path: "/v1/entities", description: "List entities. Query params: type, limit, cursor" },
      { method: "GET", path: "/v1/entities/:entityId", description: "Get entity by ID" },
      { method: "PATCH", path: "/v1/entities/:entityId", description: "Update entity" },
      { method: "DELETE", path: "/v1/entities/:entityId", description: "Delete entity" },
    ],
  },
  {
    name: "Relationships",
    endpoints: [
      {
        method: "POST",
        path: "/v1/relationships",
        description: "Create relationship between entities",
        body: '{\n  "from_entity_id": "ent_abc",\n  "to_entity_id": "ent_xyz",\n  "type": "directs",\n  "ownership_pct": 51\n}',
      },
      { method: "GET", path: "/v1/deals/:dealId/borrower-group", description: "Get borrower group graph" },
    ],
  },
  {
    name: "Documents",
    endpoints: [
      {
        method: "POST",
        path: "/v1/deals/:dealId/documents",
        description: "Upload document",
        body: '{\n  "doc_type": "financial_statement",\n  "filename": "2024-annual.pdf",\n  "content": "<base64>",\n  "mime_type": "application/pdf"\n}',
      },
      { method: "GET", path: "/v1/deals/:dealId/documents", description: "List documents for deal" },
    ],
  },
  {
    name: "Financial Spreads",
    endpoints: [
      {
        method: "POST",
        path: "/v1/deals/:dealId/spread",
        description: "Create financial spread with line items",
        body: '{\n  "period": "2025-Q4",\n  "entity_id": "ent_abc",\n  "line_items": [\n    { "category": "revenue", "label": "Total Revenue", "amount": 12000000 },\n    { "category": "cogs", "label": "COGS", "amount": 7200000 }\n  ]\n}',
      },
      { method: "GET", path: "/v1/deals/:dealId/ratios", description: "Get computed financial ratios" },
    ],
  },
  {
    name: "Covenants",
    endpoints: [
      {
        method: "POST",
        path: "/v1/deals/:dealId/covenants",
        description: "Create covenant",
        body: '{\n  "name": "Min DSCR",\n  "type": "financial",\n  "metric": "dscr",\n  "operator": ">=",\n  "threshold": 1.25,\n  "frequency": "quarterly"\n}',
      },
      { method: "GET", path: "/v1/deals/:dealId/covenants", description: "List covenants" },
      { method: "POST", path: "/v1/deals/:dealId/covenants/test", description: "Test covenant compliance" },
    ],
  },
  {
    name: "Facilities",
    endpoints: [
      {
        method: "POST",
        path: "/v1/deals/:dealId/facilities",
        description: "Create loan facility",
        body: '{\n  "type": "term_loan",\n  "amount": 50000000,\n  "interest_rate_type": "fixed",\n  "interest_rate_value": 0.055,\n  "term_months": 60\n}',
      },
      { method: "GET", path: "/v1/deals/:dealId/facilities", description: "List facilities" },
    ],
  },
  {
    name: "Loans",
    endpoints: [
      { method: "POST", path: "/v1/loans", description: "Create loan" },
      { method: "GET", path: "/v1/loans/:loanId", description: "Get loan details" },
      { method: "GET", path: "/v1/loans/:loanId/balance", description: "Get loan balance" },
      { method: "GET", path: "/v1/loans/:loanId/schedule", description: "Get amortization schedule" },
    ],
  },
  {
    name: "Monitoring",
    endpoints: [
      { method: "POST", path: "/v1/deals/:dealId/monitoring/ingest", description: "Ingest bank transactions" },
      { method: "GET", path: "/v1/deals/:dealId/monitoring/status", description: "Get monitoring status" },
    ],
  },
  {
    name: "Audit Trail",
    endpoints: [
      { method: "GET", path: "/v1/deals/:dealId/audit", description: "List audit events. Query: type, actor, limit" },
    ],
  },
  {
    name: "Approval Gates",
    endpoints: [
      { method: "POST", path: "/v1/gates/policies", description: "Create approval gate policy" },
      { method: "GET", path: "/v1/gates/policies", description: "List gate policies" },
      { method: "POST", path: "/v1/gates/check", description: "Check if action requires approval" },
      { method: "POST", path: "/v1/gates/records/:recordId/decide", description: "Approve or reject" },
    ],
  },
  {
    name: "Demo",
    endpoints: [
      {
        method: "POST",
        path: "/v1/demo/provision",
        description: "Provision a demo sandbox (demo mode only)",
        response: '{\n  "token": "demo_abc...",\n  "tenant_id": "demo_7f3a2b",\n  "expires_at": "2025-01-16T10:00:00Z"\n}',
      },
      { method: "GET", path: "/v1/demo/info", description: "Get demo server info" },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "#22c55e",
  POST: "#3b82f6",
  PATCH: "#f59e0b",
  DELETE: "#ef4444",
};

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        padding: "12px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          cursor: endpoint.body || endpoint.response ? "pointer" : "default",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 700,
            color: METHOD_COLORS[endpoint.method] || "var(--text-primary)",
            width: "52px",
            textAlign: "right",
          }}
        >
          {endpoint.method}
        </span>
        <code style={{ fontSize: "13px", color: "var(--text-primary)" }}>{endpoint.path}</code>
        <span style={{ fontSize: "13px", color: "var(--text-muted)", flex: 1 }}>
          {endpoint.description}
        </span>
        {(endpoint.body || endpoint.response) && (
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </div>
      {expanded && (
        <div style={{ marginTop: "12px", marginLeft: "64px", display: "flex", gap: "16px" }}>
          {endpoint.body && (
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                Request Body
              </div>
              <pre style={{ fontSize: "12px" }}>
                <code>{endpoint.body}</code>
              </pre>
            </div>
          )}
          {endpoint.response && (
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                Response
              </div>
              <pre style={{ fontSize: "12px" }}>
                <code>{endpoint.response}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const [search, setSearch] = useState("");
  const filtered = search
    ? API_SECTIONS.map((s) => ({
        ...s,
        endpoints: s.endpoints.filter(
          (e) =>
            e.path.toLowerCase().includes(search.toLowerCase()) ||
            e.description.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((s) => s.endpoints.length > 0)
    : API_SECTIONS;

  return (
    <div>
      <Nav active="API Docs" />
      <div className="container" style={{ padding: "24px", maxWidth: "900px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>API Reference</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "14px" }}>
          REST API documentation for Open LOS v0.1.0
        </p>

        {/* Auth info */}
        <div className="card" style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>Authentication</h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
            All requests require actor identification via headers:
          </p>
          <pre style={{ fontSize: "12px" }}>
            <code>
              {`X-Actor: alice@lender.com       # Who is making the request
X-Tenant-Id: default            # Tenant isolation

# For demo mode, use bearer token instead:
Authorization: Bearer demo_<token>`}
            </code>
          </pre>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search endpoints..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 16px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--text-primary)",
            fontSize: "14px",
            marginBottom: "24px",
          }}
        />

        {/* Sections */}
        {filtered.map((section) => (
          <div key={section.name} style={{ marginBottom: "32px" }}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 600,
                marginBottom: "12px",
                paddingBottom: "8px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {section.name}
            </h2>
            {section.endpoints.map((ep, i) => (
              <EndpointCard key={i} endpoint={ep} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
