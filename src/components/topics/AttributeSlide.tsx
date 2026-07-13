"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { SlideEyebrow, SlideHeading, ArtPanel, SlideTwoCol } from "@/components/topics/slide-ui";
import { cn } from "@/lib/utils";
import type { AttributeTopicSlide, Word } from "@/types";

export function AttributeSlide({ slide, words }: { slide: AttributeTopicSlide; words: Word[] }) {
  const w = slide.word_id != null ? words.find((x) => x.id === slide.word_id) : undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const revealed = picked !== null;

  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>Describe &amp; choose</SlideEyebrow>
      <SlideHeading>{slide.prompt_en}</SlideHeading>
      <SlideTwoCol art={<ArtPanel imageUrl={w?.image_url} emoji="❓" alt={w?.term ?? ""} />}>
        <div className="grid gap-2.5">
          {slide.options.map((opt, i) => (
            <button
              key={i}
              disabled={revealed}
              onClick={() => setPicked(i)}
              className={cn(
                "flex items-center justify-between rounded-xl border px-4 py-3 text-left font-semibold transition",
                !revealed && "border-white/10 bg-neutral-800/70 text-neutral-100 hover:border-green-400/50",
                revealed && opt.correct && "border-green-500 bg-green-500/15 text-green-300",
                revealed && !opt.correct && picked === i && "border-rose-500 bg-rose-500/15 text-rose-300",
                revealed && !opt.correct && picked !== i && "border-white/10 text-neutral-500",
              )}
            >
              <span>{opt.label}</span>
              {revealed && opt.correct && <Check className="h-5 w-5 text-green-400" />}
              {revealed && !opt.correct && picked === i && <X className="h-5 w-5 text-rose-400" />}
            </button>
          ))}
        </div>
        {revealed && slide.explain_en && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">
            {slide.explain_en}
          </motion.p>
        )}
      </SlideTwoCol>
    </div>
  );
}
