import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getNotebook } from "@/lib/data";
import { useFocusData } from "@/lib/useFocusData";
import { playAudio } from "@/lib/audio";
import type { WordWithProgress } from "@/types";
import { C, LEVEL_COLORS, LEVEL_LABELS, radius } from "@/theme";

export default function NotebookTab() {
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState(0); // 0 = all

  const loader = useCallback(async (): Promise<WordWithProgress[]> => {
    if (!userId) throw new Error("no user");
    return getNotebook(userId);
  }, [userId]);

  const { data, loading } = useFocusData(loader);
  const words = data ?? [];

  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0]; // index 0 = all
    for (const w of words) {
      c[0]++;
      const lv = w.progress?.memory_level ?? 1;
      if (lv >= 1 && lv <= 5) c[lv]++;
    }
    return c;
  }, [words]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      if (level && (w.progress?.memory_level ?? 1) !== level) return false;
      if (!q) return true;
      return w.term.toLowerCase().includes(q) || (w.meaning_vi ?? "").toLowerCase().includes(q);
    });
  }, [words, query, level]);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.green} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.slate50, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Text style={styles.title}>Sổ tay · {counts[0]} từ</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm từ hoặc nghĩa..."
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={LEVEL_LABELS.map((label, i) => ({ label, i }))}
          keyExtractor={(it) => String(it.i)}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
          renderItem={({ item }) => {
            const active = level === item.i;
            const dot = item.i === 0 ? C.muted : LEVEL_COLORS[item.i - 1];
            return (
              <Pressable
                onPress={() => setLevel(item.i)}
                style={[styles.chip, active && { backgroundColor: C.green600, borderColor: C.green600 }]}
              >
                {item.i > 0 && <View style={[styles.dot, { backgroundColor: active ? C.white : dot }]} />}
                <Text style={[styles.chipText, active && { color: C.white }]}>
                  {item.label} ({counts[item.i]})
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(w) => String(w.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có từ nào ở đây.</Text>}
        renderItem={({ item }) => <NotebookRow word={item} />}
      />
    </View>
  );
}

function NotebookRow({ word }: { word: WordWithProgress }) {
  const lv = word.progress?.memory_level ?? 1;
  return (
    <View style={styles.row}>
      <View style={styles.thumbWrap}>
        {word.image_url ? (
          <Image source={{ uri: word.image_url }} style={styles.thumb} contentFit="cover" />
        ) : (
          <Ionicons name="image-outline" size={20} color={C.muted} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.term}>{word.term}</Text>
          <Pressable onPress={() => playAudio(word.audio_url)} hitSlop={8}>
            <Ionicons name="volume-high" size={18} color={C.sky500} />
          </Pressable>
        </View>
        {!!word.phonetic_uk && <Text style={styles.phonetic}>/{word.phonetic_uk}/</Text>}
        {!!word.meaning_vi && <Text style={styles.meaning}>{word.meaning_vi}</Text>}
      </View>
      <View style={[styles.levelBadge, { backgroundColor: LEVEL_COLORS[lv - 1] }]}>
        <Text style={styles.levelText}>Mức {lv}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.slate50 },
  title: { fontSize: 22, fontWeight: "900", color: C.textDark },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 16, color: C.textDark },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: "700", color: C.text },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  thumbWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: C.slate100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: { width: 48, height: 48 },
  term: { fontSize: 16, fontWeight: "800", color: C.textDark },
  phonetic: { fontSize: 13, color: C.muted },
  meaning: { fontSize: 14, color: C.text },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  levelText: { color: C.white, fontSize: 11, fontWeight: "800" },
  empty: { textAlign: "center", color: C.muted, marginTop: 40 },
});
