/** Validation for user-written personal example sentences (B3). */

export const MIN_WORDS = 3;
export const MAX_WORDS = 40;

export interface ExampleValidation {
  ok: boolean;
  wordCount: number;
  error: string | null;
}

export function validateExampleText(text: string): ExampleValidation {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  if (wordCount === 0) return { ok: false, wordCount, error: "Hãy viết một câu ví dụ." };
  if (wordCount < MIN_WORDS)
    return { ok: false, wordCount, error: `Câu quá ngắn (tối thiểu ${MIN_WORDS} từ).` };
  if (wordCount > MAX_WORDS)
    return { ok: false, wordCount, error: `Câu quá dài (tối đa ${MAX_WORDS} từ).` };
  return { ok: true, wordCount, error: null };
}
