import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { isOrganizer, requireTripMember } from "../domain/permissions.js";
import { listExpenses, listPayments } from "../domain/store.js";
import { computeBalances } from "../domain/balance.js";
import { formatOverview } from "../domain/format.js";

const composer = new Composer<Ctx>();

// /overview — the organizer's single-screen ledger: members, every expense with
// its split, current balances, and the payment history. Organizer-only on top of
// the members-only gate.
composer.command("overview", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  if (!isOrganizer(tc.trip, ctx.from?.id ?? -1)) {
    await ctx.reply("Only the organizer can view the full overview.");
    return;
  }
  const [expenses, payments] = await Promise.all([listExpenses(tc.trip.id), listPayments(tc.trip.id)]);
  const balances = computeBalances(tc.trip, expenses, payments);
  await ctx.reply(formatOverview(tc.trip, expenses, payments, balances));
});

export default composer;
