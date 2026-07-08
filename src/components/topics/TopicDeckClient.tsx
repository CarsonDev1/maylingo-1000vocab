"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopicDeckRunner } from "@/components/topics/TopicDeckRunner";
import type { TopicDeck, Word } from "@/types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; deck: TopicDeck; words: Word[] };

export function TopicDeckClient({ day }: { day: number }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/topics/${day}`)
      .then(async (r) => {
        if (r.status === 403) return { _err: "Ngày này chưa mở khóa. Hãy hoàn thành ngày trước đó." };
        if (!r.ok) return { _err: "Không tải được nội dung ngày này." };
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        if (d._err) setState({ status: "error", message: d._err });
        else setState({ status: "ready", deck: d.deck as TopicDeck, words: (d.words as Word[]) ?? [] });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Không kết nối được." });
      });
    return () => {
      cancelled = true;
    };
  }, [day]);

  if (state.status === "loading") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900">
        <Loader2 className="h-7 w-7 animate-spin text-green-500" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900 px-6 text-center">
        <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-800 p-8">
          <p className="text-white">{state.message}</p>
          <Button asChild variant="secondary" className="mt-5">
            <Link href="/topics">Về lộ trình</Link>
          </Button>
        </div>
      </div>
    );
  }
  return <TopicDeckRunner deck={state.deck} words={state.words} />;
}
