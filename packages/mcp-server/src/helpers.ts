import { AppError } from "@open-los/core";

// MCP tool response helpers

export function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function toolError(err: unknown) {
  const { code, message } = formatError(err);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: { code, message } }) }],
    isError: true,
  };
}

export function formatError(err: unknown): { code: string; message: string } {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof Error) {
    return { code: "INTERNAL_ERROR", message: err.message };
  }
  return { code: "INTERNAL_ERROR", message: String(err) };
}

// CLI/REPL formatting

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatCompact(data: unknown): string {
  if (data == null) return "null";
  if (typeof data !== "object") return String(data);

  const obj = data as Record<string, unknown>;

  // If it has an id, show id + key fields
  if (obj.id) {
    const parts: string[] = [String(obj.id)];
    if (obj.name) parts.push(String(obj.name));
    if (obj.borrower_name) parts.push(String(obj.borrower_name));
    if (obj.stage) parts.push(`stage=${obj.stage}`);
    if (obj.status) parts.push(`status=${obj.status}`);
    if (obj.action) parts.push(`action=${obj.action}`);
    if (obj.risk_grade) parts.push(`grade=${obj.risk_grade}`);
    return parts.join(" | ");
  }

  // For arrays, summarize count
  if (Array.isArray(data)) {
    return `[${data.length} items]`;
  }

  return JSON.stringify(data);
}

// Amount parsing (supports k/m/b suffixes, returns cents)
export function parseAmount(input: string): number {
  const str = input.trim().toLowerCase().replace(/[$,]/g, "");
  const suffixes: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };

  for (const [suffix, multiplier] of Object.entries(suffixes)) {
    if (str.endsWith(suffix)) {
      const num = parseFloat(str.slice(0, -1));
      return Math.round(num * multiplier * 100);
    }
  }

  const num = parseFloat(str);
  // If the number looks like dollars (has decimal or is > 1000), convert to cents
  if (str.includes(".") || num >= 100) {
    return Math.round(num * 100);
  }
  // Already in cents
  return num;
}
