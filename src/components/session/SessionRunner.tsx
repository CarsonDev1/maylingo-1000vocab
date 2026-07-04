"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ExerciseView } from "@/components/session/ExerciseView";
import { submitReview } from "@/lib/actions";
import { playAudio } from "@/lib/audio";
import { LevelProgressBar } from "@/components/level/LevelProgressBar";
import { LevelEmblem } from "@/components/level/LevelEmblem";
import { LevelUpOverlay } from "@/components/level/LevelUpOverlay";
import { levelFromXp, tierForLevel } from "@/lib/level";
import { isGradedStep } from "@/lib/exercises";
import type { ExerciseStep } from "@/types";
import { X } from "lucide-react";

export function SessionRunner({
  steps,
  mode,
  wordIds,
  xpBefore = 0,
}: {
  steps: ExerciseStep[];
  mode: "learn" | "review";
  wordIds: number[];
  /** Lifetime XP before this session — lets the finish screen show level progress. */
  xpBefore?: number;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [levelUpSeen, setLevelUpSeen] = useState(false);

  const total = steps.length;
  const exitHref = mode === "learn" ? "/lessons" : "/dashboard";

  function handleNext(result: boolean | null) {
    const step = steps[index];
    // Compute the post-answer tallies up front: setState is async, so reading
    // `reviewed`/`correct` inside finish() on the LAST step would miss this answer.
    let nextReviewed = reviewed;
    let nextCorrect = correct;
    if (mode === "review" && result !== null) {
      void submitReview(step.word.id, result).catch(() => {});
      nextReviewed = reviewed + 1;
      setReviewed(nextReviewed);
      if (result) {
        nextCorrect = correct + 1;
        setCorrect(nextCorrect);
      }
    } else if (result === true) {
      nextCorrect = correct + 1;
      setCorrect(nextCorrect);
    }
    if (index + 1 >= total) finish(nextReviewed, nextCorrect);
    else setIndex((i) => i + 1);
  }

  function finish(finalReviewed: number, finalCorrect: number) {
    setFinished(true);
    playAudio("/finish.mp3");
    // Persist via a plain fetch to a route handler — NOT a Server Action. A Server
    // Action would trigger Next's automatic current-route refresh, which re-fetches
    // the now-empty word list and replaces this finish / level-up screen with the
    // lesson's "done"/empty state (felt like an unwanted auto-redirect). The result
    // pages still revalidate, so the "Back to home" / "Keep reviewing" links are fresh.
    const payload =
      mode === "learn"
        ? { mode, wordIds }
        : { mode, reviewed: finalReviewed, correct: finalCorrect };
    void fetch("/api/session/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }

  if (total === 0) {
    return (
      <Overlay center>
        <EmptyState title="Nothing to study here" desc="Come back later or pick another lesson." />
      </Overlay>
    );
  }

  if (finished) {
    const graded = mode === "review" ? reviewed : steps.filter(isGradedStep).length;
    const acc = graded ? Math.round((correct / graded) * 100) : 100;
    // XP earned this session — mirrors the server: +10 per new word, +5 per correct review.
    const xpGained = mode === "learn" ? wordIds.length * 10 : correct * 5;
    const before = levelFromXp(xpBefore);
    const after = levelFromXp(xpBefore + xpGained);
    const tier = tierForLevel(after.level);
    const leveledUp = after.level > before.level;
    return (
      <Overlay center>
        <div className="mx-auto w-full max-w-xl px-6 text-center">
          <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-800 p-8">
            <Image src="/finish.svg" width={100} height={100} alt="Complete" className="mx-auto" />
            <h2 className="mt-4 text-2xl font-bold text-white">Complete!</h2>
            <p className="mt-1 text-neutral-300">
              {mode === "learn" ? `You learned ${wordIds.length} new words.` : `You reviewed ${reviewed} words.`}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border-2 border-orange-400/60 bg-orange-400/10 p-4">
                <p className="text-2xl font-bold text-orange-400">+{xpGained}</p>
                <p className="text-xs font-bold uppercase text-neutral-400">XP</p>
              </div>
              <div className="rounded-xl border-2 border-sky-400/60 bg-sky-400/10 p-4">
                <p className="text-2xl font-bold text-sky-400">{acc}%</p>
                <p className="text-xs font-bold uppercase text-neutral-400">Accuracy</p>
              </div>
            </div>

            {/* Level progress */}
            <div className="mt-4 rounded-2xl border-2 border-neutral-700 bg-neutral-900/60 p-4 text-left">
              <div className="flex items-center gap-3">
                <LevelEmblem level={after.level} size={40} glowPulse={leveledUp} />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-extrabold text-white">
                      Level {after.level} · {tier.name}
                    </span>
                    <span className="font-bold text-amber-400">{after.totalXp.toLocaleString("vi-VN")} XP</span>
                  </div>
                  <div className="mt-2">
                    <LevelProgressBar
                      value={after.progressPct}
                      fillClassName={tier.gradient}
                      glow={tier.color}
                      shimmer
                      trackClassName="bg-white/15"
                      height={14}
                    />
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-center text-xs font-semibold text-neutral-300">
                {leveledUp
                  ? `🎉 Congrats! You reached Level ${after.level}!`
                  : `${after.xpToNext.toLocaleString("en-US")} XP to reach Level ${after.level + 1}`}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button asChild variant="secondary">
                <Link href="/dashboard">Back to home</Link>
              </Button>
              <Button asChild variant="primaryOutline">
                <Link href={mode === "learn" ? "/lessons" : "/review"}>
                  {mode === "learn" ? "Learn more" : "Keep reviewing"}
                </Link>
              </Button>
            </div>
          </div>
        </div>
        {leveledUp && !levelUpSeen && (
          <LevelUpOverlay level={after.level} fromLevel={before.level} onContinue={() => setLevelUpSeen(true)} />
        )}
      </Overlay>
    );
  }

  return (
    <Overlay>
      <header className="mx-auto flex w-full max-w-[1140px] items-center gap-3 px-4 pb-2 pt-6 lg:px-10 lg:pt-[40px]">
        <button
          type="button"
          aria-label="Exit"
          onClick={() => setConfirmOpen(true)}
          className="shrink-0 text-neutral-400 transition hover:text-white"
        >
          <X className="h-7 w-7" />
        </button>
        <div className="relative h-5 flex-1">
          {/* Track + green fill (matches the app's green theme) */}
          <div className="absolute inset-0 overflow-hidden rounded-full bg-white/90">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${(index / total) * 100}%` }}
            />
          </div>
          {/* Mascot rides along the fill edge */}
          <Image
            src="/mascot.svg"
            alt="Maylingo"
            width={40}
            height={40}
            className="absolute top-1/2 z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 drop-shadow transition-all duration-300"
            style={{ left: `clamp(20px, ${(index / total) * 100}%, calc(100% - 20px))` }}
          />
        </div>
      </header>
      <div className="flex-1 px-4 pt-4">
        <ExerciseView key={index} step={steps[index]} onNext={handleNext} index={index} total={total} />
      </div>
      {confirmOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-6">
            <div className="w-full max-w-sm rounded-2xl border-2 bg-white p-6 text-center text-neutral-800">
              <Image src="/mascot_sad.svg" width={72} height={72} alt="" className="mx-auto" />
              <h3 className="mt-3 text-lg font-bold text-neutral-800">Quit lesson?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                If you quit now, none of your progress in this session will be saved.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                  Keep going
                </Button>
                <Button
                  variant="ghost"
                  className="text-rose-500 hover:text-rose-600"
                  onClick={() => router.push(exitHref)}
                >
                  Quit
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </Overlay>
  );
}

/** Full-screen dark overlay — hides the app sidebar/header for an immersive session. */
function Overlay({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div
      className={
        "fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-neutral-900 text-white" +
        (center ? " items-center justify-center" : "")
      }
    >
      {children}
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mx-auto max-w-md px-6 text-center">
      <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-800 p-8">
        <Image src="/mascot_sad.svg" width={90} height={90} alt="" className="mx-auto" />
        <h2 className="mt-4 text-xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-neutral-300">{desc}</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/dashboard">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
