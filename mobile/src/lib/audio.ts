/**
 * Audio playback for the mobile app, mirroring the web app's `audio.ts`:
 * - playAudio(url, rate?) plays a remote word/sentence pronunciation (cached
 *   per-URL, with optional slow playback rate).
 * - playSfx(kind) plays a bundled correct/incorrect/finish sound effect.
 *
 * Uses expo-audio (SDK 56). Players are reused; remote players are capped and
 * evicted to avoid unbounded growth during long sessions.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

let configured = false;
function ensureMode() {
  if (configured) return;
  configured = true;
  // Play through the iOS mute switch so pronunciation/SFX are always audible.
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
}

// --- remote word/sentence audio (cached by URL) ---------------------------
const cache = new Map<string, AudioPlayer>();
const MAX_CACHE = 48;

export function playAudio(url?: string | null, rate = 1) {
  if (!url) return;
  ensureMode();
  try {
    let player = cache.get(url);
    if (!player) {
      if (cache.size >= MAX_CACHE) {
        const oldest = cache.keys().next().value as string | undefined;
        if (oldest) {
          cache.get(oldest)?.remove();
          cache.delete(oldest);
        }
      }
      player = createAudioPlayer(url);
      cache.set(url, player);
    }
    player.setPlaybackRate(rate);
    void player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // ignore playback errors (e.g. unreachable url)
  }
}

export function preloadAudio(urls: (string | null | undefined)[]) {
  ensureMode();
  for (const url of urls) {
    if (!url || cache.has(url) || cache.size >= MAX_CACHE) continue;
    try {
      cache.set(url, createAudioPlayer(url));
    } catch {
      // ignore
    }
  }
}

// --- bundled sound effects --------------------------------------------------
type Sfx = "correct" | "incorrect" | "finish";
const SFX_SOURCES: Record<Sfx, number> = {
  correct: require("../../assets/sfx/correct.mp3"),
  incorrect: require("../../assets/sfx/incorrect.mp3"),
  finish: require("../../assets/sfx/finish.mp3"),
};
const sfxPlayers: Partial<Record<Sfx, AudioPlayer>> = {};

export function playSfx(kind: Sfx) {
  ensureMode();
  try {
    let player = sfxPlayers[kind];
    if (!player) {
      player = createAudioPlayer(SFX_SOURCES[kind]);
      sfxPlayers[kind] = player;
    }
    void player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // ignore
  }
}
