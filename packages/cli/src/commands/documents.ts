import { Command } from 'commander';
import { readFileSync } from 'fs';
import { basename } from 'path';
import { getClient } from '../client.js';
import {
  formatOutput,
  handleError,
  success,
  getGlobalOptions,
  type GlobalOptions,
} from '../utils.js';

export function registerDocumentCommands(program: Command): void {
  const doc = program
    .command('document')
    .alias('doc')
    .description('Manage deal documents');

  // Upload document
  doc
    .command('upload <dealId>')
    .description('Upload a document to a deal')
    .requiredOption('-f, --file <path>', 'File path')
    .requiredOption('-t, --type <type>', 'Document type (e.g., financial_statements, tax_returns)')
    .option('-n, --name <name>', 'Override filename')
    .option('-m, --mime <type>', 'Override MIME type')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        // Read file and convert to base64
        const content = readFileSync(opts.file);
        const base64Content = content.toString('base64');
        const filename = opts.name || basename(opts.file);

        // Detect MIME type if not specified
        let mimeType = opts.mime;
        if (!mimeType) {
          const ext = filename.split('.').pop()?.toLowerCase();
          const mimeTypes: Record<string, string> = {
            pdf: 'application/pdf',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            csv: 'text/csv',
            txt: 'text/plain',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
          };
          mimeType = mimeTypes[ext || ''] || 'application/octet-stream';
        }

        const result = await client.uploadDocument(dealId, {
          doc_type: opts.type,
          filename,
          content: base64Content,
          mime_type: mimeType,
        });

        if (globals.format === 'table') {
          success(`Uploaded document ${result.id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // List documents
  doc
    .command('list <dealId>')
    .description('List documents for a deal')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listDocuments(dealId);

        if (globals.format === 'table') {
          console.log(formatOutput(result.documents, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });
}
