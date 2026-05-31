import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth, useClerk, useUser } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getOrCreateStreak, setDailyGoal } from "@/lib/data";
import { useFocusData } from "@/lib/useFocusData";
import { Button, Card } from "@/components/ui";
import type { Streak } from "@/types";
import { C, radius } from "@/theme";

export default function SettingsTab() {
  const { userId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const insets = useSafeAreaInsets();

  const loader = useCallback(async (): Promise<Streak> => {
    if (!userId) throw new Error("no user");
    return getOrCreateStreak(userId);
  }, [userId]);
  const { data, loading } = useFocusData(loader);

  const [goal, setGoal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.green} size="large" />
      </View>
    );
  }

  const goalText = goal ?? (data ? String(data.daily_goal) : "20");
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.username ?? "—";

  async function save() {
    if (!userId) return;
    const n = parseInt(goalText, 10);
    if (!Number.isFinite(n)) return;
    setSaving(true);
    setSaved(false);
    try {
      await setDailyGoal(userId, n);
      setSaved(true);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: C.slate50 }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, gap: 16 }}
    >
      <Text style={styles.title}>Cài đặt</Text>

      <Card>
        <Text style={styles.label}>Mục tiêu hằng ngày</Text>
        <Text style={styles.hint}>Số từ học/ôn mỗi ngày để giữ streak (từ 5 đến 200).</Text>
        <TextInput
          style={styles.input}
          value={goalText}
          onChangeText={(t) => {
            setGoal(t.replace(/[^0-9]/g, ""));
            setSaved(false);
          }}
          keyboardType="number-pad"
          maxLength={3}
          placeholder="20"
          placeholderTextColor={C.muted}
        />
        <Button title={saving ? "Đang lưu..." : "Lưu"} variant="secondary" loading={saving} onPress={save} />
        {saved && <Text style={styles.saved}>Đã lưu mục tiêu ✓</Text>}
      </Card>

      <Card>
        <Text style={styles.label}>Tài khoản</Text>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.hint}>Dùng chung với phiên bản web.</Text>
        <Button title="Đăng xuất" variant="primaryOutline" style={{ marginTop: 8 }} onPress={() => signOut()} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.slate50 },
  title: { fontSize: 24, fontWeight: "900", color: C.textDark },
  label: { fontSize: 16, fontWeight: "800", color: C.textDark, marginBottom: 4 },
  hint: { fontSize: 13, color: C.muted, marginBottom: 12 },
  input: {
    height: 52,
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: "700",
    color: C.textDark,
    backgroundColor: C.white,
    marginBottom: 12,
    textAlign: "center",
  },
  saved: { color: C.green600, fontWeight: "700", textAlign: "center", marginTop: 10 },
  email: { fontSize: 15, color: C.text, marginBottom: 2 },
});
