// Idea Board data model — everything is stored in the browser (localStorage).

export type ItemType =
  | "sticky"
  | "text"
  | "image"
  | "link"
  | "todo"
  | "task"
  | "column"
  | "frame"
  | "heading"
  | "quote"
  | "swatch";

export interface TodoEntry {
  id: string;
  text: string;
  done: boolean;
  due?: string | null;
}

export interface Item {
  id: string;
  boardId: string;
  type: ItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  colour: string;
  rotation: number;
  parentId: string | null;
  tags: string[];
  pinned: boolean;
  collapsed?: boolean;
  locked?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  createdAt: string;
  updatedAt: string;
}

export type BoardType =
  | "blank"
  | "brainstorm"
  | "mood"
  | "vision"
  | "research"
  | "project"
  | "feature"
  | "content"
  | "study"
  | "story"
  | "business"
  | "personal";

export interface Board {
  id: string;
  name: string;
  type: BoardType;
  createdAt: string;
  updatedAt: string;
}

export const COLOURS = {
  yellow: "#FFF1A1",
  blue: "#CFE3FF",
  green: "#D6F2C6",
  pink: "#F9D2E6",
  orange: "#FFDDB5",
  purple: "#E2D6FA",
  grey: "#E6E4DF",
  white: "#FFFFFF",
} as Record<string, string> & { yellow: string; white: string; purple: string };

export const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export const DEFAULT_SIZE: Record<ItemType, [number, number]> = {
  sticky: [180, 170],
  text: [300, 240],
  image: [240, 200],
  link: [260, 130],
  todo: [240, 220],
  task: [220, 110],
  column: [260, 360],
  frame: [460, 340],
  heading: [360, 60],
  quote: [260, 160],
  swatch: [140, 150],
};

const DEFAULT_COLOUR: Record<ItemType, string> = {
  sticky: COLOURS.yellow!,
  text: COLOURS.white!,
  image: COLOURS.white!,
  link: COLOURS.white!,
  todo: COLOURS.white!,
  task: COLOURS.white!,
  column: "#EFE9DD",
  frame: "rgba(255,255,255,0.35)",
  heading: "transparent",
  quote: COLOURS.purple!,
  swatch: "#E07A5F",
};

export function defaultData(type: ItemType): Record<string, unknown> {
  switch (type) {
    case "sticky":
      return { title: "", body: "", emoji: "" };
    case "text":
      return { title: "Untitled note", body: "" };
    case "image":
      return { src: "", caption: "", source: "", credit: "", note: "", border: true, shadow: true };
    case "link":
      return { url: "", title: "", note: "" };
    case "todo":
      return { title: "To-do", entries: [] as TodoEntry[], priority: "" };
    case "task":
      return { title: "New task", done: false, description: "", due: "", priority: "medium" };
    case "column":
      return { title: "Column", emoji: "", description: "" };
    case "frame":
      return { title: "Group", emoji: "", border: "#B9A98C" };
    case "heading":
      return { text: "HEADING", size: "lg", emoji: "", divider: true, textColour: "#3b2f22" };
    case "quote":
      return { text: "", author: "", url: "", note: "" };
    case "swatch":
      return { name: "Terracotta", hex: "#E07A5F", note: "" };
  }
}

export function makeItem(
  boardId: string,
  type: ItemType,
  x: number,
  y: number,
  z: number,
  overrides: Partial<Item> = {},
  data: Record<string, unknown> = {},
): Item {
  const [w, h] = DEFAULT_SIZE[type];
  const t = now();
  return {
    id: uid(),
    boardId,
    type,
    x,
    y,
    w,
    h,
    z,
    colour: DEFAULT_COLOUR[type],
    rotation: 0,
    parentId: null,
    tags: [],
    pinned: false,
    data: { ...defaultData(type), ...data },
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}

// ---------- Board types / templates ----------

interface Starter {
  heading?: string;
  columns?: string[];
  stickies?: string[];
}

export const BOARD_TYPES: { type: BoardType; label: string; desc: string; starter: Starter }[] = [
  { type: "blank", label: "Blank Idea Board", desc: "An empty free-form canvas", starter: {} },
  {
    type: "brainstorm",
    label: "Brainstorm Board",
    desc: "Quick sticky-note idea generation",
    starter: { heading: "💡 BRAINSTORM", stickies: ["What if…", "Wild idea", "Question?"] },
  },
  {
    type: "mood",
    label: "Moodboard",
    desc: "Images, colours, quotes and links",
    starter: { heading: "VISUAL INSPIRATION", columns: ["Images", "Colours", "Words & quotes"] },
  },
  {
    type: "vision",
    label: "Vision Board",
    desc: "Goals, images, affirmations, milestones",
    starter: { heading: "✨ MY VISION", columns: ["Goals", "Affirmations", "Milestones"] },
  },
  {
    type: "research",
    label: "Research Board",
    desc: "Sources, notes, quotes and questions",
    starter: { heading: "RESEARCH", columns: ["Sources", "Findings", "Quotes", "Questions"] },
  },
  {
    type: "project",
    label: "Project Idea Board",
    desc: "Problem, users, concept, features, next steps",
    starter: { columns: ["Problem", "Users", "Concept", "Features", "Research", "Next Steps"] },
  },
  {
    type: "feature",
    label: "Product Feature Board",
    desc: "Problems, feature ideas, priorities",
    starter: { columns: ["User problems", "Feature ideas", "References", "Priorities", "Open questions"] },
  },
  {
    type: "content",
    label: "Content Ideas Board",
    desc: "Social, blog, video and campaign ideas",
    starter: { columns: ["Social", "Blog", "Video", "Campaigns", "Published"] },
  },
  {
    type: "study",
    label: "Study Board",
    desc: "Notes, concepts, resources, questions",
    starter: { heading: "📚 STUDY", columns: ["Concepts", "Notes", "Resources", "Questions"] },
  },
  {
    type: "story",
    label: "Storyboard",
    desc: "Scenes, sequence cards and script ideas",
    starter: { heading: "STORYBOARD", stickies: ["Scene 1", "Scene 2", "Scene 3", "Scene 4"] },
  },
  {
    type: "business",
    label: "Business Idea Board",
    desc: "Customers, competitors, costs, revenue",
    starter: {
      columns: ["Customer problems", "Target users", "Competitors", "Opportunities", "Costs", "Revenue"],
    },
  },
  {
    type: "personal",
    label: "Personal Notes Board",
    desc: "Thoughts, reminders, quotes, bookmarks",
    starter: { heading: "NOTES TO SELF", stickies: ["Remember…"] },
  },
];

export function starterItems(boardId: string, type: BoardType): Item[] {
  const s = BOARD_TYPES.find((b) => b.type === type)?.starter ?? {};
  const items: Item[] = [];
  let z = 1;
  let y = 40;
  if (s.heading) {
    items.push(makeItem(boardId, "heading", 40, y, z++, {}, { text: s.heading }));
    y += 100;
  }
  s.columns?.forEach((name, i) => {
    items.push(makeItem(boardId, "column", 40 + i * 290, y, z++, {}, { title: name }));
  });
  s.stickies?.forEach((t, i) => {
    const colours = Object.values(COLOURS);
    items.push(
      makeItem(boardId, "sticky", 40 + i * 210, y + (s.columns ? 400 : 0), z++, {
        colour: colours[i % colours.length]!,
        rotation: (i % 2 ? 1 : -1) * 1.5,
      }, { title: t }),
    );
  });
  return items;
}

// ---------- Persistence ----------

const BOARDS_KEY = "ib.boards";
const ITEMS_KEY = "ib.items";

interface LegacyNote {
  id: string;
  text: string;
  sectionId: string | null;
  dueDate: string | null;
  x: number;
  y: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function loadAll(): { boards: Board[]; items: Item[] } {
  try {
    const boards = JSON.parse(localStorage.getItem(BOARDS_KEY) ?? "null") as Board[] | null;
    const items = JSON.parse(localStorage.getItem(ITEMS_KEY) ?? "[]") as Item[];
    if (boards && boards.length) return { boards, items };
  } catch {
    /* fall through */
  }
  // First run — migrate notes from the original board, if any.
  const board: Board = { id: uid(), name: "My Idea Board", type: "blank", createdAt: now(), updatedAt: now() };
  const items: Item[] = [];
  try {
    const notes = JSON.parse(localStorage.getItem("notes") ?? "[]") as LegacyNote[];
    const sections = JSON.parse(localStorage.getItem("sections") ?? "[]") as { id: string; colour: string; name: string }[];
    notes.forEach((n, i) => {
      const sec = sections.find((s) => s.id === n.sectionId);
      items.push(
        makeItem(board.id, "sticky", n.x, n.y, i + 1, {
          colour: sec?.colour ?? COLOURS.yellow!,
          tags: sec ? [sec.name] : [],
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        }, { body: n.text, due: n.dueDate ?? "", archived: n.status !== "active" }),
      );
    });
  } catch {
    /* ignore */
  }
  return { boards: [board], items };
}

export function saveAll(boards: Board[], items: Item[]): boolean {
  try {
    localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

/** Colour of the due-date dot, based only on time remaining. */
export function dueColour(dueDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days <= 0) return "#dc2626";
  if (days < 3) return "#ea580c";
  if (days <= 7) return "#eab308";
  return "#16a34a";
}

/** Shrink an image file to a data URL so it fits in browser storage. */
export function fileToDataUrl(file: Blob, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

/** Searchable text for an item. */
export function itemText(it: Item): string {
  const d = it.data;
  const parts = [d.title, d.body, d.text, d.caption, d.note, d.url, d.author, d.name, d.hex, d.description, ...it.tags];
  if (Array.isArray(d.entries)) parts.push(...(d.entries as TodoEntry[]).map((e) => e.text));
  return parts.filter(Boolean).join(" ").toLowerCase();
}
