"use client";

import { ChevronRight } from "lucide-react";
import { LevelDialog } from "@/components/level/LevelDialog";
import { LevelProgressBar } from "@/components/level/LevelProgressBar";
import { LevelEmblem } from "@/components/level/LevelEmblem";
import { levelFromXp, tierForLevel, formatXp } from "@/lib/level";
import type { GamificationStats } from "@/lib/badges";
import { cn } from "@/lib/utils";

/** Dashboard level card with a game-style XP bar; opens the detail dialog on tap. */
export function LevelCard({ stats }: { stats: GamificationStats }) {
  const info = levelFromXp(stats.totalXp);
  const tier = tierForLevel(info.level);

  return (
    <LevelDialog stats={stats}>
      <button
        type="button"
        className="group w-full rounded-2xl border-2 border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-slate-200 hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          <LevelEmblem level={info.level} size={48} glowPulse={false} />
          <div className="min-w-0 flex-1">
            <p className={cn("text-[11px] font-extrabold uppercase tracking-wide", tier.textClass)}>{tier.name}</p>
            <h3 className="text-lg font-black leading-none text-neutral-800">Level {info.level}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-amber-500">{formatXp(info.totalXp)} XP</span>
            <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-400" />
          </div>
        </div>

        <div className="mt-3">
          <LevelProgressBar value={info.progressPct} fillClassName={tier.gradient} glow={tier.color} height={14} />
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-neutral-400">
            <span>
              {formatXp(info.xpIntoLevel)}/{formatXp(info.xpForLevel)} XP
            </span>
            <span>
              <b className={tier.textClass}>{info.xpToNext.toLocaleString("en-US")} XP</b> to next
            </span>
          </div>
        </div>
      </button>
    </LevelDialog>
  );
}
