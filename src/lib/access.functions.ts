import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyAccessCode } from "./access-hash";
import { getAccessSession } from "./access.server";

const MAX_FAILS = 5;
const COOLDOWN_MS = 60_000;

export const getAccessStatus = createServerFn({ method: "GET" }).handler(async () => {
  const configured = !!process.env["ACCESS_CODE_HASH"];
  const s = await getAccessSession();
  return { unlocked: !!s.data.unlocked, configured };
});

export const unlockApp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const stored = process.env["ACCESS_CODE_HASH"];
    if (!stored) return { ok: false as const, error: "The access code hasn't been set up yet." };

    const s = await getAccessSession();
    const now = Date.now();
    if (s.data.lockedUntil && s.data.lockedUntil > now) {
      return { ok: false as const, error: "Too many attempts.", retryIn: Math.ceil((s.data.lockedUntil - now) / 1000) };
    }

    // Small fixed delay slows down guessing.
    await new Promise((r) => setTimeout(r, 600));
    const ok = await verifyAccessCode(data.code, stored);
    if (ok) {
      await s.update({ unlocked: true, fails: 0, lockedUntil: 0 });
      return { ok: true as const };
    }
    const fails = (s.data.fails ?? 0) + 1;
    if (fails >= MAX_FAILS) {
      await s.update({ unlocked: false, fails: 0, lockedUntil: now + COOLDOWN_MS });
      return { ok: false as const, error: "Too many attempts.", retryIn: COOLDOWN_MS / 1000 };
    }
    await s.update({ unlocked: false, fails });
    return { ok: false as const, error: `That code isn't right. ${MAX_FAILS - fails} tries left.` };
  });

export const lockApp = createServerFn({ method: "POST" }).handler(async () => {
  const s = await getAccessSession();
  await s.update({ unlocked: false });
  return { ok: true };
});
