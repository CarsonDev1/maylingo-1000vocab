import Link from "next/link";
import Image from "next/image";
import { currentUser } from "@clerk/nextjs/server";
import { requireUserId } from "@/lib/auth";
import { getDashboardData, getReviewStatus } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { GoldenMoment } from "@/components/golden-moment";
import FeedWrapper from "@/components/feed-wrapper";
import StickyWrapper from "@/components/sticky-wrapper";
import UserProgress from "@/components/user-progress";
import { PageHeader } from "@/components/page-header";
import { LevelCard } from "@/components/level/LevelCard";
import { LevelProgressBar } from "@/components/level/LevelProgressBar";
import type { GamificationStats } from "@/lib/badges";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const [data, user, review] = await Promise.all([
    getDashboardData(userId),
    currentUser(),
    getReviewStatus(userId),
  ]);

  const learnedToday =
    (data.todayActivity?.words_learned ?? 0) + (data.todayActivity?.words_reviewed ?? 0);
  const goal = data.streak.daily_goal;
  const goalPct = Math.min(100, Math.round((learnedToday / Math.max(1, goal)) * 100));
  const overallPct = data.totalWords ? Math.round((data.learnedWords / data.totalWords) * 100) : 0;

  const stats: GamificationStats = {
    totalXp: data.totalXp,
    learnedWords: data.learnedWords,
    totalWords: data.totalWords,
    masteredWords: data.masteredWords,
    currentStreak: data.streak.current_streak,
    longestStreak: data.streak.longest_streak,
  };

  return (
    <div className="flex flex-row-reverse gap-[48px] px-6">
      <StickyWrapper>
        <UserProgress stats={stats} />

        <div className="space-y-3 rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-neutral-700">Today&apos;s goal</h3>
            <span className="text-sm font-extrabold text-amber-500">{learnedToday}/{goal}</span>
          </div>
          <LevelProgressBar value={goalPct} fillClassName="from-amber-300 to-orange-500" glow="#f59e0b" height={14} />
          <p className="text-xs text-muted-foreground">
            Learn or review every day to keep your streak 🔥
          </p>
        </div>

        <div className="space-y-2 rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="font-bold text-neutral-700">Course progress</h3>
          <LevelProgressBar value={overallPct} fillClassName="from-emerald-400 to-green-500" glow="#22c55e" height={14} />
          <p className="text-sm text-muted-foreground">
            {data.learnedWords}/{data.totalWords} words · longest streak {data.streak.longest_streak} days
          </p>
        </div>
      </StickyWrapper>

      <FeedWrapper>
        <PageHeader title="Home" />
        <div className="flex flex-col items-center text-center gap-y-6 pt-4">
          <Image src="/mascot.svg" width={120} height={120} alt="Mascot" />
          <div>
            <h2 className="text-2xl font-bold text-neutral-700">
              Hi {user?.firstName || user?.username || "there"}!
            </h2>
            <p className="text-muted-foreground">What will you learn today?</p>
          </div>

          <div className="w-full max-w-[480px] flex flex-col gap-y-4">
            <Button asChild size="lg" variant="secondary" className="w-full">
              <Link href="/lessons">Learn new words</Link>
            </Button>
            {review.dueNow > 0 ? (
              <Button asChild size="lg" variant="primary" className="w-full">
                <Link href="/review">Review ({review.dueNow})</Link>
              </Button>
            ) : review.nextDueAt ? (
              <GoldenMoment nextDueAt={review.nextDueAt} prepCount={review.prepCount} />
            ) : (
              <Button size="lg" variant="primary" className="w-full" disabled>
                <span>No words to review</span>
              </Button>
            )}
          </div>

          <div className="w-full max-w-[480px]">
            <LevelCard stats={stats} />
          </div>
        </div>
      </FeedWrapper>
    </div>
  );
}
