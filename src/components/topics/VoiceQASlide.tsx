"use client";

import { useEffect, useState } from "react";
import { Volume2, Mic, Square, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speakText, isTtsSupported } from "@/lib/tts";
import { useSpeechRecognition } from "@/lib/speech-recognition";
import { cn } from "@/lib/utils";
import type { VoiceQaSlide } from "@/types";

interface Grade {
  score: number;
  feedbackVi: string;
  covered: string[];
}

export function VoiceQASlide({ slide, dayNo, onDone }: { slide: VoiceQaSlide; dayNo: number; onDone: (score: number) => void }) {
  const { supported, listening, transcript, start, stop, reset } = useSpeechRecognition({ continuous: true });
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);

  // Read the question aloud once on mount.
  useEffect(() => {
    speakText(slide.question_en);
  }, [slide.question_en]);

  // Mic transcript fills the editable answer box.
  useEffect(() => {
    if (transcript) setText(transcript);
  }, [transcript]);

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
      if (res.ok) setGrade({ score: data.score, feedbackVi: data.feedbackVi, covered: data.covered ?? [] });
      else setGrade({ score: 60, feedbackVi: "Đã ghi nhận câu trả lời của bạn.", covered: [] });
    } catch {
      setGrade({ score: 60, feedbackVi: "Không chấm được ngay bây giờ, nhưng câu trả lời đã được ghi nhận.", covered: [] });
    } finally {
      setSubmitting(false);
    }
  }

  if (grade) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="text-center">
          <p className="text-4xl font-extrabold text-green-600">{grade.score}<span className="text-lg text-muted-foreground">/100</span></p>
        </div>
        {slide.key_points.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {slide.key_points.map((k) => {
              const hit = grade.covered.some((c) => c.toLowerCase() === k.toLowerCase());
              return (
                <span key={k} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", hit ? "border-green-300 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-400")}>
                  {hit && <span className="mr-1">✓</span>}{k}
                </span>
              );
            })}
          </div>
        )}
        <div className="rounded-xl border-2 border-sky-100 bg-sky-50 p-3">
          <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-sky-700"><Sparkles className="h-3.5 w-3.5" /> Nhận xét</p>
          <p className="text-sm leading-relaxed text-sky-900">{grade.feedbackVi}</p>
        </div>
        {slide.sample_answer_en && (
          <details className="rounded-xl border-2 bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-neutral-700">Câu trả lời mẫu</summary>
            <p className="mt-2 italic text-neutral-700">{slide.sample_answer_en}</p>
          </details>
        )}
        <Button variant="primary" className="w-full" onClick={() => onDone(grade.score)}>Tiếp tục</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-sky-600">AI hỏi bạn</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <p className="text-lg font-semibold text-neutral-800">{slide.question_en}</p>
          {isTtsSupported() && (
            <button onClick={() => speakText(slide.question_en)} className="shrink-0 text-sky-500" aria-label="Đọc lại">
              <Volume2 className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{slide.question_vi}</p>
      </div>

      {supported && (
        <div className="flex justify-center">
          <button
            onClick={() => (listening ? stop() : (reset(), setText(""), start()))}
            className={cn("flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105", listening ? "animate-pulse bg-rose-500" : "bg-green-500")}
            aria-label={listening ? "Dừng" : "Nói"}
          >
            {listening ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
          </button>
        </div>
      )}

      <textarea
        className="min-h-[110px] w-full resize-none rounded-2xl border-2 border-slate-200 bg-white p-3 text-sm text-neutral-800 placeholder:text-slate-400 focus:border-green-400 focus:outline-none"
        placeholder={supported ? "Câu trả lời của bạn sẽ hiện ở đây — có thể chỉnh trước khi gửi…" : "Gõ câu trả lời của bạn…"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitting}
      />

      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={() => onDone(0)}>Bỏ qua</Button>
        <Button variant="primary" className="flex-1" disabled={!text.trim() || submitting} onClick={submit}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gửi"}
        </Button>
      </div>
    </div>
  );
}
