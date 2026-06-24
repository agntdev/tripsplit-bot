import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireTripMember } from "../domain/permissions.js";

const composer = new Composer<Ctx>();

// /trip — a members-only view of the current trip. It exercises the shared
// requireTripMember gate that every later trip command (/expense, /balance,
// /settle, ...) reuses: non-members and empty chats are turned away here.
composer.command("trip", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  const { trip } = tc;
  const active = trip.members.filter((m) => m.active);
  const left = trip.members.filter((m) => !m.active);
  const organizer = trip.members.find((m) => m.id === trip.organizerId);

  const lines = [
    `🧳 ${trip.name} (${trip.currency})`,
    `Organizer: ${organizer?.displayName ?? "—"}`,
    "",
    `👥 Members (${active.length}):`,
    ...active.map((m) => `• ${m.displayName}`),
  ];
  if (left.length > 0) {
    lines.push("", "Left the trip:", ...left.map((m) => `• ${m.displayName}`));
  }
  await ctx.reply(lines.join("\n"));
});

export default composer;
