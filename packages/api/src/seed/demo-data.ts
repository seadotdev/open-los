import type { AppContext } from "../server.js";

/**
 * Seeds a freshly-provisioned demo tenant with sample deals, entities,
 * relationships, financial spreads and covenants so a new user can
 * immediately explore the system without manual setup.
 */
export async function seedDemoTenant(
  ctx: AppContext,
  tenantId: string,
): Promise<void> {
  const actor = "system";

  // -----------------------------------------------------------------------
  // 1. Create 5 sample deals across different purposes / jurisdictions
  // -----------------------------------------------------------------------
  const deal1 = await ctx.dealService.create(
    {
      borrower_name: "Acme Manufacturing Ltd",
      requested_amount: 250_000_00, // $250,000 in minor units (cents)
      purpose: "Equipment financing",
      jurisdiction: "US-CA",
    },
    actor,
    tenantId,
  );

  const deal2 = await ctx.dealService.create(
    {
      borrower_name: "TechFlow Solutions Inc",
      requested_amount: 500_000_00,
      purpose: "Working capital",
      jurisdiction: "US-NY",
    },
    actor,
    tenantId,
  );

  const deal3 = await ctx.dealService.create(
    {
      borrower_name: "Green Energy Partners LLC",
      requested_amount: 1_000_000_00,
      purpose: "Project finance - solar farm",
      jurisdiction: "US-TX",
    },
    actor,
    tenantId,
  );

  const deal4 = await ctx.dealService.create(
    {
      borrower_name: "Harbor Real Estate Group",
      requested_amount: 750_000_00,
      purpose: "Commercial real estate acquisition",
      jurisdiction: "US-FL",
    },
    actor,
    tenantId,
  );

  const deal5 = await ctx.dealService.create(
    {
      borrower_name: "Pacific Logistics Corp",
      requested_amount: 150_000_00,
      purpose: "Fleet expansion",
      jurisdiction: "US-WA",
    },
    actor,
    tenantId,
  );

  // -----------------------------------------------------------------------
  // 2. Create entities (companies + key persons)
  // -----------------------------------------------------------------------
  const acmeCo = await ctx.entityService.create(
    {
      type: "company",
      name: "Acme Manufacturing Ltd",
      legal_name: "Acme Manufacturing Limited",
      registration_number: "DE-12345678",
      jurisdiction: "US-CA",
    },
    actor,
    undefined,
    tenantId,
  );

  const acmeCeo = await ctx.entityService.create(
    { type: "person", name: "Jane Smith" },
    actor,
    undefined,
    tenantId,
  );

  const techflow = await ctx.entityService.create(
    {
      type: "company",
      name: "TechFlow Solutions Inc",
      legal_name: "TechFlow Solutions Incorporated",
      registration_number: "NY-87654321",
      jurisdiction: "US-NY",
    },
    actor,
    undefined,
    tenantId,
  );

  const techflowCeo = await ctx.entityService.create(
    { type: "person", name: "Michael Chen" },
    actor,
    undefined,
    tenantId,
  );

  const greenEnergy = await ctx.entityService.create(
    {
      type: "company",
      name: "Green Energy Partners LLC",
      jurisdiction: "US-TX",
    },
    actor,
    undefined,
    tenantId,
  );

  // -----------------------------------------------------------------------
  // 3. Create relationships between entities
  // -----------------------------------------------------------------------
  await ctx.relationshipService.create(
    { from_entity_id: acmeCeo.id, to_entity_id: acmeCo.id, type: "directs" },
    actor,
  );

  await ctx.relationshipService.create(
    {
      from_entity_id: techflowCeo.id,
      to_entity_id: techflow.id,
      type: "directs",
    },
    actor,
  );

  // -----------------------------------------------------------------------
  // 4. Link primary entities to deals
  // -----------------------------------------------------------------------
  await ctx.dealService.update(
    deal1.id,
    { primary_entity_id: acmeCo.id },
    actor,
    tenantId,
  );
  await ctx.dealService.update(
    deal2.id,
    { primary_entity_id: techflow.id },
    actor,
    tenantId,
  );
  await ctx.dealService.update(
    deal3.id,
    { primary_entity_id: greenEnergy.id },
    actor,
    tenantId,
  );

  // -----------------------------------------------------------------------
  // 5. Advance deals through pipeline stages
  //    deal1 → stays at broker (initial stage)
  //    deal2 → origination
  //    deal3 → underwriting  (broker → origination → underwriting)
  //    deal4 → closing       (broker → origination → underwriting → closing)
  //    deal5 → origination
  // -----------------------------------------------------------------------
  await ctx.stageService.transition(
    deal2.id,
    { to_stage: "origination" },
    actor,
  );

  await ctx.stageService.transition(
    deal3.id,
    { to_stage: "origination" },
    actor,
  );
  await ctx.stageService.transition(
    deal3.id,
    { to_stage: "underwriting" },
    actor,
  );

  await ctx.stageService.transition(
    deal4.id,
    { to_stage: "origination" },
    actor,
  );
  await ctx.stageService.transition(
    deal4.id,
    { to_stage: "underwriting" },
    actor,
  );
  await ctx.stageService.transition(
    deal4.id,
    { to_stage: "closing" },
    actor,
  );

  await ctx.stageService.transition(
    deal5.id,
    { to_stage: "origination" },
    actor,
  );

  // -----------------------------------------------------------------------
  // 6. Create financial spreads for deal3 (in underwriting)
  // -----------------------------------------------------------------------
  await ctx.spreadService.create(
    deal3.id,
    {
      entity_id: greenEnergy.id,
      period: "2025-Q4",
      line_items: [
        { category: "revenue", label: "Total Revenue", amount: 12_000_000 },
        { category: "cogs", label: "Cost of Goods Sold", amount: 7_200_000 },
        {
          category: "operating_expense",
          label: "Operating Expenses",
          amount: 2_400_000,
        },
        {
          category: "interest_expense",
          label: "Interest Expense",
          amount: 800_000,
        },
        { category: "depreciation", label: "Depreciation", amount: 600_000 },
        { category: "tax", label: "Income Tax", amount: 400_000 },
        {
          category: "current_assets",
          label: "Current Assets",
          amount: 8_000_000,
        },
        {
          category: "current_liabilities",
          label: "Current Liabilities",
          amount: 3_000_000,
        },
        { category: "total_debt", label: "Total Debt", amount: 15_000_000 },
      ],
    },
    actor,
  );

  // -----------------------------------------------------------------------
  // 7. Create covenants for deal4 (in closing)
  // -----------------------------------------------------------------------
  await ctx.covenantService.create(
    deal4.id,
    {
      name: "Minimum DSCR",
      type: "financial",
      metric: "dscr",
      operator: ">=",
      threshold: 1.25,
      frequency: "quarterly",
    },
    actor,
  );

  await ctx.covenantService.create(
    deal4.id,
    {
      name: "Maximum Leverage",
      type: "financial",
      metric: "leverage",
      operator: "<=",
      threshold: 4.0,
      frequency: "quarterly",
    },
    actor,
  );
}
