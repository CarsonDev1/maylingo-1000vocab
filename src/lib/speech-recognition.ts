"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (not in every TS lib.dom target).
export interface SRAlternative {
  transcript: string;
}
export interface SREvent {
  results: ArrayLike<ArrayLike<SRAlternative>>;
}
export interface SRInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: (e: SREvent) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
export type SRConstructor = new () => SRInstance;

/** The browser's SpeechRecognition constructor, or null if unsupported. */
export function getSpeechRecognitionCtor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Join every final alternative in an event into one transcript string. */
function transcriptOf(e: SREvent): string {
  let out = "";
  for (let i = 0; i < e.results.length; i++) out += e.results[i]?.[0]?.transcript ?? "";
  return out.trim();
}

/**
 * React hook wrapping SpeechRecognition. `continuous` keeps listening until
 * stopped (for the speaking mode); otherwise it captures a single utterance.
 */
export function useSpeechRecognition({ continuous = false, lang = "en-US" } = {}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<SRInstance | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
    return () => recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => setTranscript(transcriptOf(e));
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [continuous, lang]);

  const stop = useCallback(() => recRef.current?.stop(), []);
  const reset = useCallback(() => setTranscript(""), []);

  return { supported, listening, transcript, start, stop, reset };
}
