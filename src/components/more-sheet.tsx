"use client";
/**
 * Phone: the sheet behind the ⋯ button in the top bar. Two things in one place, so the bar can stay
 * at four buttons:
 *   – the study tools that have no button of their own on a small screen, as tiles at the top
 *     (Progress, Plans & Goals, Study groups, Ask AI, Read together; Cross references is under "Tap a verse");
 *   – every reading setting, in sections: Text, Tap a verse, Reading, Versions & languages, More.
 * openSheet("text") / openSheet("versions") open it scrolled to that section (the Aa button and the
 * versions chip under the chapter name).
 */
import { useEffect } from "react";
import Link from "next/link";
import { closeSheet, openPanel, useUi, type PanelId } from "@/lib/ui-store";
import { useSettings } from "@/lib/settings";
import { openAi, useAiChat } from "@/lib/ai-chat";
import { Modal } from "./modal";
import {
  CalendarIcon,
  CloseIcon,
  ShareIcon,
  SparkIcon,
  TrophyIcon,
  UsersIcon,
} from "./icons";
import {
  AlignControl,
  ChapterSwipeControl,
  FontSizeControl,
  LanguageColors,
  SavedSetups,
  ThemeToggle,
  VersionChooser,
  ViewToggle,
  WidthControl,
} from "./controls";
import { HighlightModeToggle } from "./highlight-mode";
import { WordModeToggle } from "./word-study";
import { XrefToggle } from "./xref-panel";
import { RedLetterToggle } from "./red-letter";
import { LevelMarksControl } from "./reading-levels";
import { OfflineDownloadsButton } from "./downloads-dialog";
import { TourButton } from "./tour";
import { InstallAppButton } from "./install-app";
import { FeedbackButton } from "./feedback-dialog";
import { useGoalRing, useLevel } from "./progress-panel";
import { useShareHere } from "./read-together";

export function MoreSheet() {
  const { sheet } = useUi();
  // Leaving the reader (About, or any page outside it) closes the sheet, so it isn't open again on return.
  useEffect(() => () => closeSheet(), []);
  return (
    <Modal
      open={sheet != null}
      onClose={closeSheet}
      variant="sheet"
      label={sheet === "text" ? "Text settings" : sheet === "versions" ? "Versions and languages" : "More: tools and reading settings"}
    >
      {sheet != null && <Body section={sheet} />}
    </Modal>
  );
}

function Body({ section }: { section: string }) {
  const { xrefMode } = useSettings();
  // The Aa button shows only the text settings, the versions chip only versions & languages (each a
  // short sheet of its own); the ⋯ button shows everything. Other sections: the full sheet, scrolled there.
  const only = section === "text" || section === "versions" ? section : null;
  useEffect(() => {
    if (!section || only) return;
    const el = document.getElementById(`more-${section}`);
    el?.scrollIntoView({ block: "start" });
  }, [section, only]);
  return (
    <div className="flex max-h-[88dvh] flex-col">
      <div className="flex items-center justify-between border-b border-line py-1 pl-4 pr-1 pt-2">
        <h2 className="font-serif text-lg font-semibold">
          {only === "text"
            ? "Text"
            : only === "versions"
              ? "Versions & languages"
              : "More"}
        </h2>
        <button
          type="button"
          onClick={closeSheet}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-raised"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-6 pt-4">
        {!only && <Tiles />}

        {only !== "versions" && (
          <Section id="text" title="Text" hideTitle={only === "text"}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Size and theme</span>
              <div className="flex items-center gap-2">
                <FontSizeControl />
                <ThemeToggle />
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">
                Layout
              </h4>
              <ViewToggle full />
            </div>
            <AlignControl />
            <WidthControl />
            <LevelMarksControl />
            <LanguageColors />
          </Section>
        )}

        {!only && (
          <Section
            id="modes"
            title="Tap a verse"
            hint="With one of these on, tapping a verse does that instead of opening its menu. Tap again to turn it off."
          >
            <div className="grid grid-cols-3 gap-2">
              <HighlightModeToggle tile />
              <WordModeToggle tile />
              <XrefToggle tile onToggle={(on) => on && closeSheet()} />
            </div>
            {xrefMode && (
              <p className="text-xs text-muted">
                Cross references are on: close this and tap a verse to see the
                verses most like it.
              </p>
            )}
          </Section>
        )}

        {only !== "versions" && (
          <Section id="reading" title="Reading">
            <RedLetterToggle />
            <ChapterSwipeControl />
          </Section>
        )}

        {only !== "text" && (
          <Section id="versions" title="Versions & languages" hideTitle={only === "versions"}>
            <SavedSetups />
            <VersionChooser />
          </Section>
        )}

        {!only && (
          <Section id="more" title="More">
            <InstallAppButton onDone={closeSheet} />
            <OfflineDownloadsButton />
            <div className="grid grid-cols-2 gap-2">
              <FeedbackButton
                onOpen={closeSheet}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm hover:border-faint"
              >
                Send feedback
              </FeedbackButton>
              <a
                href="mailto:support@versesacross.com"
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm hover:border-faint"
              >
                Email for help
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TourButton />
              <Link
                href="/about"
                onClick={closeSheet}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm hover:border-faint"
              >
                About
              </Link>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

/** A labelled card of settings. */
function Section({
  id,
  title,
  hint,
  hideTitle = false,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  /** The sheet's own heading already says it (Aa / versions chip sheets): kept for screen readers only. */
  hideTitle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`more-${id}`}
      aria-labelledby={`more-${id}-h`}
      className="scroll-mt-2 space-y-1.5"
    >
      <h3
        id={`more-${id}-h`}
        className={hideTitle ? "sr-only" : "px-1 text-[11px] font-semibold uppercase tracking-wider text-faint"}
      >
        {title}
      </h3>
      <div className="space-y-4 rounded-2xl border border-line bg-raised/40 p-3">
        {hint && <p className="text-xs text-muted">{hint}</p>}
        {children}
      </div>
    </section>
  );
}

/* ---------- the tools ---------- */

function Tiles() {
  const ai = useAiChat();
  const share = useShareHere();
  const go = (id: PanelId) => {
    closeSheet();
    openPanel(id);
  };
  return (
    <div
      role="group"
      aria-label="Study tools"
      className="grid grid-cols-3 gap-2"
    >
      <ProgressTile />
      <Tile
        icon={<CalendarIcon />}
        label="Plans & Goals"
        onClick={() => go("plans")}
      />
      <Tile
        icon={<UsersIcon />}
        label="Study groups"
        onClick={() => go("groups")}
      />
      {ai.ready && (
        <Tile
          icon={<SparkIcon />}
          label="Ask AI"
          onClick={() => {
            closeSheet();
            openAi();
          }}
        />
      )}
      <Tile
        icon={<ShareIcon />}
        label="Read together"
        title="Send a friend a link to this exact spot: the same chapter and versions, at the verse you're on"
        onClick={() => {
          closeSheet();
          void share();
        }}
      />
    </div>
  );
}

function Tile({
  icon,
  label,
  title,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="relative flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-raised px-1 text-xs font-medium text-ink hover:border-faint"
    >
      <span className="relative text-accent" aria-hidden>
        {icon}
        {children}
      </span>
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

/** Progress: the trophy with today's goal as a ring and the level in the corner, like the desktop button. */
function ProgressTile() {
  const ring = useGoalRing();
  const { level } = useLevel();
  const c = 2 * Math.PI * 15;
  const goal = ring == null ? "" : `, today's goal ${Math.round(ring * 100)}%`;
  return (
    <button
      type="button"
      onClick={() => {
        closeSheet();
        openPanel("progress");
      }}
      aria-label={`Progress, level and badges (level ${level}${goal})`}
      className="relative flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-raised px-1 text-xs font-medium text-ink hover:border-faint"
    >
      <span
        className="relative flex h-8 w-8 items-center justify-center text-accent"
        aria-hidden
      >
        <TrophyIcon />
        {ring != null && ring > 0 && (
          <svg
            viewBox="0 0 34 34"
            className="pointer-events-none absolute inset-0 -rotate-90"
          >
            <circle
              cx="17"
              cy="17"
              r="15"
              fill="none"
              stroke="var(--line)"
              strokeWidth="2"
            />
            <circle
              cx="17"
              cy="17"
              r="15"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${c * ring} ${c}`}
            />
          </svg>
        )}
        <span className="absolute -bottom-1 -right-1.5 min-w-[1.1rem] rounded-full border border-raised bg-accent px-1 text-center text-[10px] font-bold leading-4 tabular-nums text-accent-ink">
          {level}
        </span>
      </span>
      <span aria-hidden>Progress</span>
    </button>
  );
}
