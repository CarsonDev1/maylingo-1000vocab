"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SlideEyebrow({ children, accent = "green" }: { children: ReactNode; accent?: "green" | "violet" }) {
  return (
    <span className={cn("flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em]",
      accent === "violet" ? "text-violet-300" : "text-green-400")}>
      <span className={cn("h-0.5 w-5 rounded", accent === "violet" ? "bg-violet-400" : "bg-green-500")} />
      {children}
    </span>
  );
}

export function SlideHeading({ children, size = "h2" }: { children: ReactNode; size?: "h1" | "h2" }) {
  const cls = "mt-2 font-extrabold tracking-tight text-white text-balance";
  return size === "h1"
    ? <h1 className={cn(cls, "text-3xl sm:text-4xl")}>{children}</h1>
    : <h2 className={cn(cls, "text-2xl sm:text-3xl")}>{children}</h2>;
}

export function SlideLead({ children }: { children: ReactNode }) {
  return <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-neutral-300 sm:text-base">{children}</p>;
}

/** Content column + art column; stacks (art hidden) on small screens. */
export function SlideTwoCol({ children, art }: { children: ReactNode; art: ReactNode }) {
  return (
    <div className="mt-5 grid flex-1 items-center gap-6 md:grid-cols-[1fr_0.82fr]">
      <div className="min-w-0">{children}</div>
      <div className="hidden min-h-0 md:block">{art}</div>
    </div>
  );
}

/** Renders a PrepVocab image, or a gradient + emoji fallback. */
export function ArtPanel({ imageUrl, emoji = "🗂️", alt = "" }: { imageUrl?: string | null; emoji?: string; alt?: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-800 to-neutral-800/40 p-5">
      {imageUrl ? (
        <Image src={imageUrl} alt={alt} width={280} height={280} unoptimized className="max-h-[280px] w-auto rounded-xl object-contain" />
      ) : (
        <div className="grid h-28 w-28 place-items-center rounded-2xl bg-white/5 text-6xl">{emoji}</div>
      )}
    </div>
  );
}
