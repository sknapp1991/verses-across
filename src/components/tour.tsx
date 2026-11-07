"use client";
/**
 * The guided tour: a short swipeable deck of cards showing what the app can do. It opens by itself
 * once, for someone visiting for the first time (never for returning readers), and can be replayed from
 * Display options / Reading settings and the sidebar. Skip closes it; with "Don't show this again" (on by
 * default) it never opens by itself again, without it a first-time visitor sees it once more next visit.
 * Keyboard: ← →, Esc; focus stays on Next. Swipe on touch screens. Respects reduced motion.
 * Replaces the old one-time "Quick tips" card (first-tips.tsx), which it marks as seen.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { openAi } from "@/lib/ai-chat";
import { openPanel } from "@/lib/ui-store";
import { openDownloads } from "./downloads-dialog";
import { BookIcon, ColumnsIcon, HeadphonesIcon, LanguagesIcon, SparkIcon, StarIcon, TrophyIcon } from "./icons";
import { Modal } from "./modal";
import { openSyncDialog } from "./sync-dialog";

const KEY = "va-tour:v1"; // "done" = don't open by itself again
const TIPS = "gs:tips:v1"; // the old Quick tips card: shown once, so the tour counts as it

let open = false;
const subs = new Set<() => void>();
const setOpen = (v: boolean) => {
  open = v;
  subs.forEach((l) => l());
};
export const openTour = () => setOpen(true);
const useOpen = () =>
  useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => open,
    () => false,
  );

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return "1"; // storage blocked: behave as a returning reader (never pop up)
  }
};
const put = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

type Step = { icon: ReactNode; title: string; body: string; where: string; tryIt?: { label: string; go: () => void } };

const STEPS: Step[] = [
  {
    icon: <ColumnsIcon />,
    title: "Scriptures side by side",
    body: "Read the Bible, Quran, Torah, Gita, Pali Canon and more, with several translations and the original language next to each other.",
    where: "Versions (at the top, or in Reading settings on a phone) adds or removes columns. Swipe sideways for the next chapter.",
  },
  {
    icon: <HeadphonesIcon />,
    title: "Listen as you read",
    body: "Read-along highlights each verse as it's read. Several versions can take turns, and recorded voices keep playing with the screen locked.",
    where: "The headphones button at the top. Tap any verse to start from there.",
  },
  {
    icon: <LanguagesIcon />,
    title: "Tap a word for the original",
    body: "In Words mode, tap a word to see its Hebrew or Greek original and meaning, with the same word lit up in every version on screen.",
    where: "The Words mode button at the top (or in Reading settings on a phone), then tap any word.",
  },
  {
    icon: <StarIcon />,
    title: "Favorites, highlights and notes",
    body: "Tap a verse to highlight it, write a note, save it as a favorite or for later. It all stays on your device, in My Study.",
    where: "Tap a verse, or open My Study (the bookmark button at the top).",
    tryIt: { label: "Open My Study", go: () => openPanel("study") },
  },
  {
    icon: <SparkIcon />,
    title: "Ask AI about a passage",
    body: "Ask a question about what you're reading and get an answer with verse references you can open. AI can be wrong, so check the text.",
    where: "The spark button at the top, or Ask AI in a verse's menu.",
    tryIt: { label: "Open Ask AI", go: openAi },
  },
  {
    icon: <TrophyIcon />,
    title: "Streaks, goals and sync",
    body: "See your reading streak, set a daily goal, and read with family in a study group. Sync keeps your notes the same on your phone and computer, encrypted, with no account.",
    where: "The trophy at the top. Sync is in My Study.",
    tryIt: { label: "Set up sync", go: openSyncDialog },
  },
  {
    icon: <BookIcon />,
    title: "Read with no signal",
    body: "Save any version, and its read-along audio, on this device. The size shows first, and you can delete it any time.",
    where: "Display options (or Reading settings on a phone), then Offline downloads.",
    tryIt: { label: "Open Offline downloads", go: openDownloads },
  },
];

/** Opens the tour once for a first-time visitor, a few seconds after the first chapter appears. */
function useAutoOpen() {
  useEffect(() => {
    if (get(KEY) || get(TIPS) || get("gs:settings:v1")) return; // returning reader, or already shown
    const t = setTimeout(() => {
      // Not over anything else, and not while the person is typing or using a menu.
      const busy = document.querySelector("dialog[open], [role=dialog]") || (document.activeElement && document.activeElement !== document.body);
      if (!busy) openTour();
    }, 4000);
    return () => clearTimeout(t);
  }, []);
}

export function Tour() {
  useAutoOpen();
  const isOpen = useOpen();
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(true);
  const live = useRef<HTMLParagraphElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  // Keep focus on Next when the tour opens and on every step (so ← → keep working and Enter moves on).
  useEffect(() => {
    if (!isOpen) return;
    const r = requestAnimationFrame(() => next.current?.focus());
    return () => cancelAnimationFrame(r);
  }, [isOpen, step]);

  const close = () => {
    if (dontShow) {
      put(KEY, "done");
      put(TIPS, "1");
    }
    setOpen(false);
    setStep(0);
  };
  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));

  // Swipe between cards (a horizontal drag; vertical scrolling is left alone).
  const start = useRef<{ x: number; y: number } | null>(null);

  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <Modal open={isOpen} onClose={close} variant="card" label="Tour of Verses Across">
      <div
        className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto overscroll-contain px-5 pb-4 pt-4 desk:max-h-[80vh]"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(step + 1);
          if (e.key === "ArrowLeft") go(step - 1);
        }}
        onPointerDown={(e) => (start.current = e.pointerType === "touch" ? { x: e.clientX, y: e.clientY } : null)}
        onPointerUp={(e) => {
          if (e.pointerType !== "touch") return; // a mouse drag selects text instead
          const p = start.current;
          start.current = null;
          if (!p) return;
          const dx = e.clientX - p.x;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - p.y) * 1.5) go(step + (dx < 0 ? 1 : -1));
        }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Tour · {step + 1} of {STEPS.length}
          </p>
          <button type="button" onClick={close} className="min-h-10 rounded-lg px-3 text-sm text-muted hover:bg-raised hover:text-ink">
            Skip
          </button>
        </div>

        <div key={step} role="group" aria-roledescription="slide" aria-label={`${step + 1} of ${STEPS.length}: ${s.title}`} className="tour-card space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent [&>svg]:h-7 [&>svg]:w-7" aria-hidden>
            {s.icon}
          </div>
          <h2 className="font-serif text-2xl font-semibold text-ink">{s.title}</h2>
          <p className="text-[0.95rem] leading-relaxed text-ink/90">{s.body}</p>
          <p className="rounded-lg border border-line px-3 py-2 text-sm text-muted">
            <span className="font-medium text-ink">Where: </span>
            {s.where}
          </p>
          {s.tryIt && (
            <button
              type="button"
              onClick={() => {
                close();
                s.tryIt!.go();
              }}
              className="min-h-10 rounded-lg border border-accent/60 px-3 text-sm font-medium text-ink hover:bg-accent-soft"
            >
              {s.tryIt.label}
            </button>
          )}
        </div>
        <p ref={live} className="sr-only" aria-live="polite">
          {`Step ${step + 1} of ${STEPS.length}: ${s.title}`}
        </p>

        <div className="flex items-center justify-center gap-1.5" role="group" aria-label="Choose a step">
          {STEPS.map((x, i) => (
            <button
              key={x.title}
              type="button"
              onClick={() => go(i)}
              aria-label={`Step ${i + 1}: ${x.title}`}
              aria-current={i === step ? "step" : undefined}
              className="flex h-8 w-6 items-center justify-center"
            >
              <span className={`block h-2 rounded-full transition-all motion-reduce:transition-none ${i === step ? "w-5 bg-accent" : "w-2 bg-line"}`} />
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="flex min-h-10 items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Don&rsquo;t show this again
          </label>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)} className="min-h-10 rounded-lg border border-line px-4 text-sm hover:bg-raised">
                Back
              </button>
            )}
            <button
              ref={next}
              type="button"
              onClick={() => (last ? close() : go(step + 1))}
              className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink"
            >
              {last ? "Start reading" : "Next"}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-muted">Replay any time: Display options (or Reading settings), then Take the tour.</p>
      </div>
    </Modal>
  );
}

/** "Take the tour" for settings, the sidebar and About. */
export function TourButton({ className = "flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm hover:border-faint" }: { className?: string }) {
  return (
    <button type="button" onClick={openTour} className={className}>
      Take the tour
    </button>
  );
}
