import { domainOf, dueColour, type Item, type TodoEntry } from "@/lib/board";
import { RichText, toggleLine } from "./RichText";

interface Props {
  item: Item;
  editing: boolean;
  onData: (patch: Record<string, unknown>) => void;
  onPatch: (patch: Partial<Item>) => void;
  onStopEdit: () => void;
  onOpen: () => void;
  childCount: number;
}

const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

const PRIORITY: Record<string, string> = { low: "#16a34a", medium: "#eab308", high: "#dc2626" };

function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-foreground/10 px-1.5 text-[10px]">#{t}</span>
      ))}
    </div>
  );
}

function EditArea({ value, onSave, className = "" }: { value: string; onSave: (v: string) => void; className?: string }) {
  return (
    <textarea
      autoFocus
      defaultValue={value}
      onPointerDown={stop}
      onBlur={(e) => onSave(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
      }}
      className={`h-full w-full resize-none rounded bg-white/60 p-1 outline-none ring-1 ring-foreground/20 ${className}`}
    />
  );
}

export function ItemCard({ item, editing, onData, onPatch, onStopEdit, onOpen, childCount }: Props) {
  const d = item.data;

  switch (item.type) {
    case "sticky":
      return (
        <div className="flex h-full flex-col p-3 text-sm">
          {(d.emoji || d.title) && (
            <div className="mb-1 font-semibold">
              {d.emoji} {d.title}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-hidden">
            {editing ? (
              <EditArea value={d.body} onSave={(v) => { onData({ body: v }); onStopEdit(); }} />
            ) : d.body ? (
              <RichText text={d.body} onToggle={(l) => onData({ body: toggleLine(d.body, l) })} />
            ) : !d.title ? (
              <span className="opacity-40">Double-click to write…</span>
            ) : null}
          </div>
          {d.due && (
            <div className="mt-1 flex items-center gap-1 text-[11px]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: dueColour(d.due) }} /> {d.due}
            </div>
          )}
          <Tags tags={item.tags} />
        </div>
      );

    case "text":
      return (
        <div className="flex h-full flex-col p-3 text-sm">
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-foreground/10 pb-1">
            <span className="truncate font-semibold">{d.title}</span>
            <button onPointerDown={stop} onClick={onOpen} className="text-xs text-muted-foreground hover:text-foreground">
              Expand ↗
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {editing ? (
              <EditArea value={d.body} onSave={(v) => { onData({ body: v }); onStopEdit(); }} />
            ) : d.body ? (
              <RichText text={d.body} onToggle={(l) => onData({ body: toggleLine(d.body, l) })} />
            ) : (
              <span className="opacity-40">Double-click to write. Supports # headings, - lists, [ ] checklists, &gt; quotes, **bold**.</span>
            )}
          </div>
          <Tags tags={item.tags} />
        </div>
      );

    case "image":
      return (
        <div className="flex h-full flex-col p-1.5">
          <div className="min-h-0 flex-1 overflow-hidden rounded-sm bg-muted">
            {d.src ? (
              <img src={d.src} alt={d.caption || "Image"} draggable={false} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">No image</div>
            )}
          </div>
          {d.caption && <div className="truncate px-1 pt-1 text-xs">{d.caption}</div>}
        </div>
      );

    case "link":
      return (
        <div className="flex h-full flex-col p-3 text-sm">
          <div className="flex items-center gap-2">
            <img
              src={`https://www.google.com/s2/favicons?domain=${domainOf(d.url)}&sz=32`}
              alt=""
              className="h-4 w-4"
              draggable={false}
            />
            <span className="truncate text-xs text-muted-foreground">{domainOf(d.url)}</span>
          </div>
          <div className="mt-1 line-clamp-2 font-semibold">{d.title || d.url}</div>
          {d.note && <div className="mt-1 line-clamp-2 text-xs">{d.note}</div>}
          <a
            href={d.url}
            target="_blank"
            rel="noreferrer"
            onPointerDown={stop}
            className="mt-auto text-xs text-primary underline"
          >
            Open original link
          </a>
        </div>
      );

    case "todo": {
      const entries = (d.entries ?? []) as TodoEntry[];
      const done = entries.filter((e) => e.done).length;
      const set = (next: TodoEntry[]) => onData({ entries: next });
      return (
        <div className="flex h-full flex-col p-3 text-sm" style={{ borderTop: d.priority ? `4px solid ${PRIORITY[d.priority]}` : undefined }}>
          <div className="mb-1 flex justify-between font-semibold">
            <span className="truncate">{d.title}</span>
            <span className="text-xs text-muted-foreground">{done}/{entries.length}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-auto" onPointerDown={stop}>
            {entries.map((e) => (
              <label key={e.id} className="flex items-center gap-1.5">
                <input type="checkbox" checked={e.done} onChange={() => set(entries.map((x) => (x.id === e.id ? { ...x, done: !x.done } : x)))} />
                <span className={`flex-1 truncate ${e.done ? "line-through opacity-50" : ""}`}>{e.text}</span>
                {e.due && <span className="h-2 w-2 rounded-full" style={{ background: dueColour(e.due) }} />}
              </label>
            ))}
            <input
              placeholder="+ Add item"
              className="w-full bg-transparent text-sm outline-none placeholder:opacity-50"
              onKeyDown={(ev) => {
                const v = (ev.target as HTMLInputElement).value.trim();
                if (ev.key === "Enter" && v) {
                  set([...entries, { id: Math.random().toString(36).slice(2), text: v, done: false }]);
                  (ev.target as HTMLInputElement).value = "";
                }
              }}
            />
          </div>
        </div>
      );
    }

    case "task":
      return (
        <div className="flex h-full gap-2 p-3 text-sm" style={{ borderLeft: `5px solid ${PRIORITY[d.priority] ?? "#999"}` }}>
          <input type="checkbox" checked={!!d.done} onPointerDown={stop} onChange={() => onData({ done: !d.done })} className="mt-1" />
          <div className="min-w-0 flex-1">
            <div className={`font-semibold ${d.done ? "line-through opacity-50" : ""}`}>{d.title}</div>
            {d.description && <div className="line-clamp-2 text-xs">{d.description}</div>}
            {d.due && (
              <div className="mt-1 flex items-center gap-1 text-[11px]">
                <span className="h-2 w-2 rounded-full" style={{ background: dueColour(d.due) }} /> {d.due}
              </div>
            )}
            <Tags tags={item.tags} />
          </div>
        </div>
      );

    case "column":
      return (
        <div className="flex items-center gap-2 px-3 py-2">
          <button onPointerDown={stop} onClick={() => onPatch({ collapsed: !item.collapsed })} className="text-xs" aria-label="Collapse">
            {item.collapsed ? "▸" : "▾"}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{d.emoji} {d.title}</div>
            {d.description && <div className="truncate text-xs text-muted-foreground">{d.description}</div>}
          </div>
          <span className="text-xs text-muted-foreground">{childCount}</span>
        </div>
      );

    case "frame":
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
          <button onPointerDown={stop} onClick={() => onPatch({ collapsed: !item.collapsed })} className="text-xs" aria-label="Collapse">
            {item.collapsed ? "▸" : "▾"}
          </button>
          <span className="truncate font-semibold">{d.emoji} {d.title}</span>
          {item.locked && <span className="text-xs">🔒</span>}
        </div>
      );

    case "heading": {
      const size = { sm: "text-lg", md: "text-2xl", lg: "text-3xl", xl: "text-5xl" }[d.size as string] ?? "text-3xl";
      return (
        <div className="flex h-full flex-col justify-center" style={{ color: d.textColour }}>
          {editing ? (
            <input
              autoFocus
              defaultValue={d.text}
              onPointerDown={stop}
              onBlur={(e) => { onData({ text: e.target.value }); onStopEdit(); }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className={`w-full bg-white/60 font-black tracking-tight outline-none ${size}`}
            />
          ) : (
            <div className={`truncate font-black tracking-tight ${size}`}>{d.emoji} {d.text}</div>
          )}
          {d.divider && <div className="mt-1 h-0.5 w-full rounded" style={{ background: d.textColour }} />}
        </div>
      );
    }

    case "quote":
      return (
        <div className="flex h-full flex-col p-4">
          <div className="min-h-0 flex-1 overflow-hidden font-serif text-base italic leading-snug">
            {editing ? (
              <EditArea value={d.text} onSave={(v) => { onData({ text: v }); onStopEdit(); }} />
            ) : (
              <>“{d.text || "Double-click to add a quote"}”</>
            )}
          </div>
          {d.author && <div className="mt-2 text-right text-xs">— {d.author}</div>}
        </div>
      );

    case "swatch":
      return (
        <div className="flex h-full flex-col">
          <div className="flex-1 rounded-t-[inherit]" style={{ background: d.hex }} />
          <div className="bg-white p-2 text-xs">
            <div className="font-semibold">{d.name}</div>
            <button
              onPointerDown={stop}
              onClick={() => navigator.clipboard?.writeText(d.hex)}
              className="font-mono text-muted-foreground hover:text-foreground"
              title="Copy hex code"
            >
              {d.hex} ⧉
            </button>
          </div>
        </div>
      );
  }
}
