import type { UsageContext, WordDetail } from "@/types";

/** A trimmed, non-empty string, or null. */
function cleanString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Normalize raw `usage_contexts` (from the DB jsonb column or an AI response)
 * into at most 3 valid `{ context_vi, example_en }` items. Malformed or empty
 * items are dropped; non-array input yields [].
 */
export function normalizeUsageContexts(input: unknown): UsageContext[] {
  if (!Array.isArray(input)) return [];
  const out: UsageContext[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const context_vi = cleanString((item as Record<string, unknown>).context_vi);
    const example_en = cleanString((item as Record<string, unknown>).example_en);
    if (context_vi && example_en) out.push({ context_vi, example_en });
    if (out.length === 3) break;
  }
  return out;
}

/**
 * Build a typed `WordDetail` from a raw DB row or AI response. Non-string or
 * empty text fields become null; `usage_contexts` is always a clean array.
 */
export function validateWordDetail(wordId: number, input: unknown): WordDetail {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    word_id: wordId,
    definition_en: cleanString(obj.definition_en),
    nuance_vi: cleanString(obj.nuance_vi),
    usage_contexts: normalizeUsageContexts(obj.usage_contexts),
  };
}
