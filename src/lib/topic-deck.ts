import type {
  AttributeOption, AttributeSlide, TopicSlide, VocabSlide, VoiceQaSlide, Word,
} from "@/types";

function cleanString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
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

function normalizeSlide(raw: unknown): TopicSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  switch (o.type) {
    case "vocab": {
      if (typeof o.word_id !== "number") return null;
      const s: VocabSlide = { type: "vocab", word_id: o.word_id };
      return s;
    }
    case "attribute": {
      const prompt_en = cleanString(o.prompt_en);
      const prompt_vi = cleanString(o.prompt_vi);
      const options = normalizeOptions(o.options);
      if (!prompt_en || !prompt_vi || options.length < 2) return null;
      if (!options.some((x) => x.correct)) return null;
      const s: AttributeSlide = {
        type: "attribute",
        word_id: typeof o.word_id === "number" ? o.word_id : null,
        prompt_en, prompt_vi, options, explain_vi: cleanString(o.explain_vi),
      };
      return s;
    }
    case "voice_qa": {
      const question_en = cleanString(o.question_en);
      const question_vi = cleanString(o.question_vi);
      if (!question_en || !question_vi) return null;
      const s: VoiceQaSlide = {
        type: "voice_qa",
        question_en, question_vi,
        key_points: normalizeStrings(o.key_points, 5),
        sample_answer_en: cleanString(o.sample_answer_en),
      };
      return s;
    }
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

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 4-option multiple choice for a vocab word: its term + 3 distractor terms. */
export function buildVocabOptions(word: Word, pool: Word[]): { label: string; correct: boolean }[] {
  const distractors = shuffle(
    pool.filter((p) => p.id !== word.id && p.term && p.term !== word.term).map((p) => p.term),
  ).slice(0, 3);
  const options = [{ label: word.term, correct: true }, ...distractors.map((label) => ({ label, correct: false }))];
  return shuffle(options);
}

/** Day 1 is always open; a later day opens once the previous day is completed. */
export function isDayUnlocked(dayNo: number, completedDays: Set<number>): boolean {
  return dayNo <= 1 || completedDays.has(dayNo - 1);
}
