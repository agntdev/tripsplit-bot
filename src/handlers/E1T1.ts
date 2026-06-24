import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { confirmKeyboard } from "../toolkit/index.js";
import { clearFlow, getFlow, setFlow } from "../domain/flow.js";
import { getActiveTrip, saveTrip } from "../domain/store.js";
import type { Member, Trip } from "../domain/types.js";

const composer = new Composer<Ctx>();
const FLOW = "newtrip";

interface NewTripData {
  name?: string;
  currency?: string;
  memberNames?: string[];
  [k: string]: unknown;
}

function slug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "member"
  );
}

function organizerName(ctx: Ctx): string {
  const f = ctx.from;
  if (!f) return "Organizer";
  const full = [f.first_name, f.last_name].filter(Boolean).join(" ");
  return full || (f.username ? `@${f.username}` : "Organizer");
}

composer.command("newtrip", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (chatId == null || !ctx.from) return;
  const existing = await getActiveTrip(chatId);
  if (existing) {
    await ctx.reply(
      `A trip is already active here: "${existing.name}". Use /overview to view it, or /leavetrip to step away before starting a new one.`,
    );
    return;
  }
  setFlow(ctx, { name: FLOW, step: "name", data: {} });
  await ctx.reply("🧳 Let's set up a trip. What should we call it? Send the trip name.");
});

composer.on("message:text", async (ctx, next) => {
  const flow = getFlow(ctx);
  if (flow?.name !== FLOW) return next();
  const text = ctx.message.text.trim();
  // Commands must keep routing even mid-wizard.
  if (text.startsWith("/")) return next();
  const data = flow.data as NewTripData;

  if (flow.step === "name") {
    if (!text) {
      await ctx.reply("Please send a name for the trip.");
      return;
    }
    data.name = text;
    flow.step = "currency";
    setFlow(ctx, flow);
    await ctx.reply(`Great — "${text}". What currency is it in? Send a 3-letter code like USD, EUR, or GBP.`);
    return;
  }

  if (flow.step === "currency") {
    const cur = text.toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) {
      await ctx.reply("Please send a 3-letter currency code, e.g. USD.");
      return;
    }
    data.currency = cur;
    flow.step = "members";
    setFlow(ctx, flow);
    await ctx.reply(
      `Currency set to ${cur}. Who's on the trip? Send member names or @usernames separated by commas. You're added automatically — send "done" if it's just you.`,
    );
    return;
  }

  if (flow.step === "members") {
    const names = /^(done|none|just me|skip)$/i.test(text)
      ? []
      : text
          .split(",")
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
    data.memberNames = names;
    flow.step = "confirm";
    setFlow(ctx, flow);
    const roster = ["You (organizer)", ...names].join(", ");
    await ctx.reply(`Create this trip?\n\n🧳 ${data.name}\n💱 ${data.currency}\n👥 ${roster}`, {
      reply_markup: confirmKeyboard("newtrip"),
    });
    return;
  }

  // confirm step: only the buttons advance from here.
  await ctx.reply("Tap ✅ Yes to create the trip, or ❌ No to cancel.");
});

composer.callbackQuery("newtrip:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  const flow = getFlow(ctx);
  const chatId = ctx.chat?.id;
  if (flow?.name !== FLOW || chatId == null || !ctx.from) {
    clearFlow(ctx);
    await ctx.reply("That trip setup has expired. Send /newtrip to start again.");
    return;
  }
  const data = flow.data as NewTripData;
  const now = new Date().toISOString();
  const organizer: Member = {
    id: `u${ctx.from.id}`,
    displayName: organizerName(ctx),
    userId: ctx.from.id,
    active: true,
    joinedAt: now,
  };
  const members: Member[] = [organizer];
  for (const name of data.memberNames ?? []) {
    const id = `n:${slug(name)}`;
    if (members.some((m) => m.id === id)) continue;
    members.push({ id, displayName: name, active: true, joinedAt: now });
  }
  const trip: Trip = {
    id: `trip-${chatId}`,
    chatId,
    name: data.name ?? "Trip",
    currency: data.currency ?? "USD",
    organizerId: organizer.id,
    organizerUserId: ctx.from.id,
    members,
    status: "active",
    createdAt: now,
  };
  await saveTrip(trip);
  clearFlow(ctx);
  const roster = members.map((m) => m.displayName).join(", ");
  await ctx.reply(
    `✅ Trip "${trip.name}" created in ${trip.currency}.\n👥 Members: ${roster}\n\nLog your first expense with /expense.`,
  );
});

composer.callbackQuery("newtrip:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  clearFlow(ctx);
  await ctx.reply("No problem — trip setup cancelled. Send /newtrip whenever you're ready.");
});

export default composer;
