"use client";

import { LevelProgressBar } from "@/components/level/LevelProgressBar";
import type { EvaluatedBadge } from "@/lib/badges";
import { cn } from "@/lib/utils";

/** A single achievement badge — golden & glossy when earned, muted with a
 * progress meter when still locked. */
export function BadgeTile({ badge }: { badge: EvaluatedBadge }) {
  const { def, earned, progress } = badge;
  const ratio = progress.goal > 0 ? Math.round((progress.cur / progress.goal) * 100) : 0;
  return (
    <div
      title={def.desc}
      className={cn(
        "relative flex flex-col items-center overflow-hidden rounded-2xl border-2 p-2.5 text-center transition",
        earned
          ? "border-amber-300 bg-gradient-to-b from-amber-50 to-amber-100 shadow-[0_2px_10px_-2px_rgba(245,158,11,0.45)]"
          : "border-slate-200 bg-slate-50",
      )}
    >
      {earned && (
        <span aria-hidden className="pointer-events-none absolute -right-5 -top-5 h-12 w-12 rotate-45 bg-white/45 blur-md" />
      )}
      <div className={cn("text-3xl leading-none drop-shadow-sm", !earned && "opacity-30 grayscale")}>{def.emoji}</div>
      <p className="mt-1.5 text-[11px] font-extrabold leading-tight text-neutral-700">{def.name}</p>
      {earned ? (
        <p className="mt-0.5 text-[10px] font-bold text-amber-600">✓ Earned</p>
      ) : (
        <div className="mt-1.5 w-full">
          <LevelProgressBar value={ratio} fillClassName="from-slate-400 to-slate-500" height={5} />
          <p className="mt-1 text-[10px] font-semibold leading-none text-neutral-400">
            {progress.cur.toLocaleString("en-US")}/{progress.goal.toLocaleString("en-US")}
          </p>
        </div>
      )}
    </div>
  );
}
