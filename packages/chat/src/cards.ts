/**
 * Card templates for rich chat responses.
 *
 * Uses the Vercel Chat SDK JSX card system, which renders natively
 * on each platform (Block Kit on Slack, Adaptive Cards on Teams).
 *
 * Since JSX requires build tooling, we use the programmatic card API
 * for maximum compatibility.
 */

/**
 * Format a single deal as a rich card.
 */
export function formatDealCard(deal: any): any {
  const amount = deal.requested_amount ?? 0;
  const stageEmoji = stageIcon(deal.stage);

  return {
    title: `${deal.borrower_name ?? "Unknown Borrower"}`,
    fields: [
      { label: "Deal ID", value: deal.id?.substring(0, 8) ?? "—" },
      { label: "Stage", value: `${stageEmoji} ${deal.stage ?? "unknown"}` },
      { label: "Amount", value: `$${amount.toLocaleString()}` },
      { label: "Purpose", value: deal.purpose ?? "—" },
      { label: "Jurisdiction", value: deal.jurisdiction ?? "—" },
      ...(deal.created_at
        ? [{ label: "Created", value: formatDate(deal.created_at) }]
        : []),
    ],
    actions: [
      { label: "View Details", value: `/los-deal ${deal.id}` },
      { label: "Advance Stage", value: `/los-advance ${deal.id}` },
    ],
  };
}

/**
 * Format a list of deals as a card.
 */
export function formatDealListCard(deals: any[]): any {
  const rows = deals.slice(0, 15).map((d: any) => ({
    id: d.id?.substring(0, 8) ?? "—",
    borrower: d.borrower_name ?? "Unknown",
    stage: `${stageIcon(d.stage)} ${d.stage ?? "—"}`,
    amount: `$${(d.requested_amount ?? 0).toLocaleString()}`,
  }));

  return {
    title: `Active Deals (${deals.length})`,
    table: {
      headers: ["ID", "Borrower", "Stage", "Amount"],
      rows: rows.map((r) => [r.id, r.borrower, r.stage, r.amount]),
    },
    footer: deals.length > 15 ? `Showing 15 of ${deals.length} deals` : undefined,
  };
}

/**
 * Format a portfolio summary card.
 */
export function formatPortfolioCard(deals: any[]): any {
  const byStage: Record<string, { count: number; exposure: number }> = {};
  let totalExposure = 0;

  for (const d of deals) {
    const stage = d.stage ?? "unknown";
    if (!byStage[stage]) byStage[stage] = { count: 0, exposure: 0 };
    byStage[stage].count++;
    byStage[stage].exposure += d.requested_amount ?? 0;
    totalExposure += d.requested_amount ?? 0;
  }

  const stageRows = Object.entries(byStage).map(([stage, data]) => [
    `${stageIcon(stage)} ${stage}`,
    String(data.count),
    `$${data.exposure.toLocaleString()}`,
  ]);

  return {
    title: "Portfolio Summary",
    fields: [
      { label: "Total Deals", value: String(deals.length) },
      { label: "Total Exposure", value: `$${totalExposure.toLocaleString()}` },
    ],
    table: {
      headers: ["Stage", "Deals", "Exposure"],
      rows: stageRows,
    },
  };
}

/**
 * Format the help card.
 */
export function formatHelpCard(): any {
  return {
    title: "Open LOS — Chat Commands",
    sections: [
      {
        title: "Slash Commands",
        items: [
          { label: "/los-deals", description: "List active deals" },
          { label: "/los-deal <id>", description: "Get deal details" },
          { label: "/los-new-deal <name> <amount>", description: "Create a new deal" },
          { label: "/los-advance <id>", description: "Advance deal to next stage" },
          { label: "/los-portfolio", description: "Portfolio summary" },
          { label: "/los-help", description: "Show this help" },
        ],
      },
      {
        title: "Natural Language",
        items: [
          { label: "@open-los list deals", description: "Show active deals" },
          { label: "@open-los deal <id>", description: "Get deal details" },
          { label: "@open-los create deal for Acme $500k", description: "Start a new deal" },
          { label: "@open-los advance <id>", description: "Move deal forward" },
          { label: "@open-los portfolio", description: "Portfolio overview" },
        ],
      },
    ],
  };
}

// --- Helpers ---

function stageIcon(stage: string): string {
  const icons: Record<string, string> = {
    broker: "[INTAKE]",
    origination: "[ORIG]",
    underwriting: "[UW]",
    closing: "[CLOSE]",
    monitoring: "[MON]",
  };
  return icons[stage] ?? "[?]";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
