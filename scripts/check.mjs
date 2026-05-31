// Connectivity check: do the tables + storage buckets exist?
import { getServiceClient } from "./_supabase.mjs";
const db = getServiceClient();

for (const t of ["courses", "lessons", "words", "user_word_progress"]) {
  const { error, count } = await db.from(t).select("*", { count: "exact", head: true });
  if (error) console.log(`table ${t}: MISSING (${error.message})`);
  else console.log(`table ${t}: OK (rows=${count})`);
}
const { data: buckets, error: be } = await db.storage.listBuckets();
if (be) console.log("buckets: error", be.message);
else console.log("buckets:", (buckets || []).map((b) => `${b.name}(${b.public ? "public" : "private"})`).join(", ") || "none");
