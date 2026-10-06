import type { ReactNode } from "react";

/** Tiny markdown-style renderer: **bold**, *italic*, [link](url), lists, checklists, quotes, headings. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={key + i}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) out.push(<em key={key + i}>{tok.slice(1, -1)}</em>);
    else {
      const [, label, url] = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!;
      out.push(
        <a key={key + i} href={url} target="_blank" rel="noreferrer" className="underline text-primary" onPointerDown={(e) => e.stopPropagation()}>
          {label}
        </a>,
      );
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text, onToggle }: { text: string; onToggle?: (line: number) => void }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-0.5 leading-snug">
      {lines.map((l, i) => {
        const k = String(i);
        if (/^# /.test(l)) return <div key={k} className="text-base font-bold">{inline(l.slice(2), k)}</div>;
        if (/^## /.test(l)) return <div key={k} className="font-semibold">{inline(l.slice(3), k)}</div>;
        if (/^> /.test(l))
          return <div key={k} className="border-l-2 border-foreground/30 pl-2 italic">{inline(l.slice(2), k)}</div>;
        const check = /^\[( |x)\] (.*)$/.exec(l);
        if (check)
          return (
            <label key={k} className="flex items-start gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={check[1] === "x"} onChange={() => onToggle?.(i)} className="mt-0.5" />
              <span className={check[1] === "x" ? "line-through opacity-60" : ""}>{inline(check[2]!, k)}</span>
            </label>
          );
        if (/^- /.test(l)) return <div key={k} className="pl-3 -indent-3">• {inline(l.slice(2), k)}</div>;
        const num = /^(\d+)\. (.*)$/.exec(l);
        if (num) return <div key={k} className="pl-4 -indent-4">{num[1]}. {inline(num[2]!, k)}</div>;
        if (!l.trim()) return <div key={k} className="h-2" />;
        return <div key={k}>{inline(l, k)}</div>;
      })}
    </div>
  );
}

export function toggleLine(text: string, line: number): string {
  const lines = text.split("\n");
  const l = lines[line] ?? "";
  lines[line] = l.startsWith("[x] ") ? "[ ] " + l.slice(4) : l.startsWith("[ ] ") ? "[x] " + l.slice(4) : l;
  return lines.join("\n");
}
