"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttributeTopicSlide, Word } from "@/types";

export function AttributeSlide({ slide, words, onDone }: { slide: AttributeTopicSlide; words: Word[]; onDone: (score?: number) => void }) {
  const w = slide.word_id != null ? words.find((x) => x.id === slide.word_id) : undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const revealed = picked !== null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
      {w?.image_url && <Image src={w.image_url} alt="" width={140} height={110} unoptimized className="h-28 w-auto rounded-2xl object-contain" />}
      <p className="text-center text-lg font-semibold text-neutral-800">{slide.prompt_en}</p>
      <p className="text-center text-sm text-muted-foreground">{slide.prompt_vi}</p>
      <div className="grid w-full gap-3">
        {slide.options.map((opt, i) => (
          <button
            key={i}
            disabled={revealed}
            onClick={() => setPicked(i)}
            className={cn(
              "flex items-center justify-between rounded-xl border-2 border-b-4 px-4 py-3 text-left font-semibold text-neutral-700 transition",
              !revealed && "hover:bg-slate-50 active:border-b-2",
              revealed && opt.correct && "border-green-500 bg-green-500/10 text-green-700",
              revealed && !opt.correct && picked === i && "border-rose-500 bg-rose-500/10 text-rose-600",
              revealed && !opt.correct && picked !== i && "opacity-60",
            )}
          >
            <span>{opt.label}</span>
            {revealed && opt.correct && <Check className="h-5 w-5 text-green-600" />}
            {revealed && !opt.correct && picked === i && <X className="h-5 w-5 text-rose-500" />}
          </button>
        ))}
      </div>
      {revealed && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
          {slide.explain_vi && <p className="mb-3 rounded-xl bg-amber-500/10 p-3 text-sm text-neutral-800">{slide.explain_vi}</p>}
          <Button variant="primary" className="w-full" onClick={() => onDone()}>Tiếp tục</Button>
        </motion.div>
      )}
    </div>
  );
}
