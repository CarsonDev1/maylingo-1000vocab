// Rasterizes the web app's mascot.svg into PNGs used by the mobile app:
//  - assets/mascot.png : transparent 512px badge, used as the in-app logo
//  - assets/icon.png   : opaque 1024px (white bg), used as the app icon (iOS icons can't have alpha)
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "D:/Carson Upgrade/1000vocab/public/mascot.svg";
const OUT = "D:/Carson Upgrade/1000vocab/mobile/assets";
mkdirSync(OUT, { recursive: true });

await sharp(SRC, { density: 1200 })
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(`${OUT}/mascot.png`);

await sharp(SRC, { density: 1200 })
  .resize(880, 880, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 72, bottom: 72, left: 72, right: 72, background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .flatten({ background: "#ffffff" })
  .png()
  .toFile(`${OUT}/icon.png`);

console.log("wrote assets/mascot.png (512, transparent) and assets/icon.png (1024, white bg)");
