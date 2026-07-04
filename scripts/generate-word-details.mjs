// Generate "deep understanding" (B1) content for words via Groq, into word_details.
// Idempotent: skips words that already have a row unless --force. Resumable.
//
// Prereq: the public.word_details table must exist (run supabase/schema.sql).
// Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (or SERVICE_ROLE),
//                   GROQ_API_KEY, optional GROQ_MODEL.
//
// Usage:
//   node scripts/generate-word-details.mjs            # all words missing details
//   node scripts/generate-word-details.mjs --limit 10 # only first 10 (test run)
//   node scripts/generate-word-details.mjs --force     # regenerate everything
import { loadEnv, getServiceClient, pool, sleep } from "./_supabase.mjs";

loadEnv();

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
const CONCURRENCY = 4;

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
if (!GROQ_KEY) {
  console.error("Missing GROQ_API_KEY in .env.local");
  process.exit(1);
}

const db = getServiceClient();

// ---------- inline validation (read path re-validates in src/lib/word-detail.ts) ----------
function cleanString(v) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
function normalizeContexts(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const context_vi = cleanString(item.context_vi);
    const example_en = cleanString(item.example_en);
    if (context_vi && example_en) out.push({ context_vi, example_en });
    if (out.length === 3) break;
  }
  return out;
}

// ---------- Groq ----------
async function generate(word) {
  const posPart = word.pos ? ` (${word.pos})` : "";
  const systemPrompt =
    "Bạn là giáo viên tiếng Anh giàu kinh nghiệm dạy học sinh Việt Nam. " +
    "Chỉ trả lời bằng valid JSON, không thêm bất kỳ chữ nào ngoài JSON.";
  const userPrompt = `Từ vựng: "${word.term}"${posPart}
Nghĩa tiếng Việt: ${word.meaning_vi ?? "(không có)"}
${word.example_en ? `Ví dụ có sẵn (đừng lặp lại): ${word.example_en}` : ""}

Tạo nội dung "hiểu sâu" cho từ này. Trả về JSON đúng các trường:
{
  "definition_en": "<định nghĩa Anh–Anh ngắn gọn 1 câu, làm rõ sắc thái gốc, viết bằng TIẾNG ANH đơn giản>",
  "nuance_vi": "<1 câu TIẾNG VIỆT về sắc thái/ngữ vực: trang trọng hay thân mật, tích cực/tiêu cực, hoặc lưu ý dùng sai thường gặp>",
  "usage_contexts": [
    { "context_vi": "<tình huống người bản xứ hay dùng, mô tả TIẾNG VIỆT ngắn>", "example_en": "<câu ví dụ TIẾNG ANH ngắn, tự nhiên, đúng ngữ cảnh>" }
  ]
}
Yêu cầu: usage_contexts có ĐÚNG 2 hoặc 3 phần tử với các ngữ cảnh KHÁC nhau.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 800,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

  const definition_en = cleanString(parsed.definition_en);
  const nuance_vi = cleanString(parsed.nuance_vi);
  const usage_contexts = normalizeContexts(parsed.usage_contexts);
  // Require at least a definition or one usage context to be worth storing.
  if (!definition_en && usage_contexts.length === 0) throw new Error("empty content");
  return { definition_en, nuance_vi, usage_contexts };
}

// ---------- main ----------
const { data: allWords, error: wErr } = await db
  .from("words")
  .select("id,term,pos,meaning_vi,meaning_en,example_en")
  .order("id");
if (wErr) {
  console.error("Failed to load words:", wErr.message);
  process.exit(1);
}

let existing = new Set();
if (!FORCE) {
  const { data: rows, error: dErr } = await db.from("word_details").select("word_id");
  if (dErr) {
    console.error("Failed to load word_details (does the table exist? run schema.sql):", dErr.message);
    process.exit(1);
  }
  existing = new Set((rows ?? []).map((r) => r.word_id));
}

const todo = allWords.filter((w) => FORCE || !existing.has(w.id)).slice(0, LIMIT);
console.error(`words: ${allWords.length}, already done: ${existing.size}, to generate: ${todo.length}`);

let ok = 0;
let failed = 0;
await pool(todo, CONCURRENCY, async (word) => {
  try {
    const content = await generate(word);
    const { error } = await db.from("word_details").upsert(
      {
        word_id: word.id,
        definition_en: content.definition_en,
        nuance_vi: content.nuance_vi,
        usage_contexts: content.usage_contexts,
        model: GROQ_MODEL,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "word_id" },
    );
    if (error) throw new Error(error.message);
    ok++;
    if (ok % 25 === 0) console.error(`  …${ok} done`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${word.id} "${word.term}": ${e.message}`);
  }
  await sleep(150); // gentle on rate limits
});

console.error(`\nDone. generated: ${ok}, failed/skipped: ${failed}. Re-run to fill any gaps.`);
