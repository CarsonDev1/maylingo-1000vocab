"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, PenLine } from "lucide-react";
import { validateExampleText, MAX_WORDS } from "@/lib/word-example";
import type { UserWordExample } from "@/types";

/**
 * "Ví dụ của bạn" (B3) — the learner writes their own example sentence for the
 * word (ideally tied to personal experience) and gets short AI feedback.
 * Emotion + personal context is what moves a word into long-term memory.
 */
export function PersonalExamples({ wordId, term }: { wordId: number; term: string }) {
  const [examples, setExamples] = useState<UserWordExample[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setExamples([]);
    fetch(`/api/word/${wordId}/example`)
      .then((r) => (r.ok ? r.json() : { examples: [] }))
      .then((d) => {
        if (!cancelled) setExamples((d?.examples as UserWordExample[]) ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wordId]);

  const v = validateExampleText(text);

  async function submit() {
    if (!v.ok || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/word/${wordId}/example`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra, thử lại nhé.");
        return;
      }
      setExamples((prev) => [data.example as UserWordExample, ...prev]);
      setText("");
    } catch {
      setError("Không kết nối được. Kiểm tra mạng và thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-sky-600">
        <PenLine className="h-4 w-4" /> Ví dụ của bạn
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Viết một câu dùng từ <span className="font-semibold">{term}</span> gắn với trải nghiệm của bạn — càng cá
        nhân càng dễ nhớ.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitting}
        placeholder={`Ví dụ với "${term}"...`}
        className="min-h-[72px] w-full resize-none rounded-xl border-2 border-slate-200 bg-white p-3 text-sm text-neutral-800 placeholder:text-slate-400 focus:border-green-400 focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {v.wordCount}/{MAX_WORDS} từ
        </span>
        <button
          onClick={submit}
          disabled={!v.ok || submitting}
          className="flex items-center gap-1.5 rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-600 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gửi
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}

      {examples.length > 0 && (
        <ul className="mt-3 space-y-2">
          {examples.map((ex) => (
            <li key={ex.id} className="rounded-xl border-2 bg-slate-50 p-3">
              <p className="text-sm text-neutral-800">{ex.text}</p>
              {ex.feedback && (
                <p className="mt-1.5 flex gap-1.5 text-xs text-sky-700">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{ex.feedback}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
