import { formatAmount, formatAmountBare } from "./money.js";
import type { Balance, Expense, PaymentRecord, Transfer, Trip } from "./types.js";

// Shared presentation helpers for trip data. Kept separate from handlers so the
// same formatting backs /expenses, /overview and any future view.

export function memberName(trip: Trip, memberId: string): string {
  return trip.members.find((m) => m.id === memberId)?.displayName ?? memberId;
}

/** One compact expense line, e.g. "#1 · Dinner · 30.00 USD · paid by Test". */
export function formatExpenseLine(trip: Trip, e: Expense): string {
  return `#${e.seq} · ${e.description} · ${formatAmount(e.amountMinor, trip.currency)} · paid by ${memberName(trip, e.payerId)}`;
}

/** The members-only expense ledger for a trip, with a running total. */
export function formatExpenseList(trip: Trip, expenses: Expense[]): string {
  if (expenses.length === 0) {
    return `No expenses logged yet in "${trip.name}". Add one with /expense.`;
  }
  const total = expenses.reduce((acc, e) => acc + e.amountMinor, 0);
  return [
    `📋 Expenses in "${trip.name}" (${expenses.length})`,
    "",
    ...expenses.map((e) => formatExpenseLine(trip, e)),
    "",
    `Total: ${formatAmount(total, trip.currency)}`,
  ].join("\n");
}

/** A member's net position in words, e.g. "+20.00 USD (is owed)". */
export function formatNet(minor: number, currency: string): string {
  if (minor > 0) return `+${formatAmount(minor, currency)} (is owed)`;
  if (minor < 0) return `${formatAmount(minor, currency)} (owes)`;
  return "settled up";
}

/** The per-member net balances. Active members always show; inactive members
 *  show only while they still owe or are owed. */
export function formatBalances(trip: Trip, balances: Balance[]): string {
  const byId = new Map(trip.members.map((m) => [m.id, m]));
  const rows = balances.filter((b) => (byId.get(b.memberId)?.active ?? false) || b.netMinor !== 0);
  const lines = [`📊 Balances in "${trip.name}"`, ""];
  if (rows.every((b) => b.netMinor === 0)) {
    lines.push("Everyone's settled up! 🎉");
  } else {
    for (const b of rows) {
      lines.push(`• ${byId.get(b.memberId)?.displayName ?? b.memberId}: ${formatNet(b.netMinor, trip.currency)}`);
    }
  }
  return lines.join("\n");
}

/** One payment line: "✅ Alice → Test 10.00 USD" (⏳ while unconfirmed). */
export function formatPaymentLine(trip: Trip, p: PaymentRecord): string {
  const status = p.confirmed ? "✅" : "⏳";
  return `${status} ${memberName(trip, p.fromId)} → ${memberName(trip, p.toId)} ${formatAmount(p.amountMinor, trip.currency)}`;
}

/** The trip's payment history with a confirmed/pending tally. */
export function formatPaymentList(trip: Trip, payments: PaymentRecord[]): string {
  if (payments.length === 0) {
    return `No payments recorded yet in "${trip.name}". Use /paid once someone settles up.`;
  }
  const confirmed = payments.filter((p) => p.confirmed).length;
  const pending = payments.length - confirmed;
  return [
    `💳 Payments in "${trip.name}" (${payments.length})`,
    "",
    ...payments.map((p) => formatPaymentLine(trip, p)),
    "",
    `${confirmed} confirmed, ${pending} pending.`,
  ].join("\n");
}

/** The organizer's full overview: members, every expense with its split, current
 *  balances, and the payment history. Composes the same data the per-feature
 *  views show, in one place. */
export function formatOverview(trip: Trip, expenses: Expense[], payments: PaymentRecord[], balances: Balance[]): string {
  const active = trip.members.filter((m) => m.active);
  const lines: string[] = [
    `📋 Overview of "${trip.name}" (${trip.currency})`,
    `Organizer: ${memberName(trip, trip.organizerId)}`,
    `👥 Members: ${active.map((m) => m.displayName).join(", ")}`,
    "",
  ];

  const expTotal = expenses.reduce((acc, e) => acc + e.amountMinor, 0);
  lines.push(`💸 Expenses (${expenses.length})${expenses.length > 0 ? ` — total ${formatAmount(expTotal, trip.currency)}` : ""}`);
  if (expenses.length === 0) {
    lines.push("none yet");
  } else {
    for (const e of expenses) {
      lines.push(`#${e.seq} ${e.description} — ${formatAmount(e.amountMinor, trip.currency)} paid by ${memberName(trip, e.payerId)}`);
      lines.push(`   split: ${e.shares.map((s) => `${memberName(trip, s.memberId)} ${formatAmountBare(s.amountMinor)}`).join(", ")}`);
    }
  }
  lines.push("");

  lines.push("📊 Balances");
  const rows = balances.filter((b) => (trip.members.find((m) => m.id === b.memberId)?.active ?? false) || b.netMinor !== 0);
  if (rows.every((b) => b.netMinor === 0)) {
    lines.push("Everyone's settled up! 🎉");
  } else {
    for (const b of rows) lines.push(`• ${memberName(trip, b.memberId)}: ${formatNet(b.netMinor, trip.currency)}`);
  }
  lines.push("");

  lines.push(`💳 Payments (${payments.length})`);
  if (payments.length === 0) {
    lines.push("none yet");
  } else {
    for (const p of payments) lines.push(formatPaymentLine(trip, p));
  }

  return lines.join("\n");
}

/** The suggested minimal settlement transfers ("X pays Y N.NN CUR"). */
export function formatSettlement(trip: Trip, transfers: Transfer[]): string {
  if (transfers.length === 0) {
    return `Everyone's settled up in "${trip.name}"! 🎉`;
  }
  return [
    `🤝 To settle "${trip.name}":`,
    "",
    ...transfers.map(
      (t) => `• ${memberName(trip, t.fromId)} pays ${memberName(trip, t.toId)} ${formatAmount(t.amountMinor, trip.currency)}`,
    ),
  ].join("\n");
}
