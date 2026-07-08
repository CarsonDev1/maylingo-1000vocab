import { notFound } from "next/navigation";
import { TopicDeckClient } from "@/components/topics/TopicDeckClient";

export default function TopicDayPage({ params }: { params: { day: string } }) {
  const day = Number(params.day);
  if (!Number.isInteger(day) || day < 1 || day > 30) notFound();
  return <TopicDeckClient day={day} />;
}
