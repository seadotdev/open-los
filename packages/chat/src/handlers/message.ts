/**
 * Handle messages in subscribed threads.
 *
 * Once a thread is subscribed (after an @mention or slash command),
 * subsequent messages are handled conversationally.
 */

import { createAgentServices } from "@open-los/agent";
import type { BotContext } from "../types.js";
import { parseCommand } from "../parse.js";
import { formatDealCard } from "../cards.js";

export async function handleMessage(
  thread: any,
  message: any,
  ctx: BotContext
): Promise<void> {
  const text = message.text ?? "";

  // Ignore bot's own messages
  if (message.isBot) return;

  const command = parseCommand(text);

  const services = createAgentServices(ctx.coreServices, {
    tenantId: ctx.defaultTenantId,
    actor: `chat:${thread.userId ?? message.userId ?? "unknown"}`,
  });

  try {
    switch (command.action) {
      case "list_deals": {
        const deals = await services.deals.list({ limit: 10 });
        const dealList = Array.isArray(deals) ? deals : [];
        if (dealList.length === 0) {
          await thread.post("No active deals.");
        } else {
          const lines = dealList.map(
            (d: any) =>
              `- \`${d.id.substring(0, 8)}\` **${d.borrower_name}** — ${d.stage} — $${(d.requested_amount ?? 0).toLocaleString()}`
          );
          await thread.post(`**Active Deals**\n${lines.join("\n")}`);
        }
        break;
      }

      case "get_deal":
      case "deal_status": {
        if (!command.dealId) {
          await thread.post("Which deal? Include a deal ID.");
          return;
        }
        const deal = await services.deals.get(command.dealId);
        await thread.postCard(formatDealCard(deal));
        break;
      }

      case "advance_deal": {
        if (!command.dealId) {
          await thread.post("Which deal? Include a deal ID.");
          return;
        }

        const deal = await services.deals.get(command.dealId);
        const nextStageMap: Record<string, string> = {
          broker: "origination",
          origination: "underwriting",
          underwriting: "closing",
          closing: "monitoring",
        };

        const nextStage = nextStageMap[deal.stage];
        if (!nextStage) {
          await thread.post(`Deal is in **${deal.stage}** — cannot advance further.`);
          return;
        }

        await services.stages.transition(command.dealId, nextStage, {
          actor: `chat:${message.userId ?? "unknown"}`,
          rationale: "Advanced via chat thread",
          override: true,
          override_rationale: "Chat operator override",
        });

        await thread.post(
          `Deal **${deal.borrower_name}** advanced: ${deal.stage} → **${nextStage}**`
        );
        break;
      }

      case "help": {
        await thread.post(
          "**Commands you can use in this thread:**\n" +
          "- `list deals` — Show active deals\n" +
          "- `deal <id>` — Get deal details\n" +
          "- `status <id>` — Check deal status\n" +
          "- `advance <id>` — Move deal to next stage\n" +
          "- `help` — Show this message"
        );
        break;
      }

      default: {
        // Try LLM for conversational responses
        if (ctx.llmClient) {
          const prompt = `You are Open LOS, an AI lending assistant in a chat thread.
The user said: "${text}"

Respond helpfully and concisely. If they're asking about deals or loan operations,
suggest using commands like: list deals, deal <id>, status <id>, advance <id>.
Keep responses under 150 words.`;

          try {
            const response = await ctx.llmClient.complete(prompt);
            await thread.post(response);
          } catch {
            await thread.post("I can help you manage deals. Try `help` for commands.");
          }
        } else {
          // Only respond if it looks like it's directed at us
          const looksDirected = text.length < 100 && /\?|deal|loan|help|status/i.test(text);
          if (looksDirected) {
            await thread.post("Try `help` for available commands.");
          }
        }
      }
    }
  } catch (err: any) {
    await thread.post(`Error: ${err?.message ?? "something went wrong"}`);
  }
}
