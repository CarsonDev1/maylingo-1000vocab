import { requireUserId } from "@/lib/auth";
import { getLessonsWithStats, getTotalXp, getLearnedWordsGroupedByLesson } from "@/lib/queries";
import FeedWrapper from "@/components/feed-wrapper";
import { PageHeader } from "@/components/page-header";
import WritingClient from "@/components/writing/WritingClient";

export const dynamic = "force-dynamic";

export default async function WritingPage() {
  const userId = await requireUserId();
  const [lessons, xpBefore, wordsByLesson] = await Promise.all([
    getLessonsWithStats(userId),
    getTotalXp(userId),
    getLearnedWordsGroupedByLesson(userId),
  ]);

  return (
    <div className="px-6">
      <FeedWrapper>
        <PageHeader title="Writing Practice" />
        <WritingClient lessons={lessons} wordsByLesson={wordsByLesson} xpBefore={xpBefore} />
      </FeedWrapper>
    </div>
  );
}
