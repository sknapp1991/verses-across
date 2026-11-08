"use client";
/**
 * Phone: the "Tap a verse" modes (Highlight, Words, Cross refs) one tap away, beside Aa in the pinned
 * chapter bar, instead of only inside the ⋯ sheet. The button shows the mode that's on (lit up); tap it
 * for a small card with the three switches. They're still in the ⋯ sheet too.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "@/lib/settings";
import { HighlightModeToggle } from "./highlight-mode";
import { WordModeToggle } from "./word-study";
import { XrefToggle } from "./xref-panel";
import { MarkerIcon, WordsIcon } from "./icons";

const TapIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    <path d="M9 11V5.5a1.5 1.5 0 013 0V10m0-1.5a1.5 1.5 0 013 0V11m0-1a1.5 1.5 0 013 0v4.5a6 6 0 01-6 6h-.6a6 6 0 01-4.7-2.3L4.4 15a1.5 1.5 0 012.3-1.9L9 15" />
  </svg>
);
const XrefIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 4h4v6H7zM13 14h4v6h-4zM9 10v4h4" />
  </svg>
);

export function TapModesButton() {
  const { highlightMode, wordMode, xrefMode } = useSettings();
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0); // the card's top: just under the button
  const box = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const on = highlightMode || wordMode || xrefMode;
  const name = highlightMode ? "Highlight" : wordMode ? "Words" : xrefMode ? "Cross references" : null;

  // Close on a tap outside or Esc.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !card.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box}>
      <button
        type="button"
        onClick={(e) => {
          setAt(e.currentTarget.getBoundingClientRect().bottom + 6);
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-label={`Tap a verse${name ? ` (${name} is on)` : ""}: highlight, words, cross references`}
        title="Tap a verse: Highlight, Words, Cross references"
        className={`flex h-11 w-11 items-center justify-center rounded-lg border ${
          on ? "border-accent bg-accent-soft text-accent" : "border-line bg-raised text-muted hover:text-ink"
        }`}
      >
        {highlightMode ? <MarkerIcon /> : wordMode ? <WordsIcon /> : xrefMode ? <XrefIcon /> : <TapIcon />}
      </button>
      {open &&
        // Drawn at page level: the pinned bar's blur would otherwise become the card's frame.
        createPortal(
        <div
          ref={card}
          role="group"
          aria-label="Tap a verse"
          // Fixed to the screen's right edge (the button sits mid-bar, so a card hung from it would run off the left).
          style={{ top: at }}
          className="fixed right-4 z-30 w-[min(18rem,calc(100vw-2rem))] space-y-2 rounded-2xl border border-line bg-panel p-3 shadow-xl"
        >
          <p className="text-xs text-muted">With one of these on, tapping a verse does that instead of opening its menu.</p>
          <div className="grid grid-cols-3 gap-2" onClick={() => setOpen(false)}>
            <HighlightModeToggle tile />
            <WordModeToggle tile />
            <XrefToggle tile />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
