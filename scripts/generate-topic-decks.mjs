// Generate all 30 topic decks via Groq into topic_days (persona: software engineer
// aiming to work at a multinational company). Idempotent: skips days that already
// have a row unless --force. Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
// GROQ_API_KEY, optional GROQ_MODEL. Prereq: run scripts/migrate-topic-tables.mjs.
//
// Usage:
//   node scripts/generate-topic-decks.mjs             # all missing days
//   node scripts/generate-topic-decks.mjs --limit 2   # first 2 days (test)
//   node scripts/generate-topic-decks.mjs --day 9     # only day 9
//   node scripts/generate-topic-decks.mjs --force     # regenerate all
import { loadEnv, getServiceClient, sleep } from "./_supabase.mjs";

loadEnv();

// day_no -> lesson_id (course_id = 1). Fixed curriculum for a dev going multinational.
const DAYS = [
  [1, 39], [2, 40], [3, 41], [4, 42], [5, 10], [6, 13], [7, 43], [8, 38], [9, 97], [10, 15],
  [11, 4], [12, 14], [13, 45], [14, 88], [15, 22], [16, 51], [17, 99], [18, 21], [19, 20], [20, 94],
  [21, 92], [22, 93], [23, 24], [24, 91], [25, 86], [26, 87], [27, 3], [28, 100], [29, 96], [30, 83],
];

const VOCAB_PER_DAY = 6;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const num = (flag) => { const i = args.indexOf(flag); return i >= 0 ? Number(args[i + 1]) : null; };
const LIMIT = num("--limit");
const ONLY_DAY = num("--day");

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
if (!GROQ_KEY) { console.error("Missing GROQ_API_KEY in .env.local"); process.exit(1); }

const db = getServiceClient();

function cleanString(v) { if (typeof v !== "string") return null; const t = v.trim(); return t ? t : null; }

function normOptions(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const label = cleanString(it.label);
    if (!label) continue;
    out.push({ label, correct: it.correct === true });
    if (out.length === 4) break;
  }
  return out;
}
function normStrings(input, max) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const it of input) { const s = cleanString(it); if (s) out.push(s); if (out.length === max) break; }
  return out;
}

async function groq(messages, maxTokens) {
  const payload = JSON.stringify({
    model: GROQ_MODEL, messages, response_format: { type: "json_object" },
    temperature: 0.6, max_tokens: maxTokens,
  });
  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: payload,
    });
    if (res.status === 429 || res.status === 503) {
      const ra = parseFloat(res.headers.get("retry-after") ?? "");
      await sleep(Number.isFinite(ra) ? ra * 1000 + 500 : Math.min(30000, 1500 * 2 ** attempt));
      continue;
    }
    break;
  }
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

async function generateDeck(lesson, words) {
  // Vocab slides: prefer words with an image, keep original order.
  const vocab = [...words].sort((a, b) => (b.image_url ? 1 : 0) - (a.image_url ? 1 : 0))
    .slice(0, VOCAB_PER_DAY)
    .map((w) => ({ type: "vocab", word_id: w.id }));

  const wordList = words.slice(0, 20).map((w) => `${w.term}${w.meaning_vi ? " (" + w.meaning_vi + ")" : ""}`).join(", ");
  const topic = lesson.title_en ?? lesson.title_vi ?? "this topic";

  const system =
    "You design English communication practice for a Vietnamese software engineer who wants to work and interview at multinational companies. " +
    "Frame everything around real workplace/interview situations (standups, code review, meetings, deadlines, interviews, salary talk, cross-cultural small talk). " +
    "Reply ONLY with valid JSON.";
  const user = `Topic: "${topic}". Vocabulary available: ${wordList}.

Create JSON with EXACTLY these fields:
{
  "attribute": [
    { "word": "<one word from the vocabulary this question is about, or empty>",
      "prompt_en": "<a short fill-in / factual multiple-choice question in English about the topic, workplace-relevant>",
      "prompt_vi": "<the Vietnamese translation of prompt_en>",
      "options": [ {"label":"<en>","correct":true}, {"label":"<en>","correct":false}, {"label":"<en>","correct":false}, {"label":"<en>","correct":false} ],
      "explain_vi": "<1 short Vietnamese sentence explaining why the correct answer is right>" }
  ],
  "voice_qa": [
    { "question_en": "<a situational spoken question an interviewer or colleague would ask about this topic, for a software engineer>",
      "question_vi": "<Vietnamese translation>",
      "key_points": ["<point the answer should cover>", "<another>", "<another>"],
      "sample_answer_en": "<a 2-3 sentence strong sample answer>" }
  ]
}
Rules: "attribute" has EXACTLY 3 items, each with EXACTLY 4 options and EXACTLY one correct. "voice_qa" has EXACTLY 3 items, each with 2-3 key_points. Keep language natural and concise.`;

  const parsed = await groq([{ role: "system", content: system }, { role: "user", content: user }], 1600);
  const wordByTerm = new Map(words.map((w) => [w.term.toLowerCase(), w.id]));

  const attribute = (Array.isArray(parsed.attribute) ? parsed.attribute : []).map((a) => {
    const options = normOptions(a.options);
    const prompt_en = cleanString(a.prompt_en);
    const prompt_vi = cleanString(a.prompt_vi);
    if (!prompt_en || !prompt_vi || options.length < 2 || !options.some((o) => o.correct)) return null;
    const wid = wordByTerm.get(cleanString(a.word)?.toLowerCase() ?? "") ?? null;
    return { type: "attribute", word_id: wid, prompt_en, prompt_vi, options, explain_vi: cleanString(a.explain_vi) };
  }).filter(Boolean).slice(0, 3);

  const voice_qa = (Array.isArray(parsed.voice_qa) ? parsed.voice_qa : []).map((v) => {
    const question_en = cleanString(v.question_en);
    const question_vi = cleanString(v.question_vi);
    if (!question_en || !question_vi) return null;
    return { type: "voice_qa", question_en, question_vi, key_points: normStrings(v.key_points, 5), sample_answer_en: cleanString(v.sample_answer_en) };
  }).filter(Boolean).slice(0, 3);

  if (attribute.length === 0 && voice_qa.length === 0) throw new Error("empty generation");
  return [...vocab, ...attribute, ...voice_qa];
}

// ---------- main ----------
let days = DAYS;
if (ONLY_DAY) days = days.filter(([d]) => d === ONLY_DAY);
else if (LIMIT) days = days.slice(0, LIMIT);

if (!FORCE && !ONLY_DAY) {
  const { data: existing } = await db.from("topic_days").select("day_no");
  const have = new Set((existing ?? []).map((r) => r.day_no));
  days = days.filter(([d]) => !have.has(d));
}
console.error(`days to generate: ${days.map(([d]) => d).join(", ") || "(none)"}`);

let ok = 0, failed = 0;
for (const [day_no, lesson_id] of days) {
  try {
    const { data: lesson } = await db.from("lessons").select("id,title_en,title_vi").eq("id", lesson_id).maybeSingle();
    if (!lesson) throw new Error(`lesson ${lesson_id} not found`);
    const { data: words } = await db.from("words").select("id,term,meaning_vi,image_url").eq("lesson_id", lesson_id).order("id");
    if (!words || words.length === 0) throw new Error(`no words for lesson ${lesson_id}`);
    const slides = await generateDeck(lesson, words);
    const { error } = await db.from("topic_days").upsert({
      day_no, lesson_id,
      title_en: lesson.title_en, title_vi: lesson.title_vi,
      slides, model: GROQ_MODEL, generated_at: new Date().toISOString(),
    }, { onConflict: "day_no" });
    if (error) throw new Error(error.message);
    ok++;
    console.error(`  ✓ day ${day_no} (${lesson.title_en}) — ${slides.length} slides`);
  } catch (e) {
    failed++;
    console.error(`  ✗ day ${day_no}: ${e.message}`);
  }
  await sleep(300);
}
console.error(`\nDone. generated: ${ok}, failed: ${failed}. Re-run to fill gaps.`);
