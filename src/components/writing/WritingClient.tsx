"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Star, Sparkles, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { levelFromXp } from "@/lib/level";
import { LevelProgressBar } from "@/components/level/LevelProgressBar";
import type { LessonWithStats } from "@/types";
import type { SimpleWord } from "@/lib/queries";

interface GradeResponse {
  grammarScore: number;
  wordsUsed: string[];
  totalVocab: number;
  feedback: string;
  grammarNotes: string;
  xpEarned: number;
  error?: string;
}

interface Props {
  lessons: LessonWithStats[];
  wordsByLesson: Record<number, SimpleWord[]>;
  xpBefore: number;
}

type Step = "select" | "write" | "result";

export default function WritingClient({ lessons, wordsByLesson, xpBefore }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");
  const [selectedLesson, setSelectedLesson] = useState<LessonWithStats | null>(null);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResponse | null>(null);

  const learnedLessons = lessons.filter((l) => l.learned_words > 0);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const wordCountOk = wordCount >= 50 && wordCount <= 200;

  const handleSelectLesson = useCallback((lesson: LessonWithStats) => {
    setSelectedLesson(lesson);
    setText("");
    setError(null);
    setResult(null);
    setStep("write");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedLesson || !wordCountOk) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/writing/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: selectedLesson.id, text }),
      });
      const data: GradeResponse = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult(data);
      setStep("result");
    } catch {
      setError("Could not connect. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedLesson, text, wordCountOk]);

  const handleWriteAnother = useCallback(() => {
    setText("");
    setResult(null);
    setError(null);
    setStep("select");
  }, []);

  // ── Step: Select lesson ────────────────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="flex flex-col gap-y-4">
        <div className="mb-2">
          <h2 className="text-xl font-bold text-neutral-700">Select a Topic</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a topic you&apos;ve already studied to practice writing a short paragraph.
          </p>
        </div>

        {learnedLessons.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center">
            <p className="text-muted-foreground text-sm">
              You haven&apos;t studied any words yet. Head to <strong>Learn</strong> to get started!
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-y-3">
            {learnedLessons.map((l) => {
              const words = wordsByLesson[l.id] ?? [];
              const pct = l.total_words ? Math.round((l.learned_words / l.total_words) * 100) : 0;
              return (
                <li key={l.id}>
                  <button
                    onClick={() => handleSelectLesson(l)}
                    className="group w-full flex items-center gap-4 rounded-2xl border-2 border-b-4 border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 hover:border-green-300 active:border-b-2"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-4 ring-green-500/30">
                      {l.image ? (
                        <Image src={l.image} alt={l.title_en ?? ""} fill className="object-cover" unoptimized sizes="56px" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-green-500/15 text-base font-bold text-green-600">
                          {l.sort}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-neutral-700">{l.title_en}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.title_vi}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1">
                          <LevelProgressBar value={pct} fillClassName="from-emerald-400 to-green-500" glow="#22c55e" height={7} />
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                          {l.learned_words} words
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {words.length > 0 && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600">
                          {words.length} words
                        </span>
                      )}
                      <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:text-green-500" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ── Step: Write ────────────────────────────────────────────────────────────
  if (step === "write" && selectedLesson) {
    const wordCountColor =
      wordCount < 50 ? "text-orange-500" : wordCount > 200 ? "text-red-500" : "text-green-600";

    return (
      <div className="flex flex-col gap-y-4">
        <div className="flex w-full items-center justify-between gap-3">
          <button
            onClick={() => setStep("select")}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="min-w-0 text-right">
            <h2 className="truncate font-bold text-neutral-700">{selectedLesson.title_en}</h2>
            <p className="truncate text-xs text-muted-foreground">{selectedLesson.title_vi}</p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-700">
            Write a short paragraph (50–200 words) about <span className="font-extrabold">{selectedLesson.title_en}</span> using vocabulary you&apos;ve learned from this topic.
          </p>
        </div>

        <div className="flex flex-col gap-y-2">
          <textarea
            className="w-full min-h-[180px] rounded-2xl border-2 border-slate-200 bg-white p-4 text-sm text-neutral-800 placeholder:text-slate-400 focus:outline-none focus:border-green-400 resize-none transition"
            placeholder="Start writing your English paragraph here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isSubmitting}
          />
          <div className="flex items-center justify-between px-1">
            <span className={`text-xs font-semibold ${wordCountColor}`}>
              {wordCount} / 200 words
              {wordCount < 50 && wordCount > 0 && (
                <span className="text-orange-400 font-normal ml-1">(minimum 50 words)</span>
              )}
            </span>
            {wordCount >= 50 && wordCount <= 200 && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Valid length
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!wordCountOk || isSubmitting}
          className="flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-6 py-3.5 font-bold text-white shadow-md transition hover:bg-green-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Grading...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Submit
            </>
          )}
        </button>
      </div>
    );
  }

  // ── Step: Result ───────────────────────────────────────────────────────────
  if (step === "result" && result && selectedLesson) {
    const xpAfter = xpBefore + result.xpEarned;
    const levelBefore = levelFromXp(xpBefore);
    const levelAfter = levelFromXp(xpAfter);
    const leveledUp = levelAfter.level > levelBefore.level;

    const scoreColor =
      result.grammarScore >= 80
        ? "text-green-600"
        : result.grammarScore >= 60
        ? "text-orange-500"
        : "text-red-500";
    const scoreBg =
      result.grammarScore >= 80
        ? "bg-green-50 border-green-200"
        : result.grammarScore >= 60
        ? "bg-orange-50 border-orange-200"
        : "bg-red-50 border-red-200";

    const allVocab = (wordsByLesson[selectedLesson.id] ?? []).map((w) => w.term);
    const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");
    const usedSet = new Set(result.wordsUsed.map(norm));

    return (
      <div className="flex flex-col gap-y-5">
        {/* Header with back button */}
        <div className="flex w-full items-center justify-between gap-3">
          <button
            onClick={() => setStep("write")}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="text-right">
            <div className="text-2xl">{result.grammarScore >= 80 ? "🎉" : result.grammarScore >= 60 ? "👍" : "💪"}</div>
            <h2 className="text-lg font-extrabold text-neutral-700">Writing Results</h2>
            <p className="text-xs text-muted-foreground">{selectedLesson.title_en}</p>
          </div>
        </div>

        {/* Score + XP row */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl border-2 p-4 text-center ${scoreBg}`}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Grammar</p>
            <p className={`text-3xl font-extrabold ${scoreColor}`}>{result.grammarScore}</p>
            <p className="text-xs text-muted-foreground">/100</p>
          </div>
          <div className="rounded-2xl border-2 border-yellow-200 bg-yellow-50 p-4 text-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">XP Earned</p>
            <p className="text-3xl font-extrabold text-yellow-600 flex items-center justify-center gap-1">
              <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
              +{result.xpEarned}
            </p>
            {leveledUp && (
              <p className="text-xs font-bold text-purple-600 mt-1">🎊 Level up {levelAfter.level}!</p>
            )}
          </div>
        </div>

        {/* XP progress bar */}
        <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">Level {levelAfter.level}</span>
            <span className="text-xs text-muted-foreground">{levelAfter.xpToNext} XP to next level</span>
          </div>
          <LevelProgressBar value={levelAfter.progressPct} fillClassName="from-yellow-300 to-amber-500" glow="#f59e0b" height={10} />
        </div>

        {/* Vocab used */}
        {allVocab.length > 0 && (
          <div>
            <p className="text-sm font-bold text-neutral-700 mb-2">
              Vocab used: {result.wordsUsed.length}/{allVocab.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allVocab.map((term) => {
                const used = usedSet.has(norm(term));
                return (
                  <span
                    key={term}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      used
                        ? "border-green-300 bg-green-50 text-green-700"
                        : "border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    {used && <span className="mr-1">✓</span>}
                    {term}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Original paragraph */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Your paragraph</p>
          <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>

        {/* AI Feedback — content stays in Vietnamese */}
        <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> AI Feedback
          </p>
          <p className="text-sm text-blue-800 leading-relaxed">{result.feedback}</p>
          {result.grammarNotes && (
            <div className="mt-2 border-t border-blue-200 pt-2">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-1">Grammar tips</p>
              <p className="text-sm text-orange-700 leading-relaxed whitespace-pre-line">{result.grammarNotes}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleWriteAnother}
            className="flex-1 rounded-2xl border-2 border-b-4 border-slate-200 bg-white py-3 font-bold text-slate-600 transition hover:bg-slate-50 active:border-b-2"
          >
            Write More
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 rounded-2xl border-b-4 border-green-600 bg-green-500 py-3 font-bold text-white shadow-sm transition hover:bg-green-600 active:border-b-2"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return null;
}
