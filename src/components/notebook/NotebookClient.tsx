"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { playAudio } from "@/lib/audio";
import type { WordWithProgress } from "@/types";
import { Search, Volume2 } from "lucide-react";
import { WordDetailSheet } from "@/components/word/WordDetailSheet";

const LEVELS = [
  { v: 0, label: "All" },
  { v: 1, label: "New" },
  { v: 2, label: "Learning" },
  { v: 3, label: "Familiar" },
  { v: 4, label: "Good" },
  { v: 5, label: "Mastered" },
];

const LEVEL_COLOR: Record<number, string> = {
  1: "bg-red-500/10 text-red-600",
  2: "bg-orange-500/10 text-orange-600",
  3: "bg-yellow-500/10 text-yellow-700",
  4: "bg-lime-500/10 text-lime-700",
  5: "bg-green-500/10 text-green-700",
};

export function NotebookClient({ words }: { words: WordWithProgress[] }) {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState(0);
  const [selected, setSelected] = useState<WordWithProgress | null>(null);

  const counts = useMemo(() => {
    const c: Record<number, number> = { 0: words.length, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const w of words) c[w.progress?.memory_level ?? 1]++;
    return c;
  }, [words]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return words.filter((w) => {
      if (level && (w.progress?.memory_level ?? 1) !== level) return false;
      if (!term) return true;
      return (
        w.term.toLowerCase().includes(term) ||
        (w.meaning_vi ?? "").toLowerCase().includes(term)
      );
    });
  }, [words, q, level]);

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground">{words.length} words learned</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search word or meaning..."
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {LEVELS.map((l) => (
          <Button
            key={l.v}
            size="sm"
            variant={level === l.v ? "secondary" : "default"}
            onClick={() => setLevel(l.v)}
          >
            {l.label} <span className="ml-1 opacity-70">({counts[l.v] ?? 0})</span>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No words found.</p>
      ) : (
        <ul className="divide-y rounded-xl border-2 bg-white">
          {filtered.map((w) => {
            const lvl = w.progress?.memory_level ?? 1;
            return (
              <li
                key={w.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(w)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(w);
                  }
                }}
                className="flex cursor-pointer items-center gap-3 p-3 transition hover:bg-slate-50"
              >
                {w.image_url ? (
                  <Image src={w.image_url} alt={w.term} width={48} height={48} className="h-12 w-12 rounded-lg object-cover" unoptimized />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-secondary" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{w.term}</span>
                    {w.phonetic_uk && <span className="text-xs text-muted-foreground">{w.phonetic_uk}</span>}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playAudio(w.audio_url);
                      }}
                      className="text-primary"
                      aria-label="Play audio"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{w.meaning_vi}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", LEVEL_COLOR[lvl])}>
                  Level {lvl}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <WordDetailSheet
        word={selected}
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      />
    </div>
  );
}
