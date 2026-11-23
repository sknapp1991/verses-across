"use client";
/**
 * The articles' bookcase (my brother's idea, hub 49aebf52, Nov 22): every article a book on a wooden shelf, its title
 * on the spine, bound in a colour for its first theme. Sort and filter at the top of the case; a "Suggested for you"
 * shelf from what this reader has read and saved (all on this device); books already read are greyed and go to the
 * end of their shelf. The case grows with the library.
 */
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { suggestArticles, useReadArticles, useSavedRefs } from "@/lib/article-study";
import { volumeName, type ArticleSummary } from "@/lib/articles";

type Sort = "theme" | "volume" | "new";
const PREF = "va-bookcase:v1";

/** Leather bindings: one per theme (by the theme's name, so a theme keeps its colour). */
const LEATHER = ["#6b2a26", "#2f4a3a", "#25364f", "#5a3d22", "#7a5a2a", "#4a2f4f", "#3c4a4f", "#5c2f3a", "#2e3f2c", "#6a4a1f"];
const colourOf = (theme: string) => LEATHER[[...theme].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % LEATHER.length];
/** The spine's title: the short one the article gives ("Truth Pt 1"), else its title before the colon (hub 7873673b). */
const spineTitle = (a: ArticleSummary) => a.spine || a.title.split(":")[0];
const longest = (a: ArticleSummary) => Math.max(...Object.values(a.depths).map((d) => d?.minutes ?? 0), 1);

function Spine({ a, current, read }: { a: ArticleSummary; current: boolean; read: boolean }) {
  const theme = a.themes[0] ?? "other";
  const h = Math.min(11, 6.5 + longest(a) / 5); // rem: longer articles stand taller
  return (
    <Link
      href={`/articles/${a.slug}`}
      title={`${a.title}${read ? " (read)" : ""} · ${theme}`}
      aria-current={current ? "page" : undefined}
      className={`group relative flex w-8 shrink-0 items-center justify-center overflow-hidden rounded-t-[3px] rounded-b-[2px] px-0.5 py-2 transition hover:-translate-y-1 focus-visible:-translate-y-1 ${
        current ? "-translate-y-1.5 ring-2 ring-amber-300/80" : ""
      } ${read ? "opacity-55 grayscale" : ""}`}
      style={{
        height: `${h}rem`,
        background: `linear-gradient(90deg, rgba(0,0,0,.35), rgba(255,255,255,.10) 30%, rgba(0,0,0,.05) 60%, rgba(0,0,0,.40)), ${colourOf(theme)}`,
        boxShadow: "inset 0 7px 0 -5px #c9a85a, inset 0 -7px 0 -5px #c9a85a, 1px 0 2px rgba(0,0,0,.5)",
      }}
    >
      <span className="line-clamp-2 text-center font-serif text-[11px] leading-tight text-[#ecd9a0] [text-orientation:mixed] [writing-mode:vertical-rl]" style={{ maxHeight: `${h - 1.2}rem` }}>
        {spineTitle(a)}
      </span>
      {read && (
        <>
          <span aria-hidden className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-[#ecd9a0]">
            ✓
          </span>
          <span className="sr-only"> (read)</span>
        </>
      )}
    </Link>
  );
}

function Shelf({ label, books, current, read }: { label: string; books: ArticleSummary[]; current: string; read: Record<string, unknown> }) {
  if (!books.length) return null;
  // unread first (newest first), read ones at the end of the shelf
  const sorted = [...books].sort((x, y) => Number(!!read[x.slug]) - Number(!!read[y.slug]) || y.date.localeCompare(x.date));
  return (
    <div className="mb-3">
      <p className="mb-1 truncate px-1 text-[11px] font-semibold uppercase tracking-wide text-[#e9d7a6]/80">{label}</p>
      <div className="flex flex-wrap items-end gap-[3px] px-1.5 pt-2">
        {sorted.map((a) => (
          <Spine key={a.slug} a={a} current={a.slug === current} read={!!read[a.slug]} />
        ))}
      </div>
      <div aria-hidden className="h-2.5 rounded-sm shadow-[0_3px_4px_rgba(0,0,0,.55)]" style={{ background: "linear-gradient(#8a5a33, #5e3a1f)" }} />
    </div>
  );
}

export function Bookcase({ articles, current }: { articles: ArticleSummary[]; current: string }) {
  const read = useReadArticles();
  const saved = useSavedRefs();
  const [sort, setSortState] = useState<Sort>("theme");
  useEffect(() => {
    try {
      const s = localStorage.getItem(PREF) as Sort | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- this browser's choice is only readable after hydration
      if (s === "theme" || s === "volume" || s === "new") setSortState(s);
    } catch {
      /* fine without */
    }
  }, []);
  const setSort = (s: Sort) => {
    setSortState(s);
    try {
      localStorage.setItem(PREF, s);
    } catch {
      /* fine without */
    }
  };
  const [tradition, setTradition] = useState("");
  const uid = useId(); // (the bookcase can be on the page twice: beside the text and folded under it)
  const traditions = useMemo(() => [...new Set(articles.flatMap((a) => a.traditions))].sort(), [articles]);
  const list = useMemo(() => articles.filter((a) => !tradition || a.traditions.includes(tradition)), [articles, tradition]);
  const suggested = useMemo(() => suggestArticles(list.filter((a) => a.slug !== current), read, saved, 6), [list, read, saved, current]);
  const shelves = useMemo((): [string, ArticleSummary[]][] => {
    if (sort === "new") return [["Newest", [...list].sort((a, b) => b.date.localeCompare(a.date))]];
    const m = new Map<string, ArticleSummary[]>();
    for (const a of list) {
      const k = sort === "volume" ? `Vol. ${a.volume} · ${volumeName(a.volume)}` : (a.themes[0] ?? "other");
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return [...m].sort((x, y) => (sort === "volume" ? x[0].localeCompare(y[0], undefined, { numeric: true }) : y[1].length - x[1].length || x[0].localeCompare(y[0])));
  }, [list, sort]);
  const nRead = articles.filter((a) => read[a.slug]).length;

  return (
    <div
      aria-label="Bookcase of articles"
      role="navigation"
      className="min-h-full rounded-lg p-2 text-[#f3e6c4] shadow-[inset_0_0_0_3px_#3b2414,0_4px_14px_rgba(0,0,0,.4)]"
      style={{ background: "repeating-linear-gradient(90deg, rgba(0,0,0,.06) 0 3px, transparent 3px 11px), linear-gradient(#4a2e18, #2f1c0e)" }}
    >
      <div className="mb-2 space-y-1.5 rounded-md bg-black/25 p-2">
        <p className="font-serif text-sm font-semibold">
          Bookcase{" "}
          <span className="font-sans text-xs font-normal text-[#e9d7a6]/70">
            {articles.length} articles{nRead ? ` · ${nRead} read` : ""}
          </span>
        </p>
        <div className="flex gap-1.5">
          <label className="sr-only" htmlFor={`${uid}-sort`}>
            Arrange by
          </label>
          <select
            id={`${uid}-sort`}
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="min-h-8 min-w-0 flex-1 rounded border border-[#8a6a3a] bg-[#2a1a0d] px-1.5 text-xs text-[#f3e6c4]"
          >
            <option value="theme">By theme</option>
            <option value="volume">By volume</option>
            <option value="new">Newest</option>
          </select>
          <label className="sr-only" htmlFor={`${uid}-trad`}>
            Tradition
          </label>
          <select
            id={`${uid}-trad`}
            value={tradition}
            onChange={(e) => setTradition(e.target.value)}
            className="min-h-8 min-w-0 flex-1 rounded border border-[#8a6a3a] bg-[#2a1a0d] px-1.5 text-xs text-[#f3e6c4]"
          >
            <option value="">All traditions</option>
            {traditions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      {suggested.length > 0 && <Shelf label="Suggested for you" books={suggested} current={current} read={read} />}
      {shelves.map(([label, books]) => (
        <Shelf key={label} label={label} books={books} current={current} read={read} />
      ))}
      <p className="px-1 text-[10px] leading-snug text-[#e9d7a6]/60">Colour = theme · greyed = read on this device</p>
    </div>
  );
}
