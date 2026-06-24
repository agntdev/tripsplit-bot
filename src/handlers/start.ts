import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { menuKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

/**
 * The bot's top-level features. Each entry becomes a button in the /start main
 * menu (callback `menu:<key>`); tapping it points the user at the slash command
 * that drives that feature, so the menu is a working launcher from day one.
 * Later tasks add the actual command handlers — the menu keeps routing to them.
 */
const MENU_ITEMS = [
  { key: "newtrip", label: "🧳 New trip", command: "/newtrip", hint: "Create a trip, pick its currency, and add members." },
  { key: "expense", label: "💸 Log expense", command: "/expense", hint: "Record who paid, the amount, and how to split it." },
  { key: "balance", label: "📊 Balances", command: "/balance", hint: "See each member's net balance — who owes whom." },
  { key: "settle", label: "🤝 Settle up", command: "/settle", hint: "Get the fewest payments that clear all debts." },
  { key: "overview", label: "📋 Overview", command: "/overview", hint: "Organizer-only full ledger and CSV export." },
  { key: "help", label: "❓ Help", command: "/help", hint: "List every command the bot understands." },
] as const;

// Kept exactly as the shipped template welcome so the scaffold's start.json
// dialog spec stays green; the inline menu is attached as extra markup.
const WELCOME = "Welcome! I am ready to help.";

function mainMenu() {
  return menuKeyboard(
    MENU_ITEMS.map((item) => ({ text: item.label, data: `menu:${item.key}` })),
    2,
  );
}

composer.command("start", async (ctx) => {
  await ctx.reply(WELCOME, { reply_markup: mainMenu() });
});

composer.callbackQuery(/^menu:/, async (ctx) => {
  const key = (ctx.callbackQuery.data ?? "").slice("menu:".length);
  const item = MENU_ITEMS.find((m) => m.key === key);
  await ctx.answerCallbackQuery();
  if (!item) {
    await ctx.reply("That menu action isn't available anymore. Send /start to see the menu again.");
    return;
  }
  await ctx.reply(`${item.label}\n\n${item.hint}\n\nTap or type ${item.command} to begin.`);
});

export default composer;
