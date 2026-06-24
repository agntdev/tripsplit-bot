import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, menuKeyboard } from "../toolkit/index.js";
import { clearFlow, getFlow, setFlow } from "../domain/flow.js";
import { requireTripMember } from "../domain/permissions.js";
import { addPayment, listExpenses, listPayments, savePayments } from "../domain/store.js";
import { formatAmount, parseAmount } from "../domain/money.js";
import { computeBalances } from "../domain/balance.js";
import { formatBalances } from "../domain/format.js";
import type { Member, PaymentRecord, Trip } from "../domain/types.js";

const composer = new Composer<Ctx>();
const FLOW = "paid";

interface PaidData {
  otherId?: string;
  otherName?: string;
  direction?: "out" | "in"; // out = actor paid other; in = other paid actor
  amountMinor?: number;
  seq?: number;
  [k: string]: unknown;
}

function otherActiveMembers(trip: Trip, selfId: string): Member[] {
  return trip.members.filter((m) => m.active && m.id !== selfId);
}

composer.command("paid", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  const others = otherActiveMembers(tc.trip, tc.member.id);
  if (others.length === 0) {
    await ctx.reply("There's no one else on the trip to settle with yet.");
    return;
  }
  setFlow(ctx, { name: FLOW, step: "who", data: {} });
  await ctx.reply("Record a settlement. Who's it with?", {
    reply_markup: menuKeyboard(
      others.map((m) => ({ text: m.displayName, data: `paywith:${m.id}` })),
      1,
    ),
  });
});

composer.callbackQuery(/^paywith:/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const flow = getFlow(ctx);
  const tc = await requireTripMember(ctx);
  if (flow?.name !== FLOW || !tc) return;
  const otherId = (ctx.callbackQuery.data ?? "").slice("paywith:".length);
  const other = tc.trip.members.find((m) => m.id === otherId && m.active);
  if (!other) {
    await ctx.reply("That member isn't on the trip.");
    return;
  }
  const data = flow.data as PaidData;
  data.otherId = otherId;
  data.otherName = other.displayName;
  flow.step = "direction";
  setFlow(ctx, flow);
  await ctx.reply(`Which way did the money go with ${other.displayName}?`, {
    reply_markup: inlineKeyboard([
      [inlineButton(`💸 I paid ${other.displayName}`, "paydir:out")],
      [inlineButton(`💰 ${other.displayName} paid me`, "paydir:in")],
    ]),
  });
});

composer.callbackQuery(/^paydir:(out|in)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const flow = getFlow(ctx);
  if (flow?.name !== FLOW) return;
  const data = flow.data as PaidData;
  data.direction = (ctx.callbackQuery.data ?? "").endsWith("in") ? "in" : "out";
  flow.step = "amount";
  setFlow(ctx, flow);
  const verb = data.direction === "in" ? `did ${data.otherName} pay you` : `did you pay ${data.otherName}`;
  await ctx.reply(`How much ${verb}? Send the amount, e.g. 10.00`);
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
  const data = flow.data as PaidData;
  if (flow.step !== "amount") {
    await ctx.reply("Use the buttons to choose who and which way the money went.");
    return;
  }
  const minor = parseAmount(text);
  if (minor == null || minor <= 0) {
    await ctx.reply("Please send a positive amount, e.g. 10.00");
    return;
  }
  data.amountMinor = minor;
  const fromId = data.direction === "in" ? data.otherId! : tc.member.id;
  const toId = data.direction === "in" ? tc.member.id : data.otherId!;
  const payments = await listPayments(tc.trip.id);
  const seq = payments.length + 1;
  const payment: PaymentRecord = {
    id: `${tc.trip.id}-p${seq}`,
    seq,
    tripId: tc.trip.id,
    fromId,
    toId,
    amountMinor: minor,
    confirmed: false,
    createdAt: new Date().toISOString(),
  };
  await addPayment(payment);
  data.seq = seq;
  flow.step = "confirm";
  setFlow(ctx, flow);
  const phrase =
    data.direction === "in"
      ? `${data.otherName} paid you ${formatAmount(minor, tc.trip.currency)}`
      : `you paid ${data.otherName} ${formatAmount(minor, tc.trip.currency)}`;
  await ctx.reply(`Confirm: ${phrase}?`, {
    reply_markup: inlineKeyboard([[inlineButton("✅ Confirm", "pay:confirm"), inlineButton("❌ Cancel", "pay:cancel")]]),
  });
});

composer.callbackQuery("pay:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  const flow = getFlow(ctx);
  const tc = await requireTripMember(ctx);
  if (flow?.name !== FLOW || !tc) {
    clearFlow(ctx);
    return;
  }
  const data = flow.data as PaidData;
  const payments = await listPayments(tc.trip.id);
  const payment = payments.find((p) => p.seq === data.seq);
  if (payment) {
    payment.confirmed = true;
    payment.confirmedAt = new Date().toISOString();
    await savePayments(tc.trip.id, payments);
  }
  clearFlow(ctx);
  const phrase =
    data.direction === "in"
      ? `${data.otherName} paid you ${formatAmount(data.amountMinor ?? 0, tc.trip.currency)}`
      : `you paid ${data.otherName} ${formatAmount(data.amountMinor ?? 0, tc.trip.currency)}`;
  await ctx.reply(`✅ Recorded: ${phrase}. Use /balance to see the update.`);
  // Surface the balance adjustment right away (E4T2).
  const expenses = await listExpenses(tc.trip.id);
  await ctx.reply(formatBalances(tc.trip, computeBalances(tc.trip, expenses, payments)));
});

composer.callbackQuery("pay:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  const flow = getFlow(ctx);
  const tc = await requireTripMember(ctx);
  if (flow?.name === FLOW && tc) {
    const data = flow.data as PaidData;
    const remaining = (await listPayments(tc.trip.id)).filter((p) => p.seq !== data.seq);
    await savePayments(tc.trip.id, remaining);
  }
  clearFlow(ctx);
  await ctx.reply("Payment discarded.");
});

export default composer;
