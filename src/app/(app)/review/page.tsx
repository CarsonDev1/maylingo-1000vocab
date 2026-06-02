import Link from "next/link";
import Image from "next/image";
import { requireUserId } from "@/lib/auth";
import { getReviewQueue, getDistractorPool, getReviewStatus } from "@/lib/queries";
import { ReviewClient } from "@/components/session/ReviewClient";
import { GoldenMoment } from "@/components/golden-moment";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

export default async function ReviewPage() {
  const userId = await requireUserId();
  const [words, pool, status] = await Promise.all([
    getReviewQueue(userId),
    getDistractorPool(undefined, 80),
    getReviewStatus(userId),
  ]);

  if (words.length === 0) {
    return (
      <div className="px-6">
        <PageHeader title="Ôn tập" />
        <div className="mx-auto max-w-md rounded-2xl border-2 p-8 text-center">
          <Image src="/mascot.svg" width={90} height={90} alt="" className="mx-auto" />
          {status.nextDueAt ? (
            <>
              <h2 className="mt-4 text-xl font-bold text-neutral-700">Chưa tới giờ ôn</h2>
              <div className="mt-4">
                <GoldenMoment nextDueAt={status.nextDueAt} prepCount={status.prepCount} />
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-4 text-xl font-bold text-neutral-700">Không có từ nào cần ôn 🎉</h2>
              <p className="mt-1 text-muted-foreground">
                Bạn đã ôn hết các từ tới hạn. Học thêm từ mới để có nội dung ôn tập sau này.
              </p>
              <Button asChild variant="secondary" className="mt-6">
                <Link href="/lessons">Học từ mới</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return <ReviewClient words={words} pool={pool} />;
}
