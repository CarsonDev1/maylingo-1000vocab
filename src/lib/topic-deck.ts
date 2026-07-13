import type { AttributeOption, DialogueLine, PhraseGroup, TopicSlide } from "@/types";

function cleanString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
function numberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
}
function normalizeOptions(input: unknown): AttributeOption[] {
  if (!Array.isArray(input)) return [];
  const out: AttributeOption[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const label = cleanString((item as Record<string, unknown>).label);
    if (!label) continue;
    out.push({ label, correct: (item as Record<string, unknown>).correct === true });
    if (out.length === 4) break;
  }
  return out;
}
function normalizeStrings(input: unknown, max: number): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const item of input) {
    const s = cleanString(item);
    if (s) out.push(s);
    if (out.length === max) break;
  }
  return out;
}
function normalizePhraseGroups(input: unknown): PhraseGroup[] {
  if (!Array.isArray(input)) return [];
  const out: PhraseGroup[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const heading_en = cleanString(o.heading_en);
    const phrases = normalizeStrings(o.phrases, 4);
    if (heading_en && phrases.length) out.push({ heading_en, phrases });
    if (out.length === 3) break;
  }
  return out;
}
function normalizeLines(input: unknown): DialogueLine[] {
  if (!Array.isArray(input)) return [];
  const out: DialogueLine[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const en = cleanString(o.en);
    if (!en) continue;
    out.push({ who: o.who === "b" ? "b" : "a", en });
    if (out.length === 6) break;
  }
  return out;
}

function normalizeSlide(raw: unknown): TopicSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  switch (o.type) {
    case "cover":
      return {
        type: "cover",
        hero_word_id: typeof o.hero_word_id === "number" ? o.hero_word_id : null,
        goal_en: cleanString(o.goal_en),
      };
    case "warm_up": {
      const scenario_en = cleanString(o.scenario_en);
      const agenda = normalizeStrings(o.agenda, 5);
      if (!scenario_en && agenda.length === 0) return null;
      return { type: "warm_up", scenario_en: scenario_en ?? "", agenda };
    }
    case "phrases": {
      const groups = normalizePhraseGroups(o.groups);
      return groups.length ? { type: "phrases", groups } : null;
    }
    case "vocab": {
      const word_ids = numberArray(o.word_ids);
      return word_ids.length ? { type: "vocab", word_ids } : null;
    }
    case "example":
      return typeof o.word_id === "number" ? { type: "example", word_id: o.word_id } : null;
    case "attribute": {
      const prompt_en = cleanString(o.prompt_en);
      const options = normalizeOptions(o.options);
      if (!prompt_en || options.length < 2 || !options.some((x) => x.correct)) return null;
      return {
        type: "attribute",
        word_id: typeof o.word_id === "number" ? o.word_id : null,
        prompt_en, options, explain_en: cleanString(o.explain_en),
      };
    }
    case "dialogue": {
      const title_en = cleanString(o.title_en) ?? "";
      const lines = normalizeLines(o.lines);
      return lines.length ? { type: "dialogue", title_en, lines } : null;
    }
    case "voice_qa": {
      const question_en = cleanString(o.question_en);
      if (!question_en) return null;
      return {
        type: "voice_qa",
        question_en,
        key_points: normalizeStrings(o.key_points, 5),
        sample_answer_en: cleanString(o.sample_answer_en),
      };
    }
    case "recap":
      return { type: "recap" };
    default:
      return null;
  }
}

/** Parse stored/AI slide JSON into a clean typed array, dropping malformed items. */
export function normalizeSlides(raw: unknown): TopicSlide[] {
  if (!Array.isArray(raw)) return [];
  const out: TopicSlide[] = [];
  for (const item of raw) {
    const s = normalizeSlide(item);
    if (s) out.push(s);
  }
  return out;
}

/** Day 1 is always open; a later day opens once the previous day is completed. */
export function isDayUnlocked(dayNo: number, completedDays: Set<number>): boolean {
  return dayNo <= 1 || completedDays.has(dayNo - 1);
}
