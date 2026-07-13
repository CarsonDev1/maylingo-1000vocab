"use client";

import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { SlideEyebrow, SlideHeading } from "@/components/topics/slide-ui";
import { speakText } from "@/lib/tts";
import type { PhrasesTopicSlide } from "@/types";

export function PhrasesSlide({ slide }: { slide: PhrasesTopicSlide }) {
  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>Key phrases</SlideEyebrow>
      <SlideHeading>Say it like this</SlideHeading>
      <div className="mt-5 grid flex-1 content-start gap-4 sm:grid-cols-2">
        {slide.groups.map((g, gi) => (
          <motion.div
            key={gi}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.08 }}
            className="rounded-2xl border border-white/10 bg-neutral-800/70 p-4"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-green-400">{g.heading_en}</p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {g.phrases.map((p, pi) => (
                <li key={pi}>
                  <button
                    onClick={() => speakText(p)}
                    className="flex w-full items-start gap-2 text-left text-neutral-100 transition hover:text-white"
                    aria-label={`Listen: ${p}`}
                  >
                    <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                    <span className="font-semibold">{p}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-400">Tap a phrase to hear it.</p>
    </div>
  );
}
