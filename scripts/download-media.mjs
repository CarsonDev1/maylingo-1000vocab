// Download every word's image + audio from the extracted JSON into media/.
// Node 22 (global fetch). Concurrency-limited, retrying, resumable (skips existing).
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data", "mochidemy_1000_vocab.json");
const IMG_DIR = join(ROOT, "media", "images");
const AUD_DIR = join(ROOT, "media", "audio");
for (const d of [IMG_DIR, AUD_DIR]) mkdirSync(d, { recursive: true });

const CONCURRENCY = 12;
const RETRIES = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extFromUrl(u, fallback) {
  try { const p = new URL(u).pathname; const m = p.match(/\.([a-z0-9]{2,5})$/i); return m ? m[1].toLowerCase() : fallback; }
  catch { return fallback; }
}

async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 0) return "skip";
  for (let i = 0; i < RETRIES; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://learn.mochidemy.com/" } });
      if (!res.ok) { await sleep(400 * (i + 1)); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) { await sleep(400); continue; }
      writeFileSync(dest, buf);
      return "ok";
    } catch { await sleep(500 * (i + 1)); }
  }
  return "fail";
}

const data = JSON.parse(readFileSync(DATA, "utf8"));
const tasks = [];
for (const L of data.lessons) {
  for (const w of L.words) {
    if (w.picture) {
      const ext = extFromUrl(w.picture, "png");
      tasks.push({ kind: "img", id: w.id, term: w.term, url: w.picture, file: join(IMG_DIR, `${w.id}.${ext}`), rel: `images/${w.id}.${ext}` });
    }
    if (w.audio_word) {
      const ext = extFromUrl(w.audio_word, "mp3");
      tasks.push({ kind: "aud", id: w.id, term: w.term, url: w.audio_word, file: join(AUD_DIR, `${w.id}.${ext}`), rel: `audio/${w.id}.${ext}` });
    }
  }
}

console.error(`Total media to fetch: ${tasks.length} (images+audio) for ${data.total_words} words`);
const manifest = {};
let done = 0, ok = 0, skip = 0, fail = 0;
const failures = [];

let idx = 0;
async function worker() {
  while (idx < tasks.length) {
    const t = tasks[idx++];
    const r = await download(t.url, t.file);
    done++;
    if (r === "ok") ok++; else if (r === "skip") skip++; else { fail++; failures.push(t); }
    const m = (manifest[t.id] ||= { id: t.id, term: t.term });
    if (t.kind === "img") { m.image_url = t.url; m.image_file = r === "fail" ? null : t.rel; }
    else { m.audio_url = t.url; m.audio_file = r === "fail" ? null : t.rel; }
    if (done % 100 === 0) console.error(`  ${done}/${tasks.length}  ok=${ok} skip=${skip} fail=${fail}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

writeFileSync(join(ROOT, "media", "manifest.json"), JSON.stringify(Object.values(manifest), null, 2), "utf8");
if (failures.length) writeFileSync(join(ROOT, "media", "failures.json"), JSON.stringify(failures, null, 2), "utf8");
console.error(`\nDONE. ok=${ok} skip=${skip} fail=${fail}. Manifest: media/manifest.json`);
if (failures.length) console.error(`Failures logged: media/failures.json (re-run to retry)`);
