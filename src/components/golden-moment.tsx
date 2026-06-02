"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function fmt(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((x) => String(x).padStart(2, "0")).join(":");
}

/**
 * "Golden Moment" countdown. Shows time remaining until the
 * next batch of words becomes due; once it hits 0, offers to review now.
 */
export function GoldenMoment({ nextDueAt, prepCount }: { nextDueAt: string; prepCount: number }) {
  const target = new Date(nextDueAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (target - now <= 0) {
    return (
      <Button asChild size="lg" variant="primary" className="w-full">
        <Link href="/review">Review now ({prepCount})</Link>
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-xl border-2 p-5 text-center">
      <p className="text-3xl">⏳</p>
      <p className="font-bold text-green-600">See you at the “Golden Moment”</p>
      <p className="text-sm text-muted-foreground">
        Coming up for review: <span className="font-bold text-orange-500">{prepCount} words</span>
      </p>
      <div className="mx-auto w-fit rounded-full bg-slate-100 px-6 py-2 text-2xl font-bold tracking-wider text-neutral-700 tabular-nums">
        {fmt(target - now)}
      </div>
      <Button asChild variant="secondaryOutline" className="mt-2 w-full">
        <Link href="/lessons">Learn new words</Link>
      </Button>
    </div>
  );
}
