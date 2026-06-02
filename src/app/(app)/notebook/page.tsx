import { requireUserId } from "@/lib/auth";
import { getNotebook, getDashboardData } from "@/lib/queries";
import { NotebookClient } from "@/components/notebook/NotebookClient";
import FeedWrapper from "@/components/feed-wrapper";
import StickyWrapper from "@/components/sticky-wrapper";
import UserProgress from "@/components/user-progress";
import { PageHeader } from "@/components/page-header";
import type { GamificationStats } from "@/lib/badges";

export default async function NotebookPage() {
  const userId = await requireUserId();
  const [words, dash] = await Promise.all([getNotebook(userId), getDashboardData(userId)]);

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
        <PageHeader title="Notebook" />
        <NotebookClient words={words} />
      </FeedWrapper>
    </div>
  );
}
