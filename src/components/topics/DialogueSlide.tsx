"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speakText } from "@/lib/tts";
import { cn } from "@/lib/utils";
import type { DialogueTopicSlide } from "@/types";

export function DialogueSlide({ slide, onDone }: { slide: DialogueTopicSlide; onDone: (score?: number) => void }) {
  const [shown, setShown] = useState(1);
  const all = shown >= slide.lines.length;

  function next() {
    if (all) return;
    speakText(slide.lines[shown].en);
    setShown((n) => n + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <p className="text-center text-sm font-bold uppercase tracking-wide text-muted-foreground">{slide.title_en}</p>
      <div className="flex flex-col gap-2">
        {slide.lines.slice(0, shown).map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "max-w-[88%] rounded-2xl border-2 px-3.5 py-2.5",
              l.who === "b" ? "self-end rounded-br-sm border-green-200 bg-green-50" : "self-start rounded-bl-sm border-slate-200 bg-slate-50",
            )}
          >
            <p className="font-semibold text-neutral-800">{l.en}</p>
            <button onClick={() => speakText(l.en)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-600" aria-label="Listen">
              <Volume2 className="h-3.5 w-3.5" /> listen
            </button>
          </motion.div>
        ))}
      </div>
      {all ? (
        <Button variant="primary" className="w-full" onClick={() => onDone()}>Continue</Button>
      ) : (
        <Button variant="ghost" className="w-full" onClick={next}>Next line →</Button>
      )}
    </div>
  );
}
