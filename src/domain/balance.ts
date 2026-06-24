import type { Balance, Expense, PaymentRecord, Transfer, Trip } from "./types.js";

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

/**
 * Greedy minimal-settlement: repeatedly match the largest debtor with the largest
 * creditor and transfer the smaller of the two magnitudes, until everyone is at
 * zero. This produces at most (members - 1) transfers — a small, easy-to-act-on
 * set. Sorted by amount then memberId so the suggestion is deterministic.
 */
export function greedySettlement(balances: Balance[]): Transfer[] {
  const byId = (a: { memberId: string }, b: { memberId: string }) => (a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0);
  const debtors = balances
    .filter((b) => b.netMinor < 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.netMinor - b.netMinor || byId(a, b)); // most negative first
  const creditors = balances
    .filter((b) => b.netMinor > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.netMinor - a.netMinor || byId(a, b)); // most positive first

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const amount = Math.min(-debtor.netMinor, creditor.netMinor);
    if (amount > 0) {
      transfers.push({ fromId: debtor.memberId, toId: creditor.memberId, amountMinor: amount });
      debtor.netMinor += amount;
      creditor.netMinor -= amount;
    }
    if (debtor.netMinor === 0) i++;
    if (creditor.netMinor === 0) j++;
  }
  return transfers;
}
