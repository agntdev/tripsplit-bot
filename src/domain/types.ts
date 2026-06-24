// Shared domain model for TripSplit. Durable records persisted via src/domain/store.ts.
// Money is stored as integer minor units (e.g. cents) to avoid floating-point drift;
// see src/domain/money.ts for parsing/formatting (added when expenses land).

/** A participant in a trip. `id` is the stable identity used by expenses, shares
 *  and balances: `u<telegramUserId>` for Telegram users (organizer + anyone who
 *  interacts), or `n:<slug>` for members entered by name only. */
export interface Member {
  id: string;
  displayName: string;
  /** Telegram user id when known (drives DM/permission checks); absent for
   *  name-only members. */
  userId?: number;
  /** false after the member leaves; history is preserved (never deleted). */
  active: boolean;
  joinedAt: string;
  leftAt?: string;
}

/** One participant's portion of an expense, in integer minor units. The shares
 *  of an expense always sum to its `amountMinor`. */
export interface Share {
  memberId: string;
  amountMinor: number;
}

/** An immutable expense record. Never deleted; edits would be new audit entries. */
export interface Expense {
  id: string;
  /** 1-based sequence within the trip, for stable display ordering. */
  seq: number;
  tripId: string;
  /** Member who logged it. */
  createdByMemberId: string;
  /** Member who paid (is owed by the others). */
  payerId: string;
  amountMinor: number;
  description: string;
  splitType: "even" | "custom";
  shares: Share[];
  createdAt: string;
}

/** A trip lives in one chat. v1 keeps a single active trip per chat (keyed by
 *  chatId), which is what makes `id = trip-<chatId>` collision-free. */
export interface Trip {
  id: string;
  chatId: number;
  name: string;
  /** 3-letter currency code, uppercase (e.g. USD). Single currency per trip. */
  currency: string;
  organizerId: string;
  organizerUserId: number;
  members: Member[];
  status: "active" | "archived";
  createdAt: string;
}

/** A user-declared, off-platform payment from one member to another. Only counts
 *  toward balances once `confirmed` (the one-tap confirmation in E4). */
export interface PaymentRecord {
  id: string;
  seq: number;
  tripId: string;
  fromId: string;
  toId: string;
  amountMinor: number;
  note?: string;
  confirmed: boolean;
  createdAt: string;
  confirmedAt?: string;
}

/** A member's net position: positive = owed to them, negative = they owe. */
export interface Balance {
  memberId: string;
  netMinor: number;
}

/** A single suggested settlement payment (debtor -> creditor). */
export interface Transfer {
  fromId: string;
  toId: string;
  amountMinor: number;
}
