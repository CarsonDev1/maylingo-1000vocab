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

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const LEVEL_LABELS = ["", "Mới", "Đang nhớ", "Khá", "Tốt", "Thành thạo"];
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
        label: "Học mới",
        data: data.activity.map((a) => a.words_learned),
        backgroundColor: "#22c55e",
        borderRadius: 6,
        stack: "a",
      },
      {
        label: "Ôn tập",
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
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={BookCheck} color="text-green-500" label="Đã học" value={`${data.learnedWords}/${data.totalWords}`} />
        <StatCard icon={Flame} color="text-orange-500" label="Streak hiện tại" value={`${data.streak.current_streak} ngày`} />
        <StatCard icon={Trophy} color="text-amber-500" label="Streak dài nhất" value={`${data.streak.longest_streak} ngày`} />
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base">Mức độ nhớ</CardTitle>
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
          <CardTitle className="text-base">Phân bố độ thành thạo (0–9)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <Bar data={profData} options={baseOptions} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base">Hoạt động gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          {data.activity.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Chưa có hoạt động.</p>
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
