import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { ExerciseOption, ExerciseStep, Word } from "@/types";
import { playAudio, playSfx } from "@/lib/audio";
import { Button } from "@/components/ui";
import { C, radius } from "@/theme";

const PROMPT: Record<string, string> = {
  choose_meaning: "Chọn nghĩa đúng",
  choose_word: "Chọn từ đúng với nghĩa",
  choose_reading: "Chọn phiên âm đúng",
  choose_image: "Chọn hình đúng",
  fill_gap_choose: "Điền từ vào chỗ trống",
  listen_choose: "Nghe và chọn từ đúng",
  underlined_meaning: "Chọn nghĩa của từ được gạch chân",
  fill_gap_type: "Gõ từ còn thiếu",
  listen_write: "Nghe và gõ lại từ",
  spell: "Điền từ",
  flashcard: "Từ mới",
};

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[.,!?;:'"]/g, "").replace(/\s+/g, " ");
}

/** Renders a sentence with the target word either blanked out or underlined. */
function Sentence({
  text,
  term,
  mode,
  baseStyle,
  highlightColor = C.green600,
}: {
  text: string;
  term: string;
  mode: "blank" | "underline";
  baseStyle?: TextStyle;
  highlightColor?: string;
}) {
  const re = new RegExp(`\\b${escapeRe(term)}\\w*\\b`, "i");
  const m = text.match(re);
  if (!m) return <Text style={baseStyle}>{text}</Text>;
  const start = m.index ?? 0;
  const before = text.slice(0, start);
  const after = text.slice(start + m[0].length);
  return (
    <Text style={baseStyle}>
      {before}
      {mode === "blank" ? (
        <Text style={{ color: C.green600, fontWeight: "800" }}> _____ </Text>
      ) : (
        <Text style={{ color: highlightColor, fontWeight: "800", textDecorationLine: "underline" }}>{m[0]}</Text>
      )}
      {after}
    </Text>
  );
}

function SpeakerButton({ url, size = 24, color = C.sky500 }: { url?: string | null; size?: number; color?: string }) {
  return (
    <Pressable onPress={() => playAudio(url)} hitSlop={10} style={{ padding: 4 }}>
      <Ionicons name="volume-high" size={size} color={color} />
    </Pressable>
  );
}

export function ExerciseView({
  step,
  onNext,
}: {
  step: ExerciseStep;
  onNext: (correct: boolean | null) => void;
}) {
  const { type, word, options } = step;
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);

  // flip animation for flashcard
  const flip = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (type === "listen_choose" || type === "listen_write" || type === "flashcard") {
      const t = setTimeout(() => playAudio(word.audio_url), 300);
      return () => clearTimeout(t);
    }
  }, [type, word.audio_url]);

  const isTyped = type === "fill_gap_type" || type === "listen_write" || type === "spell";
  const isSpell = type === "spell";
  const isImage = type === "choose_image";

  function grade(correct: boolean) {
    // Dismiss the keyboard first: presenting the result Modal while the soft keyboard is
    // still animating away makes the sheet silently fail to appear on iOS.
    Keyboard.dismiss();
    setResult(correct);
    playSfx(correct ? "correct" : "incorrect");
    if (correct) setTimeout(() => playAudio(word.audio_url), 350);
  }

  function choose(i: number, opt: ExerciseOption) {
    if (result !== null) return;
    setPicked(i);
    grade(opt.correct);
  }

  function checkTyped() {
    if (result !== null) return;
    const ok = normalize(typed) === normalize(word.term);
    setRevealed(true);
    grade(ok);
  }

  // ----- FLASHCARD -----
  if (type === "flashcard") {
    const cardAudio = flipped ? word.audio_url : word.audio_sentence_url || word.audio_url;
    const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
    const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

    function toggleFlip() {
      const next = !flipped;
      setFlipped(next);
      Animated.spring(flip, { toValue: next ? 1 : 0, friction: 8, tension: 10, useNativeDriver: true }).start();
    }

    return (
      <View style={styles.flashWrap}>
        <View style={styles.audioRow}>
          <Pressable onPress={() => playAudio(cardAudio)} style={styles.roundAudio}>
            <Ionicons name="volume-high" size={24} color={C.orange500} />
          </Pressable>
          <Pressable onPress={() => playAudio(cardAudio, 0.55)} style={styles.roundAudio}>
            <Text style={{ color: C.orange500, fontWeight: "800", fontSize: 15 }}>0.5×</Text>
          </Pressable>
        </View>

        <Pressable onPress={toggleFlip} style={styles.flashCardArea}>
          {/* FRONT */}
          <Animated.View
            style={[styles.flashFace, { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}
          >
            {word.image_url && (
              <Image source={{ uri: word.image_url }} style={styles.flashImage} contentFit="cover" transition={150} />
            )}
            <View style={{ paddingHorizontal: 8 }}>
              {word.example_en ? (
                <Sentence
                  text={word.example_en}
                  term={word.term}
                  mode="underline"
                  baseStyle={styles.flashSentence}
                  highlightColor={C.white}
                />
              ) : (
                <Text style={[styles.flashSentence, { fontWeight: "800", textDecorationLine: "underline" }]}>
                  {word.term}
                </Text>
              )}
            </View>
            <Text style={styles.flashHintTap}>Chạm để lật</Text>
          </Animated.View>

          {/* BACK */}
          <Animated.View
            style={[styles.flashFace, styles.flashBack, { transform: [{ perspective: 1200 }, { rotateY: backRotate }] }]}
          >
            <Text style={styles.flashTerm}>{word.term}</Text>
            {word.phonetic_uk && <Text style={styles.flashPhonetic}>/{word.phonetic_uk}/</Text>}
            <Text style={styles.flashMeaning}>
              {word.meaning_vi}
              {word.pos ? ` (${word.pos})` : ""}
            </Text>
            <Text style={styles.flashHintTap}>Chạm để lật</Text>
          </Animated.View>
        </Pressable>

        <Button title="Tiếp tục" variant="secondary" style={{ width: "100%" }} onPress={() => onNext(null)} />
        <Pressable onPress={() => onNext(null)}>
          <Text style={styles.knewIt}>Mình đã thuộc từ này</Text>
        </Pressable>
      </View>
    );
  }

  // ----- prompt header for MC/typed -----
  function PromptHeader() {
    switch (type) {
      case "choose_meaning":
      case "choose_reading":
        return (
          <View style={styles.promptRow}>
            <Text style={styles.promptTerm}>{word.term}</Text>
            <SpeakerButton url={word.audio_url} />
          </View>
        );
      case "choose_word":
        return <Text style={styles.promptMeaning}>{word.meaning_vi}</Text>;
      case "choose_image":
        return (
          <View style={styles.promptRow}>
            <Text style={[styles.promptTerm, { fontSize: 22 }]}>{word.term}</Text>
            <SpeakerButton url={word.audio_url} size={20} />
          </View>
        );
      case "listen_choose":
      case "listen_write":
        return (
          <Pressable onPress={() => playAudio(word.audio_url)} style={styles.bigSpeaker}>
            <Ionicons name="volume-high" size={36} color={C.white} />
          </Pressable>
        );
      case "fill_gap_choose":
      case "fill_gap_type":
        return (
          <View>
            {word.example_en ? (
              <Sentence text={word.example_en} term={word.term} mode="blank" baseStyle={styles.promptSentence} />
            ) : (
              <Text style={styles.promptSentence}>{word.meaning_vi}</Text>
            )}
            {word.meaning_vi && <Text style={styles.promptSub}>({word.meaning_vi})</Text>}
          </View>
        );
      case "underlined_meaning":
        return word.example_en ? (
          <Sentence text={word.example_en} term={word.term} mode="underline" baseStyle={styles.promptSentence} />
        ) : (
          <Text style={styles.promptSentence}>{word.term}</Text>
        );
      case "spell":
        return (
          <Text style={styles.promptMeaning}>
            {word.meaning_vi}
            {word.pos ? ` (${word.pos})` : ""}
          </Text>
        );
      default:
        return null;
    }
  }

  const show = result !== null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{PROMPT[type]}</Text>

      <View style={styles.promptBox}>
        <PromptHeader />
      </View>

      {isSpell ? (
        <SpellBoxes term={word.term} disabled={show} onCheck={(c) => grade(c)} />
      ) : isTyped ? (
        <View style={{ gap: 10 }}>
          <TextInput
            style={[
              styles.typedInput,
              result === true && { borderColor: C.green, color: C.green600 },
              result === false && { borderColor: C.rose },
            ]}
            value={typed}
            editable={!show}
            onChangeText={setTyped}
            placeholder="Nhập từ tiếng Anh..."
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={() => {
              if (result === null) checkTyped();
            }}
          />
          {revealed && result === false && (
            <Text style={styles.revealAnswer}>
              Đáp án: <Text style={{ fontWeight: "800", color: C.green600 }}>{word.term}</Text>
            </Text>
          )}
        </View>
      ) : isImage ? (
        <View style={styles.imageGrid}>
          {options?.map((opt, i) => {
            const correctShown = show && opt.correct;
            const wrongPicked = show && !opt.correct && picked === i;
            return (
              <Pressable
                key={i}
                disabled={show}
                onPress={() => choose(i, opt)}
                style={[
                  styles.imageOption,
                  correctShown && { borderColor: C.green, borderWidth: 3 },
                  wrongPicked && { borderColor: C.rose, opacity: 0.6 },
                  show && !opt.correct && !wrongPicked && { opacity: 0.5 },
                ]}
              >
                {opt.image ? (
                  <Image source={{ uri: opt.image }} style={styles.optionImage} contentFit="cover" />
                ) : (
                  <View style={styles.optionImageFallback}>
                    <Text>{opt.label}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {options?.map((opt, i) => {
            const correctShown = show && opt.correct;
            const wrongPicked = show && !opt.correct && picked === i;
            return (
              <Pressable
                key={i}
                disabled={show}
                onPress={() => choose(i, opt)}
                style={[
                  styles.option,
                  correctShown && { borderColor: C.green, backgroundColor: C.greenSoft },
                  wrongPicked && { borderColor: C.rose, backgroundColor: C.roseSoft },
                  show && !opt.correct && !wrongPicked && { opacity: 0.6 },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    correctShown && { color: C.green700 },
                    wrongPicked && { color: C.rose600 },
                  ]}
                >
                  {opt.label}
                </Text>
                {correctShown && <Ionicons name="checkmark-circle" size={22} color={C.green600} />}
                {wrongPicked && <Ionicons name="close-circle" size={22} color={C.rose} />}
              </Pressable>
            );
          })}
        </View>
      )}

      {isTyped && !isSpell && result === null ? (
        <Button title="Kiểm tra" variant="primary" disabled={!typed.trim()} onPress={checkTyped} style={{ marginTop: 16 }} />
      ) : null}

      <ResultSheet visible={show} correct={result === true} word={word} onContinue={() => onNext(result)} />
    </View>
  );
}

/** "Điền từ": type directly into the missing letter slots (MochiDemy-style). */
function SpellBoxes({
  term,
  disabled,
  onCheck,
}: {
  term: string;
  disabled: boolean;
  onCheck: (correct: boolean) => void;
}) {
  const chars = useMemo(() => term.split(""), [term]);
  const isHint = (i: number) => chars[i] !== " " && i % 3 === 0;
  const editable = (i: number) => chars[i] !== " " && !isHint(i);
  const [vals, setVals] = useState<string[]>(() =>
    chars.map((c, i) => (c === " " ? " " : isHint(i) ? c.toLowerCase() : "")),
  );
  const refs = useRef<(TextInput | null)[]>([]);
  const complete = chars.every((c, i) => c === " " || vals[i] !== "");

  useEffect(() => {
    const f = chars.findIndex((_, i) => editable(i));
    if (f < 0) return;
    const t = setTimeout(() => refs.current[f]?.focus(), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setAt(i: number, v: string) {
    setVals((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }
  function nextEditable(i: number) {
    for (let j = i + 1; j < chars.length; j++) if (editable(j)) return j;
    return -1;
  }
  function prevEditable(i: number) {
    for (let j = i - 1; j >= 0; j--) if (editable(j)) return j;
    return -1;
  }
  function handleChange(i: number, t: string) {
    if (disabled) return;
    const ch = t.slice(-1);
    if (/[a-zA-Z]/.test(ch)) {
      setAt(i, ch.toLowerCase());
      const n = nextEditable(i);
      if (n >= 0) refs.current[n]?.focus();
    }
  }
  function handleKey(i: number, key: string) {
    if (disabled || key !== "Backspace") return;
    if (vals[i]) {
      setAt(i, "");
    } else {
      const p = prevEditable(i);
      if (p >= 0) {
        setAt(p, "");
        refs.current[p]?.focus();
      }
    }
  }
  function check() {
    const assembled = chars
      .map((c, i) => (c === " " ? " " : vals[i]))
      .join("")
      .trim()
      .toLowerCase();
    onCheck(assembled === term.trim().toLowerCase());
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.spellRow}>
        {chars.map((c, i) =>
          c === " " ? (
            <View key={i} style={{ width: 12 }} />
          ) : (
            <TextInput
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={vals[i]}
              editable={!isHint(i) && !disabled}
              maxLength={1}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(t) => handleChange(i, t)}
              onKeyPress={(e) => handleKey(i, e.nativeEvent.key)}
              style={[styles.spellBox, isHint(i) ? styles.spellBoxHint : styles.spellBoxEditable]}
            />
          ),
        )}
      </View>
      <Button title="Kiểm tra" variant="primary" disabled={!complete || disabled} onPress={check} />
    </View>
  );
}

/** MochiDemy-style result sheet: slides up from the bottom with the word + Tiếp tục. */
function ResultSheet({
  visible,
  correct,
  word,
  onContinue,
}: {
  visible: boolean;
  correct: boolean;
  word: Word;
  onContinue: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onContinue}>
      <View style={styles.sheetBackdrop}>
        <View style={[styles.sheet, { borderTopColor: correct ? C.green : C.rose }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetStatusRow}>
            <Ionicons
              name={correct ? "checkmark-circle" : "close-circle"}
              size={24}
              color={correct ? C.green600 : C.rose}
            />
            <Text style={[styles.sheetStatus, { color: correct ? C.green600 : C.rose600 }]}>
              {correct ? "Chính xác!" : "Chưa chính xác"}
            </Text>
          </View>
          <View style={styles.sheetWordRow}>
            {!!word.image_url && <Image source={{ uri: word.image_url }} style={styles.sheetImg} contentFit="cover" />}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.sheetTerm}>{word.term}</Text>
                <Pressable onPress={() => playAudio(word.audio_url)} hitSlop={8}>
                  <Ionicons name="volume-high" size={20} color={C.sky500} />
                </Pressable>
              </View>
              {!!word.phonetic_uk && <Text style={styles.sheetPhonetic}>/{word.phonetic_uk}/</Text>}
              <Text style={styles.sheetMeaning}>
                {word.meaning_vi}
                {word.pos ? ` (${word.pos})` : ""}
              </Text>
            </View>
          </View>
          {!!word.example_en && <Text style={styles.sheetExample}>{word.example_en}</Text>}
          <Button
            title="Tiếp tục"
            variant={correct ? "secondary" : "danger"}
            style={{ marginTop: 16 }}
            onPress={onContinue}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // flashcard
  flashWrap: { width: "100%", maxWidth: 460, alignSelf: "center", alignItems: "center", gap: 20, paddingBottom: 20 },
  audioRow: { flexDirection: "row", gap: 16 },
  roundAudio: {
    height: 48,
    width: 48,
    borderRadius: 999,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  flashCardArea: { width: "100%", height: 400 },
  flashFace: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.neutral800,
    borderRadius: radius.xl,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    backfaceVisibility: "hidden",
  },
  flashBack: {},
  flashImage: { width: "100%", maxWidth: 260, aspectRatio: 4 / 3, borderRadius: radius.md },
  flashSentence: { color: C.white, fontSize: 18, lineHeight: 26, textAlign: "center" },
  flashTerm: { color: C.white, fontSize: 32, fontWeight: "800" },
  flashPhonetic: { color: C.neutral300, fontSize: 16 },
  flashMeaning: { color: C.white, fontSize: 17, fontWeight: "600", textAlign: "center" },
  flashHintTap: { position: "absolute", bottom: 12, right: 16, color: C.neutral400, fontSize: 12 },
  knewIt: { color: C.neutral400, fontSize: 14, textDecorationLine: "underline" },

  // exercise card
  card: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    backgroundColor: C.white,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: C.border,
    padding: 20,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: C.muted,
    marginBottom: 14,
  },
  promptBox: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.slate50,
    padding: 20,
    marginBottom: 20,
  },
  promptRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  promptTerm: { fontSize: 28, fontWeight: "800", color: C.text },
  promptMeaning: { fontSize: 22, fontWeight: "800", color: C.green600, textAlign: "center" },
  promptSentence: { fontSize: 18, textAlign: "center", color: C.text, lineHeight: 26 },
  promptSub: { fontSize: 13, color: C.muted, textAlign: "center", marginTop: 8 },
  spellHint: { fontSize: 22, color: C.muted, letterSpacing: 3, fontWeight: "700" },
  bigSpeaker: {
    height: 80,
    width: 80,
    borderRadius: 999,
    backgroundColor: C.sky,
    borderBottomWidth: 4,
    borderBottomColor: C.sky500,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },

  // options
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
  },
  optionText: { fontSize: 17, fontWeight: "700", color: C.text, flexShrink: 1 },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  imageOption: {
    width: "47%",
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.border,
    overflow: "hidden",
  },
  optionImage: { width: "100%", height: 120 },
  optionImageFallback: { height: 120, alignItems: "center", justifyContent: "center" },

  // typed
  typedInput: {
    height: 56,
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: radius.lg,
    textAlign: "center",
    fontSize: 20,
    color: C.textDark,
    backgroundColor: C.white,
  },
  revealAnswer: { textAlign: "center", fontSize: 14, color: C.text },

  banner: { borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 10 },

  // "Điền từ" letter boxes
  spellRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "center", gap: 6 },
  spellBox: {
    width: 30,
    height: 44,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    borderBottomWidth: 3,
    paddingVertical: 0,
  },
  spellBoxHint: { borderBottomColor: C.slate100, color: C.muted },
  spellBoxEditable: { borderBottomColor: C.border, color: C.textDark },

  // result bottom sheet
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 4,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHandle: { alignSelf: "center", width: 48, height: 5, borderRadius: 999, backgroundColor: C.neutral300, marginBottom: 10 },
  sheetStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sheetStatus: { fontSize: 20, fontWeight: "900" },
  sheetWordRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  sheetImg: { width: 64, height: 64, borderRadius: radius.md },
  sheetTerm: { fontSize: 24, fontWeight: "800", color: C.textDark },
  sheetPhonetic: { fontSize: 14, color: C.muted },
  sheetMeaning: { fontSize: 15, fontWeight: "600", color: C.text },
  sheetExample: { fontSize: 14, color: C.muted, marginTop: 10 },
});
