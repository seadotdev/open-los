import { Command } from 'commander';
import { getClient } from '../client.js';
import {
  formatOutput,
  handleError,
  success,
  getGlobalOptions,
  type GlobalOptions,
} from '../utils.js';

export function registerEntityCommands(program: Command): void {
  const entity = program
    .command('entity')
    .description('Manage entities (companies and people)');

  // Create entity
  entity
    .command('create')
    .description('Create a new entity')
    .requiredOption('-t, --type <type>', 'Entity type (company/person)')
    .requiredOption('-n, --name <name>', 'Entity name')
    .option('--legal-name <name>', 'Legal name')
    .option('--reg-number <number>', 'Registration number')
    .option('-j, --jurisdiction <code>', 'Jurisdiction')
    .option('--lei <lei>', 'Legal Entity Identifier')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {
          type: opts.type,
          name: opts.name,
        };

        if (opts.legalName) data.legal_name = opts.legalName;
        if (opts.regNumber) data.registration_number = opts.regNumber;
        if (opts.jurisdiction) data.jurisdiction = opts.jurisdiction;
        if (opts.lei) data.lei = opts.lei;

        const result = await client.createEntity(data as Parameters<typeof client.createEntity>[0]);

        if (globals.format === 'table') {
          success(`Created entity ${result.id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // List entities
  entity
    .command('list')
    .description('List entities')
    .option('-t, --type <type>', 'Filter by type (company/person)')
    .option('-l, --limit <n>', 'Limit results', '20')
    .option('-c, --cursor <cursor>', 'Pagination cursor')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listEntities({
          type: opts.type,
          limit: parseInt(opts.limit),
          cursor: opts.cursor,
        });

        if (globals.format === 'table') {
          console.log(formatOutput(result.entities, globals.format));
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

  // Get entity
  entity
    .command('get <id>')
    .description('Get entity details')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getEntity(id);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Update entity
  entity
    .command('update <id>')
    .description('Update entity fields')
    .option('-n, --name <name>', 'Entity name')
    .option('--legal-name <name>', 'Legal name')
    .option('--reg-number <number>', 'Registration number')
    .option('-j, --jurisdiction <code>', 'Jurisdiction')
    .option('--lei <lei>', 'Legal Entity Identifier')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {};

        if (opts.name) data.name = opts.name;
        if (opts.legalName) data.legal_name = opts.legalName;
        if (opts.regNumber) data.registration_number = opts.regNumber;
        if (opts.jurisdiction) data.jurisdiction = opts.jurisdiction;
        if (opts.lei) data.lei = opts.lei;

        const result = await client.updateEntity(id, data);

        if (globals.format === 'table') {
          success(`Updated entity ${id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Delete entity
  entity
    .command('delete <id>')
    .description('Delete an entity')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        await client.deleteEntity(id);
        success(`Deleted entity ${id}`);
      } catch (err) {
        handleError(err);
      }
    });
}
