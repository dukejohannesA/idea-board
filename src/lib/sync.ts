// Offline-first sync between the in-browser board copy and the online database.
// The browser copy (localStorage) is always written first, then changes are queued
// and pushed to the server. If the server can't be reached, the queue is kept and
// retried automatically when the connection comes back.

import { loadAll, saveAll, type Board, type Item } from "./board";
import { finishLocalMigration, loadBoardData, syncChanges } from "./board.functions";

type Data = { boards: Board[]; items: Item[] };
export type SyncStatus = { state: "saved" | "saving" | "offline" | "error"; pending: number };

const QUEUE_KEY = "ib.syncQueue";
const BACKUP_KEY = "ib.backup.preMigration";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH = 25;

let current: Data = { boards: [], items: [] };
let lastBoards = new Map<string, Board>();
let lastItems = new Map<string, Item>();
let ready = false;

interface Queue {
  boards: Set<string>;
  items: Set<string>;
  delBoards: Set<string>;
  delItems: Set<string>;
}
const emptyQueue = (): Queue => ({ boards: new Set(), items: new Set(), delBoards: new Set(), delItems: new Set() });
let queue = emptyQueue();

let status: SyncStatus = { state: "saved", pending: 0 };
const listeners = new Set<(s: SyncStatus) => void>();
function setStatus(s: SyncStatus["state"]) {
  status = { state: s, pending: queueSize() };
  listeners.forEach((l) => l(status));
}
export function subscribeSync(cb: (s: SyncStatus) => void) {
  listeners.add(cb);
  cb(status);
  return () => void listeners.delete(cb);
}

const queueSize = () => queue.boards.size + queue.items.size + queue.delBoards.size + queue.delItems.size;

function saveQueue() {
  try {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify({
        boards: [...queue.boards],
        items: [...queue.items],
        delBoards: [...queue.delBoards],
        delItems: [...queue.delItems],
      }),
    );
  } catch {
    /* ignore */
  }
}
function loadQueue() {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "null");
    if (q) queue = { boards: new Set(q.boards), items: new Set(q.items), delBoards: new Set(q.delBoards), delItems: new Set(q.delItems) };
  } catch {
    /* ignore */
  }
}

function snapshot(d: Data) {
  lastBoards = new Map(d.boards.map((b) => [b.id, b]));
  lastItems = new Map(d.items.map((i) => [i.id, i]));
}

export function getData(): Data {
  return current;
}

/** Save locally, work out what changed since last time, and queue it for the server. */
export function persist(boards: Board[], items: Item[]): boolean {
  current = { boards, items };
  const ok = saveAll(boards, items);
  if (!ready) return ok;

  const nb = new Map(boards.map((b) => [b.id, b]));
  const ni = new Map(items.map((i) => [i.id, i]));
  for (const [id, b] of nb)
    if (lastBoards.get(id) !== b) {
      queue.boards.add(id);
      queue.delBoards.delete(id);
    }
  for (const id of lastBoards.keys())
    if (!nb.has(id)) {
      queue.delBoards.add(id);
      queue.boards.delete(id);
    }
  for (const [id, i] of ni)
    if (lastItems.get(id) !== i) {
      queue.items.add(id);
      queue.delItems.delete(id);
    }
  for (const id of lastItems.keys())
    if (!ni.has(id)) {
      queue.delItems.add(id);
      queue.items.delete(id);
    }
  lastBoards = nb;
  lastItems = ni;

  if (queueSize()) {
    saveQueue();
    scheduleFlush(300);
  }
  return ok;
}

// ---------- flushing ----------
let flushing = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let backoff = 2000;

function scheduleFlush(ms: number) {
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), ms);
}

export async function flush(): Promise<boolean> {
  if (flushing || !queueSize()) {
    if (!queueSize() && !flushing) setStatus("saved");
    return !queueSize();
  }
  flushing = true;
  const sent = queue;
  queue = emptyQueue();
  setStatus("saving");
  try {
    const boardsById = new Map(current.boards.map((b) => [b.id, b]));
    const itemsById = new Map(current.items.map((i) => [i.id, i]));
    const boards = [...sent.boards].map((id) => boardsById.get(id)).filter(Boolean) as Board[];
    const items = [...sent.items].map((id) => itemsById.get(id)).filter(Boolean) as Item[];
    // Boards first so items always have a board to belong to.
    for (let i = 0; i < Math.max(boards.length, 1); i += BATCH) {
      const b = boards.slice(i, i + BATCH);
      if (b.length) await syncChanges({ data: { boards: b, items: [], deleteItems: [], deleteBoards: [] } });
    }
    for (let i = 0; i < items.length; i += BATCH)
      await syncChanges({ data: { boards: [], items: items.slice(i, i + BATCH), deleteItems: [], deleteBoards: [] } });
    if (sent.delItems.size || sent.delBoards.size)
      await syncChanges({ data: { boards: [], items: [], deleteItems: [...sent.delItems], deleteBoards: [...sent.delBoards] } });
    backoff = 2000;
    flushing = false;
    saveQueue();
    if (queueSize()) scheduleFlush(100);
    else setStatus("saved");
    return true;
  } catch (e) {
    console.warn("Sync failed, will retry", e);
    // Put unsent work back, without resurrecting things deleted or re-created meanwhile.
    const live = new Set(current.items.map((i) => i.id));
    const liveB = new Set(current.boards.map((b) => b.id));
    sent.boards.forEach((id) => liveB.has(id) && !queue.delBoards.has(id) && queue.boards.add(id));
    sent.items.forEach((id) => live.has(id) && !queue.delItems.has(id) && queue.items.add(id));
    sent.delBoards.forEach((id) => !liveB.has(id) && queue.delBoards.add(id));
    sent.delItems.forEach((id) => !live.has(id) && queue.delItems.add(id));
    saveQueue();
    flushing = false;
    setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
    scheduleFlush(backoff);
    backoff = Math.min(backoff * 2, 30000);
    return false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    backoff = 2000;
    void flush();
  });
}

// ---------- start-up & one-time migration ----------

/** Give every board/item a proper unique id the database accepts, fixing references. */
function toUuids(d: Data): Data {
  const map = new Map<string, string>();
  const fix = (id: string) => {
    if (UUID_RE.test(id)) return id;
    if (!map.has(id)) map.set(id, crypto.randomUUID());
    return map.get(id)!;
  };
  const boards = d.boards.map((b) => ({ ...b, id: fix(b.id) }));
  const boardIds = new Set(boards.map((b) => b.id));
  const items = d.items
    .map((i) => ({ ...i, id: fix(i.id), boardId: fix(i.boardId), parentId: i.parentId ? fix(i.parentId) : null }))
    .filter((i) => boardIds.has(i.boardId));
  return { boards, items };
}

export type InitResult = { source: "server" | "local"; migrated?: boolean };

export async function initSync(onProgress: (done: number, total: number) => void): Promise<InitResult> {
  loadQueue();
  const local = loadAll();
  current = local;

  let server: Awaited<ReturnType<typeof loadBoardData>>;
  try {
    server = await loadBoardData();
  } catch (e) {
    // Offline or unreachable: run from the browser copy, sync later.
    console.warn("Server unreachable, working offline", e);
    snapshot(current);
    ready = true;
    setStatus(queueSize() ? "offline" : "saved");
    scheduleFlush(backoff);
    return { source: "local" };
  }

  if (!server.migrated) {
    // One-time import of the browser copy into the database.
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(local));
    } catch {
      /* backup best effort — the original keys are kept too */
    }
    const data = toUuids(local);
    const total = data.boards.length + data.items.length;
    let done = 0;
    onProgress(0, total);
    for (let i = 0; i < data.boards.length; i += BATCH) {
      const b = data.boards.slice(i, i + BATCH);
      await syncChanges({ data: { boards: b, items: [], deleteItems: [], deleteBoards: [] } });
      done += b.length;
      onProgress(done, total);
    }
    // Parents (columns/frames) before children isn't required — no foreign key on parent.
    for (let i = 0; i < data.items.length; i += BATCH) {
      const it = data.items.slice(i, i + BATCH);
      await syncChanges({ data: { boards: [], items: it, deleteItems: [], deleteBoards: [] } });
      done += it.length;
      onProgress(done, total);
    }
    await finishLocalMigration();
    current = data;
    saveAll(data.boards, data.items);
    queue = emptyQueue();
    saveQueue();
    snapshot(current);
    ready = true;
    setStatus("saved");
    return { source: "server", migrated: true };
  }

  // Normal start: push anything queued while offline, then trust the server copy.
  ready = true;
  if (queueSize()) {
    snapshot(current);
    const ok = await flush();
    if (!ok) return { source: "local" };
    server = await loadBoardData();
  }
  current = { boards: server.boards, items: server.items };
  snapshot(current);
  if (!current.boards.length) {
    // Never leave the app without a board.
    const t = new Date().toISOString();
    const b: Board = { id: crypto.randomUUID(), name: "My Idea Board", type: "blank", createdAt: t, updatedAt: t };
    persist([b], []);
  } else {
    saveAll(current.boards, current.items);
  }
  setStatus("saved");
  return { source: "server" };
}
