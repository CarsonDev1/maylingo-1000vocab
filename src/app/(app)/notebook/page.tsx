import { requireUserId } from "@/lib/auth";
import { getNotebook, getDashboardData } from "@/lib/queries";
import { NotebookClient } from "@/components/notebook/NotebookClient";
import FeedWrapper from "@/components/feed-wrapper";
import StickyWrapper from "@/components/sticky-wrapper";
import UserProgress from "@/components/user-progress";
import { PageHeader } from "@/components/page-header";

export default async function NotebookPage() {
  const userId = await requireUserId();
  const [words, dash] = await Promise.all([getNotebook(userId), getDashboardData(userId)]);

  return (
    <div className="flex flex-row-reverse gap-[48px] px-6">
      <StickyWrapper>
        <UserProgress points={dash.learnedWords} streak={dash.streak.current_streak} />
      </StickyWrapper>
      <FeedWrapper>
        <PageHeader title="Sổ tay" />
        <NotebookClient words={words} />
      </FeedWrapper>
    </div>
  );
}
