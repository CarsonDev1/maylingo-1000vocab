import Link from "next/link";
import Image from "next/image";
import { currentUser } from "@clerk/nextjs/server";
import { requireUserId } from "@/lib/auth";
import { getDashboardData, getReviewStatus } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { GoldenMoment } from "@/components/golden-moment";
import { Progress } from "@/components/ui/progress";
import FeedWrapper from "@/components/feed-wrapper";
import StickyWrapper from "@/components/sticky-wrapper";
import UserProgress from "@/components/user-progress";
import { PageHeader } from "@/components/page-header";

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

  return (
    <div className="flex flex-row-reverse gap-[48px] px-6">
      <StickyWrapper>
        <UserProgress points={data.learnedWords} streak={data.streak.current_streak} />

        <div className="border-2 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-neutral-700">Mục tiêu hôm nay</h3>
            <span className="text-sm text-muted-foreground">{learnedToday}/{goal}</span>
          </div>
          <Progress value={goalPct} className="h-3" />
          <p className="text-xs text-muted-foreground">
            Học hoặc ôn mỗi ngày để giữ chuỗi streak 🔥
          </p>
        </div>

        <div className="border-2 rounded-xl p-4 space-y-2">
          <h3 className="font-bold text-neutral-700">Tiến độ khóa học</h3>
          <Progress value={overallPct} className="h-3" />
          <p className="text-sm text-muted-foreground">
            {data.learnedWords}/{data.totalWords} từ · streak dài nhất {data.streak.longest_streak} ngày
          </p>
        </div>
      </StickyWrapper>

      <FeedWrapper>
        <PageHeader title="Trang chủ" />
        <div className="flex flex-col items-center text-center gap-y-6 pt-4">
          <Image src="/mascot.svg" width={120} height={120} alt="Mascot" />
          <div>
            <h2 className="text-2xl font-bold text-neutral-700">
              Chào {user?.firstName || user?.username || "bạn"}!
            </h2>
            <p className="text-muted-foreground">Hôm nay học gì nào?</p>
          </div>

          <div className="w-full max-w-[480px] flex flex-col gap-y-4">
            <Button asChild size="lg" variant="secondary" className="w-full">
              <Link href="/lessons">Học từ mới</Link>
            </Button>
            {review.dueNow > 0 ? (
              <Button asChild size="lg" variant="primary" className="w-full">
                <Link href="/review">Ôn tập ({review.dueNow})</Link>
              </Button>
            ) : review.nextDueAt ? (
              <GoldenMoment nextDueAt={review.nextDueAt} prepCount={review.prepCount} />
            ) : (
              <Button size="lg" variant="primary" className="w-full" disabled>
                <span>Không có từ cần ôn</span>
              </Button>
            )}
          </div>
        </div>
      </FeedWrapper>
    </div>
  );
}
