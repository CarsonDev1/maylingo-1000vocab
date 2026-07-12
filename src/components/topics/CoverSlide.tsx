"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { CoverTopicSlide, Word } from "@/types";

export function CoverSlide({ slide, words, title, onDone }: { slide: CoverTopicSlide; words: Word[]; title: string; onDone: (score?: number) => void }) {
  const hero = slide.hero_word_id != null ? words.find((w) => w.id === slide.hero_word_id) : undefined;
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 text-center">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {hero?.image_url ? (
          <Image src={hero.image_url} alt="" width={200} height={160} unoptimized className="h-40 w-auto rounded-2xl object-contain" />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-green-50 text-5xl">🎯</div>
        )}
      </motion.div>
      <h1 className="text-3xl font-extrabold tracking-tight text-neutral-800">{title}</h1>
      {slide.goal_en && (
        <p className="rounded-xl border-2 bg-slate-50 px-4 py-2 text-sm text-neutral-700">🎯 {slide.goal_en}</p>
      )}
      <Button variant="primary" className="w-full" onClick={() => onDone()}>Start</Button>
    </div>
  );
}
