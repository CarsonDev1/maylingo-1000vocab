# Topic Slides — PrepVocab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repoint the 30-day topic feature to PrepVocab (course 2, 20 topics with real images), replace quiz cards with Framer-Motion interactive presentation slides, and add a separate SRS "Ôn tập lộ trình" review.

**Architecture:** Same tables/API/roadmap/TTS/grading from the prior build are kept. The `TopicSlide` union is expanded to presentation slide types; the seed re-targets the 20 PrepVocab lessons and assembles decks (data-driven vocab/example from prepvocab words + Groq-generated attribute/dialogue/voice); slide renderers are rewritten (React + Framer Motion + real images). A new `user_topic_srs` table + a review flow reuse `src/lib/srs.ts`.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind, **framer-motion** (new), Supabase (service-role), Groq, Web Speech (`speechSynthesis` + recognition), vitest (node env).

## Global Constraints

- **Web app only.** Do not touch `mobile/`.
- **Source = PrepVocab, course_id 2.** The 20-day → lesson_id map is fixed (Task 3). Reuse existing `image_url`, `meaning_vi`, `example_en`; there is **no audio** → pronunciation via `speakText` (TTS), never `playAudio`.
- **Presentation slides, not quiz cards.** Interaction = image-first reveal / tap-to-reveal / listen (TTS) + the `attribute` tap-to-reveal + the `voice_qa` speaking task. No "pick the right answer" MC for vocab. Visual standard = `docs/mockups/topic-slides-shopping-mockup.html` (light mode), using real images.
- **Animation via framer-motion**, honoring `prefers-reduced-motion`. No Remotion. No Gemini/image-gen.
- **AI content persona:** "a software engineer aiming to communicate/interview at a multinational company."
- **Review is a SEPARATE SRS schedule** (`user_topic_srs`), isolated from course-1 `/review`; reuse `src/lib/srs.ts` (`scheduleNew`, `reviewWord`, `isDue`).
- Env keys: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_HOST`, `SUPABASE_DB_PASSWORD`, `GROQ_API_KEY`, `GROQ_MODEL`.
- Tests in `src/**/*.test.ts` (node env). Single: `npx vitest run <path>`. Full: `npm test`. `npm run lint` and `npm run build` must pass.
- Vietnamese UI copy, app green theme, light mode.

---

## File Structure

- `src/types/index.ts` — modify: replace topic slide types with the new union.
- `src/lib/topic-deck.ts` — modify: new `normalizeSlides`; drop `buildVocabOptions`; keep `isDayUnlocked`.
- `src/lib/topic-deck.test.ts` — modify: tests for the new union.
- `scripts/migrate-topic-tables.mjs` — modify: add `user_topic_srs`.
- `scripts/generate-topic-decks.mjs` — rewrite: 20 PrepVocab days + new deck assembly.
- `src/app/api/topics/[day]/route.ts` — modify: collect word_ids from the new slide shapes.
- `package.json` — add `framer-motion`.
- `src/components/topics/CoverSlide.tsx`, `VocabSlide.tsx` (rewrite), `ExampleSlide.tsx`, `AttributeSlide.tsx` (rewrite), `DialogueSlide.tsx`, `VoiceQASlide.tsx` (keep), `RecapSlide.tsx`, `TopicDeckRunner.tsx` (modify dispatch + `AnimatePresence`).
- `src/lib/actions.ts` — modify: `finishTopicDay` enrolls words into `user_topic_srs`; add `submitTopicReview`, `finishTopicReview`.
- `src/app/api/topics/review/route.ts` — create: due-word queue.
- `src/app/(app)/topics/review/page.tsx` + `src/components/topics/TopicReviewClient.tsx` — create.
- `src/components/topics/TopicRoadmap.tsx` — modify: add "Ôn tập" golden-moment entry.

---

## Task 1: Expand slide types + normalizer

**Files:**
- Modify: `src/types/index.ts` (the topic types block added previously)
- Modify: `src/lib/topic-deck.ts`
- Test: `src/lib/topic-deck.test.ts`

**Interfaces:**
- Produces: `TopicSlide` union = `CoverSlide | VocabSlide | ExampleSlide | AttributeSlide | DialogueSlide | VoiceQaSlide | RecapSlide` (all with a `type` discriminant); `normalizeSlides(raw): TopicSlide[]`; `isDayUnlocked` (unchanged). `buildVocabOptions` removed.

- [ ] **Step 1: Replace the topic types**

In `src/types/index.ts`, replace the existing block from `export interface VocabSlide {` through the `TopicDaySummary` interface with:

```ts
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
```

- [ ] **Step 2: Rewrite the failing test**

Replace `src/lib/topic-deck.test.ts` with:

```ts
import { describe, expect, test } from "vitest";
import { normalizeSlides, isDayUnlocked } from "@/lib/topic-deck";

describe("normalizeSlides", () => {
  test("keeps one valid slide of each type, drops malformed", () => {
    const raw = [
      { type: "cover", hero_word_id: 5, goal_en: "G", goal_vi: "Gvi" },
      { type: "vocab", word_ids: [1, 2, 3] },
      { type: "vocab", word_ids: [] },                 // empty -> dropped
      { type: "example", word_id: 7 },
      { type: "example" },                              // no word_id -> dropped
      { type: "attribute", word_id: null, prompt_en: "P", prompt_vi: "V",
        options: [{ label: "a", correct: true }, { label: "b", correct: false }], explain_vi: "x" },
      { type: "attribute", prompt_en: "no opts" },      // dropped
      { type: "dialogue", title_en: "T", lines: [{ who: "a", en: "hi", vi: "chào" }] },
      { type: "dialogue", title_en: "T", lines: [] },   // no lines -> dropped
      { type: "voice_qa", question_en: "Q", question_vi: "Qv", key_points: ["a"], sample_answer_en: "s" },
      { type: "recap" },
      { type: "nonsense" },                             // dropped
      "garbage",                                        // dropped
    ];
    expect(normalizeSlides(raw).map((s) => s.type)).toEqual([
      "cover", "vocab", "example", "attribute", "dialogue", "voice_qa", "recap",
    ]);
  });

  test("non-array input -> []", () => {
    expect(normalizeSlides(null)).toEqual([]);
    expect(normalizeSlides({})).toEqual([]);
  });

  test("attribute needs >=2 options incl. a correct one", () => {
    expect(normalizeSlides([
      { type: "attribute", word_id: null, prompt_en: "P", prompt_vi: "V",
        options: [{ label: "a", correct: false }], explain_vi: null },
    ])).toEqual([]);
  });

  test("vocab word_ids are coerced to a clean number array", () => {
    const out = normalizeSlides([{ type: "vocab", word_ids: [1, "x", 2, 2.0] }]) as any;
    expect(out[0].word_ids).toEqual([1, 2, 2]);
  });
});

describe("isDayUnlocked", () => {
  test("day 1 always open; N needs N-1 complete", () => {
    expect(isDayUnlocked(1, new Set())).toBe(true);
    expect(isDayUnlocked(5, new Set([4]))).toBe(true);
    expect(isDayUnlocked(5, new Set([3]))).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/topic-deck.test.ts`
Expected: FAIL (`buildVocabOptions` removed / new shapes not yet handled / import mismatch).

- [ ] **Step 4: Rewrite `topic-deck.ts`**

Replace `src/lib/topic-deck.ts` with:

```ts
import type { AttributeOption, DialogueLine, TopicSlide } from "@/types";

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
function normalizeLines(input: unknown): DialogueLine[] {
  if (!Array.isArray(input)) return [];
  const out: DialogueLine[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const en = cleanString(o.en);
    const vi = cleanString(o.vi);
    if (!en || !vi) continue;
    out.push({ who: o.who === "b" ? "b" : "a", en, vi });
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
        goal_vi: cleanString(o.goal_vi),
      };
    case "vocab": {
      const word_ids = numberArray(o.word_ids);
      return word_ids.length ? { type: "vocab", word_ids } : null;
    }
    case "example":
      return typeof o.word_id === "number" ? { type: "example", word_id: o.word_id } : null;
    case "attribute": {
      const prompt_en = cleanString(o.prompt_en);
      const prompt_vi = cleanString(o.prompt_vi);
      const options = normalizeOptions(o.options);
      if (!prompt_en || !prompt_vi || options.length < 2 || !options.some((x) => x.correct)) return null;
      return {
        type: "attribute",
        word_id: typeof o.word_id === "number" ? o.word_id : null,
        prompt_en, prompt_vi, options, explain_vi: cleanString(o.explain_vi),
      };
    }
    case "dialogue": {
      const title_en = cleanString(o.title_en) ?? "";
      const lines = normalizeLines(o.lines);
      return lines.length ? { type: "dialogue", title_en, lines } : null;
    }
    case "voice_qa": {
      const question_en = cleanString(o.question_en);
      const question_vi = cleanString(o.question_vi);
      if (!question_en || !question_vi) return null;
      return {
        type: "voice_qa",
        question_en, question_vi,
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/topic-deck.test.ts`
Expected: PASS.

- [ ] **Step 6: Confirm nothing else imports `buildVocabOptions`**

Run: `grep -rn "buildVocabOptions" src`
Expected: only matches inside the (about-to-be-rewritten) `VocabSlide.tsx`. Note them; Task 4 removes that usage. If any OTHER file imports it, that's a signal to update in this task.

- [ ] **Step 7: Full suite + commit**

Run: `npm test`  (topic-deck tests pass; VocabSlide still references the removed export but tests are node-only so the suite passes; the build is fixed in Task 4.)
```bash
git add src/types/index.ts src/lib/topic-deck.ts src/lib/topic-deck.test.ts
git commit -m "feat: expand topic slide types (cover/vocab/example/dialogue/recap) + normalizer"
```

---

## Task 2: Add `user_topic_srs` table

**Files:**
- Modify: `scripts/migrate-topic-tables.mjs`

**Interfaces:**
- Produces table `user_topic_srs(user_id, word_id, proficiency, memory_level, ease, interval_days, due_at, last_reviewed_at, correct_count, wrong_count, status, first_learned_at, primary key(user_id, word_id))`.

- [ ] **Step 1: Add the table to the migration SQL**

In `scripts/migrate-topic-tables.mjs`, inside the `SQL` template string, append before the closing backtick:

```js
create table if not exists public.user_topic_srs (
  user_id          text    not null,
  word_id          integer not null references public.words(id) on delete cascade,
  proficiency      integer not null default 1,
  memory_level     integer not null default 1,
  ease             real    not null default 2.5,
  interval_days    real    not null default 0,
  due_at           timestamptz,
  last_reviewed_at timestamptz,
  correct_count    integer not null default 0,
  wrong_count      integer not null default 0,
  status           text    not null default 'active',
  first_learned_at timestamptz,
  primary key (user_id, word_id)
);
create index if not exists idx_uts_user_due on public.user_topic_srs(user_id, due_at);
```

Also add `user_topic_srs` to the verification query's `table_name in (...)` list so the script prints it.

- [ ] **Step 2: Run the migration and verify**

Run: `node scripts/migrate-topic-tables.mjs`
Expected: prints `...present: topic_days, user_topic_progress, user_topic_srs` and exits 0. Idempotent (safe re-run).

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-topic-tables.mjs
git commit -m "feat: add user_topic_srs table for topic review"
```

---

## Task 3: Rewrite the seed for 20 PrepVocab days

**Files:**
- Rewrite: `scripts/generate-topic-decks.mjs`

**Interfaces:**
- Produces 20 `topic_days` rows (day_no 1..20 → the PrepVocab lesson_ids below), each `slides` = `cover`, 2×`vocab` (6 word_ids each), 2×`example`, 2×`attribute`, 1×`dialogue`, 2×`voice_qa`, `recap`. Removes any `topic_days` rows with `day_no > 20`.

- [ ] **Step 1: Replace the script**

Replace `scripts/generate-topic-decks.mjs` with:

```js
// Generate all 20 PrepVocab topic decks via Groq into topic_days (persona: software
// engineer aiming to work at a multinational company). Idempotent: skips days already
// present unless --force. Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
// GROQ_API_KEY, optional GROQ_MODEL. Prereq: run scripts/migrate-topic-tables.mjs.
//
// Usage: node scripts/generate-topic-decks.mjs [--limit N | --day N | --force]
import { loadEnv, getServiceClient, sleep } from "./_supabase.mjs";

loadEnv();

// day_no -> [lesson_id, title_en]  (course_id = 2 / PrepVocab)
const DAYS = [
  [1, 12667, "Daily Activities 1"], [2, 12682, "Daily Activities 2"], [3, 12668, "Weather"],
  [4, 12669, "Fashion"], [5, 12670, "Food & Cuisine"], [6, 12671, "Health"],
  [7, 12672, "Technology"], [8, 12683, "Sports"], [9, 12684, "Movies"], [10, 12685, "Work"],
  [11, 12673, "Personality"], [12, 12674, "Appearance"], [13, 12675, "Careers"],
  [14, 12676, "Emotions"], [15, 12678, "Household Items"], [16, 12677, "Time"],
  [17, 12679, "Places & Spaces"], [18, 12680, "Entertainment"], [19, 12681, "Family"],
  [20, 12686, "Transportation"],
];
const VOCAB_SLIDES = 2, VOCAB_PER_SLIDE = 6, EXAMPLE_SLIDES = 2;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const num = (f) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : null; };
const LIMIT = num("--limit"), ONLY_DAY = num("--day");

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
if (!GROQ_KEY) { console.error("Missing GROQ_API_KEY"); process.exit(1); }
const db = getServiceClient();

const cleanStr = (v) => { if (typeof v !== "string") return null; const t = v.trim(); return t || null; };
function normOptions(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const label = cleanStr(it.label);
    if (!label) continue;
    out.push({ label, correct: it.correct === true });
    if (out.length === 4) break;
  }
  return out;
}
function normStrings(input, max) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const it of input) { const s = cleanStr(it); if (s) out.push(s); if (out.length === max) break; }
  return out;
}

async function groq(messages, maxTokens) {
  const payload = JSON.stringify({ model: GROQ_MODEL, messages, response_format: { type: "json_object" }, temperature: 0.6, max_tokens: maxTokens });
  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` }, body: payload,
    });
    if (res.status === 429 || res.status === 503) {
      const ra = parseFloat(res.headers.get("retry-after") ?? "");
      await sleep(Number.isFinite(ra) ? ra * 1000 + 500 : Math.min(30000, 1500 * 2 ** attempt));
      continue;
    }
    break;
  }
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

async function buildDeck(titleEn, words) {
  const withImg = words.filter((w) => w.image_url);
  const heroId = (withImg[0] ?? words[0])?.id ?? null;

  // vocab slides: first VOCAB_SLIDES*VOCAB_PER_SLIDE imaged words
  const vocabWords = (withImg.length ? withImg : words).slice(0, VOCAB_SLIDES * VOCAB_PER_SLIDE);
  const vocabSlides = [];
  for (let i = 0; i < vocabWords.length; i += VOCAB_PER_SLIDE) {
    vocabSlides.push({ type: "vocab", word_ids: vocabWords.slice(i, i + VOCAB_PER_SLIDE).map((w) => w.id) });
  }
  // example slides: words that have an example_en
  const exampleWords = words.filter((w) => w.example_en).slice(0, EXAMPLE_SLIDES);
  const exampleSlides = exampleWords.map((w) => ({ type: "example", word_id: w.id }));

  const wordList = words.slice(0, 20).map((w) => `${w.term} (${w.meaning_vi ?? ""})`).join(", ");
  const system =
    "You design English communication practice for a Vietnamese software engineer who wants to work and interview at multinational companies. " +
    "Frame everything around real workplace/interview/daily-professional situations. Reply ONLY with valid JSON.";
  const user = `Topic: "${titleEn}". Vocabulary: ${wordList}.
Return JSON with EXACTLY:
{
  "attribute": [ { "word": "<one vocab word or empty>", "prompt_en": "<short factual/usage MC question in English>", "prompt_vi": "<Vietnamese translation>", "options": [ {"label":"<en>","correct":true},{"label":"<en>","correct":false},{"label":"<en>","correct":false},{"label":"<en>","correct":false} ], "explain_vi": "<1 short Vietnamese sentence>" } ],
  "dialogue": { "title_en": "<short scene title using this topic>", "lines": [ {"who":"a","en":"<line>","vi":"<vi>"}, {"who":"b","en":"<line>","vi":"<vi>"}, {"who":"a","en":"<line>","vi":"<vi>"}, {"who":"b","en":"<line>","vi":"<vi>"} ] },
  "voice_qa": [ { "question_en": "<situational spoken question a colleague/interviewer asks about this topic>", "question_vi": "<vi>", "key_points": ["<point>","<point>","<point>"], "sample_answer_en": "<2-3 sentence sample answer>" } ]
}
Rules: attribute EXACTLY 2 items (4 options each, exactly one correct). dialogue EXACTLY 4 lines alternating a/b. voice_qa EXACTLY 2 items (2-3 key_points each). Natural, concise.`;

  const parsed = await groq([{ role: "system", content: system }, { role: "user", content: user }], 1800);
  const byTerm = new Map(words.map((w) => [w.term.toLowerCase(), w.id]));

  const attribute = (Array.isArray(parsed.attribute) ? parsed.attribute : []).map((a) => {
    const options = normOptions(a.options);
    const prompt_en = cleanStr(a.prompt_en), prompt_vi = cleanStr(a.prompt_vi);
    if (!prompt_en || !prompt_vi || options.length < 2 || !options.some((o) => o.correct)) return null;
    return { type: "attribute", word_id: byTerm.get(cleanStr(a.word)?.toLowerCase() ?? "") ?? null, prompt_en, prompt_vi, options, explain_vi: cleanStr(a.explain_vi) };
  }).filter(Boolean).slice(0, 2);

  let dialogue = null;
  const dl = parsed.dialogue;
  if (dl && Array.isArray(dl.lines)) {
    const lines = dl.lines.map((l) => { const en = cleanStr(l.en), vi = cleanStr(l.vi); return en && vi ? { who: l.who === "b" ? "b" : "a", en, vi } : null; }).filter(Boolean).slice(0, 6);
    if (lines.length) dialogue = { type: "dialogue", title_en: cleanStr(dl.title_en) ?? titleEn, lines };
  }

  const voice = (Array.isArray(parsed.voice_qa) ? parsed.voice_qa : []).map((v) => {
    const q = cleanStr(v.question_en), qv = cleanStr(v.question_vi);
    if (!q || !qv) return null;
    return { type: "voice_qa", question_en: q, question_vi: qv, key_points: normStrings(v.key_points, 5), sample_answer_en: cleanStr(v.sample_answer_en) };
  }).filter(Boolean).slice(0, 2);

  if (!attribute.length && !voice.length) throw new Error("empty generation");

  const goal = await groq(
    [{ role: "system", content: "Reply ONLY valid JSON." },
     { role: "user", content: `One short learning-goal line for the topic "${titleEn}" for a Vietnamese software engineer. JSON: {"goal_en":"...","goal_vi":"..."}` }], 200
  ).catch(() => ({}));

  return [
    { type: "cover", hero_word_id: heroId, goal_en: cleanStr(goal.goal_en), goal_vi: cleanStr(goal.goal_vi) },
    ...vocabSlides,
    ...exampleSlides,
    ...attribute,
    ...(dialogue ? [dialogue] : []),
    ...voice,
    { type: "recap" },
  ];
}

// ---- main ----
// Remove stale rows from the previous 30-day (course-1) build.
await db.from("topic_days").delete().gt("day_no", 20);

let days = DAYS;
if (ONLY_DAY) days = days.filter(([d]) => d === ONLY_DAY);
else if (LIMIT) days = days.slice(0, LIMIT);
if (!FORCE && !ONLY_DAY) {
  const { data: existing } = await db.from("topic_days").select("day_no");
  const have = new Set((existing ?? []).map((r) => r.day_no));
  days = days.filter(([d]) => !have.has(d));
}
console.error(`days to generate: ${days.map(([d]) => d).join(", ") || "(none)"}`);

let ok = 0, failed = 0;
for (const [day_no, lesson_id, title_en] of days) {
  try {
    const { data: lesson } = await db.from("lessons").select("id,title_vi").eq("id", lesson_id).maybeSingle();
    if (!lesson) throw new Error(`lesson ${lesson_id} not found`);
    const { data: words } = await db.from("words").select("id,term,meaning_vi,example_en,image_url").eq("lesson_id", lesson_id).order("id");
    if (!words?.length) throw new Error(`no words for ${lesson_id}`);
    const slides = await buildDeck(title_en, words);
    const { error } = await db.from("topic_days").upsert({
      day_no, lesson_id, title_en, title_vi: lesson.title_vi, slides, model: GROQ_MODEL, generated_at: new Date().toISOString(),
    }, { onConflict: "day_no" });
    if (error) throw new Error(error.message);
    ok++; console.error(`  ✓ day ${day_no} (${title_en}) — ${slides.length} slides`);
  } catch (e) { failed++; console.error(`  ✗ day ${day_no}: ${e.message}`); }
  await sleep(300);
}
console.error(`\nDone. generated: ${ok}, failed: ${failed}.`);
```

- [ ] **Step 2: Re-seed all 20 days**

Run: `node scripts/generate-topic-decks.mjs --force`
Expected: `✓ day 1 (Daily Activities 1) — ~10 slides` … through day 20, `generated: 20, failed: 0`. (The `--force` also runs the `day_no > 20` cleanup of old rows.)

- [ ] **Step 3: Spot-check a deck's slide order**

Run:
```bash
node -e 'import("./scripts/_supabase.mjs").then(async(m)=>{m.loadEnv();const db=m.getServiceClient();const{data}=await db.from("topic_days").select("day_no,title_en,slides").eq("day_no",4).single();console.log(data.title_en, JSON.stringify(data.slides.map(s=>s.type)));const{count}=await db.from("topic_days").select("*",{count:"exact",head:true});console.log("total days:",count);})'
```
Expected: prints `Fashion ["cover","vocab","vocab","example","example","attribute","attribute","dialogue","voice_qa","voice_qa","recap"]` (order may vary slightly if the topic lacked examples) and `total days: 20`.

- [ ] **Step 4: Commit (script only)**

```bash
git add scripts/generate-topic-decks.mjs
git commit -m "feat: seed 20 PrepVocab topic decks (presentation slides)"
```

---

## Task 4: framer-motion + Cover/Vocab/Example/Recap slides + deck route word-ids

**Files:**
- Modify: `package.json` (add `framer-motion`)
- Modify: `src/app/api/topics/[day]/route.ts`
- Create: `src/components/topics/CoverSlide.tsx`, `ExampleSlide.tsx`, `RecapSlide.tsx`
- Rewrite: `src/components/topics/VocabSlide.tsx`

**Interfaces:**
- Consumes: `speakText` (`@/lib/tts`); `Word`, slide types (`@/types`).
- Produces: `CoverSlide({ slide, words, onDone })`, `VocabSlide({ slide, words, onDone })`, `ExampleSlide({ slide, words, onDone })`, `RecapSlide({ day, title, onDone })`. All are non-graded and call `onDone()` (no score).

- [ ] **Step 1: Install framer-motion**

Run: `npm install framer-motion`
Expected: adds `framer-motion` to `package.json` dependencies; `npm run build` still works.

- [ ] **Step 2: Update the deck route to collect word_ids from the new shapes**

In `src/app/api/topics/[day]/route.ts`, replace the `wordIds` computation (the `.flatMap` over slides) with:

```ts
  const wordIds = Array.from(
    new Set(
      slides.flatMap((s) => {
        if (s.type === "vocab") return s.word_ids;
        if (s.type === "example") return [s.word_id];
        if (s.type === "attribute" && s.word_id != null) return [s.word_id];
        if (s.type === "cover" && s.hero_word_id != null) return [s.hero_word_id];
        return [];
      }),
    ),
  );
```

(The route already fetches the whole lesson's words for hydration, so this only affects the early-return-when-empty guard; leaving the full-lesson fetch as-is is correct.)

- [ ] **Step 3: Rewrite `VocabSlide.tsx` (image cards, tap-reveal, TTS)**

Replace `src/components/topics/VocabSlide.tsx` with:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speakText } from "@/lib/tts";
import { cn } from "@/lib/utils";
import type { VocabTopicSlide, Word } from "@/types";

export function VocabSlide({ slide, words, onDone }: { slide: VocabTopicSlide; words: Word[]; onDone: (score?: number) => void }) {
  const cards = slide.word_ids.map((id) => words.find((w) => w.id === id)).filter(Boolean) as Word[];
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col">
      <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Chạm vào thẻ để mở nghĩa</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((w, i) => {
          const isOpen = !!open[w.id];
          return (
            <motion.button
              key={w.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setOpen((o) => ({ ...o, [w.id]: !o[w.id] }))}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-2xl border-2 bg-white p-3 text-center transition",
                isOpen ? "border-green-500 bg-green-50" : "border-slate-200 hover:border-green-300",
              )}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [w.id]: true })); speakText(w.term); }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white text-green-600 shadow"
                aria-label={`Nghe ${w.term}`}
              >
                <Volume2 className="h-3.5 w-3.5" />
              </span>
              {w.image_url ? (
                <Image src={w.image_url} alt="" width={120} height={90} unoptimized className="h-20 w-full rounded-xl object-contain" />
              ) : (
                <div className="flex h-20 w-full items-center justify-center rounded-xl bg-slate-100 text-3xl">🗂️</div>
              )}
              <span className="font-bold text-neutral-800">{w.term}</span>
              {isOpen && <span className="text-xs text-muted-foreground">{w.meaning_vi}</span>}
            </motion.button>
          );
        })}
      </div>
      <Button variant="primary" className="mt-6 w-full" onClick={() => onDone()}>Tiếp tục</Button>
    </div>
  );
}
```

- [ ] **Step 4: Create `ExampleSlide.tsx`**

Create `src/components/topics/ExampleSlide.tsx`:

```tsx
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speakText } from "@/lib/tts";
import type { ExampleTopicSlide, Word } from "@/types";

export function ExampleSlide({ slide, words, onDone }: { slide: ExampleTopicSlide; words: Word[]; onDone: (score?: number) => void }) {
  const w = words.find((x) => x.id === slide.word_id);
  if (!w) return <div className="text-center"><Button variant="primary" onClick={() => onDone()}>Tiếp tục</Button></div>;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        {w.image_url ? (
          <Image src={w.image_url} alt="" width={220} height={170} unoptimized className="h-44 w-auto rounded-2xl object-contain" />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-slate-100 text-5xl">💬</div>
        )}
      </motion.div>
      <div>
        <button onClick={() => speakText(w.term)} className="inline-flex items-center gap-2 text-xl font-extrabold text-neutral-800" aria-label={`Nghe ${w.term}`}>
          {w.term} <Volume2 className="h-4 w-4 text-green-600" />
        </button>
        {w.meaning_vi && <p className="text-sm text-muted-foreground">{w.meaning_vi}</p>}
      </div>
      {w.example_en && (
        <button onClick={() => speakText(w.example_en!)} className="rounded-xl border-2 bg-slate-50 p-3 text-left" aria-label="Nghe câu ví dụ">
          <p className="italic text-neutral-800">“{w.example_en}”</p>
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-600"><Volume2 className="h-3.5 w-3.5" /> Nghe câu</span>
        </button>
      )}
      <Button variant="primary" className="w-full" onClick={() => onDone()}>Tiếp tục</Button>
    </div>
  );
}
```

- [ ] **Step 5: Create `CoverSlide.tsx` and `RecapSlide.tsx`**

Create `src/components/topics/CoverSlide.tsx`:

```tsx
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { CoverTopicSlide, Word } from "@/types";

export function CoverSlide({ slide, words, title, onDone }: { slide: CoverTopicSlide; words: Word[]; title: string; onDone: (score?: number) => void }) {
  const hero = slide.hero_word_id != null ? words.find((w) => w.id === slide.hero_word_id) : undefined;
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 text-center">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {hero?.image_url ? (
          <Image src={hero.image_url} alt="" width={200} height={160} unoptimized className="h-40 w-auto rounded-2xl object-contain" />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-green-50 text-5xl">🎯</div>
        )}
      </motion.div>
      <h1 className="text-3xl font-extrabold tracking-tight text-neutral-800">{title}</h1>
      {(slide.goal_vi || slide.goal_en) && (
        <p className="rounded-xl border-2 bg-slate-50 px-4 py-2 text-sm text-neutral-700">🎯 {slide.goal_vi ?? slide.goal_en}</p>
      )}
      <Button variant="primary" className="w-full" onClick={() => onDone()}>Bắt đầu</Button>
    </div>
  );
}
```

Create `src/components/topics/RecapSlide.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RecapSlide({ title, onDone }: { title: string; onDone: (score?: number) => void }) {
  const items = ["Từ vựng chủ đề + hình ảnh", "Câu ví dụ thực tế", "Điểm ngữ pháp/ngữ cảnh", "Luyện nói với AI"];
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 text-center">
      <h2 className="text-2xl font-extrabold text-neutral-800">Hoàn thành: {title} 🎉</h2>
      <div className="flex flex-col gap-2 text-left">
        {items.map((t, i) => (
          <motion.div key={t} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3 rounded-xl border-2 border-green-100 bg-green-50 px-4 py-2.5 font-medium text-neutral-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white"><Check className="h-4 w-4" /></span>
            {t}
          </motion.div>
        ))}
      </div>
      <Button variant="primary" className="w-full" onClick={() => onDone()}>Xong</Button>
    </div>
  );
}
```

- [ ] **Step 6: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: compiles. (`TopicDeckRunner` still references the old slide props / removed `buildVocabOptions` import in the old VocabSlide is gone; if the runner still imports old types it may error — that is fixed in Task 6. If the build breaks ONLY inside `TopicDeckRunner.tsx`, that is expected and closed by Task 6; note it and proceed. All other files must compile.)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json "src/app/api/topics/[day]/route.ts" src/components/topics/CoverSlide.tsx src/components/topics/VocabSlide.tsx src/components/topics/ExampleSlide.tsx src/components/topics/RecapSlide.tsx
git commit -m "feat: framer-motion + cover/vocab/example/recap presentation slides"
```

---

## Task 5: Attribute (rewrite) + Dialogue (new) slides

**Files:**
- Rewrite: `src/components/topics/AttributeSlide.tsx`
- Create: `src/components/topics/DialogueSlide.tsx`

**Interfaces:**
- Consumes: `speakText`; `AttributeTopicSlide`, `DialogueTopicSlide`, `Word` (`@/types`).
- Produces: `AttributeSlide({ slide, words, onDone })`, `DialogueSlide({ slide, onDone })`. Non-graded (`onDone()`).

- [ ] **Step 1: Rewrite `AttributeSlide.tsx` (tap-to-reveal, framer)**

Replace `src/components/topics/AttributeSlide.tsx` with:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttributeTopicSlide, Word } from "@/types";

export function AttributeSlide({ slide, words, onDone }: { slide: AttributeTopicSlide; words: Word[]; onDone: (score?: number) => void }) {
  const w = slide.word_id != null ? words.find((x) => x.id === slide.word_id) : undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const revealed = picked !== null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
      {w?.image_url && <Image src={w.image_url} alt="" width={140} height={110} unoptimized className="h-28 w-auto rounded-2xl object-contain" />}
      <p className="text-center text-lg font-semibold text-neutral-800">{slide.prompt_en}</p>
      <p className="text-center text-sm text-muted-foreground">{slide.prompt_vi}</p>
      <div className="grid w-full gap-3">
        {slide.options.map((opt, i) => (
          <button
            key={i}
            disabled={revealed}
            onClick={() => setPicked(i)}
            className={cn(
              "flex items-center justify-between rounded-xl border-2 border-b-4 px-4 py-3 text-left font-semibold text-neutral-700 transition",
              !revealed && "hover:bg-slate-50 active:border-b-2",
              revealed && opt.correct && "border-green-500 bg-green-500/10 text-green-700",
              revealed && !opt.correct && picked === i && "border-rose-500 bg-rose-500/10 text-rose-600",
              revealed && !opt.correct && picked !== i && "opacity-60",
            )}
          >
            <span>{opt.label}</span>
            {revealed && opt.correct && <Check className="h-5 w-5 text-green-600" />}
            {revealed && !opt.correct && picked === i && <X className="h-5 w-5 text-rose-500" />}
          </button>
        ))}
      </div>
      {revealed && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
          {slide.explain_vi && <p className="mb-3 rounded-xl bg-amber-500/10 p-3 text-sm text-neutral-800">{slide.explain_vi}</p>}
          <Button variant="primary" className="w-full" onClick={() => onDone()}>Tiếp tục</Button>
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `DialogueSlide.tsx` (reveal lines + TTS)**

Create `src/components/topics/DialogueSlide.tsx`:

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speakText } from "@/lib/tts";
import { cn } from "@/lib/utils";
import type { DialogueTopicSlide } from "@/types";

export function DialogueSlide({ slide, onDone }: { slide: DialogueTopicSlide; onDone: (score?: number) => void }) {
  const [shown, setShown] = useState(1);
  const all = shown >= slide.lines.length;

  function next() {
    if (all) return;
    speakText(slide.lines[shown].en);
    setShown((n) => n + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <p className="text-center text-sm font-bold uppercase tracking-wide text-muted-foreground">{slide.title_en}</p>
      <div className="flex flex-col gap-2">
        {slide.lines.slice(0, shown).map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "max-w-[88%] rounded-2xl border-2 px-3.5 py-2.5",
              l.who === "b" ? "self-end rounded-br-sm border-green-200 bg-green-50" : "self-start rounded-bl-sm border-slate-200 bg-slate-50",
            )}
          >
            <p className="font-semibold text-neutral-800">{l.en}</p>
            <p className="text-xs text-muted-foreground">{l.vi}</p>
            <button onClick={() => speakText(l.en)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-600" aria-label="Nghe">
              <Volume2 className="h-3.5 w-3.5" /> nghe
            </button>
          </motion.div>
        ))}
      </div>
      {all ? (
        <Button variant="primary" className="w-full" onClick={() => onDone()}>Tiếp tục</Button>
      ) : (
        <Button variant="ghost" className="w-full" onClick={next}>Câu tiếp theo →</Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: compiles (same caveat as Task 4: only `TopicDeckRunner.tsx` may still error until Task 6).

- [ ] **Step 4: Commit**

```bash
git add src/components/topics/AttributeSlide.tsx src/components/topics/DialogueSlide.tsx
git commit -m "feat: attribute (tap-reveal) + dialogue presentation slides"
```

---

## Task 6: Rewire `TopicDeckRunner` for the new slide types

**Files:**
- Modify: `src/components/topics/TopicDeckRunner.tsx`
- Modify: `src/components/topics/VoiceQASlide.tsx` (wrap entry animation only)

**Interfaces:**
- Consumes: all slide components from Tasks 4–5, `VoiceQASlide`, `finishTopicDay`, `TopicDeck`, `Word`.

- [ ] **Step 1: Replace the runner's slide dispatch + add AnimatePresence**

In `src/components/topics/TopicDeckRunner.tsx`:

1. Update imports — remove `VocabSlide`/`AttributeSlide` old imports if their props changed (they're re-imported below), add the new ones and framer-motion:

```tsx
import { AnimatePresence, motion } from "framer-motion";
import { CoverSlide } from "@/components/topics/CoverSlide";
import { VocabSlide } from "@/components/topics/VocabSlide";
import { ExampleSlide } from "@/components/topics/ExampleSlide";
import { AttributeSlide } from "@/components/topics/AttributeSlide";
import { DialogueSlide } from "@/components/topics/DialogueSlide";
import { VoiceQASlide } from "@/components/topics/VoiceQASlide";
import { RecapSlide } from "@/components/topics/RecapSlide";
```

2. Replace the slide-render block (the `<div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6" key={index}>` … `</div>`) with an animated dispatcher:

```tsx
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28 }}
            className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6"
          >
            {slide.type === "cover" && <CoverSlide slide={slide} words={words} title={deck.title_en ?? deck.title_vi ?? ""} onDone={next} />}
            {slide.type === "vocab" && <VocabSlide slide={slide} words={words} onDone={next} />}
            {slide.type === "example" && <ExampleSlide slide={slide} words={words} onDone={next} />}
            {slide.type === "attribute" && <AttributeSlide slide={slide} words={words} onDone={next} />}
            {slide.type === "dialogue" && <DialogueSlide slide={slide} onDone={next} />}
            {slide.type === "voice_qa" && <VoiceQASlide slide={slide} dayNo={deck.day_no} onDone={next} />}
            {slide.type === "recap" && <RecapSlide title={deck.title_en ?? deck.title_vi ?? ""} onDone={next} />}
          </motion.div>
        </AnimatePresence>
```

(Keep the surrounding header/progress-bar and the finish screen unchanged. `next(score?: number)` already exists and collects voice scores.)

- [ ] **Step 2: Confirm VoiceQASlide still matches**

`VoiceQASlide` already has signature `{ slide, dayNo, onDone }` consuming `VoiceQaTopicSlide` fields (`question_en`, `question_vi`, `key_points`, `sample_answer_en`) — these names are unchanged in the new union, so no edit is required. (Optional: wrap its root in `<motion.div>` for a fade; not required.) Verify it compiles against the renamed type by running the build in Step 3.

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: compiles cleanly now (all slide types dispatched); `/topics/[day]` present.

- [ ] **Step 4: Manual smoke (dev server)**

Run `npm run dev`, sign in, open `/topics/1`. Expected: cover → vocab (image cards, tap reveals meaning, 🔊 speaks) → example (image + sentence + 🔊) → attribute (tap reveals answer + explanation) → dialogue (reveal lines + 🔊) → voice_qa (AI reads question, mic/typed answer graded) → recap → finish (+XP, back to /topics). Real PrepVocab images load; transitions animate.

- [ ] **Step 5: Commit**

```bash
git add src/components/topics/TopicDeckRunner.tsx src/components/topics/VoiceQASlide.tsx
git commit -m "feat: deck runner dispatches presentation slides with framer-motion transitions"
```

---

## Task 7: Topic SRS — enrollment + review data layer

**Files:**
- Modify: `src/lib/actions.ts` (enroll in `finishTopicDay`; add `submitTopicReview`, `finishTopicReview`)
- Create: `src/app/api/topics/review/route.ts`

**Interfaces:**
- Consumes: `scheduleNew`, `reviewWord`, `SrsState` (`@/lib/srs`); `getSupabaseAdmin`, `requireUserId`, existing private `bumpActivity`/`touchStreak` in `actions.ts`; `Word` (`@/types`).
- Produces:
  - `finishTopicDay(dayNo, scores)` — additionally enrolls the day's lesson words into `user_topic_srs`.
  - `submitTopicReview(wordId: number, correct: boolean): Promise<{ ok: true }>`
  - `finishTopicReview(reviewed: number, correct: number): Promise<{ ok: true }>`
  - `GET /api/topics/review` → `{ due: Word[], nextDueAt: string | null, dueCount: number }`.

- [ ] **Step 1: Add topic-SRS row mappers + enrollment to `finishTopicDay`**

In `src/lib/actions.ts`, add near the top (after the existing `rowToState`) a topic-SRS row mapper (the `user_topic_srs` columns differ in name from `user_word_progress` only by table — same shape):

```ts
function srsToTopicRow(userId: string, wordId: number, s: import("@/lib/srs").SrsState) {
  return {
    user_id: userId, word_id: wordId,
    proficiency: s.proficiency, memory_level: s.memoryLevel, ease: s.ease,
    interval_days: s.intervalDays, due_at: s.dueAt, last_reviewed_at: s.lastReviewedAt,
    correct_count: s.correctCount, wrong_count: s.wrongCount, status: s.status,
    first_learned_at: s.firstLearnedAt,
  };
}
function topicRowToSrs(p: Record<string, unknown>): import("@/lib/srs").SrsState {
  return {
    proficiency: p.proficiency as number, memoryLevel: p.memory_level as number, ease: p.ease as number,
    intervalDays: p.interval_days as number, dueAt: (p.due_at as string) ?? null,
    lastReviewedAt: (p.last_reviewed_at as string) ?? null, correctCount: p.correct_count as number,
    wrongCount: p.wrong_count as number, status: (p.status as "active" | "inactive"),
    firstLearnedAt: (p.first_learned_at as string) ?? null,
  };
}
```

Ensure `scheduleNew` and `reviewWord` are imported at the top of `actions.ts`:
`import { scheduleNew, reviewWord, type SrsState } from "@/lib/srs";` (extend the existing srs import if partial).

In `finishTopicDay`, after the `user_topic_progress` upsert and before `bumpActivity`, enroll the day's lesson words:

```ts
  // Enroll this day's words into the separate topic SRS schedule (skip already enrolled).
  const { data: dayRow } = await db.from("topic_days").select("lesson_id").eq("day_no", dayNo).maybeSingle();
  if (dayRow?.lesson_id != null) {
    const { data: lessonWords } = await db.from("words").select("id").eq("lesson_id", dayRow.lesson_id);
    const ids = ((lessonWords as { id: number }[]) ?? []).map((w) => w.id);
    if (ids.length) {
      const { data: existing } = await db.from("user_topic_srs").select("word_id").eq("user_id", userId).in("word_id", ids);
      const have = new Set(((existing as { word_id: number }[]) ?? []).map((e) => e.word_id));
      const fresh = ids.filter((id) => !have.has(id));
      if (fresh.length) {
        const now = new Date();
        await db.from("user_topic_srs").upsert(fresh.map((id) => srsToTopicRow(userId, id, scheduleNew(now))), { onConflict: "user_id,word_id" });
      }
    }
  }
```

Add `revalidatePath("/topics/review");` alongside the existing revalidations in `finishTopicDay`.

- [ ] **Step 2: Add the review server actions**

Append to `src/lib/actions.ts`:

```ts
/** Apply one topic-review answer, updating the separate topic SRS schedule. */
export async function submitTopicReview(wordId: number, correct: boolean): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const db = getSupabaseAdmin();
  const now = new Date();
  const { data } = await db.from("user_topic_srs").select("*").eq("user_id", userId).eq("word_id", wordId).maybeSingle();
  const prev: SrsState = data ? topicRowToSrs(data as Record<string, unknown>) : scheduleNew(now);
  const next = data ? reviewWord(prev, { correct }, now) : prev;
  await db.from("user_topic_srs").upsert(srsToTopicRow(userId, wordId, next), { onConflict: "user_id,word_id" });
  return { ok: true };
}

/** Record a finished topic-review session: activity + streak. */
export async function finishTopicReview(reviewed: number, correct: number): Promise<{ ok: true }> {
  const userId = await requireUserId();
  if (reviewed > 0) {
    await bumpActivity(userId, { reviewed, xp: correct * 5 });
    await touchStreak(userId);
  }
  revalidatePath("/topics");
  revalidatePath("/topics/review");
  revalidatePath("/dashboard");
  return { ok: true };
}
```

- [ ] **Step 3: Create the due-words route**

Create `src/app/api/topics/review/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Word } from "@/types";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: rows } = await db
    .from("user_topic_srs")
    .select("word_id,due_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("due_at");

  const all = (rows as { word_id: number; due_at: string | null }[]) ?? [];
  const dueRows = all.filter((r) => r.due_at && r.due_at <= nowIso);
  const future = all.filter((r) => r.due_at && r.due_at > nowIso).map((r) => r.due_at as string);
  const nextDueAt = future.length ? future[0] : null;

  let due: Word[] = [];
  if (dueRows.length) {
    const { data: words } = await db.from("words").select("*").in("id", dueRows.map((r) => r.word_id));
    const byId = new Map(((words as Word[]) ?? []).map((w) => [w.id, w]));
    due = dueRows.map((r) => byId.get(r.word_id)).filter(Boolean) as Word[];
  }
  return NextResponse.json({ due, nextDueAt, dueCount: due.length });
}
```

- [ ] **Step 4: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: compiles; `/api/topics/review` in the route list.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions.ts src/app/api/topics/review/route.ts
git commit -m "feat: topic SRS enrollment + review data layer (submit/finish/queue)"
```

---

## Task 8: Topic review UI + roadmap entry

**Files:**
- Create: `src/app/(app)/topics/review/page.tsx`, `src/components/topics/TopicReviewClient.tsx`
- Modify: `src/components/topics/TopicRoadmap.tsx` (add the "Ôn tập" golden-moment entry)

**Interfaces:**
- Consumes: `GET /api/topics/review`; `submitTopicReview`, `finishTopicReview` (`@/lib/actions`); `speakText`; `Word`.

- [ ] **Step 1: Create the review client (recall-before-reveal card)**

Create `src/components/topics/TopicReviewClient.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Volume2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitTopicReview, finishTopicReview } from "@/lib/actions";
import { speakText } from "@/lib/tts";
import { cn } from "@/lib/utils";
import type { Word } from "@/types";

const norm = (s: string) => s.trim().toLowerCase().replace(/[.,!?;:'"]/g, "");

function blankExample(example: string, term: string): string {
  const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*\\b`, "i");
  return example.replace(re, "_____");
}

export function TopicReviewClient() {
  const [queue, setQueue] = useState<Word[] | null>(null);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/topics/review")
      .then((r) => (r.ok ? r.json() : { due: [] }))
      .then((d) => { if (!cancelled) setQueue((d.due as Word[]) ?? []); })
      .catch(() => { if (!cancelled) setQueue([]); });
    return () => { cancelled = true; };
  }, []);

  const word = queue?.[i];
  const prompt = useMemo(() => {
    if (!word) return "";
    return word.example_en ? blankExample(word.example_en, word.term) : (word.meaning_vi ?? word.term);
  }, [word]);

  if (queue === null) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-green-500" /></div>;
  }
  if (queue.length === 0 || done) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-5xl">✅</p>
        <h2 className="mt-3 text-xl font-bold text-neutral-800">{done ? "Ôn xong!" : "Chưa có từ đến hạn ôn"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{done ? `Bạn đã ôn ${queue.length} từ.` : "Học thêm một ngày trong lộ trình để có từ ôn."}</p>
        <Button asChild variant="secondary" className="mt-6"><Link href="/topics">Về lộ trình</Link></Button>
      </div>
    );
  }

  function check() {
    if (result !== null || !word) return;
    const ok = norm(typed) === norm(word.term);
    setResult(ok);
    if (ok) setCorrectCount((c) => c + 1);
    speakText(word.term);
    void submitTopicReview(word.id, ok).catch(() => {});
  }

  function next() {
    if (i + 1 >= queue!.length) {
      void finishTopicReview(queue!.length, correctCount).catch(() => {});
      setDone(true);
    } else {
      setI((n) => n + 1); setTyped(""); setResult(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between text-sm font-bold text-muted-foreground">
        <Link href="/topics" className="hover:text-neutral-700">✕ Thoát</Link>
        <span className="tabular-nums">{i + 1}/{queue.length}</span>
      </div>

      {word!.image_url && (
        <Image src={word!.image_url} alt="" width={200} height={150} unoptimized className="mx-auto h-36 w-auto rounded-2xl object-contain" />
      )}
      <p className="rounded-xl border-2 bg-slate-50 p-4 text-center text-lg italic text-neutral-800">“{prompt}”</p>
      <p className="text-center text-sm text-muted-foreground">Nhớ lại từ còn thiếu:</p>

      {result === null ? (
        <>
          <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") check(); }}
            placeholder="Gõ từ tiếng Anh…" className="h-14 text-center text-xl" />
          <Button variant="primary" className="w-full" disabled={!typed.trim()} onClick={check}>Kiểm tra</Button>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className={cn("flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold",
            result ? "bg-green-500/10 text-green-700" : "bg-rose-500/10 text-rose-600")}>
            {result ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
            <button onClick={() => speakText(word!.term)} className="inline-flex items-center gap-1">{word!.term} <Volume2 className="h-4 w-4" /></button>
            {word!.meaning_vi ? <span className="font-normal text-muted-foreground">· {word!.meaning_vi}</span> : null}
          </div>
          {word!.example_en && <p className="rounded-xl border-2 bg-slate-50 p-3 text-sm italic text-neutral-700">“{word!.example_en}”</p>}
          <Button variant="primary" className="w-full" onClick={next}>Tiếp tục</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the review page**

Create `src/app/(app)/topics/review/page.tsx`:

```tsx
import { TopicReviewClient } from "@/components/topics/TopicReviewClient";

export const metadata = { title: "Ôn tập lộ trình" };

export default function TopicReviewPage() {
  return <TopicReviewClient />;
}
```

- [ ] **Step 3: Add the "Ôn tập" golden-moment entry to the roadmap**

In `src/components/topics/TopicRoadmap.tsx`, add a review-status fetch + banner. Near the top of the component body add state and effect:

```tsx
  const [review, setReview] = useState<{ dueCount: number; nextDueAt: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/topics/review")
      .then((r) => (r.ok ? r.json() : { dueCount: 0, nextDueAt: null }))
      .then((d) => { if (!cancelled) setReview({ dueCount: d.dueCount ?? 0, nextDueAt: d.nextDueAt ?? null }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
```

Then render a banner just above the days list (after the "Hôm nay" block), showing the due count when there are due words:

```tsx
      {review && review.dueCount > 0 && (
        <Link href="/topics/review"
          className="mb-4 flex items-center justify-between rounded-2xl border-b-4 border-orange-500 bg-orange-400 px-5 py-4 font-bold text-white shadow-sm transition hover:bg-orange-500 active:border-b-2">
          <span>⏰ Ôn tập · {review.dueCount} từ đến “Thời gian vàng”</span>
          <span aria-hidden>→</span>
        </Link>
      )}
```

(Uses the existing `Link` import; add `useState`/`useEffect` if not already imported — they are, from the days fetch.)

- [ ] **Step 4: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: compiles; `/topics/review` present as a route.

- [ ] **Step 5: Manual smoke**

Run `npm run dev`, sign in, complete `/topics/1` (enrolls its 25 words). On `/topics` the "Ôn tập" banner appears once words are due (first golden moment ~1h; to test immediately, verify a row exists in `user_topic_srs`). Open `/topics/review`: for each due word, the blanked example + image show, type the word, get correct/incorrect + full card + TTS, advance, finish screen.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/topics/review/page.tsx" src/components/topics/TopicReviewClient.tsx src/components/topics/TopicRoadmap.tsx
git commit -m "feat: topic review UI (recall-before-reveal) + golden-moment roadmap entry"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS — includes updated `topic-deck.test.ts`.

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: no errors; routes `/topics`, `/topics/[day]`, `/topics/review`, `/api/topics`, `/api/topics/[day]`, `/api/topics/[day]/grade`, `/api/topics/review` all present.

- [ ] **Step 3: End-to-end pass (dev server)**

With 20 days seeded: complete Day 1 (presentation slides, real PrepVocab images, TTS, tap-reveals, voice grading), confirm XP + Day 2 unlock, then the "Ôn tập" flow reviews enrolled words with recall-before-reveal and updates the SRS.

- [ ] **Step 4: Confirm no mobile changes**

Run: `git diff --name-only <branch-base>..HEAD -- mobile`
Expected: empty output.

---

## Self-Review Notes (author)

- **Spec coverage:** source = 20 PrepVocab days (Task 3 `DAYS`); presentation slide union (Task 1); Framer Motion (Tasks 4–6); real images + TTS (Tasks 4–6, no `playAudio`); attribute tap-reveal (Task 5); dialogue reveal (Task 5); voice_qa kept (Task 6); SRS review table + enrollment + detailed recall UI + golden-moment entry (Tasks 2, 7, 8); English titles set in seed (Task 3). Kept infra (tables/API/roadmap/tts/grade) reused. No Remotion/Gemini. All spec sections mapped.
- **Type consistency:** slide union names (`CoverTopicSlide`/`VocabTopicSlide`/… discriminated by `type`) defined in Task 1 and consumed with the same field names in Tasks 4–6; `VoiceQaTopicSlide` fields (`question_en`/`question_vi`/`key_points`/`sample_answer_en`) unchanged so `VoiceQASlide` compiles; `submitTopicReview(wordId, correct)`/`finishTopicReview(reviewed, correct)` defined in Task 7 and called in Task 8; `GET /api/topics/review` response `{due, nextDueAt, dueCount}` matches both the review client and the roadmap banner.
- **Intermediate build states:** Tasks 4–5 note that `TopicDeckRunner.tsx` may not compile until Task 6 rewires it; every other file compiles at each task. This is called out so a reviewer doesn't treat it as a defect.
- **Out of scope confirmed:** no mobile; course-1 flows untouched; Task 9 Step 4 guards mobile.
