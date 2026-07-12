"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Check, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopicDaySummary } from "@/types";

export function TopicRoadmap() {
  const [days, setDays] = useState<TopicDaySummary[] | null>(null);
  const [review, setReview] = useState<{ dueCount: number; nextDueAt: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/topics")
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .then((d) => {
        if (!cancelled) setDays((d?.days as TopicDaySummary[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/topics/review")
      .then((r) => (r.ok ? r.json() : { dueCount: 0, nextDueAt: null }))
      .then((d) => { if (!cancelled) setReview({ dueCount: d.dueCount ?? 0, nextDueAt: d.nextDueAt ?? null }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (days === null) {
    return (
      <div className="mt-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-green-500" />
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
        Chưa có nội dung lộ trình. (Chạy <code>node scripts/generate-topic-decks.mjs</code> để tạo.)
      </div>
    );
  }

  const nextDay = days.find((d) => d.unlocked && !d.completed);

  return (
    <div className="mt-5">
      {nextDay && (
        <Link
          href={`/topics/${nextDay.day_no}`}
          className="mb-5 flex items-center justify-between rounded-2xl border-b-4 border-green-600 bg-green-500 px-5 py-4 font-bold text-white shadow-sm transition hover:bg-green-600 active:border-b-2"
        >
          <span>
            Hôm nay · Ngày {nextDay.day_no}: {nextDay.title_en}
          </span>
          <Play className="h-5 w-5 shrink-0 fill-white" />
        </Link>
      )}

      {review && review.dueCount > 0 && (
        <Link
          href="/topics/review"
          className="mb-4 flex items-center justify-between rounded-2xl border-b-4 border-orange-500 bg-orange-400 px-5 py-4 font-bold text-white shadow-sm transition hover:bg-orange-500 active:border-b-2"
        >
          <span>⏰ Ôn tập · {review.dueCount} từ đến “Thời gian vàng”</span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <ul className="flex flex-col gap-2">
        {days.map((d) => {
          const state = d.completed ? "done" : d.unlocked ? "open" : "locked";
          const inner = (
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition",
                state === "done" && "border-green-200 bg-green-50",
                state === "open" && "border-slate-200 bg-white hover:border-green-300 hover:bg-slate-50",
                state === "locked" && "border-slate-100 bg-slate-50 opacity-70",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  state === "done" && "bg-green-500 text-white",
                  state === "open" && "bg-green-500/15 text-green-600",
                  state === "locked" && "bg-slate-200 text-slate-400",
                )}
              >
                {state === "done" ? <Check className="h-5 w-5" /> : state === "locked" ? <Lock className="h-4 w-4" /> : d.day_no}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-neutral-700">
                  Ngày {d.day_no}: {d.title_en}
                </p>
                <p className="truncate text-xs text-muted-foreground">{d.title_vi}</p>
              </div>
              {d.completed && d.best_score != null && (
                <span className="shrink-0 text-xs font-bold text-green-600">{d.best_score}%</span>
              )}
            </div>
          );
          return (
            <li key={d.day_no}>
              {state === "locked" ? inner : <Link href={`/topics/${d.day_no}`}>{inner}</Link>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
