"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { tierForLevel } from "@/lib/level";

/**
 * The level shield emblem framed by a soft, tier-coloured radial glow (no hard
 * coloured disc behind it, so the blue/gold shield always reads cleanly).
 */
export function LevelEmblem({
  level,
  size = 48,
  glowPulse = true,
  className,
}: {
  level: number;
  size?: number;
  glowPulse?: boolean;
  className?: string;
}) {
  const tier = tierForLevel(level);
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <span
        aria-hidden
        className={cn("absolute inset-[-18%] rounded-full blur-md", glowPulse && "animate-glow-pulse")}
        style={{ background: `radial-gradient(circle, ${tier.glow} 0%, transparent 68%)` }}
      />
      <Image
        src="/level.svg"
        width={size}
        height={size}
        alt=""
        className="relative drop-shadow-[0_4px_8px_rgba(8,102,232,0.35)]"
      />
    </div>
  );
}
