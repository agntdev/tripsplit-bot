import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireTripMember } from "../domain/permissions.js";
import { listExpenses, listPayments } from "../domain/store.js";
import { computeBalances, greedySettlement } from "../domain/balance.js";
import { formatSettlement } from "../domain/format.js";

const composer = new Composer<Ctx>();

// /settle — the smallest set of payments that clears everyone's balance, via
// greedy largest-creditor/largest-debtor matching. Members-only; recomputed from
// the same immutable records as /balance.
composer.command("settle", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  const [expenses, payments] = await Promise.all([listExpenses(tc.trip.id), listPayments(tc.trip.id)]);
  const balances = computeBalances(tc.trip, expenses, payments);
  const transfers = greedySettlement(balances);
  await ctx.reply(formatSettlement(tc.trip, transfers));
});

export default composer;
