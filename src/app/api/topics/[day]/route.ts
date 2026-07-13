import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeSlides, isDayUnlocked } from "@/lib/topic-deck";
import type { Word } from "@/types";

function parseDay(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : null;
}

export async function GET(_req: Request, { params }: { params: { day: string } }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dayNo = parseDay(params.day);
  if (dayNo == null) return NextResponse.json({ error: "Invalid day" }, { status: 400 });

  const db = getSupabaseAdmin();
  const [{ data: row }, { data: progress }] = await Promise.all([
    db.from("topic_days").select("day_no,lesson_id,title_en,title_vi,slides").eq("day_no", dayNo).maybeSingle(),
    db.from("user_topic_progress").select("day_no").eq("user_id", userId),
  ]);
  if (!row) return NextResponse.json({ error: "Day not found" }, { status: 404 });

  const completed = new Set(((progress as { day_no: number }[]) ?? []).map((p) => p.day_no));
  if (!isDayUnlocked(dayNo, completed)) {
    return NextResponse.json({ error: "Locked" }, { status: 403 });
  }

  const slides = normalizeSlides((row as { slides: unknown }).slides);
  const wordIds = Array.from(
    new Set(
      slides.flatMap((s) => {
        if (s.type === "vocab") return s.word_ids;
        if (s.type === "example") return [s.word_id];
        if (s.type === "attribute" && s.word_id != null) return [s.word_id];
        if (s.type === "cover" && s.hero_word_id != null) return [s.hero_word_id];
        return [];
      }),
    ),
  );

  let words: Word[] = [];
  if (wordIds.length) {
    // Also pull the whole lesson so vocab slides have enough distractors.
    const { data } = await db.from("words").select("*").eq("lesson_id", (row as { lesson_id: number }).lesson_id).order("id");
    words = (data as Word[]) ?? [];
  }

  const { data: nextRow } = await db
    .from("topic_days")
    .select("day_no,title_en")
    .eq("day_no", dayNo + 1)
    .maybeSingle();
  const nextDay = nextRow
    ? { day_no: (nextRow as { day_no: number }).day_no, title_en: (nextRow as { title_en: string | null }).title_en }
    : null;

  return NextResponse.json({
    deck: {
      day_no: (row as { day_no: number }).day_no,
      lesson_id: (row as { lesson_id: number }).lesson_id,
      title_en: (row as { title_en: string | null }).title_en,
      title_vi: (row as { title_vi: string | null }).title_vi,
      slides,
    },
    words,
    nextDay,
  });
}
