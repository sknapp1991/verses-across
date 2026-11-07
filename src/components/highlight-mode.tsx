"use client";
/**
 * Highlight mode: while on, tapping a verse paints it with the chosen colour (tap again to clear).
 * Toggle from the top bar; the strip under the top bar (ModeBanner) shows the colours and turns it off.
 */
import { updateSettings, useSettings } from "@/lib/settings";
import { HIGHLIGHTS } from "@/lib/study";
import { CloseIcon, MarkerIcon } from "./icons";

export function HighlightModeToggle({ full = false }: { full?: boolean }) {
  const { highlightMode, highlightColor } = useSettings();
  const dot = HIGHLIGHTS.find((h) => h.id === highlightColor)?.dot;
  return (
    <button
      type="button"
      aria-pressed={highlightMode}
      onClick={() => updateSettings(highlightMode ? { highlightMode: false } : { highlightMode: true, wordMode: false })}
      title="Highlight mode: tap verses to highlight them"
      aria-label="Highlight mode"
      className={`relative flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm ${full ? "w-full" : "w-11 px-0"} ${
        highlightMode ? "border-accent bg-accent-soft text-accent" : "border-line bg-raised text-muted hover:text-ink"
      }`}
    >
      <MarkerIcon />
      {full && <span>Highlight mode {highlightMode ? "on" : "off"}</span>}
      {highlightMode && <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full" style={{ background: dot }} />}
    </button>
  );
}

/**
 * The strip right under the top bar while Words mode or Highlight mode is on: says what tapping does now
 * (easy to spot, unlike a small note at the bottom) and turns the mode off. Highlight mode also picks the colour.
 */
export function ModeBanner() {
  const { highlightMode, highlightColor, wordMode } = useSettings();
  if (!highlightMode && !wordMode) return null;
  return (
    <div
      data-no-swipe
      className="mode-banner flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-accent/40 bg-accent-soft px-3 py-1.5 text-sm text-ink md:px-4"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-accent" aria-hidden>
          {wordMode ? <WordsGlyph /> : <MarkerIcon width={18} height={18} />}
        </span>
        <span role="status" className="min-w-0">
          <strong className="font-semibold">{wordMode ? "Words mode is on:" : "Highlight mode is on:"}</strong>{" "}
          {wordMode ? "tap any word to see its original and meaning." : "tap verses to highlight them (tap again to clear)."}
        </span>
      </span>
      {highlightMode && (
        <span className="flex items-center gap-0.5" role="group" aria-label="Highlight colour">
          {HIGHLIGHTS.map((h) => (
            <button
              key={h.id}
              type="button"
              aria-label={h.label}
              aria-pressed={highlightColor === h.id}
              onClick={() => updateSettings({ highlightColor: h.id })}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${highlightColor === h.id ? "border-ink" : "border-transparent"}`}
            >
              <span className="h-6 w-6 rounded-full" style={{ background: h.dot }} />
            </button>
          ))}
        </span>
      )}
      <button
        type="button"
        onClick={() => updateSettings(wordMode ? { wordMode: false } : { highlightMode: false })}
        className="flex min-h-9 items-center gap-1 rounded-lg border border-line bg-panel px-3 text-sm font-medium hover:border-faint"
      >
        <CloseIcon width={14} height={14} /> Turn off
      </button>
    </div>
  );
}

const WordsGlyph = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 19V7l4 8 4-8v12" />
    <path d="M15 19h5M17.5 9v10" />
  </svg>
);
