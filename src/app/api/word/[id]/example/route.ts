import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { validateExampleText } from "@/lib/word-example";
import type { UserWordExample } from "@/types";

function parseWordId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function feedbackFromGroq(term: string, meaningVi: string | null, text: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  if (!apiKey) throw new Error("no key");

  const systemPrompt =
    "You are a friendly English teacher for learners. Reply with valid JSON only.";
  const userPrompt = `A learner wrote an example sentence for the word "${term}"${meaningVi ? ` (meaning: ${meaningVi})` : ""}:
"""
${text}
"""
Give SHORT feedback in English (2-4 sentences): (1) whether the sentence uses "${term}" with the right meaning and naturally — praise if good; (2) if there are grammar/word-use errors, point them out and suggest a better sentence in English. Return JSON: { "feedback": "<feedback in English>" }`;

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
      temperature: 0.5,
      max_tokens: 400,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  const fb = typeof parsed.feedback === "string" ? parsed.feedback.trim() : "";
  if (!fb) throw new Error("empty feedback");
  return fb;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const wordId = parseWordId(params.id);
  if (wordId == null) return NextResponse.json({ error: "Invalid word id" }, { status: 400 });

  const db = getSupabaseAdmin();
  const { data } = await db
    .from("user_word_examples")
    .select("id,word_id,text,feedback,created_at")
    .eq("user_id", userId)
    .eq("word_id", wordId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ examples: (data as UserWordExample[]) ?? [] });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const wordId = parseWordId(params.id);
  if (wordId == null) return NextResponse.json({ error: "Invalid word id" }, { status: 400 });

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  const v = validateExampleText(text);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const db = getSupabaseAdmin();
  const { data: word } = await db.from("words").select("term,meaning_vi").eq("id", wordId).maybeSingle();
  if (!word) return NextResponse.json({ error: "Word not found" }, { status: 404 });

  let feedback: string;
  try {
    feedback = await feedbackFromGroq((word as { term: string }).term, (word as { meaning_vi: string | null }).meaning_vi, text);
  } catch {
    feedback = "Your example has been saved! Keep practicing to use this word naturally.";
  }

  const { data: inserted, error } = await db
    .from("user_word_examples")
    .insert({ user_id: userId, word_id: wordId, text, feedback })
    .select("id,word_id,text,feedback,created_at")
    .single();

  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  return NextResponse.json({ example: inserted as UserWordExample });
}
