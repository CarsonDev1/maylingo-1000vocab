import { describe, expect, test } from "vitest";
import { normalizePhrase, scorePronunciation } from "@/lib/pronunciation";

describe("normalizePhrase", () => {
  test("lowercases, strips punctuation, collapses whitespace", () => {
    expect(normalizePhrase("  Hello, World!  ")).toBe("hello world");
  });
});

describe("scorePronunciation", () => {
  test("exact match scores 1 and passes", () => {
    const r = scorePronunciation("privilege", "privilege");
    expect(r.matched).toBe(true);
    expect(r.score).toBe(1);
  });

  test("ignores case and punctuation", () => {
    expect(scorePronunciation("Privilege.", "privilege").matched).toBe(true);
  });

  test("a near-miss still passes above threshold", () => {
    const r = scorePronunciation("privileges", "privilege");
    expect(r.score).toBeGreaterThan(0.8);
    expect(r.matched).toBe(true);
  });

  test("a wrong word fails with a low score", () => {
    const r = scorePronunciation("banana", "privilege");
    expect(r.matched).toBe(false);
    expect(r.score).toBeLessThan(0.6);
  });

  test("empty transcript fails with score 0", () => {
    const r = scorePronunciation("", "privilege");
    expect(r.matched).toBe(false);
    expect(r.score).toBe(0);
  });

  test("reports what was heard (trimmed)", () => {
    expect(scorePronunciation("  Privilege ", "privilege").heard).toBe("Privilege");
  });
});
