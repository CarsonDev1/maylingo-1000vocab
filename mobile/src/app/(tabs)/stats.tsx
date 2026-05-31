import { useCallback } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getStats, type StatsData } from "@/lib/data";
import { useFocusData } from "@/lib/useFocusData";
import { Card } from "@/components/ui";
import { C, LEVEL_COLORS, LEVEL_LABELS, radius } from "@/theme";

export default function StatsTab() {
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();

  const loader = useCallback(async (): Promise<StatsData> => {
    if (!userId) throw new Error("no user");
    return getStats(userId);
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

  const s = data;
  const profMax = Math.max(1, ...s.proficiency);
  const recent = s.activity.slice(-14);
  const actMax = Math.max(1, ...recent.map((a) => a.words_learned + a.words_reviewed));

  return (
    <ScrollView
      style={{ backgroundColor: C.slate50 }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, gap: 16 }}
    >
      <Text style={styles.title}>Thành tích</Text>

      {/* stat cards */}
      <View style={styles.cardRow}>
        <StatCard value={`${s.learnedWords}`} sub={`/ ${s.totalWords} từ`} label="Đã học" color={C.green600} />
        <StatCard value={`${s.streak.current_streak}`} sub="ngày" label="Streak" color={C.orange500} />
        <StatCard value={`${s.streak.longest_streak}`} sub="ngày" label="Dài nhất" color={C.amber} />
      </View>

      {/* memory levels */}
      <Card>
        <Text style={styles.cardTitle}>Mức độ ghi nhớ</Text>
        <View style={styles.levelRow}>
          {[1, 2, 3, 4, 5].map((lv) => (
            <View key={lv} style={styles.levelCell}>
              <View style={[styles.levelTop, { backgroundColor: LEVEL_COLORS[lv - 1] }]}>
                <Text style={styles.levelCount}>{s.levels[lv]}</Text>
              </View>
              <Text style={styles.levelName}>{LEVEL_LABELS[lv]}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* proficiency distribution */}
      <Card>
        <Text style={styles.cardTitle}>Phân bố thành thạo (0–9)</Text>
        <View style={styles.barChart}>
          {s.proficiency.map((count, i) => (
            <View key={i} style={styles.barCol}>
              <Text style={styles.barCount}>{count > 0 ? count : ""}</Text>
              <View
                style={{
                  width: "70%",
                  height: Math.max(3, (count / profMax) * 110),
                  backgroundColor: `hsl(142, ${40 + i * 4}%, ${58 - i * 2}%)`,
                  borderRadius: 4,
                }}
              />
              <Text style={styles.barLabel}>{i}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* recent activity */}
      <Card>
        <Text style={styles.cardTitle}>Hoạt động gần đây</Text>
        {recent.length === 0 ? (
          <Text style={styles.noData}>Chưa có hoạt động.</Text>
        ) : (
          <>
            <View style={styles.barChart}>
              {recent.map((a, i) => {
                const lh = (a.words_learned / actMax) * 110;
                const rh = (a.words_reviewed / actMax) * 110;
                return (
                  <View key={i} style={styles.barCol}>
                    <View style={{ width: "62%", justifyContent: "flex-end", height: 110 }}>
                      {rh > 0 && <View style={{ height: rh, backgroundColor: C.orange, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />}
                      {lh > 0 && <View style={{ height: lh, backgroundColor: C.green }} />}
                    </View>
                    <Text style={styles.barLabel}>{a.activity_date.slice(8, 10)}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              <Legend color={C.green} label="Học mới" />
              <Legend color={C.orange} label="Ôn tập" />
            </View>
          </>
        )}
      </Card>
    </ScrollView>
  );
}

function StatCard({ value, sub, label, color }: { value: string; sub: string; label: string; color: string }) {
  return (
    <Card style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statSubText}>{sub}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: C.muted }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.slate50 },
  title: { fontSize: 24, fontWeight: "900", color: C.textDark },
  cardRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, alignItems: "center", padding: 12 },
  statValue: { fontSize: 26, fontWeight: "900" },
  statSubText: { fontSize: 11, color: C.muted },
  statLabel: { fontSize: 12, fontWeight: "700", color: C.text, marginTop: 4 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: C.textDark, marginBottom: 14 },
  levelRow: { flexDirection: "row", gap: 6 },
  levelCell: { flex: 1, alignItems: "center", gap: 6 },
  levelTop: { width: "100%", borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  levelCount: { color: C.white, fontWeight: "900", fontSize: 16 },
  levelName: { fontSize: 10, color: C.muted, textAlign: "center" },
  barChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 150 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3 },
  barCount: { fontSize: 9, color: C.muted },
  barLabel: { fontSize: 10, color: C.muted },
  legend: { flexDirection: "row", gap: 16, marginTop: 12, justifyContent: "center" },
  noData: { color: C.muted, textAlign: "center", paddingVertical: 16 },
});
