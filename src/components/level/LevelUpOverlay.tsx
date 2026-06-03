"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { LevelEmblem } from "@/components/level/LevelEmblem";
import { tierForLevel } from "@/lib/level";

const COLORS = ["#38bdf8", "#f59e0b", "#f43f5e", "#22c55e", "#a855f7", "#fde047"];

/**
 * Full-screen "Level up!" celebration: falling confetti, a spinning sunburst,
 * and the new-level emblem popping in. Shown on the finish screen when a session
 * pushes the user past a level threshold.
 */
export function LevelUpOverlay({
  level,
  fromLevel,
  onContinue,
}: {
  level: number;
  fromLevel: number;
  onContinue: () => void;
}) {
  const tier = tierForLevel(level);
  const jumped = Math.max(1, level - fromLevel);

  // confetti pieces — generated once (client-only render, so randomness is fine)
  const pieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => ({
        left: Math.random() * 100,
        bg: COLORS[i % COLORS.length],
        delay: Math.random() * 2.6,
        dur: 2.2 + Math.random() * 2.2,
        size: 6 + Math.random() * 8,
        round: Math.random() > 0.5,
      })),
    [],
  );

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center overflow-hidden bg-neutral-900/85 px-6 backdrop-blur-sm">
      {/* confetti */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="absolute top-0 animate-confetti-fall"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.bg,
              borderRadius: p.round ? "9999px" : "2px",
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center text-center">
        {/* spinning sunburst rays */}
        <div
          aria-hidden
          className="absolute -top-10 h-[440px] w-[440px] animate-spin-slow rounded-full opacity-30"
          style={{
            background: `repeating-conic-gradient(${tier.glow} 0deg 7deg, transparent 7deg 26deg)`,
            maskImage: "radial-gradient(circle, black 22%, transparent 68%)",
            WebkitMaskImage: "radial-gradient(circle, black 22%, transparent 68%)",
          }}
        />

        <div className="relative animate-badge-pop">
          <LevelEmblem level={level} size={132} />
        </div>

        <p className="relative mt-6 bg-gradient-to-b from-amber-200 to-amber-400 bg-clip-text text-4xl font-black uppercase tracking-[0.12em] text-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
          Level Up!
        </p>
        <p className="relative mt-2 text-lg font-extrabold text-white">
          Level {level} · <span style={{ color: tier.glow }}>{tier.name}</span>
        </p>
        {jumped > 1 && <p className="relative mt-1 text-sm font-bold text-amber-300">+{jumped} levels!</p>}

        <Button variant="secondary" size="lg" className="relative mt-8 min-w-[220px]" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
