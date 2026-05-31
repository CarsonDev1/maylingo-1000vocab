"use client";

// Tiny audio player with a cache so repeated plays are instant.
const cache = new Map<string, HTMLAudioElement>();

export function playAudio(url?: string | null, rate = 1) {
  if (!url || typeof window === "undefined") return;
  let el = cache.get(url);
  if (!el) {
    el = new Audio(url);
    el.preload = "auto";
    cache.set(url, el);
  }
  try {
    el.currentTime = 0;
    el.playbackRate = rate;
    void el.play();
  } catch {
    /* autoplay may be blocked until a user gesture */
  }
}

export function preloadAudio(urls: (string | null | undefined)[]) {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    if (url && !cache.has(url)) {
      const el = new Audio(url);
      el.preload = "auto";
      cache.set(url, el);
    }
  }
}
