import { describe, expect, test } from "vitest";
import { normalizeUsageContexts, validateWordDetail } from "@/lib/word-detail";

describe("normalizeUsageContexts", () => {
  test("keeps a valid array of contexts", () => {
    const input = [
      { context_vi: "Khi chào hỏi", example_en: "Hi there!" },
      { context_vi: "Trong email", example_en: "Dear Sir," },
    ];
    expect(normalizeUsageContexts(input)).toEqual(input);
  });

  test("trims to at most 3 contexts", () => {
    const input = Array.from({ length: 5 }, (_, i) => ({
      context_vi: `vi ${i}`,
      example_en: `en ${i}`,
    }));
    expect(normalizeUsageContexts(input)).toHaveLength(3);
  });

  test("drops items missing or with empty fields", () => {
    const input = [
      { context_vi: "", example_en: "b" }, // empty context
      { context_vi: "a" }, // missing example
      { example_en: "b" }, // missing context
      { context_vi: "ok", example_en: "fine" }, // valid
    ];
    expect(normalizeUsageContexts(input)).toEqual([{ context_vi: "ok", example_en: "fine" }]);
  });

  test("trims whitespace and ignores extra keys", () => {
    const input = [{ context_vi: "  a  ", example_en: "  b  ", junk: 1 }];
    expect(normalizeUsageContexts(input)).toEqual([{ context_vi: "a", example_en: "b" }]);
  });

  test("returns [] for non-array input", () => {
    expect(normalizeUsageContexts(null)).toEqual([]);
    expect(normalizeUsageContexts("nope")).toEqual([]);
    expect(normalizeUsageContexts(undefined)).toEqual([]);
  });
});

describe("validateWordDetail", () => {
  test("builds a full detail from a valid object", () => {
    const detail = validateWordDetail(7, {
      definition_en: "a special right",
      nuance_vi: "trang trọng",
      usage_contexts: [{ context_vi: "a", example_en: "b" }],
    });
    expect(detail).toEqual({
      word_id: 7,
      definition_en: "a special right",
      nuance_vi: "trang trọng",
      usage_contexts: [{ context_vi: "a", example_en: "b" }],
    });
  });

  test("coerces missing usage_contexts to []", () => {
    const detail = validateWordDetail(7, { definition_en: "x", nuance_vi: "y" });
    expect(detail.usage_contexts).toEqual([]);
  });

  test("coerces non-string / empty definition and nuance to null", () => {
    expect(validateWordDetail(7, { definition_en: 123, nuance_vi: "   " })).toEqual({
      word_id: 7,
      definition_en: null,
      nuance_vi: null,
      usage_contexts: [],
    });
  });

  test("returns safe defaults for null/garbage input", () => {
    expect(validateWordDetail(7, null)).toEqual({
      word_id: 7,
      definition_en: null,
      nuance_vi: null,
      usage_contexts: [],
    });
  });
});
