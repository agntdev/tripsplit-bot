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
