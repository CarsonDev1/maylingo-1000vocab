# 30-Day Topic Slides + AI Voice Tutor — Design

Date: 2026-07-08
Scope: **web app only** (mobile out of scope).

## Goal

A new parallel learning mode: a **fixed 30-day program** where each day is one
themed topic taught through an interactive, PPT-style slide deck (image appears,
then choose the answer), ending with an **AI voice conversation** where an AI voice
asks situational questions, the learner answers by speaking, and the answer is graded.

The learner is a **software engineer aiming to communicate/interview at multinational
companies**, so all AI-generated situational and conversation content is framed for
that persona (standups, code review, interviews, deadlines, salary negotiation,
cross-cultural small talk), even when the base vocabulary comes from a general lesson.

**All 30 days of content are generated ONCE by a seed script and stored in the DB** —
never generated per-visit. Runtime is pure read + render + grade.

This does not change the existing learn / review / speaking / writing flows.

## The 30-day curriculum

Each day maps to one existing `lessons` row (course_id = 1). Vocabulary + images come
from that lesson's `words`; attribute + conversation content is AI-generated with the
persona framing above. Ordered interview → work → situations → global → fluency:

| Day | lesson_id | Topic | Day | lesson_id | Topic |
|----|----|----|----|----|----|
| 1 | 39 | Career P1 | 16 | 51 | Events |
| 2 | 40 | Career P2 | 17 | 99 | Media |
| 3 | 41 | Company Positions | 18 | 21 | Restaurants |
| 4 | 42 | Working Skills | 19 | 20 | Stores |
| 5 | 10 | Characteristics | 20 | 94 | Direction |
| 6 | 13 | Feelings | 21 | 92 | Traveling P1 |
| 7 | 43 | Office | 22 | 93 | Traveling P2 |
| 8 | 38 | Industries | 23 | 24 | Hotels |
| 9 | 97 | Technology | 24 | 91 | Accommodation |
| 10 | 15 | Daily Activities | 25 | 86 | Countries |
| 11 | 4 | Talking About Time | 26 | 87 | Languages |
| 12 | 14 | Relationships | 27 | 3 | Culture |
| 13 | 45 | Salaries | 28 | 100 | Social Issues |
| 14 | 88 | Finance | 29 | 96 | Sports |
| 15 | 22 | Banks | 30 | 83 | Weather |

This mapping is the seed's source of truth; it is configurable (a constant array in
the seed script). If a listed lesson has too few words, the seed still generates the
attribute/voice content — vocab slides just use whatever words exist.

## Data model

Two new tables (idempotent migration + SQL provided in the plan).

```sql
create table if not exists public.topic_days (
  day_no       integer primary key,          -- 1..30
  lesson_id    integer not null references public.lessons(id),
  title_en     text,
  title_vi     text,
  slides       jsonb   not null default '[]'::jsonb,
  model        text,
  generated_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.user_topic_progress (
  user_id      text    not null,
  day_no       integer not null,
  completed_at timestamptz not null default now(),
  best_score   integer,                       -- avg voice score 0..100, nullable
  primary key (user_id, day_no)
);
```

Unlock rule (computed in app code, not stored): day 1 is always unlocked; day N (N>1)
is unlocked iff a `user_topic_progress` row exists for day N-1. Completed days stay
replayable.

### `slides` JSON shape

`slides` is an ordered array of typed objects. Three slide types:

```jsonc
// 1. Vocabulary (image-first, choose the word). Options built at runtime from the
//    lesson's words, so only the word_id is stored.
{ "type": "vocab", "word_id": 1234 }

// 2. Attribute (AI-generated MC + explanation). Optional word_id for an image/emoji.
{ "type": "attribute",
  "word_id": 1234,                     // optional; image anchor
  "prompt_en": "A shirt is usually made of ___.",
  "prompt_vi": "Áo sơ mi thường làm từ ___.",
  "options": [ {"label":"cotton","correct":true},
               {"label":"steel","correct":false},
               {"label":"paper","correct":false},
               {"label":"glass","correct":false} ],
  "explain_vi": "Áo sơ mi phổ biến nhất làm từ cotton vì thoáng, dễ giặt." }

// 3. Voice Q&A (AI voice asks; learner speaks; Groq grades).
{ "type": "voice_qa",
  "question_en": "Tell me about a time you fixed a difficult bug.",
  "question_vi": "Hãy kể về một lần bạn sửa một lỗi khó.",
  "key_points": ["what the bug was", "how you found the cause", "how you fixed it"],
  "sample_answer_en": "Last month our API returned 500s intermittently..." }
```

Standard deck per day (configurable in the seed): ~6 `vocab` → 3 `attribute` →
3 `voice_qa` (~12 slides). Persona framing applies to the `attribute` and `voice_qa`
generation prompts.

## Read/normalize layer

`src/lib/topic-deck.ts` — the single source of truth for what the UI renders. Pure,
unit-tested:
- TypeScript types: `TopicSlide` (discriminated union on `type`), `TopicDeck`,
  `TopicDaySummary`.
- `normalizeSlides(raw: unknown): TopicSlide[]` — defensively parse stored JSON,
  dropping malformed slides (mirrors `word-detail.ts`).
- `buildVocabOptions(word: Word, pool: Word[]): {label:string; correct:boolean}[]` —
  4-option MC (correct term + 3 distractor terms from the lesson/pool), shuffled.
- `isDayUnlocked(dayNo, completedDays: Set<number>): boolean`.

## API routes (all `requireUserId`-guarded)

- `GET /api/topics` → `{ days: TopicDaySummary[] }` — the 30 days with
  `{ day_no, title_en, title_vi, unlocked, completed, best_score }`. Joins
  `topic_days` with the user's `user_topic_progress`.
- `GET /api/topics/[day]` → `{ deck: {...}, words: Word[] }` — normalized slides for
  that day plus the hydrated `words` referenced by vocab/attribute slides (for
  images/audio/options). Returns 403 if the day is locked for this user.
- `POST /api/topics/[day]/grade` → body `{ questionEn, keyPoints, answer }`; returns
  `{ score, feedbackVi, covered }`. Groq call mirrors `/api/speaking/grade`
  (same key/model/error-fallback pattern), persona-framed, tolerant of speech-to-text
  transcripts. Fallback (Groq down): keyword-overlap score + canned feedback.
- `POST /api/topics/[day]/complete` → body `{ scores: number[] }`; upserts
  `user_topic_progress` (best_score = avg), awards XP + streak via the existing
  activity actions, returns `{ xpEarned }`.

## UI

Nav: add a **"Lộ trình"** item to `src/components/sidebar.tsx` and
`src/components/mobile-tab-bar.tsx` → `/topics`.

- `src/app/(app)/topics/page.tsx` (server) → `TopicRoadmap` (client): the 30-day map
  with locked / unlocked / completed states and a "Hôm nay" button jumping to the next
  incomplete unlocked day. Reuses the app's card/level visual language.
- `src/app/(app)/topics/[day]/page.tsx` (server) → `TopicDeckClient` → `TopicDeckRunner`.
- `src/components/topics/TopicDeckRunner.tsx` — full-screen slide player with a
  progress bar (same chrome pattern as `SessionRunner`). Advances slide-by-slide; on
  the last slide calls `POST /api/topics/[day]/complete` then shows a finish screen
  (XP, replay, back to roadmap).
- Slide renderers in `src/components/topics/`:
  - `VocabSlide.tsx` — image/emoji reveals first (brief animation), then 4 word
    options appear; tap to answer, correct/incorrect feedback, plays word audio.
  - `AttributeSlide.tsx` — prompt + options → on answer reveal `explain_vi`.
  - `VoiceQASlide.tsx` — the AI voice conversation (below).
- `src/lib/tts.ts` — `speakText(text, { lang })` wrapping `window.speechSynthesis`
  (`SpeechSynthesisUtterance`), plus `isTtsSupported()`. No-op + graceful when
  unsupported.

### AI voice conversation (`VoiceQASlide`)

1. On mount, `speakText(question_en)` reads the question aloud (also shown as text,
   with `question_vi` help and a replay 🔊 button).
2. Learner taps mic → `useSpeechRecognition({ continuous: true })` (existing hook,
   Chrome) transcribes into an editable text box.
3. Submit → `POST /api/topics/[day]/grade` → shows `score`, `feedbackVi`, and which
   `key_points` were `covered`.
4. "Tiếp tục" advances; the slide reports its score up to `TopicDeckRunner` (collected
   for `complete`).

Degradation: no STT (non-Chrome) → the mic is hidden and the learner types the answer
(still graded). No TTS → question shows as text only (replay button disabled/hidden).

## XP / progress

Completing a day awards a flat XP (e.g. +30) plus a voice bonus (e.g. +5 per voice_qa
answered) via the existing daily-activity + streak actions — consistent with how
learn/review/speaking already award XP. XP formula lives server-side in the `complete`
route.

## Content generation (run once)

`scripts/generate-topic-decks.mjs` (Groq, `GROQ_API_KEY`/`GROQ_MODEL`, same fetch
pattern as the existing generators):
- Iterates the 30-day mapping. For each day: fetch the lesson's words; pick ~6 vocab
  words (prefer ones with `image_url`); call Groq with the persona-framed prompt to
  produce 3 `attribute` slides and 3 `voice_qa` slides grounded in the topic + words;
  assemble the ordered `slides`; upsert `topic_days`.
- Flags: `--day N` (one day), `--limit N` (first N days) for testing; idempotent
  (re-run overwrites / fills gaps). Handles Groq rate limits like the existing seed.

`scripts/migrate-topic-tables.mjs` — idempotent schema creation (mirrors
`migrate-method-tables.mjs`).

## Testing

- `topic-deck.test.ts` (vitest, node): `normalizeSlides` (valid/malformed/mixed),
  `buildVocabOptions` (4 options, one correct, distractors distinct), `isDayUnlocked`
  (day 1 open; N locked until N-1 completed).
- Generation, TTS, and speech are verified manually (seed a few days, run one deck).

## Out of scope

- Mobile port.
- Generating new images (situational slides use existing word images or emoji).
- Changing existing learn/review/speaking/writing/SRS.
- Editing decks in-app (content is seed-generated; re-run the script to change).
- Multi-course (still course_id = 1).

## Suggested build order (for the plan)

1. Schema + migration. 2. `topic-deck.ts` types/normalizer/options (+tests).
3. Generation script + seed a few days. 4. API routes (list/deck/complete).
5. Roadmap menu + nav. 6. Deck runner + vocab/attribute slides. 7. `tts.ts` +
voice grade route + `VoiceQASlide`. 8. Wire completion/XP + finish screen.
