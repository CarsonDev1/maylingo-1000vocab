import { describe, expect, test } from "vitest";
import { normalizeSlides, isDayUnlocked } from "@/lib/topic-deck";

describe("normalizeSlides", () => {
  test("keeps one valid slide of each type, drops malformed", () => {
    const raw = [
      { type: "cover", hero_word_id: 5, goal_en: "G", goal_vi: "Gvi" },
      { type: "vocab", word_ids: [1, 2, 3] },
      { type: "vocab", word_ids: [] },                 // empty -> dropped
      { type: "example", word_id: 7 },
      { type: "example" },                              // no word_id -> dropped
      { type: "attribute", word_id: null, prompt_en: "P", prompt_vi: "V",
        options: [{ label: "a", correct: true }, { label: "b", correct: false }], explain_vi: "x" },
      { type: "attribute", prompt_en: "no opts" },      // dropped
      { type: "dialogue", title_en: "T", lines: [{ who: "a", en: "hi", vi: "chào" }] },
      { type: "dialogue", title_en: "T", lines: [] },   // no lines -> dropped
      { type: "voice_qa", question_en: "Q", question_vi: "Qv", key_points: ["a"], sample_answer_en: "s" },
      { type: "recap" },
      { type: "nonsense" },                             // dropped
      "garbage",                                        // dropped
    ];
    expect(normalizeSlides(raw).map((s) => s.type)).toEqual([
      "cover", "vocab", "example", "attribute", "dialogue", "voice_qa", "recap",
    ]);
  });

  test("non-array input -> []", () => {
    expect(normalizeSlides(null)).toEqual([]);
    expect(normalizeSlides({})).toEqual([]);
  });

  test("attribute needs >=2 options incl. a correct one", () => {
    expect(normalizeSlides([
      { type: "attribute", word_id: null, prompt_en: "P", prompt_vi: "V",
        options: [{ label: "a", correct: false }], explain_vi: null },
    ])).toEqual([]);
  });

  test("vocab word_ids are coerced to a clean number array", () => {
    const out = normalizeSlides([{ type: "vocab", word_ids: [1, "x", 2, 2.0] }]) as any;
    expect(out[0].word_ids).toEqual([1, 2, 2]);
  });
});

describe("isDayUnlocked", () => {
  test("day 1 always open; N needs N-1 complete", () => {
    expect(isDayUnlocked(1, new Set())).toBe(true);
    expect(isDayUnlocked(5, new Set([4]))).toBe(true);
    expect(isDayUnlocked(5, new Set([3]))).toBe(false);
  });
});
