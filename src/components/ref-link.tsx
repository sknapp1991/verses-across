"use client";
/**
 * A scripture reference inside an AI answer. Desktop: hover shows the verse in a small card; click
 * opens it in the reader (the AI window stays where it was). Phone / touch: one tap shows the card (tap
 * another reference to switch, tap outside to close); a second tap, or "Open" in the card, goes to the
 * passage and lowers the AI sheet so the reader can be seen (✦ at the top brings it back).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { minimizeAi } from "@/lib/ai-chat";
import { chapterTitle, DEFAULT_VERSIONS, findBook, getVersion, readHref } from "@/lib/catalog";
import { fetchBook } from "@/lib/chapter-store";
import type { FoundRef } from "@/lib/refs";
import { useMediaQuery, useViewMode, WIDE_QUERY } from "@/lib/settings";
import { getItem, toggle, useStudy } from "@/lib/study";
import { toast } from "@/lib/ui-store";
import { ClockIcon, StarIcon } from "./icons";
import { useReaderState } from "./use-reader-state";

/** Only one card at a time, across all references. */
let closeOpen: (() => void) | null = null;

/**
 * `target`: open the passage in that named browser tab instead of this page (articles: "va-verses", so a
 * reader who opens three verses gets one tab, reused, not three).
 */
export function RefLink({ r, target }: { r: FoundRef; target?: string }) {
  const touch = useMediaQuery("(hover: none)", false);
  const wide = useMediaQuery(WIDE_QUERY, true);
  const router = useRouter();
  const view = useViewMode();
  const { ref: here, versions: current } = useReaderState();
  const versions = r.ref.work === here.work && current.length ? current : (DEFAULT_VERSIONS[r.ref.work] ?? []);
  // The card follows the reader's layout: versions side by side in Column view, one under another otherwise.
  const columns = view === "column" && versions.length > 1;
  // "#v30-35": the reader puts verse 30 at the top and marks the whole passage.
  const href = readHref(r.ref, r.ref.work === here.work ? undefined : versions, r.verse && r.to ? `${r.verse}-${r.to}` : r.verse);
  const sameChapter = r.ref.work === here.work && r.ref.book === here.book && r.ref.chapter === here.chapter;
  // "Genesis 2–3": each chapter of the range (at most three in the card)
  const chapters = Array.from({ length: r.toChapter ? Math.min(r.toChapter - r.ref.chapter + 1, 3) : 1 }, (_, i) => r.ref.chapter + i);
  const hrefFor = (c: number) => readHref({ ...r.ref, chapter: c }, r.ref.work === here.work ? undefined : versions);
  const chapterName = (c: number) => chapterTitle(findBook(r.ref.work, r.ref.book), c, r.ref.book);
  /**
   * Same chapter: only the #hash changes, which the router doesn't treat as a navigation — so set it
   * here and tell the reader to move (reader.tsx listens for "va-jump"). Returns true when handled.
   */
  const jumpHere = (e: React.MouseEvent) => {
    if (!sameChapter) return false;
    e.preventDefault();
    window.history.pushState(window.history.state, "", href.includes("#") ? href.slice(href.indexOf("#")) : "#v1");
    window.dispatchEvent(new Event("va-jump"));
    return true;
  };
  /** Open `url` in the shared tab (see `target`), bringing it to the front. */
  const inTab = (e: React.MouseEvent, url: string) => {
    // Ctrl/Cmd/Shift/middle click: the browser's own new tab or window, as with any link
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    hide();
    // Already in the shared tab (an article opened there): don't replace this page, use a fresh tab.
    window.open(url, window.name === target ? "_blank" : target)?.focus();
  };
  /** Go to the passage; on a phone the AI sheet covers the reader, so tuck it away. */
  const open = (e: React.MouseEvent) => {
    if (target) return inTab(e, href);
    hide();
    if (!wide) minimizeAi();
    if (jumpHere(e)) return;
    if (touch) {
      e.preventDefault();
      router.push(href, { scroll: false });
    }
  };
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; max?: number } | null>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = () => {
    const el = link.current;
    if (!el) return;
    closeOpen?.();
    const b = el.getBoundingClientRect();
    const W = Math.min(columns ? 560 : 320, window.innerWidth - 16);
    const left = Math.max(8, Math.min(b.left, window.innerWidth - W - 8));
    const below = window.innerHeight - b.bottom - 14;
    const above = b.top - 14;
    if (chapters.length > 1) {
      // A range card is tall: the side with more room, capped to it so the buttons stay on screen.
      setPos(below >= above ? { left, top: b.bottom + 6, max: below } : { left, bottom: window.innerHeight - b.top + 6, max: above });
    } else {
      // Below the link when there's room, else above it.
      setPos(window.innerHeight - b.bottom > 220 ? { left, top: b.bottom + 6 } : { left, bottom: window.innerHeight - b.top + 6 });
    }
    closeOpen = () => setPos(null);
  };
  const hide = () => {
    setPos(null);
    if (closeOpen) closeOpen = null;
  };

  // Touch: a tap outside the card (and outside this link) closes it; so does scrolling the answer.
  useEffect(() => {
    if (!pos) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (card.current?.contains(t) || link.current?.contains(t)) return;
      hide();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    // The card is placed on screen next to the link: if the answer scrolls, it would be left behind.
    const onScroll = (e: Event) => {
      if (!card.current?.contains(e.target as Node)) hide();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [pos]);

  return (
    <>
      <Link
        ref={link}
        href={href}
        scroll={false}
        onClick={(e) => {
          if (touch) {
            if (pos) return open(e); // second tap: open it
            e.preventDefault();
            show();
          } else if (target) {
            inTab(e, href);
          } else {
            hide();
            jumpHere(e);
          }
        }}
        onMouseEnter={() => {
          if (touch) return;
          clearTimeout(timer.current);
          timer.current = setTimeout(show, 250);
        }}
        onMouseLeave={() => {
          clearTimeout(timer.current);
          timer.current = setTimeout(hide, 200);
        }}
        className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
      >
        {r.label}
      </Link>
      {pos && (
        <div
          ref={card}
          role="dialog"
          aria-label={r.label}
          onMouseEnter={() => clearTimeout(timer.current)}
          onMouseLeave={() => {
            if (!touch) timer.current = setTimeout(hide, 200);
          }}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, ...(pos.max ? { maxHeight: pos.max, display: "flex", flexDirection: "column" } : {}) }}
          className={`fixed z-[60] ${columns ? "w-[min(560px,calc(100vw-16px))]" : "w-[min(320px,calc(100vw-16px))]"} rounded-xl border border-line bg-panel p-3 text-left text-sm font-normal not-italic text-ink shadow-2xl`}
        >
          {/* A range of chapters ("Genesis 2–3", ticket b6bd30ae): the start of each (up to three), one under another. */}
          <div className={chapters.length > 1 ? "min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain" : undefined}>
            {chapters.map((c) => (
              <Preview key={c} r={{ ...r, ref: { ...r.ref, chapter: c }, toChapter: undefined }} versions={versions.slice(0, columns ? 3 : 2)} columns={columns} banded />
            ))}
            {r.toChapter && r.toChapter > chapters[chapters.length - 1] && (
              <p className="text-xs text-muted">
                …and {r.toChapter - chapters[chapters.length - 1]} more {r.toChapter - chapters[chapters.length - 1] === 1 ? "chapter" : "chapters"}, to{" "}
                {chapterName(r.toChapter)}: open them in the reader.
              </p>
            )}
          </div>
          <div className="mt-2 flex shrink-0 flex-wrap items-center gap-1.5">
            <Link
              href={href}
              scroll={false}
              onClick={open}
              className="inline-flex min-h-9 items-center rounded-lg bg-accent px-3 text-xs font-medium text-accent-ink">
              Open {chapters.length > 1 ? chapterName(chapters[0]) : r.label} {target ? "in a new tab" : "in the reader"} →
            </Link>
            {chapters.slice(1).map((c) => (
              <Link
                key={c}
                href={hrefFor(c)}
                scroll={false}
                onClick={(e) => {
                  if (target) return inTab(e, hrefFor(c));
                  hide();
                  if (!wide) minimizeAi();
                  if (r.ref.work === here.work && r.ref.book === here.book && c === here.chapter) {
                    // Already on this chapter: only the #hash changes (see jumpHere)
                    e.preventDefault();
                    window.history.pushState(window.history.state, "", "#v1");
                    window.dispatchEvent(new Event("va-jump"));
                    return;
                  }
                  if (touch) {
                    e.preventDefault();
                    router.push(hrefFor(c), { scroll: false });
                  }
                }}
                className="inline-flex min-h-9 items-center rounded-lg border border-accent px-3 text-xs font-medium text-accent hover:bg-accent-soft"
              >
                Open {chapterName(c)} →
              </Link>
            ))}
            {r.verse && <SaveButtons r={r} />}
          </div>
        </div>
      )}
    </>
  );
}

function Preview({ r, versions, columns = false, banded = false }: { r: FoundRef; versions: string[]; columns?: boolean; banded?: boolean }) {
  const [rows, setRows] = useState<{ key: string; list: { id: string; abbr: string; v: string; t: string; dir: "ltr" | "rtl" }[] } | null>(null);
  const key = `${r.ref.work}/${r.ref.book}/${r.ref.chapter}:${r.verse ?? ""}-${r.to ?? ""}/${versions.join(",")}`;
  useEffect(() => {
    let live = true;
    const from = r.verse ? parseInt(r.verse, 10) : 1;
    const to = r.to ? parseInt(r.to, 10) : r.verse ? from : 5; // a chapter: its first five verses
    Promise.all(
      versions.map((id) =>
        fetchBook(r.ref.work, id, r.ref.book)
          .then((b) =>
            (b.chapters[String(r.ref.chapter)]?.verses ?? [])
              .filter((x) => !x.cont && x.t && parseInt(x.v, 10) >= from && parseInt(x.v, 10) <= Math.min(to, from + 9))
              .map((x) => ({ id, abbr: getVersion(id)?.abbr ?? id, v: x.v, t: x.t, dir: getVersion(id)?.dir ?? "ltr" })),
          )
          .catch(() => []),
      ),
    ).then((all) => live && setRows({ key, list: all.flat() }));
    return () => {
      live = false;
    };
  }, [key, r.ref.work, r.ref.book, r.ref.chapter, r.verse, r.to, versions]);
  const title = `${chapterTitle(findBook(r.ref.work, r.ref.book), r.ref.chapter, r.ref.book)}${r.verse ? `:${r.verse}${r.to ? `–${r.to}` : ""}` : ""}`;
  const list = rows?.key === key ? rows.list : null;
  return (
    <div>
      {/* Several chapters in one card: each title on a coloured bar so the chapters stand apart (ticket b6bd30ae). */}
      <p className={banded ? "rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold uppercase tracking-wide text-accent" : "text-xs font-semibold uppercase tracking-wide text-faint"}>
        {title}
      </p>
      <div className="mt-1 max-h-48 space-y-1.5 overflow-y-auto overscroll-contain font-serif leading-snug">
        {!list ? (
          <p className="animate-pulse text-muted">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-muted">Couldn’t load this passage.</p>
        ) : columns ? (
          // Column view: each version in its own column, like the reader, one row per verse so a verse starts on
          // the same line in every version (the row is as tall as its longest translation).
          <div className="grid gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: `repeat(${versions.length}, minmax(0, 1fr))` }}>
            {versions.map((id) => (
              <p key={`h:${id}`} className="font-sans text-[10px] font-semibold uppercase tracking-wide text-faint">
                {getVersion(id)?.abbr ?? id}
              </p>
            ))}
            {[...new Set(list.map((x) => x.v))].flatMap((v) =>
              versions.map((id) => {
                const x = list.find((y) => y.id === id && y.v === v);
                return x ? (
                  <p key={`${id}:${v}`} dir={x.dir} className="min-w-0">
                    <span className="mr-1 font-sans text-[10px] font-semibold text-faint">{x.v}</span>
                    {x.t}
                  </p>
                ) : (
                  <span key={`${id}:${v}`} />
                );
              }),
            )}
          </div>
        ) : (
          // Stacked view: verse by verse, each version under the other.
          [...new Set(list.map((x) => x.v))].map((v) => (
            <div key={v} className="space-y-0.5">
              {list
                .filter((x) => x.v === v)
                .map((x) => (
                  <p key={x.id} dir={x.dir}>
                    <span className="mr-1 font-sans text-[10px] font-semibold text-faint">
                      {versions.length > 1 ? `${x.abbr} ` : ""}
                      {x.v}
                    </span>
                    {x.t}
                  </p>
                ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Favorite / Study later for the verse (or each verse of the range) the reference points to. */
function SaveButtons({ r }: { r: FoundRef }) {
  useStudy(); // re-render when the marks change
  const from = parseInt(r.verse!, 10);
  const to = r.to ? Math.max(from, parseInt(r.to, 10)) : from;
  const refs = Array.from({ length: Math.min(to - from + 1, 30) }, (_, i) => ({ ...r.ref, verse: String(from + i) }));
  const all = (kind: "favorite" | "later") => refs.every((x) => getItem(kind, x));
  const flip = (kind: "favorite" | "later") => {
    const on = !all(kind);
    for (const x of refs) if (!!getItem(kind, x) !== on) toggle(kind, x);
    toast(`${on ? "Saved" : "Removed"} ${r.label} ${on ? "to" : "from"} ${kind === "favorite" ? "Favorites" : "Study later"}`);
  };
  const btn = (on: boolean) =>
    `inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 text-xs ${on ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"}`;
  return (
    <>
      <button type="button" onClick={() => flip("favorite")} aria-pressed={all("favorite")} className={btn(all("favorite"))}>
        <StarIcon width={14} height={14} fill={all("favorite") ? "currentColor" : "none"} /> Favorite
      </button>
      <button type="button" onClick={() => flip("later")} aria-pressed={all("later")} className={btn(all("later"))}>
        <ClockIcon width={14} height={14} /> Study later
      </button>
    </>
  );
}
