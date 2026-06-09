"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireUserId, todayStr } from "@/lib/auth";
import { scheduleNew, reviewWord, type SrsState } from "@/lib/srs";
import type { WordProgress } from "@/types";

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

async function bumpActivity(userId: string, delta: { learned?: number; reviewed?: number; xp?: number }) {
  const db = getSupabaseAdmin();
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
  const db = getSupabaseAdmin();
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
export async function learnWords(wordIds: number[]): Promise<{ ok: true }> {
  const userId = await requireUserId();
  if (wordIds.length === 0) return { ok: true };
  const db = getSupabaseAdmin();
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
  revalidatePath("/dashboard");
  revalidatePath("/lessons");
  revalidatePath("/notebook");
  return { ok: true };
}

/** Apply a single review answer for a due word. */
export async function submitReview(wordId: number, correct: boolean): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const db = getSupabaseAdmin();
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
export async function finishReviewSession(reviewedCount: number, correctCount: number): Promise<{ ok: true }> {
  const userId = await requireUserId();
  if (reviewedCount > 0) {
    await bumpActivity(userId, { reviewed: reviewedCount, xp: correctCount * 5 });
    await touchStreak(userId);
  }
  revalidatePath("/dashboard");
  revalidatePath("/notebook");
  revalidatePath("/stats");
  return { ok: true };
}

/** Persist a writing session: award XP and touch the streak. */
export async function finishWritingSession(xpEarned: number): Promise<{ ok: true }> {
  const userId = await requireUserId();
  if (xpEarned > 0) {
    await bumpActivity(userId, { xp: xpEarned });
    await touchStreak(userId);
  }
  revalidatePath("/dashboard");
  revalidatePath("/stats");
  revalidatePath("/writing");
  return { ok: true };
}

/**
 * Set the daily goal AND mark it as confirmed for today, so the start-of-day
 * goal popup won't show again until the next day.
 */
export async function confirmDailyGoal(goal: number): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const db = getSupabaseAdmin();
  const g = Math.max(5, Math.min(200, Math.round(goal)));
  const today = todayStr();

  const { data: streak } = await db.from("user_streaks").select("*").eq("user_id", userId).maybeSingle();
  await db.from("user_streaks").upsert({
    user_id: userId,
    current_streak: streak?.current_streak ?? 0,
    longest_streak: streak?.longest_streak ?? 0,
    last_active_date: streak?.last_active_date ?? null,
    daily_goal: g,
  });

  // Remember the goal was set for today (stored in the free-form settings jsonb).
  const { data: s } = await db.from("user_settings").select("settings").eq("user_id", userId).maybeSingle();
  const settings = { ...((s?.settings as Record<string, unknown> | null) ?? {}), goalDate: today };
  await db.from("user_settings").upsert({ user_id: userId, settings });

  revalidatePath("/dashboard");
  return { ok: true };
}
