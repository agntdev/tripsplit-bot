import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import { isOrganizer, requireTripMember } from "../domain/permissions.js";
import { listExpenses, listPayments } from "../domain/store.js";
import { buildTripCsv } from "../domain/format.js";

const composer = new Composer<Ctx>();

// /export — organizer-only CSV of the trip's expenses (with splits) and payments,
// sent as a downloadable document. Builds the file from an in-memory buffer, so
// there's no temp-file handling.
composer.command("export", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  if (!isOrganizer(tc.trip, ctx.from?.id ?? -1)) {
    await ctx.reply("Only the organizer can export the trip.");
    return;
  }
  const [expenses, payments] = await Promise.all([listExpenses(tc.trip.id), listPayments(tc.trip.id)]);
  const csv = buildTripCsv(tc.trip, expenses, payments);
  const file = new InputFile(Buffer.from(csv, "utf8"), `${tc.trip.id}.csv`);
  await ctx.replyWithDocument(file, {
    caption: `CSV export for "${tc.trip.name}" — ${expenses.length} expense(s), ${payments.length} payment(s).`,
  });
});

export default composer;
