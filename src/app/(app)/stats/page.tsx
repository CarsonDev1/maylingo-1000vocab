import { requireUserId } from "@/lib/auth";
import { getStats } from "@/lib/queries";
import { StatsClient } from "@/components/stats/StatsClient";
import FeedWrapper from "@/components/feed-wrapper";
import { PageHeader } from "@/components/page-header";

export default async function StatsPage() {
  const userId = await requireUserId();
  const data = await getStats(userId);
  return (
    <div className="px-6">
      <FeedWrapper>
        <PageHeader title="Achievements" />
        <StatsClient data={data} />
      </FeedWrapper>
    </div>
  );
}
