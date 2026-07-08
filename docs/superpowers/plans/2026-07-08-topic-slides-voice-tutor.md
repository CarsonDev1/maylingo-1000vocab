# 30-Day Topic Slides + AI Voice Tutor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parallel "30-day topic program" mode: each day is a themed, PPT-style interactive slide deck (vocab image→choose, attribute MC, AI-voice situational Q&A), with all content pre-generated once and stored in the DB.

**Architecture:** Two new Supabase tables (`topic_days`, `user_topic_progress`). A seed script generates 30 decks via Groq (persona: dev targeting multinationals). A pure `topic-deck.ts` layer normalizes stored JSON and builds vocab MC options. Read/grade/complete happen through new API routes + one server action, reusing the existing `requireUserId`/`getSupabaseAdmin`/activity patterns. A full-screen `TopicDeckRunner` plays the slides; the voice slide uses browser `speechSynthesis` (TTS) + the existing `useSpeechRecognition` (STT) + a Groq grader.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind, Supabase (service-role), Groq, Web Speech API (`speechSynthesis` + recognition), vitest (node env).

## Global Constraints

- **Web app only.** Do not touch `mobile/`.
- **All 30 days of content are pre-generated once by the seed script and stored** — never generated per request. Runtime = read + render + grade.
- **Persona for all AI generation + grading:** "a software engineer aiming to communicate/interview at a multinational company." Attribute + voice content must be workplace/interview-framed even when the base lesson is general.
- **Course is `course_id = 1`.** The 30-day → lesson_id mapping is fixed (Task 3 constant).
- **Reuse, don't duplicate:** existing `requireUserId` (`@/lib/auth`), `getSupabaseAdmin` (`@/lib/supabase/server`), activity/streak helpers (`@/lib/actions`), `useSpeechRecognition` (`@/lib/speech-recognition`), `_supabase.mjs` seed helpers, and the Groq fetch/back-off pattern from `scripts/generate-word-details.mjs` and `src/app/api/speaking/grade/route.ts`.
- **Unlock rule:** day 1 always unlocked; day N (N>1) unlocked iff day N-1 is completed. Completed days stay replayable.
- **Graceful degradation:** no STT (non-Chrome) → type the answer; no TTS → question shown as text only. Never block.
- **AI grading tolerates speech-to-text transcripts** (ignore punctuation/casing), returns Vietnamese feedback, and has a non-AI fallback when Groq fails.
- Env keys (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_HOST`, `SUPABASE_DB_PASSWORD`, `GROQ_API_KEY`, `GROQ_MODEL`.
- Tests live in `src/**/*.test.ts` (vitest node env — no component tests). Single file: `npx vitest run <path>`. Full: `npm test`. Also `npm run lint` and `npm run build` must pass.
- Vietnamese UI copy, matching the app's existing voice and green theme.

---

## File Structure

- `src/types/index.ts` — **modify:** add topic types (`TopicSlide`, `TopicDeck`, `TopicDaySummary`).
- `src/lib/topic-deck.ts` — **create:** normalizer, `buildVocabOptions`, `isDayUnlocked` (pure).
- `src/lib/topic-deck.test.ts` — **create:** unit tests.
- `scripts/migrate-topic-tables.mjs` — **create:** idempotent schema.
- `scripts/generate-topic-decks.mjs` — **create:** Groq seed for all 30 days.
- `src/app/api/topics/route.ts` — **create:** `GET` list of 30 days.
- `src/app/api/topics/[day]/route.ts` — **create:** `GET` one day's deck + words.
- `src/app/api/topics/[day]/grade/route.ts` — **create:** `POST` grade a voice answer.
- `src/lib/actions.ts` — **modify:** add `finishTopicDay` server action.
- `src/components/sidebar.tsx` + `src/components/mobile-tab-bar.tsx` — **modify:** add "Lộ trình" nav.
- `src/app/(app)/topics/page.tsx` + `src/components/topics/TopicRoadmap.tsx` — **create:** roadmap menu.
- `src/lib/tts.ts` — **create:** `speakText` / `isTtsSupported`.
- `src/app/(app)/topics/[day]/page.tsx` + `src/components/topics/TopicDeckRunner.tsx` + `VocabSlide.tsx` + `AttributeSlide.tsx` + `VoiceQASlide.tsx` — **create:** the deck experience.

---

## Task 1: Topic types + pure `topic-deck.ts` layer

**Files:**
- Modify: `src/types/index.ts` (append after the existing exercise types, ~line 142)
- Create: `src/lib/topic-deck.ts`
- Test: `src/lib/topic-deck.test.ts`

**Interfaces:**
- Consumes: existing `Word` from `@/types`.
- Produces:
  - Types `VocabSlide`, `AttributeSlide`, `VoiceQaSlide`, `TopicSlide` (discriminated union on `type`), `TopicDeck`, `TopicDaySummary`.
  - `normalizeSlides(raw: unknown): TopicSlide[]`
  - `buildVocabOptions(word: Word, pool: Word[]): { label: string; correct: boolean }[]` (4 options, shuffled, exactly one `correct`)
  - `isDayUnlocked(dayNo: number, completedDays: Set<number>): boolean`

- [ ] **Step 1: Add the types**

Append to `src/types/index.ts`:

```ts
// ── 30-day topic program ────────────────────────────────────────────────────
export interface VocabSlide {
  type: "vocab";
  word_id: number;
}
export interface AttributeOption {
  label: string;
  correct: boolean;
}
export interface AttributeSlide {
  type: "attribute";
  word_id: number | null; // optional image anchor
  prompt_en: string;
  prompt_vi: string;
  options: AttributeOption[];
  explain_vi: string | null;
}
export interface VoiceQaSlide {
  type: "voice_qa";
  question_en: string;
  question_vi: string;
  key_points: string[];
  sample_answer_en: string | null;
}
export type TopicSlide = VocabSlide | AttributeSlide | VoiceQaSlide;

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

- [ ] **Step 2: Write the failing test**

Create `src/lib/topic-deck.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { normalizeSlides, buildVocabOptions, isDayUnlocked } from "@/lib/topic-deck";
import type { Word } from "@/types";

function w(id: number, term: string): Word {
  return {
    id, lesson_id: 1, term, pos: null, phonetic_uk: null, phonetic_us: null,
    meaning_vi: null, meaning_en: null, meaning_ja: null, meaning_ko: null,
    meaning_th: null, meaning_zh: null, example_en: null, example_vi: null,
    audio_url: null, audio_sentence_url: null, image_url: null,
  };
}

describe("normalizeSlides", () => {
  test("keeps valid slides of each type and drops malformed ones", () => {
    const raw = [
      { type: "vocab", word_id: 5 },
      { type: "vocab" }, // missing word_id -> dropped
      { type: "attribute", word_id: null, prompt_en: "P", prompt_vi: "P vi",
        options: [{ label: "a", correct: true }, { label: "b", correct: false }], explain_vi: "x" },
      { type: "attribute", prompt_en: "no options" }, // dropped
      { type: "voice_qa", question_en: "Q", question_vi: "Q vi", key_points: ["a", "b"], sample_answer_en: "s" },
      { type: "voice_qa", question_vi: "no english" }, // dropped
      { type: "nonsense" }, // dropped
      "garbage", // dropped
    ];
    const out = normalizeSlides(raw);
    expect(out.map((s) => s.type)).toEqual(["vocab", "attribute", "voice_qa"]);
  });

  test("non-array input yields empty array", () => {
    expect(normalizeSlides(null)).toEqual([]);
    expect(normalizeSlides({})).toEqual([]);
  });

  test("attribute requires at least one correct option", () => {
    const out = normalizeSlides([
      { type: "attribute", word_id: null, prompt_en: "P", prompt_vi: "V",
        options: [{ label: "a", correct: false }], explain_vi: null },
    ]);
    expect(out).toEqual([]);
  });
});

describe("buildVocabOptions", () => {
  test("returns 4 options with exactly one correct = the word's term", () => {
    const word = w(1, "shirt");
    const pool = [w(2, "trousers"), w(3, "jacket"), w(4, "dress"), w(5, "hat")];
    const opts = buildVocabOptions(word, pool);
    expect(opts).toHaveLength(4);
    expect(opts.filter((o) => o.correct)).toHaveLength(1);
    expect(opts.find((o) => o.correct)!.label).toBe("shirt");
    // all labels distinct
    expect(new Set(opts.map((o) => o.label)).size).toBe(4);
  });

  test("degrades gracefully when the pool is too small", () => {
    const opts = buildVocabOptions(w(1, "shirt"), [w(2, "hat")]);
    expect(opts.length).toBeGreaterThanOrEqual(2);
    expect(opts.filter((o) => o.correct)).toHaveLength(1);
  });
});

describe("isDayUnlocked", () => {
  test("day 1 is always unlocked", () => {
    expect(isDayUnlocked(1, new Set())).toBe(true);
  });
  test("day N unlocked only if N-1 completed", () => {
    expect(isDayUnlocked(5, new Set([4]))).toBe(true);
    expect(isDayUnlocked(5, new Set([3]))).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/topic-deck.test.ts`
Expected: FAIL — `@/lib/topic-deck` does not exist.

- [ ] **Step 4: Implement `topic-deck.ts`**

Create `src/lib/topic-deck.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/topic-deck.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — pre-existing tests plus the new file.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/lib/topic-deck.ts src/lib/topic-deck.test.ts
git commit -m "feat: topic-deck types + normalizer/options/unlock (pure)"
```

---

## Task 2: Schema migration script

**Files:**
- Create: `scripts/migrate-topic-tables.mjs`

**Interfaces:**
- Produces two tables: `topic_days(day_no pk, lesson_id, title_en, title_vi, slides jsonb, model, generated_at, updated_at)` and `user_topic_progress(user_id, day_no, completed_at, best_score, pk(user_id,day_no))`.

- [ ] **Step 1: Write the migration script**

Create `scripts/migrate-topic-tables.mjs` (mirrors `scripts/migrate-method-tables.mjs`):

```js
// Idempotently create the 30-day topic-program tables on Supabase Postgres.
// Safe to run on a populated DB. Env (.env.local): SUPABASE_DB_HOST, SUPABASE_DB_PASSWORD.
import pg from "pg";
import { loadEnv } from "./_supabase.mjs";

loadEnv();
const host = process.env.SUPABASE_DB_HOST;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!host || !password) {
  console.error("Missing SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const SQL = `
create table if not exists public.topic_days (
  day_no       integer primary key,
  lesson_id    integer not null references public.lessons(id),
  title_en     text,
  title_vi     text,
  slides       jsonb   not null default '[]'::jsonb,
  model        text,
  generated_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists topic_days_updated_at on public.topic_days;
create trigger topic_days_updated_at before update on public.topic_days
  for each row execute function public.set_updated_at();

create table if not exists public.user_topic_progress (
  user_id      text    not null,
  day_no       integer not null,
  completed_at timestamptz not null default now(),
  best_score   integer,
  primary key (user_id, day_no)
);
create index if not exists idx_utp_user on public.user_topic_progress(user_id);
`;

const client = new pg.Client({
  host, port: 5432, user: "postgres", password, database: "postgres",
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  console.error("Connected:", host);
  await client.query(SQL);
  await client.query("notify pgrst, 'reload schema';");
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_name in ('topic_days','user_topic_progress') order by table_name",
  );
  console.error("topic tables present:", rows.map((r) => r.table_name).join(", ") || "(none)");
  await client.end();
  process.exit(0);
} catch (e) {
  console.error("MIGRATE ERROR:", e.message);
  await client.end().catch(() => {});
  process.exit(2);
}
```

- [ ] **Step 2: Run the migration and verify**

Run: `node scripts/migrate-topic-tables.mjs`
Expected: prints `topic tables present: topic_days, user_topic_progress` and exits 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-topic-tables.mjs
git commit -m "feat: migration for topic_days + user_topic_progress"
```

---

## Task 3: Content generation seed script

**Files:**
- Create: `scripts/generate-topic-decks.mjs`

**Interfaces:**
- Consumes: `topic_days` table (Task 2), `_supabase.mjs` helpers, Groq.
- Produces: 30 `topic_days` rows, each `slides` = ordered `[6× vocab, 3× attribute, 3× voice_qa]` matching the Task 1 slide shapes.

- [ ] **Step 1: Write the seed script**

Create `scripts/generate-topic-decks.mjs`:

```js
// Generate all 30 topic decks via Groq into topic_days (persona: software engineer
// aiming to work at a multinational company). Idempotent: skips days that already
// have a row unless --force. Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
// GROQ_API_KEY, optional GROQ_MODEL. Prereq: run scripts/migrate-topic-tables.mjs.
//
// Usage:
//   node scripts/generate-topic-decks.mjs             # all missing days
//   node scripts/generate-topic-decks.mjs --limit 2   # first 2 days (test)
//   node scripts/generate-topic-decks.mjs --day 9     # only day 9
//   node scripts/generate-topic-decks.mjs --force     # regenerate all
import { loadEnv, getServiceClient, sleep } from "./_supabase.mjs";

loadEnv();

// day_no -> lesson_id (course_id = 1). Fixed curriculum for a dev going multinational.
const DAYS = [
  [1, 39], [2, 40], [3, 41], [4, 42], [5, 10], [6, 13], [7, 43], [8, 38], [9, 97], [10, 15],
  [11, 4], [12, 14], [13, 45], [14, 88], [15, 22], [16, 51], [17, 99], [18, 21], [19, 20], [20, 94],
  [21, 92], [22, 93], [23, 24], [24, 91], [25, 86], [26, 87], [27, 3], [28, 100], [29, 96], [30, 83],
];

const VOCAB_PER_DAY = 6;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const num = (flag) => { const i = args.indexOf(flag); return i >= 0 ? Number(args[i + 1]) : null; };
const LIMIT = num("--limit");
const ONLY_DAY = num("--day");

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
if (!GROQ_KEY) { console.error("Missing GROQ_API_KEY in .env.local"); process.exit(1); }

const db = getServiceClient();

function cleanString(v) { if (typeof v !== "string") return null; const t = v.trim(); return t ? t : null; }

function normOptions(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const label = cleanString(it.label);
    if (!label) continue;
    out.push({ label, correct: it.correct === true });
    if (out.length === 4) break;
  }
  return out;
}
function normStrings(input, max) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const it of input) { const s = cleanString(it); if (s) out.push(s); if (out.length === max) break; }
  return out;
}

async function groq(messages, maxTokens) {
  const payload = JSON.stringify({
    model: GROQ_MODEL, messages, response_format: { type: "json_object" },
    temperature: 0.6, max_tokens: maxTokens,
  });
  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: payload,
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

async function generateDeck(lesson, words) {
  // Vocab slides: prefer words with an image, keep original order.
  const vocab = [...words].sort((a, b) => (b.image_url ? 1 : 0) - (a.image_url ? 1 : 0))
    .slice(0, VOCAB_PER_DAY)
    .map((w) => ({ type: "vocab", word_id: w.id }));

  const wordList = words.slice(0, 20).map((w) => `${w.term}${w.meaning_vi ? " (" + w.meaning_vi + ")" : ""}`).join(", ");
  const topic = lesson.title_en ?? lesson.title_vi ?? "this topic";

  const system =
    "You design English communication practice for a Vietnamese software engineer who wants to work and interview at multinational companies. " +
    "Frame everything around real workplace/interview situations (standups, code review, meetings, deadlines, interviews, salary talk, cross-cultural small talk). " +
    "Reply ONLY with valid JSON.";
  const user = `Topic: "${topic}". Vocabulary available: ${wordList}.

Create JSON with EXACTLY these fields:
{
  "attribute": [
    { "word": "<one word from the vocabulary this question is about, or empty>",
      "prompt_en": "<a short fill-in / factual multiple-choice question in English about the topic, workplace-relevant>",
      "prompt_vi": "<the Vietnamese translation of prompt_en>",
      "options": [ {"label":"<en>","correct":true}, {"label":"<en>","correct":false}, {"label":"<en>","correct":false}, {"label":"<en>","correct":false} ],
      "explain_vi": "<1 short Vietnamese sentence explaining why the correct answer is right>" }
  ],
  "voice_qa": [
    { "question_en": "<a situational spoken question an interviewer or colleague would ask about this topic, for a software engineer>",
      "question_vi": "<Vietnamese translation>",
      "key_points": ["<point the answer should cover>", "<another>", "<another>"],
      "sample_answer_en": "<a 2-3 sentence strong sample answer>" }
  ]
}
Rules: "attribute" has EXACTLY 3 items, each with EXACTLY 4 options and EXACTLY one correct. "voice_qa" has EXACTLY 3 items, each with 2-3 key_points. Keep language natural and concise.`;

  const parsed = await groq([{ role: "system", content: system }, { role: "user", content: user }], 1600);
  const wordByTerm = new Map(words.map((w) => [w.term.toLowerCase(), w.id]));

  const attribute = (Array.isArray(parsed.attribute) ? parsed.attribute : []).map((a) => {
    const options = normOptions(a.options);
    const prompt_en = cleanString(a.prompt_en);
    const prompt_vi = cleanString(a.prompt_vi);
    if (!prompt_en || !prompt_vi || options.length < 2 || !options.some((o) => o.correct)) return null;
    const wid = wordByTerm.get(cleanString(a.word)?.toLowerCase() ?? "") ?? null;
    return { type: "attribute", word_id: wid, prompt_en, prompt_vi, options, explain_vi: cleanString(a.explain_vi) };
  }).filter(Boolean).slice(0, 3);

  const voice_qa = (Array.isArray(parsed.voice_qa) ? parsed.voice_qa : []).map((v) => {
    const question_en = cleanString(v.question_en);
    const question_vi = cleanString(v.question_vi);
    if (!question_en || !question_vi) return null;
    return { type: "voice_qa", question_en, question_vi, key_points: normStrings(v.key_points, 5), sample_answer_en: cleanString(v.sample_answer_en) };
  }).filter(Boolean).slice(0, 3);

  if (attribute.length === 0 && voice_qa.length === 0) throw new Error("empty generation");
  return [...vocab, ...attribute, ...voice_qa];
}

// ---------- main ----------
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
for (const [day_no, lesson_id] of days) {
  try {
    const { data: lesson } = await db.from("lessons").select("id,title_en,title_vi").eq("id", lesson_id).maybeSingle();
    if (!lesson) throw new Error(`lesson ${lesson_id} not found`);
    const { data: words } = await db.from("words").select("id,term,meaning_vi,image_url").eq("lesson_id", lesson_id).order("id");
    if (!words || words.length === 0) throw new Error(`no words for lesson ${lesson_id}`);
    const slides = await generateDeck(lesson, words);
    const { error } = await db.from("topic_days").upsert({
      day_no, lesson_id,
      title_en: lesson.title_en, title_vi: lesson.title_vi,
      slides, model: GROQ_MODEL, generated_at: new Date().toISOString(),
    }, { onConflict: "day_no" });
    if (error) throw new Error(error.message);
    ok++;
    console.error(`  ✓ day ${day_no} (${lesson.title_en}) — ${slides.length} slides`);
  } catch (e) {
    failed++;
    console.error(`  ✗ day ${day_no}: ${e.message}`);
  }
  await sleep(300);
}
console.error(`\nDone. generated: ${ok}, failed: ${failed}. Re-run to fill gaps.`);
```

- [ ] **Step 2: Seed a couple of days and verify**

Run: `node scripts/generate-topic-decks.mjs --limit 2`
Expected: prints `✓ day 1 …` and `✓ day 2 …` with slide counts (~12 each), `generated: 2, failed: 0`.

- [ ] **Step 3: Spot-check the stored shape**

Run:
```bash
node -e 'import("./scripts/_supabase.mjs").then(async(m)=>{m.loadEnv();const db=m.getServiceClient();const{data}=await db.from("topic_days").select("day_no,slides").eq("day_no",1).single();console.log(JSON.stringify(data.slides.map(s=>s.type)));})'
```
Expected: a JSON array like `["vocab","vocab","vocab","vocab","vocab","vocab","attribute","attribute","attribute","voice_qa","voice_qa","voice_qa"]`.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-topic-decks.mjs
git commit -m "feat: generate-topic-decks seed script (persona-framed)"
```

- [ ] **Step 5: Generate the full 30 days (activation, not committed)**

Run: `node scripts/generate-topic-decks.mjs`
Expected: fills the remaining days (`generated: 28, failed: 0`). This is data seeding, no code change.

---

## Task 4: Read API routes (list + deck)

**Files:**
- Create: `src/app/api/topics/route.ts`
- Create: `src/app/api/topics/[day]/route.ts`

**Interfaces:**
- Consumes: `requireUserId` (`@/lib/auth`), `getSupabaseAdmin` (`@/lib/supabase/server`), `normalizeSlides`, `isDayUnlocked` (`@/lib/topic-deck`), `Word`/`TopicDaySummary` (`@/types`).
- Produces:
  - `GET /api/topics` → `{ days: TopicDaySummary[] }`
  - `GET /api/topics/[day]` → `{ deck: { day_no, lesson_id, title_en, title_vi, slides }, words: Word[] }`, or 403 `{ error }` if locked, 404 if the day has no deck.

- [ ] **Step 1: Implement the list route**

Create `src/app/api/topics/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isDayUnlocked } from "@/lib/topic-deck";
import type { TopicDaySummary } from "@/types";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const [{ data: days }, { data: progress }] = await Promise.all([
    db.from("topic_days").select("day_no,lesson_id,title_en,title_vi").order("day_no"),
    db.from("user_topic_progress").select("day_no,best_score").eq("user_id", userId),
  ]);

  const completed = new Set(((progress as { day_no: number }[]) ?? []).map((p) => p.day_no));
  const scoreByDay = new Map(((progress as { day_no: number; best_score: number | null }[]) ?? []).map((p) => [p.day_no, p.best_score]));

  const summaries: TopicDaySummary[] = ((days as Omit<TopicDaySummary, "unlocked" | "completed" | "best_score">[]) ?? []).map((d) => ({
    ...d,
    unlocked: isDayUnlocked(d.day_no, completed),
    completed: completed.has(d.day_no),
    best_score: scoreByDay.get(d.day_no) ?? null,
  }));

  return NextResponse.json({ days: summaries });
}
```

- [ ] **Step 2: Implement the deck route**

Create `src/app/api/topics/[day]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeSlides, isDayUnlocked } from "@/lib/topic-deck";
import type { Word } from "@/types";

function parseDay(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : null;
}

export async function GET(_req: Request, { params }: { params: { day: string } }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dayNo = parseDay(params.day);
  if (dayNo == null) return NextResponse.json({ error: "Invalid day" }, { status: 400 });

  const db = getSupabaseAdmin();
  const [{ data: row }, { data: progress }] = await Promise.all([
    db.from("topic_days").select("day_no,lesson_id,title_en,title_vi,slides").eq("day_no", dayNo).maybeSingle(),
    db.from("user_topic_progress").select("day_no").eq("user_id", userId),
  ]);
  if (!row) return NextResponse.json({ error: "Day not found" }, { status: 404 });

  const completed = new Set(((progress as { day_no: number }[]) ?? []).map((p) => p.day_no));
  if (!isDayUnlocked(dayNo, completed)) {
    return NextResponse.json({ error: "Locked" }, { status: 403 });
  }

  const slides = normalizeSlides((row as { slides: unknown }).slides);
  const wordIds = Array.from(
    new Set(
      slides.flatMap((s) =>
        s.type === "vocab" ? [s.word_id] : s.type === "attribute" && s.word_id != null ? [s.word_id] : [],
      ),
    ),
  );

  let words: Word[] = [];
  if (wordIds.length) {
    // Also pull the whole lesson so vocab slides have enough distractors.
    const { data } = await db.from("words").select("*").eq("lesson_id", (row as { lesson_id: number }).lesson_id).order("id");
    words = (data as Word[]) ?? [];
  }

  return NextResponse.json({
    deck: {
      day_no: (row as { day_no: number }).day_no,
      lesson_id: (row as { lesson_id: number }).lesson_id,
      title_en: (row as { title_en: string | null }).title_en,
      title_vi: (row as { title_vi: string | null }).title_vi,
      slides,
    },
    words,
  });
}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: compiles; routes appear in the build output.

- [ ] **Step 4: Smoke-test the routes (dev server + browser session)**

With `npm run dev` running and signed in, visit `http://localhost:3000/api/topics` in the browser.
Expected: JSON `{ "days": [ { "day_no": 1, ... "unlocked": true, "completed": false } , ... ] }` (30 entries once seeded).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/topics/route.ts "src/app/api/topics/[day]/route.ts"
git commit -m "feat: topics list + deck read API routes"
```

---

## Task 5: Grade route + completion action

**Files:**
- Create: `src/app/api/topics/[day]/grade/route.ts`
- Modify: `src/lib/actions.ts` (add `finishTopicDay`)

**Interfaces:**
- Consumes: `requireUserId`, `getSupabaseAdmin`, existing private `bumpActivity`/`touchStreak` in `actions.ts`.
- Produces:
  - `POST /api/topics/[day]/grade` — body `{ questionEn: string; keyPoints: string[]; answer: string }` → `{ score: number; feedbackVi: string; covered: string[] }`.
  - `finishTopicDay(dayNo: number, scores: number[]): Promise<{ xpEarned: number }>` (server action).

- [ ] **Step 1: Implement the grade route**

Create `src/app/api/topics/[day]/grade/route.ts` (mirrors `src/app/api/speaking/grade/route.ts`):

```ts
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";

interface GradeResult {
  score: number;
  feedback_vi: string;
  covered: string[];
}

async function gradeWithGroq(questionEn: string, keyPoints: string[], answer: string): Promise<GradeResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const system =
    "Bạn là giáo viên tiếng Anh giao tiếp cho một software engineer người Việt muốn làm việc ở công ty đa quốc gia. " +
    "Đây là BẢN CHÉP LỜI NÓI (speech-to-text) nên có thể thiếu dấu câu — ĐỪNG soi lỗi dấu câu/viết hoa. " +
    "Chấm theo mức độ trả lời đúng trọng tâm, tự nhiên, đủ ý. Trả lời ONLY bằng valid JSON.";
  const user = `Câu hỏi: "${questionEn}"
Các ý nên có trong câu trả lời: ${keyPoints.length ? keyPoints.join("; ") : "(không có)"}
Câu trả lời của học viên (đã chép lại):
"""
${answer}
"""
Trả về JSON:
{
  "score": <số nguyên 0-100: mức độ trả lời tốt, tự nhiên, đủ ý>,
  "covered": <mảng các ý (lấy nguyên văn từ danh sách trên) mà câu trả lời ĐÃ đề cập>,
  "feedback_vi": <nhận xét TIẾNG VIỆT 3-5 câu: (1) khen điểm tốt; (2) chỗ diễn đạt chưa tự nhiên + cách nói hay hơn (kèm 1 mẫu câu tiếng Anh); (3) động viên>
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 700,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as GradeResult;
}

export async function POST(req: Request, { params }: { params: { day: string } }) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  void params;

  let body: { questionEn?: string; keyPoints?: string[]; answer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const questionEn = (body.questionEn ?? "").trim();
  const keyPoints = Array.isArray(body.keyPoints) ? body.keyPoints.filter((k) => typeof k === "string") : [];
  const answer = (body.answer ?? "").trim();
  if (!answer) return NextResponse.json({ error: "Empty answer" }, { status: 400 });

  let result: GradeResult;
  try {
    result = await gradeWithGroq(questionEn, keyPoints, answer);
  } catch {
    // Fallback: keyword overlap of the key points against the answer.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "");
    const a = norm(answer);
    const covered = keyPoints.filter((k) => norm(k).split(/\s+/).some((w) => w.length > 3 && a.includes(w)));
    result = {
      score: Math.min(100, 50 + covered.length * 15),
      covered,
      feedback_vi: "Đã ghi nhận câu trả lời của bạn! Cứ luyện nói đều đặn, cố gắng nói đủ ý và tự nhiên hơn nhé.",
    };
  }

  const score = Math.min(100, Math.max(0, Math.round(Number(result.score) || 0)));
  const covered = Array.isArray(result.covered) ? result.covered.filter((c) => typeof c === "string") : [];
  const feedbackVi = typeof result.feedback_vi === "string" && result.feedback_vi.trim()
    ? result.feedback_vi.trim()
    : "Câu trả lời tốt! Tiếp tục luyện nói nhé.";

  return NextResponse.json({ score, feedbackVi, covered });
}
```

- [ ] **Step 2: Add the `finishTopicDay` server action**

In `src/lib/actions.ts`, append (it reuses the file's existing private `bumpActivity` + `touchStreak`):

```ts
/**
 * Mark a topic day complete: record progress (best avg voice score), award XP,
 * touch the streak. Revalidates sibling paths only — NOT /topics/[day] — so the
 * deck's finish screen is not replaced by a refetch.
 */
export async function finishTopicDay(dayNo: number, scores: number[]): Promise<{ xpEarned: number }> {
  const userId = await requireUserId();
  const db = getSupabaseAdmin();

  const clean = scores.filter((s) => Number.isFinite(s)).map((s) => Math.min(100, Math.max(0, Math.round(s))));
  const avg = clean.length ? Math.round(clean.reduce((a, b) => a + b, 0) / clean.length) : null;
  const xpEarned = 30 + clean.length * 5;

  const { data: prev } = await db
    .from("user_topic_progress")
    .select("best_score")
    .eq("user_id", userId)
    .eq("day_no", dayNo)
    .maybeSingle();
  const bestScore = avg == null ? (prev?.best_score ?? null) : Math.max(avg, prev?.best_score ?? 0);

  await db.from("user_topic_progress").upsert(
    { user_id: userId, day_no: dayNo, completed_at: new Date().toISOString(), best_score: bestScore },
    { onConflict: "user_id,day_no" },
  );
  await bumpActivity(userId, { xp: xpEarned });
  await touchStreak(userId);

  revalidatePath("/topics");
  revalidatePath("/dashboard");
  return { xpEarned };
}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: compiles; `/api/topics/[day]/grade` appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/topics/[day]/grade/route.ts" src/lib/actions.ts
git commit -m "feat: topic voice-answer grade route + finishTopicDay action"
```

---

## Task 6: Nav entry + 30-day roadmap menu

**Files:**
- Modify: `src/components/sidebar.tsx` (add item after Speaking, ~line 26)
- Modify: `src/components/mobile-tab-bar.tsx` (add tab, ~line 13)
- Create: `src/app/(app)/topics/page.tsx`
- Create: `src/components/topics/TopicRoadmap.tsx`

**Interfaces:**
- Consumes: `GET /api/topics` → `{ days: TopicDaySummary[] }`.
- Produces: the `/topics` page.

- [ ] **Step 1: Add the sidebar item**

In `src/components/sidebar.tsx`, add after the Speaking item (line 26):

```tsx
        <SidebarItem label="Lộ trình" href="/topics" iconSrc="/learn.svg" />
```

- [ ] **Step 2: Add the mobile tab**

In `src/components/mobile-tab-bar.tsx`, update the icon import (line 5) to include `Map`:

```tsx
import { GraduationCap, RotateCw, BookOpen, BarChart3, Trophy, PenLine, Mic, Map } from "lucide-react";
```

Then add to the `TABS` array (after the Speaking entry, line 13):

```tsx
  { label: "Lộ trình", href: "/topics", Icon: Map, match: ["/topics"] },
```

- [ ] **Step 3: Create the page (server component)**

Create `src/app/(app)/topics/page.tsx`:

```tsx
import { TopicRoadmap } from "@/components/topics/TopicRoadmap";

export const metadata = { title: "Lộ trình 30 ngày" };

export default function TopicsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-extrabold text-neutral-700">Lộ trình 30 ngày</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mỗi ngày một chủ đề giao tiếp cho môi trường làm việc đa quốc gia — học qua slide tương tác và luyện nói với AI.
      </p>
      <TopicRoadmap />
    </div>
  );
}
```

- [ ] **Step 4: Create the roadmap client component**

Create `src/components/topics/TopicRoadmap.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Check, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopicDaySummary } from "@/types";

export function TopicRoadmap() {
  const [days, setDays] = useState<TopicDaySummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/topics")
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .then((d) => {
        if (!cancelled) setDays((d?.days as TopicDaySummary[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (days === null) {
    return (
      <div className="mt-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-green-500" />
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
        Chưa có nội dung lộ trình. (Chạy <code>node scripts/generate-topic-decks.mjs</code> để tạo.)
      </div>
    );
  }

  const nextDay = days.find((d) => d.unlocked && !d.completed);

  return (
    <div className="mt-5">
      {nextDay && (
        <Link
          href={`/topics/${nextDay.day_no}`}
          className="mb-5 flex items-center justify-between rounded-2xl border-b-4 border-green-600 bg-green-500 px-5 py-4 font-bold text-white shadow-sm transition hover:bg-green-600 active:border-b-2"
        >
          <span>
            Hôm nay · Ngày {nextDay.day_no}: {nextDay.title_en}
          </span>
          <Play className="h-5 w-5 shrink-0 fill-white" />
        </Link>
      )}

      <ul className="flex flex-col gap-2">
        {days.map((d) => {
          const state = d.completed ? "done" : d.unlocked ? "open" : "locked";
          const inner = (
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition",
                state === "done" && "border-green-200 bg-green-50",
                state === "open" && "border-slate-200 bg-white hover:border-green-300 hover:bg-slate-50",
                state === "locked" && "border-slate-100 bg-slate-50 opacity-70",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  state === "done" && "bg-green-500 text-white",
                  state === "open" && "bg-green-500/15 text-green-600",
                  state === "locked" && "bg-slate-200 text-slate-400",
                )}
              >
                {state === "done" ? <Check className="h-5 w-5" /> : state === "locked" ? <Lock className="h-4 w-4" /> : d.day_no}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-neutral-700">
                  Ngày {d.day_no}: {d.title_en}
                </p>
                <p className="truncate text-xs text-muted-foreground">{d.title_vi}</p>
              </div>
              {d.completed && d.best_score != null && (
                <span className="shrink-0 text-xs font-bold text-green-600">{d.best_score}%</span>
              )}
            </div>
          );
          return (
            <li key={d.day_no}>
              {state === "locked" ? inner : <Link href={`/topics/${d.day_no}`}>{inner}</Link>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Verify build + lint, then smoke-test**

Run: `npm run lint && npm run build`
Expected: compiles.

With `npm run dev` + signed in, visit `/topics`. Expected: the "Lộ trình" nav item shows; the page lists Days 1–30 with Day 1 open, later days locked, and a "Hôm nay" button.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar.tsx src/components/mobile-tab-bar.tsx "src/app/(app)/topics/page.tsx" src/components/topics/TopicRoadmap.tsx
git commit -m "feat: Lộ trình nav + 30-day roadmap menu"
```

---

## Task 7: Deck runner + vocab & attribute slides (voice slide text-only)

**Files:**
- Create: `src/lib/tts.ts`
- Create: `src/app/(app)/topics/[day]/page.tsx`
- Create: `src/components/topics/TopicDeckClient.tsx`
- Create: `src/components/topics/TopicDeckRunner.tsx`
- Create: `src/components/topics/VocabSlide.tsx`
- Create: `src/components/topics/AttributeSlide.tsx`

**Interfaces:**
- Consumes: `GET /api/topics/[day]` → `{ deck, words }`; `finishTopicDay` (Task 5); `buildVocabOptions` (Task 1); `playAudio` (`@/lib/audio`); `Word`, `TopicSlide`, `TopicDeck` (`@/types`).
- Produces:
  - `speakText(text: string, opts?: { lang?: string; onEnd?: () => void }): void` and `isTtsSupported(): boolean` in `@/lib/tts`.
  - `TopicDeckRunner({ deck, words })` — plays the deck; each slide calls `onDone(score?: number)`.
  - `VocabSlide({ slide, words, onDone })`, `AttributeSlide({ slide, words, onDone })`.

- [ ] **Step 1: Create the TTS helper**

Create `src/lib/tts.ts`:

```ts
/** Browser text-to-speech (Web Speech API). No-ops gracefully where unsupported. */
export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakText(text: string, opts: { lang?: string; onEnd?: () => void } = {}): void {
  if (!isTtsSupported() || !text.trim()) {
    opts.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel(); // stop anything already speaking
  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts.lang ?? "en-US";
  u.rate = 0.95;
  if (opts.onEnd) u.onend = () => opts.onEnd!();
  synth.speak(u);
}
```

- [ ] **Step 2: Create the vocab slide**

Create `src/components/topics/VocabSlide.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Volume2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playAudio } from "@/lib/audio";
import { buildVocabOptions } from "@/lib/topic-deck";
import { cn } from "@/lib/utils";
import type { VocabSlide as VocabSlideT, Word } from "@/types";

export function VocabSlide({ slide, words, onDone }: { slide: VocabSlideT; words: Word[]; onDone: (score?: number) => void }) {
  const word = words.find((w) => w.id === slide.word_id);
  const options = useMemo(() => (word ? buildVocabOptions(word, words) : []), [word, words]);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Image appears first; play the word audio once it does.
  useEffect(() => {
    const t = setTimeout(() => word && playAudio(word.audio_url), 400);
    return () => clearTimeout(t);
  }, [word]);

  if (!word) {
    // Missing word data — skip this slide rather than block.
    return (
      <div className="text-center">
        <Button variant="primary" onClick={() => onDone()}>Tiếp tục</Button>
      </div>
    );
  }

  function choose(i: number, correct: boolean) {
    if (revealed) return;
    setPicked(i);
    setRevealed(true);
    playAudio(correct ? "/correct.mp3" : "/incorrect.mp3");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
      <div className="animate-in fade-in zoom-in-95 duration-300">
        {word.image_url ? (
          <Image src={word.image_url} alt="" width={240} height={200} unoptimized className="h-48 w-auto rounded-2xl object-contain" />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-slate-100 text-5xl">🗂️</div>
        )}
      </div>
      <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Đây là gì?</p>

      <div className="grid w-full grid-cols-2 gap-3">
        {options.map((opt, i) => {
          const show = revealed;
          return (
            <button
              key={i}
              disabled={show}
              onClick={() => choose(i, opt.correct)}
              className={cn(
                "flex items-center justify-between rounded-xl border-2 border-b-4 px-4 py-3 text-left font-semibold text-neutral-700 transition",
                !show && "hover:bg-slate-50 active:border-b-2",
                show && opt.correct && "border-green-500 bg-green-500/10 text-green-700",
                show && !opt.correct && picked === i && "border-rose-500 bg-rose-500/10 text-rose-600",
                show && !opt.correct && picked !== i && "opacity-60",
              )}
            >
              <span>{opt.label}</span>
              {show && opt.correct && <Check className="h-5 w-5 text-green-600" />}
              {show && !opt.correct && picked === i && <X className="h-5 w-5 text-rose-500" />}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="flex w-full flex-col items-center gap-3">
          <button onClick={() => playAudio(word.audio_url)} className="flex items-center gap-2 text-sky-500" aria-label="Play audio">
            <Volume2 className="h-5 w-5" /> <span className="font-bold">{word.term}</span>
            {word.meaning_vi ? <span className="text-muted-foreground">— {word.meaning_vi}</span> : null}
          </button>
          <Button variant="primary" className="w-full" onClick={() => onDone()}>Tiếp tục</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the attribute slide**

Create `src/components/topics/AttributeSlide.tsx`:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playAudio } from "@/lib/audio";
import { cn } from "@/lib/utils";
import type { AttributeSlide as AttributeSlideT, Word } from "@/types";

export function AttributeSlide({ slide, words, onDone }: { slide: AttributeSlideT; words: Word[]; onDone: (score?: number) => void }) {
  const word = slide.word_id != null ? words.find((w) => w.id === slide.word_id) : undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  function choose(i: number, correct: boolean) {
    if (revealed) return;
    setPicked(i);
    setRevealed(true);
    playAudio(correct ? "/correct.mp3" : "/incorrect.mp3");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5">
      {word?.image_url ? (
        <Image src={word.image_url} alt="" width={180} height={150} unoptimized className="h-32 w-auto rounded-2xl object-contain" />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-100 text-4xl">💬</div>
      )}

      <p className="text-center text-lg font-semibold text-neutral-800">{slide.prompt_en}</p>
      <p className="text-center text-sm text-muted-foreground">{slide.prompt_vi}</p>

      <div className="grid w-full gap-3">
        {slide.options.map((opt, i) => {
          const show = revealed;
          return (
            <button
              key={i}
              disabled={show}
              onClick={() => choose(i, opt.correct)}
              className={cn(
                "flex items-center justify-between rounded-xl border-2 border-b-4 px-4 py-3 text-left font-semibold text-neutral-700 transition",
                !show && "hover:bg-slate-50 active:border-b-2",
                show && opt.correct && "border-green-500 bg-green-500/10 text-green-700",
                show && !opt.correct && picked === i && "border-rose-500 bg-rose-500/10 text-rose-600",
                show && !opt.correct && picked !== i && "opacity-60",
              )}
            >
              <span>{opt.label}</span>
              {show && opt.correct && <Check className="h-5 w-5 text-green-600" />}
              {show && !opt.correct && picked === i && <X className="h-5 w-5 text-rose-500" />}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="w-full">
          {slide.explain_vi && (
            <p className="mb-3 rounded-xl bg-amber-500/10 p-3 text-sm text-neutral-800">{slide.explain_vi}</p>
          )}
          <Button variant="primary" className="w-full" onClick={() => onDone()}>Tiếp tục</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the deck runner (voice slide = text-only for now)**

Create `src/components/topics/TopicDeckRunner.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playAudio } from "@/lib/audio";
import { finishTopicDay } from "@/lib/actions";
import { VocabSlide } from "@/components/topics/VocabSlide";
import { AttributeSlide } from "@/components/topics/AttributeSlide";
import type { TopicDeck, Word } from "@/types";

export function TopicDeckRunner({ deck, words }: { deck: TopicDeck; words: Word[] }) {
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [xp, setXp] = useState(0);

  const total = deck.slides.length;

  function next(score?: number) {
    const nextScores = score != null ? [...scores, score] : scores;
    if (score != null) setScores(nextScores);
    if (index + 1 >= total) finish(nextScores);
    else setIndex((i) => i + 1);
  }

  function finish(finalScores: number[]) {
    setFinished(true);
    playAudio("/finish.mp3");
    finishTopicDay(deck.day_no, finalScores)
      .then((r) => setXp(r.xpEarned))
      .catch(() => {});
  }

  if (total === 0) {
    return (
      <Overlay center>
        <Empty />
      </Overlay>
    );
  }

  if (finished) {
    return (
      <Overlay center>
        <div className="mx-auto w-full max-w-md px-6 text-center">
          <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-800 p-8">
            <Image src="/finish.svg" width={90} height={90} alt="" className="mx-auto" />
            <h2 className="mt-4 text-2xl font-bold text-white">Hoàn thành ngày {deck.day_no}!</h2>
            <p className="mt-1 text-neutral-300">{deck.title_en}</p>
            <div className="mt-6 rounded-xl border-2 border-orange-400/60 bg-orange-400/10 p-4">
              <p className="text-2xl font-bold text-orange-400">+{xp}</p>
              <p className="text-xs font-bold uppercase text-neutral-400">XP</p>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <Button asChild variant="secondary">
                <Link href="/topics">Về lộ trình</Link>
              </Button>
            </div>
          </div>
        </div>
      </Overlay>
    );
  }

  const slide = deck.slides[index];

  return (
    <Overlay>
      <header className="mx-auto flex w-full max-w-[1140px] items-center gap-3 px-4 pb-2 pt-6 lg:px-10">
        <Link href="/topics" aria-label="Exit" className="shrink-0 text-neutral-400 transition hover:text-white">
          <X className="h-7 w-7" />
        </Link>
        <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-white/90">
          <div className="h-full rounded-full bg-green-500 transition-all duration-300" style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <span className="shrink-0 text-sm font-bold text-neutral-400">{index + 1}/{total}</span>
      </header>

      <div className="flex-1 px-4 pt-6">
        <div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6" key={index}>
          {slide.type === "vocab" && <VocabSlide slide={slide} words={words} onDone={next} />}
          {slide.type === "attribute" && <AttributeSlide slide={slide} words={words} onDone={next} />}
          {slide.type === "voice_qa" && (
            <div className="mx-auto flex w-full max-w-md flex-col gap-4 text-center">
              <p className="text-sm font-bold uppercase tracking-wide text-sky-600">Câu hỏi luyện nói</p>
              <p className="text-lg font-semibold text-neutral-800">{slide.question_en}</p>
              <p className="text-sm text-muted-foreground">{slide.question_vi}</p>
              <Button variant="primary" onClick={() => next()}>Tiếp tục</Button>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={"fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-neutral-900 text-white" + (center ? " items-center justify-center" : "")}>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="mx-auto max-w-md px-6 text-center">
      <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-800 p-8">
        <h2 className="text-xl font-bold text-white">Chưa có nội dung cho ngày này</h2>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/topics">Về lộ trình</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the deck client wrapper + page**

Create `src/components/topics/TopicDeckClient.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopicDeckRunner } from "@/components/topics/TopicDeckRunner";
import type { TopicDeck, Word } from "@/types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; deck: TopicDeck; words: Word[] };

export function TopicDeckClient({ day }: { day: number }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/topics/${day}`)
      .then(async (r) => {
        if (r.status === 403) return { _err: "Ngày này chưa mở khóa. Hãy hoàn thành ngày trước đó." };
        if (!r.ok) return { _err: "Không tải được nội dung ngày này." };
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        if (d._err) setState({ status: "error", message: d._err });
        else setState({ status: "ready", deck: d.deck as TopicDeck, words: (d.words as Word[]) ?? [] });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Không kết nối được." });
      });
    return () => {
      cancelled = true;
    };
  }, [day]);

  if (state.status === "loading") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900">
        <Loader2 className="h-7 w-7 animate-spin text-green-500" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900 px-6 text-center">
        <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-800 p-8">
          <p className="text-white">{state.message}</p>
          <Button asChild variant="secondary" className="mt-5">
            <Link href="/topics">Về lộ trình</Link>
          </Button>
        </div>
      </div>
    );
  }
  return <TopicDeckRunner deck={state.deck} words={state.words} />;
}
```

Create `src/app/(app)/topics/[day]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { TopicDeckClient } from "@/components/topics/TopicDeckClient";

export default function TopicDayPage({ params }: { params: { day: string } }) {
  const day = Number(params.day);
  if (!Number.isInteger(day) || day < 1 || day > 30) notFound();
  return <TopicDeckClient day={day} />;
}
```

- [ ] **Step 6: Verify build + lint, then smoke-test**

Run: `npm run lint && npm run build`
Expected: compiles.

With `npm run dev` + signed in and Day 1 seeded, open `/topics/1`. Expected: full-screen deck; vocab slides show image then options; attribute slides show prompt + explanation; voice slides show the question text with a Continue button; finishing shows "+XP" and returns to `/topics`. Reload `/topics` — Day 1 now shows completed and Day 2 unlocked.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tts.ts "src/app/(app)/topics/[day]/page.tsx" src/components/topics/TopicDeckClient.tsx src/components/topics/TopicDeckRunner.tsx src/components/topics/VocabSlide.tsx src/components/topics/AttributeSlide.tsx
git commit -m "feat: topic deck runner + vocab & attribute slides"
```

---

## Task 8: AI voice conversation slide

**Files:**
- Create: `src/components/topics/VoiceQASlide.tsx`
- Modify: `src/components/topics/TopicDeckRunner.tsx` (swap the text-only voice block for `VoiceQASlide`)

**Interfaces:**
- Consumes: `speakText`/`isTtsSupported` (`@/lib/tts`), `useSpeechRecognition` (`@/lib/speech-recognition`), `POST /api/topics/[day]/grade`, `VoiceQaSlide` type (`@/types`).
- Produces: `VoiceQASlide({ slide, dayNo, onDone })` — reports a 0–100 score via `onDone(score)`.

- [ ] **Step 1: Create the voice Q&A slide**

Create `src/components/topics/VoiceQASlide.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Volume2, Mic, Square, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speakText, isTtsSupported } from "@/lib/tts";
import { useSpeechRecognition } from "@/lib/speech-recognition";
import { cn } from "@/lib/utils";
import type { VoiceQaSlide } from "@/types";

interface Grade {
  score: number;
  feedbackVi: string;
  covered: string[];
}

export function VoiceQASlide({ slide, dayNo, onDone }: { slide: VoiceQaSlide; dayNo: number; onDone: (score: number) => void }) {
  const { supported, listening, transcript, start, stop, reset } = useSpeechRecognition({ continuous: true });
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);

  // Read the question aloud once on mount.
  useEffect(() => {
    speakText(slide.question_en);
  }, [slide.question_en]);

  // Mic transcript fills the editable answer box.
  useEffect(() => {
    if (transcript) setText(transcript);
  }, [transcript]);

  async function submit() {
    const answer = text.trim();
    if (!answer || submitting) return;
    stop();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/topics/${dayNo}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionEn: slide.question_en, keyPoints: slide.key_points, answer }),
      });
      const data = await res.json();
      if (res.ok) setGrade({ score: data.score, feedbackVi: data.feedbackVi, covered: data.covered ?? [] });
      else setGrade({ score: 60, feedbackVi: "Đã ghi nhận câu trả lời của bạn.", covered: [] });
    } catch {
      setGrade({ score: 60, feedbackVi: "Không chấm được ngay bây giờ, nhưng câu trả lời đã được ghi nhận.", covered: [] });
    } finally {
      setSubmitting(false);
    }
  }

  if (grade) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="text-center">
          <p className="text-4xl font-extrabold text-green-600">{grade.score}<span className="text-lg text-muted-foreground">/100</span></p>
        </div>
        {slide.key_points.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {slide.key_points.map((k) => {
              const hit = grade.covered.some((c) => c.toLowerCase() === k.toLowerCase());
              return (
                <span key={k} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", hit ? "border-green-300 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-400")}>
                  {hit && <span className="mr-1">✓</span>}{k}
                </span>
              );
            })}
          </div>
        )}
        <div className="rounded-xl border-2 border-sky-100 bg-sky-50 p-3">
          <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-sky-700"><Sparkles className="h-3.5 w-3.5" /> Nhận xét</p>
          <p className="text-sm leading-relaxed text-sky-900">{grade.feedbackVi}</p>
        </div>
        {slide.sample_answer_en && (
          <details className="rounded-xl border-2 bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-neutral-700">Câu trả lời mẫu</summary>
            <p className="mt-2 italic text-neutral-700">{slide.sample_answer_en}</p>
          </details>
        )}
        <Button variant="primary" className="w-full" onClick={() => onDone(grade.score)}>Tiếp tục</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-sky-600">AI hỏi bạn</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <p className="text-lg font-semibold text-neutral-800">{slide.question_en}</p>
          {isTtsSupported() && (
            <button onClick={() => speakText(slide.question_en)} className="shrink-0 text-sky-500" aria-label="Đọc lại">
              <Volume2 className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{slide.question_vi}</p>
      </div>

      {supported && (
        <div className="flex justify-center">
          <button
            onClick={() => (listening ? stop() : (reset(), setText(""), start()))}
            className={cn("flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105", listening ? "animate-pulse bg-rose-500" : "bg-green-500")}
            aria-label={listening ? "Dừng" : "Nói"}
          >
            {listening ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
          </button>
        </div>
      )}

      <textarea
        className="min-h-[110px] w-full resize-none rounded-2xl border-2 border-slate-200 bg-white p-3 text-sm text-neutral-800 placeholder:text-slate-400 focus:border-green-400 focus:outline-none"
        placeholder={supported ? "Câu trả lời của bạn sẽ hiện ở đây — có thể chỉnh trước khi gửi…" : "Gõ câu trả lời của bạn…"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitting}
      />

      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={() => onDone(0)}>Bỏ qua</Button>
        <Button variant="primary" className="flex-1" disabled={!text.trim() || submitting} onClick={submit}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gửi"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the runner**

In `src/components/topics/TopicDeckRunner.tsx`:

Add the import near the other slide imports:

```tsx
import { VoiceQASlide } from "@/components/topics/VoiceQASlide";
```

Replace the text-only voice block (the `{slide.type === "voice_qa" && ( ... )}` JSX) with:

```tsx
          {slide.type === "voice_qa" && <VoiceQASlide slide={slide} dayNo={deck.day_no} onDone={next} />}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: compiles.

- [ ] **Step 4: Manual smoke-test (Chrome)**

With `npm run dev` + signed in, open `/topics/1` and reach a voice slide. Expected: the question is spoken aloud; tapping mic transcribes your speech into the box; "Gửi" returns a score + Vietnamese feedback + covered key-points; "Tiếp tục" advances and the score feeds the finish XP. On a non-Chrome browser the mic is hidden and typing the answer still grades.

- [ ] **Step 5: Commit**

```bash
git add src/components/topics/VoiceQASlide.tsx src/components/topics/TopicDeckRunner.tsx
git commit -m "feat: AI voice conversation slide (TTS + STT + grading)"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS — includes `topic-deck.test.ts`.

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: no errors; `/topics`, `/topics/[day]`, and the three API routes all appear.

- [ ] **Step 3: End-to-end pass**

With the full 30 days seeded (Task 3 Step 5), sign in and: complete Day 1 (vocab → attribute → voice), confirm XP awarded, Day 2 unlocks, and a locked day (e.g. Day 3) blocks direct access to `/topics/3` with the "chưa mở khóa" message.

- [ ] **Step 4: Confirm no mobile changes**

Run: `git diff --name-only <branch-base>..HEAD -- mobile`
Expected: empty output.

---

## Self-Review Notes (author)

- **Spec coverage:** 30-day curriculum + persona → Task 3 (`DAYS` + prompt). Pre-generated storage → Tasks 2–3. Slide types + normalizer → Task 1. Read/deck/grade/complete APIs → Tasks 4–5. Menu + roadmap + nav → Task 6. Deck player + vocab/attribute slides + TTS → Task 7. AI voice conversation → Task 8. Unlock rule → `isDayUnlocked` used in Tasks 1/4. XP/streak reuse → `finishTopicDay` (Task 5). Degradation (no STT/TTS) → Tasks 7–8. Tests → Task 1. All spec sections mapped.
- **Type consistency:** `TopicSlide`/`TopicDaySummary`/`TopicDeck` defined in Task 1 and consumed unchanged in Tasks 4/6/7/8; `buildVocabOptions`/`normalizeSlides`/`isDayUnlocked` signatures match across tasks; `finishTopicDay(dayNo, scores)` defined in Task 5, called in Task 7; grade route request/response (`{questionEn,keyPoints,answer}` → `{score,feedbackVi,covered}`) matches `VoiceQASlide` usage in Task 8.
- **Refinement vs spec:** the spec listed `POST /api/topics/[day]/complete`; the plan implements completion as the `finishTopicDay` server action instead (reuses the file's activity/streak helpers, revalidates sibling paths only to avoid replacing the finish screen). Same behavior, more DRY.
- **Out of scope confirmed:** no mobile, no image generation, no changes to existing learn/review/speaking/writing/SRS; Task 9 Step 4 guards mobile.
