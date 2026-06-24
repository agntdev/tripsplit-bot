import type { Share } from "./types.js";

// Money is integer minor units (e.g. cents) throughout — never floats — so sums
// always net to zero. Two decimal places (the trip-currency default).

/** Parse "42", "42.5", "42.50" (or comma decimal) to minor units; null if invalid. */
export function parseAmount(input: string): number | null {
  const m = input.trim().replace(",", ".").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const whole = Number.parseInt(m[1]!, 10);
  const frac = m[2] ? m[2].padEnd(2, "0") : "00";
  return whole * 100 + Number.parseInt(frac, 10);
}

/** Format minor units as "12.50 USD". */
export function formatAmount(minor: number, currency: string): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")} ${currency}`;
}

/**
 * Split `totalMinor` evenly across participants, giving the rounding remainder to
 * the payer (so the shares always sum to exactly the total — the spec's
 * "payer absorbs rounding" rule). If the payer isn't a participant, the first
 * participant absorbs it. Returns one Share per participant, in input order.
 */
export function evenSplit(totalMinor: number, participantIds: string[], payerId: string): Share[] {
  const n = participantIds.length;
  if (n === 0) return [];
  const base = Math.floor(totalMinor / n);
  const remainder = totalMinor - base * n;
  const payerIdx = participantIds.indexOf(payerId);
  const absorberIdx = payerIdx >= 0 ? payerIdx : 0;
  return participantIds.map((id, i) => ({
    memberId: id,
    amountMinor: base + (i === absorberIdx ? remainder : 0),
  }));
}
