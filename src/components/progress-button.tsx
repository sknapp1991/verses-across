"use client";
/**
 * Top-bar Progress button (desktop; phones have a tile in the More sheet): a trophy, with a ring around it showing today's goal when one is set, and
 * the reader's level (1–60) in the corner.
 */
import { ProgressGlyph } from "./trophy-icon";
import { isShowing, togglePanel, useUi } from "@/lib/ui-store";
import { useSettings } from "@/lib/settings";
import { useLevel } from "./progress-panel";

export function ProgressButton() {
  const u = useUi();
  const { xrefMode } = useSettings();
  // the ring: progress to the next level, like the XP bar in the panel (my brother's ticket cd8f20f6; it was today's goal)
  const { level, progress, title, rank, ranks } = useLevel();
  const ring = level >= 60 ? 1 : progress;
  const on = isShowing(u, xrefMode, "progress");
  const c = 2 * Math.PI * 19;
  const goal = `, ${title}${ranks > 1 ? ` rank ${rank} of ${ranks}` : ""}, ${Math.round(ring * 100)}% to the next level`;
  return (
    <button
      type="button"
      onClick={() => togglePanel("progress")}
      aria-label={`Progress, level and badges (level ${level}${goal})`}
      aria-pressed={on}
      title={`Progress, level and badges · Level ${level}`}
      className={`relative hidden h-11 w-11 items-center justify-center rounded-lg hover:bg-raised hover:text-ink desk:flex desk:border desk:border-line ${
        on ? "bg-accent-soft text-accent" : "text-muted desk:bg-raised"
      }`}
    >
      <ProgressGlyph size={20} />
      {ring > 0 && (
        <svg viewBox="0 0 44 44" aria-hidden className="pointer-events-none absolute inset-0 -rotate-90">
          <circle cx="22" cy="22" r="19" fill="none" stroke="var(--line)" strokeWidth="2" />
          <circle cx="22" cy="22" r="19" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${c * ring} ${c}`} />
        </svg>
      )}
      <span
        aria-hidden
        className="absolute -bottom-0.5 -right-0.5 min-w-[1.1rem] rounded-full border border-panel bg-accent px-1 text-center text-[10px] font-bold leading-4 tabular-nums text-accent-ink"
      >
        {level}
      </span>
    </button>
  );
}
