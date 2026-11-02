type Progress = { total_words: number; learned_words: number };

const isDone = (l: Progress) => l.total_words > 0 && l.learned_words >= l.total_words;

/** Lessons must be in `sort` order. Lesson i is open once lesson i-1 is fully learned. */
export function unlockedFlags(lessons: Progress[]): boolean[] {
  return lessons.map((_, i) => i === 0 || isDone(lessons[i - 1]));
}
