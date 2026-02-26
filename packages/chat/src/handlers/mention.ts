/**
 * Handle @mentions of the bot.
 *
 * When someone @mentions the bot, we parse the message for intent
 * and respond appropriately.
 */

import { createAgentServices } from "@open-los/agent";
import type { BotContext, ParsedCommand } from "../types.js";
import { formatDealCard, formatDealListCard, formatHelpCard } from "../cards.js";
import { parseCommand } from "../parse.js";

export async function handleMention(
  thread: any,
  ctx: BotContext
): Promise<void> {
  const text = thread.text ?? "";
  const command = parseCommand(text);

  const services = createAgentServices(ctx.coreServices, {
    tenantId: ctx.defaultTenantId,
    actor: `chat:${thread.userId ?? "unknown"}`,
  });

  try {
    switch (command.action) {
      case "list_deals": {
        const deals = await services.deals.list({ limit: 10 });
        const dealList = Array.isArray(deals) ? deals : [];
        if (dealList.length === 0) {
          await thread.post("No active deals found.");
        } else {
          await thread.postCard(formatDealListCard(dealList));
        }
        break;
      }

      case "get_deal": {
        if (!command.dealId) {
          await thread.post("Which deal? Please include a deal ID.");
          return;
        }
        const deal = await services.deals.get(command.dealId);
        await thread.postCard(formatDealCard(deal));
        break;
      }

      case "create_deal": {
        const name = command.params?.borrower ?? "Unknown";
        const amount = parseInt(command.params?.amount ?? "0", 10);
        const deal = await services.deals.create({
          borrower_name: name,
          requested_amount: amount || 100000,
          purpose: command.params?.purpose ?? "working_capital",
          jurisdiction: command.params?.jurisdiction ?? "US",
          tenant_id: ctx.defaultTenantId,
        });
        await thread.post(
          `Deal created for **${name}**\n` +
          `Deal ID: \`${deal.id}\`\n` +
          `Stage: ${deal.stage ?? "broker"}`
        );
        break;
      }

      case "deal_status": {
        if (!command.dealId) {
          await thread.post("Which deal? Please include a deal ID.");
          return;
        }
        const deal = await services.deals.get(command.dealId);
        await thread.postCard(formatDealCard(deal));
        break;
      }

      case "portfolio": {
        const deals = await services.deals.list({});
        const dealList = Array.isArray(deals) ? deals : [];
        const byStage: Record<string, number> = {};
        let totalExposure = 0;
        for (const d of dealList) {
          byStage[d.stage] = (byStage[d.stage] ?? 0) + 1;
          totalExposure += d.requested_amount ?? 0;
        }

        const stageLines = Object.entries(byStage)
          .map(([stage, count]) => `- ${stage}: ${count} deals`)
          .join("\n");

        await thread.post(
          `**Portfolio Summary**\n` +
          `Total deals: ${dealList.length}\n` +
          `Total exposure: $${totalExposure.toLocaleString()}\n\n` +
          `By stage:\n${stageLines || "- (none)"}`
        );
        break;
      }

      case "help": {
        await thread.postCard(formatHelpCard());
        break;
      }

      case "unknown":
      default: {
        // If we have an LLM client, try natural language
        if (ctx.llmClient) {
          await handleNaturalLanguage(thread, text, services, ctx);
        } else {
          await thread.post(
            "I didn't understand that. Try:\n" +
            "- `list deals` or `show deals`\n" +
            "- `deal <id>` or `status <id>`\n" +
            "- `create deal <name> <amount>`\n" +
            "- `portfolio`\n" +
            "- `help`"
          );
        }
      }
    }
  } catch (err: any) {
    await thread.post(`Something went wrong: ${err?.message ?? "unknown error"}`);
  }
}

async function handleNaturalLanguage(
  thread: any,
  text: string,
  services: any,
  ctx: BotContext
): Promise<void> {
  if (!ctx.llmClient) return;

  const prompt = `You are Open LOS, an AI-powered loan origination system assistant in a chat channel.
The user said: "${text}"

You can help with:
- Listing deals (mention the /los-deals command)
- Getting deal details (mention the /los-deal command)
- Creating new deals (mention the /los-new-deal command)
- Advancing deals through stages (mention the /los-advance command)
- Portfolio overview (mention the /los-portfolio command)

Respond concisely. If the user is asking about something you can help with,
explain how they can use the available commands. If they're asking a general
lending question, answer briefly. Keep responses under 200 words.`;

  try {
    const response = await ctx.llmClient.complete(prompt);
    await thread.post(response);
  } catch {
    await thread.post(
      "I can help you manage deals. Try `help` to see available commands."
    );
  }
}
