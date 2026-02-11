import { Command } from 'commander';
import { getClient } from '../client.js';
import {
  formatOutput,
  handleError,
  getGlobalOptions,
  type GlobalOptions,
} from '../utils.js';

export function registerAuditCommands(program: Command): void {
  const audit = program
    .command('audit')
    .description('View audit trail');

  // List audit events
  audit
    .command('list <dealId>')
    .description('List audit events for a deal')
    .option('-t, --type <type>', 'Filter by event type')
    .option('-a, --actor <actor>', 'Filter by actor')
    .option('-l, --limit <n>', 'Limit results', '20')
    .option('-c, --cursor <cursor>', 'Pagination cursor')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listAuditEvents(dealId, {
          type: opts.type,
          actor: opts.actor,
          limit: parseInt(opts.limit),
          cursor: opts.cursor,
        });

        if (globals.format === 'table') {
          console.log(formatOutput(result.events, globals.format));
          if (result.next_cursor) {
            console.log(`\nNext cursor: ${result.next_cursor}`);
          }
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });
}
