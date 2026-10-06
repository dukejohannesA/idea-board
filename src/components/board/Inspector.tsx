import { COLOURS, type Item, type TodoEntry } from "@/lib/board";

interface Props {
  item: Item;
  todoLists: Item[];
  onData: (patch: Record<string, unknown>) => void;
  onPatch: (patch: Partial<Item>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onConvert: (action: string, payload?: string) => void;
  onOpen: () => void;
  onClose: () => void;
}

const field = "w-full rounded border bg-card px-2 py-1 text-sm";

function Text({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return (
    <label className="block space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {area ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={4} className={field} />
      ) : (
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={field} />
      )}
    </label>
  );
}

function Sel({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={field}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

const btn = "rounded border bg-card px-2 py-1 text-xs hover:bg-accent";

export function Inspector({ item, todoLists, onData, onPatch, onDuplicate, onDelete, onConvert, onOpen, onClose }: Props) {
  const d = item.data;
  const t = item.type;
  const entries = (d.entries ?? []) as TodoEntry[];
  const showColours = !["swatch", "heading", "image"].includes(t);

  return (
    <aside
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute right-3 top-3 bottom-3 z-30 w-72 space-y-3 overflow-y-auto rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold capitalize">{t === "sticky" ? "Sticky note" : t}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">✕</button>
      </div>

      {t === "sticky" && (
        <>
          <div className="flex gap-2">
            <div className="w-16"><Text label="Emoji" value={d.emoji} onChange={(v) => onData({ emoji: v })} /></div>
            <div className="flex-1"><Text label="Title" value={d.title} onChange={(v) => onData({ title: v })} /></div>
          </div>
          <Text label="Body (**bold**, *italic*, - list, 1. list, [ ] check)" area value={d.body} onChange={(v) => onData({ body: v })} />
          <label className="block space-y-0.5">
            <span className="text-xs text-muted-foreground">Due date</span>
            <input type="date" value={d.due ?? ""} onChange={(e) => onData({ due: e.target.value })} className={field} />
          </label>
          <div className="flex gap-2">
            <button className={btn} onClick={() => onPatch({ h: item.h > 120 ? 90 : 170 })}>
              {item.h > 120 ? "Compact" : "Expand"}
            </button>
            <button className={btn} onClick={() => onConvert("sticky-to-task")}>Convert to task</button>
          </div>
        </>
      )}

      {t === "text" && (
        <>
          <Text label="Title" value={d.title} onChange={(v) => onData({ title: v })} />
          <Text label="Content" area value={d.body} onChange={(v) => onData({ body: v })} />
          <button className={btn} onClick={onOpen}>Open focused editor</button>
        </>
      )}

      {t === "image" && (
        <>
          <Text label="Image URL" value={d.src?.startsWith("data:") ? "(uploaded)" : d.src} onChange={(v) => onData({ src: v })} />
          <Text label="Caption" value={d.caption} onChange={(v) => onData({ caption: v })} />
          <Text label="Source URL" value={d.source} onChange={(v) => onData({ source: v })} />
          <Text label="Credit" value={d.credit} onChange={(v) => onData({ credit: v })} />
          <Text label="Note" area value={d.note} onChange={(v) => onData({ note: v })} />
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!d.border} onChange={() => onData({ border: !d.border })} /> Border</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!d.shadow} onChange={() => onData({ shadow: !d.shadow })} /> Shadow</label>
          </div>
          <button className={btn} onClick={onOpen}>View full screen</button>
        </>
      )}

      {t === "link" && (
        <>
          <Text label="URL" value={d.url} onChange={(v) => onData({ url: v })} />
          <Text label="Title" value={d.title} onChange={(v) => onData({ title: v })} />
          <Text label="Notes" area value={d.note} onChange={(v) => onData({ note: v })} />
        </>
      )}

      {t === "todo" && (
        <>
          <Text label="List title" value={d.title} onChange={(v) => onData({ title: v })} />
          <Sel label="Priority colour" value={d.priority} options={[["", "None"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]]} onChange={(v) => onData({ priority: v })} />
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Items</span>
            {entries.map((e, i) => (
              <div key={e.id} className="space-y-1 rounded border p-1.5">
                <input
                  value={e.text}
                  onChange={(ev) => onData({ entries: entries.map((x) => (x.id === e.id ? { ...x, text: ev.target.value } : x)) })}
                  className={field}
                />
                <div className="flex flex-wrap items-center gap-1">
                  <input
                    type="date"
                    value={e.due ?? ""}
                    onChange={(ev) => onData({ entries: entries.map((x) => (x.id === e.id ? { ...x, due: ev.target.value } : x)) })}
                    className="rounded border bg-card px-1 text-xs"
                  />
                  <button className={btn} disabled={i === 0} onClick={() => { const n = [...entries]; [n[i - 1], n[i]] = [n[i]!, n[i - 1]!]; onData({ entries: n }); }}>↑</button>
                  <button className={btn} disabled={i === entries.length - 1} onClick={() => { const n = [...entries]; [n[i + 1], n[i]] = [n[i]!, n[i + 1]!]; onData({ entries: n }); }}>↓</button>
                  <button className={btn} onClick={() => onConvert("entry-to-sticky", e.id)}>→ Note</button>
                  <button className={btn} onClick={() => onConvert("entry-to-task", e.id)}>→ Task</button>
                  <button className={btn} onClick={() => onData({ entries: entries.filter((x) => x.id !== e.id) })}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {t === "task" && (
        <>
          <Text label="Task" value={d.title} onChange={(v) => onData({ title: v })} />
          <Text label="Description" area value={d.description} onChange={(v) => onData({ description: v })} />
          <label className="block space-y-0.5">
            <span className="text-xs text-muted-foreground">Due date</span>
            <input type="date" value={d.due ?? ""} onChange={(e) => onData({ due: e.target.value })} className={field} />
          </label>
          <Sel label="Priority" value={d.priority} options={[["low", "Low"], ["medium", "Medium"], ["high", "High"]]} onChange={(v) => onData({ priority: v })} />
          {todoLists.length > 0 && (
            <Sel
              label="Add back into a list"
              value=""
              options={[["", "Choose list…"], ...todoLists.map((l) => [l.id, l.data.title] as [string, string])]}
              onChange={(v) => v && onConvert("task-to-list", v)}
            />
          )}
        </>
      )}

      {(t === "column" || t === "frame") && (
        <>
          <div className="flex gap-2">
            <div className="w-16"><Text label="Emoji" value={d.emoji} onChange={(v) => onData({ emoji: v })} /></div>
            <div className="flex-1"><Text label="Title" value={d.title} onChange={(v) => onData({ title: v })} /></div>
          </div>
          {t === "column" && <Text label="Description" value={d.description} onChange={(v) => onData({ description: v })} />}
          {t === "frame" && (
            <>
              <label className="flex items-center gap-2 text-xs">
                Border colour <input type="color" value={d.border} onChange={(e) => onData({ border: e.target.value })} />
              </label>
              <button className={btn} onClick={() => onPatch({ locked: !item.locked })}>{item.locked ? "Unlock group" : "Lock group"}</button>
            </>
          )}
          <button className={btn} onClick={() => onPatch({ collapsed: !item.collapsed })}>{item.collapsed ? "Expand" : "Collapse"}</button>
        </>
      )}

      {t === "heading" && (
        <>
          <div className="flex gap-2">
            <div className="w-16"><Text label="Emoji" value={d.emoji} onChange={(v) => onData({ emoji: v })} /></div>
            <div className="flex-1"><Text label="Text" value={d.text} onChange={(v) => onData({ text: v })} /></div>
          </div>
          <Sel label="Size" value={d.size} options={[["sm", "Small"], ["md", "Medium"], ["lg", "Large"], ["xl", "Huge"]]} onChange={(v) => onData({ size: v })} />
          <label className="flex items-center gap-2 text-xs">
            Colour <input type="color" value={d.textColour} onChange={(e) => onData({ textColour: e.target.value })} />
            <input type="checkbox" checked={!!d.divider} onChange={() => onData({ divider: !d.divider })} /> Divider line
          </label>
        </>
      )}

      {t === "quote" && (
        <>
          <Text label="Quote" area value={d.text} onChange={(v) => onData({ text: v })} />
          <Text label="Author / source" value={d.author} onChange={(v) => onData({ author: v })} />
          <Text label="Original URL" value={d.url} onChange={(v) => onData({ url: v })} />
          <Text label="Note" value={d.note} onChange={(v) => onData({ note: v })} />
        </>
      )}

      {t === "swatch" && (
        <>
          <label className="flex items-center gap-2 text-xs">
            Colour <input type="color" value={d.hex} onChange={(e) => onData({ hex: e.target.value.toUpperCase() })} />
          </label>
          <Text label="Name" value={d.name} onChange={(v) => onData({ name: v })} />
          <Text label="Hex" value={d.hex} onChange={(v) => onData({ hex: v })} />
          <Text label="Usage note" value={d.note} onChange={(v) => onData({ note: v })} />
        </>
      )}

      {showColours && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Colour</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(COLOURS).map(([name, c]) => (
              <button
                key={name}
                title={name}
                aria-label={name}
                onClick={() => onPatch({ colour: c })}
                style={{ background: c }}
                className={`h-6 w-6 rounded-full border ${item.colour === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
              />
            ))}
          </div>
        </div>
      )}

      <Text
        label="Tags (comma separated)"
        value={item.tags.join(", ")}
        onChange={(v) => onPatch({ tags: v.split(",").map((s) => s.trim()).filter(Boolean) })}
      />

      {t !== "column" && t !== "frame" && (
        <label className="block space-y-0.5">
          <span className="text-xs text-muted-foreground">Rotation ({item.rotation}°)</span>
          <input type="range" min={-15} max={15} value={item.rotation} onChange={(e) => onPatch({ rotation: Number(e.target.value) })} className="w-full" />
        </label>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <button className={btn} onClick={() => onPatch({ pinned: !item.pinned })}>{item.pinned ? "★ Favourite" : "☆ Favourite"}</button>
        <button className={btn} onClick={onDuplicate}>Duplicate</button>
        <button className={`${btn} text-destructive`} onClick={onDelete}>Delete</button>
      </div>
    </aside>
  );
}
