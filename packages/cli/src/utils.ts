/**
 * CLI utilities for output formatting and common operations
 */

export type OutputFormat = 'json' | 'table' | 'compact';

export interface GlobalOptions {
  apiUrl?: string;
  actor?: string;
  tenantId?: string;
  format?: OutputFormat;
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

export function colorize(text: string, color: keyof typeof colors): string {
  // Check if NO_COLOR is set or not a TTY
  if (process.env.NO_COLOR || !process.stdout.isTTY) {
    return text;
  }
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Format output based on the specified format
 */
export function formatOutput(data: unknown, format: OutputFormat = 'json'): string {
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (format === 'compact') {
    return JSON.stringify(data);
  }

  // Table format
  if (Array.isArray(data)) {
    return formatTable(data);
  }

  if (typeof data === 'object' && data !== null) {
    return formatObject(data as Record<string, unknown>);
  }

  return String(data);
}

/**
 * Format an array of objects as a table
 */
export function formatTable(items: unknown[]): string {
  if (items.length === 0) {
    return colorize('(no results)', 'dim');
  }

  // Get all keys from all items
  const keys = new Set<string>();
  for (const item of items) {
    if (typeof item === 'object' && item !== null) {
      for (const key of Object.keys(item)) {
        keys.add(key);
      }
    }
  }

  const columns = Array.from(keys);

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const col of columns) {
    widths[col] = col.length;
  }

  for (const item of items) {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      for (const col of columns) {
        const val = formatValue(obj[col]);
        widths[col] = Math.max(widths[col], val.length);
      }
    }
  }

  // Cap widths at 40 characters
  for (const col of columns) {
    widths[col] = Math.min(widths[col], 40);
  }

  // Build table
  const lines: string[] = [];

  // Header
  const header = columns.map((col) => col.padEnd(widths[col])).join('  ');
  lines.push(colorize(header, 'bold'));

  // Separator
  const separator = columns.map((col) => '-'.repeat(widths[col])).join('  ');
  lines.push(colorize(separator, 'dim'));

  // Rows
  for (const item of items) {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      const row = columns
        .map((col) => {
          const val = formatValue(obj[col]);
          return truncate(val, widths[col]).padEnd(widths[col]);
        })
        .join('  ');
      lines.push(row);
    }
  }

  return lines.join('\n');
}

/**
 * Format a single object as key-value pairs
 */
export function formatObject(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  const maxKeyLength = Math.max(...Object.keys(obj).map((k) => k.length));

  for (const [key, value] of Object.entries(obj)) {
    const formattedKey = colorize(key.padEnd(maxKeyLength), 'cyan');
    const formattedValue = formatValue(value);
    lines.push(`${formattedKey}  ${formattedValue}`);
  }

  return lines.join('\n');
}

/**
 * Format a single value for display
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return colorize('-', 'dim');
  }

  if (typeof value === 'boolean') {
    return value ? colorize('yes', 'green') : colorize('no', 'red');
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return colorize('[]', 'dim');
    }
    return `[${value.length} items]`;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 1) + '…';
}

/**
 * Print success message
 */
export function success(message: string): void {
  console.log(colorize('✓', 'green'), message);
}

/**
 * Print error message and exit
 */
export function error(message: string, exitCode = 1): never {
  console.error(colorize('✗', 'red'), message);
  process.exit(exitCode);
}

/**
 * Print warning message
 */
export function warn(message: string): void {
  console.warn(colorize('!', 'yellow'), message);
}

/**
 * Print info message
 */
export function info(message: string): void {
  console.log(colorize('→', 'blue'), message);
}

/**
 * Known guard fix hints — maps unsatisfied guard items to actionable CLI commands.
 */
const GUARD_HINTS: Record<string, string> = {
  origination_outcome_proceed: 'Fix: los deal update <id> --outcome proceed',
  borrower_name:               'Fix: los deal update <id> --borrower <name>',
  jurisdiction:                'Fix: los deal update <id> --jurisdiction <code>',
  requested_amount:            'Fix: los deal update <id> --amount <amount>',
  purpose:                     'Fix: los deal update <id> --purpose <text>',
  documents_uploaded:          'Fix: los doc upload <dealId> --type <type> --file <path>  (or --data)',
  spread_created:              'Fix: los spread create <dealId> --period TTM --metrics \'{"revenue":...}\'',
};

/**
 * Handle command errors consistently.
 * For stage guard errors, prints the unsatisfied items with fix hints.
 */
export function handleError(err: unknown): never {
  if (err instanceof Error) {
    // Check if the error message was parsed from a structured API response
    // that includes guard details. The client.ts extracts error.message but
    // we can detect guard failures by the "Stage guard failed:" prefix.
    const msg = err.message;
    if (msg.startsWith('Stage guard failed:')) {
      console.error(colorize('✗', 'red'), msg);
      // Extract guard names from "Stage guard failed: item1, item2"
      const guardPart = msg.replace('Stage guard failed:', '').trim();
      const guards = guardPart.split(',').map((g: string) => g.trim());
      for (const guard of guards) {
        const hint = GUARD_HINTS[guard];
        if (hint) {
          console.error(colorize('  →', 'yellow'), hint);
        }
      }
      process.exit(1);
    }
    error(msg);
  }
  error(String(err));
}

/**
 * Parse amount input (supports suffixes like k, m, b)
 */
export function parseAmount(input: string): number {
  const match = input.toLowerCase().match(/^([\d.]+)([kmb])?$/);
  if (!match) {
    throw new Error(`Invalid amount format: ${input}`);
  }

  let value = parseFloat(match[1]);
  const suffix = match[2];

  if (suffix === 'k') value *= 1_000;
  if (suffix === 'm') value *= 1_000_000;
  if (suffix === 'b') value *= 1_000_000_000;

  // Convert to minor units (cents)
  return Math.round(value * 100);
}

/**
 * Format amount from minor units to display
 */
export function formatAmount(minorUnits: number, currency = 'USD'): string {
  const major = minorUnits / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(major);
}

/**
 * Get global options from environment and command line
 */
export function getGlobalOptions(opts: GlobalOptions): {
  apiUrl: string;
  actor: string;
  tenantId: string;
  format: OutputFormat;
} {
  return {
    apiUrl: opts.apiUrl || process.env.LOS_API_URL || 'http://localhost:3000',
    actor: opts.actor || process.env.LOS_ACTOR || 'cli',
    tenantId: opts.tenantId || process.env.LOS_TENANT_ID || 'default',
    format: opts.format || (process.env.LOS_FORMAT as OutputFormat) || 'json',
  };
}
