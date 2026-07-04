import type { Word, ExerciseType, ExerciseStep, ExerciseOption } from "@/types";

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

/** Build 4 multiple-choice options for a word, drawing distractors from a pool. */
function buildOptions(type: ExerciseType, word: Word, pool: Word[]): ExerciseOption[] | undefined {
  const others = pool.filter((w) => w.id !== word.id);

  const byTerm = (w: Word): ExerciseOption => ({ label: w.term, correct: w.id === word.id });
  const byMeaning = (w: Word): ExerciseOption => ({ label: w.meaning_vi ?? "—", correct: w.id === word.id });
  const byPhonetic = (w: Word): ExerciseOption => ({ label: w.phonetic_uk ?? "—", correct: w.id === word.id });
  const byImage = (w: Word): ExerciseOption => ({ label: w.term, image: w.image_url, correct: w.id === word.id });

  let map: (w: Word) => ExerciseOption;
  let valid: (w: Word) => boolean;
  switch (type) {
    case "choose_word":
    case "fill_gap_choose":
    case "listen_choose":
      map = byTerm;
      valid = (w) => !!w.term;
      break;
    case "choose_reading":
      map = byPhonetic;
      valid = (w) => !!w.phonetic_uk && w.phonetic_uk !== word.phonetic_uk;
      break;
    case "choose_image":
      map = byImage;
      valid = (w) => !!w.image_url;
      break;
    case "choose_meaning":
    case "underlined_meaning":
      map = byMeaning;
      valid = (w) => !!w.meaning_vi && w.meaning_vi !== word.meaning_vi;
      break;
    default:
      return undefined; // typed exercises have no options
  }

  const distractors = pick(others.filter(valid), 3).map(map);
  const options = shuffle([map(word), ...distractors]);
  return options;
}

const MC_TYPES: ExerciseType[] = [
  "choose_meaning",
  "choose_word",
  "choose_reading",
  "choose_image",
  "fill_gap_choose",
  "listen_choose",
  "underlined_meaning",
];

function makeStep(type: ExerciseType, word: Word, pool: Word[]): ExerciseStep {
  return { type, word, options: buildOptions(type, word, pool) };
}

/** Pick an exercise type appropriate for a word (respecting available data). */
function pickTypeFor(word: Word, pool: Word[], allow: ExerciseType[]): ExerciseType {
  const candidates = allow.filter((t) => {
    if (t === "choose_image") return !!word.image_url;
    if (t === "choose_reading") return !!word.phonetic_uk;
    if (t === "fill_gap_choose" || t === "fill_gap_type" || t === "underlined_meaning") return !!word.example_en;
    if (t === "listen_choose" || t === "listen_write") return !!word.audio_url;
    return true;
  });
  const usable = candidates.length ? candidates : ["choose_meaning" as ExerciseType];
  return usable[Math.floor(Math.random() * usable.length)];
}

/**
 * Learn-new session — the guided active-recall method. PER WORD, in order:
 *   1. flashcard      — intro card + deep understanding (B1/B4) shown inline
 *   2. pronounce      — "Đọc to" (B2): say the word aloud, mic-scored (skippable)
 *   3. listen_write   — "Listen and write" active recall (skipped if no audio)
 *   4. spell          — "Spell the word" active recall
 *   5. write_example  — "Tự đặt câu" (B3): write a personal sentence (skippable)
 * Steps 1, 2, 5 are non-graded practice/intro steps (see isGradedStep).
 */
export function buildLearnSteps(words: Word[], pool: Word[]): ExerciseStep[] {
  const fullPool = [...pool, ...words];
  const steps: ExerciseStep[] = [];
  for (const w of words) {
    steps.push(makeStep("flashcard", w, fullPool));
    steps.push(makeStep("pronounce", w, fullPool));
    if (w.audio_url) steps.push(makeStep("listen_write", w, fullPool));
    steps.push(makeStep("spell", w, fullPool));
    steps.push(makeStep("write_example", w, fullPool));
  }
  return steps;
}

/**
 * Types that count toward session accuracy — the real recall/MC/typed exercises.
 * Intro/practice steps (flashcard, pronounce, write_example) are excluded.
 */
const GRADED_TYPES = new Set<ExerciseType>([
  "choose_meaning",
  "choose_word",
  "choose_reading",
  "choose_image",
  "fill_gap_choose",
  "fill_gap_type",
  "listen_choose",
  "listen_write",
  "underlined_meaning",
  "spell",
]);

/** True when a step is a graded exercise (used for the accuracy denominator). */
export function isGradedStep(step: ExerciseStep): boolean {
  return GRADED_TYPES.has(step.type);
}

/**
 * Review session: one exercise per due word, difficulty scaled by proficiency.
 */
export function buildReviewSteps(words: Word[], pool: Word[], profByWord: Map<number, number>): ExerciseStep[] {
  const fullPool = [...pool, ...words];
  const easy: ExerciseType[] = ["choose_meaning", "choose_word", "choose_image"];
  const mid: ExerciseType[] = ["choose_reading", "fill_gap_choose", "listen_choose", "underlined_meaning", "spell"];
  const hard: ExerciseType[] = ["fill_gap_type", "listen_write", "spell"];

  return words.map((w) => {
    const p = profByWord.get(w.id) ?? 1;
    const allow = p <= 2 ? easy : p <= 5 ? [...easy, ...mid] : [...mid, ...hard];
    const type = pickTypeFor(w, fullPool, allow);
    return makeStep(type, w, fullPool);
  });
}

export { MC_TYPES };
