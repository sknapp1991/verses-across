"use client";
/**
 * Time and place (study lab, my brother's ticket 7a62bb28, Nov 26). Two tabs:
 * - Places: a zoomable map (src/components/time-and-place-map.tsx) in three modes: the places a Bible chapter names,
 *   journeys played stop by stop (time-and-place-journeys.tsx), and eras with the rough reach of the powers of the
 *   time (time-and-place-eras.tsx). A search finds any place in the whole Bible; a place page
 *   (time-and-place-page.tsx) lists every verse that names it. Data: OpenBible.info (CC BY 4.0) and Natural Earth,
 *   built by scripts/build-places.mts into public/places/.
 * - When written: the main scriptures on the site on one timeline, the tradition's own account and the usual
 *   historians' range side by side, filterable by name and tradition.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { booksOfWork, findBook, readHref } from "@/lib/catalog";
import { fetchBook, type BookFile } from "@/lib/chapter-store";
import { noteLab } from "@/lib/lab-badges";
import {
  SURE_LABEL,
  SURE_NOTE,
  WRITINGS,
  fold,
  matchScore,
  spanLabel,
  type BookPlaces,
  type IndexPlace,
  type MapOutline,
  type Place,
  type Writing,
} from "@/lib/time-and-place";
import { Eras } from "./time-and-place-eras";
import { Journeys } from "./time-and-place-journeys";
import { Legend, MapView, WIDE, boxAround, fitBox, loadJson, type MapApi, type MapDot } from "./time-and-place-map";
import { PlacePage } from "./time-and-place-page";

const STORE = "va-time-place:v1";
type Tab = "places" | "time";
type Mode = "chapter" | "journeys" | "eras";
type Saved = { tab?: Tab; mode?: Mode; book?: string; chapter?: number };
const field = "min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-ink";

function readSaved(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "null") as Saved | null;
  } catch {
    return null; // (private mode: start fresh)
  }
}

export function TimeAndPlace() {
  const [tab, setTab] = useState<Tab>("places");
  const [mode, setMode] = useState<Mode>("chapter");
  const [book, setBook] = useState("act");
  const [chapter, setChapter] = useState(27);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSaved();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the last view, once, after hydration
    setReady(true);
    if (s?.tab === "places" || s?.tab === "time") setTab(s.tab);
    if (s?.mode === "chapter" || s?.mode === "journeys" || s?.mode === "eras") setMode(s.mode);
    const b = s?.book ? findBook("bible", s.book) : undefined;
    if (b && b.collection.id !== "apocrypha") {
      setBook(b.id);
      if (s?.chapter && s.chapter >= 1 && s.chapter <= (b.chapters ?? 1)) setChapter(s.chapter);
    }
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({ tab, mode, book, chapter }));
    } catch {
      // (not kept: fine)
    }
  }, [ready, tab, mode, book, chapter]);

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
            The places of the Bible on a map, chapter by chapter, journey by journey and era by era, and when the great scriptures were
            written, as each tradition tells it and as historians usually date it.
          </p>
        </header>

        <div className="flex gap-2" role="tablist">
          {(
            [
              ["places", "Places"],
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
            <Explorer
              mode={mode}
              setMode={setMode}
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

/* ---------------- the explorer: search, modes, place page ---------------- */

const loadPlaces = (book: string) => loadJson<BookPlaces>(`/places/${book}.json`);
const loadOutline = () => loadJson<MapOutline>("/places/map.json");
const loadIndex = () => loadJson<{ places: IndexPlace[] }>("/places/index.json");

/** "#place=a15257a" opens that place's page (so Back closes it). */
const placeFromHash = () => {
  if (typeof location === "undefined") return null;
  const m = /^#place=(a[0-9a-f]{6})$/.exec(location.hash);
  return m ? m[1] : null;
};

function Explorer({
  mode,
  setMode,
  book,
  chapter,
  go: goTo,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  book: string;
  chapter: number;
  go: (book: string, chapter: number) => void;
}) {
  // (the places data covers the 66 books of the Protestant canon)
  const books = useMemo(() => booksOfWork("bible").filter((b) => b.collection.id !== "apocrypha"), []);
  const order = useMemo(() => new Map(books.map((b, i) => [b.id, i])), [books]);
  const [outline, setOutline] = useState<MapOutline | null>(null);
  const [outlineFailed, setOutlineFailed] = useState(false);
  const [index, setIndex] = useState<IndexPlace[] | null>(null);
  const [indexFailed, setIndexFailed] = useState(false);
  const [wantIndex, setWantIndex] = useState(false);
  const [attempt, setAttempt] = useState(0); // bumped by "Try again"
  const [picked, setPicked] = useState<string | null>(null); // a dot in this chapter
  const [found, setFound] = useState<string | null>(null); // a place from search, a background dot or an era dot
  const [page, setPage] = useState<string | null>(null); // the place page shown (OpenBible id)
  const pushed = useRef(false); // (this session opened the page, so Back may close it)

  useEffect(() => {
    const sync = () => {
      const id = placeFromHash();
      if (!id) pushed.current = false;
      setPage(id);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const openPage = (id: string) => {
    pushed.current = true;
    location.hash = `place=${id.split("/")[0]}`;
  };
  const closePage = () => {
    if (pushed.current) {
      pushed.current = false;
      history.back();
    } else {
      // (a direct link: stay on the site, just drop the address's #place)
      history.replaceState(history.state, "", location.pathname + location.search);
      setPage(null);
    }
  };

  const go = (b: string, c: number, pick: string | null = null) => {
    setPicked(pick);
    setFound(null);
    setMode("chapter");
    goTo(b, c);
  };

  useEffect(() => {
    let live = true;
    loadOutline().then(
      (o) => {
        if (!live) return;
        setOutline(o);
        setOutlineFailed(!o); // (a missing file is a failure, not endless loading)
      },
      () => live && setOutlineFailed(true),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  const needIndex = wantIndex || !!found || !!page || mode === "eras";
  useEffect(() => {
    if (!needIndex) return;
    let live = true;
    loadIndex().then(
      (d) => {
        if (!live) return;
        setIndex(d ? d.places : null);
        setIndexFailed(!d);
      },
      () => live && setIndexFailed(true),
    );
    return () => {
      live = false;
    };
  }, [needIndex, attempt]);

  const byAid = useMemo(() => new Map((index ?? []).map((p) => [p.id.split("/")[0], p])), [index]);
  const foundPlace = found && index ? (index.find((p) => p.id === found) ?? null) : null;
  const pagePlace = page ? (byAid.get(page) ?? null) : null;

  // The Cartographer badge counts each place opened once (a card or a page)
  const opened = pagePlace?.id ?? foundPlace?.id;
  useEffect(() => {
    if (opened) noteLab("places", opened.split("/")[0]);
  }, [opened]);

  const modes: [Mode, string][] = [
    ["chapter", "By chapter"],
    ["journeys", "Journeys"],
    ["eras", "Eras"],
  ];

  return (
    <>
      {page &&
        (indexFailed ? (
          <p className="rounded-xl bg-panel p-4 text-sm text-muted">
            The place couldn&apos;t be loaded.{" "}
            <button className="text-accent hover:underline" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </p>
        ) : !index ? (
          <p className="text-sm text-muted">Loading the place…</p>
        ) : !pagePlace ? (
          <p className="text-sm text-muted">
            No such place.{" "}
            <button className="text-accent hover:underline" onClick={closePage}>
              Back to the map
            </button>
          </p>
        ) : (
          <PlacePage
            key={pagePlace.id}
            place={pagePlace}
            jerusalem={byAid.get("a15257a") ?? null}
            order={order}
            back={closePage}
            showChapter={(b, c) => {
              closePage();
              go(b, c, pagePlace.id);
            }}
          />
        ))}

      {/* (kept mounted under a place page, so a journey or an era is where you left it) */}
      <div className="space-y-4" hidden={!!page}>
        <Search
          index={index}
          failed={indexFailed}
          retry={() => setAttempt((a) => a + 1)}
          want={() => setWantIndex(true)}
          choose={(id) => {
            setFound(id);
            setPicked(null);
          }}
        />

        <div className="flex gap-1 rounded-xl border border-line bg-panel p-1" role="tablist" aria-label="Map view">
          {modes.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`min-h-10 flex-1 rounded-lg px-2 text-sm ${mode === id ? "bg-accent font-semibold text-accent-ink" : "text-ink hover:bg-raised"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {outlineFailed && (
          <div className="space-y-2 rounded-xl bg-panel p-4 text-sm text-muted">
            <p>The map couldn&apos;t be loaded. Check your connection and try again.</p>
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="min-h-10 rounded-lg border border-line bg-paper px-3 text-ink hover:bg-raised"
            >
              Try again
            </button>
          </div>
        )}

        {mode === "chapter" && (
          <ChapterMap
            books={books}
            book={book}
            chapter={chapter}
            go={go}
            outline={outline}
            picked={picked}
            setPicked={setPicked}
            found={foundPlace}
            setFound={setFound}
            index={index}
            wantIndex={() => setWantIndex(true)}
            attempt={attempt}
            retry={() => setAttempt((a) => a + 1)}
          />
        )}
        {mode === "journeys" && <Journeys outline={outline} openPlace={openPage} />}
        {mode === "eras" && <Eras outline={outline} index={index} picked={found} pick={(id) => setFound(id === found ? null : id)} />}

        {foundPlace && (
          <IndexCard
            place={foundPlace}
            order={order}
            go={(b, c) => go(b, c, foundPlace.id)}
            open={() => openPage(foundPlace.id)}
            close={() => setFound(null)}
          />
        )}
      </div>
    </>
  );
}

/** One box that finds any place in the whole Bible, by any name it goes by. */
function Search({
  index,
  failed,
  retry,
  want,
  choose,
}: {
  index: IndexPlace[] | null;
  failed: boolean;
  retry: () => void;
  want: () => void;
  choose: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const q = fold(query);
  const results = useMemo(() => {
    if (!q || !index) return [];
    const scored: { p: IndexPlace; s: number; via?: string }[] = [];
    for (const p of index) {
      let s = matchScore(q, p.n);
      let via: string | undefined;
      for (const k of p.k ?? []) {
        const t = matchScore(q, k) - 2; // (the KJV name wins a tie)
        if (t > s) {
          s = t;
          via = k;
        }
      }
      if (s > 0) scored.push({ p, s, via });
    }
    scored.sort((a, b) => b.s - a.s || b.p.w - a.p.w);
    return scored.slice(0, 10);
  }, [q, index]);
  const pickAt = (i: number) => {
    const r = results[i];
    if (!r) return;
    choose(r.p.id);
    setQuery("");
    setActive(0);
  };
  const open = q.length > 0;

  return (
    <div className="relative">
      <label className="block">
        <span className="sr-only">Find a place anywhere in the Bible</span>
        <input
          type="search"
          className={field}
          placeholder="Find a place: Bethlehem, Ur, Patmos…"
          value={query}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="tp-search-results"
          aria-activedescendant={open && results[active] ? `tp-result-${active}` : undefined}
          onFocus={want}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            want();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && results.length) {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === "ArrowUp" && results.length) {
              e.preventDefault();
              setActive((a) => (a - 1 + results.length) % results.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pickAt(active);
            } else if (e.key === "Escape") setQuery("");
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <p className="sr-only" aria-live="polite">
        {open && index ? `${results.length} ${results.length === 1 ? "place" : "places"} found` : ""}
      </p>
      {open && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-panel shadow-lg">
          {failed ? (
            <p className="p-3 text-sm text-muted">
              The place list couldn&apos;t be loaded.{" "}
              <button className="text-accent hover:underline" onClick={retry}>
                Try again
              </button>
            </p>
          ) : !index ? (
            <p className="p-3 text-sm text-muted">Loading places…</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted">No place by that name. Try fewer letters.</p>
          ) : (
            <ul id="tp-search-results" role="listbox">
              {results.map(({ p, via }, i) => (
                <li key={p.id} id={`tp-result-${i}`} role="option" aria-selected={i === active}>
                  <button
                    tabIndex={-1}
                    className={`block min-h-11 w-full px-3 py-2 text-left hover:bg-raised ${i === active ? "bg-raised" : ""}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pickAt(i)}
                  >
                    <span className="font-semibold text-ink">{p.n}</span>
                    {via && <span className="text-sm text-muted"> ({via})</span>}
                    <span className="block text-xs text-faint">
                      {p.u ? "Not on the map" : p.m && p.m !== p.n ? `Identified with ${p.m}` : SURE_LABEL[p.c]} · {p.w}{" "}
                      {p.w === 1 ? "verse" : "verses"}, {p.b.length} {p.b.length === 1 ? "book" : "books"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- by chapter ---------------- */

function ChapterMap({
  books,
  book,
  chapter,
  go,
  outline,
  picked,
  setPicked,
  found,
  setFound,
  index,
  wantIndex,
  attempt,
  retry,
}: {
  books: { id: string; name: string }[];
  book: string;
  chapter: number;
  go: (book: string, chapter: number, pick?: string | null) => void;
  outline: MapOutline | null;
  picked: string | null;
  setPicked: (id: string | null) => void;
  found: IndexPlace | null;
  setFound: (id: string | null) => void;
  index: IndexPlace[] | null;
  wantIndex: () => void;
  attempt: number;
  retry: () => void;
}) {
  const entry = findBook("bible", book);
  const chapters = entry?.chapters ?? 1;
  const [data, setData] = useState<{ book: string; places: Place[] | null; failed?: boolean } | null>(null);
  const [kjv, setKjv] = useState<{ book: string; file: BookFile } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const control = useRef<MapApi | null>(null);

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
  const failed = loaded && !!data!.failed;
  const inChapter = useMemo(() => (loaded ? (data!.places ?? []).filter((p) => p.v[String(chapter)]) : []), [loaded, data, chapter]);
  const onMap = useMemo(() => inChapter.filter((p) => p.x !== undefined), [inChapter]);
  const dots: MapDot[] = useMemo(() => onMap.map((p) => ({ id: p.id, n: p.n, x: p.x!, y: p.y!, c: p.c, a: p.a })), [onMap]);
  const offMap = inChapter.filter((p) => p.x === undefined);
  const sel = inChapter.find((p) => p.id === picked) ?? null;
  const selId = sel?.id;
  useEffect(() => {
    if (selId) noteLab("places", selId.split("/")[0]); // (the Cartographer badge: each place once)
  }, [selId]);
  const focus = found && found.x !== undefined ? found : null;
  const home = focus ? boxAround(focus.x!, focus.y!, 500) : fitBox(onMap);

  // The map moves (it doesn't remount): to a new chapter's places once they arrive, and to a searched place
  const fitKey = loaded ? `${book}:${chapter}` : "";
  useEffect(() => {
    if (fitKey) control.current?.set(fitBox(onMap));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the chapter (and its places) change
  }, [fitKey]);
  const focusId = focus?.id;
  useEffect(() => {
    if (focus) control.current?.flyTo(boxAround(focus.x!, focus.y!, 500));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a different place is searched
  }, [focusId]);

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

      <MapView
        outline={outline}
        initial={loaded ? fitBox(onMap) : WIDE}
        home={home}
        homeLabel={focus ? `Back to ${focus.n}` : "Back to this chapter's places"}
        dots={dots}
        picked={picked}
        pick={(id) => {
          setPicked(id === picked ? null : id);
          setFound(null);
        }}
        focus={focus}
        background={showAll ? index : null}
        pickBackground={(id) => {
          setFound(id);
          setPicked(null);
        }}
        controlRef={control}
        label={`Map of ${entry?.name ?? book} ${chapter}, ${onMap.length} places`}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <Legend />
        <label className="flex min-h-9 items-center gap-2 text-ink">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => {
              setShowAll(e.target.checked);
              if (e.target.checked) wantIndex();
            }}
          />
          Show every Bible place
        </label>
      </div>

      {failed ? (
        <div className="space-y-2 rounded-xl bg-panel p-4 text-sm text-muted">
          <p>The places couldn&apos;t be loaded. Check your connection and try again.</p>
          <button onClick={retry} className="min-h-10 rounded-lg border border-line bg-paper px-3 text-ink hover:bg-raised">
            Try again
          </button>
        </div>
      ) : !loaded ? (
        <p className="text-sm text-muted">Loading places…</p>
      ) : inChapter.length === 0 ? (
        <p className="rounded-xl bg-panel p-4 text-sm text-muted">
          {entry?.name ?? "This book"} {chapter} names no places that can be found on a map. Try another chapter, or search above.
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
              go={(c) => go(book, c, sel.id)}
              open={() => {
                location.hash = `place=${sel.id.split("/")[0]}`;
              }}
              close={() => setPicked(null)}
            />
          ) : (
            !found && <p className="text-sm text-muted">Tap a dot or a name to see the verses that name it. Drag and pinch to explore.</p>
          )}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink">
              Named in {entry?.name ?? book} {chapter} ({inChapter.length})
            </h2>
            <ul className="flex flex-wrap gap-2">
              {inChapter.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setPicked(p.id === picked ? null : p.id);
                      setFound(null);
                    }}
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
            {offMap.length > 0 && <p className="mt-2 text-xs text-faint">Not on the map: {offMap.map((p) => `${p.n} (${p.u})`).join(", ")}.</p>}
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

/* ---------------- cards ---------------- */

function PlaceCard({
  place,
  chapter,
  bookName,
  verseText,
  verseHref,
  go,
  open,
  close,
}: {
  place: Place;
  chapter: number;
  bookName: string;
  verseText: (v: number) => string | undefined;
  verseHref: (v: number) => string;
  go: (chapter: number) => void;
  open: () => void;
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
          <Sureness place={place} />
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
      <button onClick={open} className="text-sm font-semibold text-accent hover:underline">
        Open the place page →
      </button>
      <OpenBibleLink id={place.id} />
    </article>
  );
}

function Sureness({ place }: { place: Place | IndexPlace }) {
  if (place.u) return <p className="text-sm text-muted">Not on the map: {place.u}.</p>;
  return (
    <p className="text-sm text-muted">
      {place.m && place.m !== place.n ? <>Identified with {place.m}. </> : null}
      <span className="font-semibold text-ink">{SURE_LABEL[place.c]}:</span> {SURE_NOTE[place.c]}
      {place.o ? ` ${place.o === 1 ? "One other location has" : `${place.o} other locations have`} also been proposed.` : ""}
      {place.a ? " The dot marks a wider area (a region, a river or a range)." : ""}
    </p>
  );
}

function OpenBibleLink({ id }: { id: string }) {
  return (
    <p className="text-xs text-faint">
      <a
        href={`https://www.openbible.info/geo/ancient/${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:underline"
      >
        Every proposed location and its sources on OpenBible.info ↗
      </a>
    </p>
  );
}

/** A place from search (or a background or era dot): every chapter in the Bible that names it, canonical order. */
function IndexCard({
  place,
  order,
  go,
  open,
  close,
}: {
  place: IndexPlace;
  order: Map<string, number>;
  go: (book: string, chapter: number) => void;
  open: () => void;
  close: () => void;
}) {
  const [all, setAll] = useState(false);
  const byBook = [...place.b].sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99));
  const chapters = byBook.reduce((s, [, cs]) => s + cs.length, 0);
  const shown = all ? byBook : byBook.slice(0, 8);
  return (
    <article className="space-y-3 rounded-2xl border border-accent bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ink">{place.n}</h2>
          {place.k && place.k.length > 0 && <p className="text-xs text-faint">Also: {place.k.join(", ")}</p>}
          <Sureness place={place} />
        </div>
        <button onClick={close} className="min-h-9 shrink-0 rounded-lg px-2 text-sm text-muted hover:bg-raised" aria-label="Close">
          ✕
        </button>
      </div>
      <button onClick={open} className="text-sm font-semibold text-accent hover:underline">
        Open the place page →
      </button>
      <p className="text-sm text-muted">
        Named in {place.w} KJV {place.w === 1 ? "verse" : "verses"}, in {chapters} {chapters === 1 ? "chapter" : "chapters"}. Tap a
        chapter to see it on the map, or ↗ to read it.
      </p>
      <ul className="space-y-2">
        {shown.map(([b, cs]) => {
          const name = findBook("bible", b)?.name ?? b;
          return (
            <li key={b}>
              <span className="mr-2 text-sm font-semibold text-ink">{name}</span>
              <span className="inline-flex flex-wrap gap-1 align-middle">
                {cs.map((c) => (
                  <span key={c} className="inline-flex items-center rounded-full border border-line bg-paper text-sm">
                    <button
                      onClick={() => go(b, c)}
                      className="min-h-8 rounded-l-full px-2 text-ink hover:bg-raised"
                      aria-label={`${name} ${c} on the map`}
                    >
                      {c}
                    </button>
                    <Link
                      href={readHref({ work: "bible", book: b, chapter: c }, ["kjv"])}
                      className="flex min-h-8 items-center rounded-r-full border-l border-line px-1.5 text-xs text-accent hover:bg-raised"
                      aria-label={`Read ${name} ${c}`}
                    >
                      ↗
                    </Link>
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      {byBook.length > 8 && (
        <button onClick={() => setAll((a) => !a)} className="text-sm text-accent hover:underline">
          {all ? "Show fewer books" : `Show all ${byBook.length} books`}
        </button>
      )}
      <OpenBibleLink id={place.id} />
    </article>
  );
}

/* ---------------- when they were written ---------------- */

const T0 = -2200;
const T1 = 2000;
const pct = (y: number) => ((y - T0) / (T1 - T0)) * 100;
const TICKS = [-2000, -1500, -1000, -500, 0, 500, 1000, 1500, 2000];
const tickLabel = (y: number) => (y === 0 ? "1 CE" : y < 0 ? `${-y} BCE` : `${y}`);

/** Tradition filters (a work can be in more than one: "Jewish and Christian"). */
const FAMILIES: [string, RegExp][] = [
  ["Ancient Near East", /mesopotamia|egypt/i],
  ["Bahá’í", /bah/i],
  ["Buddhist", /buddhist/i],
  ["Chinese (Confucian, Taoist)", /confucian|taoist/i],
  ["Christian", /christian/i],
  ["Hindu", /hindu/i],
  ["Jain", /jain/i],
  ["Jewish", /jewish/i],
  ["Maya", /maya/i],
  ["Muslim", /muslim/i],
  ["Shinto", /shinto/i],
  ["Sikh", /sikh/i],
  ["Zoroastrian", /zoroastrian/i],
];

/** For the filter: folded, with spaces (and so apostrophes) gone: "bahai" finds Bahá’í, "kiche" K’iche’. */
const squash = (s: string) => fold(s).replace(/ /g, "");

function Timeline() {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("");
  const rows = useMemo(() => {
    const fq = squash(q);
    const re = FAMILIES.find(([n]) => n === family)?.[1];
    return [...WRITINGS]
      .filter((w) => !re || re.test(w.tradition))
      .filter((w) => !fq || squash(`${w.title} ${w.tradition}`).includes(fq) || matchScore(fold(q), w.title) > 0)
      .sort((a, b) => a.span[0] - b.span[0] || a.span[1] - b.span[1]);
  }, [q, family]);
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted">
        Each line is a span of years, not a single date: many of these texts were passed on by heart and shaped over generations before they
        were written down. Where a tradition tells its own story differently, both are given. Tap a line to read them.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="sr-only">Filter by name</span>
          <input type="search" className={field} placeholder="Filter: Gita, Torah, Quran…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="block">
          <span className="sr-only">Tradition</span>
          <select className={field} value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="">All traditions</option>
            {FAMILIES.map(([n]) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
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
        {rows.length === 0 ? (
          <p className="p-3 text-sm text-muted">Nothing matches. Try another name or tradition.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((w) => (
              <TimelineRow key={w.title} w={w} open={open === w.title} toggle={() => setOpen(open === w.title ? null : w.title)} />
            ))}
          </ul>
        )}
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
          <span className="shrink-0 text-xs text-muted">
            {w.exact ? "" : "c. "}
            {spanLabel(w.span)}
          </span>
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
        . Changed here: we show only the best-scored location for each place (or a named proposal on a journey route), with a simple
        sureness label taken from its scores, and the KJV verses that name it. Some locations © OpenStreetMap contributors (
        <a
          href="https://opendatacommons.org/licenses/odbl/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          ODbL
        </a>
        ). Photos on place pages come from Wikimedia Commons, each with its author and licence, and load only when you tap &ldquo;Show photo&rdquo;.
      </p>
      <p>
        Map outline: Made with{" "}
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          Natural Earth
        </a>{" "}
        (public domain), simplified. Modern coastlines and rivers: ancient ones were sometimes different. The shapes of the powers in
        &ldquo;Eras&rdquo; are our own rough sketches.
      </p>
      <p>Bible text: King James Version.</p>
    </footer>
  );
}
