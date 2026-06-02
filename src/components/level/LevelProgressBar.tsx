"use client";

import { cn } from "@/lib/utils";

/**
 * Game-style XP / progress bar.
 *
 * Looks like a chunky gameplay meter: a recessed track (inset shadow), a glossy
 * gradient fill with a top highlight, an optional coloured glow, and an optional
 * animated sheen sweep. `fillClassName` takes tailwind gradient stops, e.g.
 * "from-sky-400 to-blue-600", so it can match the level tier.
 */
export function LevelProgressBar({
  value,
  fillClassName = "from-sky-400 to-blue-600",
  trackClassName,
  glow,
  shimmer = false,
  height = 14,
}: {
  value: number; // 0..100
  fillClassName?: string;
  trackClassName?: string;
  /** hex colour for the outer glow (usually the tier colour) */
  glow?: string;
  /** animated light sweep — reserve for prominent XP bars */
  shimmer?: boolean;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-slate-200/90 ring-1 ring-black/5",
        "shadow-[inset_0_2px_4px_rgba(0,0,0,0.22)]",
        trackClassName,
      )}
      style={{ height }}
    >
      {pct > 0 && (
        <div
          className={cn(
            "relative h-full overflow-hidden rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out",
            fillClassName,
          )}
          style={{
            width: `${pct}%`,
            boxShadow: glow
              ? `0 0 12px ${glow}, inset 0 -2px 3px rgba(0,0,0,0.22)`
              : "inset 0 -2px 3px rgba(0,0,0,0.22)",
          }}
        >
          {/* glossy top highlight */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-[45%] rounded-full bg-white/40" />
          {/* animated sheen */}
          {shimmer && (
            <span className="pointer-events-none absolute inset-0 animate-shimmer bg-[linear-gradient(100deg,transparent_38%,rgba(255,255,255,0.65)_50%,transparent_62%)] bg-[length:200%_100%]" />
          )}
        </div>
      )}
    </div>
  );
}
