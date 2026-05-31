"use client";

import { useMemo } from "react";
import { SessionRunner } from "@/components/session/SessionRunner";
import { buildLearnSteps } from "@/lib/exercises";
import type { Word } from "@/types";

export function LearnClient({ words, pool }: { words: Word[]; pool: Word[] }) {
  const steps = useMemo(() => buildLearnSteps(words, pool), [words, pool]);
  return <SessionRunner steps={steps} mode="learn" wordIds={words.map((w) => w.id)} />;
}
