import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { isOrganizer, requireTripMember } from "../domain/permissions.js";
import { saveTrip } from "../domain/store.js";

const composer = new Composer<Ctx>();

function slug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "member"
  );
}

/** The args string after a command, trimmed (grammY sets ctx.match to it). */
function commandArgs(ctx: Ctx): string {
  return (typeof ctx.match === "string" ? ctx.match : "").trim();
}

composer.command("addmember", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  const { trip } = tc;
  if (!isOrganizer(trip, ctx.from?.id ?? -1)) {
    await ctx.reply("Only the organizer can add members.");
    return;
  }
  const names = commandArgs(ctx)
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  if (names.length === 0) {
    await ctx.reply("Send names like: /addmember Alice, Bob");
    return;
  }
  const now = new Date().toISOString();
  const added: string[] = [];
  for (const name of names) {
    const id = `n:${slug(name)}`;
    const existing = trip.members.find((m) => m.id === id);
    if (existing) {
      if (!existing.active) {
        existing.active = true;
        existing.leftAt = undefined;
        existing.joinedAt = now;
        added.push(name);
      }
    } else {
      trip.members.push({ id, displayName: name, active: true, joinedAt: now });
      added.push(name);
    }
  }
  if (added.length === 0) {
    await ctx.reply("Everyone you listed is already on the trip.");
    return;
  }
  await saveTrip(trip);
  await ctx.reply(`✅ Added: ${added.join(", ")}.`);
});

composer.command("removemember", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  const { trip } = tc;
  if (!isOrganizer(trip, ctx.from?.id ?? -1)) {
    await ctx.reply("Only the organizer can remove members.");
    return;
  }
  const name = commandArgs(ctx);
  if (!name) {
    await ctx.reply("Send a name like: /removemember Alice");
    return;
  }
  const target = trip.members.find(
    (m) => m.active && (m.displayName.toLowerCase() === name.toLowerCase() || m.id === `n:${slug(name)}`),
  );
  if (!target) {
    await ctx.reply(`No active member called "${name}". Use /trip to see members.`);
    return;
  }
  if (target.id === trip.organizerId) {
    await ctx.reply("The organizer can't be removed from the trip.");
    return;
  }
  target.active = false;
  target.leftAt = new Date().toISOString();
  await saveTrip(trip);
  await ctx.reply(`✅ Removed ${target.displayName} from the trip. Their history is kept.`);
});

composer.command("leavetrip", async (ctx) => {
  const tc = await requireTripMember(ctx);
  if (!tc) return;
  const { trip, member } = tc;
  member.active = false;
  member.leftAt = new Date().toISOString();
  await saveTrip(trip);
  await ctx.reply("✅ You've left the trip. Your past expenses are kept.");
});

export default composer;
