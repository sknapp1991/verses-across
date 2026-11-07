"use client";
/**
 * Top-bar Progress button: a trophy, with a ring around it showing today's goal when one is set, and
 * the reader's level (1–60) in the corner.
 */
import { isShowing, togglePanel, useUi } from "@/lib/ui-store";
import { useSettings } from "@/lib/settings";
import { TrophyIcon } from "./icons";
import { useGoalRing, useLevel } from "./progress-panel";

export function ProgressButton() {
  const u = useUi();
  const { xrefMode } = useSettings();
  const ring = useGoalRing();
  const { level } = useLevel();
  const on = isShowing(u, xrefMode, "progress");
  const c = 2 * Math.PI * 19;
  const goal = ring == null ? "" : `, today's goal ${Math.round(ring * 100)}%`;
  return (
    <button
      type="button"
      onClick={() => togglePanel("progress")}
      aria-label={`Progress, level and badges (level ${level}${goal})`}
      aria-pressed={on}
      title={`Progress, level and badges · Level ${level}`}
      className={`relative hidden h-11 w-11 items-center justify-center rounded-lg hover:bg-raised hover:text-ink min-[380px]:flex desk:border desk:border-line ${
        on ? "bg-accent-soft text-accent" : "text-muted desk:bg-raised"
      }`}
    >
      <TrophyIcon />
      {ring != null && ring > 0 && (
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
