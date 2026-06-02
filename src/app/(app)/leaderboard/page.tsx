import { clerkClient } from "@clerk/nextjs/server";
import { requireUserId } from "@/lib/auth";
import { getLeaderboardRanking } from "@/lib/queries";
import { LeaderboardClient, type LeaderRow } from "@/components/leaderboard/LeaderboardClient";
import FeedWrapper from "@/components/feed-wrapper";
import { PageHeader } from "@/components/page-header";

// Ranking changes as people earn XP — always render fresh.
export const dynamic = "force-dynamic";

const TOP_N = 50;

interface Profile {
  name: string;
  imageUrl: string | null;
}

export default async function LeaderboardPage() {
  const userId = await requireUserId();
  const ranking = await getLeaderboardRanking();

  const myIndex = ranking.findIndex((e) => e.userId === userId);
  const top = ranking.slice(0, TOP_N);

  // Resolve display names + avatars from Clerk for the visible users + me.
  const ids = Array.from(new Set([...top.map((e) => e.userId), userId]));
  const profById = new Map<string, Profile>();
  if (ids.length) {
    try {
      const cc = await clerkClient();
      const res = await cc.users.getUserList({ userId: ids, limit: ids.length });
      for (const u of res.data) {
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username || "Learner";
        profById.set(u.id, { name, imageUrl: u.imageUrl ?? null });
      }
    } catch {
      // Clerk unavailable (e.g. headless) — fall back to anonymous labels.
    }
  }

  const rows: LeaderRow[] = top.map((e, i) => {
    const p = profById.get(e.userId);
    return {
      rank: i + 1,
      name: p?.name ?? "Learner",
      imageUrl: p?.imageUrl ?? null,
      totalXp: e.totalXp,
      streak: e.currentStreak,
      isMe: e.userId === userId,
    };
  });

  const me: LeaderRow | null =
    myIndex >= 0
      ? {
          rank: myIndex + 1,
          name: profById.get(userId)?.name ?? "You",
          imageUrl: profById.get(userId)?.imageUrl ?? null,
          totalXp: ranking[myIndex].totalXp,
          streak: ranking[myIndex].currentStreak,
          isMe: true,
        }
      : null;

  return (
    <div className="px-6">
      <FeedWrapper>
        <PageHeader title="Leaderboard" />
        <LeaderboardClient rows={rows} me={me} totalPlayers={ranking.length} />
      </FeedWrapper>
    </div>
  );
}
