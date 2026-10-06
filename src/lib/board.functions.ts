import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Board, Item } from "./board";
import { boardToRow, check, db, itemToRow, rowToBoard, rowToItem } from "./board-db.server";

const uuid = z.string().uuid();
const boardSchema = z.object({ id: uuid, name: z.string().max(500), type: z.string().max(50) }).passthrough();
const itemSchema = z.object({ id: uuid, boardId: uuid, type: z.string().max(50) }).passthrough();

/** Everything on the server, plus whether the one-time browser import has happened. */
export const loadBoardData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await db();
  const meta = await sb.from("app_meta").select("value").eq("key", "local_migration_complete").maybeSingle();
  check(meta, "Read migration flag");
  const boards = await sb.from("boards").select("*").order("created_at");
  check(boards, "Read boards");
  const items: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await sb.from("items").select("*").order("created_at").range(from, from + 999);
    check(page, "Read items");
    items.push(...page.data);
    if (page.data.length < 1000) break;
  }
  return {
    migrated: meta.data?.value === true,
    boards: (boards.data as unknown[]).map(rowToBoard),
    items: items.map(rowToItem),
  };
});

const syncSchema = z.object({
  boards: z.array(boardSchema).max(200).default([]),
  items: z.array(itemSchema).max(200).default([]),
  deleteItems: z.array(uuid).max(5000).default([]),
  deleteBoards: z.array(uuid).max(200).default([]),
});

/** Apply a batch of changes. Upserts first, then deletes. */
export const syncChanges = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => syncSchema.parse(d))
  .handler(async ({ data }) => {
      const sb = await db();
    if (data.boards.length)
      check(await sb.from("boards").upsert((data.boards as unknown as Board[]).map(boardToRow)), "Save boards");
    if (data.items.length)
      check(await sb.from("items").upsert((data.items as unknown as Item[]).map(itemToRow)), "Save items");
    if (data.deleteItems.length) check(await sb.from("items").delete().in("id", data.deleteItems), "Delete items");
    if (data.deleteBoards.length) check(await sb.from("boards").delete().in("id", data.deleteBoards), "Delete boards");
    return { ok: true };
  });

export const finishLocalMigration = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await db();
  check(
    await sb.from("app_meta").upsert({ key: "local_migration_complete", value: true, updated_at: new Date().toISOString() }),
    "Mark migration complete",
  );
  return { ok: true };
});
