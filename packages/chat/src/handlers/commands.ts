/**
 * Slash command handlers for Open LOS chat bot.
 *
 * Commands:
 *   /los-deals              — List active deals
 *   /los-deal <id>          — Get deal details
 *   /los-new-deal           — Create a new deal (interactive)
 *   /los-advance <id>       — Advance deal to next stage
 *   /los-portfolio           — Portfolio summary
 *   /los-help               — Show available commands
 */

import type { Chat } from "chat";
import { createAgentServices } from "@open-los/agent";
import { LoanOriginationAgent } from "@open-los/agent";
import type { BotContext } from "../types.js";
import { formatDealCard, formatDealListCard, formatPortfolioCard, formatHelpCard } from "../cards.js";

export function registerSlashCommands(bot: Chat, ctx: BotContext): void {
  // /los-deals — List active deals
  bot.onSlashCommand("/los-deals", async (thread, _command) => {
    try {
      const services = createAgentServices(ctx.coreServices, {
        tenantId: ctx.defaultTenantId,
        actor: `chat:${thread.userId ?? "unknown"}`,
      });

      const deals = await services.deals.list({ limit: 20 });
      const dealList = Array.isArray(deals) ? deals : [];

      if (dealList.length === 0) {
        await thread.post("No active deals found.");
        return;
      }

      await thread.postCard(formatDealListCard(dealList));
    } catch (err: any) {
      await thread.post(`Failed to list deals: ${err?.message ?? "unknown error"}`);
    }
  });

  // /los-deal <id> — Get deal details
  bot.onSlashCommand("/los-deal", async (thread, command) => {
    const dealId = command.text?.trim();
    if (!dealId) {
      await thread.post("Usage: `/los-deal <deal-id>`");
      return;
    }

    try {
      const services = createAgentServices(ctx.coreServices, {
        tenantId: ctx.defaultTenantId,
        actor: `chat:${thread.userId ?? "unknown"}`,
      });

      const deal = await services.deals.get(dealId);
      await thread.postCard(formatDealCard(deal));
    } catch (err: any) {
      await thread.post(`Deal not found: ${err?.message ?? "unknown error"}`);
    }
  });

  // /los-new-deal — Create a new deal
  bot.onSlashCommand("/los-new-deal", async (thread, command) => {
    const text = command.text?.trim() ?? "";

    // Parse "BorrowerName 500000 working_capital UK" format
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      await thread.post(
        "Usage: `/los-new-deal <borrower_name> <amount> [purpose] [jurisdiction]`\n" +
        "Example: `/los-new-deal \"Acme Ltd\" 500000 working_capital UK`"
      );
      return;
    }

    // Handle quoted borrower name
    let borrowerName: string;
    let remaining: string[];
    if (text.startsWith('"')) {
      const endQuote = text.indexOf('"', 1);
      if (endQuote === -1) {
        borrowerName = parts[0];
        remaining = parts.slice(1);
      } else {
        borrowerName = text.substring(1, endQuote);
        remaining = text.substring(endQuote + 1).trim().split(/\s+/).filter(Boolean);
      }
    } else {
      borrowerName = parts[0];
      remaining = parts.slice(1);
    }

    const amount = parseInt(remaining[0] ?? "0", 10);
    const purpose = remaining[1] ?? "working_capital";
    const jurisdiction = remaining[2] ?? "US";

    if (!amount || amount <= 0) {
      await thread.post("Invalid amount. Please provide a positive number.");
      return;
    }

    try {
      const services = createAgentServices(ctx.coreServices, {
        tenantId: ctx.defaultTenantId,
        actor: `chat:${thread.userId ?? "unknown"}`,
      });

      const deal = await services.deals.create({
        borrower_name: borrowerName,
        requested_amount: amount,
        purpose,
        jurisdiction,
        tenant_id: ctx.defaultTenantId,
      });

      await thread.post(
        `Deal created for **${borrowerName}**\n` +
        `- Deal ID: \`${deal.id}\`\n` +
        `- Amount: $${amount.toLocaleString()}\n` +
        `- Purpose: ${purpose}\n` +
        `- Stage: ${deal.stage ?? "broker"}\n\n` +
        `Use \`/los-deal ${deal.id}\` to view details.`
      );
    } catch (err: any) {
      await thread.post(`Failed to create deal: ${err?.message ?? "unknown error"}`);
    }
  });

  // /los-advance <id> — Advance deal to next stage
  bot.onSlashCommand("/los-advance", async (thread, command) => {
    const dealId = command.text?.trim();
    if (!dealId) {
      await thread.post("Usage: `/los-advance <deal-id>`");
      return;
    }

    try {
      const services = createAgentServices(ctx.coreServices, {
        tenantId: ctx.defaultTenantId,
        actor: `chat:${thread.userId ?? "unknown"}`,
      });

      const deal = await services.deals.get(dealId);
      const nextStageMap: Record<string, string> = {
        broker: "origination",
        origination: "underwriting",
        underwriting: "closing",
        closing: "monitoring",
      };

      const nextStage = nextStageMap[deal.stage];
      if (!nextStage) {
        await thread.post(`Deal is in **${deal.stage}** stage — cannot advance further.`);
        return;
      }

      await services.stages.transition(dealId, nextStage, {
        actor: `chat:${thread.userId ?? "unknown"}`,
        rationale: "Advanced via chat command",
        override: true,
        override_rationale: "Chat operator override",
      });

      await thread.post(
        `Deal **${deal.borrower_name}** advanced: ${deal.stage} → **${nextStage}**`
      );
    } catch (err: any) {
      await thread.post(`Failed to advance deal: ${err?.message ?? "unknown error"}`);
    }
  });

  // /los-portfolio — Portfolio summary
  bot.onSlashCommand("/los-portfolio", async (thread, _command) => {
    try {
      const services = createAgentServices(ctx.coreServices, {
        tenantId: ctx.defaultTenantId,
        actor: `chat:${thread.userId ?? "unknown"}`,
      });

      const deals = await services.deals.list({});
      const dealList = Array.isArray(deals) ? deals : [];

      await thread.postCard(formatPortfolioCard(dealList));
    } catch (err: any) {
      await thread.post(`Failed to get portfolio: ${err?.message ?? "unknown error"}`);
    }
  });

  // /los-help — Show available commands
  bot.onSlashCommand("/los-help", async (thread, _command) => {
    await thread.postCard(formatHelpCard());
  });
}
