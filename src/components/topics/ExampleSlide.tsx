"use client";

import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { SlideEyebrow, SlideHeading, SlideTwoCol, ArtPanel } from "@/components/topics/slide-ui";
import { speakText } from "@/lib/tts";
import type { ExampleTopicSlide, Word } from "@/types";

export function ExampleSlide({ slide, words }: { slide: ExampleTopicSlide; words: Word[] }) {
  const w = words.find((x) => x.id === slide.word_id);
  if (!w) return <div className="flex flex-1 items-center justify-center text-neutral-400">No example.</div>;
  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>In context</SlideEyebrow>
      <SlideHeading>{w.term}</SlideHeading>
      <SlideTwoCol art={<ArtPanel imageUrl={w.image_url} emoji="💬" alt={w.term} />}>
        <button onClick={() => speakText(w.term)} className="inline-flex items-center gap-2 text-lg font-extrabold text-white" aria-label={`Listen to ${w.term}`}>
          {w.term} <Volume2 className="h-4 w-4 text-green-400" />
        </button>
        {w.meaning_vi && <p className="mt-1 text-sm text-neutral-400">{w.meaning_vi}</p>}
        {w.example_en && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => speakText(w.example_en!)}
            className="mt-4 block w-full rounded-2xl border border-white/10 bg-neutral-800/70 p-4 text-left"
            aria-label="Play example sentence"
          >
            <p className="italic text-neutral-100">“{w.example_en}”</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-400"><Volume2 className="h-3.5 w-3.5" /> Listen</span>
          </motion.button>
        )}
      </SlideTwoCol>
    </div>
  );
}
