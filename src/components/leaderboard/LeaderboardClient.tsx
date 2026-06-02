"use client";

import Image from "next/image";
import { Flame } from "lucide-react";
import { LevelEmblem } from "@/components/level/LevelEmblem";
import { levelFromXp, tierForLevel } from "@/lib/level";
import { cn } from "@/lib/utils";

export interface LeaderRow {
  rank: number;
  name: string;
  imageUrl: string | null;
  totalXp: number;
  streak: number;
  isMe: boolean;
}

export function LeaderboardClient({
  rows,
  me,
  totalPlayers,
}: {
  rows: LeaderRow[];
  me: LeaderRow | null;
  totalPlayers: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="mx-auto mt-6 max-w-md rounded-2xl border-2 p-10 text-center">
        <div className="text-5xl">🏆</div>
        <h2 className="mt-3 text-xl font-bold text-neutral-700">No rankings yet</h2>
        <p className="mt-1 text-muted-foreground">Learn and review to earn XP and climb the board!</p>
      </div>
    );
  }

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const meInTop = rows.some((r) => r.isMe);

  return (
    <div className="space-y-6 pb-6">
      <Podium rows={podium} />

      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((r) => (
            <RankRow key={r.rank} row={r} />
          ))}
        </div>
      )}

      {me && !meInTop && (
        <div className="sticky bottom-4 z-10">
          <p className="mb-1 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Your rank</p>
          <RankRow row={me} />
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {totalPlayers.toLocaleString("en-US")} learners ranked by XP
      </p>
    </div>
  );
}

// ---- Podium (top 3) ----------------------------------------------------------
const MEDAL: Record<number, { ring: string; bar: string; h: string; badge: string; glow: string }> = {
  1: { ring: "ring-amber-400", bar: "from-amber-300 to-yellow-500", h: "h-24", badge: "🥇", glow: "#f59e0b" },
  2: { ring: "ring-slate-300", bar: "from-slate-200 to-slate-400", h: "h-16", badge: "🥈", glow: "#94a3b8" },
  3: { ring: "ring-orange-400", bar: "from-amber-500 to-orange-700", h: "h-12", badge: "🥉", glow: "#ea7a17" },
};

function Podium({ rows }: { rows: LeaderRow[] }) {
  const [first, second, third] = rows;
  return (
    <div className="flex items-end justify-center gap-2 rounded-3xl border-2 border-slate-100 bg-gradient-to-b from-sky-50 to-white p-5 shadow-sm sm:gap-4">
      {second ? <PodiumCol row={second} place={2} /> : <div className="w-1/3 max-w-[150px]" />}
      {first && <PodiumCol row={first} place={1} />}
      {third ? <PodiumCol row={third} place={3} /> : <div className="w-1/3 max-w-[150px]" />}
    </div>
  );
}

function PodiumCol({ row, place }: { row: LeaderRow; place: number }) {
  const m = MEDAL[place];
  const info = levelFromXp(row.totalXp);
  const tier = tierForLevel(info.level);
  return (
    <div className={cn("flex w-1/3 max-w-[150px] flex-col items-center", place === 1 && "-mt-3")}>
      {place === 1 && <div className="mb-1 animate-bounce text-2xl">👑</div>}
      <div className="relative">
        <Avatar name={row.name} src={row.imageUrl} size={place === 1 ? 72 : 56} ringClass={m.ring} glow={m.glow} />
        <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-white text-base shadow ring-1 ring-black/5">
          {m.badge}
        </span>
      </div>
      <p
        className={cn(
          "mt-2 line-clamp-1 max-w-full text-center text-sm font-extrabold",
          row.isMe ? "text-sky-600" : "text-neutral-700",
        )}
      >
        {row.name}
        {row.isMe && " (You)"}
      </p>
      <div className="mt-0.5 flex items-center gap-1">
        <LevelEmblem level={info.level} size={16} glowPulse={false} />
        <span className={cn("text-[11px] font-bold", tier.textClass)}>Lv {info.level}</span>
      </div>
      <p className="text-sm font-black text-amber-500">{info.totalXp.toLocaleString("en-US")}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">XP</p>

      <div className={cn("mt-2 w-full rounded-t-xl bg-gradient-to-b text-center shadow-inner", m.bar, m.h)}>
        <span className="block pt-2 text-2xl font-black text-white drop-shadow">{place}</span>
      </div>
    </div>
  );
}

// ---- Ranked rows (4th onward + you) -----------------------------------------
function RankRow({ row }: { row: LeaderRow }) {
  const info = levelFromXp(row.totalXp);
  const tier = tierForLevel(info.level);
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 p-3 transition",
        row.isMe ? "border-sky-300 bg-sky-50 shadow-sm" : "border-slate-100 bg-white hover:border-slate-200",
      )}
    >
      <span className="w-7 shrink-0 text-center text-sm font-black text-neutral-400">{row.rank}</span>
      <Avatar name={row.name} src={row.imageUrl} size={40} ringClass="ring-slate-200" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 font-bold text-neutral-700">
          {row.name}
          {row.isMe && <span className="text-sky-600"> (You)</span>}
        </p>
        <div className="flex items-center gap-1.5">
          <LevelEmblem level={info.level} size={14} glowPulse={false} />
          <span className={cn("text-xs font-bold", tier.textClass)}>
            Lv {info.level} · {tier.name}
          </span>
        </div>
      </div>
      {row.streak > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-rose-500">
          <Flame className="h-3.5 w-3.5 fill-rose-500" />
          {row.streak}
        </span>
      )}
      <div className="shrink-0 text-right">
        <p className="text-sm font-black text-amber-500">{info.totalXp.toLocaleString("en-US")}</p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">XP</p>
      </div>
    </div>
  );
}

// ---- Avatar ------------------------------------------------------------------
function Avatar({
  name,
  src,
  size,
  ringClass,
  glow,
}: {
  name: string;
  src: string | null;
  size: number;
  ringClass: string;
  glow?: string;
}) {
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const style = { width: size, height: size, boxShadow: glow ? `0 6px 16px -4px ${glow}` : undefined };
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className={cn("rounded-full object-cover ring-2 ring-offset-2 ring-offset-white", ringClass)}
        style={style}
      />
    );
  }
  return (
    <div
      className={cn(
        "grid place-items-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 font-extrabold text-white ring-2 ring-offset-2 ring-offset-white",
        ringClass,
      )}
      style={{ ...style, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </div>
  );
}
