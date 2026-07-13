"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { SlideEyebrow, SlideHeading } from "@/components/topics/slide-ui";
import { speakText } from "@/lib/tts";
import { cn } from "@/lib/utils";
import type { VocabTopicSlide, Word } from "@/types";

export function VocabSlide({ slide, words }: { slide: VocabTopicSlide; words: Word[] }) {
  const cards = slide.word_ids.map((id) => words.find((w) => w.id === id)).filter(Boolean) as Word[];
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>Vocabulary</SlideEyebrow>
      <SlideHeading>Words for this topic</SlideHeading>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((w, i) => {
          const isOpen = !!open[w.id];
          return (
            <motion.button
              key={w.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setOpen((o) => ({ ...o, [w.id]: !o[w.id] }))}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition",
                isOpen ? "border-green-500 bg-green-500/10" : "border-white/10 bg-neutral-800/70 hover:border-green-400/50",
              )}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [w.id]: true })); speakText(w.term); }}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-neutral-900/70 text-green-400"
                aria-label={`Listen to ${w.term}`}
              >
                <Volume2 className="h-3.5 w-3.5" />
              </span>
              {w.image_url ? (
                <Image src={w.image_url} alt="" width={120} height={90} unoptimized className="h-20 w-full rounded-xl object-contain" />
              ) : (
                <div className="grid h-20 w-full place-items-center rounded-xl bg-white/5 text-3xl">🗂️</div>
              )}
              <span className="font-bold text-white">{w.term}</span>
              {isOpen && <span className="text-xs text-neutral-300">{w.meaning_vi}</span>}
            </motion.button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-neutral-400">Tap a card to reveal its meaning · 🔊 to hear it.</p>
    </div>
  );
}
