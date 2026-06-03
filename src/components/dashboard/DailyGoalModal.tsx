"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmDailyGoal } from "@/lib/actions";
import { cn } from "@/lib/utils";

const PRESETS = [
  { goal: 10, label: "Casual", emoji: "🌱" },
  { goal: 20, label: "Regular", emoji: "🔥" },
  { goal: 30, label: "Serious", emoji: "💪" },
  { goal: 50, label: "Intense", emoji: "🚀" },
];

/**
 * Start-of-day overlay: the first time the user opens the dashboard on a new day,
 * they pick how many NEW words to learn that day. Saving records the date so it
 * won't reappear until tomorrow.
 */
export function DailyGoalModal({ currentGoal }: { currentGoal: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => {
    const match = PRESETS.find((p) => p.goal === currentGoal);
    return match ? match.goal : 20;
  });
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await confirmDailyGoal(selected);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border-2 border-white bg-gradient-to-b from-white to-slate-50 p-6 text-center shadow-2xl">
        <div className="relative mx-auto h-20 w-20">
          <span
            aria-hidden
            className="absolute inset-[-20%] animate-glow-pulse rounded-full blur-md"
            style={{ background: "radial-gradient(circle, #fbbf24, transparent 68%)" }}
          />
          <Image src="/goal-today.svg" width={80} height={80} alt="" className="relative" />
        </div>

        <h2 className="mt-3 text-2xl font-black text-neutral-800">Set today&apos;s goal</h2>
        <p className="mt-1 text-sm text-muted-foreground">How many new words do you want to learn today?</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {PRESETS.map((p) => {
            const active = selected === p.goal;
            return (
              <button
                key={p.goal}
                type="button"
                onClick={() => setSelected(p.goal)}
                className={cn(
                  "rounded-2xl border-2 p-4 text-left transition",
                  active
                    ? "border-green-500 bg-green-50 shadow-[0_2px_10px_-2px_rgba(34,197,94,0.45)]"
                    : "border-slate-200 bg-white hover:border-slate-300",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{p.emoji}</span>
                  {active && <span className="text-green-500">✓</span>}
                </div>
                <p className="mt-1 text-lg font-black text-neutral-800">
                  {p.goal} <span className="text-sm font-bold text-muted-foreground">words</span>
                </p>
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-green-600">{p.label}</p>
              </button>
            );
          })}
        </div>

        <Button variant="secondary" size="lg" className="mt-5 w-full" onClick={confirm} disabled={pending}>
          {pending ? "Saving..." : `Start with ${selected} words`}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
