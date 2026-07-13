"use client";

import { motion } from "framer-motion";
import { SlideEyebrow, SlideHeading, ArtPanel } from "@/components/topics/slide-ui";
import type { CoverTopicSlide, Word } from "@/types";

export function CoverSlide({ slide, words, title }: { slide: CoverTopicSlide; words: Word[]; title: string }) {
  const hero = slide.hero_word_id != null ? words.find((w) => w.id === slide.hero_word_id) : undefined;
  return (
    <div className="grid flex-1 items-center gap-6 md:grid-cols-[1.15fr_0.85fr]">
      <div>
        <SlideEyebrow>Topic · Workplace communication</SlideEyebrow>
        <SlideHeading size="h1">{title}</SlideHeading>
        {slide.goal_en && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-neutral-800/70 px-4 py-2.5 text-sm font-semibold text-neutral-100"
          >
            🎯 {slide.goal_en}
          </motion.p>
        )}
      </div>
      <div className="hidden md:block">
        <ArtPanel imageUrl={hero?.image_url} emoji="🎯" alt={title} />
      </div>
    </div>
  );
}
