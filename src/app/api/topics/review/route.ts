import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Word } from "@/types";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: rows } = await db
    .from("user_topic_srs")
    .select("word_id,due_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("due_at");

  const all = (rows as { word_id: number; due_at: string | null }[]) ?? [];
  const dueRows = all.filter((r) => r.due_at && r.due_at <= nowIso);
  const future = all.filter((r) => r.due_at && r.due_at > nowIso).map((r) => r.due_at as string);
  const nextDueAt = future.length ? future[0] : null;

  let due: Word[] = [];
  if (dueRows.length) {
    const { data: words } = await db.from("words").select("*").in("id", dueRows.map((r) => r.word_id));
    const byId = new Map(((words as Word[]) ?? []).map((w) => [w.id, w]));
    due = dueRows.map((r) => byId.get(r.word_id)).filter(Boolean) as Word[];
  }
  return NextResponse.json({ due, nextDueAt, dueCount: due.length });
}
