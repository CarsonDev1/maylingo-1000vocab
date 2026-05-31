"use client";

import { useMemo } from "react";
import { SessionRunner } from "@/components/session/SessionRunner";
import { buildReviewSteps } from "@/lib/exercises";
import type { WordWithProgress, Word } from "@/types";

export function ReviewClient({ words, pool }: { words: WordWithProgress[]; pool: Word[] }) {
  const { steps, ids } = useMemo(() => {
    const profByWord = new Map<number, number>();
    for (const w of words) profByWord.set(w.id, w.progress?.proficiency ?? 1);
    const plain = words as unknown as Word[];
    return { steps: buildReviewSteps(plain, pool, profByWord), ids: words.map((w) => w.id) };
  }, [words, pool]);

  return <SessionRunner steps={steps} mode="review" wordIds={ids} />;
}
