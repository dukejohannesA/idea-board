import { useEffect, useState, type ReactNode } from "react";
import { initSync, subscribeSync, type SyncStatus } from "@/lib/sync";

let started: Promise<unknown> | null = null;

export function DataGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    started ??= initSync((done, total) => setProgress({ done, total }));
    started
      .then(() => setReady(true))
      .catch((e) => {
        console.error(e);
        started = null;
        setError("Couldn't move your boards online yet. Your boards are safe in this browser.");
      });
  }, []);

  if (ready)
    return (
      <>
        {children}
        <SyncBadge />
      </>
    );

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-sm bg-card p-7 shadow-[0_10px_30px_-10px_rgba(60,40,10,.4)]">
        <div className="text-3xl">📌</div>
        {error ? (
          <>
            <p className="mt-3 text-sm">{error}</p>
            <button
              onClick={() => location.reload()}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </button>
          </>
        ) : progress ? (
          <>
            <h1 className="mt-2 font-bold">Moving your boards online…</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {progress.done} of {progress.total} saved. Please keep this tab open.
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Loading your boards…</p>
        )}
      </div>
    </main>
  );
}

function SyncBadge() {
  const [s, setS] = useState<SyncStatus>({ state: "saved", pending: 0 });
  useEffect(() => subscribeSync(setS), []);
  const label =
    s.state === "saved"
      ? "✓ Saved"
      : s.state === "saving"
        ? "Saving…"
        : s.state === "offline"
          ? `Offline · ${s.pending} change${s.pending === 1 ? "" : "s"} waiting`
          : `Can't reach server · ${s.pending} waiting, retrying`;
  return (
    <div
      className={`pointer-events-none fixed bottom-1.5 left-1/2 z-50 -translate-x-1/2 rounded-full border bg-card/90 px-3 py-0.5 text-xs shadow-sm ${
        s.state === "saved" ? "text-muted-foreground" : s.state === "saving" ? "" : "text-destructive"
      }`}
    >
      {label}
    </div>
  );
}
