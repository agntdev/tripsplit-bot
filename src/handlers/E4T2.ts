import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireTripMember } from "../domain/permissions.js";
import { listPayments } from "../domain/store.js";
import { formatPaymentList } from "../domain/format.js";

const composer = new Composer<Ctx>();

// /payments — the members-only audit trail of recorded settlements (confirmed and
// pending). Only confirmed payments move balances (see computeBalances); this view
// is the persistent record behind that adjustment.
composer.command("payments", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  const payments = await listPayments(tc.trip.id);
  await ctx.reply(formatPaymentList(tc.trip, payments));
});

export default composer;
