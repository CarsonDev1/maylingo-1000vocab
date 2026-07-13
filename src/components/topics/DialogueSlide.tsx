"use client";

import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { SlideEyebrow, SlideHeading } from "@/components/topics/slide-ui";
import { speakText } from "@/lib/tts";
import { cn } from "@/lib/utils";
import type { DialogueTopicSlide } from "@/types";

export function DialogueSlide({ slide }: { slide: DialogueTopicSlide }) {
  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>A real conversation</SlideEyebrow>
      <SlideHeading>{slide.title_en || "At work"}</SlideHeading>
      <div className="mt-5 flex flex-col gap-2.5">
        {slide.lines.map((l, i) => {
          const you = l.who === "b";
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.25 }}
              className={cn(
                "max-w-[85%] rounded-2xl border px-4 py-2.5",
                you ? "self-end rounded-br-sm border-green-500/40 bg-green-500/15" : "self-start rounded-bl-sm border-white/10 bg-neutral-800/70",
              )}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-neutral-400">{you ? "You" : "Colleague"}</p>
              <p className="mt-0.5 font-semibold text-white">{l.en}</p>
              <button onClick={() => speakText(l.en)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-400" aria-label="Listen">
                <Volume2 className="h-3.5 w-3.5" /> listen
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
