"use client";

import { useState } from "react";
import { ApiClient } from "@/lib/api";

function CopyBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-block">
      <pre>
        <code>{code}</code>
      </pre>
      <button
        className="copy-btn"
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
      <div style={{ fontSize: "32px", marginBottom: "12px" }}>{icon}</div>
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 600,
          marginBottom: "8px",
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {description}
      </p>
    </div>
  );
}

export default function HomePage() {
  const [provisioning, setProvisioning] = useState(false);
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [demoTenantId, setDemoTenantId] = useState<string | null>(null);

  async function handleProvision() {
    setProvisioning(true);
    try {
      const client = new ApiClient();
      const result = await client.provisionDemo();
      setDemoToken(result.token);
      setDemoTenantId(result.tenant_id);
      // Store in sessionStorage for other pages
      sessionStorage.setItem("demo_token", result.token);
      sessionStorage.setItem("demo_tenant_id", result.tenant_id);
      sessionStorage.setItem("demo_api_url", result.api_url);
      sessionStorage.setItem("demo_actor", result.actor);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to provision demo");
    } finally {
      setProvisioning(false);
    }
  }

  return (
    <div>
      {/* Navigation */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          background: "var(--bg-primary)",
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--accent)",
              display: "inline-block",
            }}
          />
          <span style={{ fontWeight: 700, fontSize: "16px" }}>Open LOS</span>
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              background: "var(--bg-tertiary)",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            v0.1.0
          </span>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <a href="/dashboard" style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Dashboard
          </a>
          <a href="/terminal" style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Terminal
          </a>
          <a href="/playground" style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Playground
          </a>
          <a href="/docs" style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            API Docs
          </a>
          <a
            href="https://github.com/seadotdev/open-los"
            target="_blank"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            GitHub
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          textAlign: "center",
          padding: "80px 24px",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: "48px",
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: "20px",
            letterSpacing: "-1px",
          }}
        >
          AI-Native Loan
          <br />
          Origination System
        </h1>
        <p
          style={{
            fontSize: "18px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: "40px",
          }}
        >
          Open source, headless LOS where humans and AI agents are equal actors.
          <br />
          Replace legacy lending software with a modern API-first platform.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          {!demoToken ? (
            <button className="btn btn-primary btn-lg" onClick={handleProvision} disabled={provisioning}>
              {provisioning ? (
                <>
                  <span className="spinner" /> Provisioning...
                </>
              ) : (
                "Try the Demo"
              )}
            </button>
          ) : (
            <a href="/dashboard" className="btn btn-primary btn-lg">
              Open Dashboard
            </a>
          )}
          <a
            href="https://github.com/seadotdev/open-los"
            className="btn btn-secondary btn-lg"
            target="_blank"
          >
            View on GitHub
          </a>
        </div>

        {demoToken && (
          <div
            style={{
              marginTop: "24px",
              padding: "16px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--success)",
              borderRadius: "var(--radius)",
              textAlign: "left",
            }}
          >
            <p style={{ color: "var(--success)", fontWeight: 600, marginBottom: "8px" }}>
              Demo tenant provisioned!
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "4px" }}>
              Tenant: <code>{demoTenantId}</code>
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Your sandbox is pre-loaded with sample deals, entities, and financial data.
            </p>
          </div>
        )}
      </section>

      {/* Quick Start Flows */}
      <section className="container" style={{ marginBottom: "80px" }}>
        <h2
          style={{
            fontSize: "28px",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: "48px",
          }}
        >
          Get Started in Seconds
        </h2>

        <div className="grid-3">
          {/* CLI */}
          <div className="card">
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--accent)",
                marginBottom: "12px",
              }}
            >
              Install CLI
            </h3>
            <CopyBlock code={`npm install -g @open-los/cli\nlos connect demo\nlos deal list`} />
          </div>

          {/* MCP / Agent */}
          <div className="card">
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--accent)",
                marginBottom: "12px",
              }}
            >
              Add to Your AI Agent
            </h3>
            <CopyBlock code={`npx @open-los/create mcp --demo`} />
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                marginTop: "8px",
              }}
            >
              Adds Open LOS as an MCP server to Claude Code or any MCP-compatible agent.
            </p>
          </div>

          {/* Self-host */}
          <div className="card">
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--accent)",
                marginBottom: "12px",
              }}
            >
              Self-Host
            </h3>
            <CopyBlock code={`docker run -p 3000:3000 \\\n  ghcr.io/seadotdev/open-los`} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container" style={{ marginBottom: "80px" }}>
        <h2
          style={{
            fontSize: "28px",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: "48px",
          }}
        >
          Built for Agentic Workflows
        </h2>

        <div className="grid-4">
          <FeatureCard
            icon="$"
            title="Deal Lifecycle"
            description="5-stage state machine: broker, origination, underwriting, closing, monitoring"
          />
          <FeatureCard
            icon="#"
            title="Financial Spreads"
            description="Deterministic ratio computation: DSCR, leverage, liquidity, margins"
          />
          <FeatureCard
            icon="!"
            title="Covenant Monitoring"
            description="Set thresholds, test compliance, trigger alerts automatically"
          />
          <FeatureCard
            icon="@"
            title="Immutable Audit Trail"
            description="Every action by human or AI logged with field-level diffs"
          />
          <FeatureCard
            icon=">"
            title="Entity Graph"
            description="Companies, people, ownership, guarantors, directors"
          />
          <FeatureCard
            icon="="
            title="MCP Tools"
            description="40+ tools for AI agents via Model Context Protocol"
          />
          <FeatureCard
            icon="*"
            title="Multi-Tenant"
            description="Built-in tenant isolation via headers, sandboxed environments"
          />
          <FeatureCard
            icon="~"
            title="Headless API"
            description="REST + MCP + CLI. No UI opinions. Bring your own frontend."
          />
        </div>
      </section>

      {/* MCP Config Section */}
      <section className="container" style={{ marginBottom: "80px" }}>
        <h2
          style={{
            fontSize: "28px",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: "16px",
          }}
        >
          Agent Integration
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "var(--text-secondary)",
            marginBottom: "32px",
          }}
        >
          Add this to your <code>.mcp.json</code> to give your AI agent full LOS capabilities:
        </p>

        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <CopyBlock
            code={JSON.stringify(
              {
                mcpServers: {
                  "open-los": {
                    command: "npx",
                    args: [
                      "@open-los/mcp-server",
                      "--remote",
                      "https://demo.open-los.dev",
                      "--token",
                      "YOUR_TOKEN",
                    ],
                  },
                },
              },
              null,
              2
            )}
          />
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "40px 24px",
          borderTop: "1px solid var(--border)",
          color: "var(--text-muted)",
          fontSize: "13px",
        }}
      >
        <p>
          Open LOS is MIT licensed.{" "}
          <a href="https://github.com/seadotdev/open-los">GitHub</a>
        </p>
      </footer>
    </div>
  );
}
