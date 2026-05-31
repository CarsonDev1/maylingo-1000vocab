import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ExerciseStep } from "@/types";
import { finishReviewSession, learnWords, submitReview } from "@/lib/data";
import { playSfx } from "@/lib/audio";
import { ExerciseView } from "@/components/session/ExerciseView";
import { Button, ProgressBar } from "@/components/ui";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { MASCOT } from "@/logo";
import { C, radius } from "@/theme";

export function SessionRunner({
  steps,
  mode,
  wordIds,
  userId,
}: {
  steps: ExerciseStep[];
  mode: "learn" | "review";
  wordIds: number[];
  userId: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const committed = useRef(false);

  const total = steps.length;

  function goHome() {
    router.replace("/(tabs)");
  }

  function handleNext(result: boolean | null) {
    const step = steps[index];
    let nextCorrect = correct;
    let nextReviewed = reviewed;
    if (mode === "review" && result !== null) {
      void submitReview(userId, step.word.id, result).catch(() => {});
      nextReviewed = reviewed + 1;
      setReviewed(nextReviewed);
      if (result) {
        nextCorrect = correct + 1;
        setCorrect(nextCorrect);
      }
    } else if (result === true) {
      nextCorrect = correct + 1;
      setCorrect(nextCorrect);
    }
    if (index + 1 >= total) finish(nextReviewed, nextCorrect);
    else setIndex((i) => i + 1);
  }

  async function finish(finalReviewed: number, finalCorrect: number) {
    setFinished(true);
    playSfx("finish");
    if (committed.current) return;
    committed.current = true;
    setSaving(true); // show the mascot loading overlay while the result is persisted
    const startedAt = Date.now();
    try {
      if (mode === "learn") await learnWords(userId, wordIds);
      else await finishReviewSession(userId, finalReviewed, finalCorrect);
    } catch {
      // ignore — results are shown regardless of a save failure
    }
    // keep the overlay up long enough to actually be seen (and to clear the
    // result sheet's dismiss animation) even when the save returns instantly
    const elapsed = Date.now() - startedAt;
    if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed));
    setSaving(false);
  }

  // ----- empty -----
  if (total === 0) {
    return (
      <Overlay insetTop={insets.top}>
        <View style={styles.centerFill}>
          <View style={styles.darkCard}>
            <Text style={styles.emoji}>😴</Text>
            <Text style={styles.finishTitle}>Không có gì để học ở đây</Text>
            <Text style={styles.finishSub}>Hãy quay lại sau hoặc chọn bài khác.</Text>
            <Button title="Về trang chủ" variant="secondary" style={{ marginTop: 20 }} onPress={goHome} />
          </View>
        </View>
      </Overlay>
    );
  }

  // ----- finished -----
  if (finished) {
    const graded = mode === "review" ? reviewed : steps.filter((s) => s.type !== "flashcard").length;
    const acc = graded ? Math.round((correct / graded) * 100) : 100;
    return (
      <Overlay insetTop={insets.top}>
        <View style={styles.centerFill}>
          <View style={styles.darkCard}>
            <Text style={styles.emoji}>🎉</Text>
            <Text style={styles.finishTitle}>Hoàn thành!</Text>
            <Text style={styles.finishSub}>
              {mode === "learn" ? `Bạn đã học ${wordIds.length} từ mới.` : `Bạn đã ôn ${reviewed} từ.`}
            </Text>
            <View style={styles.tileRow}>
              <View style={[styles.tile, { borderColor: "rgba(251,146,60,0.6)", backgroundColor: C.orangeSoft }]}>
                <Text style={[styles.tileValue, { color: C.orange }]}>+{correct * 5}</Text>
                <Text style={styles.tileLabel}>XP</Text>
              </View>
              <View style={[styles.tile, { borderColor: "rgba(56,189,248,0.6)", backgroundColor: C.skySoft }]}>
                <Text style={[styles.tileValue, { color: C.sky }]}>{acc}%</Text>
                <Text style={styles.tileLabel}>Chính xác</Text>
              </View>
            </View>
            <View style={{ gap: 10, marginTop: 24 }}>
              <Button title="Về trang chủ" variant="secondary" onPress={goHome} />
              <Button
                title={mode === "learn" ? "Học bài khác" : "Ôn tiếp"}
                variant="primaryOutline"
                onPress={() => (mode === "learn" ? goHome() : router.replace("/review-session"))}
              />
            </View>
          </View>
        </View>
        <LoadingOverlay visible={saving} message="Đang lưu kết quả..." />
      </Overlay>
    );
  }

  // ----- running -----
  const pct = Math.max(0, Math.min(100, (index / total) * 100));
  return (
    <Overlay insetTop={insets.top}>
      <View style={styles.header}>
        <Pressable onPress={() => setConfirmOpen(true)} hitSlop={12}>
          <Ionicons name="close" size={28} color={C.neutral400} />
        </Pressable>
        <View style={styles.progressWrap}>
          <ProgressBar value={pct} height={16} track="rgba(255,255,255,0.9)" fill={C.green} />
          <Image source={MASCOT} style={[styles.progressMascot, { left: `${pct}%` as `${number}%` }]} contentFit="contain" />
        </View>
        <Text style={styles.counter}>
          {index + 1}/{total}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ExerciseView key={index} step={steps[index]} onNext={handleNext} />
      </ScrollView>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmEmoji}>😟</Text>
            <Text style={styles.confirmTitle}>Thoát bài học?</Text>
            <Text style={styles.confirmDesc}>Thoát bây giờ thì toàn bộ kết quả học sẽ không được lưu lại đó.</Text>
            <View style={{ gap: 10, marginTop: 18, width: "100%" }}>
              <Button title="Tiếp tục học" variant="secondary" onPress={() => setConfirmOpen(false)} />
              <Button title="Thoát" variant="ghost" textStyle={{ color: C.rose }} onPress={goHome} />
            </View>
          </View>
        </View>
      </Modal>
    </Overlay>
  );
}

function Overlay({ children, insetTop }: { children: React.ReactNode; insetTop: number }) {
  return (
    <View style={[styles.overlay, { paddingTop: insetTop }]}>
      <StatusBar style="light" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: C.neutral900 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  counter: { color: C.neutral400, fontWeight: "700", fontSize: 13, minWidth: 40, textAlign: "right" },
  scrollContent: { padding: 16, paddingBottom: 48, flexGrow: 1, justifyContent: "center" },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  darkCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: C.neutral800,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: C.neutral700,
    padding: 28,
    alignItems: "center",
  },
  emoji: { fontSize: 56 },
  finishTitle: { color: C.white, fontSize: 24, fontWeight: "800", marginTop: 12 },
  finishSub: { color: C.neutral300, fontSize: 15, marginTop: 4, textAlign: "center" },
  tileRow: { flexDirection: "row", gap: 12, marginTop: 24, width: "100%" },
  tile: { flex: 1, borderRadius: radius.lg, borderWidth: 2, padding: 16, alignItems: "center" },
  tileValue: { fontSize: 24, fontWeight: "800" },
  tileLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", color: C.neutral400, marginTop: 2 },

  progressWrap: { flex: 1, height: 30, justifyContent: "center" },
  progressMascot: { position: "absolute", top: 0, width: 30, height: 30, transform: [{ translateX: -15 }] },

  confirmBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", padding: 24 },
  confirmCard: { width: "100%", maxWidth: 360, backgroundColor: C.white, borderRadius: radius.xl, padding: 24, alignItems: "center" },
  confirmEmoji: { fontSize: 44 },
  confirmTitle: { fontSize: 18, fontWeight: "800", color: C.textDark, marginTop: 8 },
  confirmDesc: { fontSize: 14, color: C.muted, textAlign: "center", marginTop: 4 },
});
