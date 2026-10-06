import { useSession } from "@tanstack/react-start/server";

export type AccessSession = { unlocked?: boolean; fails?: number; lockedUntil?: number };

// Built per call: env vars are injected per request on the server runtime.
// No maxAge => browser-session cookie (cleared when the browser closes).
export function accessSessionConfig() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("SESSION_SECRET is not set");
  return {
    password,
    name: "idea-board-access",
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export function getAccessSession() {
  return useSession<AccessSession>(accessSessionConfig());
}

/** Call at the top of any server function that changes data or uploads files. */
export async function requireAccess() {
  const s = await getAccessSession();
  if (!s.data.unlocked) throw new Error("Locked");
  return s;
}
