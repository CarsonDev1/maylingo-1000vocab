# Guided Active-Recall Learn Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 5-step deep-learning method the default, guided learn-new flow on the web app (flashcard+deep content → pronounce → recall → write example), instead of an optional hidden sheet.

**Architecture:** Extend the existing exercise-step pipeline. `buildLearnSteps` emits two new practice step types (`pronounce`, `write_example`) around the existing recall steps; `ExerciseView` renders them by reusing the already-built `PronunciationTrainer` and `PersonalExamples` components, and shows B1/B4 deep content inline on the flashcard via an extracted shared `WordDeepContent` component. `SessionRunner`'s accuracy calc is corrected to count only graded steps.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind, vitest (node env). Web Speech API (existing) for pronunciation; Groq (existing) for AI feedback.

## Global Constraints

- **Web app only.** Do not touch `mobile/`.
- **Reuse, don't duplicate:** `PronunciationTrainer`, `PersonalExamples`, and the deep-content renderer must be single-source. Extract shared UI rather than copy it.
- **Non-graded steps advance with `onNext(null)`** so they never affect accuracy.
- **Graceful degradation:** no mic → skippable; empty `word_details` → existing "Đang cập nhật…" state; the flow never blocks.
- **Do not change:** review flow, SRS, `/speaking`, XP formula (`wordIds.length * 10` for learn).
- Test command: `npm test` (all) or `npx vitest run src/lib/exercises.test.ts` (one file). Tests live in `src/**/*.test.ts` only (node env — no component tests).
- Vietnamese UI copy, matching the existing app voice.

---

## File Structure

- `src/types/index.ts` — **modify:** add `pronounce`, `write_example` to `ExerciseType`.
- `src/lib/exercises.ts` — **modify:** new `buildLearnSteps` sequence; add `GRADED_TYPES` + `isGradedStep`.
- `src/lib/exercises.test.ts` — **create:** unit tests for the sequence + `isGradedStep`.
- `src/components/word/WordDeepContent.tsx` — **create:** shared B1/B4 renderer extracted from `WordDetailSheet`.
- `src/components/word/WordDetailSheet.tsx` — **modify:** consume `WordDeepContent`, drop local copies.
- `src/components/word/PronunciationTrainer.tsx` — **modify:** add optional `onComplete` callback (fires at rep goal).
- `src/components/session/ExerciseView.tsx` — **modify:** inline deep content on flashcard; add `pronounce` + `write_example` branches; `PROMPT` entries.
- `src/components/session/SessionRunner.tsx` — **modify:** accuracy uses `isGradedStep`.

---

## Task 1: Step types, sequence, and graded-step predicate

**Files:**
- Modify: `src/types/index.ts` (the `ExerciseType` union, ~line 111-122)
- Modify: `src/lib/exercises.ts` (`buildLearnSteps` ~line 91-100; add helpers)
- Test: `src/lib/exercises.test.ts` (create)

**Interfaces:**
- Consumes: existing `Word`, `ExerciseStep`, `ExerciseType` from `@/types`.
- Produces:
  - `ExerciseType` now includes `"pronounce"` and `"write_example"`.
  - `buildLearnSteps(words: Word[], pool: Word[]): ExerciseStep[]` — per word emits `flashcard`, `pronounce`, `listen_write` (only if `word.audio_url`), `spell`, `write_example`.
  - `isGradedStep(step: ExerciseStep): boolean` — true only for real exercises (MC + typed), false for `flashcard`/`pronounce`/`write_example`.

- [ ] **Step 1: Add the two new step types to the union**

In `src/types/index.ts`, replace the `ExerciseType` union (lines ~111-122) with:

```ts
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
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/exercises.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildLearnSteps, buildReviewSteps, isGradedStep } from "@/lib/exercises";
import type { Word, ExerciseType } from "@/types";

function w(id: number, over: Partial<Word> = {}): Word {
  return {
    id,
    lesson_id: 1,
    term: `term${id}`,
    pos: null,
    phonetic_uk: null,
    phonetic_us: null,
    meaning_vi: `nghĩa${id}`,
    meaning_en: null,
    meaning_ja: null,
    meaning_ko: null,
    meaning_th: null,
    meaning_zh: null,
    example_en: null,
    example_vi: null,
    audio_url: null,
    audio_sentence_url: null,
    image_url: null,
    ...over,
  };
}

describe("buildLearnSteps", () => {
  test("a word WITH audio yields flashcard, pronounce, listen_write, spell, write_example in order", () => {
    const steps = buildLearnSteps([w(1, { audio_url: "a.mp3" })], []);
    expect(steps.map((s) => s.type)).toEqual([
      "flashcard",
      "pronounce",
      "listen_write",
      "spell",
      "write_example",
    ]);
    expect(steps.every((s) => s.word.id === 1)).toBe(true);
  });

  test("a word WITHOUT audio skips listen_write", () => {
    const steps = buildLearnSteps([w(2)], []);
    expect(steps.map((s) => s.type)).toEqual([
      "flashcard",
      "pronounce",
      "spell",
      "write_example",
    ]);
  });

  test("multiple words are grouped per word", () => {
    const steps = buildLearnSteps([w(1, { audio_url: "a.mp3" }), w(2)], []);
    expect(steps.map((s) => s.type)).toEqual([
      "flashcard", "pronounce", "listen_write", "spell", "write_example",
      "flashcard", "pronounce", "spell", "write_example",
    ]);
  });
});

describe("isGradedStep", () => {
  const graded: ExerciseType[] = [
    "choose_meaning", "choose_word", "choose_reading", "choose_image",
    "fill_gap_choose", "fill_gap_type", "listen_choose", "listen_write",
    "underlined_meaning", "spell",
  ];
  const nonGraded: ExerciseType[] = ["flashcard", "pronounce", "write_example"];

  test("real exercises are graded", () => {
    for (const type of graded) expect(isGradedStep({ type, word: w(1) })).toBe(true);
  });

  test("intro/practice steps are not graded", () => {
    for (const type of nonGraded) expect(isGradedStep({ type, word: w(1) })).toBe(false);
  });
});

describe("buildReviewSteps is unchanged (never emits practice steps)", () => {
  test("review steps are all graded types", () => {
    const words = [w(1, { meaning_vi: "x" }), w(2, { meaning_vi: "y" })];
    const steps = buildReviewSteps(words, [], new Map());
    expect(steps.every((s) => isGradedStep(s))).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/exercises.test.ts`
Expected: FAIL — `isGradedStep` is not exported yet, and `buildLearnSteps` does not yet emit `pronounce`/`write_example`.

- [ ] **Step 4: Implement the sequence and predicate**

In `src/lib/exercises.ts`, replace `buildLearnSteps` (lines ~83-100) with:

```ts
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
```

Note: `makeStep("pronounce" | "write_example", …)` calls `buildOptions`, which returns `undefined` for these (default case) — correct, they have no options.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/exercises.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: PASS — the 24 pre-existing tests plus the new file.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/lib/exercises.ts src/lib/exercises.test.ts
git commit -m "feat: guided learn-new step sequence + graded-step predicate"
```

---

## Task 2: Extract shared `WordDeepContent`

**Files:**
- Create: `src/components/word/WordDeepContent.tsx`
- Modify: `src/components/word/WordDetailSheet.tsx` (remove local `hasContent`/`DetailBody`/`DetailSkeleton`, import the shared ones)

**Interfaces:**
- Produces:
  - `WordDeepContent({ detail: WordDetail | null; exampleEn: string | null }): JSX.Element` — renders definition / usage contexts / collocations / nuance, or the "Đang cập nhật…" empty state.
  - `WordDeepContentSkeleton(): JSX.Element` — loading placeholder.
- Consumes: `WordDetail` from `@/types`, `Skeleton` from `@/components/ui/skeleton`.

- [ ] **Step 1: Create the shared component**

Create `src/components/word/WordDeepContent.tsx` (moved verbatim from the sheet's current `DetailBody`/`DetailSkeleton`/`hasContent`, now exported):

```tsx
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { WordDetail } from "@/types";

function hasContent(detail: WordDetail | null): boolean {
  return (
    !!detail &&
    (!!detail.definition_en ||
      !!detail.nuance_vi ||
      detail.usage_contexts.length > 0 ||
      detail.collocations.length > 0)
  );
}

/**
 * Shared "Hiểu sâu" (B1/B4) content renderer — the single source of truth for
 * how deep-understanding content looks. Used by both the learn flashcard step
 * (on a dark session background, wrapped in a light card by the caller) and the
 * Notebook's WordDetailSheet (on a light background).
 */
export function WordDeepContent({
  detail,
  exampleEn,
}: {
  detail: WordDetail | null;
  exampleEn: string | null;
}) {
  if (!hasContent(detail)) {
    return (
      <div className="rounded-xl border-2 border-dashed p-5 text-center text-sm text-muted-foreground">
        Đang cập nhật phần hiểu sâu cho từ này…
      </div>
    );
  }
  const d = detail!;
  return (
    <div className="space-y-5">
      {d.definition_en && (
        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Definition</h4>
          <p className="text-neutral-800">{d.definition_en}</p>
        </section>
      )}

      {d.usage_contexts.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Ngữ cảnh người bản xứ hay dùng
          </h4>
          <ul className="space-y-3">
            {d.usage_contexts.map((c, i) => (
              <li key={i} className="rounded-xl border-2 bg-slate-50 p-3">
                <p className="text-sm font-medium text-neutral-700">{c.context_vi}</p>
                <p className="mt-1 italic text-neutral-800">“{c.example_en}”</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.collocations.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Cụm từ / idiom hay đi kèm
          </h4>
          <ul className="space-y-2">
            {d.collocations.map((c, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 rounded-xl border-2 bg-slate-50 px-3 py-2">
                <span className="font-semibold text-neutral-800">{c.phrase_en}</span>
                <span className="text-sm text-muted-foreground">— {c.meaning_vi}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.nuance_vi && (
        <section className="rounded-xl bg-amber-500/10 p-3">
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">Sắc thái</h4>
          <p className="text-neutral-800">{d.nuance_vi}</p>
        </section>
      )}

      {exampleEn && d.usage_contexts.length === 0 && (
        <p className="text-sm text-neutral-600">{exampleEn}</p>
      )}
    </div>
  );
}

export function WordDeepContentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}
```

- [ ] **Step 2: Point `WordDetailSheet` at the shared component**

In `src/components/word/WordDetailSheet.tsx`:

1. Add the import (near the other `@/components/word` imports, ~line 12-13):

```tsx
import { WordDeepContent, WordDeepContentSkeleton } from "@/components/word/WordDeepContent";
```

2. Remove the now-unused `Skeleton` import (line 11) — it is only used by the extracted skeleton now.

3. In the render, replace the loading/body branch (lines ~103-107):

```tsx
                {state.status === "loading" ? (
                  <WordDeepContentSkeleton />
                ) : (
                  <WordDeepContent detail={state.detail} exampleEn={word.example_en} />
                )}
```

4. Delete the local `hasContent`, `DetailBody`, and `DetailSkeleton` function definitions (lines ~122-205) — they now live in `WordDeepContent.tsx`.

- [ ] **Step 3: Verify types, lint, and build**

Run: `npm run lint`
Expected: no errors in `WordDeepContent.tsx` / `WordDetailSheet.tsx` (no unused `Skeleton` import, no undefined references).

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open a lesson's Notebook, tap a word to open the sheet. Confirm the deep-understanding section renders exactly as before (definition, usage, collocations, nuance, or the "Đang cập nhật…" empty state).

- [ ] **Step 5: Commit**

```bash
git add src/components/word/WordDeepContent.tsx src/components/word/WordDetailSheet.tsx
git commit -m "refactor: extract shared WordDeepContent from WordDetailSheet"
```

---

## Task 3: `PronunciationTrainer` completion callback

**Files:**
- Modify: `src/components/word/PronunciationTrainer.tsx`

**Interfaces:**
- Produces: `PronunciationTrainer({ term: string; audioUrl: string | null; onComplete?: () => void })` — `onComplete` fires once when the rep counter first reaches the goal.

- [ ] **Step 1: Add the optional `onComplete` prop and fire it at the rep goal**

In `src/components/word/PronunciationTrainer.tsx`:

1. Change the signature (line ~17):

```tsx
export function PronunciationTrainer({
  term,
  audioUrl,
  onComplete,
}: {
  term: string;
  audioUrl: string | null;
  onComplete?: () => void;
}) {
```

2. Add an effect that fires `onComplete` when `reps` reaches `REP_GOAL`. Place it right after the existing mount effect (after line ~27), using a ref so a changing callback identity does not re-fire:

```tsx
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (reps >= REP_GOAL && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.();
    }
  }, [reps]);
```

(`useRef` and `useEffect` are already imported on line 3.)

- [ ] **Step 2: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: compiles; no unused-var or exhaustive-deps errors (the effect depends only on `reps` by design — the refs are intentionally omitted).

Note: if the `react-hooks/exhaustive-deps` lint rule flags the effect, add `// eslint-disable-next-line react-hooks/exhaustive-deps` above the closing `}, [reps]);` line, matching the pattern already used elsewhere in this file's siblings.

- [ ] **Step 3: Commit**

```bash
git add src/components/word/PronunciationTrainer.tsx
git commit -m "feat: PronunciationTrainer onComplete callback at rep goal"
```

---

## Task 4: Render the guided steps in `ExerciseView`

**Files:**
- Modify: `src/components/session/ExerciseView.tsx`

**Interfaces:**
- Consumes: `WordDeepContent`, `WordDeepContentSkeleton` (Task 2); `PronunciationTrainer` w/ `onComplete` (Task 3); `PersonalExamples`; `isGradedStep` unused here. `WordDetail` type from `@/types`.
- Produces: `ExerciseView` now renders `flashcard` with inline deep content, and handles `pronounce` and `write_example` step types.

- [ ] **Step 1: Update imports and PROMPT map**

In `src/components/session/ExerciseView.tsx`:

1. Replace the `lucide-react` import (line 11) to drop `BookOpen` (no longer used) — keep the rest:

```tsx
import { Volume2, Check, X, Snail } from "lucide-react";
```

2. Replace the `WordDetailSheet` import (line 12) with the new dependencies:

```tsx
import { WordDeepContent, WordDeepContentSkeleton } from "@/components/word/WordDeepContent";
import { PronunciationTrainer } from "@/components/word/PronunciationTrainer";
import { PersonalExamples } from "@/components/word/PersonalExamples";
import type { WordDetail } from "@/types";
```

3. Add two entries to the `PROMPT` map (after line 25, `flashcard: "New word"`):

```tsx
  pronounce: "Đọc to từ này",
  write_example: "Tự đặt câu với từ này",
```

- [ ] **Step 2: Replace the flashcard block — inline deep content, drop the sheet**

In `ExerciseView`, remove the `const [detailOpen, setDetailOpen] = useState(false);` line (~79).

Add deep-content fetch state near the other `useState`s (~line 74-80):

```tsx
  const [detail, setDetail] = useState<WordDetail | null | "loading">("loading");
```

Add a fetch effect (immediately after the existing reset effect that ends ~line 92). It fetches only for flashcard steps and reuses the endpoint the sheet used:

```tsx
  useEffect(() => {
    if (type !== "flashcard") return;
    let cancelled = false;
    setDetail("loading");
    fetch(`/api/word/${word.id}/detail`)
      .then((r) => (r.ok ? r.json() : { detail: null }))
      .then((d) => {
        if (!cancelled) setDetail((d?.detail as WordDetail | null) ?? null);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [type, word.id]);
```

In the `if (type === "flashcard")` return block:

- Remove the `BookOpen` button (lines ~139-145).
- Remove the trailing `<WordDetailSheet ... />` line (~218).
- Insert the deep-content card between the flip-card `</div>` (the one closing the `[perspective:1200px]` wrapper, ~line 204) and the `<Button ... >Continue</Button>` (~line 206):

```tsx
        <div className="w-full rounded-2xl bg-white p-4 text-left text-neutral-800">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-green-600">
            <BookOpen className="h-4 w-4" /> Hiểu sâu
          </div>
          {detail === "loading" ? (
            <WordDeepContentSkeleton />
          ) : (
            <WordDeepContent detail={detail} exampleEn={word.example_en} />
          )}
        </div>
```

Because this reintroduces `BookOpen`, keep it in the `lucide-react` import after all:

```tsx
import { Volume2, Check, X, Snail, BookOpen } from "lucide-react";
```

(Step 1's import line becomes this; `BookOpen` is now used by the "Hiểu sâu" heading, not a button.)

- [ ] **Step 3: Add the `pronounce` and `write_example` branches**

Immediately after the `if (type === "flashcard") { … }` block closes (~line 221), add:

```tsx
  if (type === "pronounce") {
    return (
      <Card index={index} total={total} title={PROMPT[type]}>
        <PronounceStep word={word} onDone={() => onNext(null)} />
      </Card>
    );
  }

  if (type === "write_example") {
    return (
      <Card index={index} total={total} title={PROMPT[type]}>
        <div className="space-y-6">
          <PersonalExamples wordId={word.id} term={word.term} />
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => onNext(null)}>
              Bỏ qua
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => onNext(null)}>
              Xong
            </Button>
          </div>
        </div>
      </Card>
    );
  }
```

- [ ] **Step 4: Add the `PronounceStep` local component**

At the bottom of the file (next to `SpellInput`, `ResultDrawer`, `Card`), add:

```tsx
/** B2 practice step: read the word aloud to the rep goal, then continue. */
function PronounceStep({ word, onDone }: { word: Word; onDone: () => void }) {
  const [reachedGoal, setReachedGoal] = useState(false);
  return (
    <div className="space-y-6">
      <p className="text-center text-2xl font-bold text-neutral-700">{word.term}</p>
      <PronunciationTrainer term={word.term} audioUrl={word.audio_url} onComplete={() => setReachedGoal(true)} />
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onDone}>
          Bỏ qua
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={!reachedGoal}
          onClick={onDone}
        >
          Tiếp tục
        </Button>
      </div>
      {!reachedGoal && (
        <p className="text-center text-xs text-muted-foreground">
          Đọc đủ 5 lần để mở nút Tiếp tục, hoặc bấm Bỏ qua.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify types, lint, and build**

Run: `npm run lint`
Expected: no unused imports (confirm `WordDetailSheet` import is gone), no undefined references.

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 6: Manual smoke test**

Run `npm run dev`, start a **learn-new** session on a lesson with unlearned words. Verify per word:
1. Flashcard shows the flip card **and** a white "Hiểu sâu" card below (deep content or "Đang cập nhật…").
2. "Đọc to" step: mic + rep dots; "Tiếp tục" is disabled until 5 matched reps, "Bỏ qua" always works. On a non-Chrome browser, the unsupported message shows and "Bỏ qua" advances.
3. "Nghe & gõ" and "Spell" grade as before.
4. "Tự đặt câu" step: can write a sentence + get feedback, or "Bỏ qua".

- [ ] **Step 7: Commit**

```bash
git add src/components/session/ExerciseView.tsx
git commit -m "feat: render guided pronounce + write_example steps and inline deep content"
```

---

## Task 5: Fix session accuracy to count only graded steps

**Files:**
- Modify: `src/components/session/SessionRunner.tsx`

**Interfaces:**
- Consumes: `isGradedStep` from `@/lib/exercises` (Task 1).

- [ ] **Step 1: Import the predicate**

In `src/components/session/SessionRunner.tsx`, add to the imports (near line 10-16):

```tsx
import { isGradedStep } from "@/lib/exercises";
```

- [ ] **Step 2: Use it in the finish-screen accuracy calc**

Replace the `graded` line (~line 93):

```tsx
    const graded = mode === "review" ? reviewed : steps.filter(isGradedStep).length;
```

(Rationale: with `flashcard`, `pronounce`, and `write_example` all non-graded, the old `s.type !== "flashcard"` denominator would over-count and deflate accuracy. `isGradedStep` counts only the recall/MC/typed steps that actually produce a correct/incorrect result.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 4: Manual check**

Run a short learn session, answer the graded steps, and confirm the finish screen's **Accuracy** reflects only the `listen_write`/`spell` answers (e.g. 1 word with audio = 2 graded steps → 100% when both correct), not diluted by the 3 practice steps.

- [ ] **Step 5: Commit**

```bash
git add src/components/session/SessionRunner.tsx
git commit -m "fix: session accuracy counts only graded steps"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS — all pre-existing tests plus `exercises.test.ts`.

- [ ] **Step 2: Lint + build clean**

Run: `npm run lint && npm run build`
Expected: no errors, production build succeeds.

- [ ] **Step 3: End-to-end manual pass**

Run `npm run dev`. Complete one full learn-new session end to end:
- 5-step sequence per word (4 when a word has no audio).
- Skip behavior on pronounce + write_example.
- Empty-`word_details` fallback shows "Đang cập nhật…" and the flow proceeds.
- Finish screen shows correct XP (`words × 10`) and graded-only accuracy.
- Notebook's word sheet still renders deep content (Task 2 didn't regress it).

- [ ] **Step 4: Confirm no mobile files changed**

Run: `git diff --name-only main -- mobile`
Expected: empty output.

---

## Self-Review Notes (author)

- **Spec coverage:** Step 1 (Hiểu sâu inline) → Task 4 Step 2. Step 2 (Đọc to/B2) → Tasks 3 + 4. Steps 3–4 (recall) → existing, sequenced in Task 1. Step 5 (Tự đặt câu/B3) → Task 4 Step 3. Shared renderer → Task 2. Accuracy fix → Task 5. Graceful degradation → Task 4 Steps 3–4/6. All spec sections mapped.
- **Type consistency:** `WordDetail | null | "loading"` used consistently in `ExerciseView`; `WordDeepContent`/`WordDeepContentSkeleton` names match between Task 2 and Task 4; `isGradedStep` signature matches between Tasks 1 and 5; `PronunciationTrainer` `onComplete` matches between Tasks 3 and 4.
- **Out of scope confirmed:** mobile, multi-course, `/speaking`, XP formula untouched (Task 6 Step 4 guards mobile).
