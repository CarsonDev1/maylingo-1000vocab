// Generate all 20 PrepVocab topic decks via Groq into topic_days (persona: software
// engineer aiming to work at a multinational company). Idempotent: skips days already
// present unless --force. Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
// GROQ_API_KEY, optional GROQ_MODEL. Prereq: run scripts/migrate-topic-tables.mjs.
//
// Usage: node scripts/generate-topic-decks.mjs [--limit N | --day N | --force]
import { loadEnv, getServiceClient, sleep } from "./_supabase.mjs";

loadEnv();

// day_no -> [lesson_id, title_en]  (course_id = 2 / PrepVocab)
const DAYS = [
  [1, 12667, "Daily Activities 1"], [2, 12682, "Daily Activities 2"], [3, 12668, "Weather"],
  [4, 12669, "Fashion"], [5, 12670, "Food & Cuisine"], [6, 12671, "Health"],
  [7, 12672, "Technology"], [8, 12683, "Sports"], [9, 12684, "Movies"], [10, 12685, "Work"],
  [11, 12673, "Personality"], [12, 12674, "Appearance"], [13, 12675, "Careers"],
  [14, 12676, "Emotions"], [15, 12678, "Household Items"], [16, 12677, "Time"],
  [17, 12679, "Places & Spaces"], [18, 12680, "Entertainment"], [19, 12681, "Family"],
  [20, 12686, "Transportation"],
];
const VOCAB_SLIDES = 2, VOCAB_PER_SLIDE = 6, EXAMPLE_SLIDES = 2;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const num = (f) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : null; };
const LIMIT = num("--limit"), ONLY_DAY = num("--day");

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
if (!GROQ_KEY) { console.error("Missing GROQ_API_KEY"); process.exit(1); }
const db = getServiceClient();

const cleanStr = (v) => { if (typeof v !== "string") return null; const t = v.trim(); return t || null; };
function normOptions(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const label = cleanStr(it.label);
    if (!label) continue;
    out.push({ label, correct: it.correct === true });
    if (out.length === 4) break;
  }
  return out;
}
function normStrings(input, max) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const it of input) { const s = cleanStr(it); if (s) out.push(s); if (out.length === max) break; }
  return out;
}

async function groq(messages, maxTokens) {
  const payload = JSON.stringify({ model: GROQ_MODEL, messages, response_format: { type: "json_object" }, temperature: 0.6, max_tokens: maxTokens });
  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` }, body: payload,
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

async function buildDeck(titleEn, words) {
  const withImg = words.filter((w) => w.image_url);
  const heroId = (withImg[0] ?? words[0])?.id ?? null;

  // vocab slides: first VOCAB_SLIDES*VOCAB_PER_SLIDE imaged words
  const vocabWords = (withImg.length ? withImg : words).slice(0, VOCAB_SLIDES * VOCAB_PER_SLIDE);
  const vocabSlides = [];
  for (let i = 0; i < vocabWords.length; i += VOCAB_PER_SLIDE) {
    vocabSlides.push({ type: "vocab", word_ids: vocabWords.slice(i, i + VOCAB_PER_SLIDE).map((w) => w.id) });
  }
  // example slides: words that have an example_en
  const exampleWords = words.filter((w) => w.example_en).slice(0, EXAMPLE_SLIDES);
  const exampleSlides = exampleWords.map((w) => ({ type: "example", word_id: w.id }));

  const wordList = words.slice(0, 20).map((w) => `${w.term} (${w.meaning_vi ?? ""})`).join(", ");
  const system =
    "You design English communication practice for a Vietnamese software engineer who wants to work and interview at multinational companies. " +
    "Frame everything around real workplace/interview/daily-professional situations. Reply ONLY with valid JSON.";
  const user = `Topic: "${titleEn}". Vocabulary: ${wordList}.
Return JSON with EXACTLY:
{
  "attribute": [ { "word": "<one vocab word or empty>", "prompt_en": "<short factual/usage MC question in English>", "prompt_vi": "<Vietnamese translation>", "options": [ {"label":"<en>","correct":true},{"label":"<en>","correct":false},{"label":"<en>","correct":false},{"label":"<en>","correct":false} ], "explain_vi": "<1 short Vietnamese sentence>" } ],
  "dialogue": { "title_en": "<short scene title using this topic>", "lines": [ {"who":"a","en":"<line>","vi":"<vi>"}, {"who":"b","en":"<line>","vi":"<vi>"}, {"who":"a","en":"<line>","vi":"<vi>"}, {"who":"b","en":"<line>","vi":"<vi>"} ] },
  "voice_qa": [ { "question_en": "<situational spoken question a colleague/interviewer asks about this topic>", "question_vi": "<vi>", "key_points": ["<point>","<point>","<point>"], "sample_answer_en": "<2-3 sentence sample answer>" } ]
}
Rules: attribute EXACTLY 2 items (4 options each, exactly one correct). dialogue EXACTLY 4 lines alternating a/b. voice_qa EXACTLY 2 items (2-3 key_points each). Natural, concise.`;

  const parsed = await groq([{ role: "system", content: system }, { role: "user", content: user }], 1800);
  const byTerm = new Map(words.map((w) => [w.term.toLowerCase(), w.id]));

  const attribute = (Array.isArray(parsed.attribute) ? parsed.attribute : []).map((a) => {
    const options = normOptions(a.options);
    const prompt_en = cleanStr(a.prompt_en), prompt_vi = cleanStr(a.prompt_vi);
    if (!prompt_en || !prompt_vi || options.length < 2 || !options.some((o) => o.correct)) return null;
    return { type: "attribute", word_id: byTerm.get(cleanStr(a.word)?.toLowerCase() ?? "") ?? null, prompt_en, prompt_vi, options, explain_vi: cleanStr(a.explain_vi) };
  }).filter(Boolean).slice(0, 2);

  let dialogue = null;
  const dl = parsed.dialogue;
  if (dl && Array.isArray(dl.lines)) {
    const lines = dl.lines.map((l) => { const en = cleanStr(l.en), vi = cleanStr(l.vi); return en && vi ? { who: l.who === "b" ? "b" : "a", en, vi } : null; }).filter(Boolean).slice(0, 6);
    if (lines.length) dialogue = { type: "dialogue", title_en: cleanStr(dl.title_en) ?? titleEn, lines };
  }

  const voice = (Array.isArray(parsed.voice_qa) ? parsed.voice_qa : []).map((v) => {
    const q = cleanStr(v.question_en), qv = cleanStr(v.question_vi);
    if (!q || !qv) return null;
    return { type: "voice_qa", question_en: q, question_vi: qv, key_points: normStrings(v.key_points, 5), sample_answer_en: cleanStr(v.sample_answer_en) };
  }).filter(Boolean).slice(0, 2);

  if (!attribute.length && !voice.length) throw new Error("empty generation");

  const goal = await groq(
    [{ role: "system", content: "Reply ONLY valid JSON." },
     { role: "user", content: `One short learning-goal line for the topic "${titleEn}" for a Vietnamese software engineer. JSON: {"goal_en":"...","goal_vi":"..."}` }], 200
  ).catch(() => ({}));

  return [
    { type: "cover", hero_word_id: heroId, goal_en: cleanStr(goal.goal_en), goal_vi: cleanStr(goal.goal_vi) },
    ...vocabSlides,
    ...exampleSlides,
    ...attribute,
    ...(dialogue ? [dialogue] : []),
    ...voice,
    { type: "recap" },
  ];
}

// ---- main ----
// Remove stale rows from the previous 30-day (course-1) build.
await db.from("topic_days").delete().gt("day_no", 20);

let days = DAYS;
if (ONLY_DAY) days = days.filter(([d]) => d === ONLY_DAY);
else if (LIMIT) days = days.slice(0, LIMIT);
if (!FORCE && !ONLY_DAY) {
  // Skip only days whose stored row already matches the intended lesson;
  // regenerate legacy/mismatched rows (presence alone is not "done").
  const { data: existing } = await db.from("topic_days").select("day_no,lesson_id");
  const okById = new Map((existing ?? []).map((r) => [r.day_no, r.lesson_id]));
  days = days.filter(([d, lid]) => okById.get(d) !== lid);
}
console.error(`days to generate: ${days.map(([d]) => d).join(", ") || "(none)"}`);

let ok = 0, failed = 0;
for (const [day_no, lesson_id, title_en] of days) {
  try {
    const { data: lesson } = await db.from("lessons").select("id,title_vi").eq("id", lesson_id).maybeSingle();
    if (!lesson) throw new Error(`lesson ${lesson_id} not found`);
    const { data: words } = await db.from("words").select("id,term,meaning_vi,example_en,image_url").eq("lesson_id", lesson_id).order("id");
    if (!words?.length) throw new Error(`no words for ${lesson_id}`);
    const slides = await buildDeck(title_en, words);
    const { error } = await db.from("topic_days").upsert({
      day_no, lesson_id, title_en, title_vi: lesson.title_vi, slides, model: GROQ_MODEL, generated_at: new Date().toISOString(),
    }, { onConflict: "day_no" });
    if (error) throw new Error(error.message);
    ok++; console.error(`  ✓ day ${day_no} (${title_en}) — ${slides.length} slides`);
  } catch (e) { failed++; console.error(`  ✗ day ${day_no}: ${e.message}`); }
  await sleep(300);
}
console.error(`\nDone. generated: ${ok}, failed: ${failed}.`);
