"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SessionRunner } from "@/components/session/SessionRunner";
import { buildReviewSteps } from "@/lib/exercises";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import type { WordWithProgress, Word } from "@/types";

export function ReviewClient({ words, pool }: { words: WordWithProgress[]; pool: Word[] }) {
  const [started, setStarted] = useState(false);

  const { steps, ids } = useMemo(() => {
    const profByWord = new Map<number, number>();
    for (const w of words) profByWord.set(w.id, w.progress?.proficiency ?? 1);
    const plain = words as unknown as Word[];
    return { steps: buildReviewSteps(plain, pool, profByWord), ids: words.map((w) => w.id) };
  }, [words, pool]);

  // The immersive full-screen session only starts after the user taps "Ôn tập ngay".
  if (started) {
    return <SessionRunner steps={steps} mode="review" wordIds={ids} />;
  }

  // Landing screen — always shown first when opening Review (mirrors the mobile review tab),
  // so the user never gets dropped straight into the exercises.
  return (
    <div className="px-6">
      <PageHeader title="Ôn tập" />
      <div className="mx-auto flex max-w-[480px] flex-col items-center gap-y-6 pt-4 text-center">
        <Image src="/mascot.svg" width={120} height={120} alt="Maylingo" />
        <div>
          <p className="text-5xl font-extrabold text-green-600">{words.length}</p>
          <p className="mt-1 text-muted-foreground">
            từ đã tới “Thời điểm vàng” — ôn hết trong một lượt nhé!
          </p>
        </div>
        <div className="flex w-full flex-col gap-y-3">
          <Button size="lg" variant="primary" className="w-full" onClick={() => setStarted(true)}>
            Ôn tập ngay ({words.length})
          </Button>
          <Button asChild size="lg" variant="secondaryOutline" className="w-full">
            <Link href="/dashboard">Để sau</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
