import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireTripMember } from "../domain/permissions.js";
import { listExpenses } from "../domain/store.js";
import { formatExpenseList } from "../domain/format.js";

const composer = new Composer<Ctx>();

// /expenses — the trip's expense summary, posted to whoever asks IF they're a
// member (the visibility rule: amounts stay members-only). Each /expense already
// posts a one-line confirmation when logged; this is the full ledger on demand.
composer.command("expenses", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  const expenses = await listExpenses(tc.trip.id);
  await ctx.reply(formatExpenseList(tc.trip, expenses));
});

export default composer;
