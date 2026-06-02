"use client";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Trophy, BookCheck } from "lucide-react";
import type { StatsData } from "@/lib/queries";
import { levelFromXp, tierForLevel } from "@/lib/level";
import { evaluateBadges, earnedCount, BADGES, type GamificationStats } from "@/lib/badges";
import { LevelEmblem } from "@/components/level/LevelEmblem";
import { LevelProgressBar } from "@/components/level/LevelProgressBar";
import { BadgeTile } from "@/components/level/BadgeTile";
import { cn } from "@/lib/utils";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const LEVEL_LABELS = ["", "New", "Learning", "Familiar", "Good", "Mastered"];
const LEVEL_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

const baseOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { weight: "bold" } } },
    y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#f1f5f9" } },
  },
};

export function StatsClient({ data }: { data: StatsData }) {
  const gStats: GamificationStats = {
    totalXp: data.totalXp,
    learnedWords: data.learnedWords,
    totalWords: data.totalWords,
    masteredWords: data.levels[5] ?? 0,
    currentStreak: data.streak.current_streak,
    longestStreak: data.streak.longest_streak,
  };
  const info = levelFromXp(gStats.totalXp);
  const tier = tierForLevel(info.level);
  const badgeCtx = { ...gStats, level: info.level };
  const badges = evaluateBadges(badgeCtx);

  const profData = {
    labels: data.proficiency.map((_, p) => `${p}`),
    datasets: [
      {
        data: data.proficiency,
        backgroundColor: data.proficiency.map((_, i) => `hsl(142 ${40 + i * 4}% ${58 - i * 2}%)`),
        borderRadius: 8,
        maxBarThickness: 40,
      },
    ],
  };

  const activity = {
    labels: data.activity.map((a) => a.activity_date.slice(5)),
    datasets: [
      {
        label: "Learned",
        data: data.activity.map((a) => a.words_learned),
        backgroundColor: "#22c55e",
        borderRadius: 6,
        stack: "a",
      },
      {
        label: "Reviewed",
        data: data.activity.map((a) => a.words_reviewed),
        backgroundColor: "#f97316",
        borderRadius: 6,
        stack: "a",
      },
    ],
  };

  const stackedOptions: ChartOptions<"bar"> = {
    ...baseOptions,
    plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 12, font: { weight: "bold" } } } },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#f1f5f9" } },
    },
  };

  return (
    <div className="space-y-6">
      {/* Level hero */}
      <Card className="relative overflow-hidden border-2 border-slate-100 shadow-sm">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-40 opacity-[0.13]"
          style={{ background: `radial-gradient(120% 100% at 25% 0%, ${tier.glow}, transparent 70%)` }}
        />
        <div className="relative p-6">
          <div className="flex items-center gap-4">
            <LevelEmblem level={info.level} size={76} />
            <div className="min-w-0">
              <p className={cn("text-xs font-extrabold uppercase tracking-[0.15em]", tier.textClass)}>{tier.name}</p>
              <p className="text-4xl font-black leading-none text-neutral-800">Level {info.level}</p>
              <p className="mt-1 text-sm font-bold text-amber-500">{info.totalXp.toLocaleString("en-US")} XP</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs font-extrabold text-neutral-400">
              <span>LEVEL {info.level}</span>
              <span>LEVEL {info.level + 1}</span>
            </div>
            <LevelProgressBar value={info.progressPct} fillClassName={tier.gradient} glow={tier.color} shimmer height={18} />
            <p className="mt-2 text-sm text-neutral-500">
              <b className={tier.textClass}>{info.xpToNext.toLocaleString("en-US")} XP</b> to reach Level {info.level + 1}
            </p>
          </div>
        </div>
      </Card>

      {/* Badges */}
      <Card className="border-2 border-slate-100 shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Badges</CardTitle>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-600">
            {earnedCount(badgeCtx)}/{BADGES.length}
          </span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {badges.map((b) => (
              <BadgeTile key={b.def.id} badge={b} />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={BookCheck} color="text-green-500" label="Learned" value={`${data.learnedWords}/${data.totalWords}`} />
        <StatCard icon={Flame} color="text-orange-500" label="Current streak" value={`${data.streak.current_streak} days`} />
        <StatCard icon={Trophy} color="text-amber-500" label="Longest streak" value={`${data.streak.longest_streak} days`} />
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base">Memory level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2 text-center">
            {LEVEL_LABELS.slice(1).map((label, i) => (
              <div key={label} className="rounded-xl border-2 p-3">
                <div className="text-2xl font-extrabold" style={{ color: LEVEL_COLORS[i + 1] }}>
                  {data.levels[i + 1]}
                </div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base">Proficiency distribution (0–9)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <Bar data={profData} options={baseOptions} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.activity.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="h-56 w-full">
              <Bar data={activity} options={stackedOptions} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-2">
      <CardContent className="flex items-center gap-4 p-6">
        <Icon className={`h-8 w-8 ${color}`} />
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-extrabold text-neutral-700">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
