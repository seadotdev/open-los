"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Nav } from "@/components/Nav";
import { DemoGuard } from "@/components/DemoGuard";
import { ApiClient } from "@/lib/api";

/**
 * Simulated terminal that executes commands against the Open LOS API.
 * Uses a virtual terminal renderer (no xterm.js dependency needed at runtime
 * for the simulation mode - the real WebSocket terminal is a future enhancement).
 */

interface TerminalLine {
  type: "input" | "output" | "error" | "system";
  text: string;
}

const WELCOME_MESSAGE = `Welcome to Open LOS Terminal

Your demo sandbox is ready. Try these commands:

  los deal list              List all deals in the pipeline
  los deal create <name>     Create a new deal
  los entity list            List all entities
  los health                 Check API health
  los help                   Show all available commands

Type a command to get started.
`;

const HELP_TEXT = `Available commands:

  Deal Management:
    los deal list [--stage <stage>]     List deals, optionally by stage
    los deal create <borrower_name>     Create a new deal
    los deal get <deal_id>              Get deal details

  Entity Management:
    los entity list                     List all entities
    los entity create <name> --type <company|person>

  Financial:
    los spread list <deal_id>           List spreads for a deal
    los covenant list <deal_id>         List covenants

  Stage Transitions:
    los stage advance <deal_id> --to <stage>

  Audit:
    los audit list <deal_id>            View audit trail

  System:
    los health                          Check API health
    los help                            Show this help
    clear                               Clear terminal

Stages: broker -> origination -> underwriting -> closing -> monitoring
`;

function getClient(): ApiClient | null {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem("demo_token");
  const apiUrl = sessionStorage.getItem("demo_api_url");
  const tenantId = sessionStorage.getItem("demo_tenant_id");
  const actor = sessionStorage.getItem("demo_actor");
  if (!token) return null;
  return new ApiClient({
    baseUrl: apiUrl || undefined,
    token,
    tenantId: tenantId || undefined,
    actor: actor || undefined,
  });
}

async function executeCommand(
  input: string,
  client: ApiClient
): Promise<string> {
  const parts = input.trim().split(/\s+/);

  // Strip leading "los" if present
  if (parts[0] === "los") parts.shift();

  const cmd = parts[0];
  const sub = parts[1];

  try {
    if (cmd === "health") {
      const res = await client.health();
      return JSON.stringify(res, null, 2);
    }

    if (cmd === "help") return HELP_TEXT;

    if (cmd === "deal") {
      if (sub === "list") {
        const stageIdx = parts.indexOf("--stage");
        const stage = stageIdx >= 0 ? parts[stageIdx + 1] : undefined;
        const res = await client.listDeals({ stage });
        if (!res.deals?.length) return "No deals found.";
        const lines = res.deals.map(
          (d) =>
            `  ${d.id.slice(0, 8)}  ${d.stage.padEnd(14)} ${d.borrower_name.padEnd(30)} ${d.requested_amount ? "$" + (d.requested_amount / 100).toLocaleString() : "-"}`
        );
        return `ID        Stage          Borrower                       Amount\n${"─".repeat(80)}\n${lines.join("\n")}`;
      }

      if (sub === "create") {
        const name = parts.slice(2).join(" ") || "New Deal";
        const res = await client.createDeal({ borrower_name: name });
        return `Deal created: ${res.id}\n  Borrower: ${res.borrower_name}\n  Stage: ${res.stage}`;
      }

      if (sub === "get") {
        const id = parts[2];
        if (!id) return "Usage: los deal get <deal_id>";
        const res = await client.getDeal(id);
        return JSON.stringify(res, null, 2);
      }

      return 'Usage: los deal <list|create|get>';
    }

    if (cmd === "entity") {
      if (sub === "list") {
        const res = await client.listEntities();
        if (!res.entities?.length) return "No entities found.";
        const lines = res.entities.map(
          (e) =>
            `  ${e.id.slice(0, 8)}  ${e.type.padEnd(10)} ${e.name}`
        );
        return `ID        Type       Name\n${"─".repeat(60)}\n${lines.join("\n")}`;
      }
      return "Usage: los entity <list|create>";
    }

    if (cmd === "audit") {
      if (sub === "list") {
        const dealId = parts[2];
        if (!dealId) return "Usage: los audit list <deal_id>";
        const res = await client.listAuditEvents(dealId, { limit: 10 });
        if (!res.events?.length) return "No audit events found.";
        const lines = res.events.map(
          (e) =>
            `  ${new Date(e.timestamp).toLocaleString().padEnd(22)} ${e.actor.padEnd(15)} ${e.action.padEnd(20)} ${e.object_type}`
        );
        return `Timestamp              Actor           Action               Type\n${"─".repeat(80)}\n${lines.join("\n")}`;
      }
      return "Usage: los audit list <deal_id>";
    }

    if (!cmd) return "";

    return `Unknown command: ${cmd}. Type 'los help' for available commands.`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function TerminalContent() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "system", text: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [executing, setExecuting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || executing) return;

      const cmd = input.trim();
      setInput("");
      setHistory((h) => [...h, cmd]);
      setHistoryIndex(-1);

      setLines((l) => [...l, { type: "input", text: `$ ${cmd}` }]);

      if (cmd === "clear") {
        setLines([]);
        return;
      }

      setExecuting(true);
      const client = getClient();
      if (!client) {
        setLines((l) => [
          ...l,
          { type: "error", text: "No demo session. Please refresh the page." },
        ]);
        setExecuting(false);
        return;
      }

      const output = await executeCommand(cmd, client);
      if (output) {
        setLines((l) => [...l, { type: "output", text: output }]);
      }
      setExecuting(false);
    },
    [input, executing]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex =
          historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      }
    }
  };

  return (
    <div
      className="terminal-container"
      style={{ margin: "24px", height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="terminal-header">
        <span className="terminal-dot red" />
        <span className="terminal-dot yellow" />
        <span className="terminal-dot green" />
        <span className="terminal-title">Open LOS Terminal — Demo Sandbox</span>
      </div>
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          lineHeight: 1.6,
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              color:
                line.type === "input"
                  ? "#22d3ee"
                  : line.type === "error"
                    ? "#ef4444"
                    : line.type === "system"
                      ? "#a0a0a0"
                      : "#e5e5e5",
            }}
          >
            {line.text}
          </div>
        ))}

        <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#22d3ee" }}>$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={executing}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "#e5e5e5",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              outline: "none",
              caretColor: "#22d3ee",
            }}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
          {executing && <span className="spinner" />}
        </form>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default function TerminalPage() {
  return (
    <div>
      <Nav active="Terminal" />
      <DemoGuard>
        <TerminalContent />
      </DemoGuard>
    </div>
  );
}
