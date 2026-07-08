"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Volume2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playAudio } from "@/lib/audio";
import { buildVocabOptions } from "@/lib/topic-deck";
import { cn } from "@/lib/utils";
import type { VocabSlide as VocabSlideT, Word } from "@/types";

export function VocabSlide({ slide, words, onDone }: { slide: VocabSlideT; words: Word[]; onDone: (score?: number) => void }) {
  const word = words.find((w) => w.id === slide.word_id);
  const options = useMemo(() => (word ? buildVocabOptions(word, words) : []), [word, words]);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Image appears first; play the word audio once it does.
  useEffect(() => {
    const t = setTimeout(() => word && playAudio(word.audio_url), 400);
    return () => clearTimeout(t);
  }, [word]);

  if (!word) {
    // Missing word data — skip this slide rather than block.
    return (
      <div className="text-center">
        <Button variant="primary" onClick={() => onDone()}>Tiếp tục</Button>
      </div>
    );
  }

  function choose(i: number, correct: boolean) {
    if (revealed) return;
    setPicked(i);
    setRevealed(true);
    playAudio(correct ? "/correct.mp3" : "/incorrect.mp3");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
      <div className="animate-in fade-in zoom-in-95 duration-300">
        {word.image_url ? (
          <Image src={word.image_url} alt="" width={240} height={200} unoptimized className="h-48 w-auto rounded-2xl object-contain" />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-slate-100 text-5xl">🗂️</div>
        )}
      </div>
      <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Đây là gì?</p>

      <div className="grid w-full grid-cols-2 gap-3">
        {options.map((opt, i) => {
          const show = revealed;
          return (
            <button
              key={i}
              disabled={show}
              onClick={() => choose(i, opt.correct)}
              className={cn(
                "flex items-center justify-between rounded-xl border-2 border-b-4 px-4 py-3 text-left font-semibold text-neutral-700 transition",
                !show && "hover:bg-slate-50 active:border-b-2",
                show && opt.correct && "border-green-500 bg-green-500/10 text-green-700",
                show && !opt.correct && picked === i && "border-rose-500 bg-rose-500/10 text-rose-600",
                show && !opt.correct && picked !== i && "opacity-60",
              )}
            >
              <span>{opt.label}</span>
              {show && opt.correct && <Check className="h-5 w-5 text-green-600" />}
              {show && !opt.correct && picked === i && <X className="h-5 w-5 text-rose-500" />}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="flex w-full flex-col items-center gap-3">
          <button onClick={() => playAudio(word.audio_url)} className="flex items-center gap-2 text-sky-500" aria-label="Play audio">
            <Volume2 className="h-5 w-5" /> <span className="font-bold">{word.term}</span>
            {word.meaning_vi ? <span className="text-muted-foreground">— {word.meaning_vi}</span> : null}
          </button>
          <Button variant="primary" className="w-full" onClick={() => onDone()}>Tiếp tục</Button>
        </div>
      )}
    </div>
  );
}
