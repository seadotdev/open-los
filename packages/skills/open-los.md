# Open LOS Skill

You have access to an Open LOS (Loan Origination System) instance via MCP tools.

## Available Tools

### Deal Lifecycle
- `deal.create` - Create a new lending deal (amounts in cents)
- `deal.get` - Get deal details by ID
- `deal.list` - List deals, optionally filtered by stage
- `deal.update` - Update deal fields

### Entities
- `entity.create` - Create a company or person entity
- `entity.list` - List entities

### Relationships
- `relationship.create` - Link entities (owns, guarantees, directs)
- `relationship.list` - List relationships

### Financial Analysis
- `spread.create` - Create financial spread with line items
- `spread.getRatios` - Get computed financial ratios (DSCR, leverage, etc.)

### Covenants
- `covenant.create` - Set up a covenant (financial, reporting, information)
- `covenant.test` - Test covenant compliance
- `covenant.list` - List covenants

### Facilities & Loans
- `facility.create` - Create loan facility (term_loan, revolver, letter_of_credit)
- `facility.list` - List facilities
- `loan.create` - Create loan from facility
- `loan.list` - List loans

### Stage Management
- `stage.transition` - Advance deal to next stage
- `stage.getGuards` - Check what's required for next transition

### Monitoring
- `monitoring.ingest` - Ingest bank transactions
- `monitoring.getStatus` - Get monitoring status and alerts

### Audit
- `audit.listByDeal` - View immutable audit trail

### Deposits
- `deposit.create` - Create deposit account
- `deposit.list` - List deposits

## Standard Workflow

1. Create deal with borrower info and requested amount
2. Create entities (company + guarantors/directors)
3. Link entities via relationships
4. Add financial documents and create spreads
5. Set up covenants with thresholds
6. Create facility with loan terms
7. Advance through stages: broker -> origination -> underwriting -> closing -> monitoring

## Key Concepts

- **Amounts are in cents** (minor units). $500,000 = 50000000
- **Actors**: Every action is logged with who did it. You are an AI actor.
- **Tenants**: Data is isolated per tenant. Use the default tenant unless told otherwise.
- **Stages**: broker -> origination -> underwriting -> closing -> monitoring
- **Stage guards**: Some transitions require prerequisites (e.g., spreads before underwriting)
