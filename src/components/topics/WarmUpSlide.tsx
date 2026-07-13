"use client";

import { motion } from "framer-motion";
import { SlideEyebrow, SlideHeading, SlideLead } from "@/components/topics/slide-ui";
import type { WarmUpTopicSlide } from "@/types";

export function WarmUpSlide({ slide }: { slide: WarmUpTopicSlide }) {
  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>Warm-up · What you&apos;ll do</SlideEyebrow>
      <SlideHeading>Today&apos;s scenario</SlideHeading>
      {slide.scenario_en && <SlideLead>{slide.scenario_en}</SlideLead>}
      <ol className="mt-6 flex flex-col gap-2.5">
        {slide.agenda.map((step, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-800/70 px-4 py-3"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-green-500/15 text-sm font-extrabold text-green-400">{i + 1}</span>
            <span className="font-semibold text-neutral-100">{step}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
