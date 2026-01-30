import { NotFoundError } from "./errors.js";
// Simple mustache-style variable replacement
function renderMustache(template, context) {
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
function markdownToHtml(markdown) {
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
    const rows = [];
    let inTable = false;
    let tableStartIndex = -1;
    const lines = html.split("\n");
    const resultLines = [];
    let tableRows = [];
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
        }
        else {
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
                        }
                        else if (idx === 1) {
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
            }
            else if (idx === 1) {
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
    templates = new Map();
    constructor() { }
    // Add or update a template in memory
    registerTemplate(template) {
        this.templates.set(template.id, template);
    }
    // Clear all templates
    clear() {
        this.templates.clear();
    }
    // Get a template by ID
    getById(id) {
        const template = this.templates.get(id);
        if (!template) {
            throw new NotFoundError(`Template ${id} not found`);
        }
        return template;
    }
    // List all templates with optional filters
    list(filters) {
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
    render(input) {
        const template = this.getById(input.template_id);
        // Build context: deal fields first, then overrides take precedence
        const context = {
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
//# sourceMappingURL=template.js.map