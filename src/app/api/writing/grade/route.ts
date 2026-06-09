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

  const systemPrompt = `Bạn là một giáo viên tiếng Anh đạt IELTS 8.5, có nhiều năm kinh nghiệm dạy từ vựng và kỹ năng viết cho học sinh Việt Nam. Nhiệm vụ của bạn là giúp học sinh dùng từ vựng ĐÚNG NGHĨA và ĐÚNG NGỮ CẢNH — không phải soi lỗi chính tả hay dấu câu. Hãy trả lời ONLY bằng valid JSON.`;

  const userPrompt = `Một học sinh người Việt đang học từ vựng tiếng Anh đã viết đoạn văn sau về chủ đề "${lessonTitle}":

"""
${text}
"""

Danh sách từ vựng của chủ đề này mà học sinh đã học: ${wordList}

Hãy chấm bài và trả về JSON với đúng các trường sau:

{
  "grammar_score": <số nguyên 0-100 đánh giá tổng thể: độ chính xác từ vựng, cấu trúc câu, mạch ý. KHÔNG trừ điểm vì lỗi viết hoa hay dấu câu nhỏ. 90-100: xuất sắc. 75-89: tốt. 60-74: khá. Dưới 60: cần cải thiện nhiều>,
  "words_used": <mảng các từ trong danh sách từ vựng xuất hiện trong bài viết (không phân biệt hoa thường, "break time" = "breaktime" = "break-time")>,
  "feedback": <nhận xét bằng tiếng Việt, dài 5-7 câu, TẬP TRUNG VÀO: (1) Những từ vựng nào học sinh dùng ĐÚNG ngữ cảnh và tự nhiên — chỉ rõ từ đó, khen cụ thể. (2) Những từ vựng nào dùng CHƯA ĐỦ TỰ NHIÊN hoặc sai ngữ cảnh — ví dụ: dùng được nhưng có từ hay hơn, hoặc dùng sai vị trí trong câu. (3) Gợi ý 1-2 từ/cụm từ hay hơn để thay thế hoặc bổ sung cho bài viết thêm phong phú. (4) Nhận xét ngắn về mạch ý và sự liên kết câu. (5) Động viên và định hướng cải thiện>,
  "grammar_notes": <chỉ ghi các lỗi về CẤU TRÚC CÂU, THỜI ĐỘNG TỪ, hoặc DÙNG SAI TỪ LOẠI (noun/verb/adj) — KHÔNG đề cập lỗi viết hoa, dấu phẩy, dấu chấm. Mỗi lỗi theo định dạng: "❌ [phần câu sai] → ✅ [sửa lại]: [giải thích ngắn tại sao]". Liệt kê 2-3 lỗi nếu có, hoặc để "" nếu câu đúng hết>
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
      feedback: "Bài viết của bạn đã được ghi nhận! Hãy tiếp tục luyện tập để cải thiện kỹ năng viết.",
      grammar_notes: "",
    };
  }

  // Sanitize grading output
  const grammarScore = Math.min(100, Math.max(0, Math.round(Number(grading.grammar_score) || 70)));
  const wordsUsed: string[] = Array.isArray(grading.words_used) ? grading.words_used.filter((w) => typeof w === "string") : [];
  const feedback = typeof grading.feedback === "string" ? grading.feedback : "Cố gắng tốt lắm! Hãy tiếp tục luyện viết nhé.";
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
