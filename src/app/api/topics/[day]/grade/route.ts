import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";

interface GradeResult {
  score: number;
  feedback_vi: string;
  covered: string[];
}

async function gradeWithGroq(questionEn: string, keyPoints: string[], answer: string): Promise<GradeResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const system =
    "Bạn là giáo viên tiếng Anh giao tiếp cho một software engineer người Việt muốn làm việc ở công ty đa quốc gia. " +
    "Đây là BẢN CHÉP LỜI NÓI (speech-to-text) nên có thể thiếu dấu câu — ĐỪNG soi lỗi dấu câu/viết hoa. " +
    "Chấm theo mức độ trả lời đúng trọng tâm, tự nhiên, đủ ý. Trả lời ONLY bằng valid JSON.";
  const user = `Câu hỏi: "${questionEn}"
Các ý nên có trong câu trả lời: ${keyPoints.length ? keyPoints.join("; ") : "(không có)"}
Câu trả lời của học viên (đã chép lại):
"""
${answer}
"""
Trả về JSON:
{
  "score": <số nguyên 0-100: mức độ trả lời tốt, tự nhiên, đủ ý>,
  "covered": <mảng các ý (lấy nguyên văn từ danh sách trên) mà câu trả lời ĐÃ đề cập>,
  "feedback_vi": <nhận xét TIẾNG VIỆT 3-5 câu: (1) khen điểm tốt; (2) chỗ diễn đạt chưa tự nhiên + cách nói hay hơn (kèm 1 mẫu câu tiếng Anh); (3) động viên>
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 700,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as GradeResult;
}

export async function POST(req: Request, { params }: { params: { day: string } }) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  void params;

  let body: { questionEn?: string; keyPoints?: string[]; answer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const questionEn = (body.questionEn ?? "").trim();
  const keyPoints = Array.isArray(body.keyPoints) ? body.keyPoints.filter((k) => typeof k === "string") : [];
  const answer = (body.answer ?? "").trim();
  if (!answer) return NextResponse.json({ error: "Empty answer" }, { status: 400 });

  let result: GradeResult;
  try {
    result = await gradeWithGroq(questionEn, keyPoints, answer);
  } catch {
    // Fallback: keyword overlap of the key points against the answer.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "");
    const a = norm(answer);
    const covered = keyPoints.filter((k) => norm(k).split(/\s+/).some((w) => w.length > 3 && a.includes(w)));
    result = {
      score: Math.min(100, 50 + covered.length * 15),
      covered,
      feedback_vi: "Đã ghi nhận câu trả lời của bạn! Cứ luyện nói đều đặn, cố gắng nói đủ ý và tự nhiên hơn nhé.",
    };
  }

  const score = Math.min(100, Math.max(0, Math.round(Number(result.score) || 0)));
  const covered = Array.isArray(result.covered) ? result.covered.filter((c) => typeof c === "string") : [];
  const feedbackVi = typeof result.feedback_vi === "string" && result.feedback_vi.trim()
    ? result.feedback_vi.trim()
    : "Câu trả lời tốt! Tiếp tục luyện nói nhé.";

  return NextResponse.json({ score, feedbackVi, covered });
}
