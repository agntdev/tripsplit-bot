import type { Ctx } from "../bot.js";

// Ephemeral multi-step wizard state. EXACTLY ONE flow is active per chat+user at
// a time — it lives in the session's single `flow` slot, so starting one wizard
// supersedes any other and the per-feature `message:text` handlers never fight
// over input. This is conversation state, not durable data (which lives in the
// persistent store). The session is typed `{}` in bot.ts (which we don't edit),
// so we reach the slot through a localized cast here rather than augmenting it.

export interface Flow {
  /** Feature that owns the active wizard, e.g. "newtrip", "expense". */
  name: string;
  /** Current step within that wizard. */
  step: string;
  /** Free-form collected data for the wizard. */
  data: Record<string, unknown>;
}

type SessionWithFlow = { flow?: Flow };

export function getFlow(ctx: Ctx): Flow | undefined {
  return (ctx.session as SessionWithFlow).flow;
}

export function setFlow(ctx: Ctx, flow: Flow): void {
  (ctx.session as SessionWithFlow).flow = flow;
}

export function clearFlow(ctx: Ctx): void {
  (ctx.session as SessionWithFlow).flow = undefined;
}
