"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { WordDetail } from "@/types";

function hasContent(detail: WordDetail | null): boolean {
  return (
    !!detail &&
    (!!detail.definition_en ||
      !!detail.nuance_vi ||
      detail.usage_contexts.length > 0 ||
      detail.collocations.length > 0)
  );
}

/**
 * Shared "Hiểu sâu" (B1/B4) content renderer — the single source of truth for
 * how deep-understanding content looks. Used by both the learn flashcard step
 * (on a dark session background, wrapped in a light card by the caller) and the
 * Notebook's WordDetailSheet (on a light background).
 */
export function WordDeepContent({
  detail,
  exampleEn,
}: {
  detail: WordDetail | null;
  exampleEn: string | null;
}) {
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

      {d.collocations.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Cụm từ / idiom hay đi kèm
          </h4>
          <ul className="space-y-2">
            {d.collocations.map((c, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 rounded-xl border-2 bg-slate-50 px-3 py-2">
                <span className="font-semibold text-neutral-800">{c.phrase_en}</span>
                <span className="text-sm text-muted-foreground">— {c.meaning_vi}</span>
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

export function WordDeepContentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}
