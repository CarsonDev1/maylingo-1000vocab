// Import the PrepEdu "prepvocab" course into Supabase. Idempotent (safe to re-run).
//   1) pg: add courses.slug column, label course 1 = "1000vocab", upsert course 2 = "prepvocab"
//   2) storage: upload 499 illustration images to images/prepvocab/<file>
//   3) supabase-js: upsert 20 lessons + 500 words (US phonetic -> phonetic_us, audio_url=null)
// Source data: C:\temp\prep-out\{vocab.json, images\}
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { loadEnv, getServiceClient, pool } from "./_supabase.mjs";

loadEnv();
const SRC = "C:\\temp\\prep-out";
const IMG_DIR = join(SRC, "images");
const lessons = JSON.parse(readFileSync(join(SRC, "vocab.json"), "utf8"));

const COURSE_ID = 2;
const COURSE_SLUG = "prepvocab";
const COURSE_TITLE_VI = "PrepTalk - Flashcard 20 chủ đề giao tiếp thường gặp";
const COURSE_TITLE_EN = "PrepVocab";
const CT = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

// ---------- 1) schema + courses via direct Postgres ----------
const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST, port: 5432, user: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD, database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query("alter table public.courses add column if not exists slug text");
await client.query("create unique index if not exists courses_slug_key on public.courses(slug)");
await client.query("update public.courses set slug='1000vocab' where id=1 and slug is null");
await client.query(
  `insert into public.courses (id, slug, title_vi, title_en) values ($1,$2,$3,$4)
   on conflict (id) do update set slug=excluded.slug, title_vi=excluded.title_vi, title_en=excluded.title_en`,
  [COURSE_ID, COURSE_SLUG, COURSE_TITLE_VI, COURSE_TITLE_EN]
);
await client.query("notify pgrst, 'reload schema'"); // let PostgREST pick up the new column
const courseRows = (await client.query("select id, slug, title_vi from public.courses order by id")).rows;
console.error("courses now:", JSON.stringify(courseRows));
await client.end();

// ---------- 2) upload images to Storage (images/prepvocab/) ----------
const sb = getServiceClient();
const files = [...new Set(lessons.flatMap((L) => L.words.map((w) => w.image).filter(Boolean)))];
console.error(`uploading ${files.length} images ...`);
const urlByFile = {};
let up = 0, failUp = 0;
await pool(files, 8, async (file) => {
  const abs = join(IMG_DIR, file);
  if (!existsSync(abs)) { failUp++; console.error("  MISSING file:", file); return; }
  const ext = file.split(".").pop().toLowerCase();
  const path = `prepvocab/${file}`;
  const { error } = await sb.storage.from("images").upload(path, readFileSync(abs), {
    contentType: CT[ext] || "application/octet-stream", upsert: true,
  });
  if (error) { failUp++; console.error("  upload fail", file, error.message); return; }
  urlByFile[file] = sb.storage.from("images").getPublicUrl(path).data.publicUrl;
  if (++up % 100 === 0) console.error(`  uploaded ${up}/${files.length}`);
});
console.error(`images uploaded: ${up}, failed: ${failUp}`);

// ---------- 3) lessons + words via supabase-js upsert ----------
const lessonRows = lessons.map((L) => ({
  id: L.unit, course_id: COURSE_ID, sort: L.lesson_no,
  title_vi: L.title, title_en: null, code: `prep-s${L.section}`,
}));
{
  const { error } = await sb.from("lessons").upsert(lessonRows);
  if (error) throw error;
  console.error(`lessons upserted: ${lessonRows.length}`);
}

const wordRows = [];
for (const L of lessons) {
  for (const w of L.words) {
    wordRows.push({
      id: 900000 + L.lesson_no * 1000 + w.no, // deterministic, collision-free, idempotent
      lesson_id: L.unit,
      term: w.term,
      pos: w.pos ? w.pos.toLowerCase() : null,
      phonetic_uk: null,
      phonetic_us: w.phonetic || null, // PrepEdu phonetics are US
      meaning_vi: w.meaning_vi || null,
      meaning_en: null, meaning_ja: null, meaning_ko: null, meaning_th: null, meaning_zh: null,
      example_en: w.example || null,
      example_vi: null,
      audio_url: null,            // to be filled later (Groq TTS)
      audio_sentence_url: null,
      image_url: w.image ? urlByFile[w.image] || null : null,
    });
  }
}
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
let n = 0;
for (const batch of chunk(wordRows, 200)) {
  const { error } = await sb.from("words").upsert(batch);
  if (error) throw error;
  n += batch.length;
  console.error(`  words upserted: ${n}/${wordRows.length}`);
}

const withImg = wordRows.filter((w) => w.image_url).length;
console.error(`\nDONE. course=${COURSE_ID}(${COURSE_SLUG}) lessons=${lessonRows.length} words=${wordRows.length} withImage=${withImg}`);
