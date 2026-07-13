"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Button } from "@/components/ui/button";
import { playAudio } from "@/lib/audio";
import { finishTopicDay } from "@/lib/actions";
import { isTtsSupported } from "@/lib/tts";
import { cn } from "@/lib/utils";
import { CoverSlide } from "@/components/topics/CoverSlide";
import { WarmUpSlide } from "@/components/topics/WarmUpSlide";
import { VocabSlide } from "@/components/topics/VocabSlide";
import { ExampleSlide } from "@/components/topics/ExampleSlide";
import { AttributeSlide } from "@/components/topics/AttributeSlide";
import { PhrasesSlide } from "@/components/topics/PhrasesSlide";
import { DialogueSlide } from "@/components/topics/DialogueSlide";
import { VoiceQASlide } from "@/components/topics/VoiceQASlide";
import { RecapSlide } from "@/components/topics/RecapSlide";
import type { TopicDeck, Word } from "@/types";

type NextDay = { day_no: number; title_en: string | null } | null;
type Rewards = { xpEarned: number; currentStreak: number; bestScore: number };

export function TopicDeckRunner({ deck, words, nextDay }: { deck: TopicDeck; words: Word[]; nextDay: NextDay }) {
  const total = deck.slides.length;
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const finishedRef = useRef(false);

  const go = useCallback((n: number) => {
    if (isTtsSupported()) window.speechSynthesis.cancel();
    setIndex(() => Math.max(0, Math.min(total - 1, n)));
  }, [total]);

  const onScore = useCallback((s: number) => setScores((prev) => [...prev, s]), []);

  // Finish once when the last slide (recap) is reached.
  useEffect(() => {
    if (total === 0 || index < total - 1 || finishedRef.current) return;
    finishedRef.current = true;
    playAudio("/finish.mp3");
    finishTopicDay(deck.day_no, scores)
      .then(setRewards)
      .catch(() => setRewards({ xpEarned: 0, currentStreak: 0, bestScore: 0 }));
  }, [index, total, deck.day_no, scores]);

  // Keyboard nav. Arrows always navigate; Enter navigates only when no
  // interactive control is focused — so typing in the answer box, or pressing
  // Enter while the mic / a dot / Prev-Next is focused, activates that control
  // instead of jumping the deck forward.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (el && (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
      else if (e.key === "Enter") {
        const onControl = !!el && (tag === "BUTTON" || tag === "A" || el.getAttribute("role") === "button");
        if (onControl) return; // let the focused control handle Enter natively
        e.preventDefault();
        go(index + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  if (total === 0) {
    return (
      <Shell>
        <div className="grid flex-1 place-items-center">
          <div className="rounded-2xl border border-white/10 bg-neutral-800 p-8 text-center">
            <p className="text-white">No content for this day yet.</p>
            <Button asChild variant="secondary" className="mt-5"><Link href="/topics">Back to path</Link></Button>
          </div>
        </div>
      </Shell>
    );
  }

  const slide = deck.slides[index];
  const title = deck.title_en ?? "";
  const slideTypes = deck.slides.map((s) => s.type);
  const isLast = index >= total - 1;

  return (
    <Shell>
      <header className="mx-auto flex w-full max-w-[1080px] items-center gap-3 px-4 pt-5 lg:px-8">
        <Link href="/topics" aria-label="Exit" className="shrink-0 text-neutral-400 transition hover:text-white"><X className="h-6 w-6" /></Link>
        <span className="truncate rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-400">Day {deck.day_no} · {title}</span>
      </header>

      <div className="mx-auto mt-3 flex w-full max-w-[1080px] items-center gap-3 px-4 lg:px-8">
        <div className="flex flex-1 gap-1.5">
          {deck.slides.map((_, idx) => (
            <button
              key={idx}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => go(idx)}
              className={cn("h-1.5 flex-1 rounded-full transition", idx === index ? "bg-green-500" : idx < index ? "bg-green-500/40" : "bg-white/15")}
            />
          ))}
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums text-neutral-400">{index + 1} / {total}</span>
      </div>

      <div className="mx-auto flex w-full max-w-[1080px] flex-1 px-4 py-4 lg:px-8">
        <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-neutral-800 shadow-2xl lg:aspect-[16/9]">
          <MotionConfig reducedMotion="user">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.28 }}
                className="flex h-full flex-col overflow-y-auto p-6 sm:p-8 lg:p-10"
              >
                {slide.type === "cover" && <CoverSlide slide={slide} words={words} title={title} />}
                {slide.type === "warm_up" && <WarmUpSlide slide={slide} />}
                {slide.type === "vocab" && <VocabSlide slide={slide} words={words} />}
                {slide.type === "example" && <ExampleSlide slide={slide} words={words} />}
                {slide.type === "attribute" && <AttributeSlide slide={slide} words={words} />}
                {slide.type === "phrases" && <PhrasesSlide slide={slide} />}
                {slide.type === "dialogue" && <DialogueSlide slide={slide} />}
                {slide.type === "voice_qa" && <VoiceQASlide slide={slide} dayNo={deck.day_no} onScore={onScore} />}
                {slide.type === "recap" && <RecapSlide title={title} slideTypes={slideTypes} scores={scores} rewards={rewards} nextDay={nextDay} />}
              </motion.div>
            </AnimatePresence>
          </MotionConfig>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1080px] items-center gap-3 px-4 pb-5 lg:px-8">
        <Button variant="secondary" onClick={() => go(index - 1)} disabled={index === 0}>← Prev</Button>
        <span className="flex-1" />
        {isLast ? (
          <Button asChild variant="primary"><Link href="/topics">Back to path</Link></Button>
        ) : (
          <Button variant="primary" onClick={() => go(index + 1)}>Next →</Button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-neutral-900 text-white">{children}</div>;
}
