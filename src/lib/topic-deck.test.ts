import { describe, expect, test } from "vitest";
import { normalizeSlides, buildVocabOptions, isDayUnlocked } from "@/lib/topic-deck";
import type { Word } from "@/types";

function w(id: number, term: string): Word {
  return {
    id, lesson_id: 1, term, pos: null, phonetic_uk: null, phonetic_us: null,
    meaning_vi: null, meaning_en: null, meaning_ja: null, meaning_ko: null,
    meaning_th: null, meaning_zh: null, example_en: null, example_vi: null,
    audio_url: null, audio_sentence_url: null, image_url: null,
  };
}

describe("normalizeSlides", () => {
  test("keeps valid slides of each type and drops malformed ones", () => {
    const raw = [
      { type: "vocab", word_id: 5 },
      { type: "vocab" }, // missing word_id -> dropped
      { type: "attribute", word_id: null, prompt_en: "P", prompt_vi: "P vi",
        options: [{ label: "a", correct: true }, { label: "b", correct: false }], explain_vi: "x" },
      { type: "attribute", prompt_en: "no options" }, // dropped
      { type: "voice_qa", question_en: "Q", question_vi: "Q vi", key_points: ["a", "b"], sample_answer_en: "s" },
      { type: "voice_qa", question_vi: "no english" }, // dropped
      { type: "nonsense" }, // dropped
      "garbage", // dropped
    ];
    const out = normalizeSlides(raw);
    expect(out.map((s) => s.type)).toEqual(["vocab", "attribute", "voice_qa"]);
  });

  test("non-array input yields empty array", () => {
    expect(normalizeSlides(null)).toEqual([]);
    expect(normalizeSlides({})).toEqual([]);
  });

  test("attribute requires at least one correct option", () => {
    const out = normalizeSlides([
      { type: "attribute", word_id: null, prompt_en: "P", prompt_vi: "V",
        options: [{ label: "a", correct: false }], explain_vi: null },
    ]);
    expect(out).toEqual([]);
  });
});

describe("buildVocabOptions", () => {
  test("returns 4 options with exactly one correct = the word's term", () => {
    const word = w(1, "shirt");
    const pool = [w(2, "trousers"), w(3, "jacket"), w(4, "dress"), w(5, "hat")];
    const opts = buildVocabOptions(word, pool);
    expect(opts).toHaveLength(4);
    expect(opts.filter((o) => o.correct)).toHaveLength(1);
    expect(opts.find((o) => o.correct)!.label).toBe("shirt");
    // all labels distinct
    expect(new Set(opts.map((o) => o.label)).size).toBe(4);
  });

  test("degrades gracefully when the pool is too small", () => {
    const opts = buildVocabOptions(w(1, "shirt"), [w(2, "hat")]);
    expect(opts.length).toBeGreaterThanOrEqual(2);
    expect(opts.filter((o) => o.correct)).toHaveLength(1);
  });
});

describe("isDayUnlocked", () => {
  test("day 1 is always unlocked", () => {
    expect(isDayUnlocked(1, new Set())).toBe(true);
  });
  test("day N unlocked only if N-1 completed", () => {
    expect(isDayUnlocked(5, new Set([4]))).toBe(true);
    expect(isDayUnlocked(5, new Set([3]))).toBe(false);
  });
});
