"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speakText } from "@/lib/tts";
import { cn } from "@/lib/utils";
import type { VocabTopicSlide, Word } from "@/types";

export function VocabSlide({ slide, words, onDone }: { slide: VocabTopicSlide; words: Word[]; onDone: (score?: number) => void }) {
  const cards = slide.word_ids.map((id) => words.find((w) => w.id === id)).filter(Boolean) as Word[];
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col">
      <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Chạm vào thẻ để mở nghĩa</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                "relative flex flex-col items-center gap-2 rounded-2xl border-2 bg-white p-3 text-center transition",
                isOpen ? "border-green-500 bg-green-50" : "border-slate-200 hover:border-green-300",
              )}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [w.id]: true })); speakText(w.term); }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white text-green-600 shadow"
                aria-label={`Nghe ${w.term}`}
              >
                <Volume2 className="h-3.5 w-3.5" />
              </span>
              {w.image_url ? (
                <Image src={w.image_url} alt="" width={120} height={90} unoptimized className="h-20 w-full rounded-xl object-contain" />
              ) : (
                <div className="flex h-20 w-full items-center justify-center rounded-xl bg-slate-100 text-3xl">🗂️</div>
              )}
              <span className="font-bold text-neutral-800">{w.term}</span>
              {isOpen && <span className="text-xs text-muted-foreground">{w.meaning_vi}</span>}
            </motion.button>
          );
        })}
      </div>
      <Button variant="primary" className="mt-6 w-full" onClick={() => onDone()}>Tiếp tục</Button>
    </div>
  );
}
