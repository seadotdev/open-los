"use client";

import { useState, useCallback } from "react";
import { Nav } from "@/components/Nav";
import { DemoGuard, useDemoClient } from "@/components/DemoGuard";

interface ToolDef {
  name: string;
  description: string;
  fields: Array<{
    name: string;
    type: "string" | "number" | "select";
    required?: boolean;
    description?: string;
    options?: string[];
    default?: string;
  }>;
  method: string;
  path: string | ((params: Record<string, string>) => string);
}

const TOOLS: ToolDef[] = [
  {
    name: "deal.create",
    description: "Create a new lending deal",
    method: "POST",
    path: "/v1/deals",
    fields: [
      { name: "borrower_name", type: "string", required: true, description: "Name of the borrower" },
      { name: "requested_amount", type: "number", description: "Amount in cents (e.g. 50000000 = $500k)" },
      { name: "purpose", type: "string", description: "Loan purpose" },
      { name: "jurisdiction", type: "string", description: "e.g. US-CA, US-NY" },
    ],
  },
  {
    name: "deal.list",
    description: "List all deals, optionally by stage",
    method: "GET",
    path: "/v1/deals",
    fields: [
      {
        name: "stage",
        type: "select",
        options: ["", "broker", "origination", "underwriting", "closing", "monitoring"],
        description: "Filter by stage",
      },
      { name: "limit", type: "number", description: "Max results" },
    ],
  },
  {
    name: "entity.create",
    description: "Create a company or person entity",
    method: "POST",
    path: "/v1/entities",
    fields: [
      { name: "name", type: "string", required: true },
      { name: "type", type: "select", required: true, options: ["company", "person"] },
      { name: "legal_name", type: "string" },
      { name: "jurisdiction", type: "string" },
    ],
  },
  {
    name: "entity.list",
    description: "List all entities",
    method: "GET",
    path: "/v1/entities",
    fields: [],
  },
  {
    name: "stage.transition",
    description: "Advance a deal to the next stage",
    method: "POST",
    path: (p) => `/v1/deals/${p.deal_id}/stage-transitions`,
    fields: [
      { name: "deal_id", type: "string", required: true, description: "Deal ID" },
      {
        name: "to_stage",
        type: "select",
        required: true,
        options: ["origination", "underwriting", "closing", "monitoring"],
      },
    ],
  },
  {
    name: "covenant.create",
    description: "Create a covenant for a deal",
    method: "POST",
    path: (p) => `/v1/deals/${p.deal_id}/covenants`,
    fields: [
      { name: "deal_id", type: "string", required: true },
      { name: "name", type: "string", required: true, description: "e.g. Minimum DSCR" },
      { name: "type", type: "select", required: true, options: ["financial", "reporting", "information"] },
      { name: "metric", type: "string", description: "e.g. dscr, leverage" },
      { name: "operator", type: "select", options: [">=", "<=", ">", "<", "=="] },
      { name: "threshold", type: "number" },
      { name: "frequency", type: "select", options: ["monthly", "quarterly", "annually"] },
    ],
  },
  {
    name: "spread.create",
    description: "Create a financial spread",
    method: "POST",
    path: (p) => `/v1/deals/${p.deal_id}/spread`,
    fields: [
      { name: "deal_id", type: "string", required: true },
      { name: "period", type: "string", required: true, description: "e.g. 2025-Q4", default: "2025-Q4" },
    ],
  },
  {
    name: "facility.create",
    description: "Create a loan facility",
    method: "POST",
    path: (p) => `/v1/deals/${p.deal_id}/facilities`,
    fields: [
      { name: "deal_id", type: "string", required: true },
      { name: "type", type: "select", required: true, options: ["term_loan", "revolver", "letter_of_credit"] },
      { name: "amount", type: "number", required: true, description: "Amount in cents" },
      { name: "interest_rate_type", type: "select", options: ["fixed", "floating"] },
      { name: "interest_rate_value", type: "number", description: "Rate as decimal e.g. 0.055" },
      { name: "term_months", type: "number" },
    ],
  },
];

const SCENARIOS = [
  {
    name: "Full Origination",
    description: "Create a deal and advance it through all stages",
    steps: [
      'los deal create "Acme Corp" --amount 500000',
      "los entity create --name Acme --type company",
      "los stage advance <deal_id> --to origination",
      "los stage advance <deal_id> --to underwriting",
      "los stage advance <deal_id> --to closing",
    ],
  },
  {
    name: "Financial Analysis",
    description: "Create spreads and test covenants",
    steps: [
      'los deal create "TechCo" --amount 1000000',
      "los spread create <deal_id> --period 2025-Q4",
      'los covenant create <deal_id> --name "Min DSCR" --type financial --metric dscr --operator ">=" --threshold 1.25',
      "los covenant test <deal_id>",
    ],
  },
  {
    name: "Entity Graph",
    description: "Build a company ownership structure",
    steps: [
      "los entity create --name 'Parent Co' --type company",
      "los entity create --name 'Subsidiary' --type company",
      "los entity create --name 'Jane CEO' --type person",
      "los relationship create --from <jane_id> --to <parent_id> --type directs",
    ],
  },
];

function ToolForm({ tool, onResult }: { tool: ToolDef; onResult: (result: unknown, curl: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const f of tool.fields) {
      if (f.default) defaults[f.name] = f.default;
    }
    return defaults;
  });
  const [loading, setLoading] = useState(false);
  const client = useDemoClient();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!client) return;
      setLoading(true);

      try {
        const token = sessionStorage.getItem("demo_token") || "";
        const apiUrl = sessionStorage.getItem("demo_api_url") || "http://localhost:3000";
        const tenantId = sessionStorage.getItem("demo_tenant_id") || "default";
        const actor = sessionStorage.getItem("demo_actor") || "playground";

        const path =
          typeof tool.path === "function" ? tool.path(values) : tool.path;

        const body: Record<string, unknown> = {};
        const queryParams: string[] = [];

        for (const field of tool.fields) {
          const val = values[field.name];
          if (!val && val !== "0") continue;
          if (field.name === "deal_id") continue; // used in path

          if (tool.method === "GET") {
            queryParams.push(`${field.name}=${encodeURIComponent(val)}`);
          } else {
            body[field.name] = field.type === "number" ? Number(val) : val;
          }
        }

        const url = `${apiUrl}${path}${queryParams.length ? "?" + queryParams.join("&") : ""}`;

        const headers: Record<string, string> = {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId,
          Authorization: `Bearer ${token}`,
        };
        if (tool.method !== "GET") headers["Content-Type"] = "application/json";

        // Build curl command
        const curlParts = [`curl -X ${tool.method}`];
        for (const [k, v] of Object.entries(headers)) {
          curlParts.push(`  -H "${k}: ${v}"`);
        }
        if (tool.method !== "GET" && Object.keys(body).length > 0) {
          curlParts.push(`  -d '${JSON.stringify(body)}'`);
        }
        curlParts.push(`  ${url}`);
        const curl = curlParts.join(" \\\n");

        const res = await fetch(url, {
          method: tool.method,
          headers,
          body: tool.method !== "GET" ? JSON.stringify(body) : undefined,
        });

        const result = await res.json();
        onResult(result, curl);
      } catch (err) {
        onResult({ error: String(err) }, "");
      } finally {
        setLoading(false);
      }
    },
    [client, tool, values, onResult]
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {tool.fields.map((field) => (
        <div key={field.name}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginBottom: "4px",
            }}
          >
            {field.name}
            {field.required && <span style={{ color: "var(--danger)" }}> *</span>}
            {field.description && (
              <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>
                {field.description}
              </span>
            )}
          </label>
          {field.type === "select" ? (
            <select
              value={values[field.name] || ""}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              style={{
                width: "100%",
                padding: "8px",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: "13px",
              }}
            >
              <option value="">-- select --</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === "number" ? "number" : "text"}
              value={values[field.name] || ""}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              required={field.required}
              style={{
                width: "100%",
                padding: "8px",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: "13px",
                fontFamily: field.type === "number" ? "var(--font-mono)" : "inherit",
              }}
            />
          )}
        </div>
      ))}
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Executing..." : `${tool.method} ${typeof tool.path === "string" ? tool.path : "..."}`}
      </button>
    </form>
  );
}

function PlaygroundContent() {
  const [selectedTool, setSelectedTool] = useState<ToolDef>(TOOLS[0]);
  const [result, setResult] = useState<unknown>(null);
  const [curl, setCurl] = useState("");
  const [tab, setTab] = useState<"tools" | "scenarios">("tools");

  return (
    <div className="container" style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
        Agent Playground
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "14px" }}>
        Test MCP tools interactively. Every call goes to your isolated demo sandbox.
      </p>

      <div className="tabs">
        <button className={`tab ${tab === "tools" ? "active" : ""}`} onClick={() => setTab("tools")}>
          Tool Tester
        </button>
        <button className={`tab ${tab === "scenarios" ? "active" : ""}`} onClick={() => setTab("scenarios")}>
          Scenarios
        </button>
      </div>

      {tab === "tools" && (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 1fr", gap: "24px" }}>
          {/* Tool list */}
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase" }}>
              Available Tools
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {TOOLS.map((tool) => (
                <button
                  key={tool.name}
                  onClick={() => {
                    setSelectedTool(tool);
                    setResult(null);
                    setCurl("");
                  }}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: selectedTool.name === tool.name ? "var(--bg-tertiary)" : "transparent",
                    color: selectedTool.name === tool.name ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: "13px",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {tool.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tool form */}
          <div className="card">
            <h3
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "14px",
                color: "var(--accent)",
                marginBottom: "4px",
              }}
            >
              {selectedTool.name}
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px" }}>
              {selectedTool.description}
            </p>
            <ToolForm
              tool={selectedTool}
              onResult={(r, c) => {
                setResult(r);
                setCurl(c);
              }}
            />
          </div>

          {/* Result */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {result && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Response</span>
                </div>
                <pre style={{ maxHeight: "400px", overflow: "auto", fontSize: "12px" }}>
                  <code>{JSON.stringify(result, null, 2)}</code>
                </pre>
              </div>
            )}
            {curl && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">cURL</span>
                </div>
                <pre style={{ fontSize: "11px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  <code>{curl}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "scenarios" && (
        <div className="grid-3">
          {SCENARIOS.map((scenario) => (
            <div className="card" key={scenario.name}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                {scenario.name}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                {scenario.description}
              </p>
              <div
                style={{
                  background: "var(--bg-primary)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1.8,
                }}
              >
                {scenario.steps.map((step, i) => (
                  <div key={i} style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--text-muted)" }}>{i + 1}.</span> {step}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <div>
      <Nav active="Playground" />
      <DemoGuard>
        <PlaygroundContent />
      </DemoGuard>
    </div>
  );
}
