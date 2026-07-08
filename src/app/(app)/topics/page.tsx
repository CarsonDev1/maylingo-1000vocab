import { TopicRoadmap } from "@/components/topics/TopicRoadmap";

export const metadata = { title: "Lộ trình 30 ngày" };

export default function TopicsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-extrabold text-neutral-700">Lộ trình 30 ngày</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mỗi ngày một chủ đề giao tiếp cho môi trường làm việc đa quốc gia — học qua slide tương tác và luyện nói với AI.
      </p>
      <TopicRoadmap />
    </div>
  );
}
