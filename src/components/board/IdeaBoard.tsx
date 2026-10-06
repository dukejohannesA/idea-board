import { getData, persist } from "@/lib/sync";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BOARD_TYPES,
  fileToDataUrl,
  isUrl,
  itemText,
  makeItem,
  starterItems,
  uid,
  type Board,
  type BoardType,
  type Item,
  type ItemType,
  type TodoEntry,
} from "@/lib/board";
import { ItemCard } from "./ItemCard";
import { Inspector } from "./Inspector";
import { RichText } from "./RichText";

type Rect = { x: number; y: number; w: number; h: number; hidden?: boolean };
const CLIP_MARK = "ideaboard:copy";

const TOOLS: { type: ItemType | "upload"; label: string; key: string; icon: string }[] = [
  { type: "sticky", label: "Sticky note", key: "N", icon: "🗒️" },
  { type: "text", label: "Text card", key: "", icon: "📄" },
  { type: "upload", label: "Image", key: "I", icon: "🖼️" },
  { type: "link", label: "Link", key: "L", icon: "🔗" },
  { type: "todo", label: "To-do list", key: "T", icon: "☑️" },
  { type: "task", label: "Task", key: "", icon: "📌" },
  { type: "column", label: "Column", key: "C", icon: "▥" },
  { type: "heading", label: "Heading", key: "H", icon: "𝐇" },
  { type: "quote", label: "Quote", key: "", icon: "❝" },
  { type: "swatch", label: "Colour swatch", key: "", icon: "🎨" },
];

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const inside = (p: { x: number; y: number }, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export function IdeaBoard({ initialBoardId }: { initialBoardId: string }) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [boardId, setBoardId] = useState("");
  const [view, setView] = useState({ x: 80, y: 40, s: 1 });
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Set<string>>(new Set());
  const [box, setBox] = useState<Rect | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [warn, setWarn] = useState("");
  const [, force] = useState(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const viewRef = useRef(view);
  viewRef.current = view;
  const past = useRef<Item[][]>([]);
  const future = useRef<Item[][]>([]);
  const lastKey = useRef<{ key: string; t: number }>({ key: "", t: 0 });
  const clip = useRef<Item[]>([]);
  const pendingImagePos = useRef<{ x: number; y: number } | null>(null);

  // ---------- load / save ----------
  useEffect(() => {
    const { boards, items } = getData();
    setBoards(boards);
    setItems(items);
    setBoardId(boards.find((b) => b.id === initialBoardId)?.id ?? boards[0]!.id);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      const ok = persist(boards, items);
      setWarn(ok ? "" : "Browser storage is full — remove some images to keep saving.");
      localStorage.setItem("ib.current", boardId);
    }, 250);
    return () => clearTimeout(t);
  }, [boards, items, boardId, loaded]);

  const latest = useRef({ boards, items, loaded });
  latest.current = { boards, items, loaded };
  useEffect(() => () => {
    if (latest.current.loaded) persist(latest.current.boards, latest.current.items);
  }, []);

  // ---------- history ----------
  const pushHistory = useCallback((snap: Item[]) => {
    past.current.push(snap);
    if (past.current.length > 150) past.current.shift();
    future.current = [];
    force((n) => n + 1);
  }, []);

  const commit = useCallback(
    (fn: (prev: Item[]) => Item[], coalesceKey?: string) => {
      const snap = itemsRef.current;
      const nowT = Date.now();
      const coalesce = coalesceKey && lastKey.current.key === coalesceKey && nowT - lastKey.current.t < 1000;
      lastKey.current = { key: coalesceKey ?? "", t: nowT };
      if (!coalesce) pushHistory(snap);
      const next = fn(snap);
      itemsRef.current = next;
      setItems(next);
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(itemsRef.current);
    setItems(prev);
    lastKey.current = { key: "", t: 0 };
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(itemsRef.current);
    setItems(next);
  }, []);

  // ---------- derived ----------
  const boardItems = useMemo(
    () => items.filter((i) => i.boardId === boardId && !i.data.archived),
    [items, boardId],
  );

  const layout = useMemo(() => {
    const map = new Map<string, Rect>();
    boardItems.forEach((i) => map.set(i.id, { x: i.x, y: i.y, w: i.w, h: i.h }));
    // columns stack their children vertically
    boardItems
      .filter((c) => c.type === "column")
      .forEach((col) => {
        const kids = boardItems.filter((k) => k.parentId === col.id && !dragging.has(k.id)).sort((a, b) => a.y - b.y);
        let cy = col.y + 56;
        kids.forEach((k) => {
          map.set(k.id, { x: col.x + 10, y: cy, w: col.w - 20, h: k.h, hidden: !!col.collapsed });
          cy += k.h + 10;
        });
        map.set(col.id, { x: col.x, y: col.y, w: col.w, h: col.collapsed ? 48 : Math.max(col.h, cy - col.y) });
      });
    // collapsed frames hide what's inside them
    boardItems
      .filter((f) => f.type === "frame" && f.collapsed)
      .forEach((f) => {
        const full = { x: f.x, y: f.y, w: f.w, h: f.h };
        boardItems.forEach((o) => {
          if (o.id === f.id || o.type === "frame") return;
          const r = map.get(o.id)!;
          if (inside(center(r), full)) r.hidden = true;
        });
        map.set(f.id, { ...full, h: 40 });
      });
    return map;
  }, [boardItems, dragging]);

  const geo = (id: string): Rect => layout.get(id) ?? { x: 0, y: 0, w: 0, h: 0 };

  const allTags = useMemo(() => [...new Set(boardItems.flatMap((i) => i.tags))].sort(), [boardItems]);
  const matches = (it: Item) =>
    (!search.trim() || itemText(it).includes(search.trim().toLowerCase())) && (!tagFilter || it.tags.includes(tagFilter));
  const filtering = !!search.trim() || !!tagFilter;
  const maxZ = boardItems.reduce((m, i) => Math.max(m, i.z), 0);

  // ---------- helpers ----------
  const toWorld = (cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (cx - r.left - v.x) / v.s, y: (cy - r.top - v.y) / v.s };
  };
  const viewCenter = () => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 200, y: 200 };
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  };

  const patchItem = (id: string, patch: Partial<Item>, key?: string) =>
    commit((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i)), key);
  const patchData = (id: string, patch: Record<string, unknown>, key?: string) =>
    commit(
      (prev) => prev.map((i) => (i.id === id ? { ...i, data: { ...i.data, ...patch }, updatedAt: new Date().toISOString() } : i)),
      key,
    );

  function addItem(type: ItemType, data: Record<string, unknown> = {}, at?: { x: number; y: number }, overrides: Partial<Item> = {}) {
    const c = at ?? viewCenter();
    const jitter = at ? 0 : (Math.random() - 0.5) * 60;
    const it = makeItem(boardId, type, 0, 0, type === "frame" ? 0 : maxZ + 1, overrides, data);
    it.x = c.x - it.w / 2 + jitter;
    it.y = c.y - it.h / 2 + jitter;
    if (type === "sticky") it.rotation = Math.round((Math.random() - 0.5) * 4);
    commit((prev) => [...prev, it]);
    setSelected([it.id]);
    if (type === "sticky" || type === "heading" || type === "quote") setEditingId(it.id);
    return it;
  }

  async function addImages(files: File[], at?: { x: number; y: number }) {
    let off = 0;
    for (const f of files.filter((f) => f.type.startsWith("image/"))) {
      try {
        const src = await fileToDataUrl(f);
        const base = at ?? viewCenter();
        addItem("image", { src, caption: f.name.replace(/\.[^.]+$/, "") }, { x: base.x + off, y: base.y + off });
        off += 30;
      } catch {
        setWarn("Couldn't read that image.");
      }
    }
  }

  function addLink(url: string, at?: { x: number; y: number }) {
    addItem("link", { url: url.trim(), title: "" }, at);
  }

  function runTool(t: ItemType | "upload") {
    setAddMenu(false);
    if (t === "upload") {
      const choice = window.prompt("Paste an image URL, or leave empty to upload from your device");
      if (choice === null) return;
      if (choice.trim()) addItem("image", { src: choice.trim() });
      else fileRef.current?.click();
      return;
    }
    if (t === "link") {
      const url = window.prompt("Paste a link (https://…)");
      if (url?.trim()) addLink(isUrl(url) ? url : "https://" + url.trim());
      return;
    }
    addItem(t);
  }

  function groupSelection() {
    const sel = boardItems.filter((i) => selected.includes(i.id) && i.type !== "frame");
    if (!sel.length) return;
    const rs = sel.map((i) => geo(i.id));
    const x1 = Math.min(...rs.map((r) => r.x)) - 24;
    const y1 = Math.min(...rs.map((r) => r.y)) - 56;
    const x2 = Math.max(...rs.map((r) => r.x + r.w)) + 24;
    const y2 = Math.max(...rs.map((r) => r.y + r.h)) + 24;
    const minZ = Math.min(...boardItems.map((i) => i.z));
    const f = makeItem(boardId, "frame", x1, y1, minZ - 1, { w: x2 - x1, h: y2 - y1 });
    commit((prev) => [...prev, f]);
    setSelected([f.id]);
  }

  function frameContents(f: Item, from = boardItems) {
    const r = { x: f.x, y: f.y, w: f.w, h: f.h };
    return from.filter((o) => o.id !== f.id && o.type !== "frame" && !o.parentId && inside(center(geo(o.id)), r));
  }

  function deleteIds(ids: string[]) {
    if (!ids.length) return;
    let remove = new Set(ids);
    const frames = boardItems.filter((i) => remove.has(i.id) && i.type === "frame");
    for (const f of frames) {
      const kids = frameContents(f).filter((k) => !remove.has(k.id));
      if (kids.length && window.confirm(`Also delete the ${kids.length} item(s) inside "${f.data.title}"? Cancel keeps them.`))
        kids.forEach((k) => remove.add(k.id));
    }
    remove = new Set(remove);
    commit((prev) =>
      prev
        .filter((i) => !remove.has(i.id))
        .map((i) => {
          if (i.parentId && remove.has(i.parentId)) {
            const g = geo(i.id);
            return { ...i, parentId: null, x: g.x, y: g.y };
          }
          return i;
        }),
    );
    setSelected([]);
    setEditingId(null);
  }

  function collectWithChildren(ids: string[]) {
    const set = new Set(ids);
    boardItems.forEach((i) => i.parentId && set.has(i.parentId) && set.add(i.id));
    return boardItems.filter((i) => set.has(i.id));
  }

  function copySel() {
    clip.current = collectWithChildren(selected).map((i) => ({ ...i, ...geo(i.id), hidden: undefined }) as Item);
    navigator.clipboard?.writeText(CLIP_MARK).catch(() => {});
  }

  function pasteClip(src = clip.current, offset = 30) {
    if (!src.length) return;
    const idMap = new Map(src.map((i) => [i.id, uid()]));
    const t = new Date().toISOString();
    const clones = src.map((i, n) => ({
      ...structuredClone(i),
      id: idMap.get(i.id)!,
      boardId,
      parentId: i.parentId ? (idMap.get(i.parentId) ?? null) : null,
      x: i.x + offset,
      y: i.y + offset,
      z: i.type === "frame" ? i.z : maxZ + 1 + n,
      createdAt: t,
      updatedAt: t,
    }));
    commit((prev) => [...prev, ...clones]);
    setSelected(clones.filter((c) => !c.parentId || !idMap.has(src.find((s) => idMap.get(s.id) === c.id)!.parentId ?? "")).map((c) => c.id));
  }

  function duplicateSel() {
    const src = collectWithChildren(selected);
    const withFrames = [...src];
    src.filter((i) => i.type === "frame").forEach((f) => frameContents(f).forEach((k) => !withFrames.includes(k) && withFrames.push(k)));
    pasteClip(withFrames.map((i) => ({ ...i, ...geo(i.id) }) as Item), 30);
  }

  function convert(item: Item, action: string, payload?: string) {
    const g = geo(item.id);
    if (action === "sticky-to-task") {
      const task = makeItem(boardId, "task", g.x, g.y, item.z, { tags: item.tags, parentId: item.parentId }, {
        title: item.data.title || (item.data.body as string).split("\n")[0] || "Task",
        description: item.data.title ? item.data.body : "",
        due: item.data.due ?? "",
      });
      commit((prev) => [...prev.filter((i) => i.id !== item.id), task]);
      setSelected([task.id]);
    }
    if (action === "entry-to-sticky" || action === "entry-to-task") {
      const entries = item.data.entries as TodoEntry[];
      const e = entries.find((x) => x.id === payload);
      if (!e) return;
      const nu =
        action === "entry-to-sticky"
          ? makeItem(boardId, "sticky", g.x + g.w + 30, g.y, maxZ + 1, {}, { body: e.text, due: e.due ?? "" })
          : makeItem(boardId, "task", g.x + g.w + 30, g.y, maxZ + 1, {}, { title: e.text, done: e.done, due: e.due ?? "" });
      commit((prev) => [
        ...prev.map((i) => (i.id === item.id ? { ...i, data: { ...i.data, entries: entries.filter((x) => x.id !== e.id) } } : i)),
        nu,
      ]);
    }
    if (action === "task-to-list" && payload) {
      const entry: TodoEntry = { id: uid(), text: item.data.title, done: !!item.data.done, due: item.data.due || null };
      commit((prev) =>
        prev
          .filter((i) => i.id !== item.id)
          .map((i) => (i.id === payload ? { ...i, data: { ...i.data, entries: [...(i.data.entries ?? []), entry] } } : i)),
      );
      setSelected([payload]);
    }
  }

  // ---------- zoom ----------
  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    setView((v) => {
      const s = Math.min(3, Math.max(0.15, v.s * factor));
      const px = (cx ?? r.left + r.width / 2) - r.left;
      const py = (cy ?? r.top + r.height / 2) - r.top;
      return { s, x: px - ((px - v.x) / v.s) * s, y: py - ((py - v.y) / v.s) * s };
    });
  };

  const fit = () => {
    const r = canvasRef.current?.getBoundingClientRect();
    const rs = boardItems.map((i) => geo(i.id)).filter((g) => !g.hidden);
    if (!r || !rs.length) return setView({ x: 80, y: 40, s: 1 });
    const x1 = Math.min(...rs.map((g) => g.x));
    const y1 = Math.min(...rs.map((g) => g.y));
    const x2 = Math.max(...rs.map((g) => g.x + g.w));
    const y2 = Math.max(...rs.map((g) => g.y + g.h));
    const s = Math.min(1.5, Math.max(0.15, Math.min(r.width / (x2 - x1 + 120), r.height / (y2 - y1 + 120))));
    setView({ s, x: r.width / 2 - ((x1 + x2) / 2) * s, y: r.height / 2 - ((y1 + y2) / 2) * s });
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey && !e.ctrlKey) {
        setView((v) => ({ ...v, x: v.x - e.deltaX - e.deltaY, y: v.y }));
        return;
      }
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // ---------- pointer interactions ----------
  function onItemDown(e: React.PointerEvent, it: Item) {
    if (e.button !== 0 || editingId === it.id) return;
    e.stopPropagation();
    if (editingId) setEditingId(null);
    let sel = selected;
    if (e.shiftKey) {
      setSelected(sel.includes(it.id) ? sel.filter((x) => x !== it.id) : [...sel, it.id]);
      return;
    }
    if (!sel.includes(it.id)) {
      sel = [it.id];
      setSelected(sel);
    }
    const snapshot = itemsRef.current;
    const moving = new Set<string>();
    sel.forEach((id) => {
      const i = boardItems.find((b) => b.id === id);
      if (!i || (i.type === "frame" && i.locked)) return;
      moving.add(id);
      if (i.type === "frame") frameContents(i).forEach((k) => moving.add(k.id));
    });
    // children of moving columns follow via layout
    boardItems.forEach((i) => i.parentId && moving.has(i.parentId) && moving.delete(i.id));
    const start = new Map([...moving].map((id) => [id, geo(id)]));
    const sx = e.clientX;
    const sy = e.clientY;
    const s = view.s;
    let moved = false;
    const topZ = maxZ;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / s;
      const dy = (ev.clientY - sy) / s;
      if (!moved && Math.hypot(dx * s, dy * s) < 4) return;
      if (!moved) {
        moved = true;
        setDragging(new Set(moving));
      }
      setItems((prev) =>
        prev.map((i) => {
          const st = start.get(i.id);
          if (!st) return i;
          const lift = i.type !== "frame" && i.type !== "column" && i.z <= topZ ? { z: topZ + 1 } : {};
          return { ...i, ...lift, x: st.x + dx, y: st.y + dy };
        }),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!moved) return;
      setItems((prev) => {
        const cols = prev.filter((c) => c.boardId === boardId && c.type === "column" && !moving.has(c.id) && !c.collapsed);
        return prev.map((i) => {
          if (!moving.has(i.id) || i.type === "column" || i.type === "frame") return i;
          const c = center({ x: i.x, y: i.y, w: i.w, h: i.h });
          const col = cols.find((cc) => inside(c, geo(cc.id)));
          return { ...i, parentId: col ? col.id : null, updatedAt: new Date().toISOString() };
        });
      });
      pushHistory(snapshot);
      setDragging(new Set());
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onResizeDown(e: React.PointerEvent, it: Item) {
    e.stopPropagation();
    const snapshot = itemsRef.current;
    const g = geo(it.id);
    const sx = e.clientX;
    const sy = e.clientY;
    const s = view.s;
    const onMove = (ev: PointerEvent) => {
      const w = Math.max(60, g.w + (ev.clientX - sx) / s);
      const h = Math.max(40, (it.type === "column" ? it.h : g.h) + (ev.clientY - sy) / s);
      setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, w, h } : i)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      pushHistory(snapshot);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onCanvasDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    setAddMenu(false);
    if (editingId) setEditingId(null);
    const sx = e.clientX;
    const sy = e.clientY;
    if (e.shiftKey) {
      const a = toWorld(sx, sy);
      const onMove = (ev: PointerEvent) => {
        const b = toWorld(ev.clientX, ev.clientY);
        setBox({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const b = toWorld(ev.clientX, ev.clientY);
        const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
        const hit = boardItems
          .filter((i) => {
            const g = geo(i.id);
            return !g.hidden && g.x < r.x + r.w && g.x + g.w > r.x && g.y < r.y + r.h && g.y + g.h > r.y;
          })
          .map((i) => i.id);
        setSelected((prev) => [...new Set([...prev, ...hit])]);
        setBox(null);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return;
    }
    const v0 = view;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 3) moved = true;
      setView({ ...v0, x: v0.x + ev.clientX - sx, y: v0.y + ev.clientY - sy });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!moved) setSelected([]);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // ---------- keyboard & clipboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || newBoardOpen || openId) {
        if (e.key === "Escape") setOpenId(null);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && k === "y") {
        e.preventDefault();
        redo();
      } else if (mod && k === "c") {
        if (selected.length) copySel();
      } else if (mod && k === "d") {
        e.preventDefault();
        duplicateSel();
      } else if (mod && k === "a") {
        e.preventDefault();
        setSelected(boardItems.map((i) => i.id));
      } else if (mod) {
        return;
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteIds(selected);
      } else if (e.key === "Escape") {
        setSelected([]);
        setAddMenu(false);
      } else if (k === "n") {
        e.preventDefault();
        addItem("sticky");
      } else if (k === "i") runTool("upload");
      else if (k === "l") runTool("link");
      else if (k === "t") addItem("todo");
      else if (k === "c") addItem("column");
      else if (k === "h") {
        e.preventDefault();
        addItem("heading");
      } else if (k === "g") groupSelection();
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || newBoardOpen) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        void addImages(files);
        return;
      }
      const text = e.clipboardData?.getData("text/plain")?.trim() ?? "";
      if (text === CLIP_MARK || (!text && clip.current.length)) {
        e.preventDefault();
        pasteClip();
      } else if (isUrl(text)) {
        e.preventDefault();
        if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(text)) addItem("image", { src: text });
        else addLink(text);
      } else if (text) {
        e.preventDefault();
        addItem("sticky", { body: text });
        setEditingId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  });

  // ---------- boards ----------
  const board = boards.find((b) => b.id === boardId);

  function createBoard(type: BoardType, name: string) {
    const b: Board = { id: uid(), name: name || BOARD_TYPES.find((t) => t.type === type)!.label, type, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setBoards((prev) => [...prev, b]);
    setItems((prev) => [...prev, ...starterItems(b.id, type)]);
    switchBoard(b.id);
    setNewBoardOpen(false);
  }

  function switchBoard(id: string) {
    setBoardId(id);
    void navigate({ to: "/board/$boardId", params: { boardId: id }, replace: true });
    setSelected([]);
    setEditingId(null);
    past.current = [];
    future.current = [];
    setView({ x: 80, y: 40, s: 1 });
  }

  function deleteBoard() {
    if (boards.length < 2 || !board) return;
    if (!window.confirm(`Delete the board "${board.name}" and everything on it?`)) return;
    setItems((prev) => prev.filter((i) => i.boardId !== board.id));
    const rest = boards.filter((b) => b.id !== board.id);
    setBoards(rest);
    switchBoard(rest[0]!.id);
  }

  if (!loaded) return <main className="min-h-screen bg-canvas" />;

  const single = selected.length === 1 && !dragging.size ? boardItems.find((i) => i.id === selected[0]) : undefined;
  const open = openId ? boardItems.find((i) => i.id === openId) : undefined;
  const sorted = [...boardItems].sort((a, b) => a.z - b.z);
  const tbtn = "rounded-md border bg-card px-2 py-1 text-sm hover:bg-accent disabled:opacity-40";

  // minimap
  const rects = boardItems.map((i) => geo(i.id)).filter((g) => !g.hidden);
  const canvasRect = canvasRef.current?.getBoundingClientRect();
  const vp = canvasRect
    ? { x: -view.x / view.s, y: -view.y / view.s, w: canvasRect.width / view.s, h: canvasRect.height / view.s }
    : { x: 0, y: 0, w: 1000, h: 800 };
  const all = [...rects, vp];
  const mx1 = Math.min(...all.map((r) => r.x));
  const my1 = Math.min(...all.map((r) => r.y));
  const mx2 = Math.max(...all.map((r) => r.x + r.w));
  const my2 = Math.max(...all.map((r) => r.y + r.h));
  const MW = 180;
  const MH = 120;
  const ms = Math.min(MW / (mx2 - mx1 || 1), MH / (my2 - my1 || 1));

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top toolbar */}
      <header className="z-40 flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Link to="/" className="mr-1 font-black tracking-tight hover:text-primary" title="All boards">← 📌 Idea Board</Link>
        <select value={boardId} onChange={(e) => switchBoard(e.target.value)} className="rounded-md border bg-card px-2 py-1 text-sm" aria-label="Board">
          {boards.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <input
          value={board?.name ?? ""}
          onChange={(e) => setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, name: e.target.value } : b)))}
          className="w-40 rounded-md border bg-card px-2 py-1 text-sm font-semibold"
          aria-label="Board name"
        />
        <button className={tbtn} onClick={() => setNewBoardOpen(true)}>+ New board</button>
        <button className={tbtn} onClick={deleteBoard} disabled={boards.length < 2} title="Delete this board">🗑</button>
        <div className="mx-1 h-6 w-px bg-border" />
        <button className={tbtn} onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)">↶</button>
        <button className={tbtn} onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Shift+Z)">↷</button>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search board…" className="w-36 rounded-md border bg-card px-2 py-1 text-sm" />
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="rounded-md border bg-card px-2 py-1 text-sm" aria-label="Tag filter">
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>#{t}</option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button className={tbtn} onClick={() => zoomAt(1 / 1.2)} aria-label="Zoom out">−</button>
          <button className={tbtn} onClick={() => setView((v) => ({ ...v, s: 1 }))} title="Reset zoom">{Math.round(view.s * 100)}%</button>
          <button className={tbtn} onClick={() => zoomAt(1.2)} aria-label="Zoom in">+</button>
          <button className={tbtn} onClick={fit}>Fit</button>
          <button className={tbtn} disabled title="Sharing is coming soon">Share</button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Left content toolbar */}
        <nav className="z-30 hidden w-14 flex-col items-center gap-1 border-r bg-card py-2 md:flex">
          {TOOLS.map((t) => (
            <button
              key={t.label}
              onClick={() => runTool(t.type)}
              title={`${t.label}${t.key ? ` (${t.key})` : ""}`}
              className="grid h-10 w-10 place-items-center rounded-md text-lg hover:bg-accent"
            >
              {t.icon}
            </button>
          ))}
          <button
            onClick={groupSelection}
            disabled={!selected.length}
            title="Group selected into a frame (G)"
            className="grid h-10 w-10 place-items-center rounded-md text-lg hover:bg-accent disabled:opacity-30"
          >
            ⬚
          </button>
        </nav>

        {/* Canvas */}
        <div
          ref={canvasRef}
          onPointerDown={onCanvasDown}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const at = toWorld(e.clientX, e.clientY);
            const files = [...e.dataTransfer.files];
            if (files.length) void addImages(files, at);
            else {
              const t = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
              if (isUrl(t)) addLink(t, at);
            }
          }}
          className="relative min-w-0 flex-1 cursor-grab touch-none select-none overflow-hidden bg-canvas active:cursor-grabbing"
          style={{
            backgroundImage: "radial-gradient(var(--canvas-dot) 1.2px, transparent 1.2px)",
            backgroundSize: `${24 * view.s}px ${24 * view.s}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
        >
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}>
            {sorted.map((it) => {
              const g = geo(it.id);
              if (g.hidden) return null;
              const sel = selected.includes(it.id);
              const parent = it.parentId ? boardItems.find((p) => p.id === it.parentId) : undefined;
              const z = dragging.has(it.id) ? 100000 : parent ? parent.z * 2 + 1 : it.z * 2;
              const t = it.type;
              const frameStyle =
                t === "frame"
                  ? { border: `2px dashed ${it.data.border}`, background: it.colour }
                  : t === "heading"
                    ? {}
                    : t === "image"
                      ? { background: "#fff", border: it.data.border ? "1px solid rgba(0,0,0,.12)" : undefined }
                      : { background: it.colour };
              const shadow =
                t === "sticky"
                  ? "shadow-[0_6px_14px_-6px_rgba(60,40,10,.45)]"
                  : t === "frame" || t === "heading"
                    ? ""
                    : t === "image" && !it.data.shadow
                      ? ""
                      : "shadow-[0_2px_8px_-2px_rgba(60,40,10,.3)]";
              return (
                <div
                  key={it.id}
                  onPointerDown={(e) => onItemDown(e, it)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (["sticky", "text", "heading", "quote"].includes(t)) setEditingId(it.id);
                    else if (t === "image") setOpenId(it.id);
                  }}
                  className={`absolute cursor-default ${t === "column" ? "rounded-xl border" : t === "frame" ? "rounded-2xl" : t === "sticky" ? "rounded-sm" : "rounded-lg"} ${shadow} ${
                    sel ? "outline outline-2 outline-offset-2 outline-selection" : ""
                  } ${filtering && !matches(it) ? "opacity-25" : ""} ${it.pinned ? "ring-2 ring-primary/60" : ""}`}
                  style={{
                    left: g.x,
                    top: g.y,
                    width: g.w,
                    height: g.h,
                    zIndex: z,
                    transform: it.rotation && !dragging.has(it.id) ? `rotate(${it.rotation}deg)` : undefined,
                    ...frameStyle,
                  }}
                >
                  {it.pinned && <span className="absolute -right-2 -top-2 text-sm">★</span>}
                  <div className="h-full overflow-hidden rounded-[inherit]">
                    <ItemCard
                      item={it}
                      editing={editingId === it.id}
                      childCount={boardItems.filter((k) => k.parentId === it.id).length}
                      onData={(p) => patchData(it.id, p)}
                      onPatch={(p) => patchItem(it.id, p)}
                      onStopEdit={() => setEditingId(null)}
                      onOpen={() => setOpenId(it.id)}
                    />
                  </div>
                  {sel && selected.length === 1 && !(t === "frame" && it.locked) && !parent && (
                    <div
                      onPointerDown={(e) => onResizeDown(e, it)}
                      className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-selection bg-card"
                    />
                  )}
                </div>
              );
            })}
            {box && (
              <div
                className="pointer-events-none absolute border border-selection bg-selection/10"
                style={{ left: box.x, top: box.y, width: box.w, height: box.h, zIndex: 200000 }}
              />
            )}
          </div>

          {boardItems.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <p className="text-lg font-semibold">Your board is empty. What&apos;s on your mind?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Press N for a sticky note, paste an image or link, or drop files here.
                </p>
              </div>
            </div>
          )}

          {/* Selection bar */}
          {selected.length > 1 && (
            <div onPointerDown={(e) => e.stopPropagation()} className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 gap-1 rounded-lg border bg-card p-1 text-sm shadow">
              <span className="px-2 py-1 text-muted-foreground">{selected.length} selected</span>
              <button className={tbtn} onClick={groupSelection}>Group</button>
              <button className={tbtn} onClick={duplicateSel}>Duplicate</button>
              <button className={tbtn} onClick={() => deleteIds(selected)}>Delete</button>
            </div>
          )}

          {/* Minimap */}
          <svg
            width={MW}
            height={MH}
            onPointerDown={(e) => {
              e.stopPropagation();
              const r = (e.currentTarget as SVGElement).getBoundingClientRect();
              const wx = mx1 + (e.clientX - r.left) / ms;
              const wy = my1 + (e.clientY - r.top) / ms;
              const cr = canvasRef.current!.getBoundingClientRect();
              setView((v) => ({ ...v, x: cr.width / 2 - wx * v.s, y: cr.height / 2 - wy * v.s }));
            }}
            className="absolute bottom-3 right-3 z-20 hidden cursor-pointer rounded-md border bg-card/90 shadow sm:block"
          >
            {boardItems.map((i) => {
              const g = geo(i.id);
              if (g.hidden) return null;
              return (
                <rect
                  key={i.id}
                  x={(g.x - mx1) * ms}
                  y={(g.y - my1) * ms}
                  width={Math.max(2, g.w * ms)}
                  height={Math.max(2, g.h * ms)}
                  fill={i.type === "frame" ? "none" : i.type === "heading" ? "#3b2f22" : i.colour === "transparent" ? "#ccc" : i.colour}
                  stroke="rgba(0,0,0,.3)"
                  strokeWidth={0.5}
                />
              );
            })}
            <rect x={(vp.x - mx1) * ms} y={(vp.y - my1) * ms} width={vp.w * ms} height={vp.h * ms} fill="none" stroke="var(--selection)" strokeWidth={1.5} />
          </svg>

          {/* Floating add button */}
          <div onPointerDown={(e) => e.stopPropagation()} className="absolute bottom-4 left-4 z-30">
            {addMenu && (
              <div className="mb-2 grid w-48 gap-0.5 rounded-lg border bg-card p-1 shadow-lg">
                {TOOLS.map((t) => (
                  <button key={t.label} onClick={() => runTool(t.type)} className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                    <span>{t.icon}</span> {t.label}
                    {t.key && <kbd className="ml-auto text-xs text-muted-foreground">{t.key}</kbd>}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setAddMenu((v) => !v)} className="rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-lg">
              {addMenu ? "✕ Close" : "+ Add"}
            </button>
          </div>

          {warn && (
            <div className="absolute left-1/2 bottom-4 z-30 -translate-x-1/2 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground shadow">
              {warn}
            </div>
          )}

          {single && (
            <Inspector
              key={single.id}
              item={single}
              todoLists={boardItems.filter((i) => i.type === "todo")}
              onData={(p) => patchData(single.id, p, "d" + single.id + Object.keys(p).join())}
              onPatch={(p) => patchItem(single.id, p, "p" + single.id + Object.keys(p).join())}
              onDuplicate={duplicateSel}
              onDelete={() => deleteIds([single.id])}
              onConvert={(a, p) => convert(single, a, p)}
              onOpen={() => setOpenId(single.id)}
              onClose={() => setSelected([])}
            />
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void addImages([...(e.target.files ?? [])], pendingImagePos.current ?? undefined);
          e.target.value = "";
        }}
      />

      {/* Lightbox / focused editor */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/70 p-6" onClick={() => setOpenId(null)}>
          {open.type === "image" ? (
            <figure onClick={(e) => e.stopPropagation()} className="max-h-full max-w-5xl">
              <img src={open.data.src} alt={open.data.caption || "Image"} className="max-h-[80vh] rounded-md object-contain" />
              <figcaption className="mt-2 text-center text-sm text-background">
                {open.data.caption}
                {open.data.credit && <> · {open.data.credit}</>}
                {open.data.source && (
                  <> · <a className="underline" href={open.data.source} target="_blank" rel="noreferrer">source</a></>
                )}
              </figcaption>
            </figure>
          ) : (
            <div onClick={(e) => e.stopPropagation()} className="flex h-[85vh] w-full max-w-5xl flex-col gap-3 rounded-xl bg-card p-5 shadow-2xl">
              <div className="flex items-center gap-2">
                <input
                  value={open.data.title ?? ""}
                  onChange={(e) => patchData(open.id, { title: e.target.value }, "ft" + open.id)}
                  className="flex-1 bg-transparent text-2xl font-bold outline-none"
                />
                <button className={tbtn} onClick={() => setOpenId(null)}>Collapse to card</button>
              </div>
              <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
                <textarea
                  autoFocus
                  value={open.data.body ?? ""}
                  onChange={(e) => patchData(open.id, { body: e.target.value }, "fb" + open.id)}
                  placeholder="# Heading, - bullets, 1. numbered, [ ] checklist, > quote, **bold**, *italic*, [link](https://…)"
                  className="h-full resize-none rounded-md border bg-background p-3 font-mono text-sm outline-none"
                />
                <div className="overflow-auto rounded-md border p-3 text-sm">
                  <RichText text={open.data.body ?? ""} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New board modal */}
      {newBoardOpen && <NewBoardModal onCreate={createBoard} onClose={() => setNewBoardOpen(false)} />}
    </main>
  );
}

export function NewBoardModal({ onCreate, onClose }: { onCreate: (t: BoardType, name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">New board</h2>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Board name (optional)"
          className="mb-4 w-full rounded-md border bg-background px-3 py-2"
        />
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {BOARD_TYPES.map((b) => (
            <button
              key={b.type}
              onClick={() => onCreate(b.type, name.trim())}
              className="rounded-lg border bg-background p-3 text-left hover:border-primary hover:bg-accent"
            >
              <div className="font-semibold">{b.label}</div>
              <div className="text-xs text-muted-foreground">{b.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
