import { NotFoundError } from "./errors.js";

export interface Template {
  id: string;
  name: string;
  phase: string;
  doc_type: string;
  version: string;
  required_variables?: string[];
  body: string;
}

export interface RenderInput {
  template_id: string;
  deal: Record<string, unknown>;
  overrides?: Record<string, unknown>;
}

export interface RenderOutput {
  markdown: string;
  html: string;
  template_version: string;
}

// Simple mustache-style variable replacement
function renderMustache(template: string, context: Record<string, unknown>): string {
  let result = template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = context[varName];
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  });

  // Clean up trailing whitespace on each line (when a variable at end of line is empty)
  result = result
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  return result;
}

// Simple markdown to HTML converter
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr>");

  // Tables - simple support
  // Match table blocks and convert them
  const tableRegex = /^\|(.+)\|$/gm;
  const rows: string[] = [];
  let inTable = false;
  let tableStartIndex = -1;

  const lines = html.split("\n");
  const resultLines: string[] = [];
  let tableRows: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^\|.+\|$/)) {
      // It's a table row
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      // Skip separator rows (|---|---|)
      if (!line.match(/^\|[\s\-:|]+\|$/)) {
        tableRows.push(line);
      }
    } else {
      if (inTable) {
        // End of table, render it
        if (tableRows.length > 0) {
          let tableHtml = "<table>\n";
          tableRows.forEach((row, idx) => {
            const cells = row
              .split("|")
              .filter((c) => c.trim() !== "")
              .map((c) => c.trim());
            const tag = idx === 0 ? "th" : "td";
            const rowTag = idx === 0 ? "thead" : "tbody";
            if (idx === 0) {
              tableHtml += "<thead>\n";
            } else if (idx === 1) {
              tableHtml += "<tbody>\n";
            }
            tableHtml += "<tr>";
            cells.forEach((cell) => {
              tableHtml += `<${tag}>${cell}</${tag}>`;
            });
            tableHtml += "</tr>\n";
            if (idx === 0) {
              tableHtml += "</thead>\n";
            }
          });
          if (tableRows.length > 1) {
            tableHtml += "</tbody>\n";
          }
          tableHtml += "</table>";
          resultLines.push(tableHtml);
        }
        inTable = false;
        tableRows = [];
      }
      resultLines.push(line);
    }
  }

  // Handle table at end of content
  if (inTable && tableRows.length > 0) {
    let tableHtml = "<table>\n";
    tableRows.forEach((row, idx) => {
      const cells = row
        .split("|")
        .filter((c) => c.trim() !== "")
        .map((c) => c.trim());
      const tag = idx === 0 ? "th" : "td";
      if (idx === 0) {
        tableHtml += "<thead>\n";
      } else if (idx === 1) {
        tableHtml += "<tbody>\n";
      }
      tableHtml += "<tr>";
      cells.forEach((cell) => {
        tableHtml += `<${tag}>${cell}</${tag}>`;
      });
      tableHtml += "</tr>\n";
      if (idx === 0) {
        tableHtml += "</thead>\n";
      }
    });
    if (tableRows.length > 1) {
      tableHtml += "</tbody>\n";
    }
    tableHtml += "</table>";
    resultLines.push(tableHtml);
  }

  html = resultLines.join("\n");

  // Lists (unordered)
  html = html.replace(/^-\s+(.+)$/gm, "<li>$1</li>");

  // Paragraphs - wrap remaining text blocks
  // This is a simplified approach
  html = html.replace(/\n\n+/g, "\n\n");

  return html;
}

export class TemplateService {
  private templates: Map<string, Template> = new Map();

  constructor() {}

  // Add or update a template in memory
  registerTemplate(template: Template): void {
    this.templates.set(template.id, template);
  }

  // Clear all templates
  clear(): void {
    this.templates.clear();
  }

  // Get a template by ID
  getById(id: string): Template {
    const template = this.templates.get(id);
    if (!template) {
      throw new NotFoundError(`Template ${id} not found`);
    }
    return template;
  }

  // List all templates with optional filters
  list(filters?: { phase?: string; doc_type?: string }): Template[] {
    let result = Array.from(this.templates.values());

    if (filters?.phase) {
      result = result.filter((t) => t.phase === filters.phase);
    }

    if (filters?.doc_type) {
      result = result.filter((t) => t.doc_type === filters.doc_type);
    }

    return result;
  }

  // Render a template with deal context
  render(input: RenderInput): RenderOutput {
    const template = this.getById(input.template_id);

    // Build context: deal fields first, then overrides take precedence
    const context: Record<string, unknown> = {
      ...input.deal,
      ...(input.overrides ?? {}),
    };

    const markdown = renderMustache(template.body, context);
    const html = markdownToHtml(markdown);

    return {
      markdown,
      html,
      template_version: template.version,
    };
  }
}
