/** Pure scoring for speech-recognition pronunciation practice (B2). */

export interface PronunciationScore {
  matched: boolean; // passed the acceptance threshold
  score: number; // 0..1 similarity to the target
  heard: string; // the raw (trimmed) transcript, for display
}

/** Acceptance threshold — at/above this the attempt counts as correct. */
export const PASS_THRESHOLD = 0.8;

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"’“”()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Score a spoken transcript against a target word/phrase. */
export function scorePronunciation(transcript: string, target: string): PronunciationScore {
  const heard = transcript.trim();
  const a = normalizePhrase(transcript);
  const b = normalizePhrase(target);
  if (!a || !b) return { matched: false, score: 0, heard };
  if (a === b) return { matched: true, score: 1, heard };
  const dist = levenshtein(a, b);
  const score = Math.max(0, 1 - dist / Math.max(a.length, b.length));
  return { matched: score >= PASS_THRESHOLD, score, heard };
}
