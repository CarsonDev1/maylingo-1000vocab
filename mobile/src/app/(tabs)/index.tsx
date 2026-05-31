import { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getDashboardData, getLessonsWithStats, type DashboardData } from "@/lib/data";
import { useFocusData } from "@/lib/useFocusData";
import { Badge, Button, Card, ProgressBar } from "@/components/ui";
import type { LessonWithStats } from "@/types";
import { MASCOT } from "@/logo";
import { C, radius } from "@/theme";

type Data = { lessons: LessonWithStats[]; dash: DashboardData };

export default function LearnTab() {
  const { userId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const loader = useCallback(async (): Promise<Data> => {
    if (!userId) throw new Error("no user");
    const [lessons, dash] = await Promise.all([getLessonsWithStats(userId), getDashboardData(userId)]);
    return { lessons, dash };
  }, [userId]);

  const { data, loading } = useFocusData(loader);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.green} size="large" />
      </View>
    );
  }
  if (!data) return <View style={styles.center} />;

  const { lessons, dash } = data;
  const name = user?.firstName || user?.username || "bạn";
  const learnedToday = dash.todayActivity?.words_learned ?? 0;
  const goal = dash.streak.daily_goal || 20;
  const goalPct = Math.min(100, (learnedToday / goal) * 100);
  const overallPct = dash.totalWords ? (dash.learnedWords / dash.totalWords) * 100 : 0;

  const Header = (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      <View style={styles.topRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Image source={MASCOT} style={{ width: 44, height: 44 }} contentFit="contain" />
          <View>
            <Text style={styles.hello}>Xin chào, {name} 👋</Text>
            <Text style={styles.brand}>Maylingo</Text>
          </View>
        </View>
        <Pressable onPress={() => signOut()} hitSlop={10} style={styles.logout}>
          <Ionicons name="log-out-outline" size={22} color={C.muted} />
        </Pressable>
      </View>

      <Card>
        <View style={styles.statRow}>
          <View style={styles.streakBox}>
            <Text style={styles.fire}>🔥</Text>
            <Text style={styles.streakNum}>{dash.streak.current_streak}</Text>
            <Text style={styles.statSub}>ngày streak</Text>
          </View>
          <View style={{ flex: 1, gap: 14 }}>
            <View>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel}>Mục tiêu hôm nay</Text>
                <Text style={styles.barValue}>
                  {learnedToday}/{goal}
                </Text>
              </View>
              <ProgressBar value={goalPct} />
            </View>
            <View>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel}>Toàn khoá</Text>
                <Text style={styles.barValue}>
                  {dash.learnedWords}/{dash.totalWords}
                </Text>
              </View>
              <ProgressBar value={overallPct} fill={C.sky} />
            </View>
          </View>
        </View>
      </Card>

      <Button
        title={dash.dueToday > 0 ? `Ôn tập (${dash.dueToday})` : "Không có từ cần ôn"}
        variant="primary"
        disabled={dash.dueToday === 0}
        onPress={() => router.push("/review-session")}
      />

      <Text style={styles.sectionTitle}>1000 Từ Cơ Bản</Text>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: C.slate50 }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 24 }}
      data={lessons}
      keyExtractor={(l) => String(l.id)}
      ListHeaderComponent={Header}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => <LessonRow lesson={item} onPress={() => router.push(`/learn/${item.id}`)} />}
    />
  );
}

function LessonRow({ lesson, onPress }: { lesson: LessonWithStats; onPress: () => void }) {
  const pct = lesson.total_words ? (lesson.learned_words / lesson.total_words) * 100 : 0;
  const done = lesson.total_words > 0 && lesson.learned_words >= lesson.total_words;
  return (
    <Pressable onPress={onPress} style={[styles.lessonCard, done && { backgroundColor: "#f0fdf4" }]}>
      <View style={styles.lessonImageWrap}>
        {lesson.image ? (
          <Image source={{ uri: lesson.image }} style={styles.lessonImage} contentFit="cover" />
        ) : (
          <Text style={styles.lessonNum}>{lesson.sort}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.lessonTitle} numberOfLines={1}>
          {lesson.title_en || lesson.title_vi || `Bài ${lesson.sort}`}
        </Text>
        {!!lesson.title_vi && (
          <Text style={styles.lessonSub} numberOfLines={1}>
            {lesson.title_vi}
          </Text>
        )}
        <ProgressBar value={pct} height={8} />
      </View>
      <View style={styles.lessonRight}>
        {done ? (
          <Ionicons name="checkmark-circle" size={26} color={C.green} />
        ) : lesson.due_words > 0 ? (
          <Badge label={`Ôn ${lesson.due_words}`} color={C.orange500} />
        ) : (
          <Ionicons name="chevron-forward" size={22} color={C.muted} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.slate50 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hello: { fontSize: 15, color: C.muted },
  brand: { fontSize: 26, fontWeight: "900", color: C.green600, letterSpacing: 0.3 },
  logout: { padding: 8 },
  statRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  streakBox: { alignItems: "center", width: 84 },
  fire: { fontSize: 28 },
  streakNum: { fontSize: 24, fontWeight: "900", color: C.orange500 },
  statSub: { fontSize: 11, color: C.muted },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  barLabel: { fontSize: 13, color: C.text, fontWeight: "600" },
  barValue: { fontSize: 13, color: C.muted, fontWeight: "700" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: C.textDark, marginTop: 4 },
  lessonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: C.border,
    padding: 12,
  },
  lessonImageWrap: {
    height: 52,
    width: 52,
    borderRadius: 999,
    backgroundColor: C.slate100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  lessonImage: { height: 52, width: 52 },
  lessonNum: { fontWeight: "800", color: C.muted },
  lessonTitle: { fontSize: 15, fontWeight: "800", color: C.textDark },
  lessonSub: { fontSize: 12, color: C.muted },
  lessonRight: { minWidth: 36, alignItems: "flex-end" },
});
