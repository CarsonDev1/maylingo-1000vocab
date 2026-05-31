import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams } from "expo-router";
import { getDistractorPool, getNewWordsForLesson } from "@/lib/data";
import { buildLearnSteps } from "@/lib/exercises";
import { preloadAudio } from "@/lib/audio";
import { SessionRunner } from "@/components/session/SessionRunner";
import type { ExerciseStep } from "@/types";
import { C } from "@/theme";

export default function LearnSession() {
  const { userId } = useAuth();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [steps, setSteps] = useState<ExerciseStep[] | null>(null);
  const [wordIds, setWordIds] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId || !lessonId) return;
      const id = Number(lessonId);
      const [words, pool] = await Promise.all([
        getNewWordsForLesson(userId, id),
        getDistractorPool(id, 60),
      ]);
      if (cancelled) return;
      preloadAudio(words.map((w) => w.audio_url));
      setWordIds(words.map((w) => w.id));
      setSteps(buildLearnSteps(words, pool));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, lessonId]);

  if (!userId || steps === null) return <Loading />;

  return <SessionRunner steps={steps} mode="learn" wordIds={wordIds} userId={userId} />;
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.neutral900 }}>
      <ActivityIndicator color={C.green} size="large" />
    </View>
  );
}
