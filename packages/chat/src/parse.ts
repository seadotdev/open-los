/**
 * Parse natural language and structured commands from chat messages.
 */

import type { ParsedCommand } from "./types.js";

// UUID pattern: 8-4-4-4-12 hex chars
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
// Short UUID: first 8 chars of a UUID
const SHORT_ID_RE = /\b([0-9a-f]{8})\b/i;

export function parseCommand(text: string): ParsedCommand {
  // Strip bot mention prefixes (e.g., "<@U123456> list deals")
  const cleaned = text.replace(/<@[^>]+>\s*/g, "").trim();
  const lower = cleaned.toLowerCase();

  // Extract deal ID if present
  const uuidMatch = cleaned.match(UUID_RE);
  const shortMatch = cleaned.match(SHORT_ID_RE);
  const dealId = uuidMatch?.[0] ?? shortMatch?.[1];

  // --- Pattern matching ---

  // Help
  if (/^help$/i.test(lower) || /^(how|what)\s+(can|do)/i.test(lower)) {
    return { action: "help", rawText: cleaned };
  }

  // List deals
  if (
    /\b(list|show|get|all)\s+(deal|loan)s?\b/i.test(lower) ||
    /^deals$/i.test(lower)
  ) {
    return { action: "list_deals", rawText: cleaned };
  }

  // Portfolio
  if (/\b(portfolio|summary|overview|dashboard)\b/i.test(lower)) {
    return { action: "portfolio", rawText: cleaned };
  }

  // Advance / progress deal
  if (/\b(advance|progress|move|push|next\s+stage)\b/i.test(lower) && dealId) {
    return { action: "advance_deal", dealId, rawText: cleaned };
  }

  // Create deal
  if (/\b(create|new|add|submit|start)\s+(a\s+)?(deal|loan)\b/i.test(lower)) {
    // Try to extract params from the message
    const params: Record<string, string> = {};

    // Match "for <borrower>"
    const forMatch = cleaned.match(/\bfor\s+["']?([^"',]+?)["']?(?:\s*,|\s+\d|\s*$)/i);
    if (forMatch) params.borrower = forMatch[1].trim();

    // Match dollar amount
    const amountMatch = cleaned.match(/\$?([\d,]+(?:\.\d{2})?)\b/);
    if (amountMatch) params.amount = amountMatch[1].replace(/,/g, "");

    // Match purpose keywords
    const purposes = ["working_capital", "expansion", "acquisition", "refinance", "equipment", "real_estate"];
    for (const p of purposes) {
      if (lower.includes(p.replace("_", " ")) || lower.includes(p)) {
        params.purpose = p;
        break;
      }
    }

    return { action: "create_deal", params, rawText: cleaned };
  }

  // Get deal / status (must come after more specific patterns)
  if (
    (/\b(deal|status|details?|info)\b/i.test(lower) && dealId) ||
    (dealId && lower.split(/\s+/).length <= 3)
  ) {
    return { action: "get_deal", dealId, rawText: cleaned };
  }

  return { action: "unknown", dealId, rawText: cleaned };
}
