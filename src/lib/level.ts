/**
 * XP → Level system.
 *
 * XP is earned from learning (+10 / new word) and reviewing (+5 / correct
 * answer) and accumulates in `user_daily_activity.xp`. Total XP = sum of all
 * daily rows.
 *
 * Leveling is geometric: the XP required to advance from level L to L+1 doubles
 * each time — 1000, 2000, 4000, 8000, … So the cumulative XP needed to *reach*
 * level L is 1000 * (2^(L-1) - 1):
 *   L1 = 0, L2 = 1000, L3 = 3000, L4 = 7000, L5 = 15000, …
 *
 * Pure & deterministic.
 */

export interface LevelInfo {
  level: number;
  totalXp: number;
  levelBaseXp: number; // cumulative XP at the start of the current level
  nextLevelXp: number; // cumulative XP required for the next level
  xpIntoLevel: number; // totalXp - levelBaseXp
  xpForLevel: number; // XP span of the current level (= 1000 * 2^(level-1))
  xpToNext: number; // XP still needed to level up
  progressPct: number; // 0..100 within the current level
}

const BASE = 1000; // XP for the very first level-up (L1 -> L2)

/** Cumulative XP required to *reach* a given level (level 1 = 0 XP). */
export function levelBaseXp(level: number): number {
  if (level <= 1) return 0;
  return BASE * (2 ** (level - 1) - 1);
}

/** Resolve total XP into the current level + progress toward the next one. */
export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  let level = 1;
  // levels grow geometrically, so this loop is tiny (logarithmic in xp)
  while (xp >= levelBaseXp(level + 1)) level++;

  const base = levelBaseXp(level);
  const next = levelBaseXp(level + 1);
  const span = next - base;
  const into = xp - base;

  return {
    level,
    totalXp: xp,
    levelBaseXp: base,
    nextLevelXp: next,
    xpIntoLevel: into,
    xpForLevel: span,
    xpToNext: Math.max(0, next - xp),
    progressPct: span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 0,
  };
}

// ----------------------------------------------------------------------------
// Tier styling — a band of levels shares a name + colour theme.
// ----------------------------------------------------------------------------
export interface LevelTier {
  /** lowest level that belongs to this tier */
  from: number;
  name: string;
  /** tailwind gradient stops (left→right) for the level chip / XP bar */
  gradient: string;
  /** solid accent colour (hex) for rings, bars, glows */
  color: string;
  /** lighter accent (hex) — used for glows / radial halos */
  glow: string;
  /** readable text colour class on a light surface */
  textClass: string;
  /** soft tinted background class for HUD chips */
  softClass: string;
}

// Tier 1 is BLUE on purpose: the level.svg emblem is a blue shield + gold star,
// so the base theme matches the icon. Higher tiers climb the classic metal ranks.
const TIERS: LevelTier[] = [
  { from: 1, name: "Rookie", gradient: "from-sky-400 to-blue-600", color: "#2f7bf6", glow: "#38bdf8", textClass: "text-blue-600", softClass: "bg-sky-50" },
  { from: 3, name: "Bronze", gradient: "from-amber-400 to-orange-600", color: "#ea7a17", glow: "#fbbf24", textClass: "text-orange-700", softClass: "bg-orange-50" },
  { from: 6, name: "Silver", gradient: "from-slate-300 to-slate-500", color: "#64748b", glow: "#cbd5e1", textClass: "text-slate-600", softClass: "bg-slate-100" },
  { from: 10, name: "Gold", gradient: "from-yellow-300 to-amber-500", color: "#f59e0b", glow: "#fde047", textClass: "text-amber-600", softClass: "bg-amber-50" },
  { from: 15, name: "Platinum", gradient: "from-cyan-300 to-teal-500", color: "#14b8a6", glow: "#5eead4", textClass: "text-teal-600", softClass: "bg-teal-50" },
  { from: 20, name: "Diamond", gradient: "from-sky-400 to-indigo-500", color: "#6366f1", glow: "#818cf8", textClass: "text-indigo-600", softClass: "bg-indigo-50" },
  { from: 30, name: "Legend", gradient: "from-fuchsia-500 to-purple-600", color: "#a855f7", glow: "#e879f9", textClass: "text-purple-600", softClass: "bg-fuchsia-50" },
];

export function tierForLevel(level: number): LevelTier {
  let tier = TIERS[0];
  for (const t of TIERS) if (level >= t.from) tier = t;
  return tier;
}

/** Compact integer formatting: 1500 -> "1.5k". */
export function formatXp(xp: number): string {
  if (xp < 1000) return String(xp);
  const k = xp / 1000;
  return (k >= 100 ? Math.round(k) : Math.round(k * 10) / 10) + "k";
}
