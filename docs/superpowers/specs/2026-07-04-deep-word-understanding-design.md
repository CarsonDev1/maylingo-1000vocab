# Deep Word Understanding (B1) — Design

Date: 2026-07-04
Feature: **B1 — Hiểu sâu** (deep understanding of each word)
Status: Approved, ready for implementation

## Background & roadmap

The app is being aligned with a 5-step "deep learning" method for the 1000 core
words. Spaced repetition ("Thời gian vàng", `src/lib/srs.ts`) and active recall
(learn flow forces `listen_write` + `spell`) already exist. The remaining pieces,
to be built one at a time (own spec → plan → build each):

1. **B1 — Hiểu sâu:** native-usage context + English–English nuance per word ← *this spec*
2. B2 — Active pronunciation practice (mic)
3. B3 — Personalized examples (AI feedback)
4. B4 — Collocations / idioms expansion
5. E — Speaking practice mode

This spec covers **B1 only**.

## Goal

For every word, give the learner "deep understanding" content so they own the
word's nuance rather than a single gloss:

- **English–English definition** — the root nuance of the word (as the video
  recommends using a monolingual dictionary).
- **Native usage contexts** — 2–3 situations where native speakers actually use
  the word, each with a short English example.
- **Nuance note (Vietnamese)** — register / connotation (formal vs informal, etc.).

Content is **bilingual**: the definition and examples stay in English (immersion,
"sắc thái gốc"); situation descriptions and the nuance note are in Vietnamese so
lower-level learners can follow.

## Decisions

- **Content source:** pre-generated once via AI and stored in Supabase (fast to
  view, no per-view API cost, works offline/mobile later, one-time cost). Not
  on-demand.
- **Data model:** a separate `word_details` table, 1:1 with `words` (isolates
  AI-generated enrichment from curated core content; safe to regenerate/backfill;
  a home for future deep-learning fields).
- **Fetch strategy:** lazy-fetch per word when the detail sheet opens
  (`getWordDetail(wordId)`), not joined into list queries — keeps list payloads
  small, touches few files.
- **Placement:** one shared `WordDetailSheet` bottom drawer, opened from two
  entry points — an ℹ️ "Hiểu sâu" button on the learn flashcard, and tapping a
  word row in the Notebook.

## Data model

New table (add to `supabase/schema.sql`):

```sql
create table if not exists public.word_details (
  word_id         integer primary key references public.words(id) on delete cascade,
  definition_en   text,           -- English–English definition (root nuance)
  nuance_vi       text,           -- short Vietnamese note on register/connotation
  usage_contexts  jsonb not null default '[]'::jsonb,
                                  -- array of { context_vi: string, example_en: string }, 2–3 items
  model           text,           -- model used to generate (audit)
  generated_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger word_details_updated_at before update on public.word_details
  for each row execute function public.set_updated_at();
```

`usage_contexts` shape (validated in code):

```ts
interface UsageContext { context_vi: string; example_en: string }
```

## Generation script

`scripts/generate-word-details.mjs` — mirrors existing script patterns
(`scripts/_supabase.mjs`: `getServiceClient`, `pool`, `loadEnv`).

- Reads `words` (`id, term, pos, meaning_vi, meaning_en, example_en`).
- **Idempotent:** skips words that already have a `word_details` row unless
  `--force` is passed. Supports `--limit N` for a test run.
- Calls Groq (`fetch` to `https://api.groq.com/openai/v1/chat/completions`,
  model from `GROQ_MODEL` default `llama-3.3-70b-versatile`, `response_format:
  { type: "json_object" }`) with a prompt that returns:

  ```json
  {
    "definition_en": "…",
    "nuance_vi": "…",
    "usage_contexts": [ { "context_vi": "…", "example_en": "…" }, … ]
  }
  ```

- **Validates** each response with a shared validator (`validateWordDetail`)
  before upsert: `definition_en`/`nuance_vi` are strings; `usage_contexts` is an
  array of 2–3 `{ context_vi, example_en }` with non-empty strings, extra items
  trimmed, malformed items dropped. On parse/validate failure: log the word id
  and skip it (resumable — rerun picks up the gaps).
- Concurrency via `pool` (e.g. 4), short `sleep` between batches for rate limits.
- Upserts into `word_details` by `word_id`.

The authoritative validator lives in `src/lib/word-detail.ts`
(`normalizeUsageContexts` / `validateWordDetail`) and is used by the **read path**
(`getWordDetail`), so whatever reaches the UI is always normalized there. The
`.mjs` script (node can't import the `.ts` module directly) does its own small
inline shape-check before upsert to avoid writing obvious garbage; the read-path
validator remains the single source of truth for what the UI renders.

## Types

Add to `src/types/index.ts`:

```ts
export interface UsageContext { context_vi: string; example_en: string }
export interface WordDetail {
  word_id: number;
  definition_en: string | null;
  nuance_vi: string | null;
  usage_contexts: UsageContext[];
}
```

## Server query

`getWordDetail(wordId: number): Promise<WordDetail | null>` in
`src/lib/queries.ts` — selects the row from `word_details`, normalizes
`usage_contexts` through the shared validator, returns `null` if absent.

## Component: `WordDetailSheet`

`src/components/word/WordDetailSheet.tsx` — a bottom drawer (portal), reusing the
visual pattern of `ExerciseView`'s `ResultDrawer`.

- Props: `wordId: number | null`, `word: Word` (for immediate header render),
  `open: boolean`, `onClose: () => void`.
- On open, lazy-fetches the detail (client fetch to a small route or a server
  action). Shows a skeleton while loading.
- Layout:
  - Header: `term` + phonetic + audio buttons (normal + slow, reuse `playAudio`),
    `meaning_vi (pos)`.
  - **"Hiểu sâu"** section:
    - English–English definition (`definition_en`).
    - Usage contexts: for each, the Vietnamese situation (`context_vi`) with the
      English example (`example_en`) underneath.
    - Nuance note (`nuance_vi`).
  - **Empty state** when no detail row exists yet: show header + a muted
    "Đang cập nhật phần hiểu sâu…" so the app works before/without seeding.

A tiny data route/action backs the fetch: `GET /api/word/[id]/detail` (or a
server action) returning `WordDetail | null`.

## Wiring

- **Flashcard** (`src/components/session/ExerciseView.tsx`, `flashcard` branch):
  add an ℹ️ "Hiểu sâu" button that opens the sheet for the current `word`.
- **Notebook** (`src/components/notebook/NotebookClient.tsx`): make each word row
  a button that opens the sheet for that word.

## Error handling & fallbacks

- Sheet renders fully from the passed `Word` even when the detail is missing or
  the fetch fails (empty state), so nothing breaks before seeding.
- Generation script is resumable and validates output; malformed AI responses are
  skipped and logged, never written.

## Testing (TDD)

- Unit-test the pure `validateWordDetail` / `normalizeUsageContexts` logic:
  - valid full object passes through;
  - trims to max 3 contexts;
  - drops malformed context items (missing/empty fields);
  - coerces missing `usage_contexts` to `[]`;
  - null/garbage input yields safe defaults.
- Unit-test `getWordDetail` mapping via a mocked Supabase response (row → typed
  `WordDetail`, absent row → `null`).
- UI verified manually (open sheet from flashcard and Notebook; loading, empty,
  and populated states).

## Scope

- **Web app first.** The Expo mobile app (`mobile/`) mirrors B1 in a later,
  separate round — out of scope for this spec.
- No changes to SRS, XP, or existing exercises.
