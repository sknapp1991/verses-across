"use client";
import { useEffect, useId, useRef, useState } from "react";
import { DEFAULT_VERSIONS, getVersion, versionsForWork } from "@/lib/catalog";
import { getLanguage, LANGUAGES } from "@/lib/languages";
import {
  COL_MAX,
  COL_MIN,
  DEFAULT_PALETTE,
  FONT_MAX,
  FONT_MIN,
  getSettings,
  PHONE_LANDSCAPE_QUERY,
  STACK_MAX,
  STACK_MIN,
  updateSettings,
  useMediaQuery,
  useSettings,
  useViewMode,
  versionColor,
  type TextAlign,
} from "@/lib/settings";
import type { Version } from "@/lib/schema";
import { CheckIcon, CloseIcon, ColumnsIcon, GripIcon, MoonIcon, PaletteIcon, PencilIcon, RowsIcon, SunIcon, WidthIcon } from "./icons";
import { useReaderState } from "./use-reader-state";
import { LevelMarksControl } from "./reading-levels";
import { sideOfWork } from "@/lib/side";

/** An on/off switch (a sliding pill), used for the yes/no settings. */
export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (on: boolean) => void; label: React.ReactNode; hint?: React.ReactNode }) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-l`}
      aria-describedby={hint ? `${id}-h` : undefined}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg text-left"
    >
      <span className="text-sm">
        <span id={`${id}-l`} className="font-medium">
          {label}
        </span>
        {hint && (
          <span id={`${id}-h`} className="block text-xs text-faint">
            {hint}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors motion-reduce:transition-none ${
          checked ? "border-accent bg-accent" : "border-line bg-line"
        }`}
      >
        <span
          className={`absolute left-0 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${checked ? "translate-x-[1.3rem]" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}

export function ViewToggle({ full = false, compact = false }: { full?: boolean; compact?: boolean }) {
  const view = useViewMode();
  const opts = [
    { id: "column" as const, label: "Columns", Icon: ColumnsIcon },
    { id: "stacked" as const, label: "Stacked", Icon: RowsIcon },
  ];
  return (
    <div role="group" aria-label="Layout" className={`flex rounded-lg border border-line bg-raised p-0.5 ${full ? "w-full" : ""}`}>
      {opts.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => updateSettings({ view: id })}
          title={label}
          aria-label={compact ? `${label} view` : undefined}
          className={`flex ${compact ? "h-8 px-2" : "h-11 px-3"} flex-1 items-center justify-center gap-1.5 rounded-md text-sm ${
            view === id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"
          }`}
        >
          <Icon width={18} height={18} />
          <span className={full ? "" : compact ? "hidden 2xl:inline" : "hidden xl:inline"}>{label}</span>
        </button>
      ))}
    </div>
  );
}

export function FontSizeControl({ compact = false }: { compact?: boolean }) {
  const { fontSize } = useSettings();
  const set = (n: number) => updateSettings({ fontSize: Math.min(FONT_MAX, Math.max(FONT_MIN, n)) });
  return (
    <div role="group" aria-label="Text size" className="flex items-center rounded-lg border border-line bg-raised p-0.5">
      <button
        type="button"
        onClick={() => set(fontSize - 2)}
        disabled={fontSize <= FONT_MIN}
        aria-label="Smaller text"
        className={`flex ${compact ? "h-8 w-8" : "h-11 w-11"} items-center justify-center rounded-md text-sm text-muted hover:text-ink disabled:opacity-40`}
      >
        A−
      </button>
      <span
        className={`${compact ? "w-6" : "w-8"} text-center text-xs tabular-nums text-faint`}
        aria-live="polite"
        title={fontSize <= FONT_MIN ? "Smallest text size" : fontSize >= FONT_MAX ? "Largest text size" : undefined}
      >
        {fontSize}
      </span>
      <button
        type="button"
        onClick={() => set(fontSize + 2)}
        disabled={fontSize >= FONT_MAX}
        aria-label="Larger text"
        className={`flex ${compact ? "h-8 w-8" : "h-11 w-11"} items-center justify-center rounded-md text-base font-medium text-muted hover:text-ink disabled:opacity-40`}
      >
        A+
      </button>
    </div>
  );
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      // The current theme (incl. "system") is whatever class is on <html> right now.
      onClick={() => updateSettings({ theme: document.documentElement.classList.contains("dark") ? "light" : "dark" })}
      aria-label="Toggle dark mode"
      title="Light / dark"
      className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-raised text-muted hover:text-ink"
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </button>
  );
}

function VersionRow({ v, checked, onChange, disableUncheck }: { v: Version; checked: boolean; onChange: (c: boolean) => void; disableUncheck: boolean }) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-raised ${
        checked && disableUncheck ? "cursor-default" : ""
      }`}
      title={checked && disableUncheck ? "At least one version must stay selected" : undefined}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={checked && disableUncheck}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60 ${
          checked ? "border-accent bg-accent text-accent-ink" : "border-faint"
        }`}
      >
        {checked && <CheckIcon width={14} height={14} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-medium">{v.abbr}</span> <span className="text-muted">— {v.name}</span>
        <span className="block text-xs text-faint">
          {v.yearNote ?? v.year} · {v.license}
        </span>
      </span>
    </label>
  );
}

/** Readable on both light and dark backgrounds. */
const SWATCHES = [
  "#d55e00", "#e69f00", "#b45309", "#a16207", "#4d7c0f", "#009e73",
  "#0e7490", "#0072b2", "#2563eb", "#4f46e5", "#7c3aed", "#be185d",
  "#dc2626", "#9f1239", "#6b7280", "#78716c", "#5b8a72", "#c2410c",
];

/**
 * Colour button with an in-app palette (saves on tap, closes on tap elsewhere) — no OS colour window
 * to confirm or close. "More…" still opens the full system picker.
 */
function ColorPicker({ value, onPick, label, children }: { value: string; onPick: (c: string) => void; label: string; children: React.ReactNode }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!at) return;
    const away = (e: PointerEvent) => {
      if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setAt(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAt(null);
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", esc);
    };
  }, [at]);
  const open = () => {
    // The button is display:contents (no box of its own): measure the swatch inside it.
    const el = (btn.current!.firstElementChild as HTMLElement | null) ?? btn.current!;
    const r = el.getBoundingClientRect();
    const w = 228, h = 176;
    setAt({ x: Math.max(8, Math.min(window.innerWidth - w - 8, r.left)), y: r.bottom + h + 8 > window.innerHeight ? r.top - h - 4 : r.bottom + 4 });
  };
  return (
    <>
      <button ref={btn} type="button" aria-label={label} aria-expanded={!!at} onClick={() => (at ? setAt(null) : open())} className="contents">
        {children}
      </button>
      {at && (
        <div
          ref={pop}
          role="dialog"
          aria-label={label}
          className="fixed z-[60] w-[228px] rounded-xl border border-line bg-panel p-2 shadow-xl"
          style={{ left: at.x, top: at.y }}
        >
          <div className="grid grid-cols-6 gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => {
                  onPick(c);
                  setAt(null);
                }}
                className={`h-8 w-8 rounded-md border-2 ${value.toLowerCase() === c ? "border-ink" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onPick("");
              setAt(null);
            }}
            className={`mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-lg text-xs hover:bg-raised ${value ? "text-muted" : "font-medium text-ink"}`}
          >
            <span className="h-4 w-4 rounded border border-line bg-ink" aria-hidden />
            Normal (black, or white in dark mode)
          </button>
          <label className="flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-lg text-xs text-muted hover:bg-raised">
            <input type="color" value={value || "#888888"} onChange={(e) => onPick(e.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" />
            More colours…
          </label>
        </div>
      )}
    </>
  );
}

/** Colour block for one version; picking a colour turns coloured text on. */
function VersionColorSwatch({ id, language, abbr }: { id: string; language: string; abbr: string }) {
  const s = useSettings();
  const own = s.versionColors[id];
  const effective = own || (s.palette[language] ?? DEFAULT_PALETTE[language]) || "";
  return (
    <ColorPicker
      value={effective}
      label={`${abbr} text colour`}
      onPick={(c) => updateSettings({ versionColors: { ...getSettings().versionColors, [id]: c }, langColors: true })}
    >
      <span className="flex h-11 w-9 shrink-0 cursor-pointer items-center justify-center" title={own ? `${abbr} colour (tap to change)` : `Pick a colour for ${abbr}`}>
        <span
          className={`h-6 w-6 rounded-md border ${!s.langColors ? "border-dashed border-faint" : effective ? "border-transparent" : "border-line bg-ink"}`}
          style={{ background: s.langColors && effective ? effective : undefined }}
        />
      </span>
    </ColorPicker>
  );
}

/**
 * The chosen versions in display order. Reorder by dragging the handle (mouse or touch) or with ▲/▼;
 * the order is saved in the URL (?v=) and on the device.
 */
function OrderList({ versions, setVersions }: { versions: string[]; setVersions: (ids: string[]) => void }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= versions.length || from === to) return;
    const next = [...versions];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setVersions(next);
  };
  const indexAt = (clientY: number) => {
    const rows = [...(listRef.current?.children ?? [])] as HTMLElement[];
    const i = rows.findIndex((r) => clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
    return i === -1 ? rows.length - 1 : i;
  };
  if (versions.length < 2) return null;
  return (
    <section aria-label="Column order">
      <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-faint">Your columns, in order</h3>
      <ol ref={listRef} className="space-y-1">
        {versions.map((id, i) => {
          const v = getVersion(id);
          if (!v) return null;
          const dragging = drag?.id === id;
          return (
            <li
              key={id}
              className={`flex min-h-11 items-center gap-1 rounded-lg border px-1 ${
                dragging ? "border-accent bg-accent-soft" : drag && drag.over === i ? "border-dashed border-accent" : "border-line bg-raised"
              }`}
            >
              <button
                type="button"
                aria-label={`Drag to reorder ${v.abbr}`}
                className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-faint active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag({ id, over: i });
                }}
                onPointerMove={(e) => drag && setDrag({ id, over: indexAt(e.clientY) })}
                onPointerUp={() => {
                  if (drag) move(i, drag.over);
                  setDrag(null);
                }}
                onPointerCancel={() => setDrag(null)}
              >
                <GripIcon />
              </button>
              <span className="w-5 text-center text-xs tabular-nums text-faint">{i + 1}</span>
              <VersionColorSwatch id={id} language={v.language} abbr={v.abbr} />
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{v.abbr}</span> <span className="text-faint">{getLanguage(v.language).name}</span>
              </span>
              <button type="button" aria-label={`Move ${v.abbr} up`} disabled={i === 0} onClick={() => move(i, i - 1)} className="flex h-11 w-9 items-center justify-center text-muted disabled:opacity-30">
                ▲
              </button>
              <button type="button" aria-label={`Move ${v.abbr} down`} disabled={i === versions.length - 1} onClick={() => move(i, i + 1)} className="flex h-11 w-9 items-center justify-center text-muted disabled:opacity-30">
                ▼
              </button>
              <button type="button" aria-label={`Remove ${v.abbr}`} onClick={() => setVersions(versions.filter((x) => x !== id))} className="flex h-11 w-9 items-center justify-center text-muted hover:text-ink">
                <CloseIcon width={16} height={16} />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Saved setups: versions, order, colours, text size, view and widths, one tap to switch. */
export function SavedSetups() {
  const s = useSettings();
  const { ref, versions, setVersions } = useReaderState();
  const [name, setName] = useState("");
  const [naming, setNaming] = useState(false);
  /** The setup being renamed, and its new name. */
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);
  const rename = () => {
    if (!renaming) return;
    const text = renaming.text.trim();
    if (text) updateSettings({ setups: s.setups.map((x) => (x.id === renaming.id ? { ...x, name: text } : x)) });
    setRenaming(null);
  };
  const suggested = versions.map((id) => getVersion(id)?.abbr ?? id).join(" / ");
  const mine = s.setups.filter((x) => x.work === ref.work);
  /** What a setup stores, taken from the current view. */
  const snapshot = () => ({
    work: ref.work,
    versions,
    view: s.view,
    fontSize: s.fontSize,
    langColors: s.langColors,
    palette: s.palette,
    versionColors: s.versionColors,
    colWidth: s.colWidth,
    colWidthLandscape: s.colWidthLandscape,
    stackWidth: s.stackWidth,
  });
  // Compare field by field (key order differs between a saved setup and a fresh snapshot).
  const same = (x: (typeof mine)[number]) => {
    const now = snapshot();
    return (Object.keys(now) as (keyof typeof now)[]).every((k) => JSON.stringify(x[k]) === JSON.stringify(now[k]));
  };
  const active = mine.find((x) => x.id === s.activeSetup);
  const changed = !!active && !same(active);
  const save = () => {
    const setup = { id: `${Date.now()}`, name: name.trim() || suggested, ...snapshot() };
    updateSettings({ setups: [...s.setups, setup], activeSetup: setup.id });
    setName("");
    setNaming(false);
  };
  /** Overwrite the setup in use with the current look (keeps its name). */
  const update = () => {
    if (!active) return;
    updateSettings({ setups: s.setups.map((x) => (x.id === active.id ? { ...x, ...snapshot() } : x)) });
  };
  const apply = (x: (typeof mine)[number]) => {
    const { view, fontSize, langColors, palette, versionColors, colWidth, colWidthLandscape, stackWidth } = x;
    updateSettings({ view, fontSize, langColors, palette, versionColors, colWidth, colWidthLandscape, stackWidth, activeSetup: x.id });
    const valid = x.versions.filter((id) => getVersion(id));
    if (valid.length) setVersions(valid);
  };
  /** Back to the app's default look (keeps saved setups, highlights, notes). */
  const reset = () => {
    updateSettings({
      view: null,
      fontSize: 18,
      langColors: false,
      palette: {},
      versionColors: {},
      colWidth: null,
      colWidthLandscape: null,
      stackWidth: null,
      activeSetup: null,
    });
    setVersions(DEFAULT_VERSIONS[ref.work] ?? versionsForWork(ref.work).slice(0, 1).map((v) => v.id));
  };
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Saved setups</h3>
      {mine.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mine.map((x) =>
            renaming?.id === x.id ? (
              <form
                key={x.id}
                className="flex min-h-10 items-center gap-1 rounded-full border border-accent bg-raised pl-3 pr-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  rename();
                }}
              >
                <input
                  autoFocus
                  value={renaming.text}
                  onChange={(e) => setRenaming({ id: x.id, text: e.target.value })}
                  onBlur={rename}
                  onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                  aria-label={`New name for ${x.name}`}
                  className="h-8 w-40 bg-transparent text-base outline-none md:text-sm"
                />
                <button type="submit" className="h-8 rounded-full bg-accent px-3 text-xs font-medium text-accent-ink">
                  OK
                </button>
              </form>
            ) : (
            <span
              key={x.id}
              className={`flex min-h-10 items-center rounded-full border text-sm ${x.id === s.activeSetup ? "border-accent bg-accent-soft text-accent" : "border-line bg-raised"}`}
            >
              <button type="button" onClick={() => apply(x)} className="flex min-h-10 items-center gap-1.5 pl-3 pr-1" title={`Switch to ${x.name}`}>
                <span className="flex">
                  {x.versions.slice(0, 4).map((id) => {
                    const v = getVersion(id);
                    const c = v && x.langColors ? x.versionColors[id] || x.palette[v.language] || DEFAULT_PALETTE[v.language] : "";
                    return <span key={id} className="-ml-1 h-3 w-3 rounded-full border border-paper first:ml-0" style={{ background: c || "var(--faint)" }} />;
                  })}
                </span>
                {x.name}
              </button>
              <button
                type="button"
                onClick={() => setRenaming({ id: x.id, text: x.name })}
                aria-label={`Rename setup ${x.name}`}
                title="Rename"
                className="flex h-10 w-7 items-center justify-center text-faint hover:text-ink"
              >
                <PencilIcon width={13} height={13} />
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ setups: s.setups.filter((y) => y.id !== x.id) })}
                aria-label={`Delete setup ${x.name}`}
                className="flex h-10 w-8 items-center justify-center text-faint hover:text-ink"
              >
                <CloseIcon width={14} height={14} />
              </button>
            </span>
            ),
          )}
        </div>
      )}
      {naming ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={suggested}
            aria-label="Setup name"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 text-base outline-none focus:ring-2 focus:ring-accent/50 md:text-sm"
          />
          <button type="submit" className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">
            Save
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="min-h-11 w-full rounded-lg border border-dashed border-line text-sm text-muted hover:border-faint hover:text-ink"
        >
          + Save as a new setup ({suggested}, {s.fontSize}px{s.langColors ? ", colours" : ""})
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        {changed && (
          <button
            type="button"
            onClick={update}
            className="min-h-10 flex-1 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink"
            title={`Save the current look into “${active!.name}”`}
          >
            Save changes to “{active!.name}”
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="min-h-10 flex-1 rounded-lg border border-line px-3 text-sm text-muted hover:border-faint hover:text-ink"
          title="Default versions, text size, view, widths and colours (your setups, highlights and notes stay)"
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}

/** Swipe-to-change-chapter setting and the floating ‹ › buttons. */
export function ChapterSwipeControl() {
  const { chapterSwipe, floatingNav, continuousScroll, continuousLibrary, autoStudied } = useSettings();
  // each side keeps its own choice: the Library's books flow as one long scroll by default
  const onLibrary = sideOfWork(useReaderState().ref.work) === "library"; // the side of the page being read (as the reader uses)
  const flow = onLibrary ? continuousLibrary : continuousScroll;
  const opts = [
    { id: "one" as const, label: "One finger" },
    { id: "two" as const, label: "Two fingers" },
    { id: "off" as const, label: "Off" },
  ];
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Swipe to change chapter</h3>
      <div role="radiogroup" aria-label="Swipe to change chapter" className="flex rounded-lg border border-line bg-raised p-0.5">
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={chapterSwipe === o.id}
            onClick={() => updateSettings({ chapterSwipe: o.id })}
            className={`h-11 flex-1 rounded-md px-2 text-sm ${chapterSwipe === o.id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-faint">
        {chapterSwipe === "off"
          ? "Use the ‹ › buttons to change chapter."
          : `Swipe ${chapterSwipe === "two" ? "with two fingers " : ""}sideways across most of the screen and let go. In Column view, swipe past the first or last column.`}
      </p>
      <Switch
        checked={flow}
        onChange={(on) => updateSettings(onLibrary ? { continuousLibrary: on } : { continuousScroll: on })}
        label={onLibrary ? "Continuous scroll in the Library" : "Continuous scroll"}
        hint={onLibrary ? "A book reads as one long scroll: the next chapter follows below" : "The next chapter follows below as you read"}
      />
      {flow && (
        <Switch
          checked={autoStudied}
          onChange={(on) => updateSettings({ autoStudied: on })}
          label="Mark chapters as studied as I scroll on"
          hint="Scrolling into the next chapter marks the one you finished"
        />
      )}
      {/* Phones have the ‹ › in the pinned bar above the text; the floating pair is for wider screens. */}
      <div className="hidden desk:block">
        <Switch checked={floatingNav} onChange={(on) => updateSettings({ floatingNav: on })} label="Floating ‹ › chapter buttons" />
      </div>
    </div>
  );
}

/** Private mode (src/lib/privacy.ts): one switch that stops everything that would send data off the device. */
export function PrivacyControl({ heading = false }: { heading?: boolean }) {
  const { privateMode } = useSettings();
  return (
    <div className="space-y-2">
      {heading && <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Privacy</h3>}
      <Switch
        checked={privateMode}
        onChange={(on) => updateSettings({ privateMode: on })}
        label="Private mode: nothing leaves this device"
        hint="Turns off Ask AI, the feedback form (you get our email address instead), the anonymous reading counts, sync and study groups. Reading, listening, notes and downloads all keep working."
      />
      <p className="text-xs text-faint">
        Even with it off, nothing is collected unless you send it: a feedback report or a question to Ask AI. No account, no ads, no tracking.
      </p>
    </div>
  );
}

/** Column width (Column view; separate value in phone landscape) or reading width (Stacked view). */
export function WidthControl() {
  const view = useViewMode();
  const s = useSettings();
  const landscape = useMediaQuery(PHONE_LANDSCAPE_QUERY, false);
  const column = view === "column";
  const key = column ? (landscape ? "colWidthLandscape" : "colWidth") : "stackWidth";
  const [min, max, auto] = column ? [COL_MIN, COL_MAX, landscape ? 14 : 17] : [STACK_MIN, STACK_MAX, 48];
  const value = s[key] ?? auto;
  // While dragging, the settings sheet turns see-through (except this slider) to preview the text behind.
  const peek = (on: boolean) => {
    if (on) document.documentElement.dataset.peek = "1";
    else delete document.documentElement.dataset.peek;
  };
  return (
    <div className="peek-keep space-y-1">
      <div className="flex items-center justify-between">
        <label htmlFor="width-range" className="text-xs font-semibold uppercase tracking-wide text-faint">
          {column ? `Column width${landscape ? " (landscape)" : ""}` : "Reading width"}
          <span className="ml-2 font-normal normal-case tracking-normal tabular-nums">
            {s[key] == null ? "auto" : `${value} rem`}
          </span>
        </label>
        <button type="button" onClick={() => updateSettings({ [key]: null })} className="min-h-8 text-xs text-accent underline-offset-2 hover:underline">
          Auto
        </button>
      </div>
      <input
        id="width-range"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => updateSettings({ [key]: Number(e.target.value) })}
        onPointerDown={() => peek(true)}
        onPointerUp={() => peek(false)}
        onPointerCancel={() => peek(false)}
        onTouchEnd={() => peek(false)}
        onBlur={() => peek(false)}
        className="h-11 w-full accent-[var(--accent)]"
      />
      <p className="text-[11px] text-faint">Drag to preview: the text shows through while you slide.</p>
    </div>
  );
}

const ALIGNS: { id: TextAlign; label: string; lines: [number, number][] }[] = [
  { id: "start", label: "Left", lines: [[4, 20], [4, 14], [4, 18], [4, 11]] },
  { id: "center", label: "Center", lines: [[4, 20], [7, 17], [5, 19], [8, 16]] },
  { id: "end", label: "Right", lines: [[4, 20], [10, 20], [6, 20], [13, 20]] },
  { id: "justify", label: "Justified", lines: [[4, 20], [4, 20], [4, 20], [4, 13]] },
];

/** Verse text alignment: left, center, right or justified. */
export function AlignControl() {
  const { textAlign } = useSettings();
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Text alignment</h3>
      <div role="radiogroup" aria-label="Text alignment" className="flex rounded-lg border border-line bg-raised p-0.5">
        {ALIGNS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={textAlign === a.id}
            onClick={() => updateSettings({ textAlign: a.id })}
            title={a.label}
            className={`flex h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] ${
              textAlign === a.id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"
            }`}
          >
            <svg width={18} height={14} viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              {a.lines.map(([x1, x2], i) => (
                <path key={i} d={`M${x1} ${2 + i * 4.5}H${x2}`} />
              ))}
            </svg>
            {a.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-faint">Hebrew and Arabic are read from the right, so for them Left and Right swap.</p>
    </div>
  );
}

/**
 * A small button in the reading area's toolbar with a panel under it. Escape, a click outside or the
 * button closes it. The panel sits above the text (the toolbar is outside the scrolling text).
 */
export function ToolPopover({ label, title, icon, text, children, wide = false }: { label: string; title: string; icon: React.ReactNode; text?: string; children: React.ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={wrap} className="relative" data-no-swipe>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        title={title}
        className={`flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-line px-2 text-sm desk:h-9 desk:min-w-9 ${open ? "bg-accent-soft text-accent" : "bg-raised text-muted hover:text-ink"}`}
      >
        {icon}
        {text && <span className="hidden 2xl:inline">{text}</span>}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute right-0 top-full z-40 mt-2 max-h-[calc(var(--app-h,100dvh)-10rem)] ${wide ? "w-96" : "w-80"} max-w-[calc(100vw-2rem)] space-y-4 overflow-y-auto overscroll-contain rounded-xl border border-line bg-panel p-4 text-left shadow-xl`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const AlignGlyph = ({ id }: { id: TextAlign }) => {
  const a = ALIGNS.find((x) => x.id === id) ?? ALIGNS[0];
  return (
    <svg width={18} height={14} viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      {a.lines.map(([x1, x2], i) => (
        <path key={i} d={`M${x1} ${2 + i * 4.5}H${x2}`} />
      ))}
    </svg>
  );
};

/** Reading toolbar: column width (Column view) or reading width (Stacked view). */
export function WidthButton() {
  const column = useViewMode() === "column";
  return (
    <ToolPopover label={column ? "Column width" : "Reading width"} title={column ? "Column width" : "Reading width"} text="Width" icon={<WidthIcon width={18} height={18} />}>
      <WidthControl />
    </ToolPopover>
  );
}

/** Reading toolbar: text alignment (the button shows the current one). */
export function AlignButton() {
  const { textAlign } = useSettings();
  const name = ALIGNS.find((a) => a.id === textAlign)?.label ?? "Left";
  return (
    <ToolPopover label={`Text alignment: ${name}`} title="Text alignment: left, center, right or justified" text="Align" icon={<AlignGlyph id={textAlign} />}>
      <AlignControl />
    </ToolPopover>
  );
}

/** Reading toolbar when the reading area is narrow: every text setting in one panel. */
export function TextSettingsButton() {
  return (
    <ToolPopover label="Text settings" title="Columns or stacked, width, alignment, size and colours" wide icon={<span aria-hidden className="font-serif text-base font-semibold leading-none">Aa</span>}>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Layout</h3>
        <ViewToggle full />
      </div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Text size</h3>
        <FontSizeControl />
      </div>
      <WidthControl />
      <AlignControl />
      <LevelMarksControl />
      <LanguageColors />
    </ToolPopover>
  );
}

/** Reading toolbar: text and language colours. */
export function ColoursButton() {
  const { langColors } = useSettings();
  return (
    <ToolPopover label="Text and language colours" title={`Text and language colours${langColors ? " (on)" : ""}`} text="Colours" wide icon={<PaletteIcon width={18} height={18} className={langColors ? "text-accent" : ""} />}>
      <LanguageColors />
    </ToolPopover>
  );
}

/** Colour each language's text; each colour can be changed. */
export function LanguageColors() {
  const s = useSettings();
  return (
    <div className="space-y-2">
      <Switch
        checked={s.langColors}
        onChange={(on) => updateSettings({ langColors: on })}
        label="Coloured text"
        hint={
          <>
            Each version can have its own colour (colour block in “Your columns”); otherwise its language colour is used. “Normal” is black
            in light mode and white in dark mode.
          </>
        }
      />
      {s.langColors && (
        <div className="grid grid-cols-2 gap-1">
          {LANGUAGES.map((l) => {
            const color = s.palette[l.code] ?? DEFAULT_PALETTE[l.code] ?? "";
            return (
              <div key={l.code} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-raised">
                <ColorPicker
                  value={color}
                  label={`${l.name} colour`}
                  onPick={(c) => updateSettings({ palette: { ...getSettings().palette, [l.code]: c } })}
                >
                  <span
                    className={`h-7 w-7 shrink-0 cursor-pointer rounded border border-line ${color ? "" : "bg-ink"}`}
                    style={{ background: color || undefined }}
                    title={color ? undefined : "Normal text colour: black in light mode, white in dark mode"}
                  />
                </ColorPicker>
                <span style={{ color: color || undefined }}>
                  {l.name}
                  {!color && <span className="block text-[11px] leading-tight text-faint">Normal (black / white in dark mode)</span>}
                </span>
              </div>
            );
          })}
          <SelectedVersionColors />
          <button
            type="button"
            onClick={() => updateSettings({ palette: {}, versionColors: {} })}
            className="col-span-2 min-h-11 rounded-lg text-sm text-accent hover:bg-raised"
          >
            Reset colours
          </button>
        </div>
      )}
    </div>
  );
}

/** Version colours for the columns being read (also in the order list). */
function SelectedVersionColors() {
  const { versions } = useReaderState();
  const s = useSettings();
  return (
    <div className="col-span-2 space-y-1 border-t border-line pt-2">
      <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Your versions</p>
      <div className="grid grid-cols-2 gap-1">
        {versions.map((id) => {
          const v = getVersion(id);
          if (!v) return null;
          return (
            <div key={id} className="flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm hover:bg-raised">
              <VersionColorSwatch id={id} language={v.language} abbr={v.abbr} />
              <span className="min-w-0 flex-1 truncate" style={{ color: versionColor(s, v) }}>
                {v.abbr}
              </span>
              {s.versionColors[id] && (
                <button
                  type="button"
                  aria-label={`Use the language colour for ${v.abbr}`}
                  title="Use the language colour"
                  onClick={() => {
                    const next = { ...s.versionColors };
                    delete next[id];
                    updateSettings({ versionColors: next });
                  }}
                  className="flex h-9 w-7 items-center justify-center text-faint hover:text-ink"
                >
                  <CloseIcon width={14} height={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Languages</p>
    </div>
  );
}

/** Choose which versions/languages appear as columns. Used in the desktop popover and the mobile sheet. */
export function VersionChooser() {
  const { ref, versions, setVersions } = useReaderState();
  const all = versionsForWork(ref.work);
  const selected = new Set(versions);
  const lastOne = versions.length <= 1;
  const toggle = (id: string, on: boolean) => {
    // New versions are added at the end; removing keeps the order of the rest.
    setVersions(on ? [...versions, id] : versions.filter((v) => v !== id));
  };

  return (
    <div className="space-y-4">
      <OrderList versions={versions} setVersions={setVersions} />
      {/* Languages this book has, together at the top; the rest fold into one "coming soon" line (ticket 8ff7bbd1). */}
      {LANGUAGES.filter((lang) => all.some((v) => v.language === lang.code)).map((lang) => {
        const vs = all.filter((v) => v.language === lang.code);
        const isBase = lang.code === "en";
        return (
          <section key={lang.code} aria-label={lang.name}>
            <h3 className="mb-1 flex items-baseline gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-faint">
              {lang.name}
              {lang.native !== lang.name && (
                <span lang={lang.code} dir={lang.dir} className="font-normal normal-case tracking-normal">
                  {lang.native}
                </span>
              )}
              {isBase && <span className="font-normal normal-case tracking-normal">· base language</span>}
            </h3>
            {vs.map((v) => (
              <VersionRow key={v.id} v={v} checked={selected.has(v.id)} onChange={(c) => toggle(v.id, c)} disableUncheck={lastOne} />
            ))}
          </section>
        );
      })}
      {(() => {
        const soon = LANGUAGES.filter((lang) => !all.some((v) => v.language === lang.code));
        if (!soon.length) return null;
        return (
          <details className="px-2 text-xs text-faint">
            <summary className="cursor-pointer select-none py-1 hover:text-muted">
              Not yet in {soon.length} other language{soon.length === 1 ? "" : "s"}
            </summary>
            <p className="pt-1 leading-relaxed">{soon.map((l) => l.name).join(" · ")}</p>
          </details>
        );
      })()}
    </div>
  );
}
