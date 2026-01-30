/**
 * Extract API calls from LLM responses
 *
 * Models may format their API calls in various ways:
 * - Code blocks with HTTP syntax
 * - JSON objects describing the call
 * - Natural language descriptions
 *
 * This extractor attempts to parse all formats.
 */

import type { ExtractedApiCall } from '../types.js';

/**
 * Extract API calls from a model response
 */
export function extractApiCalls(response: string): ExtractedApiCall[] {
  const calls: ExtractedApiCall[] = [];

  // Strategy 1: Parse HTTP code blocks
  calls.push(...extractFromHttpBlocks(response));

  // Strategy 2: Parse JSON code blocks
  calls.push(...extractFromJsonBlocks(response));

  // Strategy 3: Parse curl commands
  calls.push(...extractFromCurlCommands(response));

  // Strategy 4: Parse inline API references
  if (calls.length === 0) {
    calls.push(...extractFromInlineReferences(response));
  }

  // Deduplicate
  return deduplicateCalls(calls);
}

/**
 * Extract from HTTP-formatted code blocks:
 * ```http
 * POST /v1/deals
 * X-Actor: alice
 *
 * {"borrower_name": "Test"}
 * ```
 */
function extractFromHttpBlocks(response: string): ExtractedApiCall[] {
  const calls: ExtractedApiCall[] = [];

  // Match code blocks that might contain HTTP
  const codeBlockRegex = /```(?:http|HTTP)?\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(response)) !== null) {
    const block = match[1].trim();
    const parsed = parseHttpBlock(block);
    if (parsed) {
      calls.push(parsed);
    }
  }

  return calls;
}

/**
 * Parse a single HTTP block
 */
function parseHttpBlock(block: string): ExtractedApiCall | null {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);

  if (lines.length === 0) return null;

  // First line should be: METHOD /path
  const requestLineMatch = lines[0].match(/^(GET|POST|PATCH|PUT|DELETE)\s+(\S+)/i);
  if (!requestLineMatch) return null;

  const method = requestLineMatch[1].toUpperCase();
  const path = requestLineMatch[2];

  // Extract headers
  const headers: Record<string, string> = {};
  let bodyStartIndex = 1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Empty line or JSON start indicates body
    if (line === '' || line.startsWith('{') || line.startsWith('[')) {
      bodyStartIndex = i;
      break;
    }

    // Header line: Key: Value
    const headerMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (headerMatch) {
      headers[headerMatch[1].trim()] = headerMatch[2].trim();
      bodyStartIndex = i + 1;
    }
  }

  // Extract body
  let body: unknown = undefined;
  const bodyLines = lines.slice(bodyStartIndex).filter(l => l);
  if (bodyLines.length > 0) {
    const bodyText = bodyLines.join('\n');
    try {
      body = JSON.parse(bodyText);
    } catch {
      // Body might not be valid JSON, store as string
      body = bodyText;
    }
  }

  return {
    method,
    path,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body,
    matched: false,
  };
}

/**
 * Extract from JSON code blocks describing API calls
 */
function extractFromJsonBlocks(response: string): ExtractedApiCall[] {
  const calls: ExtractedApiCall[] = [];

  const jsonBlockRegex = /```(?:json|JSON)?\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = jsonBlockRegex.exec(response)) !== null) {
    const block = match[1].trim();
    try {
      const parsed = JSON.parse(block);

      // Check if it's an API call description
      if (parsed.method && parsed.path) {
        calls.push({
          method: parsed.method.toUpperCase(),
          path: parsed.path || parsed.url || parsed.endpoint,
          headers: parsed.headers,
          body: parsed.body,
          matched: false,
        });
      }

      // Check if it's an array of calls
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.method && (item.path || item.url)) {
            calls.push({
              method: item.method.toUpperCase(),
              path: item.path || item.url,
              headers: item.headers,
              body: item.body,
              matched: false,
            });
          }
        }
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return calls;
}

/**
 * Extract from curl commands
 */
function extractFromCurlCommands(response: string): ExtractedApiCall[] {
  const calls: ExtractedApiCall[] = [];

  // Match curl commands (possibly multi-line with \)
  const curlRegex = /curl\s+(?:-[a-zA-Z]+\s+)*(?:'[^']*'|"[^"]*"|\S+)/g;
  const matches = response.match(curlRegex) || [];

  for (const curlCmd of matches) {
    const parsed = parseCurlCommand(curlCmd);
    if (parsed) {
      calls.push(parsed);
    }
  }

  return calls;
}

/**
 * Parse a curl command
 */
function parseCurlCommand(curl: string): ExtractedApiCall | null {
  let method = 'GET';
  let path = '';
  const headers: Record<string, string> = {};
  let body: unknown = undefined;

  // Extract method (-X)
  const methodMatch = curl.match(/-X\s+(\w+)/);
  if (methodMatch) {
    method = methodMatch[1].toUpperCase();
  }

  // Extract URL
  const urlMatch = curl.match(/(?:curl\s+)?(?:-[a-zA-Z]+\s+)*['"]?(https?:\/\/[^\s'"]+|\/v1[^\s'"]+)['"]?/);
  if (urlMatch) {
    const url = urlMatch[1];
    if (url.startsWith('http')) {
      try {
        const parsed = new URL(url);
        path = parsed.pathname + parsed.search;
      } catch {
        path = url;
      }
    } else {
      path = url;
    }
  }

  // Extract headers (-H)
  const headerRegex = /-H\s+['"]([^'"]+)['"]/g;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(curl)) !== null) {
    const [key, ...valueParts] = headerMatch[1].split(':');
    headers[key.trim()] = valueParts.join(':').trim();
  }

  // Extract body (-d or --data)
  const bodyMatch = curl.match(/(?:-d|--data)\s+['"]([^'"]+)['"]/);
  if (bodyMatch) {
    try {
      body = JSON.parse(bodyMatch[1]);
    } catch {
      body = bodyMatch[1];
    }
  }

  if (!path) return null;

  return {
    method,
    path,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body,
    matched: false,
  };
}

/**
 * Extract from inline references in natural language
 * "I'll call POST /v1/deals with..."
 */
function extractFromInlineReferences(response: string): ExtractedApiCall[] {
  const calls: ExtractedApiCall[] = [];

  // Pattern: METHOD /v1/path
  const inlineRegex = /\b(GET|POST|PATCH|PUT|DELETE)\s+(\/v1\/[^\s,\.\)]+)/gi;
  let match;

  while ((match = inlineRegex.exec(response)) !== null) {
    calls.push({
      method: match[1].toUpperCase(),
      path: match[2],
      matched: false,
    });
  }

  return calls;
}

/**
 * Remove duplicate API calls
 */
function deduplicateCalls(calls: ExtractedApiCall[]): ExtractedApiCall[] {
  const seen = new Set<string>();
  const unique: ExtractedApiCall[] = [];

  for (const call of calls) {
    const key = `${call.method}:${call.path}:${JSON.stringify(call.body ?? '')}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(call);
    }
  }

  return unique;
}

/**
 * Match extracted calls against expected patterns
 */
export function matchCalls(
  extracted: ExtractedApiCall[],
  expected: Array<{ method: string; pathPattern: string; critical: boolean }>
): { matched: ExtractedApiCall[]; unmatched: ExtractedApiCall[]; missing: typeof expected } {
  const matched: ExtractedApiCall[] = [];
  const unmatched: ExtractedApiCall[] = [];
  const missing = [...expected];

  for (const call of extracted) {
    let foundMatch = false;

    for (let i = 0; i < missing.length; i++) {
      const exp = missing[i];
      const pathRegex = new RegExp(exp.pathPattern);

      if (call.method === exp.method && pathRegex.test(call.path)) {
        call.matched = true;
        matched.push(call);
        missing.splice(i, 1);
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      unmatched.push(call);
    }
  }

  return { matched, unmatched, missing };
}
