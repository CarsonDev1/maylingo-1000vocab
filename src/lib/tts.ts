/** Browser text-to-speech (Web Speech API). No-ops gracefully where unsupported. */
export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakText(text: string, opts: { lang?: string; onEnd?: () => void } = {}): void {
  if (!isTtsSupported() || !text.trim()) {
    opts.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel(); // stop anything already speaking
  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts.lang ?? "en-US";
  u.rate = 0.95;
  if (opts.onEnd) u.onend = () => opts.onEnd!();
  synth.speak(u);
}
