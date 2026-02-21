#!/usr/bin/env node
/**
 * Open LOS CLI
 *
 * Command-line interface for interacting with the Open LOS API.
 * Designed for both human operators and AI agents (Claude Code, etc.)
 *
 * Usage:
 *   los <command> [subcommand] [options]
 *
 * Environment variables:
 *   LOS_API_URL    - API base URL (default: http://localhost:3000)
 *   LOS_ACTOR      - Actor ID for audit trail (default: cli)
 *   LOS_TENANT_ID  - Tenant ID (default: default)
 *   LOS_FORMAT     - Output format: json, table, compact (default: json)
 *   NO_COLOR       - Disable colored output
 */

import { Command } from 'commander';
import { getClient } from './client.js';
import { formatOutput, handleError, getGlobalOptions, type GlobalOptions } from './utils.js';
import { registerDealCommands } from './commands/deals.js';
import { registerEntityCommands } from './commands/entities.js';
import { registerRelationshipCommands } from './commands/relationships.js';
import { registerDocumentCommands } from './commands/documents.js';
import { registerCovenantCommands } from './commands/covenants.js';
import { registerFacilityCommands } from './commands/facilities.js';
import { registerLoanCommands } from './commands/loans.js';
import { registerSpreadCommands } from './commands/spread.js';
import { registerMonitoringCommands } from './commands/monitoring.js';
import { registerAuditCommands } from './commands/audit.js';
import { registerTemplateCommands } from './commands/templates.js';
import { registerEmailCommands } from './commands/email.js';
import { registerDepositCommands } from './commands/deposits.js';
import { registerShadowCommands } from '@open-los/shadow-cli';

type CommandRegistrar = (program: Command) => void;

const foundationalCommandRegistrars: CommandRegistrar[] = [
  registerDealCommands,
  registerEntityCommands,
  registerRelationshipCommands,
  registerDocumentCommands,
  registerAuditCommands,
];

const underwritingCommandRegistrars: CommandRegistrar[] = [
  registerCovenantCommands,
  registerSpreadCommands,
  registerTemplateCommands,
];

const servicingCommandRegistrars: CommandRegistrar[] = [
  registerFacilityCommands,
  registerLoanCommands,
  registerMonitoringCommands,
  registerEmailCommands,
  registerDepositCommands,
];

const integrationCommandRegistrars: CommandRegistrar[] = [registerShadowCommands];

const allCommandRegistrars: CommandRegistrar[] = [
  ...foundationalCommandRegistrars,
  ...underwritingCommandRegistrars,
  ...servicingCommandRegistrars,
  ...integrationCommandRegistrars,
];

const program = new Command();

program
  .name('los')
  .description('Open LOS CLI - Command-line interface for B2B lending operations')
  .version('0.1.0')
  .option('--api-url <url>', 'API base URL', process.env.LOS_API_URL || 'http://localhost:3000')
  .option('--actor <id>', 'Actor ID for audit trail', process.env.LOS_ACTOR || 'cli')
  .option('--tenant-id <id>', 'Tenant ID', process.env.LOS_TENANT_ID || 'default')
  .option('--format <format>', 'Output format (json/table/compact)', process.env.LOS_FORMAT || 'json');

// Health check command
program
  .command('health')
  .description('Check API health')
  .action(async (opts, cmd) => {
    try {
      const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
      const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });
      const result = await client.health();
      console.log(formatOutput(result, globals.format));
    } catch (err) {
      handleError(err);
    }
  });

// Register all command groups
for (const register of allCommandRegistrars) {
  register(program);
}

// Parse and execute
program.parse();
