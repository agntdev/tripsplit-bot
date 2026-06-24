import { formatAmount } from "./money.js";
import type { Expense, Trip } from "./types.js";

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
