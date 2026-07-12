// Domain types for the vocabulary app.

export interface Course {
  id: number;
  title_vi: string;
  title_en: string | null;
}

export interface Lesson {
  id: number;
  course_id: number;
  sort: number;
  title_en: string | null;
  title_vi: string | null;
  code: string | null;
}

export interface Word {
  id: number;
  lesson_id: number;
  term: string;
  pos: string | null;
  phonetic_uk: string | null;
  phonetic_us: string | null;
  meaning_vi: string | null;
  meaning_en: string | null;
  meaning_ja: string | null;
  meaning_ko: string | null;
  meaning_th: string | null;
  meaning_zh: string | null;
  example_en: string | null;
  example_vi: string | null;
  audio_url: string | null;
  audio_sentence_url: string | null;
  image_url: string | null;
}

export interface WordProgress {
  user_id: string;
  word_id: number;
  proficiency: number; // 0..9
  memory_level: number; // 1..5
  ease: number;
  interval_days: number;
  due_at: string | null;
  last_reviewed_at: string | null;
  correct_count: number;
  wrong_count: number;
  status: "active" | "inactive";
  first_learned_at: string | null;
}

/** A word joined with the current user's progress (progress may be null if never seen). */
export interface WordWithProgress extends Word {
  progress: WordProgress | null;
}

/** One native-usage situation for the "deep understanding" (B1) content. */
export interface UsageContext {
  context_vi: string; // when/how native speakers use it (Vietnamese)
  example_en: string; // a short English example for that situation
}

/** A collocation or idiom the word commonly appears in (B4). */
export interface Collocation {
  phrase_en: string; // the collocation / idiom
  meaning_vi: string; // its Vietnamese meaning
}

/** AI-generated "deep understanding" content for a word (1:1 with Word). */
export interface WordDetail {
  word_id: number;
  definition_en: string | null; // English–English definition (root nuance)
  nuance_vi: string | null; // short Vietnamese note on register/connotation
  usage_contexts: UsageContext[];
  collocations: Collocation[]; // common collocations / idioms (B4)
}

/** A personal example sentence a user wrote for a word (B3), with AI feedback. */
export interface UserWordExample {
  id: number;
  word_id: number;
  text: string;
  feedback: string | null;
  created_at: string;
}

export interface LessonWithStats extends Lesson {
  total_words: number;
  learned_words: number;
  due_words: number;
  image: string | null;
}

export interface Streak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  daily_goal: number;
}

export interface DailyActivity {
  activity_date: string;
  words_learned: number;
  words_reviewed: number;
  xp: number;
}

// The exercise types replicated from the MochiDemy learn flow, plus the
// guided-method practice steps (pronounce, write_example) used when learning
// new words. flashcard + these three are non-graded (practice/intro) steps.
export type ExerciseType =
  | "flashcard" // intro flip card + deep understanding (B1/B4)
  | "choose_meaning" // EN word -> pick VI meaning
  | "choose_word" // VI meaning -> pick EN word
  | "choose_reading" // pick correct phonetic
  | "choose_image" // word -> pick matching image
  | "fill_gap_choose" // sentence blank -> pick word (MC)
  | "fill_gap_type" // sentence blank -> type word
  | "listen_choose" // audio -> pick word/meaning
  | "listen_write" // audio -> type word
  | "underlined_meaning" // sentence w/ underlined word -> pick meaning
  | "spell" // VI meaning -> spell/type the EN word
  | "pronounce" // B2: read the word aloud, mic-scored (non-graded)
  | "write_example"; // B3: write a personal example sentence (non-graded)

export interface ExerciseOption {
  /** display text (word or meaning or phonetic) */
  label: string;
  /** image url for choose_image */
  image?: string | null;
  correct: boolean;
}

export interface ExerciseStep {
  type: ExerciseType;
  word: Word;
  options?: ExerciseOption[]; // for multiple-choice types
}

export interface AnswerResult {
  wordId: number;
  correct: boolean;
}

// ── 30-day topic program ────────────────────────────────────────────────────
export interface AttributeOption {
  label: string;
  correct: boolean;
}
export interface CoverTopicSlide {
  type: "cover";
  hero_word_id: number | null;
  goal_en: string | null;
  goal_vi: string | null;
}
export interface VocabTopicSlide {
  type: "vocab";
  word_ids: number[];
}
export interface ExampleTopicSlide {
  type: "example";
  word_id: number;
}
export interface AttributeTopicSlide {
  type: "attribute";
  word_id: number | null;
  prompt_en: string;
  prompt_vi: string;
  options: AttributeOption[];
  explain_vi: string | null;
}
export interface DialogueLine {
  who: "a" | "b";
  en: string;
  vi: string;
}
export interface DialogueTopicSlide {
  type: "dialogue";
  title_en: string;
  lines: DialogueLine[];
}
export interface VoiceQaTopicSlide {
  type: "voice_qa";
  question_en: string;
  question_vi: string;
  key_points: string[];
  sample_answer_en: string | null;
}
export interface RecapTopicSlide {
  type: "recap";
}
export type TopicSlide =
  | CoverTopicSlide
  | VocabTopicSlide
  | ExampleTopicSlide
  | AttributeTopicSlide
  | DialogueTopicSlide
  | VoiceQaTopicSlide
  | RecapTopicSlide;

export interface TopicDeck {
  day_no: number;
  lesson_id: number;
  title_en: string | null;
  title_vi: string | null;
  slides: TopicSlide[];
}
export interface TopicDaySummary {
  day_no: number;
  lesson_id: number;
  title_en: string | null;
  title_vi: string | null;
  unlocked: boolean;
  completed: boolean;
  best_score: number | null;
}
