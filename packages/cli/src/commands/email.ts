import { Command } from 'commander';
import { readFileSync } from 'fs';
import { getClient } from '../client.js';
import {
  formatOutput,
  handleError,
  success,
  getGlobalOptions,
  type GlobalOptions,
} from '../utils.js';

export function registerEmailCommands(program: Command): void {
  const email = program
    .command('email')
    .description('Manage email communications');

  // Ingest email
  email
    .command('ingest')
    .description('Ingest an email (RFC822 format)')
    .requiredOption('-f, --file <path>', 'Path to .eml file')
    .option('-d, --deal <id>', 'Link to deal ID')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        // Read file and convert to base64
        const content = readFileSync(opts.file);
        const base64Content = content.toString('base64');

        const data: Record<string, unknown> = {
          raw_rfc822_base64: base64Content,
        };

        if (opts.deal) data.deal_id = opts.deal;

        const result = await client.ingestEmail(data as Parameters<typeof client.ingestEmail>[0]);

        if (globals.format === 'table') {
          success(`Ingested email (communication ID: ${result.communication_id})`);
          if (result.documents && (result.documents as unknown[]).length > 0) {
            console.log(`Extracted ${(result.documents as unknown[]).length} attachment(s)`);
          }
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // List communications
  program
    .command('communications <dealId>')
    .alias('comms')
    .description('List communications for a deal')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listCommunications(dealId);

        if (globals.format === 'table') {
          console.log(formatOutput(result.communications, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });
}
