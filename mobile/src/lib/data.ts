/**
 * Data layer for the mobile app. Combines the web app's `queries.ts` (reads)
 * and `actions.ts` (writes), but talks to Supabase directly via the
 * service-role client and takes the Clerk `userId` as an explicit argument
 * (instead of Next.js `requireUserId()` / server actions). SRS logic is shared
 * with the web app via `srs.ts`. `revalidatePath` calls are dropped (no Next.js
 * cache on mobile — screens re-fetch on focus instead).
 */
import { supabase as db } from "@/lib/supabase";
import { scheduleNew, reviewWord, type SrsState } from "@/lib/srs";
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

/** UTC yyyy-mm-dd — identical to the web app so streak/activity days line up. */
export function todayStr(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// ----------------------------------------------------------------------------
// SrsState <-> DB row mappers (from actions.ts)
// ----------------------------------------------------------------------------
function stateToRow(userId: string, wordId: number, s: SrsState): WordProgress {
  return {
    user_id: userId,
    word_id: wordId,
    proficiency: s.proficiency,
    memory_level: s.memoryLevel,
    ease: s.ease,
    interval_days: s.intervalDays,
    due_at: s.dueAt,
    last_reviewed_at: s.lastReviewedAt,
    correct_count: s.correctCount,
    wrong_count: s.wrongCount,
    status: s.status,
    first_learned_at: s.firstLearnedAt,
  };
}

function rowToState(p: WordProgress): SrsState {
  return {
    proficiency: p.proficiency,
    memoryLevel: p.memory_level,
    ease: p.ease,
    intervalDays: p.interval_days,
    dueAt: p.due_at,
    lastReviewedAt: p.last_reviewed_at,
    correctCount: p.correct_count,
    wrongCount: p.wrong_count,
    status: p.status,
    firstLearnedAt: p.first_learned_at,
  };
}

// ----------------------------------------------------------------------------
// Reads (queries.ts)
// ----------------------------------------------------------------------------
export async function getCourse(): Promise<Course | null> {
  const { data } = await db.from("courses").select("*").eq("id", COURSE_ID).maybeSingle();
  return (data as Course) ?? null;
}

export async function getLessons(): Promise<Lesson[]> {
  const { data } = await db.from("lessons").select("*").eq("course_id", COURSE_ID).order("sort");
  return (data as Lesson[]) ?? [];
}

/** Lessons annotated with per-user totals: words, learned, due. */
export async function getLessonsWithStats(userId: string): Promise<LessonWithStats[]> {
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
  const { data } = await db.from("lessons").select("*").eq("id", lessonId).maybeSingle();
  return (data as Lesson) ?? null;
}

export async function getWordsByLesson(lessonId: number): Promise<Word[]> {
  const { data } = await db.from("words").select("*").eq("lesson_id", lessonId).order("id");
  return (data as Word[]) ?? [];
}

/** New (not-yet-learned) words in a lesson — the whole lesson by default, optionally capped at `limit`. */
export async function getNewWordsForLesson(userId: string, lessonId: number, limit?: number): Promise<Word[]> {
  const [{ data: words }, { data: progress }] = await Promise.all([
    db.from("words").select("*").eq("lesson_id", lessonId).order("id"),
    db.from("user_word_progress").select("word_id").eq("user_id", userId),
  ]);
  const learned = new Set((progress as { word_id: number }[] ?? []).map((p) => p.word_id));
  return ((words as Word[]) ?? []).filter((w) => !learned.has(w.id)).slice(0, limit);
}

/** Pool of words to draw multiple-choice distractors from. */
export async function getDistractorPool(excludeLessonId?: number, limit = 60): Promise<Word[]> {
  let q = db.from("words").select("id,term,meaning_vi,phonetic_uk,image_url,pos").limit(limit);
  if (excludeLessonId) q = q.neq("lesson_id", excludeLessonId);
  const { data } = await q;
  return (data as Word[]) ?? [];
}

/** Due active words for review, soonest first. */
export async function getReviewQueue(userId: string, limit = 20): Promise<WordWithProgress[]> {
  const nowIso = new Date().toISOString();
  const { data: progress } = await db
    .from("user_word_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("due_at", nowIso)
    .order("due_at")
    .limit(limit);

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
  prepCount: number; // words that come due at that next golden moment (within ~1h of it)
}

/** Status for the review tab: how many are due now, and when the next golden moment is. */
export async function getReviewStatus(userId: string): Promise<ReviewStatus> {
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
    for (const t of future) if (t <= min + 3600000) prepCount++; // cluster within ~1h of the moment
  }
  return { dueNow, nextDueAt, prepCount };
}

/** Notebook: all learned words, optionally filtered by memory level. */
export async function getNotebook(userId: string, level?: number): Promise<WordWithProgress[]> {
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

// ----------------------------------------------------------------------------
// Writes (actions.ts)
// ----------------------------------------------------------------------------
async function bumpActivity(userId: string, delta: { learned?: number; reviewed?: number; xp?: number }) {
  const date = todayStr();
  const { data } = await db
    .from("user_daily_activity")
    .select("*")
    .eq("user_id", userId)
    .eq("activity_date", date)
    .maybeSingle();
  const row = {
    user_id: userId,
    activity_date: date,
    words_learned: (data?.words_learned ?? 0) + (delta.learned ?? 0),
    words_reviewed: (data?.words_reviewed ?? 0) + (delta.reviewed ?? 0),
    xp: (data?.xp ?? 0) + (delta.xp ?? 0),
  };
  await db.from("user_daily_activity").upsert(row, { onConflict: "user_id,activity_date" });
}

async function touchStreak(userId: string) {
  const today = todayStr();
  const { data } = await db.from("user_streaks").select("*").eq("user_id", userId).maybeSingle();
  const yesterday = todayStr(new Date(Date.now() - 86400000));
  let current = data?.current_streak ?? 0;
  const last = data?.last_active_date ?? null;
  if (last === today) {
    // already counted today
  } else if (last === yesterday) {
    current += 1;
  } else {
    current = 1;
  }
  const longest = Math.max(data?.longest_streak ?? 0, current);
  await db.from("user_streaks").upsert({
    user_id: userId,
    current_streak: current,
    longest_streak: longest,
    last_active_date: today,
    daily_goal: data?.daily_goal ?? 20,
  });
}

/** Persist a batch of words as newly learned (after a learn-new session). */
export async function learnWords(userId: string, wordIds: number[]): Promise<{ ok: true }> {
  if (wordIds.length === 0) return { ok: true };
  const now = new Date();

  // only insert words the user hasn't already learned
  const { data: existing } = await db
    .from("user_word_progress")
    .select("word_id")
    .eq("user_id", userId)
    .in("word_id", wordIds);
  const have = new Set((existing as { word_id: number }[] ?? []).map((e) => e.word_id));
  const fresh = wordIds.filter((id) => !have.has(id));
  if (fresh.length) {
    const rows = fresh.map((id) => stateToRow(userId, id, scheduleNew(now)));
    await db.from("user_word_progress").upsert(rows, { onConflict: "user_id,word_id" });
    await bumpActivity(userId, { learned: fresh.length, xp: fresh.length * 10 });
    await touchStreak(userId);
  }
  return { ok: true };
}

/** Apply a single review answer for a due word. */
export async function submitReview(userId: string, wordId: number, correct: boolean): Promise<{ ok: true }> {
  const now = new Date();
  const { data } = await db
    .from("user_word_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("word_id", wordId)
    .maybeSingle();

  const prev: SrsState = data ? rowToState(data as WordProgress) : scheduleNew(now);
  const next = data ? reviewWord(prev, { correct }, now) : prev;
  await db
    .from("user_word_progress")
    .upsert(stateToRow(userId, wordId, next), { onConflict: "user_id,word_id" });
  return { ok: true };
}

/** Called once when a review session finishes, to record activity + streak. */
export async function finishReviewSession(
  userId: string,
  reviewedCount: number,
  correctCount: number,
): Promise<{ ok: true }> {
  if (reviewedCount > 0) {
    await bumpActivity(userId, { reviewed: reviewedCount, xp: correctCount * 5 });
    await touchStreak(userId);
  }
  return { ok: true };
}

export async function setDailyGoal(userId: string, goal: number): Promise<{ ok: true }> {
  const g = Math.max(5, Math.min(200, Math.round(goal)));
  const { data } = await db.from("user_streaks").select("*").eq("user_id", userId).maybeSingle();
  await db.from("user_streaks").upsert({
    user_id: userId,
    current_streak: data?.current_streak ?? 0,
    longest_streak: data?.longest_streak ?? 0,
    last_active_date: data?.last_active_date ?? null,
    daily_goal: g,
  });
  return { ok: true };
}
