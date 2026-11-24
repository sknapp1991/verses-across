"use client";
/**
 * The articles' bookcase (my brother's idea, hub 49aebf52, Nov 22): every article a book on a wooden shelf, its title
 * on the spine, bound in a colour for its first theme. Sort and filter at the top of the case; a "Suggested for you"
 * shelf from what this reader has read and saved (all on this device); books already read are greyed and go to the
 * end of their shelf. The case grows with the library.
 */
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { setBookcaseHd, suggestArticles, useBookcaseHd, useReadArticles, useSavedRefs } from "@/lib/article-study";
import { VOLUMES, volumeName, type ArticleSummary } from "@/lib/articles";

type Sort = "theme" | "volume" | "new";
const PREF = "va-bookcase:v1";

/** Leather bindings: one per theme (by the theme's name, so a theme keeps its colour). */
const LEATHER = ["#6b2a26", "#2f4a3a", "#25364f", "#5a3d22", "#7a5a2a", "#4a2f4f", "#3c4a4f", "#5c2f3a", "#2e3f2c", "#6a4a1f"];
const colourOf = (theme: string) => LEATHER[[...theme].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % LEATHER.length];
/** The spine's title: the short one the article gives ("Truth Pt 1"), else its title before the colon (hub 7873673b). */
const spineTitle = (a: ArticleSummary) => a.spine || a.title.split(":")[0];
const longest = (a: ArticleSummary) => Math.max(...Object.values(a.depths).map((d) => d?.minutes ?? 0), 1);

/* ---- HD (my brother's ticket 126db598): textures drawn by the browser (SVG noise: nothing to download), leather spines
   with raised bands, gold rules and a title label, widths from the article's length, the odd book leaning ---- */
const svg = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
/** Wood grain: long stretched noise as dark, see-through streaks over the wood colour underneath. (The SVG's own "#"
 * is encoded by encodeURIComponent; encoded twice, the filter breaks and the layer is solid black.) */
const WOOD = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><filter id='w'><feTurbulence type='fractalNoise' baseFrequency='0.004 0.09' numOctaves='4' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.12  0 0 0 0 0.06  0 0 0 0 0.02  1.3 0 0 0 -0.45'/></filter><rect width='100%' height='100%' filter='url(#w)'/></svg>`,
);
/** Leather: fine grain, a little light and dark. */
const LEATHER_GRAIN = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='l'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.6 0 0 0 -0.18'/></filter><rect width='100%' height='100%' filter='url(#l)'/></svg>`,
);
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11);
/** A gold raised band across the spine. */
const BAND = "linear-gradient(rgba(0,0,0,.45), rgba(201,168,90,.95) 25%, #f3dc9a 50%, rgba(201,168,90,.95) 75%, rgba(0,0,0,.45))";

function SpineHd({ a, current, read, wide }: { a: ArticleSummary; current: boolean; read: boolean; wide?: boolean }) {
  const theme = a.themes[0] ?? "other";
  const n = hash(a.slug);
  const h = (wide ? 1.45 : 1) * Math.min(11, 6.2 + longest(a) / 5 + (n % 5) * 0.18); // longer articles stand taller, a little uneven
  const w = (wide ? 2.4 : 1.8) + Math.min(1.1, longest(a) / 40) + (n % 3) * 0.12; // thicker for longer articles
  const lean = !current && n % 7 === 0 ? -2.5 : 0; // the odd book leans on its neighbour
  return (
    <Link
      href={`/articles/${a.slug}`}
      title={`${a.title}${read ? " (read)" : ""} · ${theme}`}
      aria-current={current ? "page" : undefined}
      className={`group relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-t-[4px] rounded-b-[2px] transition hover:-translate-y-1 focus-visible:-translate-y-1 ${
        current ? "-translate-y-1.5 ring-2 ring-amber-300/80" : ""
      } ${read ? "opacity-60 saturate-[.35]" : ""}`}
      style={{
        height: `${h}rem`,
        width: `${w}rem`,
        transform: lean ? `rotate(${lean}deg)` : undefined,
        transformOrigin: "bottom right",
        backgroundImage: `${LEATHER_GRAIN}, linear-gradient(90deg, rgba(0,0,0,.55), rgba(255,255,255,.14) 22%, rgba(255,255,255,.04) 45%, rgba(0,0,0,.18) 70%, rgba(0,0,0,.6))`,
        backgroundColor: colourOf(theme),
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.35), inset 0 0 10px rgba(0,0,0,.45), 2px 0 3px rgba(0,0,0,.55)",
      }}
    >
      {/* raised bands near the head and the foot */}
      <span aria-hidden className="absolute inset-x-0 top-[6%] h-[5px]" style={{ background: BAND }} />
      <span aria-hidden className="absolute inset-x-0 top-[11%] h-[3px]" style={{ background: BAND }} />
      <span aria-hidden className="absolute inset-x-0 bottom-[11%] h-[3px]" style={{ background: BAND }} />
      <span aria-hidden className="absolute inset-x-0 bottom-[6%] h-[5px]" style={{ background: BAND }} />
      {/* the title label: a dark panel with a gold border */}
      <span
        className={`flex items-center justify-center rounded-[2px] px-0.5 py-1.5 font-serif ${wide ? "text-[13px]" : "text-[11px]"} leading-tight text-[#f3dc9a] [text-orientation:mixed] [writing-mode:vertical-rl]`}
        style={{
          maxHeight: `${h * 0.62}rem`,
          background: "linear-gradient(90deg, rgba(0,0,0,.55), rgba(20,12,6,.75), rgba(0,0,0,.55))",
          boxShadow: "inset 0 0 0 1px rgba(201,168,90,.8), 0 0 0 1px rgba(0,0,0,.4)",
          textShadow: "0 1px 1px rgba(0,0,0,.8)",
        }}
      >
        <span className="line-clamp-2">{spineTitle(a)}</span>
      </span>
      {read && (
        <>
          <span aria-hidden className="absolute bottom-[1.5%] left-1/2 -translate-x-1/2 text-[10px] text-[#f3dc9a]">
            ✓
          </span>
          <span className="sr-only"> (read)</span>
        </>
      )}
    </Link>
  );
}

function Spine({ a, current, read, wide }: { a: ArticleSummary; current: boolean; read: boolean; wide?: boolean }) {
  const theme = a.themes[0] ?? "other";
  const h = (wide ? 1.45 : 1) * Math.min(11, 6.5 + longest(a) / 5); // rem: longer articles stand taller
  return (
    <Link
      href={`/articles/${a.slug}`}
      title={`${a.title}${read ? " (read)" : ""} · ${theme}`}
      aria-current={current ? "page" : undefined}
      className={`group relative flex ${wide ? "w-11" : "w-8"} shrink-0 items-center justify-center overflow-hidden rounded-t-[3px] rounded-b-[2px] px-0.5 py-2 transition hover:-translate-y-1 focus-visible:-translate-y-1 ${
        current ? "-translate-y-1.5 ring-2 ring-amber-300/80" : ""
      } ${read ? "opacity-55 grayscale" : ""}`}
      style={{
        height: `${h}rem`,
        background: `linear-gradient(90deg, rgba(0,0,0,.35), rgba(255,255,255,.10) 30%, rgba(0,0,0,.05) 60%, rgba(0,0,0,.40)), ${colourOf(theme)}`,
        boxShadow: "inset 0 7px 0 -5px #c9a85a, inset 0 -7px 0 -5px #c9a85a, 1px 0 2px rgba(0,0,0,.5)",
      }}
    >
      <span className={`line-clamp-2 text-center font-serif ${wide ? "text-[13px]" : "text-[11px]"} leading-tight text-[#ecd9a0] [text-orientation:mixed] [writing-mode:vertical-rl]`} style={{ maxHeight: `${h - 1.2}rem` }}>
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

function Shelf({ label, books, current, read, wide, empty, hd }: { label: string; books: ArticleSummary[]; current: string; read: Record<string, unknown>; wide?: boolean; empty?: string; hd?: boolean }) {
  if (!books.length && !empty) return null;
  // unread first (newest first), read ones at the end of the shelf
  const sorted = [...books].sort((x, y) => Number(!!read[x.slug]) - Number(!!read[y.slug]) || y.date.localeCompare(x.date));
  return (
    // wide: every shelf the same height (room for the tallest book), its board at the bottom, so shelves side by side
    // line up whatever the sort or filter (my brother's ticket 4e978791)
    <div className={wide ? "mb-3 flex h-full flex-col" : "mb-3"}>
      <p className={`mb-1 truncate px-1 font-semibold uppercase tracking-wide text-[#e9d7a6]/80 ${wide ? "text-xs" : "text-[11px]"}`}>{label}</p>
      <div
        className={`flex flex-wrap items-end px-1.5 pt-2 ${wide ? "min-h-[16.5rem] flex-1 content-end" : ""} ${hd ? "gap-px" : wide ? "gap-1" : "gap-[3px]"}`}
        // (HD: the back of the case in shadow above each shelf)
        style={hd ? { boxShadow: "inset 0 18px 22px -14px rgba(0,0,0,.65), inset 0 -10px 14px -10px rgba(0,0,0,.5)" } : undefined}
      >
        {sorted.map((a) =>
          hd ? (
            <SpineHd key={a.slug} a={a} current={a.slug === current} read={!!read[a.slug]} wide={wide} />
          ) : (
            <Spine key={a.slug} a={a} current={a.slug === current} read={!!read[a.slug]} wide={wide} />
          ),
        )}
        {!books.length && empty && <span className="self-end pb-1 pl-1 font-serif text-sm italic text-[#e9d7a6]/45">{empty}</span>}
      </div>
      {hd ? (
        // a thick board: its top lit, its front edge, and a shadow under it
        <div aria-hidden className="relative h-4 rounded-[2px] shadow-[0_6px_8px_rgba(0,0,0,.6)]" style={{ backgroundImage: `${WOOD}, linear-gradient(#a06a3c, #7a4a26 35%, #5a341a)` }}>
          <span className="absolute inset-x-0 top-0 h-px bg-[#e0b27a]/60" />
        </div>
      ) : (
        <div aria-hidden className="h-2.5 rounded-sm shadow-[0_3px_4px_rgba(0,0,0,.55)]" style={{ background: "linear-gradient(#8a5a33, #5e3a1f)" }} />
      )}
    </div>
  );
}

/**
 * `wide`: the whole Articles page as a bookcase (Library view, my brother's ticket e555be87): bigger books, a shelf for
 * every volume (the empty ones "Coming"), arranged by volume to start.
 */
export function Bookcase({ articles, current, wide = false, volumeCounts }: { articles: ArticleSummary[]; current: string; wide?: boolean; volumeCounts?: Record<number, number> }) {
  const read = useReadArticles();
  const hd = useBookcaseHd();
  const saved = useSavedRefs();
  const pref = wide ? `${PREF}:wide` : PREF;
  const [sort, setSortState] = useState<Sort>(wide ? "volume" : "theme");
  useEffect(() => {
    try {
      const s = localStorage.getItem(pref) as Sort | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- this browser's choice is only readable after hydration
      if (s === "theme" || s === "volume" || s === "new") setSortState(s);
    } catch {
      /* fine without */
    }
  }, [pref]);
  const setSort = (s: Sort) => {
    setSortState(s);
    try {
      localStorage.setItem(pref, s);
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
    // the wide case shows every volume's shelf, the empty ones too
    // (only volumes with no article at all: one whose books a search hides isn't "coming")
    if (wide && sort === "volume") for (const v of VOLUMES) if (!volumeCounts?.[v.n]) m.set(`Vol. ${v.n} · ${v.name}`, []);
    for (const a of list) {
      const k = sort === "volume" ? `Vol. ${a.volume} · ${volumeName(a.volume)}` : (a.themes[0] ?? "other");
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return [...m].sort((x, y) => (sort === "volume" ? x[0].localeCompare(y[0], undefined, { numeric: true }) : y[1].length - x[1].length || x[0].localeCompare(y[0])));
  }, [list, sort, wide, volumeCounts]);
  const nRead = articles.filter((a) => read[a.slug]).length;

  return (
    <div
      aria-label="Bookcase of articles"
      role="navigation"
      className="min-h-full rounded-lg p-2 text-[#f3e6c4] shadow-[inset_0_0_0_3px_#3b2414,0_4px_14px_rgba(0,0,0,.4)]"
      style={
        hd
          ? { backgroundImage: `${WOOD}, linear-gradient(#4f3019, #2c190b)`, boxShadow: "inset 0 0 0 4px #2a170a, inset 0 0 40px rgba(0,0,0,.6), 0 6px 18px rgba(0,0,0,.5)" }
          : { background: "repeating-linear-gradient(90deg, rgba(0,0,0,.06) 0 3px, transparent 3px 11px), linear-gradient(#4a2e18, #2f1c0e)" }
      }
    >
      <div className="mb-2 space-y-1.5 rounded-md bg-black/25 p-2">
        {/* SD (plain, light on any device) or HD (textures and details) */}
        <div role="group" aria-label="Bookcase quality" className="float-right flex overflow-hidden rounded border border-[#8a6a3a] text-[10px] font-semibold">
          {([false, true] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={hd === v}
              onClick={() => setBookcaseHd(v)}
              title={v ? "HD: wood and leather textures, gold details (heavier)" : "SD: the plain bookcase (lighter, for any device)"}
              className={`px-1.5 py-0.5 ${hd === v ? "bg-[#e9d7a6] text-[#2a1a0d]" : "text-[#e9d7a6]/80 hover:text-[#f3e6c4]"}`}
            >
              {v ? "HD" : "SD"}
            </button>
          ))}
        </div>
        <p className="font-serif text-sm font-semibold">
          Bookcase{" "}
          <span className="font-sans text-xs font-normal text-[#e9d7a6]/70">
            {articles.length} {articles.length === 1 ? "article" : "articles"}
            {nRead ? ` · ${nRead} read` : ""}
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
          {/* (the whole-page case has the page's own Tradition filter above it) */}
          {!wide && (
            <>
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
            </>
          )}
        </div>
      </div>
      {suggested.length > 0 && <Shelf label="Suggested for you" books={suggested} current={current} read={read} wide={wide} hd={hd} />}
      {/* (wide: two bookcases side by side on a big screen) */}
      <div className={wide ? "grid gap-x-4 lg:grid-cols-2" : ""}>
        {shelves.map(([label, books]) => (
          <Shelf key={label} label={label} books={books} current={current} read={read} wide={wide} hd={hd} empty={wide && sort === "volume" ? "Coming" : undefined} />
        ))}
      </div>
      <p className="px-1 text-[10px] leading-snug text-[#e9d7a6]/60">Colour = theme · greyed = read on this device</p>
    </div>
  );
}
