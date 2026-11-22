"use client";
/**
 * The streak icon grows with the streak (hub a3b33a99): an unlit campfire (no streak yet), a spark, a small flame,
 * a flame, a bigger flame, a big flame, and a trophy at 30 days. A hidden treat: tapping the icon in Progress
 * changes the kind of growth (music, a rainbow, a tree, a chicken), remembered on this device; everywhere else it
 * just shows. Only long-supported emoji (no Unicode 13+: they are empty boxes on Windows 10 and older Android).
 */
import { useSyncExternalStore } from "react";

/** `dim`: not lit yet (no streak). `scale`: grows within the same emoji. */
type Stage = { icon: string; scale: number; dim?: boolean };
const THEMES: { id: string; name: string; stages: Stage[] }[] = [
  {
    id: "fire",
    name: "Fire",
    stages: [
      { icon: "🔥", scale: 0.8, dim: true },
      { icon: "✨", scale: 0.9 },
      { icon: "🔥", scale: 0.7 },
      { icon: "🔥", scale: 0.9 },
      { icon: "🔥", scale: 1.1 },
      { icon: "🔥", scale: 1.3 },
      { icon: "🏆", scale: 1.15 },
    ],
  },
  {
    id: "music",
    name: "Music",
    stages: [
      { icon: "🎵", scale: 0.8, dim: true },
      { icon: "🎵", scale: 0.8 },
      { icon: "🎵", scale: 1 },
      { icon: "🎶", scale: 0.9 },
      { icon: "🎶", scale: 1.15 },
      { icon: "🎼", scale: 1.15 },
      { icon: "🎹", scale: 1.2 },
    ],
  },
  {
    id: "rainbow",
    name: "Rainbow",
    stages: [
      { icon: "☁️", scale: 0.9, dim: true },
      { icon: "💧", scale: 0.9 },
      { icon: "🌦️", scale: 1 },
      { icon: "🌈", scale: 0.7 },
      { icon: "🌈", scale: 0.9 },
      { icon: "🌈", scale: 1.1 },
      { icon: "🌈", scale: 1.3 },
    ],
  },
  {
    id: "tree",
    name: "Tree",
    stages: [
      { icon: "🌰", scale: 0.8, dim: true },
      { icon: "🌰", scale: 0.9 },
      { icon: "🌱", scale: 0.9 },
      { icon: "🌿", scale: 1 },
      { icon: "🌳", scale: 0.8 },
      { icon: "🌳", scale: 1.05 },
      { icon: "🌳", scale: 1.3 },
    ],
  },
  {
    id: "chicken",
    name: "Chicken",
    stages: [
      { icon: "🥚", scale: 0.8, dim: true },
      { icon: "🥚", scale: 0.95 },
      { icon: "🐣", scale: 1 },
      { icon: "🐥", scale: 1 },
      { icon: "🐤", scale: 1.05 },
      { icon: "🐔", scale: 1.15 },
      { icon: "🐓", scale: 1.25 },
    ],
  },
];
/** Days in a row for each stage: none yet, 1, 2–3, 4–6, 7–13, 14–29, 30 and up. */
const AT = [0, 1, 2, 4, 7, 14, 30];
const stageOf = (days: number) => AT.reduce((s, d, i) => (days >= d ? i : s), 0);

const KEY = "va-streak-theme:v1";
const subs = new Set<() => void>();
function themeId(): string {
  try {
    return localStorage.getItem(KEY) ?? "fire";
  } catch {
    return "fire";
  }
}
function setTheme(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage blocked: this visit only */
  }
  subs.forEach((f) => f());
}
const useTheme = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      // another tab changed it
      const onStorage = (e: StorageEvent) => e.key === KEY && f();
      window.addEventListener("storage", onStorage);
      return () => {
        subs.delete(f);
        window.removeEventListener("storage", onStorage);
      };
    },
    themeId,
    () => "fire",
  );

/** The icon for a streak of `days`. `changeable`: a tap moves to the next kind of growth (Progress only). */
export function StreakIcon({ days, changeable = false, className = "" }: { days: number; changeable?: boolean; className?: string }) {
  const id = useTheme();
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const s = theme.stages[stageOf(days)];
  const glyph = (
    <span
      aria-hidden
      className={`inline-block leading-none ${s.dim ? "opacity-40 grayscale" : ""}`}
      style={{ transform: s.scale !== 1 ? `scale(${s.scale})` : undefined }}
    >
      {s.icon}
    </span>
  );
  if (!changeable)
    return (
      <span className={className}>
        {glyph}
        <span className="sr-only">streak</span>
      </span>
    );
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  return (
    <button
      type="button"
      onClick={() => setTheme(next.id)}
      title={`${theme.name} · tap for ${next.name.toLowerCase()}`}
      aria-label={`Streak icon: ${theme.name}. Change to ${next.name}`}
      className={`grid min-h-11 min-w-11 place-items-center rounded-lg transition-transform focus-visible:outline-2 focus-visible:outline-accent active:scale-90 ${className}`}
    >
      {glyph}
    </button>
  );
}
