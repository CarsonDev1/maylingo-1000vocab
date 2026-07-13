"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, Sparkles, ChevronRight, Loader2, AlertCircle, Mic, Square } from "lucide-react";
import { levelFromXp } from "@/lib/level";
import { LevelProgressBar } from "@/components/level/LevelProgressBar";
import { useSpeechRecognition } from "@/lib/speech-recognition";
import type { LessonWithStats } from "@/types";
import type { SimpleWord } from "@/lib/queries";

interface GradeResponse {
  fluencyScore: number;
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

type Step = "select" | "speak" | "result";

export default function SpeakingClient({ lessons, wordsByLesson, xpBefore }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");
  const [selectedLesson, setSelectedLesson] = useState<LessonWithStats | null>(null);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const { supported, listening, transcript, start, stop, reset } = useSpeechRecognition({ continuous: true });

  // Mic transcript fills the editable text area (user can tweak before submit).
  useEffect(() => {
    if (transcript) setText(transcript);
  }, [transcript]);

  const learnedLessons = lessons.filter((l) => l.learned_words > 0);
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const wordCountOk = wordCount >= 20 && wordCount <= 300;

  const handleSelectLesson = useCallback(
    (lesson: LessonWithStats) => {
      setSelectedLesson(lesson);
      setText("");
      reset();
      setError(null);
      setResult(null);
      setStep("speak");
    },
    [reset],
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedLesson || !wordCountOk) return;
    stop();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/speaking/grade", {
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
  }, [selectedLesson, text, wordCountOk, stop]);

  // ── Step: Select ────────────────────────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="flex flex-col gap-y-4">
        <div className="mb-2">
          <h2 className="text-xl font-bold text-neutral-700">Select a Topic</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a topic you&apos;ve studied and speak about it out loud.
          </p>
        </div>
        {learnedLessons.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              You haven&apos;t studied any words yet. Head to <strong>Learn</strong> to get started!
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-y-3">
            {learnedLessons.map((l) => {
              const pct = l.total_words ? Math.round((l.learned_words / l.total_words) * 100) : 0;
              return (
                <li key={l.id}>
                  <button
                    onClick={() => handleSelectLesson(l)}
                    className="group flex w-full items-center gap-4 rounded-2xl border-2 border-b-4 border-slate-200 bg-white p-3 text-left transition hover:border-green-300 hover:bg-slate-50 active:border-b-2"
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
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1">
                          <LevelProgressBar value={pct} fillClassName="from-emerald-400 to-green-500" glow="#22c55e" height={7} />
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{l.learned_words} words</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:text-green-500" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ── Step: Speak ───────────────────────────────────────────────────────────────
  if (step === "speak" && selectedLesson) {
    const countColor = wordCount < 20 ? "text-orange-500" : wordCount > 300 ? "text-red-500" : "text-green-600";
    return (
      <div className="flex flex-col gap-y-4">
        <div className="flex w-full items-center justify-between gap-3">
          <button
            onClick={() => setStep("select")}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="min-w-0 text-right">
            <h2 className="truncate font-bold text-neutral-700">{selectedLesson.title_en}</h2>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-700">
            Speak at least 20 words about <span className="font-extrabold">{selectedLesson.title_en}</span> using the vocabulary you&apos;ve learned.
            Tap the mic and speak naturally.
          </p>
        </div>

        {!supported ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-muted-foreground">
            Your browser doesn&apos;t support speech recognition — please use Chrome to practice speaking. (You can still type below.)
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => (listening ? stop() : start())}
              className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 ${
                listening ? "animate-pulse bg-rose-500" : "bg-green-500"
              }`}
              aria-label={listening ? "Stop" : "Speak"}
            >
              {listening ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
            </button>
          </div>
        )}

        <textarea
          className="min-h-[150px] w-full resize-none rounded-2xl border-2 border-slate-200 bg-white p-4 text-sm text-neutral-800 placeholder:text-slate-400 transition focus:border-green-400 focus:outline-none"
          placeholder="Your speech transcript will appear here — you can edit it before submitting..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isSubmitting}
        />
        <div className="px-1">
          <span className={`text-xs font-semibold ${countColor}`}>
            {wordCount} words {wordCount < 20 && wordCount > 0 && <span className="ml-1 font-normal text-orange-400">(minimum 20)</span>}
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!wordCountOk || isSubmitting}
          className="flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-6 py-3.5 font-bold text-white shadow-md transition hover:bg-green-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Grading...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" /> Submit
            </>
          )}
        </button>
      </div>
    );
  }

  // ── Step: Result ────────────────────────────────────────────────────────────
  if (step === "result" && result && selectedLesson) {
    const xpAfter = xpBefore + result.xpEarned;
    const levelAfter = levelFromXp(xpAfter);
    const leveledUp = levelAfter.level > levelFromXp(xpBefore).level;
    const scoreColor = result.fluencyScore >= 80 ? "text-green-600" : result.fluencyScore >= 60 ? "text-orange-500" : "text-red-500";
    const scoreBg = result.fluencyScore >= 80 ? "bg-green-50 border-green-200" : result.fluencyScore >= 60 ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200";
    const allVocab = (wordsByLesson[selectedLesson.id] ?? []).map((w) => w.term);
    const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");
    const usedSet = new Set(result.wordsUsed.map(norm));

    return (
      <div className="flex flex-col gap-y-5">
        <div className="flex w-full items-center justify-between gap-3">
          <button
            onClick={() => setStep("speak")}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="text-right">
            <div className="text-2xl">{result.fluencyScore >= 80 ? "🎉" : result.fluencyScore >= 60 ? "👍" : "💪"}</div>
            <h2 className="text-lg font-extrabold text-neutral-700">Speaking Results</h2>
            <p className="text-xs text-muted-foreground">{selectedLesson.title_en}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl border-2 p-4 text-center ${scoreBg}`}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fluency</p>
            <p className={`text-3xl font-extrabold ${scoreColor}`}>{result.fluencyScore}</p>
            <p className="text-xs text-muted-foreground">/100</p>
          </div>
          <div className="rounded-2xl border-2 border-yellow-200 bg-yellow-50 p-4 text-center">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">XP Earned</p>
            <p className="flex items-center justify-center gap-1 text-3xl font-extrabold text-yellow-600">
              <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" /> +{result.xpEarned}
            </p>
            {leveledUp && <p className="mt-1 text-xs font-bold text-purple-600">🎊 Level up {levelAfter.level}!</p>}
          </div>
        </div>

        {allVocab.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-bold text-neutral-700">
              Vocab used: {result.wordsUsed.length}/{allVocab.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allVocab.map((term) => {
                const used = usedSet.has(norm(term));
                return (
                  <span
                    key={term}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      used ? "border-green-300 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-400"
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

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">What you said</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{text}</p>
        </div>

        <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-4">
          <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-blue-700">
            <Sparkles className="h-3.5 w-3.5" /> AI Feedback
          </p>
          <p className="text-sm leading-relaxed text-blue-800">{result.feedback}</p>
          {result.grammarNotes && (
            <div className="mt-2 border-t border-blue-200 pt-2">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-orange-600">Grammar tips</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-orange-700">{result.grammarNotes}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setText("");
              reset();
              setResult(null);
              setError(null);
              setStep("select");
            }}
            className="flex-1 rounded-2xl border-2 border-b-4 border-slate-200 bg-white py-3 font-bold text-slate-600 transition hover:bg-slate-50 active:border-b-2"
          >
            Speak More
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
