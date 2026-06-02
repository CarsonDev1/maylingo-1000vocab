import { requireUserId } from "@/lib/auth";
import { getOrCreateStreak } from "@/lib/queries";
import { SettingsClient } from "@/components/settings/SettingsClient";
import FeedWrapper from "@/components/feed-wrapper";
import { PageHeader } from "@/components/page-header";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const streak = await getOrCreateStreak(userId);
  return (
    <div className="px-6">
      <FeedWrapper>
        <PageHeader title="Settings" />
        <SettingsClient goal={streak.daily_goal} />
      </FeedWrapper>
    </div>
  );
}
