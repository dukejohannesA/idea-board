import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { hashAccessCode } from "@/lib/access-hash";

export const Route = createFileRoute("/access-code-tool")({
  head: () => ({
    meta: [
      { title: "Access code tool — Idea Board" },
      { name: "description", content: "Turn a private access code into a secure fingerprint for Idea Board." },
      { property: "og:title", content: "Access code tool — Idea Board" },
      { property: "og:description", content: "Turn a private access code into a secure fingerprint for Idea Board." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Tool,
});

function Tool() {
  const [code, setCode] = useState("");
  const [out, setOut] = useState("");
  return (
    <main className="mx-auto max-w-lg space-y-3 p-6">
      <h1 className="text-xl font-bold">Make an access code fingerprint</h1>
      <p className="text-sm text-muted-foreground">
        Type the access code you want. A secure fingerprint is created right here in your browser — the code itself is
        never sent anywhere. Copy the fingerprint into the <code>ACCESS_CODE_HASH</code> setting.
      </p>
      <input
        type="password"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="New access code"
        className="w-full rounded-md border bg-background px-3 py-2"
      />
      <button
        disabled={code.length < 6}
        onClick={async () => setOut(await hashAccessCode(code))}
        className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
      >
        Create fingerprint
      </button>
      {code && code.length < 6 && <p className="text-xs text-muted-foreground">Use at least 6 characters.</p>}
      {out && (
        <textarea readOnly value={out} rows={3} onFocus={(e) => e.target.select()} className="w-full rounded-md border bg-card p-2 font-mono text-xs" />
      )}
    </main>
  );
}
