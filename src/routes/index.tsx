import { getData, persist as persistData } from "@/lib/sync";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { NewBoardModal } from "@/components/board/IdeaBoard";
import {
  BOARD_TYPES,
  starterItems,
  uid,
  type Board,
  type BoardType,
  type Item,
} from "@/lib/board";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Idea Board — All your boards" },
      {
        name: "description",
        content: "See every idea board you've made, open one, or start a new board from a template.",
      },
      { property: "og:title", content: "Idea Board — All your boards" },
      {
        property: "og:description",
        content: "See every idea board you've made, open one, or start a new board from a template.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

type Sort = "recent" | "name" | "created";

function Home() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  useEffect(() => {
    const d = getData();
    setBoards(d.boards);
    setItems(d.items);
    setLoaded(true);
  }, []);

  const persist = (b: Board[], i: Item[]) => {
    setBoards(b);
    setItems(i);
    persistData(b, i);
  };

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; edited: string; items: Item[] }>();
    boards.forEach((b) => m.set(b.id, { count: 0, edited: b.updatedAt, items: [] }));
    items.forEach((i) => {
      const s = m.get(i.boardId);
      if (!s || i.data.archived) return;
      s.count++;
      s.items.push(i);
      if (i.updatedAt > s.edited) s.edited = i.updatedAt;
    });
    return m;
  }, [boards, items]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const l = boards.filter((b) => !q || b.name.toLowerCase().includes(q));
    if (sort === "name") l.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "created") l.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "recent") l.sort((a, b) => (stats.get(b.id)?.edited ?? "").localeCompare(stats.get(a.id)?.edited ?? ""));
    return l;
  }, [boards, search, sort, stats]);

  function create(type: BoardType, name: string) {
    const t = new Date().toISOString();
    const b: Board = { id: uid(), name: name || BOARD_TYPES.find((x) => x.type === type)!.label, type, createdAt: t, updatedAt: t };
    persist([...boards, b], [...items, ...starterItems(b.id, type)]);
    void navigate({ to: "/board/$boardId", params: { boardId: b.id } });
  }

  function rename(b: Board) {
    const name = window.prompt("Rename board", b.name);
    if (!name?.trim()) return;
    persist(boards.map((x) => (x.id === b.id ? { ...x, name: name.trim(), updatedAt: new Date().toISOString() } : x)), items);
  }

  function duplicate(b: Board) {
    const t = new Date().toISOString();
    const nb: Board = { ...b, id: uid(), name: b.name + " (copy)", createdAt: t, updatedAt: t };
    const src = items.filter((i) => i.boardId === b.id);
    const idMap = new Map(src.map((i) => [i.id, uid()]));
    const clones = src.map((i) => ({
      ...structuredClone(i),
      id: idMap.get(i.id)!,
      boardId: nb.id,
      parentId: i.parentId ? (idMap.get(i.parentId) ?? null) : null,
    }));
    persist([...boards, nb], [...items, ...clones]);
  }

  function remove(b: Board) {
    if (boards.length < 2) return window.alert("You need at least one board.");
    if (!window.confirm(`Delete "${b.name}" and everything on it?`)) return;
    persist(boards.filter((x) => x.id !== b.id), items.filter((i) => i.boardId !== b.id));
  }

  const totalItems = items.filter((i) => !i.data.archived && boards.some((b) => b.id === i.boardId)).length;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <h1 className="text-2xl font-black tracking-tight">📌 Idea Board</h1>
          <span className="text-sm text-muted-foreground">
            {boards.length} boards · {totalItems} items
          </span>
          <button
            onClick={() => setNewOpen(true)}
            className="ml-auto rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow"
          >
            + New board
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-bold">Your boards</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search boards…"
            className="rounded-md border bg-card px-3 py-1.5 text-sm"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border bg-card px-2 py-1.5 text-sm">
            <option value="recent">Last edited</option>
            <option value="created">Newest</option>
            <option value="name">Name</option>
          </select>
        </div>

        {!loaded ? null : list.length === 0 ? (
          <p className="text-muted-foreground">No boards match your search.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => setNewOpen(true)}
              className="grid min-h-56 place-items-center rounded-xl border-2 border-dashed bg-card/50 text-muted-foreground hover:border-primary hover:text-primary"
            >
              <span className="text-center">
                <span className="block text-3xl">+</span>
                Start a new board
              </span>
            </button>
            {list.map((b) => {
              const s = stats.get(b.id)!;
              return (
                <article key={b.id} className="group overflow-hidden rounded-xl border bg-card shadow-sm transition hover:shadow-md">
                  <Link to="/board/$boardId" params={{ boardId: b.id }} className="block">
                    <Preview items={s.items} />
                  </Link>
                  <div className="flex items-start gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <Link to="/board/$boardId" params={{ boardId: b.id }} className="block truncate font-semibold hover:text-primary">
                        {b.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {BOARD_TYPES.find((t) => t.type === b.type)?.label} · {s.count} items · edited {timeAgo(s.edited)}
                      </div>
                    </div>
                    <div className="flex gap-1 text-xs">
                      <button onClick={() => rename(b)} className="rounded border px-1.5 py-0.5 hover:bg-accent" title="Rename">✎</button>
                      <button onClick={() => duplicate(b)} className="rounded border px-1.5 py-0.5 hover:bg-accent" title="Duplicate">⧉</button>
                      <button onClick={() => remove(b)} className="rounded border px-1.5 py-0.5 text-destructive hover:bg-accent" title="Delete">🗑</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {newOpen && <NewBoardModal onCreate={create} onClose={() => setNewOpen(false)} />}
    </main>
  );
}

function Preview({ items }: { items: Item[] }) {
  const W = 320;
  const H = 160;
  if (!items.length)
    return <div className="grid h-40 place-items-center bg-canvas text-sm text-muted-foreground">Empty board</div>;
  const x1 = Math.min(...items.map((i) => i.x));
  const y1 = Math.min(...items.map((i) => i.y));
  const x2 = Math.max(...items.map((i) => i.x + i.w));
  const y2 = Math.max(...items.map((i) => i.y + i.h));
  const s = Math.min((W - 24) / (x2 - x1 || 1), (H - 24) / (y2 - y1 || 1), 0.5);
  const ox = (W - (x2 - x1) * s) / 2;
  const oy = (H - (y2 - y1) * s) / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full bg-canvas">
      {[...items]
        .filter((i) => !i.parentId)
        .sort((a, b) => a.z - b.z)
        .map((i) => (
          <rect
            key={i.id}
            x={ox + (i.x - x1) * s}
            y={oy + (i.y - y1) * s}
            width={Math.max(3, i.w * s)}
            height={Math.max(3, (i.type === "heading" ? 4 : i.h) * s)}
            rx={2}
            fill={i.type === "heading" ? "#3b2f22" : i.type === "frame" || i.colour === "transparent" ? "none" : i.colour}
            stroke={i.type === "frame" ? (i.data.border ?? "#999") : "rgba(0,0,0,.15)"}
            strokeDasharray={i.type === "frame" ? "4 3" : undefined}
          />
        ))}
    </svg>
  );
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}
