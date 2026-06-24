import type { Balance, Expense, PaymentRecord, Trip } from "./types.js";

// Balances are always RECOMPUTED from the immutable expense + payment records —
// never stored as a mutable running total — so the ledger can't drift. A member's
// net is what they're owed (positive) minus what they owe (negative); the whole
// set always sums to zero.

export function computeBalances(trip: Trip, expenses: Expense[], payments: PaymentRecord[]): Balance[] {
  const net = new Map<string, number>();
  const bump = (id: string, delta: number) => net.set(id, (net.get(id) ?? 0) + delta);
  for (const m of trip.members) net.set(m.id, 0);

  for (const e of expenses) {
    // The payer fronted the whole amount; every participant consumed their share.
    bump(e.payerId, e.amountMinor);
    for (const s of e.shares) bump(s.memberId, -s.amountMinor);
  }

  for (const p of payments) {
    if (!p.confirmed) continue;
    // `from` paid `to`: the debtor's balance rises toward zero, the creditor's falls.
    bump(p.fromId, p.amountMinor);
    bump(p.toId, -p.amountMinor);
  }

  // Member order for stable display; include any non-member id that appears.
  const ordered: Balance[] = trip.members.map((m) => ({ memberId: m.id, netMinor: net.get(m.id) ?? 0 }));
  for (const [memberId, netMinor] of net) {
    if (!trip.members.some((m) => m.id === memberId)) ordered.push({ memberId, netMinor });
  }
  return ordered;
}
