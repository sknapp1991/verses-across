"use client";
/**
 * Highlight mode: while on, tapping a verse paints it with the chosen colour (tap again to clear).
 * Toggle from the top bar; the strip under the top bar (ModeBanner; on a phone a bubble at the bottom left) shows the
 * colours and turns it off.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { updateSettings, useMediaQuery, useSettings, WIDE_QUERY } from "@/lib/settings";
import { EXTRA_HIGHLIGHTS, highlightColour, highlightColours } from "@/lib/study";
import { CloseIcon, MarkerIcon, WordsIcon } from "./icons";

/** The shape of the three mode buttons: an icon (top bar), icon + "… on/off" (full) or an icon over a short name (tile). */
export const modeButtonClass = (on: boolean, shape: "icon" | "full" | "tile", onCls = "border-accent bg-accent-soft text-accent", offCls = "border-line bg-raised text-muted hover:text-ink") =>
  `relative flex items-center justify-center rounded-lg border text-sm ${
    shape === "tile" ? "h-16 w-full flex-col gap-1 px-1 text-xs font-medium" : shape === "full" ? "h-11 w-full gap-2 px-3" : "h-11 w-11 gap-2 px-0"
  } ${on ? onCls : offCls}`;

export function HighlightModeToggle({ full = false, tile = false }: { full?: boolean; tile?: boolean }) {
  const { highlightMode, highlightColor } = useSettings();
  const dot = highlightColour(highlightColor)?.dot;
  return (
    <button
      type="button"
      aria-pressed={highlightMode}
      onClick={() => updateSettings(highlightMode ? { highlightMode: false } : { highlightMode: true, wordMode: false })}
      title="Highlight mode: tap verses to highlight them"
      aria-label="Highlight mode"
      className={modeButtonClass(highlightMode, tile ? "tile" : full ? "full" : "icon")}
    >
      <MarkerIcon />
      {full && <span>Highlight mode {highlightMode ? "on" : "off"}</span>}
      {tile && <span>Highlight</span>}
      {highlightMode && <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full" style={{ background: dot }} />}
    </button>
  );
}

/**
 * The strip right under the top bar while Words mode or Highlight mode is on: says what tapping does now
 * (easy to spot, unlike a small note at the bottom) and turns the mode off. Highlight mode also picks the colour.
 */
export function ModeBanner() {
  const { highlightMode, highlightColor, wordMode, highlightExtra } = useSettings();
  if (!highlightMode && !wordMode) return null;
  return (
    <>
    {/* Phone: a small bubble at the bottom left instead (my brother's ticket d35347dd, Nov 23: the strip took screen) */}
    <ModeBubbleOnPhone />
    <div
      data-no-swipe
      className="mode-banner hidden shrink-0 desk:flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-accent/40 bg-accent-soft px-3 py-1.5 text-sm text-ink md:px-4"
    >
      <span className="flex min-w-0 flex-1 basis-0 items-center gap-2">
        <span className="text-accent" aria-hidden>
          {wordMode ? <WordsIcon width={18} height={18} /> : <MarkerIcon width={18} height={18} />}
        </span>
        <span role="status" className="min-w-0">
          <strong className="font-semibold">{wordMode ? "Words mode is on:" : "Highlight mode is on:"}</strong>{" "}
          {wordMode ? "tap any word to see its original and meaning." : "tap verses to highlight them (tap again to clear)."}
        </span>
      </span>
      {highlightMode && (
        <span className="flex items-center gap-0.5" role="group" aria-label="Highlight colour">
          {highlightColours(highlightExtra).map((h) => (
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
          <AddColour size="h-9 w-9" />
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
    </>
  );
}

/**
 * Where the bubble can sit: above the open read-aloud bar (its height, so its slide-in doesn't fool it; the bar's own
 * padding already holds the safe area), and above the folded read-aloud pill when the two would touch on a narrow
 * screen. Otherwise 12px over the safe area.
 */
function useFreeBottom(bubble: RefObject<HTMLDivElement | null>) {
  const [bottom, setBottom] = useState<string>("calc(12px + env(safe-area-inset-bottom))");
  useEffect(() => {
    let cur: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    const measure = () => {
      if (!cur) return setBottom("calc(12px + env(safe-area-inset-bottom))");
      const bar = cur.matches("section, [role='region']");
      if (bar) return setBottom(`${cur.offsetHeight + 8}px`);
      // the folded pill (bottom right): above it only if it reaches the bubble's side
      const pill = cur.getBoundingClientRect();
      const mine = bubble.current?.getBoundingClientRect();
      const touches = !!mine && pill.left < 12 + mine.width + 8;
      setBottom(touches ? `${window.innerHeight - pill.top + 8}px` : "calc(12px + env(safe-area-inset-bottom))");
    };
    const find = () => {
      const el = document.querySelector<HTMLElement>("[data-audio-dock]");
      if (el === cur) return;
      cur = el;
      ro?.disconnect();
      ro = null;
      if (el) {
        ro = new ResizeObserver(measure);
        ro.observe(el);
      }
      measure();
    };
    const mo = new MutationObserver(find);
    mo.observe(document.body, { childList: true, subtree: true });
    const t = setTimeout(find, 0);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      mo.disconnect();
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [bubble]);
  return bottom;
}

/** Only on a phone (the strip serves a computer), so nothing watches the page there. */
function ModeBubbleOnPhone() {
  const wide = useMediaQuery(WIDE_QUERY, true);
  return wide ? null : <ModeBubble />;
}

/**
 * Phone: Words mode or Highlight mode as a bubble at the bottom left, shaped like the folded read-aloud pill: the
 * mode's icon and name, the colour (tap it for the others) and x to turn the mode off.
 */
function ModeBubble() {
  const { highlightMode, highlightColor, wordMode, highlightExtra } = useSettings();
  const [colours, setColours] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const bottom = useFreeBottom(box);
  const colour = highlightColour(highlightColor);
  useEffect(() => {
    if (!colours) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setColours(false);
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setColours(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [colours]);
  return (
    <div
      ref={box}
      data-no-swipe
      data-note-avoid
      style={{ bottom }}
      className="fixed left-3 z-20 flex animate-[chip-in_200ms_ease-out] flex-col items-start gap-1 desk:hidden print:hidden"
    >
      {highlightMode && colours && (
        <span className="flex items-center gap-0.5 rounded-full border border-line bg-panel/95 p-1 shadow-lg backdrop-blur" role="group" aria-label="Pick a highlight colour">
          {highlightColours(highlightExtra).map((h) => (
            <button
              key={h.id}
              type="button"
              aria-label={h.label}
              aria-pressed={highlightColor === h.id}
              onClick={() => {
                updateSettings({ highlightColor: h.id });
                setColours(false);
              }}
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${highlightColor === h.id ? "border-ink" : "border-transparent"}`}
            >
              <span className="h-6 w-6 rounded-full" style={{ background: h.dot }} />
            </button>
          ))}
          <AddColour size="h-11 w-11" up />
        </span>
      )}
      <div className="flex items-center gap-1 rounded-full border border-accent/50 bg-panel/90 p-1 pr-1 shadow-lg backdrop-blur">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
          {wordMode ? <WordsIcon width={18} height={18} /> : <MarkerIcon width={18} height={18} />}
        </span>
        <span role="status" className="px-1 text-xs font-medium text-ink">
          {wordMode ? "Words" : "Highlight"}
          <span className="sr-only">{wordMode ? " mode is on: tap any word to see its original and meaning." : " mode is on: tap verses to highlight them, tap again to clear."}</span>
        </span>
        {highlightMode && (
          <button
            type="button"
            onClick={() => setColours(!colours)}
            aria-expanded={colours}
            aria-label={`Highlight colour: ${colour?.label ?? ""}. Change it`}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-raised"
          >
            <span className="h-6 w-6 rounded-full border-2 border-ink/60" style={{ background: colour?.dot }} />
          </button>
        )}
        <button
          type="button"
          onClick={() => updateSettings(wordMode ? { wordMode: false } : { highlightMode: false })}
          aria-label={wordMode ? "Turn Words mode off" : "Turn Highlight mode off"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
}


/**
 * "+": a palette of 12 more colours (my brother's ticket 74253cbe). Tap one to add it to your colours and highlight
 * with it; tap one you added (✓) to take it off again. Kept with your settings (and synced, if sync is on).
 */
function AddColour({ size, up = false }: { size: string; up?: boolean }) {
  const { highlightExtra, highlightColor } = useSettings();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  const pick = (id: string) => {
    const has = highlightExtra.includes(id);
    if (has) updateSettings({ highlightExtra: highlightExtra.filter((x) => x !== id), ...(highlightColor === id ? { highlightColor: "yellow" } : {}) });
    else updateSettings({ highlightExtra: [...highlightExtra, id], highlightColor: id });
    setOpen(false);
  };
  return (
    <span ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="More highlight colours"
        title="More colours"
        className={`flex ${size} items-center justify-center rounded-full border-2 border-dashed border-line text-lg leading-none text-muted hover:border-faint hover:text-ink`}
      >
        +
      </button>
      {open && (
        <span
          role="group"
          aria-label="Add a highlight colour"
          className={`absolute z-40 grid w-[13.5rem] grid-cols-6 gap-1 rounded-xl border border-line bg-panel p-2 shadow-xl ${up ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"}`}
        >
          {EXTRA_HIGHLIGHTS.map((h) => {
            const added = highlightExtra.includes(h.id);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => pick(h.id)}
                aria-pressed={added}
                aria-label={added ? `${h.label}: added, tap to remove` : `Add ${h.label}`}
                title={added ? `${h.label} (tap to remove)` : h.label}
                className="relative flex h-8 w-8 items-center justify-center rounded-full"
              >
                <span className="h-6 w-6 rounded-full" style={{ background: h.dot }} />
                {added && (
                  <span aria-hidden className="absolute text-xs font-bold text-white drop-shadow">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </span>
      )}
    </span>
  );
}
