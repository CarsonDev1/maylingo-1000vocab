import Link from "next/link";
import Image from "next/image";
import { requireUserId } from "@/lib/auth";
import { getLessonById, getNewWordsForLesson, getDistractorPool } from "@/lib/queries";
import { LearnClient } from "@/components/session/LearnClient";
import { Button } from "@/components/ui/button";

export default async function LearnLessonPage({ params }: { params: { lessonId: string } }) {
  const userId = await requireUserId();
  const lessonId = Number(params.lessonId);
  const lesson = await getLessonById(lessonId);
  if (!lesson) return <Notice title="Không tìm thấy bài học" />;

  const [words, pool] = await Promise.all([
    getNewWordsForLesson(userId, lessonId),
    getDistractorPool(lessonId, 60),
  ]);

  if (words.length === 0) {
    return (
      <Notice
        title={`Bạn đã học hết "${lesson.title_en}"`}
        desc="Tất cả từ trong bài này đã được học. Hãy ôn tập hoặc chọn bài khác."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/review">Ôn tập</Link>
            </Button>
            <Button asChild variant="primaryOutline">
              <Link href="/lessons">Bài khác</Link>
            </Button>
          </>
        }
      />
    );
  }

  return <LearnClient words={words} pool={pool} />;
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
              <Link href="/lessons">Về danh sách bài</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
