import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { confirmKeyboard } from "../toolkit/index.js";
import { clearFlow, getFlow, setFlow } from "../domain/flow.js";
import { requireTripMember } from "../domain/permissions.js";
import { addExpense, listExpenses } from "../domain/store.js";
import { evenSplit, formatAmount, parseAmount } from "../domain/money.js";
import type { Expense, Member, Share, Trip } from "../domain/types.js";

const composer = new Composer<Ctx>();
const FLOW = "expense";

interface ExpenseData {
  amountMinor?: number;
  description?: string;
  [k: string]: unknown;
}

/** Active members are the default participants; the actor is the payer. */
function buildShares(trip: Trip, amountMinor: number, payerId: string): { participants: Member[]; shares: Share[] } {
  const participants = trip.members.filter((m) => m.active);
  const shares = evenSplit(amountMinor, participants.map((m) => m.id), payerId);
  return { participants, shares };
}

function summaryLines(trip: Trip, amountMinor: number, description: string, payer: Member): string[] {
  const { participants, shares } = buildShares(trip, amountMinor, payer.id);
  const byId = new Map(participants.map((m) => [m.id, m]));
  return [
    "Confirm this expense?",
    "",
    `💸 ${formatAmount(amountMinor, trip.currency)} — ${description}`,
    `Paid by: ${payer.displayName}`,
    `Split evenly between ${participants.length}:`,
    ...shares.map((s) => `• ${byId.get(s.memberId)?.displayName ?? s.memberId}: ${formatAmount(s.amountMinor, trip.currency)}`),
  ];
}

composer.command("expense", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  setFlow(ctx, { name: FLOW, step: "amount", data: {} });
  await ctx.reply(`💸 New expense in "${tc.trip.name}". How much was it? Send the amount, e.g. 42.50`);
});

composer.on("message:text", async (ctx, next) => {
  const flow = getFlow(ctx);
  if (flow?.name !== FLOW) return next();
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return next();
  const tc = await requireTripMember(ctx);
  if (!tc) {
    clearFlow(ctx);
    return;
  }
  const data = flow.data as ExpenseData;

  if (flow.step === "amount") {
    const minor = parseAmount(text);
    if (minor == null || minor <= 0) {
      await ctx.reply("Please send a positive amount, e.g. 42.50");
      return;
    }
    data.amountMinor = minor;
    flow.step = "description";
    setFlow(ctx, flow);
    await ctx.reply("What was it for? Send a short description.");
    return;
  }

  if (flow.step === "description") {
    if (!text) {
      await ctx.reply("Please send a short description.");
      return;
    }
    data.description = text;
    flow.step = "confirm";
    setFlow(ctx, flow);
    const lines = summaryLines(tc.trip, data.amountMinor ?? 0, text, tc.member);
    await ctx.reply(lines.join("\n"), { reply_markup: confirmKeyboard("expense") });
    return;
  }

  await ctx.reply("Tap ✅ Yes to save the expense, or ❌ No to cancel.");
});

composer.callbackQuery("expense:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  const flow = getFlow(ctx);
  const tc = await requireTripMember(ctx);
  if (flow?.name !== FLOW || !tc || flow.step !== "confirm") {
    clearFlow(ctx);
    await ctx.reply("That expense draft has expired. Start again with /expense.");
    return;
  }
  const data = flow.data as ExpenseData;
  const amountMinor = data.amountMinor ?? 0;
  const { shares } = buildShares(tc.trip, amountMinor, tc.member.id);
  const seq = (await listExpenses(tc.trip.id)).length + 1;
  const expense: Expense = {
    id: `${tc.trip.id}-e${seq}`,
    seq,
    tripId: tc.trip.id,
    createdByMemberId: tc.member.id,
    payerId: tc.member.id,
    amountMinor,
    description: data.description ?? "",
    splitType: "even",
    shares,
    createdAt: new Date().toISOString(),
  };
  await addExpense(expense);
  clearFlow(ctx);
  await ctx.reply(
    `✅ Logged: ${formatAmount(amountMinor, tc.trip.currency)} — ${expense.description}, paid by ${tc.member.displayName}. Use /balance to see who owes whom.`,
  );
});

composer.callbackQuery("expense:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  clearFlow(ctx);
  await ctx.reply("Expense discarded. Send /expense to log another.");
});

export default composer;
