"use client";

import { useEffect, useState } from "react";
import { Volume2, Snail, BookOpen } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { PronunciationTrainer } from "@/components/word/PronunciationTrainer";
import { playAudio } from "@/lib/audio";
import type { Word, WordDetail } from "@/types";

type FetchState =
  | { status: "loading" }
  | { status: "done"; detail: WordDetail | null };

/**
 * Shared "Hiểu sâu" (deep understanding, B1) bottom sheet. Renders the word
 * header immediately from `word`, and lazy-fetches the AI-generated detail when
 * opened. Works even when no detail exists yet (empty state).
 */
export function WordDetailSheet({
  word,
  open,
  onOpenChange,
}: {
  word: Word | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const wordId = word?.id ?? null;

  useEffect(() => {
    if (!open || wordId == null) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/word/${wordId}/detail`)
      .then((r) => (r.ok ? r.json() : { detail: null }))
      .then((d) => {
        if (!cancelled) setState({ status: "done", detail: (d?.detail as WordDetail | null) ?? null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "done", detail: null });
      });
    return () => {
      cancelled = true;
    };
  }, [open, wordId]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        <div className="max-h-[82vh] overflow-y-auto px-5 pb-8 pt-2">
          {word && (
            <>
              {/* Header — always available from the passed word */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DrawerTitle className="text-2xl font-bold text-neutral-800">{word.term}</DrawerTitle>
                  {word.phonetic_uk && (
                    <p className="text-sm text-muted-foreground">/{word.phonetic_uk}/</p>
                  )}
                  <p className="mt-1 font-semibold text-neutral-700">
                    {word.meaning_vi}
                    {word.pos ? ` (${word.pos})` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => playAudio(word.audio_url)}
                    aria-label="Play audio"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 transition hover:scale-105"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => playAudio(word.audio_url, 0.55)}
                    aria-label="Play slowly"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 transition hover:scale-105"
                  >
                    <Snail className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <DrawerDescription className="sr-only">Deep understanding for {word.term}</DrawerDescription>

              {/* Luyện phát âm (B2) */}
              <div className="mt-4">
                <PronunciationTrainer term={word.term} audioUrl={word.audio_url} />
              </div>

              {/* Hiểu sâu */}
              <div className="mt-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-green-600">
                <BookOpen className="h-4 w-4" /> Hiểu sâu
              </div>

              <div className="mt-3">
                {state.status === "loading" ? (
                  <DetailSkeleton />
                ) : (
                  <DetailBody detail={state.detail} exampleEn={word.example_en} />
                )}
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function hasContent(detail: WordDetail | null): boolean {
  return !!detail && (!!detail.definition_en || !!detail.nuance_vi || detail.usage_contexts.length > 0);
}

function DetailBody({ detail, exampleEn }: { detail: WordDetail | null; exampleEn: string | null }) {
  if (!hasContent(detail)) {
    return (
      <div className="rounded-xl border-2 border-dashed p-5 text-center text-sm text-muted-foreground">
        Đang cập nhật phần hiểu sâu cho từ này…
      </div>
    );
  }
  const d = detail!;
  return (
    <div className="space-y-5">
      {d.definition_en && (
        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Definition</h4>
          <p className="text-neutral-800">{d.definition_en}</p>
        </section>
      )}

      {d.usage_contexts.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Ngữ cảnh người bản xứ hay dùng
          </h4>
          <ul className="space-y-3">
            {d.usage_contexts.map((c, i) => (
              <li key={i} className="rounded-xl border-2 bg-slate-50 p-3">
                <p className="text-sm font-medium text-neutral-700">{c.context_vi}</p>
                <p className="mt-1 italic text-neutral-800">“{c.example_en}”</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.nuance_vi && (
        <section className="rounded-xl bg-amber-500/10 p-3">
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">Sắc thái</h4>
          <p className="text-neutral-800">{d.nuance_vi}</p>
        </section>
      )}

      {exampleEn && d.usage_contexts.length === 0 && (
        <p className="text-sm text-neutral-600">{exampleEn}</p>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}
