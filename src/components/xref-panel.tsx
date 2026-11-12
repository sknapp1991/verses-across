"use client";
/**
 * Cross references: the verses most like the one tapped — in its own religion and, if ticked, in
 * others (e.g. a Gospel verse beside the closest verses of the Quran or the Dhammapada).
 * Similarity is precomputed from the meaning of the text (scripts/xref/build.py → R2, served by /api/xref);
 * it finds related wording and themes, not doctrinal agreement. Wide screen: a tab in the side dock
 * (with Search and My Study); phone: a sheet over the bottom of the reader.
 */
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { selectXref, useUi } from "@/lib/ui-store";
import { useReaderState } from "./use-reader-state";
import { askAboutVerse, sendAi, useAiChat } from "@/lib/ai-chat";
import { LIBRARY_SHELVES, shelvesOf, sideOfWork } from "@/lib/side";
import { BOOK_SHELVES, catalog, chapterTitle, isLiteratureWork, DEFAULT_VERSIONS, findBook, getVersion, readHref, type BookRef } from "@/lib/catalog";
import { fetchBook } from "@/lib/chapter-store";
import { loadThemeIndex, loadThemeRefs } from "@/lib/themes";
import { updateSettings, useMediaQuery, useSettings, WIDE_QUERY } from "@/lib/settings";
import { CloseIcon, SparkIcon } from "./icons";
import { modeButtonClass } from "./highlight-mode";
import { PanelHeader } from "./panel-header";

type Hit = { work: string; book: string; chapter: number; v: string; score: number };

// ── the verses the panel compares (tap verses while the mode is on: each tap adds or removes one) ──
type Sel = BookRef & { verse: string };
let selected: Sel[] = [];
const EMPTY: Sel[] = [];
const subs = new Set<() => void>();
const emit = (next: Sel[]) => {
  selected = next;
  subs.forEach((l) => l());
};
/** Tap a verse: add it to (or take it out of) the selection; a verse in another chapter starts a new one. */
export function showXref(r: Sel) {
  selectXref(true);
  const sameChapter = selected.length && selected[0].work === r.work && selected[0].book === r.book && selected[0].chapter === r.chapter;
  if (!sameChapter) return emit([r]);
  const has = selected.some((x) => x.verse === r.verse);
  emit(has ? selected.filter((x) => x.verse !== r.verse) : [...selected, r].sort((a, b) => parseInt(a.verse, 10) - parseInt(b.verse, 10)));
}
const useXrefSelection = () =>
  useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => selected,
    () => EMPTY,
  );
/** "John 3:16" or "John 3:16, 18, 20" */
const selectionLabel = (sel: Sel[]) => (sel.length ? `${chapterTitle(findBook(sel[0].work, sel[0].book), sel[0].chapter, sel[0].book)}:${sel.map((x) => x.verse).join(", ")}` : "");

const files = new Map<string, Promise<Record<string, [string, number][]>>>();
function loadXref(work: string, book: string) {
  const k = `${work}/${book}`;
  let p = files.get(k);
  if (!p) {
    p = fetch(`/api/xref/${k}.json`).then((r) => (r.ok ? r.json() : {}), () => ({}));
    files.set(k, p);
  }
  return p;
}
const parseRef = (s: string, score: number): Hit => {
  const [work, book, cv] = s.split("/");
  const [c, v] = cv.split(":");
  return { work, book, chapter: Number(c), v, score };
};
const label = (h: { work: string; book: string; chapter: number; v: string }) =>
  `${chapterTitle(findBook(h.work, h.book), h.chapter, h.book)}:${h.v}`;
const religionOf = (work: string, book: string) => findBook(work, book)?.religion;

export function XrefToggle({ full = false, tile = false, onToggle }: { full?: boolean; tile?: boolean; onToggle?: (on: boolean) => void }) {
  const { xrefMode } = useSettings();
  const { panel, tabs, split, xrefActive } = useUi();
  const wide = useMediaQuery(WIDE_QUERY, true);
  // Wide screen, open behind another tab of the dock: the button brings it to the front.
  const hidden = wide && xrefMode && !split && !!panel && tabs.includes(panel) && !xrefActive;
  return (
    <button
      type="button"
      aria-pressed={xrefMode}
      onClick={() => {
        if (hidden) return selectXref(true);
        if (xrefMode) {
          closeXref();
          onToggle?.(false);
          return;
        }
        updateSettings({ xrefMode: true, wordMode: false, highlightMode: false });
        selectXref(true);
        onToggle?.(true);
      }}
      title="Cross references: tap a verse to see similar verses (in this religion or others)"
      aria-label="Cross references"
      className={
        tile
          ? modeButtonClass(xrefMode, "tile")
          : `flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm desk:border ${full ? "w-full border" : "w-11 px-0"} ${
              xrefMode ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:bg-raised hover:text-ink desk:bg-raised"
            }`
      }
    >
      <XrefIcon />
      {full && <span>Cross references {xrefMode ? "on" : "off"}</span>}
      {tile && <span>Cross refs</span>}
    </button>
  );
}

const XrefIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 4h4v6H7zM13 14h4v6h-4z" />
    <path d="M11 7h3a3 3 0 013 3v4M13 17h-3a3 3 0 01-3-3v-4" />
  </svg>
);

/** One verse's text in a work's default version (cached per book by the chapter store). */
function useVerseText(h: Hit | null) {
  const [t, setT] = useState<{ k: string; text: string | null } | null>(null);
  const k = h ? `${h.work}/${h.book}/${h.chapter}:${h.v}` : "";
  useEffect(() => {
    if (!h) return;
    const id = DEFAULT_VERSIONS[h.work]?.[0];
    if (!id) return;
    let live = true;
    fetchBook(h.work, id, h.book)
      .then((b) => b.chapters[String(h.chapter)]?.verses.find((x) => x.v === h.v)?.t ?? null)
      .catch(() => null)
      .then((text) => live && setT({ k, text }));
    return () => {
      live = false;
    };
    // h's fields are in k
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return t?.k === k ? t.text : undefined;
}

/**
 * Always mounted by the reader: keeps the chosen verses marked in the text and, on a phone, shows the
 * panel as a sheet over the bottom of the reader. On a wide screen the panel is a tab in the side dock
 * (XrefDockPanel, in app-shell), next to Search and My Study.
 */
export function XrefPanel({ bookRef, versions, raised }: { bookRef: BookRef; versions: string[]; raised: boolean }) {
  const settings = useSettings();
  const wide = useMediaQuery(WIDE_QUERY, true);
  const [sheetH, setSheetH] = useState<number | null>(null);
  const all = useXrefSelection();
  const sel = all.filter((x) => x.work === bookRef.work && x.book === bookRef.book && x.chapter === bookRef.chapter);
  const key = sel.map((x) => x.verse).join(",");

  // Keep the chosen verses marked in the text.
  useEffect(() => {
    if (!settings.xrefMode) return;
    const els = sel.flatMap((x) => [...document.querySelectorAll(`[data-v="${CSS.escape(x.verse)}"]`)]);
    els.forEach((el) => el.classList.add("is-xref"));
    return () => els.forEach((el) => el.classList.remove("is-xref"));
    // sel's verses are in key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, settings.xrefMode, bookRef.work, bookRef.book, bookRef.chapter]);

  if (!settings.xrefMode || wide) return null;
  return (
    <section
      aria-label="Cross references"
      data-no-swipe
      style={sheetH ? { height: sheetH } : undefined}
      className={`fixed inset-x-0 z-30 flex h-[55dvh] flex-col overflow-hidden rounded-t-2xl border border-line bg-panel pb-[env(safe-area-inset-bottom)] shadow-2xl ${
        raised ? "bottom-28" : "bottom-0"
      }`}
    >
      {/* Phone: drag the top edge to make the sheet taller or shorter. */}
      <div
        onPointerDown={(e) => {
          const startY = e.clientY;
          const startH = sheetH ?? window.innerHeight * 0.55;
          const onMove = (ev: PointerEvent) =>
            setSheetH(Math.min(window.innerHeight - 40, Math.max(window.innerHeight * 0.25, startH - (ev.clientY - startY))));
          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
        aria-label="Drag to resize"
        className="absolute inset-x-0 top-0 z-10 flex h-3 touch-none justify-center"
      >
        <span className="mt-1 h-1 w-10 rounded-full bg-line" />
      </div>
      <XrefBody bookRef={bookRef} versions={versions} phone />
    </section>
  );
}

/** The cross references panel as a tab in the side dock (wide screens). */
export function XrefDockPanel() {
  const { ref, versions } = useReaderState();
  return <XrefBody bookRef={ref} versions={versions} />;
}

/** Turn cross references off (closes its panel or tab). */
export function closeXref() {
  updateSettings({ xrefMode: false });
  selectXref(false);
}

function XrefBody({ bookRef, versions, phone = false }: { bookRef: BookRef; versions: string[]; phone?: boolean }) {
  const settings = useSettings();
  const ai = useAiChat();
  const all = useXrefSelection();
  const sel = all.filter((x) => x.work === bookRef.work && x.book === bookRef.book && x.chapter === bookRef.chapter);
  const verse = sel[0] ?? null;
  const [data, setData] = useState<{ k: string; hits: Hit[] } | null>(null);
  const key = sel.length ? `${verse!.work}/${verse!.book}/${verse!.chapter}:${sel.map((x) => x.verse).join(",")}` : "";

  useEffect(() => {
    if (!verse) return;
    let live = true;
    loadXref(verse.work, verse.book).then((d) => {
      // Several verses: every match of any of them, each at its best score; the chosen verses themselves left out.
      const best = new Map<string, number>();
      const mine = new Set(sel.map((x) => `${x.work}/${x.book}/${x.chapter}:${x.verse}`));
      for (const x of sel)
        for (const [r, sc] of d[`${x.chapter}:${x.verse}`] ?? []) if (!mine.has(r) && sc > (best.get(r) ?? 0)) best.set(r, sc);
      const hits = [...best].sort((a, b) => b[1] - a[1]).map(([r, sc]) => parseRef(r, sc));
      if (live) setData({ k: key, hits });
    });
    return () => {
      live = false;
    };
    // verse's fields are in key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const own = religionOf(bookRef.work, bookRef.book);
  // (a book shelf by reference too: Paine on the Freethought shelf)
  const book = isLiteratureWork(bookRef.work) || (!!own && BOOK_SHELVES.has(own.id));
  // the Scriptures side's shelves (with Philosophy), the page's own one left out
  const others = shelvesOf("scriptures").filter((r) => r.id !== own?.id);
  const hits = data?.k === key ? data.hits : null;
  // Scriptures | Library: the page's own side first; the other side's matches only when asked.
  const pageSide = sideOfWork(bookRef.work);
  const showScriptures = pageSide === "scriptures" || settings.xrefOtherSide;
  const showLibrary = pageSide === "library" || settings.xrefOtherSide;
  // "Show more" under a section or religion: 6 more matches per tap (ticket 31354432), reset for a new verse.
  const [more, setMore] = useState<{ k: string; m: Record<string, number> }>({ k: "", m: {} });
  const extra = more.k === key ? more.m : {};
  const showMore = (id: string) => setMore((s) => ({ k: key, m: { ...(s.k === key ? s.m : {}), [id]: ((s.k === key ? s.m[id] : 0) ?? 0) + 6 } }));
  const groups = useMemo(() => {
    if (!hits) return [];
    const base = sel.length > 1 ? 8 : 6;
    const lim = (id: string) => base + (extra[id] ?? 0);
    // A book: every religion with a match. A scripture: the religions ticked in "Look in".
    const want = book
      ? [...(own && !LIBRARY_SHELVES.has(own.id) ? [own.id] : []), ...others.map((r) => r.id)]
      : [...(settings.xrefSame && own ? [own.id] : []), ...others.map((r) => r.id).filter((id) => settings.xrefOthers.includes(id))];
    const scripture = !showScriptures
      ? []
      : want
          .map((id) => {
            const religion = catalog.religions.find((r) => r.id === id)!;
            const mine = hits.filter((h) => sideOfWork(h.work) === "scriptures" && religionOf(h.work, h.book)?.id === id);
            // Split by section (Christianity: Old Testament · New Testament · Apocrypha…), each with its own best
            // matches, when the matches come from more than one (ticket 31354432).
            const sections = (religion?.collections ?? [])
              .map((c) => {
                const all = mine.filter((h) => findBook(h.work, h.book)?.collection.id === c.id);
                const sid = `${id}/${c.id}`;
                return { id: sid, name: c.name, hits: all.slice(0, lim(sid)), total: all.length };
              })
              .filter((s) => s.hits.length > 0);
            return sections.length > 1
              ? { religion, hits: sections.flatMap((s) => s.hits), sections, total: mine.length }
              : { religion, hits: mine.slice(0, lim(id)), sections: undefined, total: mine.length };
          })
          .filter((g) => g.religion && (!book || g.hits.length > 0)); // a book: only the religions with a match
    const library = !showLibrary
      ? []
      : shelvesOf("library")
          .map((r) => {
            const all = hits.filter((h) => sideOfWork(h.work) === "library" && religionOf(h.work, h.book)?.id === r.id);
            return {
              religion: r,
              hits: all.slice(0, lim(r.id)),
              sections: undefined as { id: string; name: string; hits: Hit[]; total: number }[] | undefined,
              total: all.length,
            };
          })
          .filter((g) => g.hits.length > 0);
    return pageSide === "library" ? [...library, ...scripture] : [...scripture, ...library];
    // others is derived from own
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits, settings.xrefSame, settings.xrefOthers, own?.id, book, showScriptures, showLibrary, pageSide, more]);
  const moreButton = (id: string, shown: number, total: number) =>
    total > shown ? (
      <button type="button" onClick={() => showMore(id)} className="mt-1 min-h-8 px-1 text-xs font-medium text-accent hover:underline">
        Show more ({total - shown} more)
      </button>
    ) : null;
  const otherSide = pageSide === "library" ? "Scriptures" : "Library";
  const otherSwitch = (
    <label className="-mx-3 flex min-h-10 items-center gap-2 border-b border-line px-3 text-xs text-muted">
      <input
        type="checkbox"
        checked={settings.xrefOtherSide}
        onChange={(e) => updateSettings({ xrefOtherSide: e.target.checked })}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      Include the {otherSide}
      <span className="text-faint">{pageSide === "library" ? "(the world’s scriptures)" : "(classic books: fiction, poetry, drama…)"}</span>
    </label>
  );

  const [lookOpen, setLookOpen] = useState(false);
  const lookingIn = [...(settings.xrefSame && own ? [own.name] : []), ...others.filter((r) => settings.xrefOthers.includes(r.id)).map((r) => r.name)];
  const toggleOther = (id: string) =>
    updateSettings({ xrefOthers: settings.xrefOthers.includes(id) ? settings.xrefOthers.filter((x) => x !== id) : [...settings.xrefOthers, id] });

  const compare = () => {
    if (!verse) return;
    const list = groups.flatMap((g) => g.hits.slice(0, 3).map(label));
    askAboutVerse({ reference: selectionLabel(sel), at: { ...verse }, texts: [] });
    void sendAi(
      `Compare ${selectionLabel(sel)} with these similar passages${list.length ? `: ${list.join("; ")}` : ""}. What do they share, and where do they genuinely differ in meaning or context?`,
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        icon={<XrefIcon />}
        title="Cross references"
        extra={verse ? selectionLabel(sel) : undefined}
        onClose={closeXref}
        closeLabel="Close cross references"
        className={phone ? "pt-3" : ""}
      />
      {sel.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line px-3 py-2 text-xs">
          <span className="mr-1 font-semibold uppercase tracking-wide text-faint">Verses</span>
          {sel.map((x) => (
            <button
              key={x.verse}
              type="button"
              onClick={() => showXref(x)}
              title="Take this verse out"
              className="flex min-h-8 items-center gap-1 rounded-full border border-accent bg-accent-soft pl-2.5 pr-1.5 font-medium text-accent"
            >
              {x.verse} <CloseIcon width={11} height={11} />
            </button>
          ))}
          <span className="text-faint">· tap more verses to add them</span>
          {sel.length > 1 && (
            <button type="button" onClick={() => emit([])} className="ml-auto min-h-8 px-1 text-muted underline-offset-2 hover:text-ink hover:underline">
              Clear
            </button>
          )}
        </div>
      )}
      {sel.length > 0 && <ThemeChips refs={sel.map((x) => `${x.work}/${x.book}/${x.chapter}:${x.verse}`)} />}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-2 text-sm">
        {/* Which religions to look in: one line until opened (the full list of 20 would fill a phone's sheet).
            A book of literature always looks in every scripture, so it has none. */}
        {book ? (
          <p className="-mx-3 -mt-2 border-b border-line px-3 py-2 text-xs text-muted">
            {pageSide === "library" ? "Related passages in other books" : "Related passages in the world’s scriptures and other books"}
          </p>
        ) : (
        <div className="-mx-3 -mt-2 border-b border-line px-3 py-2 text-xs">
          {!lookOpen ? (
            <button
              type="button"
              onClick={() => setLookOpen(true)}
              aria-expanded={false}
              className="flex min-h-8 w-full items-center gap-2 text-left"
            >
              <span className="shrink-0 font-semibold uppercase tracking-wide text-faint">Look in</span>
              <span className="min-w-0 flex-1 truncate text-muted">{lookingIn.length ? lookingIn.join(", ") : "nothing ticked"}</span>
              <span className="shrink-0 font-medium text-accent">Change</span>
            </button>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold uppercase tracking-wide text-faint">Look in</p>
                <button
                  type="button"
                  onClick={() => updateSettings({ xrefSame: true, xrefOthers: others.map((r) => r.id) })}
                  className="ml-auto min-h-7 px-1 text-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ xrefSame: true, xrefOthers: [] })}
                  className="min-h-7 px-1 text-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  Only {own?.name ?? "this one"}
                </button>
                <button type="button" onClick={() => setLookOpen(false)} aria-expanded className="min-h-7 rounded-md bg-accent-soft px-2 font-medium text-accent">
                  Done
                </button>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {own && (
                  <label className="flex min-h-8 cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={settings.xrefSame} onChange={(e) => updateSettings({ xrefSame: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                    {own.name} <span className="text-faint">(same)</span>
                  </label>
                )}
                {others.map((r) => (
                  <label key={r.id} className="flex min-h-8 cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={settings.xrefOthers.includes(r.id)} onChange={() => toggleOther(r.id)} className="h-4 w-4 accent-[var(--accent)]" />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
        {otherSwitch}
        {!verse ? (
          <p className="text-muted">
            {pageSide === "library"
              ? "Tap a paragraph to see the passages in other books closest to it in meaning."
              : book
                ? "Tap a paragraph to see the scripture passages closest to it in meaning."
                : "Tap a verse (or several) to see the verses most like it. Use “Change” above to look across other religions."}
          </p>
        ) : !hits ? (
          <p className="animate-pulse text-muted">Loading…</p>
        ) : !groups.length ? (
          <p className="text-muted">
            {pageSide === "library"
              ? settings.xrefOtherSide
                ? "No close match for this paragraph."
                : "No close match in the Library for this paragraph. Try “Include the Scriptures” above."
              : book
                ? "No close match for this paragraph."
                : "Tick at least one religion (“Change” above)."}
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.religion.id}>
              <p className="mb-1.5 rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold uppercase tracking-wide text-accent">{g.religion.name}</p>
              {g.sections ? (
                <div className="space-y-2">
                  {g.sections.map((s) => (
                    <div key={s.id}>
                      <p className="mb-1 rounded-md border-l-2 border-accent bg-raised px-2 py-0.5 text-xs font-medium text-ink">{s.name}</p>
                      <ul className="space-y-1.5">
                        {s.hits.map((h) => (
                          <HitRow key={`${h.work}/${h.book}/${h.chapter}:${h.v}`} h={h} versions={h.work === bookRef.work ? versions : undefined} />
                        ))}
                      </ul>
                      {moreButton(s.id, s.hits.length, s.total)}
                    </div>
                  ))}
                </div>
              ) : g.hits.length ? (
                <>
                  <ul className="space-y-1.5">
                    {g.hits.map((h) => (
                      <HitRow key={`${h.work}/${h.book}/${h.chapter}:${h.v}`} h={h} versions={h.work === bookRef.work ? versions : undefined} />
                    ))}
                  </ul>
                  {moreButton(g.religion.id, g.hits.length, g.total)}
                </>
              ) : (
                <p className="text-xs text-muted">No close match.</p>
              )}
            </div>
          ))
        )}
      </div>
      <div className="shrink-0 space-y-1 border-t border-line px-3 py-2">
        {ai.ready && verse && groups.some((g) => g.hits.length) && (
          <button type="button" onClick={compare} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs hover:border-accent hover:text-accent">
            <SparkIcon width={14} height={14} /> Ask AI to compare these
          </button>
        )}
        <p className="text-[11px] leading-snug text-faint">
          Matched by meaning of the English text (an AI similarity model), so it finds shared themes and wording — not agreement in
          doctrine.
        </p>
      </div>
    </div>
  );
}

function HitRow({ h, versions }: { h: Hit; versions?: string[] }) {
  const text = useVerseText(h);
  const ver = getVersion(DEFAULT_VERSIONS[h.work]?.[0] ?? "");
  return (
    <li className="rounded-lg border border-line bg-raised/50 px-2 py-1.5">
      <div className="flex items-baseline gap-2">
        <Link href={readHref(h, versions, h.v)} scroll={false} className="font-medium text-accent underline decoration-accent/40 underline-offset-2">
          {label(h)}
        </Link>
        <span className="ml-auto shrink-0 text-[10px] tabular-nums text-faint" title="How close in meaning (0–100)">
          {h.score}%
        </span>
      </div>
      <p className="mt-0.5 line-clamp-4 font-serif leading-snug text-muted" dir={ver?.dir}>
        {text === undefined ? "…" : (text ?? "")}
      </p>
    </li>
  );
}

/** The themes a chosen verse is one of the strongest passages for (public/themes/refs.json), as links to /themes/<id>. */
function ThemeChips({ refs }: { refs: string[] }) {
  const key = refs.join("|");
  const [got, setGot] = useState<{ key: string; list: { id: string; name: string }[] } | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([loadThemeRefs(), loadThemeIndex()]).then(([m, index]) => {
      const ids = [...new Set(key.split("|").flatMap((r) => m[r] ?? []))];
      const names = new Map(index.map((t) => [t.id, t.name]));
      if (live) setGot({ key, list: ids.filter((id) => names.has(id)).map((id) => ({ id, name: names.get(id)! })) });
    });
    return () => {
      live = false;
    };
  }, [key]);
  const list = got?.key === key ? got.list : [];
  if (!list.length) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line px-3 py-2 text-xs">
      <span className="mr-1 font-semibold uppercase tracking-wide text-faint">Themes</span>
      {list.map((t) => (
        <Link key={t.id} href={`/themes/${t.id}`} className="flex min-h-8 items-center rounded-full border border-line px-2.5 text-muted hover:border-accent hover:text-accent">
          {t.name}
        </Link>
      ))}
    </div>
  );
}
