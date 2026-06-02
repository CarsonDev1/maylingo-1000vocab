"use client";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LevelProgressBar } from "@/components/level/LevelProgressBar";
import { LevelEmblem } from "@/components/level/LevelEmblem";
import { BadgeTile } from "@/components/level/BadgeTile";
import { levelFromXp, tierForLevel } from "@/lib/level";
import { evaluateBadges, earnedCount, BADGES, type GamificationStats } from "@/lib/badges";
import { cn } from "@/lib/utils";

/**
 * Tappable wrapper: renders `children` as the trigger and opens a game-styled
 * dialog with full level + badge details.
 */
export function LevelDialog({
  stats,
  children,
}: {
  stats: GamificationStats;
  children: React.ReactNode;
}) {
  const info = levelFromXp(stats.totalXp);
  const tier = tierForLevel(info.level);
  const ctx = { ...stats, level: info.level };
  const badges = evaluateBadges(ctx);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-2xl gap-0 overflow-y-auto rounded-3xl border-0 bg-gradient-to-b from-white to-slate-50 p-0 shadow-2xl">
        <DialogTitle className="sr-only">Level and badges</DialogTitle>

        {/* Hero */}
        <div className="relative overflow-hidden px-6 pb-5 pt-7">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-28 opacity-[0.14]"
            style={{ background: `radial-gradient(120% 100% at 30% 0%, ${tier.glow}, transparent 70%)` }}
          />
          <div className="relative flex items-center gap-4">
            <LevelEmblem level={info.level} size={84} />
            <div className="min-w-0">
              <p className={cn("text-xs font-extrabold uppercase tracking-[0.15em]", tier.textClass)}>{tier.name}</p>
              <p className="text-4xl font-black leading-none text-neutral-800">Level {info.level}</p>
              <p className="mt-1 text-sm font-bold text-amber-500">{info.totalXp.toLocaleString("en-US")} XP</p>
            </div>
          </div>
        </div>

        {/* XP bar */}
        <div className="px-6">
          <div className="rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-xs font-extrabold text-neutral-400">
              <span>LEVEL {info.level}</span>
              <span>LEVEL {info.level + 1}</span>
            </div>
            <LevelProgressBar value={info.progressPct} fillClassName={tier.gradient} glow={tier.color} shimmer height={18} />
            <p className="mt-2.5 text-center text-sm text-neutral-500">
              <b className={tier.textClass}>{info.xpToNext.toLocaleString("en-US")} XP</b> to reach{" "}
              <b className="text-neutral-700">Level {info.level + 1}</b>
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2.5 px-6 pt-4">
          <StatChip emoji="⚡" value={info.totalXp.toLocaleString("en-US")} label="Total XP" tint="bg-amber-50 text-amber-600" />
          <StatChip emoji="📘" value={`${stats.learnedWords}`} label="Words" tint="bg-emerald-50 text-emerald-600" />
          <StatChip emoji="🔥" value={`${stats.currentStreak}`} label="Streak" tint="bg-rose-50 text-rose-500" />
        </div>

        {/* Badges */}
        <div className="px-6 pb-6 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-black uppercase tracking-wide text-neutral-700">Badges</h4>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-600">
              {earnedCount(ctx)}/{BADGES.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {badges.map((b) => (
              <BadgeTile key={b.def.id} badge={b} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatChip({ emoji, value, label, tint }: { emoji: string; value: string; label: string; tint: string }) {
  const [bg, text] = tint.split(" ");
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border-2 border-white p-2.5 shadow-sm", bg)}>
      <span className="text-lg leading-none">{emoji}</span>
      <span className={cn("mt-1 text-base font-black leading-none", text)}>{value}</span>
      <span className="mt-1 text-[11px] font-semibold text-neutral-400">{label}</span>
    </div>
  );
}
