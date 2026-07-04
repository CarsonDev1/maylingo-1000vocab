import { describe, expect, test } from "vitest";
import { buildLearnSteps, buildReviewSteps, isGradedStep } from "@/lib/exercises";
import type { Word, ExerciseType } from "@/types";

function w(id: number, over: Partial<Word> = {}): Word {
  return {
    id,
    lesson_id: 1,
    term: `term${id}`,
    pos: null,
    phonetic_uk: null,
    phonetic_us: null,
    meaning_vi: `nghĩa${id}`,
    meaning_en: null,
    meaning_ja: null,
    meaning_ko: null,
    meaning_th: null,
    meaning_zh: null,
    example_en: null,
    example_vi: null,
    audio_url: null,
    audio_sentence_url: null,
    image_url: null,
    ...over,
  };
}

describe("buildLearnSteps", () => {
  test("a word WITH audio yields flashcard, pronounce, listen_write, spell, write_example in order", () => {
    const steps = buildLearnSteps([w(1, { audio_url: "a.mp3" })], []);
    expect(steps.map((s) => s.type)).toEqual([
      "flashcard",
      "pronounce",
      "listen_write",
      "spell",
      "write_example",
    ]);
    expect(steps.every((s) => s.word.id === 1)).toBe(true);
  });

  test("a word WITHOUT audio skips listen_write", () => {
    const steps = buildLearnSteps([w(2)], []);
    expect(steps.map((s) => s.type)).toEqual([
      "flashcard",
      "pronounce",
      "spell",
      "write_example",
    ]);
  });

  test("multiple words are grouped per word", () => {
    const steps = buildLearnSteps([w(1, { audio_url: "a.mp3" }), w(2)], []);
    expect(steps.map((s) => s.type)).toEqual([
      "flashcard", "pronounce", "listen_write", "spell", "write_example",
      "flashcard", "pronounce", "spell", "write_example",
    ]);
  });
});

describe("isGradedStep", () => {
  const graded: ExerciseType[] = [
    "choose_meaning", "choose_word", "choose_reading", "choose_image",
    "fill_gap_choose", "fill_gap_type", "listen_choose", "listen_write",
    "underlined_meaning", "spell",
  ];
  const nonGraded: ExerciseType[] = ["flashcard", "pronounce", "write_example"];

  test("real exercises are graded", () => {
    for (const type of graded) expect(isGradedStep({ type, word: w(1) })).toBe(true);
  });

  test("intro/practice steps are not graded", () => {
    for (const type of nonGraded) expect(isGradedStep({ type, word: w(1) })).toBe(false);
  });
});

describe("buildReviewSteps is unchanged (never emits practice steps)", () => {
  test("review steps are all graded types", () => {
    const words = [w(1, { meaning_vi: "x" }), w(2, { meaning_vi: "y" })];
    const steps = buildReviewSteps(words, [], new Map());
    expect(steps.every((s) => isGradedStep(s))).toBe(true);
  });
});
