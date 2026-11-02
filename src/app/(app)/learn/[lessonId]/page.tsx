import Link from "next/link";
import Image from "next/image";
import { requireUserId } from "@/lib/auth";
import { getLessonById, getLessonsWithStats, getNewWordsForLesson, getDistractorPool, getTotalXp } from "@/lib/queries";
import { unlockedFlags } from "@/lib/lesson-lock";
import { LearnClient } from "@/components/session/LearnClient";
import { Button } from "@/components/ui/button";

export default async function LearnLessonPage({ params }: { params: { lessonId: string } }) {
  const userId = await requireUserId();
  const lessonId = Number(params.lessonId);
  const lesson = await getLessonById(lessonId);
  if (!lesson) return <Notice title="Lesson not found" />;

  // Server-side guard so locked topics can't be opened by URL.
  const lessons = await getLessonsWithStats(userId);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  if (idx >= 0 && !unlockedFlags(lessons)[idx]) {
    return <Notice title="Topic locked" desc="Finish the previous topic to unlock this one." />;
  }

  const [words, pool, xpBefore] = await Promise.all([
    getNewWordsForLesson(userId, lessonId),
    getDistractorPool(lessonId, 60),
    getTotalXp(userId),
  ]);

  if (words.length === 0) {
    return (
      <Notice
        title={`You've finished "${lesson.title_en}"`}
        desc="You've learned all the words in this lesson. Review them or pick another lesson."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/review">Review</Link>
            </Button>
            <Button asChild variant="primaryOutline">
              <Link href="/lessons">Other lessons</Link>
            </Button>
          </>
        }
      />
    );
  }

  return <LearnClient words={words} pool={pool} xpBefore={xpBefore} />;
}

function Notice({ title, desc, actions }: { title: string; desc?: string; actions?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-6 text-center">
      <div className="rounded-2xl border-2 p-8">
        <Image src="/mascot.svg" width={90} height={90} alt="" className="mx-auto" />
        <h2 className="mt-4 text-xl font-bold text-neutral-700">{title}</h2>
        {desc && <p className="mt-1 text-muted-foreground">{desc}</p>}
        <div className="mt-6 flex flex-col gap-2">
          {actions ?? (
            <Button asChild variant="secondary">
              <Link href="/lessons">Back to lessons</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
