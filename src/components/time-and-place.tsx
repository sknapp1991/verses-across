"use client";
/**
 * Time and place (study lab, my brother's ticket 7a62bb28, Nov 26). Two views:
 * - Places: the places a Bible chapter names, as dots on a small map drawn here (Natural Earth outline, no map tiles,
 *   no outside services), from OpenBible.info's geocoding data (CC BY 4.0); tap a dot for its KJV verses.
 * - When written: the main scriptures on the site on one timeline, the tradition's own account and the usual
 *   historians' range side by side.
 * Data is built by scripts/build-places.mts into public/places/.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { booksOfWork, findBook, readHref } from "@/lib/catalog";
import { fetchBook, type BookFile } from "@/lib/chapter-store";
import {
  MAP_SIZE,
  SURE_LABEL,
  SURE_NOTE,
  WRITINGS,
  project,
  spanLabel,
  type BookPlaces,
  type MapOutline,
  type Place,
  type Writing,
} from "@/lib/time-and-place";

const STORE = "va-time-place:v1";
type Tab = "places" | "time";
const field = "min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-ink";

function readSaved(): { tab?: Tab; book?: string; chapter?: number } | null {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "null") as {
      tab?: Tab;
      book?: string;
      chapter?: number;
    } | null;
  } catch {
    return null; // (private mode: start fresh)
  }
}

export function TimeAndPlace() {
  const [tab, setTab] = useState<Tab>("places");
  const [book, setBook] = useState("act");
  const [chapter, setChapter] = useState(27);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSaved();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the last view, once, after hydration
    setReady(true);
    if (s?.tab === "places" || s?.tab === "time") setTab(s.tab);
    const b = s?.book ? findBook("bible", s.book) : undefined;
    if (b && b.collection.id !== "apocrypha") {
      setBook(b.id);
      if (s?.chapter && s.chapter >= 1 && s.chapter <= (b.chapters ?? 1)) setChapter(s.chapter);
    }
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({ tab, book, chapter }));
    } catch {
      // (not kept: fine)
    }
  }, [ready, tab, book, chapter]);

  return (
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <Link href="/study-lab" className="text-xs text-accent hover:underline">
            ← Study lab
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Time and place</p>
          <h1 className="font-serif text-3xl font-semibold text-ink">Where and when</h1>
          <p className="text-muted">
            See the places a Bible chapter names on a map, and when the great scriptures were written, as each tradition tells it and as
            historians usually date it.
          </p>
        </header>

        <div className="flex gap-2" role="tablist">
          {(
            [
              ["places", "Places in a chapter"],
              ["time", "When they were written"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              id={`tp-tab-${id}`}
              role="tab"
              aria-controls={`tp-panel-${id}`}
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-11 flex-1 rounded-xl border px-3 text-sm font-semibold ${
                tab === id ? "border-accent bg-accent text-accent-ink" : "border-line bg-panel text-ink hover:bg-raised"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`tp-panel-${tab}`} aria-labelledby={`tp-tab-${tab}`}>
          {tab === "places" ? (
            <Places
              book={book}
              chapter={chapter}
              go={(b, c) => {
                setBook(b);
                setChapter(c);
              }}
            />
          ) : (
            <Timeline />
          )}
        </div>

        <Credits />
      </div>
    </main>
  );
}

/* ---------------- places ---------------- */

/** A book's places; null when the book names none (no file). A failed load rejects and isn't kept, so a retry refetches. */
const placesCache = new Map<string, Promise<BookPlaces | null>>();
function loadPlaces(book: string) {
  let p = placesCache.get(book);
  if (!p) {
    p = fetch(`/places/${book}.json`).then((r) => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<BookPlaces>;
    });
    p.catch(() => placesCache.delete(book));
    placesCache.set(book, p);
  }
  return p;
}
let outlinePromise: Promise<MapOutline> | null = null;
function loadOutline() {
  if (!outlinePromise) {
    const p = fetch("/places/map.json").then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<MapOutline>;
    });
    p.catch(() => {
      if (outlinePromise === p) outlinePromise = null;
    });
    outlinePromise = p;
  }
  return outlinePromise;
}

type Box = { x: number; y: number; w: number; h: number };
const ASPECT = 4 / 3;
/** The wide view: from Italy to Persia, Asia Minor to Egypt. */
const WIDE: Box = (() => {
  const [x0, y0] = project(8, 44);
  const [x1, y1] = project(60, 14);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
})();

function fitBox(pts: Place[]): Box {
  if (!pts.length) return WIDE;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x!);
    x1 = Math.max(x1, p.x!);
    y0 = Math.min(y0, p.y!);
    y1 = Math.max(y1, p.y!);
  }
  const pad = Math.max(30, (x1 - x0) * 0.18, (y1 - y0) * 0.18);
  let w = Math.max(160, x1 - x0 + pad * 2);
  let h = Math.max(120, y1 - y0 + pad * 2);
  if (w / h > ASPECT) h = w / ASPECT;
  else w = h * ASPECT;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function Places({ book, chapter, go: goTo }: { book: string; chapter: number; go: (book: string, chapter: number) => void }) {
  // (the places data covers the 66 books of the Protestant canon)
  const books = useMemo(() => booksOfWork("bible").filter((b) => b.collection.id !== "apocrypha"), []);
  const entry = findBook("bible", book);
  const chapters = entry?.chapters ?? 1;
  const [data, setData] = useState<{
    book: string;
    places: Place[] | null;
    failed?: boolean;
  } | null>(null);
  const [outline, setOutline] = useState<MapOutline | null>(null);
  const [outlineFailed, setOutlineFailed] = useState(false);
  const [attempt, setAttempt] = useState(0); // bumped by "Try again"
  const [kjv, setKjv] = useState<{ book: string; file: BookFile } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [wide, setWide] = useState(false);
  const go = (b: string, c: number) => {
    setPicked(null);
    setWide(false);
    goTo(b, c);
  };

  useEffect(() => {
    let live = true;
    loadOutline().then(
      (o) => {
        if (live) {
          setOutline(o);
          setOutlineFailed(false);
        }
      },
      () => live && setOutlineFailed(true),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  useEffect(() => {
    let live = true;
    loadPlaces(book).then(
      (d) => live && setData({ book, places: d ? d.places : [] }),
      () => live && setData({ book, places: null, failed: true }),
    );
    fetchBook("bible", "kjv", book)
      .then((file) => live && setKjv({ book, file }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [book, attempt]);

  const loaded = data?.book === book;
  const failed = (loaded && !!data!.failed) || outlineFailed;
  const inChapter = useMemo(() => (loaded ? (data!.places ?? []).filter((p) => p.v[String(chapter)]) : []), [loaded, data, chapter]);
  const onMap = inChapter.filter((p) => p.x !== undefined);
  const offMap = inChapter.filter((p) => p.x === undefined);
  const box = wide ? WIDE : fitBox(onMap);
  const sel = inChapter.find((p) => p.id === picked) ?? null;

  const verseText = (v: number) =>
    kjv?.book === book ? kjv.file.chapters[String(chapter)]?.verses.find((x) => x.v === String(v))?.t : undefined;
  const chapterHref = (v?: number) => readHref({ work: "bible", book, chapter }, ["kjv"], v ? String(v) : undefined);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_8rem]">
        <label className="block">
          <span className="sr-only">Book</span>
          <select className={field} value={book} onChange={(e) => go(e.target.value, 1)}>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Chapter</span>
          <select className={field} value={chapter} onChange={(e) => go(book, Number(e.target.value))}>
            {Array.from({ length: chapters }, (_, i) => i + 1).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <MapView outline={outline} box={box} places={onMap} picked={picked} pick={(id) => setPicked(id === picked ? null : id)} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <Legend />
        {onMap.length > 0 && (
          <button
            onClick={() => setWide((w) => !w)}
            className="min-h-9 rounded-lg border border-line bg-panel px-3 text-ink hover:bg-raised"
          >
            {wide ? "Zoom to this chapter" : "Show the whole region"}
          </button>
        )}
      </div>

      {failed ? (
        <div className="space-y-2 rounded-xl bg-panel p-4 text-sm text-muted">
          <p>The {outlineFailed ? "map" : "places"} couldn&apos;t be loaded. Check your connection and try again.</p>
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="min-h-9 rounded-lg border border-line bg-paper px-3 text-ink hover:bg-raised"
          >
            Try again
          </button>
        </div>
      ) : !loaded ? (
        <p className="text-sm text-muted">Loading places…</p>
      ) : inChapter.length === 0 ? (
        <p className="rounded-xl bg-panel p-4 text-sm text-muted">
          {entry?.name ?? "This book"} {chapter} names no places that can be found on a map. Try another chapter.
        </p>
      ) : (
        <>
          {sel ? (
            <PlaceCard
              place={sel}
              chapter={chapter}
              bookName={entry?.name ?? book}
              verseText={verseText}
              verseHref={chapterHref}
              go={(c) => go(book, c)}
              close={() => setPicked(null)}
            />
          ) : (
            <p className="text-sm text-muted">Tap a dot or a name to see the verses that name it.</p>
          )}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink">
              Named in {entry?.name ?? book} {chapter} ({inChapter.length})
            </h2>
            <ul className="flex flex-wrap gap-2">
              {inChapter.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setPicked(p.id === picked ? null : p.id)}
                    className={`min-h-9 rounded-full border px-3 text-sm ${
                      p.id === picked ? "border-accent bg-accent text-accent-ink" : "border-line bg-panel text-ink hover:bg-raised"
                    }`}
                  >
                    {p.n}
                    {p.u ? " (not on the map)" : p.c === 0 ? " ?" : ""}
                  </button>
                </li>
              ))}
            </ul>
            {offMap.length > 0 && (
              <p className="mt-2 text-xs text-faint">Not on the map: {offMap.map((p) => `${p.n} (${p.u})`).join(", ")}.</p>
            )}
          </div>
          <p className="text-sm">
            <Link href={chapterHref()} className="text-accent hover:underline">
              Read {entry?.name ?? book} {chapter} in the reader →
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {[2, 1, 0].map((c) => (
        <li key={c} className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden>
            <Dot c={c} r={4.5} />
          </svg>
          {SURE_LABEL[c]}
        </li>
      ))}
    </ul>
  );
}

function Dot({ c, r, on = false }: { c: number; r: number; on?: boolean }) {
  if (c === 2) return <circle r={r} className="fill-accent stroke-paper" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
  if (c === 1)
    return (
      <circle
        r={r}
        className={on ? "fill-accent stroke-ink" : "fill-accent-soft stroke-accent"}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    );
  return (
    <circle
      r={r}
      className={on ? "fill-accent stroke-ink" : "fill-paper stroke-accent"}
      strokeWidth={2}
      strokeDasharray="2 2"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function MapView({
  outline,
  box,
  places,
  picked,
  pick,
}: {
  outline: MapOutline | null;
  box: Box;
  places: Place[];
  picked: string | null;
  pick: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setPx(el.clientWidth || 640);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const u = box.w / px; // map units per screen pixel
  const fs = 12 * u;

  // Labels: the surer and the more often named first; skip one that would overlap a label already placed
  const labels = useMemo(() => {
    const order = [...places].sort((a, b) => (b.id === picked ? 1 : 0) - (a.id === picked ? 1 : 0) || b.c - a.c);
    const taken: Box[] = [];
    const out = new Set<string>();
    for (const p of order) {
      const w = p.n.length * fs * 0.56 + 8 * u;
      const r: Box = { x: p.x! + 7 * u, y: p.y! - fs * 0.6, w, h: fs * 1.2 };
      const hit =
        taken.some((t) => r.x < t.x + t.w && r.x + r.w > t.x && r.y < t.y + t.h && r.y + r.h > t.y) ||
        places.some((q) => q !== p && q.x! > r.x - 4 * u && q.x! < r.x + r.w && q.y! > r.y && q.y! < r.y + r.h);
      if (!hit || p.id === picked) {
        taken.push(r);
        out.add(p.id);
      }
    }
    return out;
  }, [places, picked, fs, u]);

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-line">
      <svg
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        className="block h-auto w-full bg-raised"
        role="img"
        aria-label={`Map with ${places.length} places`}
      >
        <rect x={0} y={0} width={MAP_SIZE.w} height={MAP_SIZE.h} className="fill-raised" />
        {outline && (
          <>
            <path d={outline.land} className="fill-paper stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <path d={outline.lakes} className="fill-raised stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <path d={outline.rivers} className="fill-none stroke-line" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </>
        )}
        {places.map((p) => {
          const on = p.id === picked;
          return (
            <g key={p.id} transform={`translate(${p.x} ${p.y})`} onClick={() => pick(p.id)} className="cursor-pointer">
              <circle r={14 * u} fill="transparent" />
              {on && <circle r={10 * u} className="fill-none stroke-ink" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
              <Dot c={p.c} r={(on ? 6 : 4.5) * u} on={on} />
              {labels.has(p.id) && (
                <text
                  x={7 * u}
                  y={fs * 0.35}
                  fontSize={fs}
                  className={on ? "fill-ink font-semibold" : "fill-ink"}
                  fontStyle={p.a ? "italic" : undefined}
                  style={{
                    paintOrder: "stroke",
                    stroke: "var(--paper)",
                    strokeWidth: 3 * u,
                    strokeLinejoin: "round",
                  }}
                >
                  {p.n}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PlaceCard({
  place,
  chapter,
  bookName,
  verseText,
  verseHref,
  go,
  close,
}: {
  place: Place;
  chapter: number;
  bookName: string;
  verseText: (v: number) => string | undefined;
  verseHref: (v: number) => string;
  go: (chapter: number) => void;
  close: () => void;
}) {
  const verses = place.v[String(chapter)] ?? [];
  const elsewhere = Object.keys(place.v)
    .map(Number)
    .filter((c) => c !== chapter)
    .sort((a, b) => a - b);
  return (
    <article className="space-y-3 rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ink">{place.n}</h2>
          {place.u ? (
            <p className="text-sm text-muted">Not on the map: {place.u}.</p>
          ) : (
            <p className="text-sm text-muted">
              {place.m && place.m !== place.n ? <>Identified with {place.m}. </> : null}
              <span className="font-semibold text-ink">{SURE_LABEL[place.c]}:</span> {SURE_NOTE[place.c]}
              {place.o ? ` ${place.o === 1 ? "One other location has" : `${place.o} other locations have`} also been proposed.` : ""}
              {place.a ? " The dot marks a wider area (a region, a river or a range)." : ""}
            </p>
          )}
        </div>
        <button onClick={close} className="min-h-9 shrink-0 rounded-lg px-2 text-sm text-muted hover:bg-raised" aria-label="Close">
          ✕
        </button>
      </div>
      <ul className="space-y-2">
        {verses.map((v) => (
          <li key={v} className="text-ink">
            <Link href={verseHref(v)} className="mr-1 text-sm font-semibold text-accent hover:underline">
              {bookName} {chapter}:{v}
            </Link>
            <span className="font-serif">{verseText(v) ?? "…"}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-faint">KJV.</p>
      {elsewhere.length > 0 && (
        <div className="text-sm text-muted">
          Also named in {bookName}{" "}
          {elsewhere.slice(0, 24).map((c, i) => (
            <span key={c}>
              {i > 0 && ", "}
              <button onClick={() => go(c)} className="text-accent hover:underline">
                {c}
              </button>
            </span>
          ))}
          {elsewhere.length > 24 ? ` and ${elsewhere.length - 24} more chapters` : ""}.
        </div>
      )}
      <p className="text-xs text-faint">
        <a
          href={`https://www.openbible.info/geo/ancient/${place.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Every proposed location and its sources on OpenBible.info ↗
        </a>
      </p>
    </article>
  );
}

/* ---------------- when they were written ---------------- */

const T0 = -2200;
const T1 = 2000;
const pct = (y: number) => ((y - T0) / (T1 - T0)) * 100;
const TICKS = [-2000, -1500, -1000, -500, 0, 500, 1000, 1500, 2000];
const tickLabel = (y: number) => (y === 0 ? "1 CE" : y < 0 ? `${-y} BCE` : `${y}`);

function Timeline() {
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => [...WRITINGS].sort((a, b) => a.span[0] - b.span[0] || a.span[1] - b.span[1]), []);
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted">
        Each line is a span of years, not a single date: many of these texts were passed on by heart and shaped over generations before they
        were written down. Where a tradition tells its own story differently, both are given. Tap a line to read them.
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-2">
          <span className="inline-block h-2 w-6 rounded-full bg-accent" /> Usual historians&apos; range
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-2 w-6 rounded-full border-2 border-muted" /> The tradition&apos;s own dating, where it gives years
        </li>
      </ul>

      <div className="rounded-2xl border border-line bg-panel p-3">
        <div className="relative mb-1 h-5 text-[10px] text-faint" aria-hidden>
          {TICKS.map((t, i) => (
            <span
              key={t}
              className="absolute top-0 whitespace-nowrap"
              style={{
                left: `${pct(t)}%`,
                transform: i === 0 ? "none" : i === TICKS.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {i % 2 === 0 || t === 0 ? tickLabel(t) : ""}
            </span>
          ))}
        </div>
        <ul className="divide-y divide-line">
          {rows.map((w) => (
            <TimelineRow key={w.title} w={w} open={open === w.title} toggle={() => setOpen(open === w.title ? null : w.title)} />
          ))}
        </ul>
      </div>
      <p className="text-xs text-faint">
        Dates are kept broad and follow ranges widely given in standard reference works. Scholars still debate many of them, and traditions
        often see their scriptures as older than any written copy, or as timeless.
      </p>
    </section>
  );
}

function Bar({ span, kind }: { span: [number, number]; kind: "trad" | "sch" }) {
  const left = pct(span[0]);
  const width = pct(span[1]) - left;
  return (
    <span
      className={`absolute block rounded-full ${kind === "sch" ? "bottom-0.5 h-2 bg-accent" : "top-0.5 h-2 border-2 border-muted"}`}
      style={{ left: `${left}%`, width: `${width}%`, minWidth: 6 }}
    />
  );
}

function TimelineRow({ w, open, toggle }: { w: Writing; open: boolean; toggle: () => void }) {
  const canRead = !!findBook(w.work, w.book);
  return (
    <li>
      <button onClick={toggle} aria-expanded={open} className="block w-full py-2 text-left hover:bg-raised">
        <span className="flex items-baseline justify-between gap-2 px-1">
          <span className="font-semibold text-ink">{w.title}</span>
          <span className="shrink-0 text-xs text-muted">{w.exact ? "" : "c. "}{spanLabel(w.span)}</span>
        </span>
        <span className="relative mt-1 block h-5">
          {TICKS.map((t) => (
            <span key={t} className="absolute top-0 block h-5 border-l border-line" style={{ left: `${pct(t)}%` }} aria-hidden />
          ))}
          {w.tradSpan && <Bar span={w.tradSpan} kind="trad" />}
          <Bar span={w.span} kind="sch" />
        </span>
        <span className="block px-1 text-xs text-faint">{w.tradition}</span>
      </button>
      {open && (
        <div className="space-y-3 px-1 pb-3">
          {w.agreed ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Tradition and historians broadly agree</p>
              <p className="text-sm text-ink">{w.scholarly}</p>
              {w.traditional && <p className="mt-1 text-sm text-muted">{w.traditional}</p>}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-paper p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">As the tradition tells it</p>
                <p className="text-sm text-ink">{w.traditional}</p>
              </div>
              <div className="rounded-xl bg-paper p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">As historians usually date it</p>
                <p className="text-sm text-ink">{w.scholarly}</p>
              </div>
            </div>
          )}
          {canRead && (
            <Link href={readHref({ work: w.work, book: w.book, chapter: 1 })} className="text-sm text-accent hover:underline">
              Read it →
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

/* ---------------- sources ---------------- */

function Credits() {
  return (
    <footer className="space-y-1 border-t border-line pt-4 text-xs text-faint">
      <p>
        Places:{" "}
        <a href="https://www.openbible.info/geo/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          OpenBible.info Bible Geocoding Data
        </a>
        , licensed{" "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          CC BY 4.0
        </a>
        . Changed here: we show only the best-scored location for each place, with a simple sureness label taken from its scores, and the
        KJV verses that name it. Some locations © OpenStreetMap contributors (
        <a
          href="https://opendatacommons.org/licenses/odbl/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          ODbL
        </a>
        ).
      </p>
      <p>
        Map outline: Made with{" "}
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          Natural Earth
        </a>{" "}
        (public domain), simplified. Modern coastlines and rivers: ancient ones were sometimes different.
      </p>
      <p>Bible text: King James Version.</p>
    </footer>
  );
}
