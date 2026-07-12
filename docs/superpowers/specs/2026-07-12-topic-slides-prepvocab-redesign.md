# Topic Slides — PrepVocab Redesign

Date: 2026-07-12
Scope: **web app only.** Supersedes the slide-content parts of
`2026-07-08-topic-slides-voice-tutor-design.md`. The infrastructure from that round
(tables, API routes, roadmap menu, TTS/STT, Groq grading, `finishTopicDay`) is kept;
this round changes the **content source** and the **slide experience**.

## What changed (and why)

The first build sourced 30 curated **course 1** lessons and rendered **quiz cards**
("image → choose the answer"). Two corrections from review:

1. **Source → PrepVocab (course 2).** Reuse the imported PrepEdu content: **20
   communication topics**, 25 words each (500 total), **~100% with real images** already
   in Supabase Storage (verified reachable), plus Vietnamese meanings and example
   sentences. This becomes a **20-day program** (one topic per day).
2. **Quiz cards → interactive presentation slides.** Slides look and feel like a polished
   PPT/Canva deck (paged, animated, image-first), not a quiz. The approved visual
   reference is the mockup at `docs/mockups/topic-slides-shopping-mockup.html`
   (light-mode, SVG-illustration version) — the real feature uses the **real PrepVocab
   images** in that same layout language.

**Not used:** Remotion (dropped) and Gemini image generation (dropped — PrepVocab already
has images; no billing needed).

## Data source: PrepVocab (course 2)

Coverage (verified): 500 words, 499 images (~100%), 479 example_en, meanings ~100%,
**audio = 0**, phonetic = null.

Consequences:
- **Pronunciation uses browser TTS** (`speakText` from `src/lib/tts.ts`, already built) —
  there is no stored audio. `playAudio` is not used for PrepVocab words.
- **English lesson titles are missing** (`title_en` is null for course 2) — the seed sets
  a curated `title_en` per day (table below).

### 20-day → lesson_id mapping (seed source of truth)

| Day | lesson_id | title_en | title_vi |
|----|----|----|----|
| 1 | 12667 | Daily Activities 1 | Chủ đề về hoạt động hàng ngày 1 |
| 2 | 12682 | Daily Activities 2 | Chủ đề về hoạt động hàng ngày 2 |
| 3 | 12668 | Weather | Chủ đề về thời tiết |
| 4 | 12669 | Fashion | Chủ đề về thời trang |
| 5 | 12670 | Food & Cuisine | Chủ đề về ẩm thực |
| 6 | 12671 | Health | Chủ đề về sức khoẻ |
| 7 | 12672 | Technology | Chủ đề về công nghệ |
| 8 | 12683 | Sports | Chủ đề thể thao |
| 9 | 12684 | Movies | Chủ đề về điện ảnh |
| 10 | 12685 | Work | Chủ đề công việc |
| 11 | 12673 | Personality | Chủ đề về miêu tả tính cách |
| 12 | 12674 | Appearance | Chủ đề về miêu tả ngoại hình |
| 13 | 12675 | Careers | Chủ đề về nghề nghiệp |
| 14 | 12676 | Emotions | Chủ đề về miêu tả cảm xúc |
| 15 | 12678 | Household Items | Chủ đề về đồ đạc trong gia đình |
| 16 | 12677 | Time | Chủ đề về thời gian |
| 17 | 12679 | Places & Spaces | Chủ đề về không gian |
| 18 | 12680 | Entertainment | Chủ đề về giải trí |
| 19 | 12681 | Family | Chủ đề về gia đình |
| 20 | 12686 | Transportation | Chủ đề về giao thông |

Persona for AI-generated content stays: **a software engineer aiming to communicate/
interview at a multinational company** — the attribute/dialogue/voice content frames each
everyday topic toward real workplace/interview situations.

## The interactive slide deck

Each day is an ordered deck played full-screen with a progress bar (existing
`TopicDeckRunner` chrome). Light mode. Advance by button / arrow keys / progress dots.
Slide types (the deck mixes data-driven and AI-generated slides):

| Type | Source | Interaction |
|---|---|---|
| `cover` | lesson title + a representative word image | intro; Continue |
| `vocab` | PrepVocab words (image + term + meaning_vi) | **image-first card grid; tap a card to reveal meaning; 🔊 tap to hear (TTS)** |
| `example` | PrepVocab `example_en` + word image | big image + example sentence; 🔊 hear the sentence |
| `attribute` | **AI-generated** (Groq), persona-framed | a short question + options; **tap to reveal** the answer + explanation (not scored) |
| `dialogue` | **AI-generated** short conversation using topic words | **tap to reveal** each line; 🔊 hear each line |
| `voice_qa` | **AI-generated** situational question + key points | AI reads question (TTS) → user speaks (STT) → Groq grades → feedback + score |
| `recap` | static + counts | summary checklist + XP/streak/unlock |

Interaction principle (per the approved mockup): **presentation-first with reveal/tap/
listen**, plus the `attribute` tap-to-reveal and the `voice_qa` speaking task. No cold
"pick the right answer" quiz cards.

Standard deck per day (configurable in the seed): `cover` → 2× `vocab` (≈6 words each) →
2× `example` → 2× `attribute` → 1× `dialogue` → 2× `voice_qa` → `recap` (~10 slides).
`vocab`/`example` slides reference `word_id`s (chosen by the seed, images/meanings
hydrated at read time); `attribute`/`dialogue`/`voice_qa` are AI-generated and stored.

### Slide JSON shapes (stored in `topic_days.slides`)

```jsonc
{ "type": "cover", "hero_word_id": 34567, "goal_vi": "…", "goal_en": "…" }
{ "type": "vocab", "word_ids": [34567, 34568, 34569, 34570, 34571, 34572] }
{ "type": "example", "word_id": 34567 }               // uses word.example_en + image
{ "type": "attribute", "word_id": 34567 | null,
  "prompt_en": "...", "prompt_vi": "...",
  "options": [ {"label":"...","correct":true}, ... ], "explain_vi": "..." }
{ "type": "dialogue", "title_en": "At the gym",
  "lines": [ {"who":"a"|"b", "en":"...", "vi":"..."}, ... ] }   // 3–5 lines
{ "type": "voice_qa", "question_en": "...", "question_vi": "...",
  "key_points": ["...","..."], "sample_answer_en": "..." }
{ "type": "recap" }
```

## Component & code changes (from the existing branch build)

**Kept unchanged:** `topic_days` / `user_topic_progress` tables; `GET /api/topics`,
`GET /api/topics/[day]` (already returns `{deck, words}` with the lesson's words
hydrated), `POST /api/topics/[day]/grade`, `finishTopicDay`; the `/topics` roadmap menu;
`src/lib/tts.ts`; `TopicDeckRunner` chrome + finish screen.

**Changed:**
- `src/types/index.ts` + `src/lib/topic-deck.ts`: expand `TopicSlide` to the new union
  (`cover`, `vocab` (word_ids[]), `example`, `attribute`, `dialogue`, `voice_qa`,
  `recap`); update `normalizeSlides` accordingly. `buildVocabOptions` is no longer needed
  for vocab (vocab is reveal, not MC) — remove or repurpose; keep `isDayUnlocked`.
- `scripts/generate-topic-decks.mjs`: point `DAYS` at the **20 course-2 lesson_ids**
  above with the curated `title_en`; generate `attribute`/`dialogue`/`voice_qa` (persona-
  framed) and assemble the ordered deck (cover/vocab/example reference chosen word_ids).
  Idempotent as before. (The `topic_days` rows are re-seeded for days 1–20; old 30-day
  course-1 rows for days 21–30 are removed.)
- Slide renderers under `src/components/topics/`: **rewrite to the presentation style**
  matching the mockup — `CoverSlide`, `VocabSlide` (image cards + tap reveal + TTS),
  `ExampleSlide`, `AttributeSlide` (tap-to-reveal), `DialogueSlide` (reveal lines + TTS),
  `VoiceQASlide` (kept, TTS/STT/grade), `RecapSlide`. Real PrepVocab images via
  `word.image_url`. `TopicDeckRunner` dispatches the new types.
- Roadmap shows **20 days** (data-driven from `topic_days`, so no code change needed
  beyond re-seed).

## Non-goals

Remotion; Gemini/AI image generation; audio recording for words (TTS covers
pronunciation); changing course 1 / existing learn-review-speaking-writing flows; mobile.

## Testing

- `topic-deck.test.ts`: update for the new `normalizeSlides` union (valid/malformed per
  type; non-array → []); `isDayUnlocked` unchanged.
- Manual: seed days 1–20 (needs GROQ + Supabase), run a deck end-to-end, verify real
  images load, TTS pronounces, tap-reveals work, voice_qa grades, finish awards XP, and
  the roadmap shows 20 days with sequential unlock.

## Visual standard

`docs/mockups/topic-slides-shopping-mockup.html` (light mode) is the agreed look for
layout, spacing, palette, and interaction feel — the implementation should match its
quality, using real PrepVocab images in place of the mockup's SVG illustrations.
