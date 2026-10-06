import type { Board, Item } from "./board";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function db(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const boardToRow = (b: Board) => ({
  id: b.id,
  name: b.name,
  type: b.type,
  created_at: b.createdAt,
  updated_at: b.updatedAt,
});

export const itemToRow = (i: Item) => ({
  id: i.id,
  board_id: i.boardId,
  type: i.type,
  x: i.x,
  y: i.y,
  w: i.w,
  h: i.h,
  z: Math.round(i.z),
  colour: i.colour,
  rotation: i.rotation,
  parent_id: i.parentId,
  tags: i.tags ?? [],
  pinned: !!i.pinned,
  collapsed: !!i.collapsed,
  locked: !!i.locked,
  data: i.data ?? {},
  created_at: i.createdAt,
  updated_at: i.updatedAt,
});

export const rowToBoard = (r: any): Board => ({
  id: r.id,
  name: r.name,
  type: r.type,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const rowToItem = (r: any): Item => ({
  id: r.id,
  boardId: r.board_id,
  type: r.type,
  x: r.x,
  y: r.y,
  w: r.w,
  h: r.h,
  z: r.z,
  colour: r.colour,
  rotation: r.rotation,
  parentId: r.parent_id,
  tags: r.tags ?? [],
  pinned: r.pinned,
  collapsed: r.collapsed,
  locked: r.locked,
  data: r.data ?? {},
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function check(res: { error: { message: string } | null }, what: string) {
  if (res.error) {
    console.error(`${what} failed:`, res.error);
    throw new Error(`${what} failed`);
  }
}
