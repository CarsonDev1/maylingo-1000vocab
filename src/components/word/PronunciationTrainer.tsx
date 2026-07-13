"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Volume2, Check, X, Loader2 } from "lucide-react";
import { playAudio } from "@/lib/audio";
import { scorePronunciation, type PronunciationScore } from "@/lib/pronunciation";
import { getSpeechRecognitionCtor, type SRInstance } from "@/lib/speech-recognition";
import { cn } from "@/lib/utils";

const REP_GOAL = 5;

/**
 * "Luyện phát âm" (B2) — say the word out loud, transcribed and scored by the
 * browser's Web Speech API. Encourages repeating to a rep goal (the method's
 * "đọc to 5–10 lần"). Degrades gracefully where speech recognition is missing.
 */
export function PronunciationTrainer({
  term,
  audioUrl,
  onComplete,
}: {
  term: string;
  audioUrl: string | null;
  onComplete?: () => void;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<PronunciationScore | null>(null);
  const [reps, setReps] = useState(0);
  const recRef = useRef<SRInstance | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
    return () => recRef.current?.stop();
  }, []);

  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (reps >= REP_GOAL && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps]);

  function listen() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || listening) return;
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? "";
      const score = scorePronunciation(transcript, term);
      setResult(score);
      if (score.matched) setReps((r) => Math.min(REP_GOAL, r + 1));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setResult(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  if (!supported) {
    return (
      <div className="rounded-xl border-2 border-dashed p-3 text-center text-sm text-muted-foreground">
        Your browser doesn&apos;t support speech recognition — please use Chrome to practice pronunciation.
      </div>
    );
  }

  const done = reps >= REP_GOAL;

  return (
    <div className="rounded-xl border-2 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-700">Say this word aloud 5 times</p>
        <div className="flex items-center gap-1">
          {Array.from({ length: REP_GOAL }, (_, i) => (
            <span
              key={i}
              className={cn("h-2 w-2 rounded-full", i < reps ? "bg-green-500" : "bg-slate-300")}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          onClick={() => playAudio(audioUrl)}
          aria-label="Play reference"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-orange-500 shadow transition hover:scale-105"
        >
          <Volume2 className="h-5 w-5" />
        </button>
        <button
          onClick={listen}
          disabled={listening}
          aria-label="Speak"
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105",
            listening ? "animate-pulse bg-rose-500" : "bg-green-500",
          )}
        >
          {listening ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
        </button>
      </div>

      {result && (
        <div
          className={cn(
            "mt-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
            result.matched ? "bg-green-500/10 text-green-700" : "bg-rose-500/10 text-rose-600",
          )}
        >
          {result.matched ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          <span>
            Heard: “{result.heard || "…"}” · {Math.round(result.score * 100)}%
          </span>
        </div>
      )}

      {done && <p className="mt-2 text-center text-sm font-bold text-green-600">Great! You&apos;ve said it 5 times 🎉</p>}
    </div>
  );
}
