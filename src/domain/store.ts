import type { StorageAdapter } from "grammy";
import { resolveSessionStorage } from "../toolkit/index.js";
import type { Expense, PaymentRecord, Trip } from "./types.js";

// Durable domain storage. The toolkit auto-selects Redis when REDIS_URL is set
// (production) and falls back to its in-memory adapter otherwise (dev/test) — the
// SAME StorageAdapter interface either way, so this is a real persistence layer,
// not a process-local Map used as a database. Entities are namespaced by key
// prefix; values are JSON-serialisable plain objects.
const kv: StorageAdapter<object> = resolveSessionStorage<object>(undefined);

function tripKey(chatId: number): string {
  return `trip:${chatId}`;
}

/** The trip for a chat (v1 keeps a single trip per chat), or undefined. */
export async function getTrip(chatId: number): Promise<Trip | undefined> {
  return (await kv.read(tripKey(chatId))) as Trip | undefined;
}

/** The active trip for a chat, or undefined if none / archived. */
export async function getActiveTrip(chatId: number): Promise<Trip | undefined> {
  const trip = await getTrip(chatId);
  return trip && trip.status === "active" ? trip : undefined;
}

export async function saveTrip(trip: Trip): Promise<void> {
  await kv.write(tripKey(trip.chatId), trip);
}

function expensesKey(tripId: string): string {
  return `expenses:${tripId}`;
}

/** All expenses for a trip, oldest first. Immutable records — only appended. */
export async function listExpenses(tripId: string): Promise<Expense[]> {
  return ((await kv.read(expensesKey(tripId))) as Expense[] | undefined) ?? [];
}

/** Append an immutable expense record. */
export async function addExpense(expense: Expense): Promise<void> {
  const list = await listExpenses(expense.tripId);
  list.push(expense);
  await kv.write(expensesKey(expense.tripId), list);
}

function paymentsKey(tripId: string): string {
  return `payments:${tripId}`;
}

/** All payment records for a trip, oldest first (empty until E4 records any). */
export async function listPayments(tripId: string): Promise<PaymentRecord[]> {
  return ((await kv.read(paymentsKey(tripId))) as PaymentRecord[] | undefined) ?? [];
}

/** Persist the full payment list for a trip (append or status update). */
export async function savePayments(tripId: string, payments: PaymentRecord[]): Promise<void> {
  await kv.write(paymentsKey(tripId), payments);
}
