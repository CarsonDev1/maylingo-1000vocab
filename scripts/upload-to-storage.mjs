// Upload downloaded media (media/images, media/audio) to Supabase Storage,
// recording public URLs back into media/manifest.json. Resumable.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { getServiceClient, ROOT, pool } from "./_supabase.mjs";

const supabase = getServiceClient();
const manifestPath = join(ROOT, "media", "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const CT = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".mp3": "audio/mpeg" };

async function ensureBuckets() {
  for (const id of ["images", "audio"]) {
    const { error } = await supabase.storage.createBucket(id, { public: true });
    if (error && !/already exists/i.test(error.message)) console.error(`bucket ${id}:`, error.message);
  }
}

async function uploadOne(entry, kind) {
  const fileRel = kind === "img" ? entry.image_file : entry.audio_file;
  const urlKey = kind === "img" ? "image_public_url" : "audio_public_url";
  const bucket = kind === "img" ? "images" : "audio";
  if (!fileRel) return "nofile";
  if (entry[urlKey]) return "skip"; // already uploaded
  const abs = join(ROOT, "media", fileRel);
  if (!existsSync(abs)) return "missing";
  const ext = extname(abs).toLowerCase();
  const path = `${entry.id}${ext}`;
  const body = readFileSync(abs);
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: CT[ext] || "application/octet-stream",
    upsert: true,
  });
  if (error) { console.error(`upload ${bucket}/${path}:`, error.message); return "fail"; }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  entry[urlKey] = data.publicUrl;
  return "ok";
}

await ensureBuckets();

const counters = { ok: 0, skip: 0, fail: 0, nofile: 0, missing: 0 };
let done = 0;
await pool(manifest, 8, async (entry) => {
  for (const kind of ["img", "aud"]) {
    const r = await uploadOne(entry, kind);
    counters[r] = (counters[r] || 0) + 1;
  }
  done++;
  if (done % 100 === 0) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8"); // checkpoint
    console.error(`  ${done}/${manifest.length}  ${JSON.stringify(counters)}`);
  }
});

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
console.error(`DONE. ${JSON.stringify(counters)}`);
console.error("Public URLs written back to media/manifest.json. Now run: node scripts/seed-supabase.mjs");
