import type { MetadataRoute } from "next";

// Web App Manifest — lets the site install as a PWA ("Add to Home Screen").
// Next auto-serves this at /manifest.webmanifest and adds <link rel="manifest">.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maylingo — Học 1000 từ vựng",
    short_name: "Maylingo",
    description: "Học, luyện tập và ghi nhớ 1000 từ vựng tiếng Anh.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#22c55e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
