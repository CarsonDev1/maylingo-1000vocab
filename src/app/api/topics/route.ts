import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isDayUnlocked } from "@/lib/topic-deck";
import type { TopicDaySummary } from "@/types";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const [{ data: days }, { data: progress }] = await Promise.all([
    db.from("topic_days").select("day_no,lesson_id,title_en,title_vi").order("day_no"),
    db.from("user_topic_progress").select("day_no,best_score").eq("user_id", userId),
  ]);

  const completed = new Set(((progress as { day_no: number }[]) ?? []).map((p) => p.day_no));
  const scoreByDay = new Map(((progress as { day_no: number; best_score: number | null }[]) ?? []).map((p) => [p.day_no, p.best_score]));

  const summaries: TopicDaySummary[] = ((days as Omit<TopicDaySummary, "unlocked" | "completed" | "best_score">[]) ?? []).map((d) => ({
    ...d,
    unlocked: isDayUnlocked(d.day_no, completed),
    completed: completed.has(d.day_no),
    best_score: scoreByDay.get(d.day_no) ?? null,
  }));

  return NextResponse.json({ days: summaries });
}
