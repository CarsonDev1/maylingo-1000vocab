import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";

interface GradeResult {
  score: number;
  feedback: string;
  covered: string[];
}

async function gradeWithGroq(questionEn: string, keyPoints: string[], answer: string): Promise<GradeResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const system =
    "You are an English communication coach for a Vietnamese software engineer who wants to work at a multinational company. " +
    "This is a SPEECH-TO-TEXT TRANSCRIPT so it may be missing punctuation/capitalization — DO NOT penalize that. " +
    "Grade based on how on-topic, natural, and complete the answer is. Reply ONLY with valid JSON, entirely in English.";
  const user = `Question: "${questionEn}"
Key points the answer should ideally cover: ${keyPoints.length ? keyPoints.join("; ") : "(none)"}
Learner's answer (transcribed from speech):
"""
${answer}
"""
Return JSON:
{
  "score": <integer 0-100: how good, natural, and complete the answer is>,
  "covered": <array of key points (verbatim from the list above) that the answer DID cover>,
  "feedback": <3-5 sentences of ENGLISH feedback: (1) praise what was good; (2) point out anything unnatural + a better way to say it (include one English example sentence); (3) encouragement>
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
      feedback: "Your answer has been recorded! Keep practicing regularly, and try to be more complete and natural.",
    };
  }

  const score = Math.min(100, Math.max(0, Math.round(Number(result.score) || 0)));
  const covered = Array.isArray(result.covered) ? result.covered.filter((c) => typeof c === "string") : [];
  const feedback = typeof result.feedback === "string" && result.feedback.trim()
    ? result.feedback.trim()
    : "Good answer! Keep practicing your speaking.";

  return NextResponse.json({ score, feedback, covered });
}
