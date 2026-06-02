import type { MetadataRoute } from "next";

// Web App Manifest — lets the site install as a PWA ("Add to Home Screen").
// Next auto-serves this at /manifest.webmanifest and adds <link rel="manifest">.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maylingo — Learn 1000 Words",
    short_name: "Maylingo",
    description: "Learn, practice and memorize 1000 English words.",
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
