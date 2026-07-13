import { describe, expect, it, test } from "vitest";
import { normalizeSlides, isDayUnlocked } from "@/lib/topic-deck";

describe("normalizeSlides", () => {
  test("keeps one valid slide of each type, drops malformed", () => {
    const raw = [
      { type: "cover", hero_word_id: 5, goal_en: "G" },
      { type: "vocab", word_ids: [1, 2, 3] },
      { type: "vocab", word_ids: [] },                 // empty -> dropped
      { type: "example", word_id: 7 },
      { type: "example" },                              // no word_id -> dropped
      { type: "attribute", word_id: null, prompt_en: "P",
        options: [{ label: "a", correct: true }, { label: "b", correct: false }], explain_en: "x" },
      { type: "attribute", prompt_en: "no opts" },      // dropped
      { type: "dialogue", title_en: "T", lines: [{ who: "a", en: "hi" }] },
      { type: "dialogue", title_en: "T", lines: [] },   // no lines -> dropped
      { type: "voice_qa", question_en: "Q", key_points: ["a"], sample_answer_en: "s" },
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
      { type: "attribute", word_id: null, prompt_en: "P",
        options: [{ label: "a", correct: false }], explain_en: null },
    ])).toEqual([]);
  });

  test("vocab word_ids are coerced to a clean number array", () => {
    const out = normalizeSlides([{ type: "vocab", word_ids: [1, "x", 2, 2.0] }]);
    const first = out[0];
    expect(first?.type).toBe("vocab");
    if (first && first.type === "vocab") expect(first.word_ids).toEqual([1, 2, 2]);
  });
});

describe("isDayUnlocked", () => {
  test("day 1 always open; N needs N-1 complete", () => {
    expect(isDayUnlocked(1, new Set())).toBe(true);
    expect(isDayUnlocked(5, new Set([4]))).toBe(true);
    expect(isDayUnlocked(5, new Set([3]))).toBe(false);
  });
});

describe("normalizeSlides — warm_up", () => {
  it("keeps a valid warm_up slide", () => {
    const out = normalizeSlides([
      { type: "warm_up", scenario_en: "You just joined a new team.", agenda: ["Vocabulary", "Key phrases", "A conversation"] },
    ]);
    expect(out).toEqual([
      { type: "warm_up", scenario_en: "You just joined a new team.", agenda: ["Vocabulary", "Key phrases", "A conversation"] },
    ]);
  });

  it("drops non-string agenda items and caps at 5", () => {
    const out = normalizeSlides([
      { type: "warm_up", scenario_en: "S", agenda: ["a", 2, "", "b", "c", "d", "e", "f"] },
    ]);
    expect(out[0]).toMatchObject({ type: "warm_up", agenda: ["a", "b", "c", "d", "e"] });
  });

  it("drops a warm_up with neither scenario nor agenda", () => {
    expect(normalizeSlides([{ type: "warm_up", scenario_en: "  ", agenda: [] }])).toEqual([]);
  });
});

describe("normalizeSlides — phrases", () => {
  it("keeps valid groups and drops empty/garbage ones", () => {
    const out = normalizeSlides([
      { type: "phrases", groups: [
        { heading_en: "Asking for help", phrases: ["I'm looking for…", "Could you help me?"] },
        { heading_en: "", phrases: ["ignored"] },
        { heading_en: "No phrases", phrases: [] },
      ] },
    ]);
    expect(out).toEqual([
      { type: "phrases", groups: [{ heading_en: "Asking for help", phrases: ["I'm looking for…", "Could you help me?"] }] },
    ]);
  });

  it("drops a phrases slide with zero valid groups", () => {
    expect(normalizeSlides([{ type: "phrases", groups: [{ heading_en: "", phrases: [] }] }])).toEqual([]);
  });
});

describe("normalizeSlides — ordering & mixed", () => {
  it("preserves order and drops unknown types", () => {
    const out = normalizeSlides([
      { type: "cover", hero_word_id: 1, goal_en: "g" },
      { type: "warm_up", scenario_en: "s", agenda: ["a"] },
      { type: "bogus" },
      { type: "recap" },
    ]);
    expect(out.map((s) => s.type)).toEqual(["cover", "warm_up", "recap"]);
  });
});
