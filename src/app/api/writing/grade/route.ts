import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { finishWritingSession } from "@/lib/actions";

interface GradingResult {
  grammar_score: number;
  words_used: string[];
  feedback: string;
  grammar_notes: string;
}

async function gradeWithGroq(
  text: string,
  lessonTitle: string,
  vocabWords: string[],
): Promise<GradingResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const wordList = vocabWords.slice(0, 30).join(", ");

  const systemPrompt = `You are an English teacher with an IELTS 8.5 level and years of experience teaching vocabulary and writing skills to learners. Your job is to help the learner use vocabulary with the RIGHT MEANING and in the RIGHT CONTEXT — not to nitpick spelling or punctuation. Reply with ONLY valid JSON.`;

  const userPrompt = `An English learner wrote the following paragraph on the topic "${lessonTitle}":

"""
${text}
"""

Vocabulary from this topic that the learner has studied: ${wordList}

Grade the writing and return JSON with exactly these fields:

{
  "grammar_score": <integer 0-100 overall: vocabulary accuracy, sentence structure, coherence. Do NOT deduct for capitalization or minor punctuation. 90-100: excellent. 75-89: good. 60-74: fair. Below 60: needs a lot of improvement>,
  "words_used": <array of the vocabulary words from the list that appear in the writing (case-insensitive, "break time" = "breaktime" = "break-time")>,
  "feedback": <feedback in English, 5-7 sentences, FOCUS ON: (1) Which vocabulary words the learner used correctly and naturally — name them and praise specifically. (2) Which words were used unnaturally or in the wrong context — e.g. usable but there is a better word, or wrong placement in the sentence. (3) Suggest 1-2 better words/phrases to replace or enrich the writing. (4) A short note on coherence and how the sentences connect. (5) Encouragement and direction to improve>,
  "grammar_notes": <only note errors in SENTENCE STRUCTURE, VERB TENSE, or WRONG PART OF SPEECH (noun/verb/adj) — do NOT mention capitalization, commas, or periods. Format each error as: "❌ [wrong part] → ✅ [fix]: [short reason why]". List 2-3 errors if any, or "" if the writing is correct>
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as GradingResult;
}

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { lessonId?: number; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lessonId, text } = body;
  if (!lessonId || !text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing lessonId or text" }, { status: 400 });
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 50) {
    return NextResponse.json({ error: "Text too short (minimum 50 words)" }, { status: 400 });
  }
  if (wordCount > 200) {
    return NextResponse.json({ error: "Text too long (maximum 200 words)" }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // Load lesson title
  const { data: lesson } = await db.from("lessons").select("title_en,title_vi").eq("id", lessonId).maybeSingle();
  const lessonTitle = lesson?.title_en ?? lesson?.title_vi ?? "General Vocabulary";

  // Load words from this lesson that the user has learned
  const [{ data: progress }, { data: allWords }] = await Promise.all([
    db.from("user_word_progress").select("word_id").eq("user_id", userId),
    db.from("words").select("id,term").eq("lesson_id", lessonId),
  ]);

  const learnedIds = new Set(((progress as { word_id: number }[]) ?? []).map((p) => p.word_id));
  const learnedTerms = ((allWords as { id: number; term: string }[]) ?? [])
    .filter((w) => learnedIds.has(w.id))
    .map((w) => w.term);

  // Fall back to all lesson words if user hasn't learned any yet (unlikely)
  const vocabWords = learnedTerms.length > 0 ? learnedTerms : ((allWords as { id: number; term: string }[]) ?? []).map((w) => w.term);

  let grading: GradingResult;
  try {
    grading = await gradeWithGroq(text, lessonTitle, vocabWords);
  } catch {
    // Fallback if Groq is unavailable: count word matches manually (normalize spaces/hyphens)
    const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");
    const textNorm = norm(text);
    const wordsUsed = vocabWords.filter((w) => textNorm.includes(norm(w)));
    grading = {
      grammar_score: 70,
      words_used: wordsUsed,
      feedback: "Your writing has been saved! Keep practicing to improve your writing skills.",
      grammar_notes: "",
    };
  }

  // Sanitize grading output
  const grammarScore = Math.min(100, Math.max(0, Math.round(Number(grading.grammar_score) || 70)));
  const wordsUsed: string[] = Array.isArray(grading.words_used) ? grading.words_used.filter((w) => typeof w === "string") : [];
  const feedback = typeof grading.feedback === "string" ? grading.feedback : "Great effort! Keep practicing your writing.";
  const grammarNotes = typeof grading.grammar_notes === "string" ? grading.grammar_notes : "";

  // XP: 20 base + 5 per vocab word used (capped at 8 words = 40 bonus), max 60 XP
  const xpEarned = 20 + Math.min(wordsUsed.length * 5, 40);

  try {
    await finishWritingSession(xpEarned);
  } catch {
    // Non-fatal: grading result still returned
  }

  return NextResponse.json({
    grammarScore,
    wordsUsed,
    totalVocab: vocabWords.length,
    feedback,
    grammarNotes,
    xpEarned,
  });
}
