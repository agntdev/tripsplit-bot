import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { clearFlow, getFlow, setFlow } from "../domain/flow.js";
import { requireTripMember } from "../domain/permissions.js";
import { addExpense, listExpenses } from "../domain/store.js";
import { evenSplit, formatAmount, parseAmount, parseCustomShares } from "../domain/money.js";
import type { Expense, Member, Share, Trip } from "../domain/types.js";

const composer = new Composer<Ctx>();
const FLOW = "expense";

interface ExpenseData {
  amountMinor?: number;
  description?: string;
  splitType?: "even" | "custom";
  shares?: Share[];
  [k: string]: unknown;
}

function activeMembers(trip: Trip): Member[] {
  return trip.members.filter((m) => m.active);
}

function evenShares(trip: Trip, amountMinor: number, payerId: string): Share[] {
  return evenSplit(
    amountMinor,
    activeMembers(trip).map((m) => m.id),
    payerId,
  );
}

function confirmKeyboard() {
  return inlineKeyboard([
    [inlineButton("✅ Yes", "expense:yes"), inlineButton("❌ No", "expense:no")],
    [inlineButton("🔧 Custom split", "expense:custom")],
  ]);
}

function summaryLines(trip: Trip, data: ExpenseData, payer: Member, shares: Share[]): string[] {
  const byId = new Map(trip.members.map((m) => [m.id, m]));
  const heading = data.splitType === "custom" ? "Custom split" : `Split evenly between ${shares.length}`;
  return [
    "Confirm this expense?",
    "",
    `💸 ${formatAmount(data.amountMinor ?? 0, trip.currency)} — ${data.description ?? ""}`,
    `Paid by: ${payer.displayName}`,
    `${heading}:`,
    ...shares.map((s) => `• ${byId.get(s.memberId)?.displayName ?? s.memberId}: ${formatAmount(s.amountMinor, trip.currency)}`),
  ];
}

async function showConfirm(ctx: Ctx, trip: Trip, data: ExpenseData, payer: Member): Promise<void> {
  const shares = data.shares ?? evenShares(trip, data.amountMinor ?? 0, payer.id);
  await ctx.reply(summaryLines(trip, data, payer, shares).join("\n"), { reply_markup: confirmKeyboard() });
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
    data.splitType = "even";
    data.shares = evenShares(tc.trip, data.amountMinor ?? 0, tc.member.id);
    flow.step = "confirm";
    setFlow(ctx, flow);
    await showConfirm(ctx, tc.trip, data, tc.member);
    return;
  }

  if (flow.step === "custom") {
    const result = parseCustomShares(text, activeMembers(tc.trip), data.amountMinor ?? 0, tc.member.id);
    if ("error" in result) {
      await ctx.reply(result.error);
      return;
    }
    data.splitType = "custom";
    data.shares = result.shares;
    flow.step = "confirm";
    setFlow(ctx, flow);
    await showConfirm(ctx, tc.trip, data, tc.member);
    return;
  }

  await ctx.reply("Tap ✅ Yes to save, ❌ No to cancel, or 🔧 Custom split to set shares.");
});

composer.callbackQuery("expense:custom", async (ctx) => {
  await ctx.answerCallbackQuery();
  const flow = getFlow(ctx);
  if (flow?.name !== FLOW) {
    return;
  }
  flow.step = "custom";
  setFlow(ctx, flow);
  await ctx.reply(
    "Send each person's share as Name=amount (e.g. Alice=10, Bob=15) or Name=percent% (e.g. Alice=40%). You cover whatever's left.",
  );
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
  const shares = data.shares ?? evenShares(tc.trip, amountMinor, tc.member.id);
  const seq = (await listExpenses(tc.trip.id)).length + 1;
  const expense: Expense = {
    id: `${tc.trip.id}-e${seq}`,
    seq,
    tripId: tc.trip.id,
    createdByMemberId: tc.member.id,
    payerId: tc.member.id,
    amountMinor,
    description: data.description ?? "",
    splitType: data.splitType ?? "even",
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
