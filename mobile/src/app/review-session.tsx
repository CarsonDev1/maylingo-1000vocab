import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { getDistractorPool, getReviewQueue } from "@/lib/data";
import { buildReviewSteps } from "@/lib/exercises";
import { preloadAudio } from "@/lib/audio";
import { SessionRunner } from "@/components/session/SessionRunner";
import type { ExerciseStep } from "@/types";
import { C } from "@/theme";

export default function ReviewSession() {
  const { userId } = useAuth();
  const [steps, setSteps] = useState<ExerciseStep[] | null>(null);
  const [wordIds, setWordIds] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) return;
      const [queue, pool] = await Promise.all([getReviewQueue(userId), getDistractorPool(undefined, 80)]);
      if (cancelled) return;
      const profByWord = new Map<number, number>();
      for (const w of queue) profByWord.set(w.id, w.progress?.proficiency ?? 1);
      preloadAudio(queue.map((w) => w.audio_url));
      setWordIds(queue.map((w) => w.id));
      setSteps(buildReviewSteps(queue, pool, profByWord));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId || steps === null) return <Loading />;

  return <SessionRunner steps={steps} mode="review" wordIds={wordIds} userId={userId} />;
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.neutral900 }}>
      <ActivityIndicator color={C.green} size="large" />
    </View>
  );
}
