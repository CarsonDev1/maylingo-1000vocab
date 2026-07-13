"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { SlideEyebrow, SlideHeading } from "@/components/topics/slide-ui";

const CHECKS: { type: string; label: string }[] = [
  { type: "vocab", label: "Topic vocabulary" },
  { type: "phrases", label: "Key phrases for real situations" },
  { type: "example", label: "Real-life example sentences" },
  { type: "dialogue", label: "A real conversation" },
  { type: "voice_qa", label: "AI speaking practice" },
];

export function RecapSlide({
  title, slideTypes, scores, rewards, nextDay,
}: {
  title: string;
  slideTypes: string[];
  scores: number[];
  rewards: { xpEarned: number; currentStreak: number; bestScore: number } | null;
  nextDay: { day_no: number; title_en: string | null } | null;
}) {
  const items = CHECKS.filter((c) => slideTypes.includes(c.type));
  const speakingScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : rewards?.bestScore ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>Recap</SlideEyebrow>
      <SlideHeading>You learned: {title} 🎉</SlideHeading>
      <div className="mt-5 grid flex-1 items-start gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <motion.div
              key={it.type}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-2.5 font-medium text-neutral-100"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-green-500 text-white"><Check className="h-4 w-4" /></span>
              {it.label}
            </motion.div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Tile k="XP" v={rewards ? `+${rewards.xpEarned}` : <Loader2 className="mx-auto h-5 w-5 animate-spin" />} />
            <Tile k="Speaking" v={speakingScore != null ? `${speakingScore}%` : "—"} />
            <Tile k="Streak" v={rewards ? `🔥${rewards.currentStreak}` : "—"} />
          </div>
          {nextDay && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-neutral-800/50 px-4 py-3 text-sm font-semibold text-neutral-200">
              🔓 Unlock Day {nextDay.day_no}{nextDay.title_en ? `: ${nextDay.title_en}` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-800/70 p-3 text-center">
      <div className="text-xl font-extrabold text-green-400 tabular-nums">{v}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-400">{k}</div>
    </div>
  );
}
