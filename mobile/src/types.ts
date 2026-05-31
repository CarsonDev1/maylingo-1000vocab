// Domain types for the vocabulary app. (Ported verbatim from the web app.)

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

// The ten exercise types replicated from the MochiDemy learn flow.
export type ExerciseType =
  | "flashcard" // intro flip card
  | "choose_meaning" // EN word -> pick VI meaning
  | "choose_word" // VI meaning -> pick EN word
  | "choose_reading" // pick correct phonetic
  | "choose_image" // word -> pick matching image
  | "fill_gap_choose" // sentence blank -> pick word (MC)
  | "fill_gap_type" // sentence blank -> type word
  | "listen_choose" // audio -> pick word/meaning
  | "listen_write" // audio -> type word
  | "underlined_meaning" // sentence w/ underlined word -> pick meaning
  | "spell"; // VI meaning -> spell/type the EN word ("Điền từ")

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
