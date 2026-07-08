# SDD Progress — topic-slides-voice-tutor

Branch: feat/topic-slides-voice-tutor
Plan: docs/superpowers/plans/2026-07-08-topic-slides-voice-tutor.md
BASE (branch start): 5356603

## Tasks
- Task 1: complete (commit 197dc96, review clean)
- Task 2: complete (commit 6d27a1f, review clean)
- Task 3: complete (commit 3ae3bf9, review clean; 30 days seeded)
- Task 4: complete (commit a588706, review clean)
- Task 5: complete (commit 3c59819, review clean)
- Task 6: complete (commit 86afe68, review clean)
- Task 7: complete (commit 331b08b, review clean)
- Task 9: complete (final review READY TO MERGE; 2 minors folded in @ 8f4cfb8)

## Minor findings (for final review)
- Task 1: topic-deck.ts buildVocabOptions does not dedupe distractor labels (matches existing exercises.ts pattern; harden if a caller mixes duplicate terms).
- Task 2: topic_days.lesson_id FK has no ON DELETE (inherited from brief; lessons are static — low risk).
- Task 2: user_topic_progress.day_no has no FK to topic_days (brief did not require; looser integrity).
- Task 3: generate-topic-decks.mjs --day N regenerates without --force (idempotency-skip guarded by !ONLY_DAY).
- Task 3: generateDeck only guards all-empty, not the 6/3/3 shape; could upsert a shape-incomplete deck on a future run.
- Task 3: no process.exit(1) when failed>0 (interactive seed; low impact).
- Task 3: "exactly one correct" enforced only as ">=1 correct" (relies on LLM; live data clean) — same as app normalizer.
- Task 4: [day] route skips words query when no slide has a word_id (unreachable for seeded data).
- Task 5: finishTopicDay xpEarned uses clean.length (filtered) vs prose scores.length — identical for valid callers.
- Task 5: finishTopicDay does not validate dayNo 1..30 (brief didn't require; low risk).
- Task 6: TopicRoadmap fetch-failure shows the same empty-state copy as no-content (cosmetic).
- Task 7: TopicDeckRunner finishTopicDay().catch swallows errors -> shows "+0 XP" finish even if progress did not persist (consider retry/error state).
- Task 7: progress bar uses index/total (0-based) while counter is index+1 (cosmetic).
- Task 8: complete (commit 6bcfa11, review clean)
- Task 8: VoiceQASlide does not speechSynthesis.cancel() on unmount -> TTS can bleed into next slide (worth folding in).
- Task 8: submit async setState after unmount possible (harmless React18); could guard with mounted ref.
- Task 8: trusts data.score numeric on res.ok (route guarantees it; Number()||0 would harden).

## Final review: READY TO MERGE. Folded fixes: dayNo clamp + TTS cancel-on-unmount (8f4cfb8). Deferred minors remain listed above.
