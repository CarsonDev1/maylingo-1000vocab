"use client";

import { LevelDialog } from "@/components/level/LevelDialog";
import { LevelEmblem } from "@/components/level/LevelEmblem";
import { levelFromXp, tierForLevel } from "@/lib/level";
import type { GamificationStats } from "@/lib/badges";
import { cn } from "@/lib/utils";

/** Compact, tappable level pill for the top-right HUD. */
export function LevelBadge({ stats }: { stats: GamificationStats }) {
  const info = levelFromXp(stats.totalXp);
  const tier = tierForLevel(info.level);
  return (
    <LevelDialog stats={stats}>
      <button
        type="button"
        title={`Level ${info.level} · ${tier.name} — tap for details`}
        className={cn(
          "flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 ring-1 ring-black/5 transition hover:brightness-95",
          tier.softClass,
        )}
      >
        <LevelEmblem level={info.level} size={26} glowPulse={false} />
        <span className={cn("text-sm font-black", tier.textClass)}>Level {info.level}</span>
      </button>
    </LevelDialog>
  );
}
