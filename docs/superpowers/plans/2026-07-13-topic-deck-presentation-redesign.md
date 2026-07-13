# Topic Deck — Full Presentation Redesign + Content Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the roadmap's topic lessons into a full-screen, dark, PowerPoint-style interactive slide deck (clickable dots, prev/next, ← → Enter keyboard nav, free navigation) with two new content slide types (warm-up, phrases) and richer voice/recap slides — all English-only, reusing PrepVocab words/images/sentences.

**Architecture:** `TopicDeckRunner` becomes a full-screen deck player (top bar + progress dots + 16:9 stage + nav bar + keyboard). Slides no longer own Continue buttons — global nav advances; the voice slide reports its grade via `onScore`. Shared dark presentation primitives (`slide-ui.tsx`) give every slide a consistent PPT look. New slide types are registered in the server-side validator `normalizeSlides` and produced by the Groq generation script.

**Tech Stack:** Next.js (App Router) + React client components, TypeScript, Tailwind, Framer Motion, Web Speech API (TTS + recognition), Groq (deck generation), Supabase, Vitest (node env — no jsdom/RTL).

## Global Constraints

- **Language: English only.** The only Vietnamese anywhere is a word's `meaning_vi`, shown on vocab cards. No Vietnamese on scenarios, phrases, dialogue, hints, headings.
- **Theme: dark** (`bg-neutral-900` shell, `neutral-800` surfaces, `white/10` lines, `green-500` accent, `violet-400` AI accent, `neutral-300/400` text).
- **Images: reuse PrepVocab `image_url` only.** No bespoke illustrations. Two-column art panels use a PrepVocab image or a gradient+emoji fallback.
- **Navigation is free:** ←/→/Enter and clickable dots always move; in-slide interactions never block. Keyboard nav is **ignored while an `input`/`textarea`/contenteditable is focused**.
- **Persona for generated content:** a software engineer at a multinational workplace; frame scenarios around real work/interview/daily-professional situations. Output English only.
- No DB schema migration (`topic_days.slides` is JSONB).
- Follow existing file conventions under `src/components/topics/` and `src/lib/`.

---

### Task 1: New slide types + server-side normalization (+ unit tests)

**Files:**
- Modify: `src/types/index.ts` (add types near the other topic slide interfaces, ~line 186)
- Modify: `src/lib/topic-deck.ts` (add normalizers + switch cases)
- Test: `src/lib/topic-deck.test.ts` (new)

**Interfaces:**
- Produces: `WarmUpTopicSlide`, `PhraseGroup`, `PhrasesTopicSlide` types; `normalizeSlides` accepts `warm_up` and `phrases` raw objects and returns the typed slides (dropping malformed ones).

- [ ] **Step 1: Write failing tests**

Create `src/lib/topic-deck.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeSlides } from "@/lib/topic-deck";

describe("normalizeSlides — warm_up", () => {
  it("keeps a valid warm_up slide", () => {
    const out = normalizeSlides([
      { type: "warm_up", scenario_en: "You just joined a new team.", agenda: ["Vocabulary", "Key phrases", "A conversation"] },
    ]);
    expect(out).toEqual([
      { type: "warm_up", scenario_en: "You just joined a new team.", agenda: ["Vocabulary", "Key phrases", "A conversation"] },
    ]);
  });

  it("drops non-string agenda items and caps at 5", () => {
    const out = normalizeSlides([
      { type: "warm_up", scenario_en: "S", agenda: ["a", 2, "", "b", "c", "d", "e", "f"] },
    ]);
    expect(out[0]).toMatchObject({ type: "warm_up", agenda: ["a", "b", "c", "d", "e"] });
  });

  it("drops a warm_up with neither scenario nor agenda", () => {
    expect(normalizeSlides([{ type: "warm_up", scenario_en: "  ", agenda: [] }])).toEqual([]);
  });
});

describe("normalizeSlides — phrases", () => {
  it("keeps valid groups and drops empty/garbage ones", () => {
    const out = normalizeSlides([
      { type: "phrases", groups: [
        { heading_en: "Asking for help", phrases: ["I'm looking for…", "Could you help me?"] },
        { heading_en: "", phrases: ["ignored"] },
        { heading_en: "No phrases", phrases: [] },
      ] },
    ]);
    expect(out).toEqual([
      { type: "phrases", groups: [{ heading_en: "Asking for help", phrases: ["I'm looking for…", "Could you help me?"] }] },
    ]);
  });

  it("drops a phrases slide with zero valid groups", () => {
    expect(normalizeSlides([{ type: "phrases", groups: [{ heading_en: "", phrases: [] }] }])).toEqual([]);
  });
});

describe("normalizeSlides — ordering & mixed", () => {
  it("preserves order and drops unknown types", () => {
    const out = normalizeSlides([
      { type: "cover", hero_word_id: 1, goal_en: "g" },
      { type: "warm_up", scenario_en: "s", agenda: ["a"] },
      { type: "bogus" },
      { type: "recap" },
    ]);
    expect(out.map((s) => s.type)).toEqual(["cover", "warm_up", "recap"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/topic-deck.test.ts`
Expected: FAIL (warm_up/phrases slides are dropped → arrays don't match).

- [ ] **Step 3: Add the types**

In `src/types/index.ts`, immediately after the `VoiceQaTopicSlide` interface (before `RecapTopicSlide`), add:

```ts
export interface WarmUpTopicSlide {
  type: "warm_up";
  scenario_en: string;
  agenda: string[];
}
export interface PhraseGroup {
  heading_en: string;
  phrases: string[];
}
export interface PhrasesTopicSlide {
  type: "phrases";
  groups: PhraseGroup[];
}
```

Then extend the union:

```ts
export type TopicSlide =
  | CoverTopicSlide
  | WarmUpTopicSlide
  | VocabTopicSlide
  | ExampleTopicSlide
  | AttributeTopicSlide
  | PhrasesTopicSlide
  | DialogueTopicSlide
  | VoiceQaTopicSlide
  | RecapTopicSlide;
```

- [ ] **Step 4: Add normalizers + switch cases**

In `src/lib/topic-deck.ts`, update the import and add a `normalizePhraseGroups` helper after `normalizeLines`:

```ts
import type { AttributeOption, DialogueLine, PhraseGroup, TopicSlide } from "@/types";
```

```ts
function normalizePhraseGroups(input: unknown): PhraseGroup[] {
  if (!Array.isArray(input)) return [];
  const out: PhraseGroup[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const heading_en = cleanString(o.heading_en);
    const phrases = normalizeStrings(o.phrases, 4);
    if (heading_en && phrases.length) out.push({ heading_en, phrases });
    if (out.length === 3) break;
  }
  return out;
}
```

Add two `case` blocks inside `normalizeSlide`'s `switch`, right after the `cover` case:

```ts
    case "warm_up": {
      const scenario_en = cleanString(o.scenario_en);
      const agenda = normalizeStrings(o.agenda, 5);
      if (!scenario_en && agenda.length === 0) return null;
      return { type: "warm_up", scenario_en: scenario_en ?? "", agenda };
    }
    case "phrases": {
      const groups = normalizePhraseGroups(o.groups);
      return groups.length ? { type: "phrases", groups } : null;
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/topic-deck.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/lib/topic-deck.ts src/lib/topic-deck.test.ts
git commit -m "feat(topics): add warm_up + phrases slide types and normalization"
```

---

### Task 2: Reward data plumbing — `finishTopicDay` return, API `nextDay`, client pass-through

**Files:**
- Modify: `src/lib/actions.ts:209-254` (`finishTopicDay`)
- Modify: `src/app/api/topics/[day]/route.ts` (add `nextDay` to response)
- Modify: `src/components/topics/TopicDeckClient.tsx` (thread `nextDay` into the runner)

**Interfaces:**
- Produces: `finishTopicDay(dayNo, scores): Promise<{ xpEarned: number; currentStreak: number; bestScore: number }>`; API response gains `nextDay: { day_no: number; title_en: string | null } | null`; `TopicDeckRunner` (Task 5) receives `nextDay` of that shape.
- Consumes: existing `user_streaks.current_streak`, `user_topic_progress.best_score`.

- [ ] **Step 1: Extend `finishTopicDay`**

In `src/lib/actions.ts`, change the signature return type and the tail of the function.

Signature:
```ts
export async function finishTopicDay(dayNo: number, scores: number[]): Promise<{ xpEarned: number; currentStreak: number; bestScore: number }> {
```
Early-return (invalid day) becomes:
```ts
  if (!Number.isInteger(dayNo) || dayNo < 1 || dayNo > 30) return { xpEarned: 0, currentStreak: 0, bestScore: 0 };
```
Replace the tail (from `await bumpActivity` to the final `return`) with:
```ts
  await bumpActivity(userId, { xp: xpEarned });
  await touchStreak(userId);

  const { data: streakRow } = await db
    .from("user_streaks")
    .select("current_streak")
    .eq("user_id", userId)
    .maybeSingle();
  const currentStreak = (streakRow as { current_streak: number } | null)?.current_streak ?? 0;

  revalidatePath("/topics");
  revalidatePath("/topics/review");
  revalidatePath("/dashboard");
  return { xpEarned, currentStreak, bestScore: bestScore ?? 0 };
```

- [ ] **Step 2: Add `nextDay` to the day API**

In `src/app/api/topics/[day]/route.ts`, after the `words` block and before the final `return NextResponse.json`, add:

```ts
  const { data: nextRow } = await db
    .from("topic_days")
    .select("day_no,title_en")
    .eq("day_no", dayNo + 1)
    .maybeSingle();
  const nextDay = nextRow
    ? { day_no: (nextRow as { day_no: number }).day_no, title_en: (nextRow as { title_en: string | null }).title_en }
    : null;
```

Add `nextDay,` to the returned object (sibling of `deck` and `words`):

```ts
  return NextResponse.json({
    deck: { /* unchanged */ },
    words,
    nextDay,
  });
```

- [ ] **Step 3: Thread `nextDay` through the client**

In `src/components/topics/TopicDeckClient.tsx`:

Update the `State` "ready" variant:
```ts
type NextDay = { day_no: number; title_en: string | null } | null;
type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; deck: TopicDeck; words: Word[]; nextDay: NextDay };
```
Update the success branch of the fetch `.then`:
```ts
        else setState({ status: "ready", deck: d.deck as TopicDeck, words: (d.words as Word[]) ?? [], nextDay: (d.nextDay as NextDay) ?? null });
```
Update the final render:
```ts
  return <TopicDeckRunner deck={state.deck} words={state.words} nextDay={state.nextDay} />;
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (The current `TopicDeckRunner` does not yet accept `nextDay` — it will after Task 5; to keep this step green, the runner's props are updated in Task 5. If `tsc` complains here about the extra `nextDay` prop, proceed — it is resolved in Task 5. Prefer to run Task 2 and Task 5 back-to-back.)

> NOTE: To keep the tree green at Task 2's commit, add `nextDay` to the current runner's props signature now as an unused optional: in `TopicDeckRunner.tsx` change the signature to `({ deck, words, nextDay: _nextDay }: { deck: TopicDeck; words: Word[]; nextDay?: unknown })`. Task 5 rewrites the runner fully.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions.ts "src/app/api/topics/[day]/route.ts" src/components/topics/TopicDeckClient.tsx src/components/topics/TopicDeckRunner.tsx
git commit -m "feat(topics): return streak/bestScore from finishTopicDay + expose nextDay in day API"
```

---

### Task 3: Shared dark presentation primitives

**Files:**
- Create: `src/components/topics/slide-ui.tsx`

**Interfaces:**
- Produces: `SlideEyebrow`, `SlideHeading`, `SlideLead`, `SlideTwoCol`, `ArtPanel` — used by every slide in Tasks 4–7.

- [ ] **Step 1: Create the primitives**

Create `src/components/topics/slide-ui.tsx`:

```tsx
"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SlideEyebrow({ children, accent = "green" }: { children: ReactNode; accent?: "green" | "violet" }) {
  return (
    <span className={cn("flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em]",
      accent === "violet" ? "text-violet-300" : "text-green-400")}>
      <span className={cn("h-0.5 w-5 rounded", accent === "violet" ? "bg-violet-400" : "bg-green-500")} />
      {children}
    </span>
  );
}

export function SlideHeading({ children, size = "h2" }: { children: ReactNode; size?: "h1" | "h2" }) {
  const cls = "mt-2 font-extrabold tracking-tight text-white text-balance";
  return size === "h1"
    ? <h1 className={cn(cls, "text-3xl sm:text-4xl")}>{children}</h1>
    : <h2 className={cn(cls, "text-2xl sm:text-3xl")}>{children}</h2>;
}

export function SlideLead({ children }: { children: ReactNode }) {
  return <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-neutral-300 sm:text-base">{children}</p>;
}

/** Content column + art column; stacks (art hidden) on small screens. */
export function SlideTwoCol({ children, art }: { children: ReactNode; art: ReactNode }) {
  return (
    <div className="mt-5 grid flex-1 items-center gap-6 md:grid-cols-[1fr_0.82fr]">
      <div className="min-w-0">{children}</div>
      <div className="hidden min-h-0 md:block">{art}</div>
    </div>
  );
}

/** Renders a PrepVocab image, or a gradient + emoji fallback. */
export function ArtPanel({ imageUrl, emoji = "🗂️", alt = "" }: { imageUrl?: string | null; emoji?: string; alt?: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-800 to-neutral-800/40 p-5">
      {imageUrl ? (
        <Image src={imageUrl} alt={alt} width={280} height={280} unoptimized className="max-h-[280px] w-auto rounded-xl object-contain" />
      ) : (
        <div className="grid h-28 w-28 place-items-center rounded-2xl bg-white/5 text-6xl">{emoji}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/topics/slide-ui.tsx
git commit -m "feat(topics): shared dark presentation slide primitives"
```

---

### Task 4: New content slides — WarmUpSlide + PhrasesSlide

**Files:**
- Create: `src/components/topics/WarmUpSlide.tsx`
- Create: `src/components/topics/PhrasesSlide.tsx`

**Interfaces:**
- Consumes: `slide-ui.tsx` primitives; `speakText` from `@/lib/tts`.
- Produces: `WarmUpSlide({ slide }: { slide: WarmUpTopicSlide })`, `PhrasesSlide({ slide }: { slide: PhrasesTopicSlide })`. No `onDone` — global nav advances.

- [ ] **Step 1: Create `WarmUpSlide.tsx`**

```tsx
"use client";

import { motion } from "framer-motion";
import { SlideEyebrow, SlideHeading, SlideLead } from "@/components/topics/slide-ui";
import type { WarmUpTopicSlide } from "@/types";

export function WarmUpSlide({ slide }: { slide: WarmUpTopicSlide }) {
  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>Warm-up · What you&apos;ll do</SlideEyebrow>
      <SlideHeading>Today&apos;s scenario</SlideHeading>
      {slide.scenario_en && <SlideLead>{slide.scenario_en}</SlideLead>}
      <ol className="mt-6 flex flex-col gap-2.5">
        {slide.agenda.map((step, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-800/70 px-4 py-3"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-green-500/15 text-sm font-extrabold text-green-400">{i + 1}</span>
            <span className="font-semibold text-neutral-100">{step}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Create `PhrasesSlide.tsx`**

```tsx
"use client";

import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { SlideEyebrow, SlideHeading } from "@/components/topics/slide-ui";
import { speakText } from "@/lib/tts";
import type { PhrasesTopicSlide } from "@/types";

export function PhrasesSlide({ slide }: { slide: PhrasesTopicSlide }) {
  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>Key phrases</SlideEyebrow>
      <SlideHeading>Say it like this</SlideHeading>
      <div className="mt-5 grid flex-1 content-start gap-4 sm:grid-cols-2">
        {slide.groups.map((g, gi) => (
          <motion.div
            key={gi}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.08 }}
            className="rounded-2xl border border-white/10 bg-neutral-800/70 p-4"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-green-400">{g.heading_en}</p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {g.phrases.map((p, pi) => (
                <li key={pi}>
                  <button
                    onClick={() => speakText(p)}
                    className="flex w-full items-start gap-2 text-left text-neutral-100 transition hover:text-white"
                    aria-label={`Listen: ${p}`}
                  >
                    <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                    <span className="font-semibold">{p}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-400">Tap a phrase to hear it.</p>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (both are standalone, not yet imported).

- [ ] **Step 4: Commit**

```bash
git add src/components/topics/WarmUpSlide.tsx src/components/topics/PhrasesSlide.tsx
git commit -m "feat(topics): WarmUpSlide + PhrasesSlide (dark PPT style)"
```

---

### Task 5: Migrate all slides to the free-nav model + rewrite the runner

This is the presentation-layer migration. Every existing slide drops its `onDone`/Continue button and adopts the dark primitives; the voice slide gains `onScore`; the runner becomes the full-screen deck player. The tree typechecks green at the **end** of this task (intermediate commits within the task may be red — commit the runner last).

**Files:**
- Modify: `src/components/topics/CoverSlide.tsx`
- Modify: `src/components/topics/VocabSlide.tsx`
- Modify: `src/components/topics/ExampleSlide.tsx`
- Modify: `src/components/topics/AttributeSlide.tsx`
- Modify: `src/components/topics/DialogueSlide.tsx`
- Modify: `src/components/topics/VoiceQASlide.tsx`
- Modify: `src/components/topics/RecapSlide.tsx`
- Modify (rewrite): `src/components/topics/TopicDeckRunner.tsx`

**Interfaces (final signatures — all other tasks depend on these):**
- `CoverSlide({ slide, words, title }: { slide: CoverTopicSlide; words: Word[]; title: string })`
- `VocabSlide({ slide, words }: { slide: VocabTopicSlide; words: Word[] })`
- `ExampleSlide({ slide, words }: { slide: ExampleTopicSlide; words: Word[] })`
- `AttributeSlide({ slide, words }: { slide: AttributeTopicSlide; words: Word[] })`
- `DialogueSlide({ slide }: { slide: DialogueTopicSlide })`
- `VoiceQASlide({ slide, dayNo, onScore }: { slide: VoiceQaTopicSlide; dayNo: number; onScore: (score: number) => void })`
- `RecapSlide({ title, slideTypes, scores, rewards, nextDay }: { title: string; slideTypes: string[]; scores: number[]; rewards: { xpEarned: number; currentStreak: number; bestScore: number } | null; nextDay: { day_no: number; title_en: string | null } | null })`
- `TopicDeckRunner({ deck, words, nextDay }: { deck: TopicDeck; words: Word[]; nextDay: { day_no: number; title_en: string | null } | null })`

- [ ] **Step 1: Rewrite `CoverSlide.tsx`**

```tsx
"use client";

import { motion } from "framer-motion";
import { SlideEyebrow, SlideHeading, ArtPanel } from "@/components/topics/slide-ui";
import type { CoverTopicSlide, Word } from "@/types";

export function CoverSlide({ slide, words, title }: { slide: CoverTopicSlide; words: Word[]; title: string }) {
  const hero = slide.hero_word_id != null ? words.find((w) => w.id === slide.hero_word_id) : undefined;
  return (
    <div className="grid flex-1 items-center gap-6 md:grid-cols-[1.15fr_0.85fr]">
      <div>
        <SlideEyebrow>Topic · Workplace communication</SlideEyebrow>
        <SlideHeading size="h1">{title}</SlideHeading>
        {slide.goal_en && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-neutral-800/70 px-4 py-2.5 text-sm font-semibold text-neutral-100"
          >
            🎯 {slide.goal_en}
          </motion.p>
        )}
      </div>
      <div className="hidden md:block">
        <ArtPanel imageUrl={hero?.image_url} emoji="🎯" alt={title} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `VocabSlide.tsx`** (keep tap-to-reveal + audio; dark; no button)

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { SlideEyebrow, SlideHeading } from "@/components/topics/slide-ui";
import { speakText } from "@/lib/tts";
import { cn } from "@/lib/utils";
import type { VocabTopicSlide, Word } from "@/types";

export function VocabSlide({ slide, words }: { slide: VocabTopicSlide; words: Word[] }) {
  const cards = slide.word_ids.map((id) => words.find((w) => w.id === id)).filter(Boolean) as Word[];
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>Vocabulary</SlideEyebrow>
      <SlideHeading>Words for this topic</SlideHeading>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                "relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition",
                isOpen ? "border-green-500 bg-green-500/10" : "border-white/10 bg-neutral-800/70 hover:border-green-400/50",
              )}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [w.id]: true })); speakText(w.term); }}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-neutral-900/70 text-green-400"
                aria-label={`Listen to ${w.term}`}
              >
                <Volume2 className="h-3.5 w-3.5" />
              </span>
              {w.image_url ? (
                <Image src={w.image_url} alt="" width={120} height={90} unoptimized className="h-20 w-full rounded-xl object-contain" />
              ) : (
                <div className="grid h-20 w-full place-items-center rounded-xl bg-white/5 text-3xl">🗂️</div>
              )}
              <span className="font-bold text-white">{w.term}</span>
              {isOpen && <span className="text-xs text-neutral-300">{w.meaning_vi}</span>}
            </motion.button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-neutral-400">Tap a card to reveal its meaning · 🔊 to hear it.</p>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `ExampleSlide.tsx`** (two-column with art; dark; no button)

```tsx
"use client";

import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { SlideEyebrow, SlideHeading, SlideTwoCol, ArtPanel } from "@/components/topics/slide-ui";
import { speakText } from "@/lib/tts";
import type { ExampleTopicSlide, Word } from "@/types";

export function ExampleSlide({ slide, words }: { slide: ExampleTopicSlide; words: Word[] }) {
  const w = words.find((x) => x.id === slide.word_id);
  if (!w) return <div className="flex flex-1 items-center justify-center text-neutral-400">No example.</div>;
  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>In context</SlideEyebrow>
      <SlideHeading>{w.term}</SlideHeading>
      <SlideTwoCol art={<ArtPanel imageUrl={w.image_url} emoji="💬" alt={w.term} />}>
        <button onClick={() => speakText(w.term)} className="inline-flex items-center gap-2 text-lg font-extrabold text-white" aria-label={`Listen to ${w.term}`}>
          {w.term} <Volume2 className="h-4 w-4 text-green-400" />
        </button>
        {w.meaning_vi && <p className="mt-1 text-sm text-neutral-400">{w.meaning_vi}</p>}
        {w.example_en && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => speakText(w.example_en!)}
            className="mt-4 block w-full rounded-2xl border border-white/10 bg-neutral-800/70 p-4 text-left"
            aria-label="Play example sentence"
          >
            <p className="italic text-neutral-100">“{w.example_en}”</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-400"><Volume2 className="h-3.5 w-3.5" /> Listen</span>
          </motion.button>
        )}
      </SlideTwoCol>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `AttributeSlide.tsx`** (dark chips; keep explain reveal; no button)

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { SlideEyebrow, SlideHeading, ArtPanel, SlideTwoCol } from "@/components/topics/slide-ui";
import { cn } from "@/lib/utils";
import type { AttributeTopicSlide, Word } from "@/types";

export function AttributeSlide({ slide, words }: { slide: AttributeTopicSlide; words: Word[] }) {
  const w = slide.word_id != null ? words.find((x) => x.id === slide.word_id) : undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const revealed = picked !== null;

  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>Describe &amp; choose</SlideEyebrow>
      <SlideHeading>{slide.prompt_en}</SlideHeading>
      <SlideTwoCol art={<ArtPanel imageUrl={w?.image_url} emoji="❓" alt={w?.term ?? ""} />}>
        <div className="grid gap-2.5">
          {slide.options.map((opt, i) => (
            <button
              key={i}
              disabled={revealed}
              onClick={() => setPicked(i)}
              className={cn(
                "flex items-center justify-between rounded-xl border px-4 py-3 text-left font-semibold transition",
                !revealed && "border-white/10 bg-neutral-800/70 text-neutral-100 hover:border-green-400/50",
                revealed && opt.correct && "border-green-500 bg-green-500/15 text-green-300",
                revealed && !opt.correct && picked === i && "border-rose-500 bg-rose-500/15 text-rose-300",
                revealed && !opt.correct && picked !== i && "border-white/10 text-neutral-500",
              )}
            >
              <span>{opt.label}</span>
              {revealed && opt.correct && <Check className="h-5 w-5 text-green-400" />}
              {revealed && !opt.correct && picked === i && <X className="h-5 w-5 text-rose-400" />}
            </button>
          ))}
        </div>
        {revealed && slide.explain_en && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">
            {slide.explain_en}
          </motion.p>
        )}
      </SlideTwoCol>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite `DialogueSlide.tsx`** (auto-reveal all lines with stagger; "You"/"Colleague"; per-line audio; no button)

```tsx
"use client";

import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { SlideEyebrow, SlideHeading } from "@/components/topics/slide-ui";
import { speakText } from "@/lib/tts";
import { cn } from "@/lib/utils";
import type { DialogueTopicSlide } from "@/types";

export function DialogueSlide({ slide }: { slide: DialogueTopicSlide }) {
  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>A real conversation</SlideEyebrow>
      <SlideHeading>{slide.title_en || "At work"}</SlideHeading>
      <div className="mt-5 flex flex-col gap-2.5">
        {slide.lines.map((l, i) => {
          const you = l.who === "b";
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.25 }}
              className={cn(
                "max-w-[85%] rounded-2xl border px-4 py-2.5",
                you ? "self-end rounded-br-sm border-green-500/40 bg-green-500/15" : "self-start rounded-bl-sm border-white/10 bg-neutral-800/70",
              )}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-neutral-400">{you ? "You" : "Colleague"}</p>
              <p className="mt-0.5 font-semibold text-white">{l.en}</p>
              <button onClick={() => speakText(l.en)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-400" aria-label="Listen">
                <Volume2 className="h-3.5 w-3.5" /> listen
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `VoiceQASlide.tsx`** (score ring + headline; `onScore`; keep mic/submit; remove Skip/Continue)

```tsx
"use client";

import { useEffect, useState } from "react";
import { Volume2, Mic, Square, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideEyebrow, SlideHeading } from "@/components/topics/slide-ui";
import { speakText, isTtsSupported } from "@/lib/tts";
import { useSpeechRecognition } from "@/lib/speech-recognition";
import { cn } from "@/lib/utils";
import type { VoiceQaTopicSlide } from "@/types";

interface Grade { score: number; feedback: string; covered: string[] }

function band(score: number): string {
  if (score >= 80) return "Great! 👏";
  if (score >= 60) return "Nice work 👍";
  return "Keep going 💪";
}

export function VoiceQASlide({ slide, dayNo, onScore }: { slide: VoiceQaTopicSlide; dayNo: number; onScore: (score: number) => void }) {
  const { supported, listening, transcript, start, stop, reset } = useSpeechRecognition({ continuous: true });
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);

  useEffect(() => {
    speakText(slide.question_en);
    return () => { if (isTtsSupported()) window.speechSynthesis.cancel(); };
  }, [slide.question_en]);

  useEffect(() => { if (transcript) setText(transcript); }, [transcript]);

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
      const g: Grade = res.ok
        ? { score: data.score, feedback: data.feedback, covered: data.covered ?? [] }
        : { score: 60, feedback: "Your answer has been recorded.", covered: [] };
      setGrade(g);
      onScore(g.score);
    } catch {
      const g = { score: 60, feedback: "Couldn't grade this right now, but your answer has been recorded.", covered: [] };
      setGrade(g);
      onScore(g.score);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow accent="violet">Speak with AI</SlideEyebrow>
      <SlideHeading>Answer out loud</SlideHeading>

      <div className="mt-4 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-400 text-xl">🤖</div>
        <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-neutral-800/70 p-3">
          <p className="font-semibold text-white">{slide.question_en}</p>
          {isTtsSupported() && (
            <button onClick={() => speakText(slide.question_en)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-300" aria-label="Replay">
              <Volume2 className="h-3.5 w-3.5" /> Hear it again
            </button>
          )}
        </div>
      </div>

      {!grade ? (
        <div className="mt-4 flex flex-col gap-3">
          {supported && (
            <div className="flex justify-center">
              <button
                onClick={() => (listening ? stop() : (reset(), setText(""), start()))}
                className={cn("grid h-16 w-16 place-items-center rounded-full text-white shadow-lg transition hover:scale-105", listening ? "animate-pulse bg-rose-500" : "bg-green-500")}
                aria-label={listening ? "Stop" : "Speak"}
              >
                {listening ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
              </button>
            </div>
          )}
          <textarea
            className="min-h-[96px] w-full resize-none rounded-2xl border border-white/10 bg-neutral-800/70 p-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-green-400 focus:outline-none"
            placeholder={supported ? "Your answer will appear here — you can edit it before submitting…" : "Type your answer…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitting}
          />
          <Button variant="primary" className="w-full" disabled={!text.trim() || submitting} onClick={submit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit answer"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
              style={{ background: `conic-gradient(var(--tw-ring-color, #22c55e) ${Math.round(grade.score * 3.6)}deg, rgba(255,255,255,0.12) 0)`, ["--tw-ring-color" as string]: "#22c55e" }}
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-900 text-lg font-extrabold text-green-400 tabular-nums">{grade.score}</span>
            </div>
            <p className="text-lg font-extrabold text-white">{band(grade.score)}</p>
          </div>
          {slide.key_points.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {slide.key_points.map((k) => {
                const hit = grade.covered.some((c) => c.toLowerCase() === k.toLowerCase());
                return (
                  <span key={k} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", hit ? "border-green-500/40 bg-green-500/15 text-green-300" : "border-white/10 bg-neutral-800 text-neutral-500")}>
                    {hit && <span className="mr-1">✓</span>}{k}
                  </span>
                );
              })}
            </div>
          )}
          <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-violet-300"><Sparkles className="h-3.5 w-3.5" /> Feedback</p>
            <p className="text-sm leading-relaxed text-violet-50">{grade.feedback}</p>
          </div>
          {slide.sample_answer_en && (
            <details className="rounded-2xl border border-white/10 bg-neutral-800/70 p-3 text-sm">
              <summary className="cursor-pointer font-semibold text-neutral-200">Sample answer</summary>
              <p className="mt-2 italic text-neutral-300">{slide.sample_answer_en}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Rewrite `RecapSlide.tsx`** (checklist from present slides + XP/score/streak + unlock)

```tsx
"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { SlideEyebrow, SlideHeading } from "@/components/topics/slide-ui";

const CHECKS: { type: string; label: string }[] = [
  { type: "vocab", label: "Topic vocabulary" },
  { type: "phrases", label: "Key phrases for real situations" },
  { type: "example", label: "Real-life example sentences" },
  { type: "dialogue", label: "A real conversation" },
  { type: "voice_qa", label: "AI speaking practice" },
];

export function RecapSlide({
  title, slideTypes, scores, rewards, nextDay,
}: {
  title: string;
  slideTypes: string[];
  scores: number[];
  rewards: { xpEarned: number; currentStreak: number; bestScore: number } | null;
  nextDay: { day_no: number; title_en: string | null } | null;
}) {
  const items = CHECKS.filter((c) => slideTypes.includes(c.type));
  const speakingScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : rewards?.bestScore ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <SlideEyebrow>Recap</SlideEyebrow>
      <SlideHeading>You learned: {title} 🎉</SlideHeading>
      <div className="mt-5 grid flex-1 items-start gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <motion.div
              key={it.type}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-2.5 font-medium text-neutral-100"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-green-500 text-white"><Check className="h-4 w-4" /></span>
              {it.label}
            </motion.div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Tile k="XP" v={rewards ? `+${rewards.xpEarned}` : <Loader2 className="mx-auto h-5 w-5 animate-spin" />} />
            <Tile k="Speaking" v={speakingScore != null ? `${speakingScore}%` : "—"} />
            <Tile k="Streak" v={rewards ? `🔥${rewards.currentStreak}` : "—"} />
          </div>
          {nextDay && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-neutral-800/50 px-4 py-3 text-sm font-semibold text-neutral-200">
              🔓 Unlock Day {nextDay.day_no}{nextDay.title_en ? `: ${nextDay.title_en}` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-800/70 p-3 text-center">
      <div className="text-xl font-extrabold text-green-400 tabular-nums">{v}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-400">{k}</div>
    </div>
  );
}
```

- [ ] **Step 8: Rewrite `TopicDeckRunner.tsx`** (full-screen shell, dots, nav, keyboard, free-nav, finish-on-recap)

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Button } from "@/components/ui/button";
import { playAudio } from "@/lib/audio";
import { finishTopicDay } from "@/lib/actions";
import { isTtsSupported } from "@/lib/tts";
import { cn } from "@/lib/utils";
import { CoverSlide } from "@/components/topics/CoverSlide";
import { WarmUpSlide } from "@/components/topics/WarmUpSlide";
import { VocabSlide } from "@/components/topics/VocabSlide";
import { ExampleSlide } from "@/components/topics/ExampleSlide";
import { AttributeSlide } from "@/components/topics/AttributeSlide";
import { PhrasesSlide } from "@/components/topics/PhrasesSlide";
import { DialogueSlide } from "@/components/topics/DialogueSlide";
import { VoiceQASlide } from "@/components/topics/VoiceQASlide";
import { RecapSlide } from "@/components/topics/RecapSlide";
import type { TopicDeck, Word } from "@/types";

type NextDay = { day_no: number; title_en: string | null } | null;
type Rewards = { xpEarned: number; currentStreak: number; bestScore: number };

export function TopicDeckRunner({ deck, words, nextDay }: { deck: TopicDeck; words: Word[]; nextDay: NextDay }) {
  const total = deck.slides.length;
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const finishedRef = useRef(false);

  const go = useCallback((n: number) => {
    if (isTtsSupported()) window.speechSynthesis.cancel();
    setIndex(() => Math.max(0, Math.min(total - 1, n)));
  }, [total]);

  const onScore = useCallback((s: number) => setScores((prev) => [...prev, s]), []);

  // Finish once when the last slide (recap) is reached.
  useEffect(() => {
    if (total === 0 || index < total - 1 || finishedRef.current) return;
    finishedRef.current = true;
    playAudio("/finish.mp3");
    finishTopicDay(deck.day_no, scores)
      .then(setRewards)
      .catch(() => setRewards({ xpEarned: 0, currentStreak: 0, bestScore: 0 }));
  }, [index, total, deck.day_no, scores]);

  // Keyboard nav — ignored while typing in a form field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); go(index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  if (total === 0) {
    return (
      <Shell>
        <div className="grid flex-1 place-items-center">
          <div className="rounded-2xl border border-white/10 bg-neutral-800 p-8 text-center">
            <p className="text-white">No content for this day yet.</p>
            <Button asChild variant="secondary" className="mt-5"><Link href="/topics">Back to path</Link></Button>
          </div>
        </div>
      </Shell>
    );
  }

  const slide = deck.slides[index];
  const title = deck.title_en ?? "";
  const slideTypes = deck.slides.map((s) => s.type);
  const isLast = index >= total - 1;

  return (
    <Shell>
      <header className="mx-auto flex w-full max-w-[1080px] items-center gap-3 px-4 pt-5 lg:px-8">
        <Link href="/topics" aria-label="Exit" className="shrink-0 text-neutral-400 transition hover:text-white"><X className="h-6 w-6" /></Link>
        <span className="truncate rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-400">Day {deck.day_no} · {title}</span>
      </header>

      <div className="mx-auto mt-3 flex w-full max-w-[1080px] items-center gap-3 px-4 lg:px-8">
        <div className="flex flex-1 gap-1.5">
          {deck.slides.map((_, idx) => (
            <button
              key={idx}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => go(idx)}
              className={cn("h-1.5 flex-1 rounded-full transition", idx === index ? "bg-green-500" : idx < index ? "bg-green-500/40" : "bg-white/15")}
            />
          ))}
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums text-neutral-400">{index + 1} / {total}</span>
      </div>

      <div className="mx-auto flex w-full max-w-[1080px] flex-1 px-4 py-4 lg:px-8">
        <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-neutral-800 shadow-2xl lg:aspect-[16/9]">
          <MotionConfig reducedMotion="user">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.28 }}
                className="flex h-full flex-col overflow-y-auto p-6 sm:p-8 lg:p-10"
              >
                {slide.type === "cover" && <CoverSlide slide={slide} words={words} title={title} />}
                {slide.type === "warm_up" && <WarmUpSlide slide={slide} />}
                {slide.type === "vocab" && <VocabSlide slide={slide} words={words} />}
                {slide.type === "example" && <ExampleSlide slide={slide} words={words} />}
                {slide.type === "attribute" && <AttributeSlide slide={slide} words={words} />}
                {slide.type === "phrases" && <PhrasesSlide slide={slide} />}
                {slide.type === "dialogue" && <DialogueSlide slide={slide} />}
                {slide.type === "voice_qa" && <VoiceQASlide slide={slide} dayNo={deck.day_no} onScore={onScore} />}
                {slide.type === "recap" && <RecapSlide title={title} slideTypes={slideTypes} scores={scores} rewards={rewards} nextDay={nextDay} />}
              </motion.div>
            </AnimatePresence>
          </MotionConfig>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1080px] items-center gap-3 px-4 pb-5 lg:px-8">
        <Button variant="secondary" onClick={() => go(index - 1)} disabled={index === 0}>← Prev</Button>
        <span className="flex-1" />
        {isLast ? (
          <Button asChild variant="primary"><Link href="/topics">Back to path</Link></Button>
        ) : (
          <Button variant="primary" onClick={() => go(index + 1)}>Next →</Button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-neutral-900 text-white">{children}</div>;
}
```

- [ ] **Step 9: Typecheck (whole tree must be green now)**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Run all unit tests**

Run: `npx vitest run`
Expected: PASS (including Task 1 tests).

- [ ] **Step 11: Commit**

```bash
git add src/components/topics/
git commit -m "feat(topics): full-screen PPT deck runner + free-nav slides (dark)"
```

---

### Task 6: Generate the enriched content + regenerate all decks + verify end-to-end

**Files:**
- Modify: `scripts/generate-topic-decks.mjs`

**Interfaces:**
- Consumes: the `warm_up`/`phrases` shapes accepted by `normalizeSlides` (Task 1).
- Produces: `topic_days.slides` rows that include a `warm_up` slide (after cover) and a `phrases` slide (after attribute).

- [ ] **Step 1: Add generation normalizers**

In `scripts/generate-topic-decks.mjs`, after `normStrings`, add:

```js
function normAgenda(v) { return normStrings(v, 5); }
function normPhraseGroups(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const it of v) {
    if (!it || typeof it !== "object") continue;
    const heading_en = cleanStr(it.heading_en);
    const phrases = normStrings(it.phrases, 4);
    if (heading_en && phrases.length) out.push({ heading_en, phrases });
    if (out.length === 3) break;
  }
  return out;
}
```

- [ ] **Step 2: Extend the generation prompt**

In `buildDeck`, add these two properties to the JSON spec in the `user` prompt (inside the returned object, e.g. after `voice_qa`):

```
  "warm_up": { "scenario_en": "<1-2 sentence real workplace/daily situation that frames this topic>", "agenda": ["<lesson step>","<lesson step>","<lesson step>","<lesson step>"] },
  "phrases": [ { "heading_en": "<a situation>", "phrases": ["<english sentence>","<english sentence>"] }, { "heading_en": "<another situation>", "phrases": ["<english sentence>","<english sentence>"] } ]
```

Append to the `Rules:` line:

```
warm_up.agenda 3-4 short items. phrases EXACTLY 2 groups, each 2-3 English phrases grounded in this topic.
```

Increase the first `groq(...)` call's `maxTokens` from `1800` to `2400`.

- [ ] **Step 3: Build the new slides and insert them into the order**

In `buildDeck`, after the `voice` array is built and before the `if (!attribute.length && !voice.length)` guard, add:

```js
  let warmUp = null;
  const wu = parsed.warm_up;
  if (wu && typeof wu === "object") {
    const scenario_en = cleanStr(wu.scenario_en);
    const agenda = normAgenda(wu.agenda);
    if (scenario_en || agenda.length) warmUp = { type: "warm_up", scenario_en: scenario_en ?? "", agenda };
  }
  const phraseGroups = normPhraseGroups(parsed.phrases);
  const phrasesSlide = phraseGroups.length ? { type: "phrases", groups: phraseGroups } : null;
```

Replace the final `return [...]` with:

```js
  return [
    { type: "cover", hero_word_id: heroId, goal_en: cleanStr(goal.goal_en) },
    ...(warmUp ? [warmUp] : []),
    ...vocabSlides,
    ...exampleSlides,
    ...attribute,
    ...(phrasesSlide ? [phrasesSlide] : []),
    ...(dialogue ? [dialogue] : []),
    ...voice,
    { type: "recap" },
  ];
```

- [ ] **Step 4: Dry-run one day and inspect the output**

Run: `node scripts/generate-topic-decks.mjs --day 4 --force`
Expected stderr: `✓ day 4 (Fashion) — N slides` with N larger than before (≈12–13). If it errors on env, ensure `.env.local` has `GROQ_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`.

- [ ] **Step 5: End-to-end verify (use the `verify` skill)**

Start dev (`npm run dev`), sign in, open `/topics/4`. Confirm:
- Full-screen dark PPT stage; clickable dots + "i / n" counter; ◀ Prev / Next ▶ nav.
- `←` / `→` move slides; `Enter` advances; typing in the voice answer box + pressing Enter does **not** change slides.
- Order: cover → warm-up → vocab → example → attribute → phrases → dialogue → voice → recap.
- Warm-up shows scenario + agenda; phrases tap plays audio; dialogue auto-reveals with "You"/"Colleague"; voice shows the score ring; recap shows XP + speaking % + 🔥 streak + "Unlock Day 5".

- [ ] **Step 6: Regenerate all 20 decks**

Run: `node scripts/generate-topic-decks.mjs --force`
Expected: `Done. generated: 20, failed: 0.` (Re-run for any failed day with `--day N --force`.)

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-topic-decks.mjs
git commit -m "feat(topics): generate warm_up + phrases content; enrich all 20 decks"
```

---

## Self-Review

**Spec coverage:**
- Full-screen dark PPT shell → Task 5 (runner). ✓
- Clickable dots + counter + prev/next + keyboard (guarded) → Task 5. ✓
- Free-nav model (no per-slide Continue; voice `onScore`; finish-on-recap) → Task 5. ✓
- `warm_up` + `phrases` types + server normalization → Task 1. ✓
- Shared dark primitives + PrepVocab-image art panels → Tasks 3, 4, 5. ✓
- Voice score ring + hit/miss chips → Task 5 (Step 6). ✓
- Recap checklist + XP/score/streak + unlock next → Tasks 2 (data) + 5 (Step 7). ✓
- English-only, `meaning_vi` kept on vocab → Tasks 4/5 (only `w.meaning_vi` rendered). ✓
- Generation of new content + regenerate 20 → Task 6. ✓
- Legacy decks still play (unknown types ignored; missing warm_up/phrases just absent) → runner renders only known types; normalizeSlides drops unknowns. ✓

**Placeholder scan:** No TBD/TODO; all steps carry concrete code or exact commands.

**Type consistency:** Component signatures in Task 5's Interfaces block match their usage in the runner (`CoverSlide{slide,words,title}`, `VoiceQASlide{slide,dayNo,onScore}`, `RecapSlide{title,slideTypes,scores,rewards,nextDay}`); `finishTopicDay` return `{xpEarned,currentStreak,bestScore}` matches `Rewards` and `RecapSlide.rewards`; `nextDay` shape identical across API (Task 2), client (Task 2), runner + RecapSlide (Task 5).

**Testing-infra note (divergence from spec):** the repo has vitest (node env) but **no jsdom/RTL**, so component tests are not added; component behavior (keyboard nav, phrases audio, recap rewards, score ring) is covered by the Task 6 end-to-end verify instead. Pure-logic normalization is unit-tested in Task 1.
