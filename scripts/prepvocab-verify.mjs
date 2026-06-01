// Verify prepvocab import. Read-only.
import pg from "pg";
import { loadEnv } from "./_supabase.mjs";
loadEnv();
const c = new pg.Client({
  host: process.env.SUPABASE_DB_HOST, port: 5432, user: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD, database: "postgres", ssl: { rejectUnauthorized: false },
});
await c.connect();
const q = async (s, p) => (await c.query(s, p)).rows;

console.log("=== courses ===");
console.table(await q("select id, slug, title_vi from courses order by id"));

const cnt = async (label, sql, p) => console.log(label, (await q(sql, p))[0].count);
console.log("\n=== prepvocab (course 2) ===");
await cnt("lessons:", "select count(*) from lessons where course_id=2");
await cnt("words:  ", "select count(*) from words w join lessons l on w.lesson_id=l.id where l.course_id=2");
await cnt("words w/ image:", "select count(*) from words w join lessons l on w.lesson_id=l.id where l.course_id=2 and image_url is not null");
await cnt("words w/ phonetic_us:", "select count(*) from words w join lessons l on w.lesson_id=l.id where l.course_id=2 and phonetic_us is not null");
await cnt("words missing image (expect 1):", "select count(*) from words w join lessons l on w.lesson_id=l.id where l.course_id=2 and image_url is null");

console.log("\n=== course 1 (1000vocab) integrity — must be unchanged ===");
await cnt("lessons (expect 100):", "select count(*) from lessons where course_id=1");
await cnt("words (expect 1000):  ", "select count(*) from words w join lessons l on w.lesson_id=l.id where l.course_id=1");

console.log("\n=== sample words (lesson 2 / unit 12682) ===");
console.table(await q("select id, term, pos, phonetic_us, meaning_vi, left(example_en,28) example, (image_url is not null) img from words where lesson_id=12682 order by id limit 4"));

console.log("\n=== the one word with no image ===");
console.table(await q("select w.id, term, meaning_vi from words w join lessons l on w.lesson_id=l.id where l.course_id=2 and image_url is null"));

const urls = await q("select image_url from words w join lessons l on w.lesson_id=l.id where l.course_id=2 and image_url is not null order by random() limit 3");
await c.end();

console.log("\n=== image URL reachability (3 random) ===");
for (const { image_url } of urls) {
  try {
    const r = await fetch(image_url, { method: "HEAD" });
    console.log(`  [${r.status}] ${r.headers.get("content-type")}  ${image_url}`);
  } catch (e) { console.log("  ERR", image_url, e.message); }
}
