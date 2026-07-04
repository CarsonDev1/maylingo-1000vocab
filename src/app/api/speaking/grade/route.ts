import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { finishWritingSession } from "@/lib/actions";

interface GradingResult {
  fluency_score: number;
  words_used: string[];
  feedback: string;
  grammar_notes: string;
}

async function gradeWithGroq(text: string, lessonTitle: string, vocabWords: string[]): Promise<GradingResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const wordList = vocabWords.slice(0, 30).join(", ");
  const systemPrompt = `Bạn là giáo viên tiếng Anh giao tiếp đạt IELTS Speaking 8.0, chuyên dạy học sinh Việt Nam luyện NÓI. Đây là BẢN CHÉP LỜI NÓI (speech-to-text) nên có thể thiếu dấu câu — ĐỪNG soi lỗi dấu câu hay viết hoa. Tập trung vào việc dùng từ đúng ngữ cảnh, độ tự nhiên và trôi chảy. Trả lời ONLY bằng valid JSON.`;
  const userPrompt = `Một học sinh người Việt đã NÓI (được chép lại) về chủ đề "${lessonTitle}":

"""
${text}
"""

Danh sách từ vựng của chủ đề: ${wordList}

Trả về JSON:
{
  "fluency_score": <số nguyên 0-100: độ trôi chảy, tự nhiên, dùng từ đúng ngữ cảnh. Không trừ điểm vì dấu câu/viết hoa>,
  "words_used": <mảng các từ trong danh sách xuất hiện trong bài nói (không phân biệt hoa thường)>,
  "feedback": <nhận xét TIẾNG VIỆT 4-6 câu: (1) khen từ dùng tốt/tự nhiên; (2) chỗ diễn đạt chưa tự nhiên và cách nói hay hơn; (3) 1-2 mẫu câu/cụm nên dùng khi nói về chủ đề này; (4) động viên>,
  "grammar_notes": <2-3 lỗi cấu trúc/thì/từ loại theo mẫu "❌ ... → ✅ ...: giải thích", hoặc "" nếu ổn>
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as GradingResult;
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
  if (wordCount < 20) {
    return NextResponse.json({ error: "Spoken response too short (minimum 20 words)" }, { status: 400 });
  }
  if (wordCount > 300) {
    return NextResponse.json({ error: "Spoken response too long (maximum 300 words)" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: lesson } = await db.from("lessons").select("title_en,title_vi").eq("id", lessonId).maybeSingle();
  const lessonTitle = lesson?.title_en ?? lesson?.title_vi ?? "General Vocabulary";

  const [{ data: progress }, { data: allWords }] = await Promise.all([
    db.from("user_word_progress").select("word_id").eq("user_id", userId),
    db.from("words").select("id,term").eq("lesson_id", lessonId),
  ]);
  const learnedIds = new Set(((progress as { word_id: number }[]) ?? []).map((p) => p.word_id));
  const learnedTerms = ((allWords as { id: number; term: string }[]) ?? [])
    .filter((w) => learnedIds.has(w.id))
    .map((w) => w.term);
  const vocabWords = learnedTerms.length > 0 ? learnedTerms : ((allWords as { id: number; term: string }[]) ?? []).map((w) => w.term);

  let grading: GradingResult;
  try {
    grading = await gradeWithGroq(text, lessonTitle, vocabWords);
  } catch {
    const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");
    const textNorm = norm(text);
    grading = {
      fluency_score: 70,
      words_used: vocabWords.filter((w) => textNorm.includes(norm(w))),
      feedback: "Đã ghi nhận phần nói của bạn! Cứ luyện nói đều đặn để trôi chảy hơn nhé.",
      grammar_notes: "",
    };
  }

  const fluencyScore = Math.min(100, Math.max(0, Math.round(Number(grading.fluency_score) || 70)));
  const wordsUsed: string[] = Array.isArray(grading.words_used) ? grading.words_used.filter((w) => typeof w === "string") : [];
  const feedback = typeof grading.feedback === "string" ? grading.feedback : "Cố gắng tốt lắm! Tiếp tục luyện nói nhé.";
  const grammarNotes = typeof grading.grammar_notes === "string" ? grading.grammar_notes : "";

  const xpEarned = 20 + Math.min(wordsUsed.length * 5, 40);
  try {
    await finishWritingSession(xpEarned);
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    fluencyScore,
    wordsUsed,
    totalVocab: vocabWords.length,
    feedback,
    grammarNotes,
    xpEarned,
  });
}
