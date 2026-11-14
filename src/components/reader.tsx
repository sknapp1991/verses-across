"use client";
import { SITE_NAME } from "@/lib/site";
import { AlignButton, ColoursButton, FontSizeControl, TextSettingsButton, ViewToggle, WidthButton } from "./controls";
import { SkipFrontMatter } from "./skip-front-matter";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { alignVerses, type AlignedRow } from "@/lib/align";
import { adjacentChapters, catalog, chapterTitle, findBook, getVersion, readHref, type BookRef } from "@/lib/catalog";
import { chapterKey, loadChapter, useChapters, type ChapterEntry } from "@/lib/chapter-store";
import { getLanguage } from "@/lib/languages";
import { joinAbbrs, seoChapterName } from "@/lib/seo-shared";
import type { Verse, Version } from "@/lib/schema";
import {
  FONT_MAX,
  FONT_MIN,
  versionColor,
  PHONE_LANDSCAPE_QUERY,
  updateSettings,
  useMediaQuery,
  useSettings,
  useViewMode,
  WIDE_QUERY,
} from "@/lib/settings";
import { ChevronDown, ChevronLeft, ChevronRight, GripIcon, LanguagesIcon, PauseIcon, PlayIcon } from "./icons";
import { useColumnDrag } from "./use-column-drag";
import { openSearch } from "./search-panel";
import { NoteLine, VerseBox, VerseCtx, VerseText, type Marks, type VerseActions } from "./verse-parts";
import { VerseMenu, verseReference, type VerseText as VerseTextInfo } from "./verse-menu";
import { VerseQuick, type QuickAt } from "./verse-quick";
import { pickWord, WordStudy } from "./word-study";
import { LevelLegend, LevelsButton, useLevelMarks } from "./reading-levels";
import { RedLetterCtx, useRedLetter, VerseWords } from "./red-letter";
import { DiffMark } from "./diff-mark";
import { StudiedBox } from "./studied-box";
import { FloatingNav } from "./floating-nav";
import { TapModesButton } from "./tap-modes";
import { showXref, XrefPanel } from "./xref-panel";
import { wordAt } from "./use-gestures";
import { chapterMarks, getItem, highlightBg, setHighlight, toggle, useStudy } from "@/lib/study";
import { openSheet, openVerseMenu, toast } from "@/lib/ui-store";
import { setReadingContext } from "@/lib/ai-chat";
import { getPosition, savePosition } from "@/lib/reading-position";
import { ReadAlongBar, ReadAlongSpacer, useReadAlong, type ReadAlong } from "./audio-player";
import { useReaderState } from "./use-reader-state";
import { countOnce } from "@/lib/count";
import { useSpeech } from "@/lib/speech";
import { gestureLock, useChapterSwipe, useScrollIdle, type SwipeHint } from "./use-chapter-swipe";
import { sideOfWork } from "@/lib/side";
import { SimilarBooks } from "./similar-books";
import { FROM_HOME } from "./page-chrome";

type Col = { version: Version; entry: ChapterEntry; retry: () => void };

/**
 * The chapter just entered by scrolling on (continuous scroll), so its saved position isn't restored,
 * and how far past its heading the reader had already scrolled (kept, so the page doesn't jump).
 */
let continuedInto: string | null = null;
let continuedOffset = 0;

/**
 * Where a chapter opens. Going to a chapter (a link: library, ‹ ›, search; a swipe; ← / →) opens it at
 * verse 1. Coming back to it (opening the app, a reload, Back / Forward) returns to the verse you were
 * at. A link with #verse always goes to that verse.
 */
let goingTo: string | null = null; // "bible/psa/24": the chapter just asked for by a link, swipe or key
const chapterOf = (href: string) => /\/read\/([^/?#]+\/[^/?#]+\/[^/?#]+)/.exec(href)?.[1] ?? null;
function goTo(href: string) {
  goingTo = chapterOf(href);
}
if (typeof document !== "undefined")
  document.addEventListener(
    "click",
    (e) => {
      // Only a plain click that navigates here (not a new tab or window), to another chapter.
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self")) return;
      const to = chapterOf(new URL(a.href, location.href).pathname);
      goingTo = to && to !== chapterOf(location.pathname) ? to : null;
    },
    true,
  );
/** Decided once per chapter visit (the jump effect runs several times while the columns load). */
let resumeDecided: { chapter: string; resume: boolean } = { chapter: "", resume: false };
function shouldResume(chapter: string) {
  if (resumeDecided.chapter !== chapter) {
    resumeDecided = { chapter, resume: goingTo !== chapter };
    goingTo = null;
  }
  return resumeDecided.resume;
}

/**
 * Continuous scroll: the start of the next chapter, shown below this one. When its heading reaches the
 * top of the screen we move on to that chapter, which then shows at the top: the same picture, now the
 * real (tappable) chapter. While read-aloud is playing we wait, so reading isn't interrupted.
 */
/**
 * How far through the chapter: a thin bar under the top bar that fills to the end of this chapter's text (the next
 * chapter flowing below doesn't count), and while scrolling, a small note with the percentage and the minutes left
 * at an average reading pace (230 words a minute), in the bottom corner.
 */
function ReadingProgress({ scroller, end, chapter, versions }: { scroller: RefObject<HTMLDivElement | null>; end: RefObject<HTMLDivElement | null>; chapter: string; versions: number }) {
  const bar = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    let frame = 0;
    let hide = 0;
    // the chapter's words, counted once (the text above the Studied box)
    let words = 0;
    const count = () => {
      const stop = end.current;
      let n = 0;
      for (const el of sc.querySelectorAll<HTMLElement>("[data-text]")) {
        if (stop && el.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_PRECEDING) break; // past this chapter
        n += (el.textContent ?? "").split(/\s+/).length;
      }
      return Math.round(n / Math.max(1, versions)); // one version's words (several are shown side by side)
    };
    const update = (showNote: boolean) => {
      frame = 0;
      const stop = end.current;
      if (!stop || !bar.current) return;
      // (down the page in every view: side-by-side columns scroll down too)
      const endAt = stop.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop; // the text's end, in scroll px
      const span = endAt - sc.clientHeight * 0.85; // done when the last lines are on screen
      let f = span > 0 ? sc.scrollTop / span : 1;
      f = Math.max(0, Math.min(1, f));
      bar.current.style.transform = `scaleX(${f})`;
      if (!note.current) return;
      if (!words) words = count();
      const left = Math.round(((1 - f) * words) / 230);
      note.current.textContent = f >= 0.995 ? "End of chapter" : `${Math.round(f * 100)}%${words > 150 ? ` · ${left < 1 ? "under a minute" : `${left} min`} left` : ""}`;
      if (showNote) {
        note.current.style.opacity = "1";
        clearTimeout(hide);
        hide = window.setTimeout(() => note.current && (note.current.style.opacity = "0"), 1400);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => update(true));
    };
    update(false);
    const settle = window.setTimeout(() => update(false), 600); // after the text and pictures are laid out
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      sc.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(hide);
      clearTimeout(settle);
    };
  }, [scroller, end, chapter, versions]);
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-40 h-[3px] bg-line/40">
        <div ref={bar} className="h-full origin-left bg-accent/80 transition-transform duration-150 ease-out" style={{ transform: "scaleX(0)" }} />
      </div>
      <div
        ref={note}
        aria-hidden
        className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-3 z-40 rounded-full border border-line bg-panel/95 px-2.5 py-1 text-xs tabular-nums text-muted opacity-0 shadow-sm transition-opacity duration-300"
      />
    </>
  );
}

function NextChapterFlow({
  next,
  versions,
  scroller,
  column,
  hold,
  onGo,
}: {
  next: BookRef;
  versions: string[];
  scroller: RefObject<HTMLDivElement | null>;
  column: boolean;
  hold: boolean;
  /** `past`: how far the reader has scrolled beyond the next chapter's heading. */
  onGo: (past: number) => void;
}) {
  const keys = versions.map((v) => chapterKey(next.work, v, next.book, next.chapter));
  const entries = useChapters(keys);
  const rows = useMemo(() => alignVerses(entries.map((e) => (e.status === "ok" ? e.data : undefined))), [entries]);
  const book = findBook(next.work, next.book);
  const settings = useSettings();
  const box = useRef<HTMLDivElement>(null);
  const go = useRef(onGo);
  useEffect(() => {
    go.current = onGo;
  });
  useEffect(() => {
    const sc = scroller.current;
    if (!sc || hold) return;
    let done = false;
    let idle = 0;
    // Only the reader's own scrolling counts (a touch, wheel or key started it), never the position this
    // chapter was just set to: otherwise a long carried-over offset could run on through short chapters.
    let armed = false;
    const arm = () => {
      armed = true;
    };
    // Move on only once scrolling has come to rest with the next chapter's heading at or above the top:
    // switching during a flick stops the phone's momentum and the page jumps.
    const settle = () => {
      const el = box.current;
      if (done || !el || !armed) return;
      const top = sc.getBoundingClientRect().top;
      const past = top - el.getBoundingClientRect().top; // px scrolled past its heading
      if (past >= -1) {
        done = true;
        // Measured from the first verse (the real chapter's heading is taller: it has the buttons), so the
        // lines being read stay exactly where they are; negative while still inside the heading. At most the
        // preview's own length (a flick into the space after it lands at the preview's end, not further).
        // Column view lines up cells (the real chapter aligns its [data-v] cells), stacked view lines up the text.
        const cells = el.querySelectorAll<HTMLElement>("[data-pv-cell]");
        const texts = cells.length ? cells : el.querySelectorAll<HTMLElement>(".reader-text");
        const first = texts[0];
        const last = texts[texts.length - 1];
        const span = first && last ? last.getBoundingClientRect().bottom - first.getBoundingClientRect().top : 0;
        go.current(first ? Math.min(top - first.getBoundingClientRect().top, span) : Math.max(0, past) - 1e6);
      }
    };
    const onScroll = () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, 180);
    };
    const inputs = ["touchstart", "wheel", "keydown", "pointerdown"] as const;
    inputs.forEach((t) => sc.addEventListener(t, arm, { passive: true }));
    sc.addEventListener("scroll", onScroll, { passive: true });
    sc.addEventListener("scrollend", settle);
    return () => {
      window.clearTimeout(idle);
      inputs.forEach((t) => sc.removeEventListener(t, arm));
      sc.removeEventListener("scroll", onScroll);
      sc.removeEventListener("scrollend", settle);
    };
  }, [scroller, hold]);
  if (!book) return null;
  const vers = versions.map((id) => getVersion(id));
  const multi = versions.length > 1;
  return (
    <div ref={box} aria-hidden>
      <div className={`border-t border-line ${column ? "sticky left-0 w-[100cqw]" : ""}`}>
        <ChapterHeader title={chapterTitle(book, next.chapter)} bookRef={next} versions={versions} preview titleOnly />
      </div>
      {column ? (
        // The same grid as the chapter itself (ColumnView): every version side by side at the same column
        // widths, its label on top, a placeholder line while a version loads — so the switch doesn't jump.
        <div className="grid min-w-full" style={{ gridTemplateColumns: `repeat(${versions.length}, minmax(var(--colmin), 1fr))` }}>
          {vers.map((v, i) => (
            <div key={versions[i]} className="border-b border-line px-4 py-2 text-sm md:px-5">
              {v && <VersionLabel version={v} />}
            </div>
          ))}
          {rows.slice(0, 12).flatMap((row) =>
            versions.map((id, i) => (
              <div key={`${row.v}-${id}`} data-pv-cell className="border-b border-line/60 px-3 py-2.5 md:px-4">
                {entries[i]?.status === "ok" ? (
                  <p lang={vers[i]?.language} dir={vers[i]?.dir} className="reader-text" style={{ color: vers[i] ? versionColor(settings, vers[i]!) : undefined }}>
                    {!row.cells[i]?.cont && <span className="mr-1 font-sans text-[0.62em] font-semibold text-accent">{row.v}</span>}
                    {row.cells[i]?.t}
                  </p>
                ) : (
                  <SkeletonLine />
                )}
              </div>
            )),
          )}
        </div>
      ) : (
        // The same layout as the chapter itself (StackedView): version labels, language colours, and a
        // placeholder line for a version still loading, so nothing pops in or moves when it becomes real.
        <ol className="mx-auto max-w-[var(--stackw)] divide-y divide-line/70 px-3 md:px-6">
          {rows.slice(0, 12).map((row) => (
            <li key={row.v} className="rounded-sm px-1 py-3">
              <div className="min-w-0 space-y-2">
                {versions.map((id, i) => {
                  const v = vers[i];
                  if (!v || entries[i]?.status === "error") return null;
                  return (
                    <div key={id} className={i > 0 ? "text-ink/85" : ""}>
                      {multi && (
                        <div className="mb-0.5 flex items-center text-[11px] uppercase tracking-wide">
                          <VersionLabel version={v} compact />
                        </div>
                      )}
                      {entries[i]?.status === "ok" ? (
                        <p lang={v.language} dir={v.dir} className="reader-text" style={{ color: versionColor(settings, v) }}>
                          {i === 0 && <span className="mr-1 font-sans text-xs font-semibold text-accent">{row.v}</span>}
                          {row.cells[i]?.t}
                        </p>
                      ) : (
                        <SkeletonLine />
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="h-[60dvh]" />
    </div>
  );
}

export function ReaderView() {
  const { ref, entry: book, versions, setVersions } = useReaderState();
  // Reading again: an info page opened from here (or after here) goes back here, not to the home page (page-chrome.tsx).
  useEffect(() => {
    try {
      sessionStorage.removeItem(FROM_HOME);
    } catch {}
  }, []);
  // Anonymous counts (lib/count.ts): a chapter read for 2 s, and a read-along that starts playing.
  const versionsKey = versions.join(",");
  useEffect(() => {
    const t = setTimeout(() => countOnce("view", `${ref.work}/${ref.book}/${ref.chapter}`, ref.work, versionsKey.split(",")), 2000);
    return () => clearTimeout(t);
  }, [ref.work, ref.book, ref.chapter, versionsKey]);
  const speech = useSpeech();
  useEffect(() => {
    if (speech.status !== "playing" || !speech.chapterKey) return;
    countOnce("play", speech.chapterKey, speech.chapterKey.split("/")[0], speech.version ? [speech.version] : versionsKey.split(","));
  }, [speech.status, speech.chapterKey, speech.version, versionsKey]);
  const view = useViewMode();
  const settings = useSettings();
  // continuous scroll: its own switch on each side (the Library's books flow as one long scroll by default)
  const flow = sideOfWork(ref.work) === "library" ? settings.continuousLibrary : settings.continuousScroll;
  const { fontSize } = settings;
  const wide = useMediaQuery(WIDE_QUERY, true);
  const landscape = useMediaQuery(PHONE_LANDSCAPE_QUERY, false);
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  // where this chapter's text ends (the Studied box below it): the progress bar measures up to here
  const chapterEnd = useRef<HTMLDivElement>(null);
  // Size readout while pinching: "Text 18", "Text 10 · smallest".
  const [pinchSize, setPinchSize] = useState<number | null>(null);
  const pinchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  usePinchToZoomText(scroller, fontSize, (n) => {
    setPinchSize(n);
    clearTimeout(pinchTimer.current);
    pinchTimer.current = setTimeout(() => setPinchSize(null), 1200);
  });

  const valid = !!book && Number.isInteger(ref.chapter) && ref.chapter >= 1 && ref.chapter <= (book.chapters ?? 0);
  const keys = valid ? versions.map((v) => chapterKey(ref.work, v, ref.book, ref.chapter)) : [];
  const entries = useChapters(keys);
  const cols: Col[] = versions.map((id, i) => ({
    version: getVersion(id)!,
    entry: entries[i] ?? { status: "loading" },
    retry: () => loadChapter(keys[i], { retry: true }),
  }));
  const rows = useMemo(() => alignVerses(entries.map((e) => (e.status === "ok" ? e.data : undefined))), [entries]);
  const { prev, next } = valid ? adjacentChapters(ref) : {};
  const allLoaded = entries.length > 0 && entries.every((e) => e.status === "ok");
  const content = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState<SwipeHint>(null);
  const [quick, setQuick] = useState<QuickAt | null>(null);
  const closeQuick = useCallback(() => setQuick(null), []);
  const [idle, setIdle] = useState(true);
  const chapterId = `${ref.work}/${ref.book}/${ref.chapter}`;
  useScrollIdle(scroller, (isIdle) => {
    setIdle(isIdle);
    // Remember the first verse on screen, to come back to it later.
    const sc = scroller.current;
    if (!isIdle || !sc) return;
    const top = sc.getBoundingClientRect().top + 48;
    const el = [...sc.querySelectorAll<HTMLElement>("[id^='v'][data-v]")].find((x) => x.getBoundingClientRect().bottom > top);
    if (el?.dataset.v) savePosition(chapterId, sc.scrollTop < 40 ? "1" : el.dataset.v);
  });
  useChapterSwipe({
    scroller,
    content,
    mode: settings.chapterSwipe,
    column: view === "column",
    canPrev: !!prev,
    canNext: !!next,
    onHint: setHint,
    onGo: (dir) => {
      const to = dir === "prev" ? prev : next;
      if (to) {
        goTo(readHref(to, versions));
        router.push(readHref(to, versions));
      }
    },
  });
  const ra = useReadAlong({ cols, rows, bookRef: ref, next, versions, scroller, setVersions });
  const red = useRedLetter(ref.work, ref.book, versions);
  useLevelMarks(scroller, `${rows.length}|${red.size}|${ref.book}|${ref.chapter}|${versions.join(",")}`);
  const study = useStudy();
  const marks = useMemo(() => chapterMarks(study.items, ref.work, ref.book, ref.chapter), [study.items, ref.work, ref.book, ref.chapter]);

  const actions: VerseActions = {
    marks,
    boxTap(v, rect) {
      if (!rect) return openVerseMenu({ ...ref, verse: v });
      setQuick((q) => (q?.verse === v ? null : { verse: v, rect: { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width } }));
    },
    boxDouble(v) {
      const r = { ...ref, verse: v };
      const on = toggle("later", r);
      toast(on ? `${verseReference(r)} saved to Study later` : `Removed ${verseReference(r)} from Study later`);
    },
    openMenu: (v, focus) => openVerseMenu({ ...ref, verse: v, focus }),
    textTap(v, version, p) {
      const r = { ...ref, verse: v };
      if (settings.wordMode) void pickWord(p.x, p.y, { work: ref.work, book: ref.book, chapter: ref.chapter, v, version });
      else if (settings.xrefMode) showXref(r);
      else if (settings.highlightMode) {
        const cur = getItem("highlight", r)?.color;
        setHighlight(r, cur === settings.highlightColor ? null : settings.highlightColor);
      } else if (ra.speech.open && ra.supported) ra.readFrom(v, version); // read in the language tapped
      else openVerseMenu({ ...r, version });
    },
    textDouble(p, version) {
      const w = wordAt(p.x, p.y);
      if (w) openSearch(w, [version]);
    },
  };
  /** Text of one verse in every loaded column (for copy and Ask in…). */
  const textsFor = (v: string): VerseTextInfo[] => {
    const row = rows.find((r) => r.v === v);
    if (!row) return [];
    return row.cells.flatMap((cell, i) => {
      const ver = cols[i]?.version;
      if (!cell || cell.cont || !cell.t || !ver) return [];
      return [{ id: ver.id, abbr: ver.abbr, name: ver.name, language: getLanguage(ver.language).name, text: cell.t, dir: ver.dir, lang: ver.language }];
    });
  };

  // Prefetch the next chapter once this one is on screen.
  useEffect(() => {
    if (!allLoaded || !next) return;
    const t = setTimeout(() => versions.forEach((v) => loadChapter(chapterKey(next.work, v, next.book, next.chapter))), 400);
    return () => clearTimeout(t);
  }, [allLoaded, next, versions]);

  // Tell the AI companion what is on screen (it reads this when a question is sent).
  useEffect(() => {
    if (!allLoaded || !book) return;
    const vers = versions.map((id) => getVersion(id)!);
    setReadingContext({
      at: { work: ref.work, book: ref.book, chapter: ref.chapter },
      reference: chapterTitle(book, ref.chapter),
      work: catalog.works.find((w) => w.id === ref.work)?.name ?? ref.work,
      versions: vers.map((v) => ({ abbr: v.abbr, name: v.name, language: getLanguage(v.language).name })),
      passage: () =>
        rows
          .map((r) => {
            const parts = r.cells.flatMap((c, i) => (c && !c.cont && c.t ? [`${vers[i].abbr}: ${c.t}`] : []));
            return parts.length ? `${r.v}. ${parts.join(" | ")}` : "";
          })
          .filter(Boolean)
          .join("\n"),
    });
  }, [allLoaded, rows, book, ref.work, ref.book, ref.chapter, versions]);
  useEffect(() => () => setReadingContext(null), []);

  // Jump to #v16 once every column's text is there (so later columns don't push the verse away).
  // Remembered per chapter + hash, so following a search result to another chapter jumps again.
  // Read, not just passed through: the chapter's beginning was on screen and it was open a while. Only then
  // does scrolling on into the next chapter mark it as studied (a #v30 link, or a fast scroll, doesn't).
  const readFrom = useRef<{ key: string; sawTop: boolean; at: number }>({ key: "", sawTop: false, at: 0 });
  useEffect(() => {
    const sc = scroller.current;
    const key = `${ref.work}/${ref.book}/${ref.chapter}`;
    readFrom.current = { key, sawTop: false, at: Date.now() };
    if (!sc) return;
    const look = () => {
      if (sc.scrollTop < 150) readFrom.current.sawTop = true;
    };
    const t = window.setTimeout(look, 600); // after any restored position is applied
    sc.addEventListener("scroll", look, { passive: true });
    return () => {
      window.clearTimeout(t);
      sc.removeEventListener("scroll", look);
    };
  }, [ref.work, ref.book, ref.chapter]);
  const jumped = useRef("");
  const arrived = useRef(""); // the chapter already shown (so it is put at the top only once, on arrival)
  useEffect(() => {
    if (!allLoaded || !rows.length) return;
    // A link to another verse of this same chapter changes only the #hash (no re-render): links send
    // "va-jump" (see jumpToHash) so the view still moves.
    const onJump = () => {
      jumped.current = "";
      run();
    };
    window.addEventListener("va-jump", onJump);
    window.addEventListener("popstate", onJump);
    run();
    return () => {
      window.removeEventListener("va-jump", onJump);
      window.removeEventListener("popstate", onJump);
    };
    function run() {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const firstLook = arrived.current !== `${ref.work}/${ref.book}/${ref.chapter}`;
    arrived.current = `${ref.work}/${ref.book}/${ref.chapter}`;
    // Arrived by scrolling on from the previous chapter: stay at the top (where the reader already is).
    if (!hash && continuedInto === `${ref.work}/${ref.book}/${ref.chapter}`) {
      continuedInto = null;
      // A visit of its own: coming back to the chapter before (Back) then resumes where you were.
      resumeDecided = { chapter: `${ref.work}/${ref.book}/${ref.chapter}`, resume: true };
      goingTo = null;
      jumped.current = `${ref.work}/${ref.book}/${ref.chapter}#`;
      // The same spot the reader was at in the preview: as far past this chapter's heading as before.
      // (continuedOffset = px past the first verse's top; at or before the heading: stay at the top)
      const sc = scroller.current;
      const first = sc?.querySelector<HTMLElement>("[data-v]");
      if (sc && first && continuedOffset > -1e5) {
        const firstAt = first.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
        sc.scrollTop = Math.max(0, firstAt + continuedOffset);
      }
      continuedOffset = 0;
      return;
    }
    // No #verse in the link: coming back → where you were in this chapter; going to it → verse 1.
    const resume = shouldResume(`${ref.work}/${ref.book}/${ref.chapter}`);
    const saved = hash || !resume ? null : getPosition(`${ref.work}/${ref.book}/${ref.chapter}`);
    const id = hash || (saved && saved !== "1" ? `v${saved}` : "");
    const key = `${ref.work}/${ref.book}/${ref.chapter}#${id}`;
    if (!id) {
      // Make sure a new chapter starts at the top (not at the last chapter's scroll position).
      // Only on arriving at the chapter (not when a #verse is dropped within it, e.g. Back after a verse link).
      if (firstLook && scroller.current) scroller.current.scrollTop = 0;
      jumped.current = key;
      return;
    }
    if (jumped.current === key) return;
    if (!hash) {
      const el = document.getElementById(id);
      if (el) {
        jumped.current = key;
        el.scrollIntoView({ block: "start" });
      }
      return;
    }
    // "#v30" = one verse (centred); "#v30-35" = a passage: its first verse at the top, so it reads
    // downwards in order, and every verse of it marked.
    const range = /^v(\d+[a-z]?)(?:-(\d+))?$/.exec(id);
    const first = range ? `v${range[1]}` : id;
    const el = document.getElementById(first);
    if (el) {
      jumped.current = key;
      el.scrollIntoView({ block: range?.[2] ? "start" : "center" });
      document.querySelectorAll(".is-target").forEach((n) => n.classList.remove("is-target"));
      const from = range ? parseInt(range[1], 10) : NaN;
      const to = range?.[2] ? parseInt(range[2], 10) : from;
      const cells = range
        ? [...document.querySelectorAll<HTMLElement>("[data-v]")].filter((n) => {
            const v = parseInt(n.dataset.v ?? "", 10);
            return v >= from && v <= to;
          })
        : [];
      (cells.length ? cells : [el]).forEach((n) => n.classList.add("is-target"));
    }
    }
  }, [rows, allLoaded, ref.work, ref.book, ref.chapter]);

  // ← / → keys move between chapters (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], dialog")) return;
      const to = e.key === "ArrowLeft" ? prev : e.key === "ArrowRight" ? next : undefined;
      if (to) {
        goTo(readHref(to, versions));
        router.push(readHref(to, versions));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, versions, router]);

  // The tab names the versions actually shown (the page's own title names the defaults when the address has
  // no ?v= and the reader uses this person's saved versions instead).
  const tabTitle = book
    ? `${seoChapterName(book, ref.chapter)} – ${joinAbbrs(versions.map(getVersion).filter((v): v is Version => !!v))} · ${SITE_NAME}`
    : "";
  useEffect(() => {
    if (tabTitle) document.title = tabTitle;
  }, [tabTitle]);

  if (!valid || !book) return <NotFound />;

  const title = chapterTitle(book, ref.chapter);
  const subtitle = entries.flatMap((e) => (e.status === "ok" && e.data.title ? [e.data.title] : [])).filter((t, i, a) => a.indexOf(t) === i).join(" · ");
  // Column width: phone portrait shows one column per swipe unless the user picked a width;
  // phone landscape and desktop use the saved width (or a sensible default) so 2–3 columns fit.
  const colMin = landscape
    ? `${settings.colWidthLandscape ?? 14}rem`
    : wide
      ? settings.colWidth
        ? `${settings.colWidth}rem`
        : `max(11rem, min(17rem, calc(100cqw / ${Math.max(1, Math.min(3, versions.length))})))`
      : settings.colWidth
        ? `${settings.colWidth}rem`
        : "85cqw";
  const style = {
    "--reader-size": `${fontSize}px`,
    "--colmin": colMin,
    "--stackw": `${settings.stackWidth ?? 48}rem`,
    "--reader-align": settings.textAlign,
  } as CSSProperties;
  const column = view === "column";

  return (
    <>
    <div className="absolute inset-0 flex flex-col">
    {/* Desktop: the chapter's name and the text settings stay at the top while the text scrolls. */}
    <ReaderToolbar title={title} subtitle={subtitle} bookRef={ref} versions={versions} prev={prev} next={next} />
    <div className="relative min-h-0 flex-1">
    {/* under the chapter's toolbar: how far through the chapter */}
    {allLoaded && <ReadingProgress scroller={scroller} end={chapterEnd} chapter={chapterId} versions={cols.length} />}
    <div
      ref={scroller}
      style={style}
      className={`@container absolute inset-0 touch-pan-x touch-pan-y overflow-auto overscroll-contain ${
        column ? "snap-x snap-mandatory desk:snap-none" : ""
      }`}
    >
      <div ref={content}>
      <div className={column ? "sticky left-0 w-[100cqw] desk:hidden" : "desk:hidden"}>
        <ChapterHeader title={title} subtitle={subtitle} bookRef={ref} versions={versions} prev={prev} next={next} titleOnly />
      </div>
      <ChapterBar versions={versions} prev={prev} next={next} column={column} />
      <div className={column ? "sticky left-0 w-[100cqw] px-3 desk:w-auto" : "px-3"}>
        <SkipFrontMatter work={ref.work} book={ref.book} chapter={ref.chapter} entry={book} versions={versions} />
      </div>

      <ListenCtx.Provider value={ra}>
      <VerseCtx.Provider value={actions}>
      <RedLetterCtx.Provider value={red}>
        {column ? (
          <ColumnView
            cols={cols}
            rows={rows}
            marks={marks}
            onReorder={(from, to) => {
              const next = [...versions];
              const [x] = next.splice(from, 1);
              next.splice(to, 0, x);
              setVersions(next);
            }}
          />
        ) : (
          <StackedView cols={cols} rows={rows} marks={marks} />
        )}
      </RedLetterCtx.Provider>
      </VerseCtx.Provider>
      </ListenCtx.Provider>

      <div ref={chapterEnd} className={column ? "sticky left-0 w-[100cqw]" : ""}>
        {allLoaded && <StudiedBox bookRef={ref} title={title} />}
        {/* the end of a Library book: books like it */}
        {allLoaded && sideOfWork(ref.work) === "library" && ref.chapter === (findBook(ref.work, ref.book)?.chapters ?? 0) && <SimilarBooks work={ref.work} />}
        <ChapterNav prev={prev} next={next} versions={versions} />
        <Attribution versions={cols.map((c) => c.version)} />
        {!(flow && next) && <ReadAlongSpacer ra={ra} />}
      </div>
      {flow && next && (
        <NextChapterFlow
          next={next}
          versions={versions}
          scroller={scroller}
          column={column}
          hold={ra.speech.status === "playing"}
          onGo={(past) => {
            // The chapter just finished by scrolling on: marked as studied (unless that's switched off).
            const read = readFrom.current.sawTop && Date.now() - readFrom.current.at > 20_000;
            if (settings.autoStudied && allLoaded && read && !getItem("studied", ref)) {
              toggle("studied", ref);
              toast(`${title} marked as studied`);
            }
            continuedInto = `${next.work}/${next.book}/${next.chapter}`;
            continuedOffset = past;
            router.push(readHref(next, versions), { scroll: false });
          }}
        />
      )}
      {flow && next && <ReadAlongSpacer ra={ra} />}
      </div>
    </div>
    </div>
    </div>
    <SwipeHintView hint={hint} prev={prev} next={next} />
    {pinchSize !== null && (
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-1.5 text-sm font-medium tabular-nums text-paper shadow-lg"
      >
        Text {pinchSize}
        {pinchSize <= FONT_MIN ? " · smallest" : pinchSize >= FONT_MAX ? " · largest" : ""}
      </div>
    )}
    {settings.floatingNav && (
      <FloatingNav prev={prev} next={next} versions={versions} faint={!idle || !!hint} raised={ra.speech.open} />
    )}
    {ra.speech.open && <ReadAlongBar ra={ra} />}
    <XrefPanel bookRef={ref} versions={versions} raised={ra.speech.open} />
    <VerseMenu textsFor={textsFor} versions={versions} onReadFrom={ra.supported ? ra.readFrom : undefined} />
    <LevelLegend raised={ra.speech.open} />
    <WordStudy scroller={scroller} rowsKey={rows} versions={versions} raised={ra.speech.open} />
    <VerseQuick
      at={quick}
      bookRef={ref}
      onClose={closeQuick}
      onListen={ra.supported ? (v) => ra.readFrom(v) : undefined}
      onMenu={(v, focus) => openVerseMenu({ ...ref, verse: v, focus })}
    />
    </>
  );
}

/** "‹ Genesis 1" / "Genesis 3 ›" while swiping; turns solid once letting go will change chapter. */
function SwipeHintView({ hint, prev, next }: { hint: SwipeHint; prev?: BookRef; next?: BookRef }) {
  if (!hint) return null;
  const to = hint.dir === "prev" ? prev : next;
  if (!to) return null;
  const ready = hint.progress >= 1;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute top-1/2 z-30 -translate-y-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg transition-colors ${
        hint.dir === "prev" ? "left-3" : "right-3"
      } ${ready ? "bg-accent text-accent-ink" : "border border-line bg-panel text-muted"}`}
      style={{ opacity: 0.35 + hint.progress * 0.65 }}
    >
      {hint.dir === "prev" ? `‹ ${refLabel(to)}` : `${refLabel(to)} ›`}
      <span className="block text-center text-[11px] font-normal">{ready ? "Let go to open" : "Keep swiping"}</span>
    </div>
  );
}

/** Small round ‹ › buttons at the bottom corners; they fade while scrolling and return when idle. */
function refLabel(r: BookRef) {
  return chapterTitle(findBook(r.work, r.book), r.chapter, r.book);
}

function ChapterHeader({
  title,
  subtitle,
  bookRef,
  versions,
  prev,
  next,
  preview = false,
  titleOnly = false,
}: {
  /** The next chapter's preview under this one (continuous scroll): no buttons of its own. */
  preview?: boolean;
  /** Only the names: the versions chip and the buttons are in the pinned ChapterBar below it. */
  titleOnly?: boolean;
  title: string;
  /** The chapter's own name(s) from the versions shown, e.g. a sutta title in English · Pāli. */
  subtitle?: string;
  bookRef: BookRef;
  versions: string[];
  prev?: BookRef;
  next?: BookRef;
}) {
  const book = findBook(bookRef.work, bookRef.book)!;
  const abbrs = versions.map((id) => getVersion(id)?.abbr ?? id);
  return (
    // Phone landscape (short): one row — the name, the versions chip and the buttons — so the text starts sooner.
    <div className="mx-auto flex max-w-5xl items-end justify-between gap-3 px-4 pb-3 pt-4 pland:items-center pland:py-1.5 md:px-8 md:pt-8">
      <div className="min-w-0 pland:flex pland:flex-wrap pland:items-center pland:gap-x-3">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-faint pland:hidden">
          {book.religion.name} · {book.collection.name}
        </p>
        <h1 className="font-serif text-2xl font-semibold pland:text-xl md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 font-serif text-base text-muted pland:mt-0 md:text-lg">{subtitle}</p>}
        {/* The versions being read: tap to add, remove or reorder them (the sheet opens at that section). */}
        {!preview && !titleOnly && (
          <button
            type="button"
            onClick={() => openSheet("versions")}
            aria-label={`Versions: ${abbrs.join(", ")}. Change versions and languages`}
            className="mt-1 flex min-h-10 max-w-full items-center pland:mt-0"
          >
            <span className="flex h-8 max-w-full items-center gap-1.5 rounded-full border border-line bg-raised pl-2.5 pr-2 text-xs font-semibold text-muted">
              <LanguagesIcon width={14} height={14} className="shrink-0 text-accent" />
              <span className="truncate">{abbrs.join(" · ")}</span>
              <ChevronDown width={12} height={12} className="shrink-0 text-faint" />
            </span>
          </button>
        )}
      </div>
      {/* data-chapter-nav: while these are on screen, the floating ‹ › pill steps aside. */}
      {!titleOnly && (
      <div className="flex shrink-0 gap-1" data-chapter-nav>
        {!preview && (
          <button
            type="button"
            onClick={() => openSheet("text")}
            aria-label="Text settings"
            title="Text size, columns or stacked, width, alignment and colours"
            className="flex h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-raised px-2 text-muted hover:text-ink"
          >
            <span aria-hidden className="font-serif text-base font-semibold leading-none">Aa</span>
          </button>
        )}
        <NavIcon to={prev} versions={versions} label="Previous chapter" icon={<ChevronLeft />} />
        <NavIcon to={next} versions={versions} label="Next chapter" icon={<ChevronRight />} />
      </div>
      )}
    </div>
  );
}

/** Height of the pinned ChapterBar on a phone (Column view's version labels stick just below it). */
const BAR_TOP = "top-[57px] pland:top-[45px] desk:top-0";

/**
 * Phone: the versions chip (versions & languages), Aa (text settings) and the chapter arrows, pinned to the
 * top of the text while it scrolls, so they're always one tap away.
 */
function ChapterBar({ versions, prev, next, column }: { versions: string[]; prev?: BookRef; next?: BookRef; column: boolean }) {
  const abbrs = versions.map((id) => getVersion(id)?.abbr ?? id);
  return (
    <div
      data-no-swipe
      className={`sticky top-0 z-20 h-[57px] border-b border-line bg-paper/95 backdrop-blur pland:h-[45px] desk:hidden ${column ? "left-0 w-[100cqw]" : ""}`}
    >
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-2 px-4 md:px-8">
        <button
          type="button"
          onClick={() => openSheet("versions")}
          aria-label={`Versions: ${abbrs.join(", ")}. Change versions and languages`}
          className="flex min-h-11 min-w-0 items-center"
        >
          <span className="flex h-8 max-w-full items-center gap-1.5 rounded-full border border-line bg-raised pl-2.5 pr-2 text-xs font-semibold text-muted">
            <LanguagesIcon width={14} height={14} className="shrink-0 text-accent" />
            <span className="truncate">{abbrs.join(" · ")}</span>
            <ChevronDown width={12} height={12} className="shrink-0 text-faint" />
          </span>
        </button>
        {/* data-chapter-nav: while these are on screen, the floating ‹ › pill steps aside. */}
        <div className="flex shrink-0 gap-1" data-chapter-nav>
          <TapModesButton />
          <button
            type="button"
            onClick={() => openSheet("text")}
            aria-label="Text settings"
            title="Text size, columns or stacked, width, alignment and colours"
            className="flex h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-raised px-2 text-muted hover:text-ink"
          >
            <span aria-hidden className="font-serif text-base font-semibold leading-none">Aa</span>
          </button>
          <NavIcon to={prev} versions={versions} label="Previous chapter" icon={<ChevronLeft />} />
          <NavIcon to={next} versions={versions} label="Next chapter" icon={<ChevronRight />} />
        </div>
      </div>
    </div>
  );
}

/**
 * Desktop: a slim bar above the text that doesn't scroll away: where you are (tradition · collection,
 * chapter) and the text settings (columns or stacked, width, alignment, size, colours), plus the
 * chapter arrows. Its pop-ups open over the text.
 */
function ReaderToolbar({ title, subtitle, bookRef, versions, prev, next }: { title: string; subtitle?: string; bookRef: BookRef; versions: string[]; prev?: BookRef; next?: BookRef }) {
  const book = findBook(bookRef.work, bookRef.book)!;
  return (
    // A container: when the reading area is narrow (panels open beside it) the settings fold into one button,
    // so the bar stays one row.
    <div data-no-swipe className="@container relative z-20 hidden shrink-0 border-b border-line bg-paper desk:block">
    <div className="flex items-center gap-3 px-4 py-1.5 md:px-6">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium uppercase leading-4 tracking-wider text-faint">
          {book.religion.name} · {book.collection.name}
        </p>
        <h1 className="truncate font-serif text-xl font-semibold leading-tight" title={subtitle ? `${title} · ${subtitle}` : title}>
          {title}
          {subtitle && <span className="ml-2 font-serif text-base font-normal text-muted">{subtitle}</span>}
        </h1>
      </div>
      <div role="group" aria-label="Text settings" className="hidden shrink-0 items-center gap-1 @min-[48rem]:flex">
        <ViewToggle compact />
        <WidthButton />
        <AlignButton />
        <FontSizeControl compact />
        <ColoursButton />
        <LevelsButton />
      </div>
      <div className="flex shrink-0 @min-[48rem]:hidden">
        <TextSettingsButton />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span aria-hidden className="mx-1 h-6 w-px bg-line" />
        <NavIcon to={prev} versions={versions} label="Previous chapter" icon={<ChevronLeft />} small />
        <NavIcon to={next} versions={versions} label="Next chapter" icon={<ChevronRight />} small />
      </div>
    </div>
    </div>
  );
}

function NavIcon({ to, versions, label, icon, small = false }: { to?: BookRef; versions: string[]; label: string; icon: React.ReactNode; small?: boolean }) {
  const cls = `flex ${small ? "h-9 w-9" : "h-11 w-11"} items-center justify-center rounded-lg border border-line bg-raised`;
  if (!to)
    return (
      <span className={`${cls} opacity-40`} aria-hidden>
        {icon}
      </span>
    );
  return (
    <Link href={readHref(to, versions)} aria-label={`${label}: ${refLabel(to)}`} title={refLabel(to)} className={`${cls} text-muted hover:text-ink`}>
      {icon}
    </Link>
  );
}

/** ▶ next to a version name: listen to that version (⏸ while it is the one playing). */
const ListenCtx = createContext<ReadAlong | null>(null);
function VersionPlay({ id, verse, label }: { id: string; verse?: string; label: string }) {
  const ra = useContext(ListenCtx);
  if (!ra?.supported) return null;
  const s = ra.speech;
  const active = s.open && s.version === id && s.status === "playing" && (!verse || s.verse === verse);
  return (
    <button
      type="button"
      data-no-swipe
      onClick={(e) => {
        e.stopPropagation();
        ra.playVersion(id, active ? undefined : verse);
      }}
      aria-label={active ? `Pause ${label}` : `Listen to ${label}${verse ? ` from verse ${verse}` : ""}`}
      title={ra.hasRecording(id) ? `Listen to ${label} (recorded voice)` : `Listen to ${label}`}
      className={`relative ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full align-middle after:absolute after:-inset-2 after:content-[''] ${
        active ? "bg-accent text-accent-ink" : "text-accent hover:bg-accent-soft"
      }`}
    >
      {active ? <PauseIcon width={11} height={11} /> : <PlayIcon width={11} height={11} />}
    </button>
  );
}

function VersionLabel({ version, compact = false }: { version: Version; compact?: boolean }) {
  const lang = getLanguage(version.language);
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5" title={`${version.name} (${version.yearNote ?? version.year}) — ${lang.name}`}>
      <span className="font-semibold text-ink">{version.abbr}</span>
      {/* Never cut short ("Spa…"): the name wraps under the abbreviation when the column is narrow. */}
      {!compact && <span className="whitespace-nowrap text-faint">{lang.name}</span>}
      {version.kind === "ai" && (
        <span className="rounded bg-accent-soft px-1 text-[10px] font-bold uppercase text-accent">AI translation</span>
      )}
    </span>
  );
}

function contLabel(cont: string, chapter: number) {
  const [c, v] = cont.split(":");
  return Number(c) === chapter ? `see v. ${v}` : `see ${cont}`;
}

function Cell({ verse, version, chapter, box }: { verse: Verse | null; version: Version; chapter: number; box?: React.ReactNode }) {
  const color = versionColor(useSettings(), version);
  if (!verse)
    return (
      <span className="text-faint" title="Not present in this version">
        {box}—
      </span>
    );
  if (verse.cont)
    return (
      <span className="text-sm italic text-faint" title="This verse is combined with an earlier one in this version">
        {box}↑ {contLabel(verse.cont, chapter)}
      </span>
    );
  return (
    <VerseText v={verse.v} version={version.id} lang={version.language} dir={version.dir} color={color}>
      {box}
      {verse.n && (
        <span className="mr-1 select-none font-sans text-[0.65em] font-semibold text-faint" title={`Numbered ${verse.n} in ${version.abbr}`}>
          ({verse.n})
        </span>
      )}
      {/* Poems keep their line breaks (only literature texts have them). */}
      <span data-text className="whitespace-pre-line">
        <VerseWords t={verse.t} version={version.id} chapter={chapter} v={verse.v} />
      </span>
    </VerseText>
  );
}

function ColumnView({
  cols,
  rows,
  marks,
  onReorder,
}: {
  cols: Col[];
  rows: AlignedRow[];
  marks: Map<string, Marks>;
  onReorder: (from: number, to: number) => void;
}) {
  const { drag, handlers } = useColumnDrag(onReorder);
  const n = cols.length;
  // One version with a chosen column width: keep that width (centred) instead of filling the screen, but
  // never narrower than a comfortable reading width (a width set small to fit five columns elsewhere
  // would otherwise squeeze a one-version book into a thin strip).
  const { colWidth } = useSettings();
  const wideScreen = useMediaQuery(WIDE_QUERY, true);
  const fixedSingle = n === 1 && colWidth != null && wideScreen;
  const loading = rows.length === 0 && cols.some((c) => c.entry.status === "loading");
  const chapter = cols.find((c) => c.entry.status === "ok")?.entry;
  const chNum = chapter?.status === "ok" ? chapter.data.chapter : 0;
  return (
    <div
      role="table"
      aria-label="Parallel versions"
      className={`grid min-w-full ${fixedSingle ? "justify-center" : ""}`}
      style={{ gridTemplateColumns: fixedSingle ? "minmax(0, max(var(--colmin), min(100%, 44rem)))" : `repeat(${n}, minmax(var(--colmin), 1fr))` }}
    >
      <div role="row" className="contents">
        {cols.map((c, i) => (
          <div
            role="columnheader"
            key={c.version.id}
            {...(cols.length > 1 ? handlers(i) : {})}
            title={cols.length > 1 ? "Drag to move this column (touch: press and hold, then drag)" : undefined}
            className={`sticky ${BAR_TOP} z-10 snap-start select-none border-b border-line bg-paper/95 px-4 py-2 text-sm backdrop-blur md:px-5 ${
              cols.length > 1 ? "cursor-grab active:cursor-grabbing" : ""
            } ${drag?.from === i ? "opacity-50" : ""} ${drag && drag.over === i && drag.from !== i ? "outline-2 -outline-offset-2 outline-dashed outline-accent" : ""}`}
          >
            <span className="flex items-center">
              {cols.length > 1 && <GripIcon width={14} height={14} className="mr-1 shrink-0 text-faint" aria-hidden />}
              <VersionLabel version={c.version} />
              <VersionPlay id={c.version.id} label={c.version.abbr} />
            </span>
            {c.entry.status === "error" && <ColumnError col={c} />}
            {c.entry.status === "ok" && c.entry.data.note && (
              <p className="mt-1 text-xs font-normal leading-snug text-faint">{c.entry.data.note}</p>
            )}
          </div>
        ))}
      </div>
      {loading
        ? cols.map((c) => (
            <div key={c.version.id} className="px-4 py-3 md:px-5">
              <Skeleton />
            </div>
          ))
        : rows.map((row) => {
            const bg = highlightBg(marks.get(row.v)?.highlight?.color);
            return (
              <div role="row" key={row.v} className="contents">
                {row.cells.map((verse, i) => (
                  <div
                    role="cell"
                    key={cols[i].version.id}
                    // display:contents rows have no box, so the anchor lives on the first cell
                    id={i === 0 ? `v${row.v}` : undefined}
                    data-v={row.v}
                    style={bg ? { background: bg } : undefined}
                    className="verse-flash snap-start scroll-mt-12 border-b border-line/60 px-3 py-2.5 md:px-4"
                  >
                    {cols[i].entry.status === "loading" ? (
                      <SkeletonLine />
                    ) : cols[i].entry.status === "error" ? null : (
                      <Cell
                        verse={verse}
                        version={cols[i].version}
                        chapter={chNum}
                        box={<VerseBox v={row.v} label={row.v} size="sm" />}
                      />
                    )}
                    {i === 0 && <NoteLine v={row.v} />}
                    {i === 0 && <DiffMark v={row.v} />}
                  </div>
                ))}
              </div>
            );
          })}
    </div>
  );
}

function StackedView({ cols, rows, marks }: { cols: Col[]; rows: AlignedRow[]; marks: Map<string, Marks> }) {
  const multi = cols.length > 1;
  const errors = cols.filter((c) => c.entry.status === "error");
  const loading = rows.length === 0 && cols.some((c) => c.entry.status === "loading");
  const first = cols.find((c) => c.entry.status === "ok")?.entry;
  const chNum = first?.status === "ok" ? first.data.chapter : 0;
  const firstOk = Math.max(0, cols.findIndex((c) => c.entry.status !== "error"));
  return (
    <div className="mx-auto max-w-[var(--stackw)] px-3 md:px-6">
      {errors.map((c) => (
        <div key={c.version.id} className="mb-3 rounded-lg border border-line bg-raised px-3 py-2 text-sm">
          <VersionLabel version={c.version} compact /> <ColumnError col={c} inline />
        </div>
      ))}
      {cols.map((c) =>
        c.entry.status === "ok" && c.entry.data.note ? (
          <p key={`note-${c.version.id}`} className="mb-3 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-muted">
            <VersionLabel version={c.version} compact /> — {c.entry.data.note}
          </p>
        ) : null,
      )}
      {loading ? (
        <Skeleton />
      ) : (
        <ol className="divide-y divide-line/70">
          {rows.map((row) => {
            const bg = highlightBg(marks.get(row.v)?.highlight?.color);
            return (
              <li
                key={row.v}
                id={`v${row.v}`}
                data-v={row.v}
                style={bg ? { background: bg } : undefined}
                className="verse-flash scroll-mt-4 rounded-sm px-1 py-3"
              >
                <div className="min-w-0 space-y-2">
                  {row.cells.map((verse, i) => {
                    const c = cols[i];
                    if (c.entry.status === "error") return null;
                    return (
                      <div key={c.version.id} className={i > 0 ? "text-ink/85" : ""}>
                        {multi && (
                          <div className="mb-0.5 flex items-center text-[11px] uppercase tracking-wide">
                            <VersionLabel version={c.version} compact />
                            {verse && !verse.cont && <VersionPlay id={c.version.id} verse={row.v} label={c.version.abbr} />}
                          </div>
                        )}
                        {c.entry.status === "loading" ? (
                          <SkeletonLine />
                        ) : (
                          <Cell
                            verse={verse}
                            version={c.version}
                            chapter={chNum}
                            // Small verse number inline at the start of the first text (more room for words).
                            box={i === firstOk ? <VerseBox v={row.v} label={row.v} size="sm" /> : undefined}
                          />
                        )}
                      </div>
                    );
                  })}
                  <NoteLine v={row.v} />
                  <DiffMark v={row.v} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ColumnError({ col, inline = false }: { col: Col; inline?: boolean }) {
  if (col.entry.status !== "error") return null;
  // Not an error: this version simply doesn't contain the book (e.g. Tobit in a Protestant Bible).
  if (/not available in this version/i.test(col.entry.message))
    return (
      <span className={`${inline ? "" : "mt-1 block"} text-xs font-normal normal-case tracking-normal text-faint`}>
        This version doesn{"’"}t include this book
      </span>
    );
  return (
    <span className={`${inline ? "" : "mt-1 flex"} items-center gap-2 text-xs text-red-700 dark:text-red-400`} role="alert">
      Couldn’t load ({col.entry.message}).{" "}
      <button type="button" onClick={col.retry} className="min-h-8 font-semibold underline underline-offset-2">
        Retry
      </button>
    </span>
  );
}

function SkeletonLine() {
  return <span className="block h-4 w-full animate-pulse rounded bg-line/70" aria-hidden />;
}
function Skeleton() {
  return (
    <div className="space-y-3 py-4" aria-label="Loading" role="status">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="block h-4 animate-pulse rounded bg-line/70" style={{ width: `${70 + ((i * 37) % 30)}%` }} />
      ))}
    </div>
  );
}

function ChapterNav({ prev, next, versions }: { prev?: BookRef; next?: BookRef; versions: string[] }) {
  const cls = "flex min-h-12 flex-1 items-center gap-2 rounded-xl border border-line bg-raised px-4 text-sm hover:border-faint";
  return (
    <nav aria-label="Chapter navigation" data-chapter-nav className="mx-auto flex max-w-3xl gap-3 px-4 pb-4 pt-8 md:px-8">
      {prev ? (
        <Link href={readHref(prev, versions)} className={cls}>
          <ChevronLeft className="shrink-0 text-faint" />
          <span className="truncate">{refLabel(prev)}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <Link href={readHref(next, versions)} className={`${cls} justify-end text-right`}>
          <span className="truncate">{refLabel(next)}</span>
          <ChevronRight className="shrink-0 text-faint" />
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}

/**
 * The versions' credits and licences, folded into one quiet line at the end of the chapter (tap to read
 * them): always there as the licences ask, without a block of small print between chapters while scrolling.
 */
function Attribution({ versions }: { versions: Version[] }) {
  return (
    <footer className="mx-auto max-w-3xl px-4 pb-10 pt-2 text-xs leading-relaxed text-faint md:px-8">
      <details className="group">
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-center gap-1 select-none hover:text-muted [&::-webkit-details-marker]:hidden">
          Sources &amp; credits: {versions.map((v) => v.abbr).join(" · ")}
          <ChevronDown width={12} height={12} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-1 pt-1">
      {versions.map((v) => (
        <p key={v.id}>
          <span className="font-semibold">{v.abbr}</span> — {v.name} ({v.yearNote ?? v.year}). {v.license}.{" "}
          {v.attribution}{" "}
          <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted">
            Source
          </a>
        </p>
      ))}
      {versions[0]?.work === "bible" && <p>Verse numbers follow the English (KJV) system so versions line up; a version’s own number is shown where it differs.</p>}
      {versions[0] && ["tipitaka", "abhidhamma"].includes(versions[0].work) && <p>Numbers in the margin count the paragraphs of each discourse; SuttaCentral’s own segment numbering is the same in every language, so the versions line up exactly.</p>}
        </div>
      </details>
    </footer>
  );
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="font-serif text-2xl font-semibold">Passage not found</h1>
      <p className="text-muted">That book or chapter isn’t in the library (yet).</p>
      <Link href="/" className="rounded-lg bg-accent px-4 py-3 font-medium text-accent-ink">
        Go to Genesis 1
      </Link>
    </div>
  );
}

export function ReaderFallback() {
  return (
    <div className="absolute inset-0 mx-auto max-w-3xl px-4 pt-8 md:px-8">
      <Skeleton />
    </div>
  );
}

/**
 * Two-finger pinch on the reading area changes the text size (instead of zooming the whole page).
 * The new size is saved like the A−/A+ buttons.
 */
function usePinchToZoomText(ref: RefObject<HTMLDivElement | null>, fontSize: number, onPinch?: (size: number) => void) {
  const size = useRef(fontSize);
  const cb = useRef(onPinch);
  useEffect(() => {
    cb.current = onPinch;
  });
  useEffect(() => {
    size.current = fontSize;
  }, [fontSize]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { dist: number; size: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) start = { dist: dist(e.touches), size: size.current };
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) return;
      e.preventDefault(); // keep the browser from zooming the page
      if (gestureLock.swipe) return; // a two-finger chapter swipe, not a pinch
      const ratio = dist(e.touches) / start.dist;
      if (Math.abs(ratio - 1) < 0.08) return; // small wobble while swiping with two fingers
      const next = Math.round(Math.min(FONT_MAX, Math.max(FONT_MIN, start.size * ratio)));
      if (next !== size.current) updateSettings({ fontSize: next });
      cb.current?.(next); // shows the size readout (also when already at the smallest/largest)
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) start = null;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [ref]);
}
