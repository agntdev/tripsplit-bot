import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireTripMember } from "../domain/permissions.js";
import { listExpenses, listPayments } from "../domain/store.js";
import { computeBalances } from "../domain/balance.js";
import { formatBalances } from "../domain/format.js";

const composer = new Composer<Ctx>();

// /balance — each member's net position, recomputed from the immutable expense
// and confirmed-payment records (members-only). Confirmed payments are already
// folded in here, so once E4 records them this view reflects them automatically.
composer.command("balance", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  const [expenses, payments] = await Promise.all([listExpenses(tc.trip.id), listPayments(tc.trip.id)]);
  const balances = computeBalances(tc.trip, expenses, payments);
  await ctx.reply(formatBalances(tc.trip, balances));
});

export default composer;
