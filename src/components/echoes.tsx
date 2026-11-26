"use client";
/**
 * Echoes (hidden study page, my brother's ticket 7a62bb28, Nov 26): where later texts quote, echo or retell earlier
 * ones. A map of the Bible's cross references book to book (arcs sized by how many verse pairs link two books; tap a
 * book, then one of its links, to read the pairs), well-known Old Testament quotations in the New side by side, and
 * stories told in more than one tradition, each in its own words. Data: src/lib/echoes.ts and public/echoes
 * (scripts/build-echoes.mts). Texts load only when shown.
 */
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AiWindow } from "./ai-window";
import { askAboutVerse, openAi } from "@/lib/ai-chat";
import { findBook, readHref } from "@/lib/catalog";
import { fetchBook } from "@/lib/chapter-store";
import { ECHO_BOOKS, ECHO_VERSION, NT_START, PARALLELS, QUOTATIONS, parseVerse, type Parallel, type Quotation } from "@/lib/echoes";

/* ---------------- texts ---------------- */

type Shown = { t: string; n?: string };
type Texts = Record<string, Shown>;
type RawVerse = { v: string; t: string; n?: string; cont?: string };

const bookName = (id: string) => findBook("bible", id)?.name ?? id;

/** Thompson's passages are long paragraphs without line numbers: name the ones shown. */
const GILGAMESH_PART: Record<string, string> = { "11:2": ": the warning and the boat", "11:11": ": the flood and the birds" };

/** "Isaiah 7:14", "Quran 12:4", "Gilgamesh, tablet 11: the flood and the birds" */
function labelOf(ref: string) {
  const r = parseVerse(ref);
  if (r.work === "bible") return `${bookName(r.book)} ${r.chapter}:${r.verse}`;
  if (r.work === "quran") return `Quran ${r.chapter}:${r.verse}`;
  if (r.work === "gilgamesh") return `Gilgamesh, tablet ${r.chapter}${GILGAMESH_PART[`${r.chapter}:${r.verse}`] ?? ""}`;
  return ref;
}
function hrefOf(ref: string) {
  const r = parseVerse(ref);
  return readHref({ work: r.work, book: r.book, chapter: r.chapter }, [ECHO_VERSION[r.work] ?? "kjv"], r.verse);
}

/** The texts of these verses, exactly as the site has them; null while loading. */
function useVerses(refs: string[]) {
  const key = refs.join(" ");
  const [got, setGot] = useState<{ key: string; texts: Texts; failed: boolean } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    const list = key.split(" ");
    const books = list.map((r) => r.split("/").slice(0, 2).join("/")).filter((b, i, a) => a.indexOf(b) === i);
    Promise.all(
      books.map((b) => {
        const [work, book] = b.split("/");
        return fetchBook(work, ECHO_VERSION[work] ?? "kjv", book).then((f) => [b, f] as const);
      }),
    ).then(
      (files) => {
        const byBook = new Map(files);
        const texts: Texts = {};
        for (const ref of list) {
          const r = parseVerse(ref);
          const chapters = byBook.get(`${r.work}/${r.book}`)?.chapters;
          const verses = (chapters?.[String(r.chapter)]?.verses ?? []) as RawVerse[];
          let v = verses.find((x) => x.v === r.verse);
          if (v?.cont) {
            // This verse's words are printed inside another cell: show that one.
            const [c, cv] = v.cont.split(":");
            v = ((chapters?.[c]?.verses ?? []) as RawVerse[]).find((x) => x.v === cv);
          }
          if (v) texts[ref] = { t: v.t, n: v.n };
        }
        if (live) setGot({ key, texts, failed: false });
      },
      () => {
        if (live) setGot({ key, texts: {}, failed: true });
      },
    );
    return () => {
      live = false;
    };
  }, [key]);
  return got && got.key === key ? got : null;
}

function VerseBlock({ refId, texts, sub }: { refId: string; texts: ReturnType<typeof useVerses>; sub?: string }) {
  const v = texts?.texts[refId];
  const r = parseVerse(refId);
  const own = v?.n && v.n !== r.verse ? ` (Pickthall numbers it ${v.n})` : "";
  return (
    <div className="space-y-1">
      <p className="text-xs">
        <Link href={hrefOf(refId)} className="font-semibold text-accent hover:underline">
          {labelOf(refId)}
        </Link>
        <span className="text-faint">
          {own}
          {sub ? ` · ${sub}` : ""}
        </span>
      </p>
      <p className="whitespace-pre-line font-serif text-[15px] leading-relaxed text-ink">
        {v ? v.t : texts ? (texts.failed ? "Couldn't load this text. Check the connection and try again." : "Not found in this version.") : "…"}
      </p>
    </div>
  );
}

function askPair(title: string, refs: string[], texts: ReturnType<typeof useVerses>) {
  const lines = refs.map((r) => `${labelOf(r)}: ${texts?.texts[r]?.t ?? ""}`).join("\n\n");
  askAboutVerse({
    reference: title,
    texts: [{ abbr: "KJV", name: "King James Version and other texts as shown", language: "English", text: lines }],
  });
}

/* ---------------- 1. the map ---------------- */

type BooksFile = { books: string[]; links: [number, number, number][] };
type PairsFile = Record<string, [string, string, number][]>;

let booksPromise: Promise<BooksFile> | null = null;
const loadBooks = () => {
  if (!booksPromise) {
    booksPromise = fetch("/echoes/books.json").then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<BooksFile>;
    });
    booksPromise.catch(() => {
      booksPromise = null;
    });
  }
  return booksPromise;
};
const pairFiles = new Map<string, Promise<PairsFile>>();
const loadPairs = (book: string) => {
  let p = pairFiles.get(book);
  if (!p) {
    p = fetch(`/echoes/${book}.json`).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<PairsFile>;
    });
    p.catch(() => pairFiles.delete(book));
    pairFiles.set(book, p);
  }
  return p;
};

const STEP = 10;
const PAD = 10;
const BASE = 190;
const W = PAD * 2 + STEP * (ECHO_BOOKS.length - 1);
const H = BASE + 16;
const xOf = (i: number) => PAD + i * STEP;
const arc = (a: number, b: number) => {
  const x1 = xOf(Math.min(a, b));
  const x2 = xOf(Math.max(a, b));
  const rx = (x2 - x1) / 2;
  return `M${x1} ${BASE}A${rx} ${rx * 0.55} 0 0 1 ${x2} ${BASE}`;
};
const widthOf = (n: number) => 0.4 + Math.sqrt(n) / 6;
const MIN_SHOWN = 5; // with no book chosen, fainter links than this are left out to keep the picture clear

type Scope = "all" | "between";

function ArcMap() {
  const [data, setData] = useState<BooksFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [partner, setPartner] = useState<number | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [allLinks, setAllLinks] = useState(false);

  useEffect(() => {
    let live = true;
    loadBooks().then(
      (d) => live && setData(d),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  const links = useMemo(() => {
    if (!data) return [];
    return data.links.filter(([a, b]) => scope === "all" || (a < NT_START) !== (b < NT_START));
  }, [data, scope]);
  const totals = useMemo(() => {
    const t = ECHO_BOOKS.map(() => 0);
    for (const [a, b, n] of links) {
      t[a] += n;
      t[b] += n;
    }
    return t;
  }, [links]);
  const mine = useMemo(() => {
    if (sel === null) return [];
    return links
      .filter(([a, b]) => a === sel || b === sel)
      .map(([a, b, n]) => ({ j: a === sel ? b : a, n }))
      .sort((x, y) => y.n - x.n);
  }, [links, sel]);

  const choose = (i: number | null) => {
    setSel(i);
    setPartner(null);
    setAllLinks(false);
  };

  const faint = links.filter(([a, b, n]) => (sel === null ? n >= MIN_SHOWN : a !== sel && b !== sel && n >= MIN_SHOWN));
  const lit = sel === null ? [] : links.filter(([a, b]) => a === sel || b === sel);

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h2 className="font-serif text-2xl font-semibold text-ink">The Bible, linked to itself</h2>
        <p className="text-sm text-muted">
          Each arc joins two books whose verses are closest in meaning: a thicker arc means more pairs of verses. The Old
          Testament runs on the left, the New on the right. Tap a book to light up its links.
        </p>
        <p className="text-xs text-faint">
          Worked out by a computer model from closeness of meaning, not a hand-made index: some pairs are look-alikes,
          not quotations.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="echo-book">
          Book
        </label>
        <select
          id="echo-book"
          value={sel === null ? "" : String(sel)}
          onChange={(e) => choose(e.target.value === "" ? null : Number(e.target.value))}
          className="min-h-9 rounded-lg border border-line bg-panel px-2 text-sm text-ink"
        >
          <option value="">Choose a book…</option>
          <optgroup label="Old Testament">
            {ECHO_BOOKS.slice(0, NT_START).map((b, i) => (
              <option key={b} value={i}>
                {bookName(b)}
              </option>
            ))}
          </optgroup>
          <optgroup label="New Testament">
            {ECHO_BOOKS.slice(NT_START).map((b, i) => (
              <option key={b} value={i + NT_START}>
                {bookName(b)}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="flex overflow-hidden rounded-lg border border-line text-xs">
          {(
            [
              ["all", "Every link"],
              ["between", "Old and New only"],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              type="button"
              aria-pressed={scope === k}
              onClick={() => {
                setScope(k);
                setPartner(null);
              }}
              className={`min-h-9 px-3 ${scope === k ? "bg-accent text-accent-ink" : "bg-panel text-muted hover:bg-raised"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {sel !== null && (
          <button type="button" onClick={() => choose(null)} className="min-h-9 px-1 text-xs text-accent hover:underline">
            Clear
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-panel p-2">
        {failed ? (
          <p className="p-4 text-sm text-muted">Couldn&apos;t load the map. Check the connection and reload.</p>
        ) : !data ? (
          <p className="p-4 text-sm text-faint">Loading the map…</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Arc diagram of cross references between the books of the Bible">
            <g fill="none" className="text-faint" stroke="currentColor">
              {faint.map(([a, b, n]) => (
                <path key={`${a}-${b}`} d={arc(a, b)} strokeWidth={widthOf(n)} strokeOpacity={sel === null ? 0.22 : 0.07} />
              ))}
            </g>
            <g fill="none" className="text-accent" stroke="currentColor">
              {lit.map(([a, b, n]) => {
                const other = a === sel ? b : a;
                return (
                  <path
                    key={`${a}-${b}`}
                    d={arc(a, b)}
                    strokeWidth={widthOf(n) * (partner === other ? 1.6 : 1)}
                    strokeOpacity={partner === null || partner === other ? 0.75 : 0.25}
                    className="cursor-pointer"
                    onClick={() => setPartner(other)}
                  />
                );
              })}
            </g>
            <line x1={xOf(0)} x2={xOf(NT_START - 1)} y1={BASE} y2={BASE} className="text-muted" stroke="currentColor" strokeWidth={1} />
            <line x1={xOf(NT_START)} x2={xOf(ECHO_BOOKS.length - 1)} y1={BASE} y2={BASE} className="text-accent" stroke="currentColor" strokeWidth={1} />
            {ECHO_BOOKS.map((b, i) => {
              const on = i === sel || i === partner;
              return (
                <g key={b} onClick={() => choose(i === sel ? null : i)} className="cursor-pointer">
                  <title>{bookName(b)}</title>
                  <rect x={xOf(i) - STEP / 2} y={BASE - 14} width={STEP} height={H - BASE + 14} fill="currentColor" fillOpacity={0} />
                  <circle
                    cx={xOf(i)}
                    cy={BASE}
                    r={on ? 4.5 : 1.5 + Math.sqrt(totals[i]) / 30}
                    className={on ? "text-accent" : i < NT_START ? "text-muted" : "text-ink"}
                    fill="currentColor"
                  />
                </g>
              );
            })}
          </svg>
        )}
        <div className="flex px-1 pt-1 text-[11px] text-faint">
          <span style={{ width: `${(NT_START / ECHO_BOOKS.length) * 100}%` }}>Old Testament: Genesis to Malachi</span>
          <span className="text-right" style={{ width: `${((ECHO_BOOKS.length - NT_START) / ECHO_BOOKS.length) * 100}%` }}>
            New: Matthew to Revelation
          </span>
        </div>
      </div>

      {sel !== null && data && (
        <div className="space-y-3 rounded-2xl border border-line bg-panel p-4">
          <h3 className="font-serif text-xl font-semibold text-ink">{bookName(ECHO_BOOKS[sel])}: the books closest in meaning</h3>
          {mine.length === 0 ? (
            <p className="text-sm text-muted">No links with this filter.</p>
          ) : (
            <>
              <ul className="space-y-1">
                {(allLinks ? mine : mine.slice(0, 10)).map(({ j, n }) => (
                  <li key={j}>
                    <button
                      type="button"
                      aria-pressed={partner === j}
                      onClick={() => setPartner(partner === j ? null : j)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm ${partner === j ? "bg-accent-soft text-ink" : "text-ink hover:bg-raised"}`}
                    >
                      <span className="w-32 shrink-0 truncate">
                        {bookName(ECHO_BOOKS[j])}
                        <span className="text-faint">{j < NT_START ? " · OT" : " · NT"}</span>
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded bg-raised">
                        <span className="block h-2 rounded bg-accent" style={{ width: `${Math.max(3, (n / mine[0].n) * 100)}%` }} />
                      </span>
                      <span className="w-12 shrink-0 text-right text-xs text-muted">{n.toLocaleString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {mine.length > 10 && (
                <button type="button" onClick={() => setAllLinks(!allLinks)} className="text-xs text-accent hover:underline">
                  {allLinks ? "Show the top ten" : `Show all ${mine.length} books`}
                </button>
              )}
              <p className="text-xs text-faint">The number is how many pairs of verses link the two books. Tap one to read the closest pairs.</p>
            </>
          )}
          {partner !== null && <Pairs a={ECHO_BOOKS[sel]} b={ECHO_BOOKS[partner]} />}
        </div>
      )}
    </section>
  );
}

function Pairs({ a, b }: { a: string; b: string }) {
  const [got, setGot] = useState<{ key: string; pairs: [string, string, number][] | null } | null>(null);
  const key = `${a}|${b}`;
  useEffect(() => {
    let live = true;
    loadPairs(a).then(
      (f) => live && setGot({ key: `${a}|${b}`, pairs: f[b] ?? [] }),
      () => live && setGot({ key: `${a}|${b}`, pairs: null }),
    );
    return () => {
      live = false;
    };
  }, [a, b]);
  const pairs = got && got.key === key ? got.pairs : undefined;
  const refs = useMemo(() => (pairs ? pairs.flatMap(([x, y]) => [`bible/${a}/${x}`, `bible/${b}/${y}`]) : []), [pairs, a, b]);
  const texts = useVerses(refs);

  if (pairs === undefined) return <p className="text-sm text-faint">Loading…</p>;
  if (pairs === null) return <p className="text-sm text-muted">Couldn&apos;t load these pairs. Check the connection and try again.</p>;
  return (
    <div className="space-y-3 border-t border-line pt-3">
      <h4 className="text-sm font-semibold text-ink">
        {bookName(a)} and {bookName(b)}: the closest pairs
      </h4>
      {pairs.map(([x, y, s]) => (
        <div key={`${x}-${y}`} className="grid gap-3 rounded-xl bg-raised p-3 sm:grid-cols-2">
          <VerseBlock refId={`bible/${a}/${x}`} texts={texts} />
          <VerseBlock refId={`bible/${b}/${y}`} texts={texts} sub={`closeness ${s} of 100`} />
        </div>
      ))}
    </div>
  );
}

/* ---------------- 2. quotations ---------------- */

const PAGE = 8;
/** In New Testament order (book, chapter, verse of the quoting verse). */
const ORDERED = QUOTATIONS.slice().sort((x, y) => {
  const a = parseVerse(x.to);
  const b = parseVerse(y.to);
  return ECHO_BOOKS.indexOf(a.book) - ECHO_BOOKS.indexOf(b.book) || a.chapter - b.chapter || parseInt(a.verse, 10) - parseInt(b.verse, 10);
});

function QuotationCard({ q, texts }: { q: Quotation; texts: ReturnType<typeof useVerses> }) {
  return (
    <li className="space-y-3 rounded-2xl border border-line bg-panel p-4">
      {q.note && <p className="text-xs font-semibold uppercase tracking-wide text-accent">{q.note}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <VerseBlock refId={q.from} texts={texts} sub="Old Testament" />
        <VerseBlock refId={q.to} texts={texts} sub="New Testament" />
      </div>
      <button
        type="button"
        onClick={() => askPair(`${labelOf(q.from)} quoted in ${labelOf(q.to)}`, [q.from, q.to], texts)}
        className="text-xs font-medium text-accent hover:underline"
      >
        ✦ Ask AI about this quotation
      </button>
    </li>
  );
}

function Quotations() {
  const [shown, setShown] = useState(PAGE);
  const list = useMemo(() => ORDERED.slice(0, shown), [shown]);
  const refs = useMemo(() => list.flatMap((q) => [q.from, q.to]), [list]);
  const texts = useVerses(refs);
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h2 className="font-serif text-2xl font-semibold text-ink">The Old Testament quoted in the New</h2>
        <p className="text-sm text-muted">
          {QUOTATIONS.length} well-known places where a New Testament writer quotes the Hebrew scriptures, in the order
          they come in the New Testament, both in the King James Version. The wording often differs a little: the New
          Testament writers often quoted the Greek translation of their day, or gave the sense rather than the exact words.
        </p>
      </div>
      <ul className="space-y-3">
        {list.map((q) => (
          <QuotationCard key={q.from + q.to} q={q} texts={texts} />
        ))}
      </ul>
      {shown < QUOTATIONS.length && (
        <button type="button" onClick={() => setShown(shown + PAGE)} className="min-h-9 rounded-lg border border-line px-4 text-sm text-ink hover:bg-raised">
          Show more ({QUOTATIONS.length - shown} left)
        </button>
      )}
    </section>
  );
}

/* ---------------- 3. across traditions ---------------- */

function ParallelCard({ p, open, onToggle }: { p: Parallel; open: boolean; onToggle: () => void }) {
  return (
    <li className="rounded-2xl border border-line bg-panel">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-start justify-between gap-3 p-4 text-left">
        <span>
          <span className="block font-serif text-xl font-semibold text-ink">{p.title}</span>
          <span className="mt-1 block text-xs text-faint">{p.tellings.map((t) => `${t.tradition}: ${t.where}`).join(" · ")}</span>
        </span>
        <span className="text-accent">{open ? "−" : "+"}</span>
      </button>
      {open && <ParallelBody p={p} />}
    </li>
  );
}

function ParallelBody({ p }: { p: Parallel }) {
  const refs = useMemo(() => p.tellings.flatMap((t) => t.verses), [p]);
  const texts = useVerses(refs);
  return (
    <div className="space-y-4 border-t border-line p-4">
      <p className="text-sm text-muted">{p.note}</p>
      {!texts && <p className="text-xs text-faint">Loading the texts{p.tellings.some((t) => t.tradition === "Quran") ? " (the whole Quran comes as one file, so this can take a moment)" : ""}…</p>}
      <div className={`grid gap-4 ${p.tellings.length > 2 ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}>
        {p.tellings.map((t) => (
          <div key={t.tradition} className="space-y-3 rounded-xl bg-raised p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-ink">{t.tradition}</h4>
              <Link href={hrefOf(t.read)} className="text-xs text-accent hover:underline">
                Read {t.where} →
              </Link>
            </div>
            {t.verses.map((r) => (
              <VerseBlock key={r} refId={r} texts={texts} />
            ))}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => askPair(`${p.title}: the tellings side by side`, refs, texts)} className="text-xs font-medium text-accent hover:underline">
        ✦ Ask AI about these tellings
      </button>
    </div>
  );
}

function Traditions() {
  const [open, setOpen] = useState<string | null>(PARALLELS[0].id);
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h2 className="font-serif text-2xl font-semibold text-ink">One story, more than one telling</h2>
        <p className="text-sm text-muted">
          Some stories are told in more than one tradition. Here each is given in its own words, a few verses from each
          telling, side by side. They are shown as parallels to read and compare, not as a claim that one took from
          another: each tradition understands its own account in its own way.
        </p>
        <p className="text-xs text-faint">
          Bible: King James Version. Quran: Pickthall&apos;s English (1930), with the standard verse numbers; where his
          numbering differs, his own number is noted. Gilgamesh: R. Campbell Thompson&apos;s translation (1928), whose
          square brackets mark words restored where the tablet is broken.
        </p>
      </div>
      <ul className="space-y-3">
        {PARALLELS.map((p) => (
          <ParallelCard key={p.id} p={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} />
        ))}
      </ul>
    </section>
  );
}

/* ---------------- the page ---------------- */

type Tab = "map" | "quotes" | "traditions";
const TABS: [Tab, string][] = [
  ["map", "Map"],
  ["quotes", "Quotations"],
  ["traditions", "Across traditions"],
];

export function Echoes() {
  const [tab, setTab] = useState<Tab>("map");
  return (
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <Link href="/study-lab" className="text-xs text-accent hover:underline">
            ← Study lab
          </Link>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Echoes</p>
            <button type="button" onClick={() => openAi()} className="min-h-9 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-raised">
              ✦ Ask AI
            </button>
          </div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Where later texts echo earlier ones</h1>
          <p className="text-muted">
            Scripture often looks back on itself: a prophet&apos;s line returns in a Gospel, a psalm is prayed again from
            the cross, and some stories are told in more than one tradition.
          </p>
        </header>

        <nav className="flex gap-1 rounded-xl border border-line bg-panel p-1" aria-label="Parts of this page">
          {TABS.map(([k, t]) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
              className={`min-h-9 flex-1 rounded-lg px-2 text-sm ${tab === k ? "bg-accent text-accent-ink" : "text-muted hover:bg-raised"}`}
            >
              {t}
            </button>
          ))}
        </nav>

        {tab === "map" && <ArcMap />}
        {tab === "quotes" && <Quotations />}
        {tab === "traditions" && <Traditions />}

        <footer className="space-y-2 border-t border-line pt-4 text-xs text-faint">
          <p>
            The map uses the site&apos;s own cross references, the same ones as in the reader: for each verse, the verses
            closest to it in meaning, worked out by Verses Across from the World English Bible with the open
            bge-base-en-v1.5 model (BAAI). They catch quotations and echoes, and also verses that simply speak of the
            same things, such as two lists of names or two tellings of one event; closeness of meaning is not a claim
            of agreement. The quotations and the stories were chosen by hand.
          </p>
          <p>
            Texts: King James Version (public domain); Pickthall, The Meaning of the Glorious Koran (1930, public domain
            in the US); R. Campbell Thompson, The Epic of Gilgamish (1928, public domain in the US).
          </p>
          <p>
            <Link href="/" className="text-accent hover:underline">
              Verses Across
            </Link>
          </p>
        </footer>
      </div>
      <Suspense fallback={null}>
        <AiWindow />
      </Suspense>
    </main>
  );
}
