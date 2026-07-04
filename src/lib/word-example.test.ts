import { describe, expect, test } from "vitest";
import { validateExampleText, MIN_WORDS, MAX_WORDS } from "@/lib/word-example";

describe("validateExampleText", () => {
  test("accepts a normal sentence", () => {
    const r = validateExampleText("I really value this privilege at work.");
    expect(r.ok).toBe(true);
    expect(r.error).toBeNull();
    expect(r.wordCount).toBe(7);
  });

  test("rejects empty input", () => {
    const r = validateExampleText("   ");
    expect(r.ok).toBe(false);
    expect(r.wordCount).toBe(0);
    expect(r.error).toBeTruthy();
  });

  test(`rejects fewer than ${MIN_WORDS} words`, () => {
    expect(validateExampleText("too short").ok).toBe(false);
  });

  test(`rejects more than ${MAX_WORDS} words`, () => {
    const long = Array.from({ length: MAX_WORDS + 1 }, () => "word").join(" ");
    expect(validateExampleText(long).ok).toBe(false);
  });

  test("counts words ignoring extra whitespace", () => {
    expect(validateExampleText("  hello   there  friend  ").wordCount).toBe(3);
  });
});
