import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAccessStatus, lockApp, unlockApp } from "@/lib/access.functions";

const LockCtx = createContext<() => void>(() => {});
export const useLockApp = () => useContext(LockCtx);

type State = "checking" | "locked" | "open" | "unconfigured";

export function AccessGate({ children }: { children: ReactNode }) {
  const status = useServerFn(getAccessStatus);
  const unlock = useServerFn(unlockApp);
  const lock = useServerFn(lockApp);
  const [state, setState] = useState<State>("checking");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    status()
      .then((r) => setState(!r.configured ? "unconfigured" : r.unlocked ? "open" : "locked"))
      .catch(() => setState("locked"));
  }, [status]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code || busy || wait > 0) return;
    setBusy(true);
    setError("");
    try {
      const r = await unlock({ data: { code } });
      if (r.ok) {
        setCode("");
        setState("open");
      } else {
        setError(r.error);
        if ("retryIn" in r && r.retryIn) setWait(r.retryIn);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function doLock() {
    await lock().catch(() => {});
    setState("locked");
  }

  if (state === "open") return <LockCtx.Provider value={doLock}>{children}</LockCtx.Provider>;

  return (
    <main
      className="grid min-h-screen place-items-center bg-canvas p-6"
      style={{ backgroundImage: "radial-gradient(var(--canvas-dot) 1.2px, transparent 1.2px)", backgroundSize: "24px 24px" }}
    >
      <div className="w-full max-w-sm rotate-[-1deg] rounded-sm bg-card p-7 shadow-[0_10px_30px_-10px_rgba(60,40,10,.4)]">
        <div className="text-3xl">📌</div>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Idea Board</h1>
        {state === "checking" ? (
          <p className="mt-4 text-sm text-muted-foreground">One moment…</p>
        ) : state === "unconfigured" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            This board is private, and its access code hasn't been set up yet. Add the access code setting to open it.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">This board is private. Enter the access code to continue.</p>
            <input
              type="password"
              autoFocus
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Access code"
              aria-label="Access code"
              className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
            {error && (
              <p className="text-sm text-destructive">
                {error} {wait > 0 && `Try again in ${wait}s.`}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !code || wait > 0}
              className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Checking…" : "Open board"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
