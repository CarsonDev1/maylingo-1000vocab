import { TopicRoadmap } from "@/components/topics/TopicRoadmap";

export const metadata = { title: "30-Day Path" };

export default function TopicsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-extrabold text-neutral-700">30-Day Path</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        One communication topic a day for the multinational workplace — learn through interactive slides and AI speaking practice.
      </p>
      <TopicRoadmap />
    </div>
  );
}
