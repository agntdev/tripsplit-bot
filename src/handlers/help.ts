import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

// /help lists the bot's command surface. Kept as plain text (no parse_mode) so
// it can never trip Telegram's Markdown parser. The global unknown-command
// fallback and error boundary already live in buildBot() — not re-added here.
const HELP_TEXT = [
  "🤝 TripSplit — split trip expenses with your group.",
  "",
  "Commands:",
  "/start — show the main menu",
  "/newtrip — create a trip (name + currency) and add members",
  "/expense — log an expense and choose how to split it",
  "/balance — see each member's net balance (who owes whom)",
  "/settle — suggest the fewest payments that clear all debts",
  "/paid — record an off-platform payment you made",
  "/overview — organizer-only full ledger and CSV export",
  "/leavetrip — leave the current trip (your history is kept)",
  "/help — show this message",
  "",
  "Tip: most of these are also one tap away on the /start menu.",
].join("\n");

composer.command("help", async (ctx) => {
  await ctx.reply(HELP_TEXT);
});

export default composer;
