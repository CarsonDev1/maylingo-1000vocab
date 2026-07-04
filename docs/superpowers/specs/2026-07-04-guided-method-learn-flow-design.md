# Guided Active-Recall Learn Flow — Design

Date: 2026-07-04
Scope: **web app only** (the Expo mobile app is out of scope for this round).

## Goal

Today the 5-step "deep learning" method exists on web but is **optional and hidden**:
B1/B4 (deep understanding + collocations) sit behind a 📖 button on the learn
flashcard, and B3 (personal example) lives inside that same sheet. Most learners
never open it, so the "new method" is not actually the way they learn.

This round makes the method the **default, guided learn-new flow**: when learning
a new word, the app walks the learner through *deep intake → active recall →
production*, in sequence. (Approach **A** — upgrade the default flow, chosen by the
user, not a separate opt-in mode.)

Bước E (Speaking, `/speaking`) stays a separate capstone and is unchanged.

## Per-word flow

Current `buildLearnSteps` produces, per new word:

```
flashcard → listen_write (if audio) → spell
```

New flow, per new word:

| # | Step | Type | Graded? | Skippable? | Content |
|---|------|------|---------|-----------|---------|
| 1 | **Hiểu sâu** (B1/B4) | `flashcard` (enhanced) | no | no (just Continue) | flip card **+ inline deep content**: EN–EN definition, native usage contexts, collocations, sắc thái |
| 2 | **Đọc to** (B2) | `pronounce` (new) | no | yes ("Bỏ qua") | `PronunciationTrainer` — read aloud to the 5-rep goal, mic-scored |
| 3 | **Nghe & gõ** | `listen_write` | yes | no | existing (only if the word has audio) |
| 4 | **Spell** | `spell` | yes | no | existing |
| 5 | **Tự đặt câu** (B3) | `write_example` (new) | no | yes ("Bỏ qua") | `PersonalExamples` — write a personal sentence, AI feedback |

Rationale (active recall): steps 1–2 are deep *intake*; steps 3–4 force the learner
to *retrieve* the word from memory; step 5 is *production* (using the word in a
self-authored, personal context — the strongest memory anchor).

Non-graded steps (1, 2, 5) advance with `onNext(null)` so they never affect accuracy.

## Components & changes

### 1. Types — `src/types/index.ts`
Extend `ExerciseType` with two new values: `"pronounce"` and `"write_example"`.
(`flashcard` is reused, enhanced.) Add a helper set/predicate for graded types
(see §5).

### 2. Step builder — `src/lib/exercises.ts`
`buildLearnSteps(words, pool)` emits, per word:
`flashcard`, `pronounce`, `listen_write` (only if `w.audio_url`), `spell`,
`write_example`. `buildReviewSteps` is **unchanged** (review never uses these
practice types). Unit-tested: sequence and per-word ordering.

### 3. Shared deep-content renderer — `src/components/word/WordDeepContent.tsx` (new)
Extract the `DetailBody` currently inline in `WordDetailSheet.tsx` into a reusable
`WordDeepContent` component (renders definition / usage contexts / collocations /
nuance, plus the "Đang cập nhật…" empty state). Both the enhanced flashcard step and
the existing `WordDetailSheet` render it — single source of truth, no divergence.
It accepts a `variant` (or className) so it can render on the **dark session
background** (wrapped in a light card) as well as inside the light sheet.

### 4. ExerciseView — `src/components/session/ExerciseView.tsx`
- **`flashcard` (enhanced):** below the flip card, lazy-fetch `GET /api/word/[id]/detail`
  (same pattern the sheet uses now) and render `WordDeepContent` inline, in a light
  card on the dark overlay. Show a loading skeleton while fetching. The old 📖 button
  that opened the sheet becomes redundant here and is removed from the learn card
  (the audio / slow-audio buttons stay). Keep "I already know this word" → `onNext(null)`.
- **`pronounce` (new branch):** render `PronunciationTrainer`; add a footer with
  **"Bỏ qua"** (skip) and a **"Tiếp tục"** that appears once the rep goal is met —
  both call `onNext(null)`. If speech is unsupported, the trainer already shows its
  graceful message; the "Bỏ qua/Tiếp tục" footer lets the learner move on.
- **`write_example` (new branch):** render `PersonalExamples`; footer with **"Bỏ qua"**
  and **"Xong"** → `onNext(null)`. (Writing a sentence is encouraged, never blocking.)

Both new branches render inside the existing `Card` chrome (title from `PROMPT`,
progress `index/total`). Add `PROMPT` entries: `pronounce: "Đọc to từ này"`,
`write_example: "Tự đặt câu với từ này"`.

### 5. Accuracy fix — `src/components/session/SessionRunner.tsx`
The finish screen computes `graded = steps.filter(s => s.type !== "flashcard").length`.
With new non-graded steps this denominator is wrong (it would count `pronounce` /
`write_example` as answered questions, deflating accuracy). Replace the filter with a
shared predicate — e.g. `isGradedStep(step)` / a `GRADED_TYPES` set in
`src/lib/exercises.ts` — that includes only the real exercise types (MC + typed:
`choose_*`, `fill_gap_*`, `listen_*`, `underlined_meaning`, `spell`) and excludes
`flashcard`, `pronounce`, `write_example`. Unit-tested.

XP is unchanged: learn XP = `wordIds.length * 10` (per word learned, independent of
step count). No new XP for pronounce/example this round (kept simple; can revisit).

## Data flow

No change to how the learn page loads data (`Word[]` + distractor pool). The new
steps **lazy-fetch their own data on mount**, reusing existing endpoints:
- `flashcard` deep content → `GET /api/word/[id]/detail` (already used by the sheet)
- `write_example` → `GET`/`POST /api/word/[id]/example` (already used by `PersonalExamples`)

If `word_details` is empty for a word (content not yet generated), the flashcard step
shows the existing "Đang cập nhật phần hiểu sâu cho từ này…" empty state and the flow
proceeds normally — the method degrades gracefully to intake-lite + recall + production.

## Graceful degradation & friction control

- **No mic (non-Chrome):** `pronounce` step shows the unsupported message; learner taps
  "Bỏ qua". Never blocks.
- **Groq down / slow:** `write_example` still saves the sentence; feedback falls back to
  the canned message (existing behavior in the example route). "Bỏ qua" always available.
- **Session length:** the flow grows from 3 to ~5 steps/word. Steps 2 and 5 are one-tap
  skippable to keep pace for learners who want speed.

## Out of scope

- Mobile (Expo) port.
- Multi-course / prepvocab (`COURSE_ID` hardcode) — separate feature.
- Changes to review flow, SRS, or the `/speaking` capstone.
- Bonus XP for pronunciation/example completion.

## Testing

- `exercises.test.ts` (new or extended): `buildLearnSteps` sequence includes
  `pronounce` + `write_example` per word, `listen_write` only when audio exists,
  `buildReviewSteps` unchanged.
- `isGradedStep` / `GRADED_TYPES`: unit test that the three non-graded types are
  excluded and all real exercise types included.
- Manual: run a learn session, verify the 5-step sequence, skip behavior, accuracy on
  the finish screen counts only graded steps, and the empty-`word_details` fallback.
