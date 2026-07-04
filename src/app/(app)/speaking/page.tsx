import { requireUserId } from "@/lib/auth";
import { getLessonsWithStats, getTotalXp, getLearnedWordsGroupedByLesson } from "@/lib/queries";
import FeedWrapper from "@/components/feed-wrapper";
import { PageHeader } from "@/components/page-header";
import SpeakingClient from "@/components/speaking/SpeakingClient";

export const dynamic = "force-dynamic";

export default async function SpeakingPage() {
  const userId = await requireUserId();
  const [lessons, xpBefore, wordsByLesson] = await Promise.all([
    getLessonsWithStats(userId),
    getTotalXp(userId),
    getLearnedWordsGroupedByLesson(userId),
  ]);

  return (
    <div className="px-6">
      <FeedWrapper>
        <PageHeader title="Speaking Practice" />
        <SpeakingClient lessons={lessons} wordsByLesson={wordsByLesson} xpBefore={xpBefore} />
      </FeedWrapper>
    </div>
  );
}
