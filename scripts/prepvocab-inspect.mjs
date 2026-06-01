// Inspect current Supabase state before importing prepvocab. Read-only.
import pg from "pg";
import { loadEnv, getServiceClient } from "./_supabase.mjs";
loadEnv();

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: 5432,
  user: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const q = async (sql) => (await client.query(sql)).rows;

console.log("=== courses ===");
console.table(await q("select id, title_vi, title_en from courses order by id"));

const slugCol = await q(
  "select column_name from information_schema.columns where table_schema='public' and table_name='courses' and column_name='slug'"
);
console.log("courses.slug column exists?", slugCol.length > 0);

const [{ max: maxLesson }] = await q("select coalesce(max(id),0) max from lessons");
const [{ max: maxWord }] = await q("select coalesce(max(id),0) max from words");
const [{ count: wordCount }] = await q("select count(*) from words");
const [{ count: lessonCount }] = await q("select count(*) from lessons");
console.log("max lesson id:", maxLesson, "| lesson count:", lessonCount);
console.log("max word id:", maxWord, "| word count:", wordCount);

const clash12k = await q("select id from lessons where id between 12600 and 12700 order by id");
console.log("existing lesson ids in 12600-12700 (PrepEdu unit range):", clash12k.map((r) => r.id));
const clash9 = await q("select count(*) from words where id >= 900000");
console.log("existing words with id >= 900000:", clash9[0].count);

await client.end();

// storage bucket check
const sb = getServiceClient();
const { data: buckets } = await sb.storage.listBuckets();
console.log("storage buckets:", buckets?.map((b) => `${b.id}(public=${b.public})`).join(", "));
const { data: imgRoot } = await sb.storage.from("images").list("", { limit: 5 });
console.log("images bucket root sample:", imgRoot?.map((o) => o.name).join(", "));
const { data: prepDir } = await sb.storage.from("images").list("prepvocab", { limit: 5 });
console.log("images/prepvocab/ existing:", prepDir?.length ?? 0, "objects");
