"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { playAudio } from "@/lib/audio";
import type { ExerciseStep, ExerciseOption, Word } from "@/types";
import { createPortal } from "react-dom";
import { Volume2, Check, X, Snail } from "lucide-react";

const PROMPT: Record<string, string> = {
  choose_meaning: "Chọn nghĩa đúng",
  choose_word: "Chọn từ đúng với nghĩa",
  choose_reading: "Chọn phiên âm đúng",
  choose_image: "Chọn hình đúng",
  fill_gap_choose: "Điền từ vào chỗ trống",
  listen_choose: "Nghe và chọn từ đúng",
  underlined_meaning: "Chọn nghĩa của từ được gạch chân",
  fill_gap_type: "Gõ từ còn thiếu",
  listen_write: "Nghe và gõ lại từ",
  spell: "Điền từ",
  flashcard: "Từ mới",
};

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[.,!?;:'"]/g, "").replace(/\s+/g, " ");
}

function Sentence({
  text,
  term,
  mode,
  highlightClassName,
}: {
  text: string;
  term: string;
  mode: "blank" | "underline";
  highlightClassName?: string;
}) {
  const re = new RegExp(`\\b${escapeRe(term)}\\w*\\b`, "i");
  const m = text.match(re);
  if (!m) return <span>{text}</span>;
  const start = m.index ?? 0;
  return (
    <span>
      {text.slice(0, start)}
      {mode === "blank" ? (
        <span className="mx-1 inline-block min-w-[64px] border-b-2 border-dashed border-green-500 align-middle" />
      ) : (
        <span className={highlightClassName ?? "font-bold text-green-600 underline decoration-2 underline-offset-4"}>
          {m[0]}
        </span>
      )}
      {text.slice(start + m[0].length)}
    </span>
  );
}

export interface ExerciseViewProps {
  step: ExerciseStep;
  onNext: (correct: boolean | null) => void;
  index: number;
  total: number;
}

export function ExerciseView({ step, onNext, index, total }: ExerciseViewProps) {
  const { type, word, options } = step;
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPicked(null);
    setTyped("");
    setRevealed(false);
    setFlipped(false);
    setResult(null);
    if (type === "listen_choose" || type === "listen_write" || type === "flashcard") {
      const t = setTimeout(() => playAudio(word.audio_url), 300);
      return () => clearTimeout(t);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTyped = type === "fill_gap_type" || type === "listen_write" || type === "spell";
  const isSpell = type === "spell";
  const isImage = type === "choose_image";

  function grade(correct: boolean) {
    setResult(correct);
    playAudio(correct ? "/correct.mp3" : "/incorrect.mp3");
    if (correct) setTimeout(() => playAudio(word.audio_url), 350);
  }

  function choose(i: number, opt: ExerciseOption) {
    if (result !== null) return;
    setPicked(i);
    grade(opt.correct);
  }

  function checkTyped() {
    if (result !== null) return;
    const ok = normalize(typed) === normalize(word.term);
    setRevealed(true);
    grade(ok);
  }

  if (type === "flashcard") {
    // Front (example sentence) plays the sentence audio if available; back plays the word.
    const cardAudio = flipped ? word.audio_url : word.audio_sentence_url || word.audio_url;
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-10 pb-10">
        {/* Flashcard — tap to flip */}
        {/* Audio controls: normal speed + slow */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => playAudio(cardAudio)}
            aria-label="Phát âm"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-orange-500 shadow transition hover:scale-105"
          >
            <Volume2 className="h-6 w-6" />
          </button>
          <button
            onClick={() => playAudio(cardAudio, 0.55)}
            aria-label="Phát âm chậm"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-orange-500 shadow transition hover:scale-105"
          >
            <Snail className="h-6 w-6" />
          </button>
        </div>
        <div className="w-full cursor-pointer select-none [perspective:1200px]" onClick={() => setFlipped((f) => !f)}>
          <div
            className={cn(
              "relative h-[420px] w-full transition-transform duration-500 [transform-style:preserve-3d]",
              flipped && "[transform:rotateY(180deg)]",
            )}
          >
            {/* FRONT — image + example sentence with the word underlined */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-2xl bg-neutral-800 p-6 text-center [backface-visibility:hidden]">
              {word.image_url && (
                <Image
                  src={word.image_url}
                  alt={word.term}
                  width={240}
                  height={180}
                  className="w-full max-w-[260px] rounded-xl object-contain"
                  unoptimized
                />
              )}
              <p className="px-2 text-lg leading-relaxed text-white">
                {word.example_en ? (
                  <Sentence
                    text={word.example_en}
                    term={word.term}
                    mode="underline"
                    highlightClassName="font-bold text-white underline decoration-2 underline-offset-4"
                  />
                ) : (
                  <span className="font-bold underline decoration-2 underline-offset-4">{word.term}</span>
                )}
              </p>
              <Image
                src="/click_card.webp"
                alt=""
                width={48}
                height={48}
                className="pointer-events-none absolute -bottom-5 right-3 h-12 w-12 select-none"
              />
            </div>

            {/* BACK — word + phonetic + meaning */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-neutral-800 p-6 text-center [transform:rotateY(180deg)] [backface-visibility:hidden]">
              <h2 className="text-3xl font-bold text-white">{word.term}</h2>
              {word.phonetic_uk && <p className="text-neutral-300">/{word.phonetic_uk}/</p>}
              <p className="font-semibold text-white">
                {word.meaning_vi}
                {word.pos ? ` (${word.pos})` : ""}
              </p>
              <Image
                src="/click_card.webp"
                alt=""
                width={48}
                height={48}
                className="pointer-events-none absolute -bottom-5 right-3 h-12 w-12 select-none"
              />
            </div>
          </div>
        </div>

        <Button
          onClick={() => onNext(null)}
          className="w-full rounded-full bg-green-500 py-6 text-base font-bold text-white hover:bg-green-600"
        >
          Tiếp tục
        </Button>
        <button
          onClick={() => onNext(null)}
          className="text-sm text-neutral-400 underline underline-offset-4 transition hover:text-white"
        >
          Mình đã thuộc từ này
        </button>
      </div>
    );
  }

  const promptHeader = (() => {
    switch (type) {
      case "choose_meaning":
      case "choose_reading":
        return (
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-neutral-700">{word.term}</span>
            <button onClick={() => playAudio(word.audio_url)} className="text-sky-500" aria-label="Phát âm">
              <Volume2 className="h-6 w-6" />
            </button>
          </div>
        );
      case "choose_word":
        return <p className="text-center text-2xl font-bold text-green-600">{word.meaning_vi}</p>;
      case "choose_image":
        return (
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-bold text-neutral-700">{word.term}</span>
            <button onClick={() => playAudio(word.audio_url)} className="text-sky-500" aria-label="Phát âm">
              <Volume2 className="h-5 w-5" />
            </button>
          </div>
        );
      case "listen_choose":
      case "listen_write":
        return (
          <button
            onClick={() => playAudio(word.audio_url)}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-400 text-white transition hover:scale-105 border-sky-500 border-b-4 active:border-b-0"
            aria-label="Phát lại"
          >
            <Volume2 className="h-9 w-9" />
          </button>
        );
      case "fill_gap_choose":
      case "fill_gap_type":
        return (
          <p className="text-center text-lg">
            {word.example_en ? <Sentence text={word.example_en} term={word.term} mode="blank" /> : word.meaning_vi}
            {word.meaning_vi && <span className="mt-2 block text-sm text-muted-foreground">({word.meaning_vi})</span>}
          </p>
        );
      case "underlined_meaning":
        return (
          <p className="text-center text-lg">
            {word.example_en ? <Sentence text={word.example_en} term={word.term} mode="underline" /> : word.term}
          </p>
        );
      case "spell":
        return (
          <p className="text-center text-2xl font-bold text-green-600">
            {word.meaning_vi}
            {word.pos ? ` (${word.pos})` : ""}
          </p>
        );
      default:
        return null;
    }
  })();

  return (
    <Card index={index} total={total} title={PROMPT[type]}>
      <div className="space-y-6">
        <div className="rounded-xl border-2 bg-slate-50 p-6 text-neutral-800">{promptHeader}</div>

        {isSpell ? (
          <SpellInput term={word.term} disabled={result !== null} onCheck={(c) => grade(c)} />
        ) : isTyped ? (
          <div className="space-y-3">
            <Input
              ref={inputRef}
              autoFocus
              value={typed}
              disabled={result !== null}
              placeholder="Nhập từ tiếng Anh..."
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && result === null) checkTyped();
              }}
              className={cn(
                "h-14 bg-white text-center text-xl text-neutral-800 placeholder:text-neutral-400",
                result === true && "border-green-500 text-green-600",
                result === false && "border-rose-500 text-rose-600",
              )}
            />
            {revealed && result === false && (
              <p className="text-center text-sm">
                Đáp án: <span className="font-bold text-green-600">{word.term}</span>
              </p>
            )}
          </div>
        ) : isImage ? (
          <div className="grid grid-cols-2 gap-3">
            {options?.map((opt, i) => {
              const show = result !== null;
              return (
                <button
                  key={i}
                  disabled={show}
                  onClick={() => choose(i, opt)}
                  className={cn(
                    "relative overflow-hidden rounded-xl border-2 border-b-4 transition",
                    !show && "hover:bg-slate-50",
                    show && opt.correct && "border-green-500 ring-2 ring-green-500",
                    show && !opt.correct && picked === i && "border-rose-500 opacity-60",
                    show && !opt.correct && picked !== i && "opacity-50",
                  )}
                >
                  {opt.image ? (
                    <Image src={opt.image} alt={opt.label} width={200} height={160} className="h-32 w-full object-contain" unoptimized />
                  ) : (
                    <div className="flex h-32 items-center justify-center text-sm">{opt.label}</div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-3">
            {options?.map((opt, i) => {
              const show = result !== null;
              return (
                <button
                  key={i}
                  disabled={show}
                  onClick={() => choose(i, opt)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border-2 border-b-4 px-4 py-3 text-left text-lg font-semibold text-neutral-700 transition",
                    !show && "hover:bg-slate-50 active:border-b-2",
                    show && opt.correct && "border-green-500 bg-green-500/10 text-green-700",
                    show && !opt.correct && picked === i && "border-rose-500 bg-rose-500/10 text-rose-600",
                    show && !opt.correct && picked !== i && "opacity-60",
                  )}
                >
                  <span>{opt.label}</span>
                  {show && opt.correct && <Check className="h-5 w-5 text-green-600" />}
                  {show && !opt.correct && picked === i && <X className="h-5 w-5 text-rose-500" />}
                </button>
              );
            })}
          </div>
        )}

        {isTyped && !isSpell && result === null ? (
          <Button variant="primary" className="w-full" disabled={!typed.trim()} onClick={checkTyped}>
            Kiểm tra
          </Button>
        ) : null}
      </div>
      <ResultDrawer open={result !== null} correct={result === true} word={word} onContinue={() => onNext(result)} />
    </Card>
  );
}

/** "Điền từ": type directly into the missing letter slots (MochiDemy-style). */
function SpellInput({
  term,
  disabled,
  onCheck,
}: {
  term: string;
  disabled: boolean;
  onCheck: (correct: boolean) => void;
}) {
  const chars = useMemo(() => term.split(""), [term]);
  const isHint = (i: number) => chars[i] !== " " && i % 3 === 0;
  const editable = (i: number) => chars[i] !== " " && !isHint(i);
  const [vals, setVals] = useState<string[]>(() =>
    chars.map((c, i) => (c === " " ? " " : isHint(i) ? c.toLowerCase() : "")),
  );
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    for (let i = 0; i < chars.length; i++)
      if (editable(i)) {
        refs.current[i]?.focus();
        break;
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const complete = chars.every((c, i) => c === " " || vals[i] !== "");

  function setAt(i: number, v: string) {
    setVals((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }
  function check() {
    const assembled = chars
      .map((c, i) => (c === " " ? " " : vals[i]))
      .join("")
      .trim()
      .toLowerCase();
    onCheck(assembled === term.trim().toLowerCase());
  }
  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.key === "Enter") {
      if (complete) check();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (vals[i]) {
        setAt(i, "");
      } else {
        for (let j = i - 1; j >= 0; j--)
          if (editable(j)) {
            setAt(j, "");
            refs.current[j]?.focus();
            break;
          }
      }
      return;
    }
    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      setAt(i, e.key.toLowerCase());
      for (let j = i + 1; j < chars.length; j++)
        if (editable(j)) {
          refs.current[j]?.focus();
          break;
        }
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-center gap-x-1.5 gap-y-3">
        {chars.map((c, i) =>
          c === " " ? (
            <span key={i} className="w-3" />
          ) : (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={vals[i]}
              readOnly={isHint(i) || disabled}
              maxLength={1}
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              onChange={() => { }}
              onKeyDown={(e) => onKeyDown(i, e)}
              className={cn(
                "h-12 w-8 border-b-[3px] bg-transparent text-center text-2xl font-bold lowercase outline-none transition-colors",
                isHint(i)
                  ? "border-slate-200 text-neutral-400"
                  : "border-slate-300 text-neutral-800 focus:border-green-500",
              )}
            />
          ),
        )}
      </div>
      <Button variant="primary" className="w-full" disabled={!complete || disabled} onClick={check}>
        Kiểm tra
      </Button>
    </div>
  );
}

/** MochiDemy-style result drawer (shadcn): slides up showing the word + Tiếp tục. */
function ResultDrawer({
  open,
  correct,
  word,
  onContinue,
}: {
  open: boolean;
  correct: boolean;
  word: Word;
  onContinue: () => void;
}) {
  const contRef = useRef(onContinue);
  contRef.current = onContinue;
  useEffect(() => {
    if (!open) return;
    // Guard against the very Enter keypress that submitted the answer. React flushes this
    // effect synchronously during that (discrete) keydown, so the listener would otherwise
    // catch the same keystroke as it bubbles to window and dismiss the drawer instantly —
    // the drawer would never stay visible on typed/spell answers.
    const openedAt = performance.now();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (performance.now() - openedAt < 400) return;
      e.preventDefault();
      contRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 animate-in fade-in" />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg rounded-t-2xl border-t-4 bg-white text-neutral-800 shadow-2xl",
          "animate-in slide-in-from-bottom duration-300",
          correct ? "border-green-500" : "border-rose-500",
        )}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-neutral-300" />
        <div
          className={cn(
            "mt-2 flex items-center gap-2 px-5 text-xl font-extrabold",
            correct ? "text-green-600" : "text-rose-600",
          )}
        >
          {correct ? <Check className="h-6 w-6" /> : <X className="h-6 w-6" />}
          {correct ? "Chính xác!" : "Chưa chính xác"}
        </div>
        <div className="px-5 pb-8 pt-3">
          <div className="flex items-start gap-3">
            {word.image_url && (
              <Image
                src={word.image_url}
                alt={word.term}
                width={72}
                height={72}
                className="h-16 w-16 rounded-lg object-cover"
                unoptimized
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-neutral-800">{word.term}</span>
                <button onClick={() => playAudio(word.audio_url)} className="text-sky-500" aria-label="Phát âm">
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
              {word.phonetic_uk && <p className="text-muted-foreground">/{word.phonetic_uk}/</p>}
              <p className="font-semibold text-neutral-700">
                {word.meaning_vi}
                {word.pos ? ` (${word.pos})` : ""}
              </p>
            </div>
          </div>
          {word.example_en && <p className="mt-3 text-sm text-neutral-600">{word.example_en}</p>}
          <Button variant={correct ? "secondary" : "danger"} className="mt-5 w-full" onClick={onContinue}>
            Tiếp tục
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Card({
  children,
  index,
  total,
  title,
}: {
  children: React.ReactNode;
  index: number;
  total: number;
  title: string;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-4 flex items-center justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span>
          {index + 1}/{total}
        </span>
      </div>
      <div className="rounded-2xl border-2 bg-white p-6">{children}</div>
    </div>
  );
}
