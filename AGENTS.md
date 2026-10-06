<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Private access: AccessGate in __root checks an encrypted browser-session cookie via server functions in src/lib/access.functions.ts; the code is stored only as a PBKDF2 hash in the ACCESS_CODE_HASH secret. Why: no-login app that still blocks strangers; future data/upload server functions must call requireAccess().
- Board data: src/lib/sync.ts is the only read/write path — it writes the browser copy first, diffs by object reference, queues changes and pushes them through access-checked server functions (src/lib/board.functions.ts) using the server-role client. Why: offline-first and keeps the database closed to public keys (RLS on, no policies, no anon/authenticated grants).
