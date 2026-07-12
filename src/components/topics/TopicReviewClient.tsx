"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Volume2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitTopicReview, finishTopicReview } from "@/lib/actions";
import { speakText } from "@/lib/tts";
import { cn } from "@/lib/utils";
import type { Word } from "@/types";

const norm = (s: string) => s.trim().toLowerCase().replace(/[.,!?;:'"]/g, "");

function blankExample(example: string, term: string): string {
  const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*\\b`, "i");
  return example.replace(re, "_____");
}

export function TopicReviewClient() {
  const [queue, setQueue] = useState<Word[] | null>(null);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/topics/review")
      .then((r) => (r.ok ? r.json() : { due: [] }))
      .then((d) => { if (!cancelled) setQueue((d.due as Word[]) ?? []); })
      .catch(() => { if (!cancelled) setQueue([]); });
    return () => { cancelled = true; };
  }, []);

  const word = queue?.[i];
  const prompt = useMemo(() => {
    if (!word) return "";
    return word.example_en ? blankExample(word.example_en, word.term) : (word.meaning_vi ?? word.term);
  }, [word]);

  if (queue === null) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-green-500" /></div>;
  }
  if (queue.length === 0 || done) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-5xl">✅</p>
        <h2 className="mt-3 text-xl font-bold text-neutral-800">{done ? "Ôn xong!" : "Chưa có từ đến hạn ôn"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{done ? `Bạn đã ôn ${queue.length} từ.` : "Học thêm một ngày trong lộ trình để có từ ôn."}</p>
        <Button asChild variant="secondary" className="mt-6"><Link href="/topics">Về lộ trình</Link></Button>
      </div>
    );
  }

  function check() {
    if (result !== null || !word) return;
    const ok = norm(typed) === norm(word.term);
    setResult(ok);
    if (ok) setCorrectCount((c) => c + 1);
    speakText(word.term);
    void submitTopicReview(word.id, ok).catch(() => {});
  }

  function next() {
    if (i + 1 >= queue!.length) {
      void finishTopicReview(queue!.length, correctCount).catch(() => {});
      setDone(true);
    } else {
      setI((n) => n + 1); setTyped(""); setResult(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between text-sm font-bold text-muted-foreground">
        <Link href="/topics" className="hover:text-neutral-700">✕ Thoát</Link>
        <span className="tabular-nums">{i + 1}/{queue.length}</span>
      </div>

      {word!.image_url && (
        <Image src={word!.image_url} alt="" width={200} height={150} unoptimized className="mx-auto h-36 w-auto rounded-2xl object-contain" />
      )}
      <p className="rounded-xl border-2 bg-slate-50 p-4 text-center text-lg italic text-neutral-800">“{prompt}”</p>
      <p className="text-center text-sm text-muted-foreground">Nhớ lại từ còn thiếu:</p>

      {result === null ? (
        <>
          <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") check(); }}
            placeholder="Gõ từ tiếng Anh…" className="h-14 text-center text-xl" />
          <Button variant="primary" className="w-full" disabled={!typed.trim()} onClick={check}>Kiểm tra</Button>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className={cn("flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold",
            result ? "bg-green-500/10 text-green-700" : "bg-rose-500/10 text-rose-600")}>
            {result ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
            <button onClick={() => speakText(word!.term)} className="inline-flex items-center gap-1">{word!.term} <Volume2 className="h-4 w-4" /></button>
            {word!.meaning_vi ? <span className="font-normal text-muted-foreground">· {word!.meaning_vi}</span> : null}
          </div>
          {word!.example_en && <p className="rounded-xl border-2 bg-slate-50 p-3 text-sm italic text-neutral-700">“{word!.example_en}”</p>}
          <Button variant="primary" className="w-full" onClick={next}>Tiếp tục</Button>
        </div>
      )}
    </div>
  );
}
