/**
 * Color palette mirroring the web app's green Duolingo-style theme.
 * green = brand/secondary CTA, sky = primary action, orange = XP/streak,
 * rose = errors. Level ramp (memory levels 1..5) = red -> green.
 */
export const C = {
  // brand / states
  green: "#22c55e", // green-500
  green600: "#16a34a",
  green700: "#15803d",
  greenSoft: "rgba(34,197,94,0.12)",
  sky: "#38bdf8", // sky-400 (primary)
  sky500: "#0ea5e9",
  skySoft: "rgba(56,189,248,0.12)",
  orange: "#fb923c", // orange-400
  orange500: "#f97316",
  orangeSoft: "rgba(251,146,60,0.12)",
  rose: "#f43f5e", // rose-500
  rose600: "#e11d48",
  roseSoft: "rgba(244,63,94,0.12)",
  amber: "#f59e0b",

  // surfaces (light app)
  white: "#ffffff",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  border: "#e5e7eb",
  text: "#404040", // neutral-700
  textDark: "#171717",
  muted: "#64748b", // slate-500

  // dark session overlay
  neutral900: "#171717",
  neutral800: "#262626",
  neutral700: "#404040",
  neutral400: "#a3a3a3",
  neutral300: "#d4d4d4",
} as const;

/** Memory level 1..5 -> color (index 0 = level 1). red -> orange -> yellow -> lime -> green. */
export const LEVEL_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

/** Short Vietnamese labels for memory levels 0..5 (0 = "Tất cả"). */
export const LEVEL_LABELS = ["Tất cả", "Mới", "Đang nhớ", "Khá", "Tốt", "Thành thạo"];

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
