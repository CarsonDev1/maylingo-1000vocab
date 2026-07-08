"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playAudio } from "@/lib/audio";
import { cn } from "@/lib/utils";
import type { AttributeSlide as AttributeSlideT, Word } from "@/types";

export function AttributeSlide({ slide, words, onDone }: { slide: AttributeSlideT; words: Word[]; onDone: (score?: number) => void }) {
  const word = slide.word_id != null ? words.find((w) => w.id === slide.word_id) : undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  function choose(i: number, correct: boolean) {
    if (revealed) return;
    setPicked(i);
    setRevealed(true);
    playAudio(correct ? "/correct.mp3" : "/incorrect.mp3");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5">
      {word?.image_url ? (
        <Image src={word.image_url} alt="" width={180} height={150} unoptimized className="h-32 w-auto rounded-2xl object-contain" />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-100 text-4xl">💬</div>
      )}

      <p className="text-center text-lg font-semibold text-neutral-800">{slide.prompt_en}</p>
      <p className="text-center text-sm text-muted-foreground">{slide.prompt_vi}</p>

      <div className="grid w-full gap-3">
        {slide.options.map((opt, i) => {
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
        <div className="w-full">
          {slide.explain_vi && (
            <p className="mb-3 rounded-xl bg-amber-500/10 p-3 text-sm text-neutral-800">{slide.explain_vi}</p>
          )}
          <Button variant="primary" className="w-full" onClick={() => onDone()}>Tiếp tục</Button>
        </div>
      )}
    </div>
  );
}
