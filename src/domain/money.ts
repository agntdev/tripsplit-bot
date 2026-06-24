import type { Member, Share } from "./types.js";

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

/** Format minor units without a currency suffix, e.g. "12.50". */
export function formatAmountBare(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Format minor units as "12.50 USD". */
export function formatAmount(minor: number, currency: string): string {
  return `${formatAmountBare(minor)} ${currency}`;
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

/**
 * Parse a custom split entered as comma-separated `Name=value` pairs, where every
 * value is either an amount (e.g. `Alice=10`) or a percentage (e.g. `Alice=40%`)
 * — the whole entry must be one kind. The named (non-payer) members get those
 * shares; the payer covers the remainder, absorbing any rounding so the shares
 * still sum to exactly `totalMinor`. Members not named (and not the payer) are
 * left out of this expense. Returns ordered shares (member order) or an error.
 */
export function parseCustomShares(
  input: string,
  members: Member[],
  totalMinor: number,
  payerId: string,
): { shares: Share[] } | { error: string } {
  const pairs = input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (pairs.length === 0) return { error: "Send shares like: Alice=10, Bob=15" };
  const isPercent = pairs.some((p) => p.includes("%"));

  const byName = (name: string): Member | undefined => {
    const lower = name.trim().toLowerCase();
    return members.find((m) => m.displayName.toLowerCase() === lower);
  };

  const parsed: { member: Member; value: number }[] = [];
  for (const p of pairs) {
    const eq = p.indexOf("=");
    if (eq < 0) return { error: `Use Name=value, e.g. Alice=10. Got "${p}".` };
    const name = p.slice(0, eq).trim();
    const valPart = p.slice(eq + 1).replace("%", "").trim();
    const member = byName(name);
    if (!member) return { error: `"${name}" isn't a member of this trip.` };
    if (member.id === payerId) return { error: "You're the payer — list the others; you cover the rest." };
    if (parsed.some((e) => e.member.id === member.id)) return { error: `${member.displayName} is listed twice.` };
    const value = isPercent ? Number.parseFloat(valPart) : parseAmount(valPart);
    if (value == null || Number.isNaN(value) || value < 0) {
      return { error: `"${p}" isn't a valid ${isPercent ? "percentage" : "amount"}.` };
    }
    parsed.push({ member, value });
  }

  const named = new Map<string, number>();
  let namedTotal = 0;
  if (isPercent) {
    const pctSum = parsed.reduce((acc, e) => acc + e.value, 0);
    if (pctSum > 100) return { error: `The percentages add up to ${pctSum}%, more than 100%.` };
    for (const e of parsed) {
      const amt = Math.round((totalMinor * e.value) / 100);
      named.set(e.member.id, amt);
      namedTotal += amt;
    }
  } else {
    for (const e of parsed) {
      named.set(e.member.id, e.value);
      namedTotal += e.value;
    }
  }
  if (namedTotal > totalMinor) return { error: "The shares add up to more than the total." };

  // Payer covers the remainder (absorbs rounding).
  named.set(payerId, totalMinor - namedTotal);

  // Emit in member order for a stable, readable summary.
  const shares: Share[] = members
    .filter((m) => named.has(m.id))
    .map((m) => ({ memberId: m.id, amountMinor: named.get(m.id)! }));
  return { shares };
}
