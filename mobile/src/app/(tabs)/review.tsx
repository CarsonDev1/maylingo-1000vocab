import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getReviewStatus, type ReviewStatus } from "@/lib/data";
import { useFocusData } from "@/lib/useFocusData";
import { Button, Card } from "@/components/ui";
import { C, radius } from "@/theme";

function fmt(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((x) => String(x).padStart(2, "0")).join(":");
}

function Countdown({ target, onReached }: { target: number; onReached: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = target - now;
  const done = remaining <= 0;
  useEffect(() => {
    if (done) onReached();
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={styles.timer}>
      <Ionicons name="hourglass-outline" size={20} color={C.muted} />
      <Text style={styles.timerText}>{fmt(remaining)}</Text>
    </View>
  );
}

export default function ReviewTab() {
  const { userId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const loader = useCallback(async (): Promise<ReviewStatus> => {
    if (!userId) throw new Error("no user");
    return getReviewStatus(userId);
  }, [userId]);

  const { data, loading, reload } = useFocusData(loader);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.green} size="large" />
      </View>
    );
  }
  if (!data) return <View style={styles.center} />;

  const { dueNow, nextDueAt, prepCount } = data;

  return (
    <ScrollView
      style={{ backgroundColor: C.slate50 }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, gap: 16 }}
    >
      <Text style={styles.title}>Ôn tập</Text>

      {dueNow > 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: 28 }}>
          <Text style={styles.bigNum}>{dueNow}</Text>
          <Text style={styles.sub}>từ đã tới "Thời điểm vàng"</Text>
          <Button
            title="Bắt đầu ôn tập"
            variant="secondary"
            style={{ marginTop: 20, alignSelf: "stretch" }}
            onPress={() => router.push("/review-session")}
          />
        </Card>
      ) : nextDueAt ? (
        <Card style={{ alignItems: "center", paddingVertical: 26 }}>
          <Text style={{ fontSize: 44 }}>⏳</Text>
          <Text style={styles.goldenTitle}>Hẹn gặp lại bạn vào "Thời điểm vàng"</Text>
          <Text style={styles.sub}>
            Chuẩn bị ôn tập: <Text style={{ color: C.orange500, fontWeight: "800" }}>{prepCount} từ</Text>
          </Text>
          <Countdown target={new Date(nextDueAt).getTime()} onReached={reload} />
          <Button
            title="Học từ mới"
            variant="secondary"
            style={{ marginTop: 18, alignSelf: "stretch" }}
            onPress={() => router.navigate("/(tabs)")}
          />
        </Card>
      ) : (
        <Card style={{ alignItems: "center", paddingVertical: 28 }}>
          <Text style={{ fontSize: 48 }}>📚</Text>
          <Text style={styles.emptyTitle}>Chưa có từ nào để ôn</Text>
          <Text style={styles.sub}>Hãy học từ mới ở tab "Học" để mở khoá Thời điểm vàng.</Text>
          <Button
            title="Học từ mới"
            variant="secondaryOutline"
            style={{ marginTop: 18, alignSelf: "stretch" }}
            onPress={() => router.navigate("/(tabs)")}
          />
        </Card>
      )}

      <Card>
        <Text style={styles.cardLabel}>"Thời điểm vàng" là gì?</Text>
        <Text style={styles.cardBody}>
          Sau khi học, mỗi từ được hẹn ôn lại đúng lúc bạn sắp quên (lần đầu ~1 giờ, rồi giãn dần theo đường cong quên
          lãng). Ôn đúng "thời điểm vàng" giúp nhớ lâu hơn nhiều so với học nhồi.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.slate50 },
  title: { fontSize: 24, fontWeight: "900", color: C.textDark },
  bigNum: { fontSize: 64, fontWeight: "900", color: C.green600 },
  sub: { fontSize: 15, color: C.muted, marginTop: 2, textAlign: "center" },
  goldenTitle: { fontSize: 17, fontWeight: "800", color: C.green600, marginTop: 8, textAlign: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: C.textDark, marginTop: 8 },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.slate100,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 14,
  },
  timerText: { fontSize: 22, fontWeight: "800", color: C.textDark, letterSpacing: 1, fontVariant: ["tabular-nums"] },
  cardLabel: { fontSize: 14, fontWeight: "800", color: C.text, marginBottom: 6 },
  cardBody: { fontSize: 14, color: C.muted, lineHeight: 21 },
});
