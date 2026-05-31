/**
 * Spaced-repetition engine — MochiDemy "Thời điểm vàng" (golden moment) style.
 *
 * DIVERGES from the web app's day-based srs.ts: here the FIRST review lands ~1
 * hour after learning (the golden moment on the forgetting curve), then widens
 * (1h → 4h → 8h → 1d → 3d → 7d → 15d → 30d → 60d). Intervals are stored as
 * fractional days in `interval_days` (real column) and `due_at` stays a precise
 * timestamp, so the shared Supabase data still lines up with the web app.
 *
 * proficiency 0..9 per word, plus a notebook memory-level 1..5 derived from it.
 * Pure & deterministic (pass `now` in).
 */

export interface SrsState {
  proficiency: number; // 0..9
  memoryLevel: number; // 1..5
  ease: number; // SM-2-ish ease factor
  intervalDays: number; // may be fractional (e.g. 1h = 1/24)
  dueAt: string | null; // ISO
  lastReviewedAt: string | null; // ISO
  correctCount: number;
  wrongCount: number;
  status: "active" | "inactive";
  firstLearnedAt: string | null; // ISO
}

export interface ReviewResult {
  correct: boolean;
}

// "Golden moment" intervals in HOURS, indexed by proficiency 0..9.
// 1h, 4h, 8h, 1d, 3d, 7d, 15d, 30d, 60d.
const INTERVALS_H = [0, 1, 4, 8, 24, 72, 168, 360, 720, 1440];

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const HOUR_MS = 3600000;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * HOUR_MS);
}

/** proficiency 0..9 -> memory level 1..5 (even split). */
export function levelFromProficiency(p: number): number {
  return Math.min(5, Math.max(1, Math.floor(p / 2) + 1));
}

/** Brand-new word just learned for the first time -> first golden moment in ~1h. */
export function scheduleNew(now: Date): SrsState {
  const proficiency = 1;
  const intervalHours = INTERVALS_H[proficiency]; // 1h
  return {
    proficiency,
    memoryLevel: levelFromProficiency(proficiency),
    ease: 2.5,
    intervalDays: round2(intervalHours / 24),
    dueAt: addHours(now, intervalHours).toISOString(),
    lastReviewedAt: now.toISOString(),
    correctCount: 1,
    wrongCount: 0,
    status: "active",
    firstLearnedAt: now.toISOString(),
  };
}

/** Apply a review answer and return the next state. */
export function reviewWord(state: SrsState, result: ReviewResult, now: Date): SrsState {
  let proficiency = state.proficiency;
  let ease = state.ease;

  if (result.correct) {
    proficiency = Math.min(9, proficiency + 1);
    ease = Math.min(MAX_EASE, round2(ease + 0.1));
  } else {
    // drop back, but a learned word never falls below proficiency 1
    proficiency = Math.max(1, proficiency - 2);
    ease = Math.max(MIN_EASE, round2(ease - 0.2));
  }

  const base = INTERVALS_H[proficiency]; // hours
  // wrong answers come back at the first golden moment (~1h); correct scale by ease
  const intervalHours = result.correct ? Math.max(1, base * (ease / 2.5)) : INTERVALS_H[1];

  return {
    ...state,
    proficiency,
    memoryLevel: levelFromProficiency(proficiency),
    ease,
    intervalDays: round2(intervalHours / 24),
    dueAt: addHours(now, intervalHours).toISOString(),
    lastReviewedAt: now.toISOString(),
    correctCount: state.correctCount + (result.correct ? 1 : 0),
    wrongCount: state.wrongCount + (result.correct ? 0 : 1),
    status: "active",
    firstLearnedAt: state.firstLearnedAt ?? now.toISOString(),
  };
}

/** Is this word due for review now? */
export function isDue(state: Pick<SrsState, "status" | "dueAt">, now: Date): boolean {
  if (state.status !== "active") return false;
  if (!state.dueAt) return false;
  return new Date(state.dueAt).getTime() <= now.getTime();
}

/** A word is "at risk" (warning) when it is overdue by more than its interval. */
export function isWarning(state: Pick<SrsState, "status" | "dueAt" | "intervalDays">, now: Date): boolean {
  if (state.status !== "active" || !state.dueAt) return false;
  const overdueMs = now.getTime() - new Date(state.dueAt).getTime();
  const intervalMs = Math.max(1 / 24, state.intervalDays) * 86400000;
  return overdueMs > intervalMs;
}
