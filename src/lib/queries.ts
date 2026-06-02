import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  Course,
  Lesson,
  LessonWithStats,
  Word,
  WordProgress,
  WordWithProgress,
  Streak,
  DailyActivity,
} from "@/types";

const COURSE_ID = 1;

export async function getCourse(): Promise<Course | null> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("courses").select("*").eq("id", COURSE_ID).maybeSingle();
  return (data as Course) ?? null;
}

export async function getLessons(): Promise<Lesson[]> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("lessons").select("*").eq("course_id", COURSE_ID).order("sort");
  return (data as Lesson[]) ?? [];
}

/** Lessons annotated with per-user totals: words, learned, due. */
export async function getLessonsWithStats(userId: string): Promise<LessonWithStats[]> {
  const db = getSupabaseAdmin();
  const [{ data: lessons }, { data: words }, { data: progress }] = await Promise.all([
    db.from("lessons").select("*").eq("course_id", COURSE_ID).order("sort"),
    db.from("words").select("id,lesson_id,image_url").order("id"),
    db.from("user_word_progress").select("word_id,status,due_at").eq("user_id", userId),
  ]);

  const wordsByLesson = new Map<number, number[]>();
  const imageByLesson = new Map<number, string>();
  for (const w of (words as { id: number; lesson_id: number; image_url: string | null }[]) ?? []) {
    const arr = wordsByLesson.get(w.lesson_id) ?? [];
    arr.push(w.id);
    wordsByLesson.set(w.lesson_id, arr);
    if (w.image_url && !imageByLesson.has(w.lesson_id)) imageByLesson.set(w.lesson_id, w.image_url);
  }
  const learnedIds = new Set<number>();
  const dueIds = new Set<number>();
  const now = Date.now();
  for (const p of (progress as { word_id: number; status: string; due_at: string | null }[]) ?? []) {
    learnedIds.add(p.word_id);
    if (p.status === "active" && p.due_at && new Date(p.due_at).getTime() <= now) dueIds.add(p.word_id);
  }

  return ((lessons as Lesson[]) ?? []).map((l) => {
    const ids = wordsByLesson.get(l.id) ?? [];
    return {
      ...l,
      total_words: ids.length,
      learned_words: ids.filter((id) => learnedIds.has(id)).length,
      due_words: ids.filter((id) => dueIds.has(id)).length,
      image: imageByLesson.get(l.id) ?? null,
    };
  });
}

export interface DashboardData {
  totalWords: number;
  learnedWords: number;
  dueToday: number;
  streak: Streak;
  todayActivity: DailyActivity | null;
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const db = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const [{ count: totalWords }, { data: progress }, streak, { data: activity }] = await Promise.all([
    db.from("words").select("*", { count: "exact", head: true }),
    db.from("user_word_progress").select("status,due_at").eq("user_id", userId),
    getOrCreateStreak(userId),
    db.from("user_daily_activity").select("*").eq("user_id", userId).eq("activity_date", today).maybeSingle(),
  ]);

  const now = Date.now();
  let learnedWords = 0;
  let dueToday = 0;
  for (const p of (progress as { status: string; due_at: string | null }[]) ?? []) {
    learnedWords++;
    if (p.status === "active" && p.due_at && new Date(p.due_at).getTime() <= now) dueToday++;
  }

  return {
    totalWords: totalWords ?? 0,
    learnedWords,
    dueToday,
    streak,
    todayActivity: (activity as DailyActivity) ?? null,
  };
}

export async function getOrCreateStreak(userId: string): Promise<Streak> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("user_streaks").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as Streak;
  const fresh: Streak = {
    user_id: userId,
    current_streak: 0,
    longest_streak: 0,
    last_active_date: null,
    daily_goal: 20,
  };
  await db.from("user_streaks").upsert(fresh);
  return fresh;
}

export async function getLessonById(lessonId: number): Promise<Lesson | null> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("lessons").select("*").eq("id", lessonId).maybeSingle();
  return (data as Lesson) ?? null;
}

export async function getWordsByLesson(lessonId: number): Promise<Word[]> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("words").select("*").eq("lesson_id", lessonId).order("id");
  return (data as Word[]) ?? [];
}

/** New (not-yet-learned) words in a lesson — the whole lesson by default, optionally capped at `limit`. */
export async function getNewWordsForLesson(userId: string, lessonId: number, limit?: number): Promise<Word[]> {
  const db = getSupabaseAdmin();
  const [{ data: words }, { data: progress }] = await Promise.all([
    db.from("words").select("*").eq("lesson_id", lessonId).order("id"),
    db.from("user_word_progress").select("word_id").eq("user_id", userId),
  ]);
  const learned = new Set((progress as { word_id: number }[] ?? []).map((p) => p.word_id));
  return ((words as Word[]) ?? []).filter((w) => !learned.has(w.id)).slice(0, limit);
}

/** Pool of words to draw multiple-choice distractors from. */
export async function getDistractorPool(excludeLessonId?: number, limit = 60): Promise<Word[]> {
  const db = getSupabaseAdmin();
  let q = db.from("words").select("id,term,meaning_vi,phonetic_uk,image_url,pos").limit(limit);
  if (excludeLessonId) q = q.neq("lesson_id", excludeLessonId);
  const { data } = await q;
  return (data as Word[]) ?? [];
}

/**
 * Due active words for review, soonest first.
 * Returns ALL due words by default so a single session covers the whole queue
 * (no 20-word cap) — pass `limit` only when you explicitly want a smaller batch.
 */
export async function getReviewQueue(userId: string, limit?: number): Promise<WordWithProgress[]> {
  const db = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  let q = db
    .from("user_word_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("due_at", nowIso)
    .order("due_at");
  if (limit) q = q.limit(limit);
  const { data: progress } = await q;

  const rows = (progress as WordProgress[]) ?? [];
  if (rows.length === 0) return [];
  const { data: words } = await db.from("words").select("*").in("id", rows.map((r) => r.word_id));
  const wordMap = new Map((words as Word[] ?? []).map((w) => [w.id, w]));
  return rows
    .map((p) => {
      const w = wordMap.get(p.word_id);
      return w ? { ...w, progress: p } : null;
    })
    .filter(Boolean) as WordWithProgress[];
}

export interface ReviewStatus {
  dueNow: number; // active words due right now
  nextDueAt: string | null; // ISO of the next "golden moment" (soonest future due_at)
  prepCount: number; // words coming due at that next golden moment (within ~1h of it)
}

/** Review-tab status: how many are due now, and when the next golden moment is. */
export async function getReviewStatus(userId: string): Promise<ReviewStatus> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("user_word_progress")
    .select("due_at,status")
    .eq("user_id", userId)
    .eq("status", "active");
  const rows = (data as { due_at: string | null; status: string }[]) ?? [];
  const now = Date.now();
  let dueNow = 0;
  const future: number[] = [];
  for (const r of rows) {
    if (!r.due_at) continue;
    const t = new Date(r.due_at).getTime();
    if (t <= now) dueNow++;
    else future.push(t);
  }
  let nextDueAt: string | null = null;
  let prepCount = 0;
  if (future.length) {
    const min = Math.min(...future);
    nextDueAt = new Date(min).toISOString();
    for (const t of future) if (t <= min + 3600000) prepCount++;
  }
  return { dueNow, nextDueAt, prepCount };
}

/** Notebook: all learned words, optionally filtered by memory level. */
export async function getNotebook(userId: string, level?: number): Promise<WordWithProgress[]> {
  const db = getSupabaseAdmin();
  let q = db.from("user_word_progress").select("*").eq("user_id", userId);
  if (level) q = q.eq("memory_level", level);
  const { data: progress } = await q.order("updated_at", { ascending: false });
  const rows = (progress as WordProgress[]) ?? [];
  if (rows.length === 0) return [];
  const { data: words } = await db.from("words").select("*").in("id", rows.map((r) => r.word_id));
  const wordMap = new Map((words as Word[] ?? []).map((w) => [w.id, w]));
  return rows
    .map((p) => {
      const w = wordMap.get(p.word_id);
      return w ? { ...w, progress: p } : null;
    })
    .filter(Boolean) as WordWithProgress[];
}

export interface StatsData {
  totalWords: number;
  learnedWords: number;
  proficiency: number[]; // index 0..9 -> count
  levels: number[]; // index 1..5 -> count (levels[0] unused)
  activity: DailyActivity[]; // last ~60 days
  streak: Streak;
}

export async function getStats(userId: string): Promise<StatsData> {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 70 * 86400000).toISOString().slice(0, 10);
  const [{ count: totalWords }, { data: progress }, { data: activity }, streak] = await Promise.all([
    db.from("words").select("*", { count: "exact", head: true }),
    db.from("user_word_progress").select("proficiency,memory_level").eq("user_id", userId),
    db.from("user_daily_activity").select("*").eq("user_id", userId).gte("activity_date", since).order("activity_date"),
    getOrCreateStreak(userId),
  ]);
  const proficiency = new Array(10).fill(0);
  const levels = new Array(6).fill(0);
  const rows = (progress as { proficiency: number; memory_level: number }[]) ?? [];
  for (const p of rows) {
    proficiency[Math.min(9, Math.max(0, p.proficiency))]++;
    levels[Math.min(5, Math.max(1, p.memory_level))]++;
  }
  return {
    totalWords: totalWords ?? 0,
    learnedWords: rows.length,
    proficiency,
    levels,
    activity: (activity as DailyActivity[]) ?? [],
    streak,
  };
}
