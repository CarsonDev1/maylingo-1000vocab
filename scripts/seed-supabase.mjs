// Seed courses/lessons/words into Supabase. Uses Storage public URLs from the
// manifest when available, otherwise falls back to the original source URLs.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getServiceClient, ROOT } from "./_supabase.mjs";

const supabase = getServiceClient();
const data = JSON.parse(readFileSync(join(ROOT, "data", "mochidemy_1000_vocab.json"), "utf8"));

const manifestPath = join(ROOT, "media", "manifest.json");
const media = {};
if (existsSync(manifestPath)) {
  for (const m of JSON.parse(readFileSync(manifestPath, "utf8"))) media[m.id] = m;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// 1) course
{
  const { error } = await supabase.from("courses").upsert({
    id: data.course?.id ?? 1,
    title_vi: data.course?.title_vi ?? "1000 Từ Cơ Bản",
    title_en: data.course?.title_en ?? "1000 Basic Words",
  });
  if (error) throw error;
  console.error("course upserted");
}

// 2) lessons
const lessonRows = data.lessons.map((L) => ({
  id: L.lesson_id,
  course_id: data.course?.id ?? 1,
  sort: L.lesson_no,
  title_en: L.title_en,
  title_vi: L.title_vi,
  code: L.code,
}));
{
  const { error } = await supabase.from("lessons").upsert(lessonRows);
  if (error) throw error;
  console.error(`lessons upserted: ${lessonRows.length}`);
}

// 3) words (dedupe by id — a few words appear in more than one lesson)
const wordMap = new Map();
for (const L of data.lessons) {
  for (const w of L.words) {
    const m = media[w.id] || {};
    wordMap.set(w.id, {
      id: w.id,
      lesson_id: L.lesson_id,
      term: w.term,
      pos: w.pos,
      phonetic_uk: w.phonetic_uk,
      phonetic_us: w.phonetic_us,
      meaning_vi: w.meaning_vi,
      meaning_en: w.meaning_en,
      meaning_ja: w.meaning_ja,
      meaning_ko: w.meaning_ko,
      meaning_th: w.meaning_th,
      meaning_zh: w.meaning_zh,
      example_en: w.example_en,
      example_vi: w.example_vi,
      audio_url: m.audio_public_url || w.audio_word || null,
      audio_sentence_url: null,
      image_url: m.image_public_url || w.picture || null,
    });
  }
}
const wordRows = [...wordMap.values()];
let n = 0;
for (const batch of chunk(wordRows, 200)) {
  const { error } = await supabase.from("words").upsert(batch);
  if (error) throw error;
  n += batch.length;
  console.error(`  words upserted: ${n}/${wordRows.length}`);
}

console.error(`\nDONE. course=1 lessons=${lessonRows.length} words=${wordRows.length}`);
const usingStorage = wordRows.filter((w) => w.image_url && w.image_url.includes("supabase")).length;
console.error(`Words using Supabase Storage image URLs: ${usingStorage} (rest fall back to source URLs).`);
