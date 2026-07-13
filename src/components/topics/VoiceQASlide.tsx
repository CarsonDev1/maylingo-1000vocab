"use client";

import { useEffect, useState } from "react";
import { Volume2, Mic, Square, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideEyebrow, SlideHeading } from "@/components/topics/slide-ui";
import { speakText, isTtsSupported } from "@/lib/tts";
import { useSpeechRecognition } from "@/lib/speech-recognition";
import { cn } from "@/lib/utils";
import type { VoiceQaTopicSlide } from "@/types";

interface Grade { score: number; feedback: string; covered: string[] }

function band(score: number): string {
  if (score >= 80) return "Great! 👏";
  if (score >= 60) return "Nice work 👍";
  return "Keep going 💪";
}

export function VoiceQASlide({ slide, dayNo, onScore }: { slide: VoiceQaTopicSlide; dayNo: number; onScore: (score: number) => void }) {
  const { supported, listening, transcript, start, stop, reset } = useSpeechRecognition({ continuous: true });
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);

  useEffect(() => {
    speakText(slide.question_en);
    return () => { if (isTtsSupported()) window.speechSynthesis.cancel(); };
  }, [slide.question_en]);

  useEffect(() => { if (transcript) setText(transcript); }, [transcript]);

  async function submit() {
    const answer = text.trim();
    if (!answer || submitting) return;
    stop();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/topics/${dayNo}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionEn: slide.question_en, keyPoints: slide.key_points, answer }),
      });
      const data = await res.json();
      const g: Grade = res.ok
        ? { score: data.score, feedback: data.feedback, covered: data.covered ?? [] }
        : { score: 60, feedback: "Your answer has been recorded.", covered: [] };
      setGrade(g);
      onScore(g.score);
    } catch {
      const g = { score: 60, feedback: "Couldn't grade this right now, but your answer has been recorded.", covered: [] };
      setGrade(g);
      onScore(g.score);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow accent="violet">Speak with AI</SlideEyebrow>
      <SlideHeading>Answer out loud</SlideHeading>

      <div className="mt-4 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-400 text-xl">🤖</div>
        <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-neutral-800/70 p-3">
          <p className="font-semibold text-white">{slide.question_en}</p>
          {isTtsSupported() && (
            <button onClick={() => speakText(slide.question_en)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-300" aria-label="Replay">
              <Volume2 className="h-3.5 w-3.5" /> Hear it again
            </button>
          )}
        </div>
      </div>

      {!grade ? (
        <div className="mt-4 flex flex-col gap-3">
          {supported && (
            <div className="flex justify-center">
              <button
                onClick={() => (listening ? stop() : (reset(), setText(""), start()))}
                className={cn("grid h-16 w-16 place-items-center rounded-full text-white shadow-lg transition hover:scale-105", listening ? "animate-pulse bg-rose-500" : "bg-green-500")}
                aria-label={listening ? "Stop" : "Speak"}
              >
                {listening ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
              </button>
            </div>
          )}
          <textarea
            className="min-h-[96px] w-full resize-none rounded-2xl border border-white/10 bg-neutral-800/70 p-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-green-400 focus:outline-none"
            placeholder={supported ? "Your answer will appear here — you can edit it before submitting…" : "Type your answer…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitting}
          />
          <Button variant="primary" className="w-full" disabled={!text.trim() || submitting} onClick={submit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit answer"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
              style={{ background: `conic-gradient(#22c55e ${Math.round(grade.score * 3.6)}deg, rgba(255,255,255,0.12) 0)` }}
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-900 text-lg font-extrabold text-green-400 tabular-nums">{grade.score}</span>
            </div>
            <p className="text-lg font-extrabold text-white">{band(grade.score)}</p>
          </div>
          {slide.key_points.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {slide.key_points.map((k) => {
                const hit = grade.covered.some((c) => c.toLowerCase() === k.toLowerCase());
                return (
                  <span key={k} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", hit ? "border-green-500/40 bg-green-500/15 text-green-300" : "border-white/10 bg-neutral-800 text-neutral-500")}>
                    {hit && <span className="mr-1">✓</span>}{k}
                  </span>
                );
              })}
            </div>
          )}
          <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-violet-300"><Sparkles className="h-3.5 w-3.5" /> Feedback</p>
            <p className="text-sm leading-relaxed text-violet-50">{grade.feedback}</p>
          </div>
          {slide.sample_answer_en && (
            <details className="rounded-2xl border border-white/10 bg-neutral-800/70 p-3 text-sm">
              <summary className="cursor-pointer font-semibold text-neutral-200">Sample answer</summary>
              <p className="mt-2 italic text-neutral-300">{slide.sample_answer_en}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
