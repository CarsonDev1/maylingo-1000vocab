"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playAudio } from "@/lib/audio";
import { finishTopicDay } from "@/lib/actions";
import { VocabSlide } from "@/components/topics/VocabSlide";
import { AttributeSlide } from "@/components/topics/AttributeSlide";
import { VoiceQASlide } from "@/components/topics/VoiceQASlide";
import type { TopicDeck, Word } from "@/types";

export function TopicDeckRunner({ deck, words }: { deck: TopicDeck; words: Word[] }) {
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [xp, setXp] = useState(0);

  const total = deck.slides.length;

  function next(score?: number) {
    const nextScores = score != null ? [...scores, score] : scores;
    if (score != null) setScores(nextScores);
    if (index + 1 >= total) finish(nextScores);
    else setIndex((i) => i + 1);
  }

  function finish(finalScores: number[]) {
    setFinished(true);
    playAudio("/finish.mp3");
    finishTopicDay(deck.day_no, finalScores)
      .then((r) => setXp(r.xpEarned))
      .catch(() => {});
  }

  if (total === 0) {
    return (
      <Overlay center>
        <Empty />
      </Overlay>
    );
  }

  if (finished) {
    return (
      <Overlay center>
        <div className="mx-auto w-full max-w-md px-6 text-center">
          <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-800 p-8">
            <Image src="/finish.svg" width={90} height={90} alt="" className="mx-auto" />
            <h2 className="mt-4 text-2xl font-bold text-white">Hoàn thành ngày {deck.day_no}!</h2>
            <p className="mt-1 text-neutral-300">{deck.title_en}</p>
            <div className="mt-6 rounded-xl border-2 border-orange-400/60 bg-orange-400/10 p-4">
              <p className="text-2xl font-bold text-orange-400">+{xp}</p>
              <p className="text-xs font-bold uppercase text-neutral-400">XP</p>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <Button asChild variant="secondary">
                <Link href="/topics">Về lộ trình</Link>
              </Button>
            </div>
          </div>
        </div>
      </Overlay>
    );
  }

  const slide = deck.slides[index];

  return (
    <Overlay>
      <header className="mx-auto flex w-full max-w-[1140px] items-center gap-3 px-4 pb-2 pt-6 lg:px-10">
        <Link href="/topics" aria-label="Exit" className="shrink-0 text-neutral-400 transition hover:text-white">
          <X className="h-7 w-7" />
        </Link>
        <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-white/90">
          <div className="h-full rounded-full bg-green-500 transition-all duration-300" style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <span className="shrink-0 text-sm font-bold text-neutral-400">{index + 1}/{total}</span>
      </header>

      <div className="flex-1 px-4 pt-6">
        <div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6" key={index}>
          {slide.type === "vocab" && <VocabSlide slide={slide} words={words} onDone={next} />}
          {slide.type === "attribute" && <AttributeSlide slide={slide} words={words} onDone={next} />}
          {slide.type === "voice_qa" && <VoiceQASlide slide={slide} dayNo={deck.day_no} onDone={next} />}
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={"fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-neutral-900 text-white" + (center ? " items-center justify-center" : "")}>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="mx-auto max-w-md px-6 text-center">
      <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-800 p-8">
        <h2 className="text-xl font-bold text-white">Chưa có nội dung cho ngày này</h2>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/topics">Về lộ trình</Link>
        </Button>
      </div>
    </div>
  );
}
