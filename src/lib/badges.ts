/**
 * Account badges (huy hiệu). Each badge is unlocked by reaching a milestone in
 * one of several dimensions: level, total XP, words learned, words mastered, or
 * streak. Badges are pure functions of the user's current gamification stats so
 * they can be evaluated on the client without extra round-trips.
 */

export interface GamificationStats {
  totalXp: number;
  learnedWords: number;
  totalWords: number;
  masteredWords: number; // words at the top memory level (5)
  currentStreak: number;
  longestStreak: number;
}

/** Stats + derived level, used by badge predicates. */
export interface BadgeCtx extends GamificationStats {
  level: number;
}

export type BadgeGroup = "level" | "words" | "mastery" | "streak" | "xp";

export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  group: BadgeGroup;
  earned: (c: BadgeCtx) => boolean;
  /** progress toward unlocking (for locked badges). */
  progress: (c: BadgeCtx) => { cur: number; goal: number };
}

const pct = (cur: number, goal: number) => ({ cur: Math.min(cur, goal), goal });

export const BADGES: BadgeDef[] = [
  // ---- words learned ----
  {
    id: "first-word",
    name: "First Step",
    desc: "Learn your first word",
    emoji: "🌱",
    group: "words",
    earned: (c) => c.learnedWords >= 1,
    progress: (c) => pct(c.learnedWords, 1),
  },
  {
    id: "words-50",
    name: "Beginner",
    desc: "Learn 50 words",
    emoji: "📘",
    group: "words",
    earned: (c) => c.learnedWords >= 50,
    progress: (c) => pct(c.learnedWords, 50),
  },
  {
    id: "words-100",
    name: "Collector 100",
    desc: "Learn 100 words",
    emoji: "📚",
    group: "words",
    earned: (c) => c.learnedWords >= 100,
    progress: (c) => pct(c.learnedWords, 100),
  },
  {
    id: "words-500",
    name: "Halfway",
    desc: "Learn 500 words",
    emoji: "🗺️",
    group: "words",
    earned: (c) => c.learnedWords >= 500,
    progress: (c) => pct(c.learnedWords, 500),
  },
  {
    id: "words-1000",
    name: "Word Master",
    desc: "Learn 1000 words",
    emoji: "🏆",
    group: "words",
    earned: (c) => c.learnedWords >= 1000,
    progress: (c) => pct(c.learnedWords, 1000),
  },
  // ---- mastery (memory level 5) ----
  {
    id: "mastery-25",
    name: "Sharp Memory",
    desc: "Master 25 words",
    emoji: "🧠",
    group: "mastery",
    earned: (c) => c.masteredWords >= 25,
    progress: (c) => pct(c.masteredWords, 25),
  },
  {
    id: "mastery-100",
    name: "Golden Memory",
    desc: "Master 100 words",
    emoji: "💎",
    group: "mastery",
    earned: (c) => c.masteredWords >= 100,
    progress: (c) => pct(c.masteredWords, 100),
  },
  // ---- streak ----
  {
    id: "streak-3",
    name: "Spark",
    desc: "3-day streak",
    emoji: "🔥",
    group: "streak",
    earned: (c) => c.longestStreak >= 3,
    progress: (c) => pct(c.longestStreak, 3),
  },
  {
    id: "streak-7",
    name: "Diligent Learner",
    desc: "7-day streak",
    emoji: "⭐",
    group: "streak",
    earned: (c) => c.longestStreak >= 7,
    progress: (c) => pct(c.longestStreak, 7),
  },
  {
    id: "streak-30",
    name: "Unstoppable",
    desc: "30-day streak",
    emoji: "🦾",
    group: "streak",
    earned: (c) => c.longestStreak >= 30,
    progress: (c) => pct(c.longestStreak, 30),
  },
  // ---- XP ----
  {
    id: "xp-1000",
    name: "XP Collector",
    desc: "Reach 1,000 XP",
    emoji: "⚡",
    group: "xp",
    earned: (c) => c.totalXp >= 1000,
    progress: (c) => pct(c.totalXp, 1000),
  },
  {
    id: "xp-10000",
    name: "XP Master",
    desc: "Reach 10,000 XP",
    emoji: "🌟",
    group: "xp",
    earned: (c) => c.totalXp >= 10000,
    progress: (c) => pct(c.totalXp, 10000),
  },
  // ---- level ----
  {
    id: "level-5",
    name: "Rising Star",
    desc: "Reach Level 5",
    emoji: "🚀",
    group: "level",
    earned: (c) => c.level >= 5,
    progress: (c) => pct(c.level, 5),
  },
  {
    id: "level-10",
    name: "Expert",
    desc: "Reach Level 10",
    emoji: "🎖️",
    group: "level",
    earned: (c) => c.level >= 10,
    progress: (c) => pct(c.level, 10),
  },
  {
    id: "level-20",
    name: "Legend",
    desc: "Reach Level 20",
    emoji: "👑",
    group: "level",
    earned: (c) => c.level >= 20,
    progress: (c) => pct(c.level, 20),
  },
];

export interface EvaluatedBadge {
  def: BadgeDef;
  earned: boolean;
  progress: { cur: number; goal: number };
}

/** Evaluate every badge against the context; earned ones float to the front. */
export function evaluateBadges(ctx: BadgeCtx): EvaluatedBadge[] {
  return BADGES.map((def) => ({ def, earned: def.earned(ctx), progress: def.progress(ctx) })).sort(
    (a, b) => Number(b.earned) - Number(a.earned),
  );
}

export function earnedCount(ctx: BadgeCtx): number {
  return BADGES.reduce((n, b) => n + (b.earned(ctx) ? 1 : 0), 0);
}
