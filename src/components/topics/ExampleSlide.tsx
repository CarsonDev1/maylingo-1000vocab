"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speakText } from "@/lib/tts";
import type { ExampleTopicSlide, Word } from "@/types";

export function ExampleSlide({ slide, words, onDone }: { slide: ExampleTopicSlide; words: Word[]; onDone: (score?: number) => void }) {
  const w = words.find((x) => x.id === slide.word_id);
  if (!w) return <div className="text-center"><Button variant="primary" onClick={() => onDone()}>Tiếp tục</Button></div>;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        {w.image_url ? (
          <Image src={w.image_url} alt="" width={220} height={170} unoptimized className="h-44 w-auto rounded-2xl object-contain" />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-slate-100 text-5xl">💬</div>
        )}
      </motion.div>
      <div>
        <button onClick={() => speakText(w.term)} className="inline-flex items-center gap-2 text-xl font-extrabold text-neutral-800" aria-label={`Nghe ${w.term}`}>
          {w.term} <Volume2 className="h-4 w-4 text-green-600" />
        </button>
        {w.meaning_vi && <p className="text-sm text-muted-foreground">{w.meaning_vi}</p>}
      </div>
      {w.example_en && (
        <button onClick={() => speakText(w.example_en!)} className="rounded-xl border-2 bg-slate-50 p-3 text-left" aria-label="Nghe câu ví dụ">
          <p className="italic text-neutral-800">“{w.example_en}”</p>
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-600"><Volume2 className="h-3.5 w-3.5" /> Nghe câu</span>
        </button>
      )}
      <Button variant="primary" className="w-full" onClick={() => onDone()}>Tiếp tục</Button>
    </div>
  );
}
