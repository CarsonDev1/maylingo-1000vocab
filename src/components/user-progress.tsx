import { Flame } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { LevelBadge } from "@/components/level/LevelBadge";
import type { GamificationStats } from "@/lib/badges";

type Props = {
  stats: GamificationStats;
};

const UserProgress = ({ stats }: Props) => {
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <LevelBadge stats={stats} />

      <Link
        href="/stats"
        title="Tổng XP"
        className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 ring-1 ring-black/5 transition hover:brightness-95"
      >
        <Image src="/points.svg" height={22} width={22} alt="XP" />
        <span className="text-sm font-black text-amber-600">{stats.totalXp.toLocaleString("en-US")}</span>
      </Link>

      <Link
        href="/stats"
        title="Chuỗi streak"
        className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 ring-1 ring-black/5 transition hover:brightness-95"
      >
        <Flame className="h-[18px] w-[18px] fill-rose-500 text-rose-500" />
        <span className="text-sm font-black text-rose-500">{stats.currentStreak}</span>
      </Link>
    </div>
  );
};

export default UserProgress;
