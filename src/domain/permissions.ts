import type { Ctx } from "../bot.js";
import { getActiveTrip } from "./store.js";
import type { Member, Trip } from "./types.js";

// Visibility enforcement: trip data is only for trip members. These helpers are
// the single gate every members-only command uses, so the rule lives in one place.

/** The active member for a Telegram user in a trip, or undefined. Name-only
 *  members have no userId and so can never act — only identified users can. */
export function findMember(trip: Trip, userId: number): Member | undefined {
  return trip.members.find((m) => m.userId === userId && m.active);
}

export function isOrganizer(trip: Trip, userId: number): boolean {
  return trip.organizerUserId === userId;
}

export interface TripContext {
  trip: Trip;
  member: Member;
}

/**
 * Resolve the active trip and the acting member for a members-only command. On
 * failure it replies with the reason (no trip / not a member) and returns null,
 * so callers do `const tc = await requireTripMember(ctx); if (!tc) return;`.
 */
export async function requireTripMember(ctx: Ctx): Promise<TripContext | null> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (chatId == null || userId == null) return null;
  const trip = await getActiveTrip(chatId);
  if (!trip) {
    await ctx.reply("There's no active trip in this chat yet. Create one with /newtrip.");
    return null;
  }
  const member = findMember(trip, userId);
  if (!member) {
    await ctx.reply("Only members of this trip can do that. Ask the organizer to add you.");
    return null;
  }
  return { trip, member };
}
