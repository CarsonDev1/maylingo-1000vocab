// Generates the web app's tab icons from the Maylingo mascot.
//  - src/app/icon.svg      : scalable favicon (modern browsers prefer this)
//  - src/app/favicon.ico   : mascot at 16/32/48 (PNG-in-ICO) — /favicon.ico fallback
//  - src/app/apple-icon.png: 180px white-bg icon for iOS "add to home screen"
// Run from the mobile/ folder so `sharp` resolves: `node scripts/make-favicon.mjs`
import sharp from "sharp";
import { writeFileSync, copyFileSync } from "node:fs";

const SRC = "D:/Carson Upgrade/1000vocab/public/mascot.svg";
const APP = "D:/Carson Upgrade/1000vocab/src/app";

// --- favicon.ico (multi-size PNG-in-ICO) ---
const sizes = [16, 32, 48];
const pngs = [];
for (const size of sizes) {
  const buf = await sharp(SRC, { density: 1200 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  pngs.push({ size, buf });
}

const count = pngs.length;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type = icon
header.writeUInt16LE(count, 4); // image count

const entries = [];
let offset = 6 + count * 16;
for (const { size, buf } of pngs) {
  const e = Buffer.alloc(16);
  e.writeUInt8(size >= 256 ? 0 : size, 0); // width
  e.writeUInt8(size >= 256 ? 0 : size, 1); // height
  e.writeUInt8(0, 2); // palette colours
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(buf.length, 8); // image byte size
  e.writeUInt32LE(offset, 12); // offset from file start
  entries.push(e);
  offset += buf.length;
}

writeFileSync(`${APP}/favicon.ico`, Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]));

// --- icon.svg (scalable) ---
copyFileSync(SRC, `${APP}/icon.svg`);

// --- apple-icon.png (opaque white bg; iOS icons can't have alpha) ---
await sharp(SRC, { density: 1200 })
  .resize(180, 180, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .flatten({ background: "#ffffff" })
  .png()
  .toFile(`${APP}/apple-icon.png`);

// --- PWA manifest icons (Android/Chrome/desktop install) -> public/icon-{192,512}.png ---
const PUB = "D:/Carson Upgrade/1000vocab/public";
for (const size of [192, 512]) {
  await sharp(SRC, { density: 1200 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(`${PUB}/icon-${size}.png`);
}

console.log("wrote src/app/{favicon.ico,icon.svg,apple-icon.png} + public/icon-{192,512}.png from mascot.svg");
