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

export function registerMonitoringCommands(program: Command): void {
  const monitoring = program
    .command('monitoring')
    .alias('monitor')
    .description('Manage deal monitoring and bank transactions');

  // Ingest transactions
  monitoring
    .command('ingest <dealId>')
    .description('Ingest bank transactions or monitoring data')
    .requiredOption('-s, --source <type>', 'Source type (bank_transactions/accounting)')
    .option('-f, --file <path>', 'JSON file with transactions')
    .option('-t, --transactions <json>', 'Transactions as JSON array')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        let transactions: Array<{
          date: string;
          amount: number;
          description?: string;
          category?: string;
        }>;

        if (opts.file) {
          const content = readFileSync(opts.file, 'utf-8');
          transactions = JSON.parse(content);
        } else if (opts.transactions) {
          transactions = JSON.parse(opts.transactions);
        } else {
          throw new Error('Either --file or --transactions must be specified');
        }

        const result = await client.ingestMonitoringData(dealId, {
          source_type: opts.source,
          transactions,
        });

        if (globals.format === 'table') {
          success(`Ingested ${result.records_accepted} records (ingestion ID: ${result.ingestion_id})`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Get monitoring status
  monitoring
    .command('status <dealId>')
    .description('Get monitoring status including liquidity analysis')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getMonitoringStatus(dealId);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });
}
