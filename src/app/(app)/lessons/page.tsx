import Link from "next/link";
import Image from "next/image";
import { requireUserId } from "@/lib/auth";
import { getLessonsWithStats, getDashboardData } from "@/lib/queries";
import FeedWrapper from "@/components/feed-wrapper";
import StickyWrapper from "@/components/sticky-wrapper";
import UserProgress from "@/components/user-progress";
import { PageHeader } from "@/components/page-header";
import { CheckCircle2, ChevronRight, Repeat } from "lucide-react";
import { LevelProgressBar } from "@/components/level/LevelProgressBar";
import type { GamificationStats } from "@/lib/badges";

export default async function LessonsPage() {
  const userId = await requireUserId();
  const [lessons, dash] = await Promise.all([getLessonsWithStats(userId), getDashboardData(userId)]);

  const stats: GamificationStats = {
    totalXp: dash.totalXp,
    learnedWords: dash.learnedWords,
    totalWords: dash.totalWords,
    masteredWords: dash.masteredWords,
    currentStreak: dash.streak.current_streak,
    longestStreak: dash.streak.longest_streak,
  };

  return (
    <div className="flex flex-row-reverse gap-[48px] px-6">
      <StickyWrapper>
        <UserProgress stats={stats} />
      </StickyWrapper>

      <FeedWrapper>
        <PageHeader title="1000 Basic Words" />

        {lessons.length === 0 ? (
          <div className="border-2 rounded-xl p-8 text-center text-muted-foreground">
            No data yet. Run the Supabase seed (see README) to load 1000 words.
          </div>
        ) : (
          <ul className="flex flex-col gap-y-3">
            {lessons.map((l) => {
              const pct = l.total_words ? Math.round((l.learned_words / l.total_words) * 100) : 0;
              const started = l.learned_words > 0;
              const done = l.total_words > 0 && l.learned_words >= l.total_words;
              return (
                <li key={l.id}>
                  <Link
                    href={`/learn/${l.id}`}
                    className={[
                      "group flex items-center gap-4 rounded-2xl border-2 border-b-4 p-3 transition active:border-b-2",
                      done
                        ? "border-green-300 bg-green-50 hover:bg-green-100"
                        : "border-slate-200 bg-white hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {/* representative image */}
                    <div
                      className={[
                        "relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-4",
                        started ? "ring-green-500/40" : "ring-slate-200",
                      ].join(" ")}
                    >
                      {l.image ? (
                        <Image src={l.image} alt={l.title_en ?? ""} fill className="object-cover" unoptimized sizes="64px" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-green-500/15 text-lg font-bold text-green-600">
                          {l.sort}
                        </div>
                      )}
                    </div>

                    {/* text + progress */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold text-neutral-700">{l.title_en}</h3>
                      <p className="truncate text-sm text-muted-foreground">
                        Topic {l.sort}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1">
                          <LevelProgressBar
                            value={pct}
                            fillClassName="from-emerald-400 to-green-500"
                            glow="#22c55e"
                            height={10}
                          />
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                          {l.learned_words}/{l.total_words}
                        </span>
                      </div>
                    </div>

                    {/* right state */}
                    <div className="flex w-10 shrink-0 items-center justify-center">
                      {done ? (
                        <CheckCircle2 className="h-7 w-7 text-green-500" />
                      ) : l.due_words > 0 ? (
                        <span className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-1 text-xs font-bold text-orange-600">
                          <Repeat className="h-3 w-3" />
                          {l.due_words}
                        </span>
                      ) : (
                        <ChevronRight className="h-6 w-6 text-slate-300 transition group-hover:text-green-500" />
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </FeedWrapper>
    </div>
  );
}
