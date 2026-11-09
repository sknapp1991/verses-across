"use client";
/**
 * The "Scriptures | Library" switch (top bar on a computer, the top of the side drawer on a phone) and its
 * one-time explainer. See src/lib/side.ts for how the side is chosen and when the explainer may show.
 */
import { useEffect, useState } from "react";
import { chooseSide, SIDE_NAME, tipDue, tipShown, useSide, type Side } from "@/lib/side";
import { CloseIcon } from "./icons";

export function SideSwitch({ onChoose, className = "" }: { onChoose?: (side: Side) => void; className?: string }) {
  const side = useSide();
  return (
    <div role="radiogroup" aria-label="Scriptures or Library" data-side-switch className={`inline-flex shrink-0 rounded-full border border-line bg-raised p-0.5 ${className}`}>
      {(["scriptures", "library"] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={side === s}
          onClick={() => {
            chooseSide(s);
            onChoose?.(s);
          }}
          className={`min-h-8 rounded-full px-3 text-sm font-medium transition-colors ${side === s ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
        >
          {SIDE_NAME[s]}
        </button>
      ))}
    </div>
  );
}

/**
 * The explainer: a small card, once (and at most once more about three weeks later, unless the Library has
 * been opened). Waits until nothing else is open and the welcome tour is done.
 */
export function SideTip() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let tries = 0;
    const check = () => {
      if (!tipDue()) return;
      let tourDone = true;
      try {
        // a first-time visitor sees the welcome tour first; the explainer waits for a later visit
        // (a returning reader, with settings saved, never gets the tour: the explainer is for them most of all)
        tourDone = !!(localStorage.getItem("va-tour:v1") || localStorage.getItem("gs:tips:v1") || localStorage.getItem("gs:settings:v1"));
      } catch {
        /* storage blocked: show it */
      }
      const busy = document.querySelector("dialog[open], [role=dialog]");
      if (tourDone && !busy) setOpen(true);
      else if (tourDone && tries++ < 6) t = window.setTimeout(check, 5000);
    };
    let t = window.setTimeout(check, 3500);
    return () => clearTimeout(t);
  }, []);
  if (!open) return null;
  const close = () => {
    tipShown();
    setOpen(false);
  };
  return (
    <div
      role="region"
      aria-label="Scriptures and Library"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 mx-auto max-w-sm rounded-2xl border border-line bg-panel p-4 shadow-xl desk:inset-x-auto desk:bottom-auto desk:left-1/2 desk:top-16 desk:mx-0 desk:w-96 desk:-translate-x-1/2"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Scriptures and Library</p>
          <p className="mt-1 text-sm text-muted">
            Verses Across has two sides now. <strong className="text-ink">Scriptures</strong> holds every tradition&apos;s texts.{" "}
            <strong className="text-ink">Library</strong> holds the classic books: fiction, poetry, drama, children&apos;s books, freethought and more. Switch between
            them at the top
            <span className="desk:hidden"> of the menu (☰)</span>. Each side keeps its own shelves and your place.
          </p>
        </div>
        <button type="button" onClick={close} aria-label="Close" className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-raised">
          <CloseIcon width={16} height={16} />
        </button>
      </div>
      <button type="button" onClick={close} className="mt-3 min-h-10 w-full rounded-lg bg-accent text-sm font-medium text-accent-ink">
        Got it
      </button>
    </div>
  );
}
