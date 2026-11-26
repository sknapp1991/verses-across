"use client";
/**
 * Classic commentary (study lab, my brother's ticket 7a62bb28): a chapter of the KJV with Matthew Henry's Concise
 * Commentary beside the verses each note covers (stacked on phones). Book and chapter are remembered on this device.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { booksOfWork, chapterTitle, readHref } from "@/lib/catalog";
import { commentaryRows, COMMENTARY_SOURCE, loadCommentary, noteSpan, type CommentaryBook } from "@/lib/commentary";

type Verse = { v: string; t: string };
type KjvBook = { chapters: Record<string, { verses: Verse[] }> };
type Pick = { book: string; chapter: number };

const KEY = "commentary:pick";
const BOOKS = booksOfWork("bible").filter((b) => b.collection.id === "ot" || b.collection.id === "nt");

const kjvCache = new Map<string, Promise<KjvBook>>();
const noteCache = new Map<string, Promise<CommentaryBook>>();
function loadKjv(book: string) {
  let p = kjvCache.get(book);
  if (!p) {
    p = fetch(`/texts/bible/kjv/${book}.json`).then((r) => {
      if (!r.ok) throw new Error(`kjv ${book}: ${r.status}`);
      return r.json() as Promise<KjvBook>;
    });
    p.catch(() => kjvCache.delete(book));
    kjvCache.set(book, p);
  }
  return p;
}
function loadNotes(book: string) {
  let p = noteCache.get(book);
  if (!p) {
    p = loadCommentary(book);
    p.catch(() => noteCache.delete(book));
    noteCache.set(book, p);
  }
  return p;
}

function valid(p: Partial<Pick> | null | undefined): Pick {
  const b = BOOKS.find((x) => x.id === p?.book) ?? BOOKS[0];
  const c = Math.max(1, Math.min(b.chapters ?? 1, Math.floor(Number(p?.chapter) || 1)));
  return { book: b.id, chapter: c };
}

function step(p: Pick, d: 1 | -1): Pick | undefined {
  const i = BOOKS.findIndex((b) => b.id === p.book);
  const b = BOOKS[i];
  if (d === 1) {
    if (p.chapter < (b.chapters ?? 1)) return { book: b.id, chapter: p.chapter + 1 };
    return i + 1 < BOOKS.length ? { book: BOOKS[i + 1].id, chapter: 1 } : undefined;
  }
  if (p.chapter > 1) return { book: b.id, chapter: p.chapter - 1 };
  return i > 0 ? { book: BOOKS[i - 1].id, chapter: BOOKS[i - 1].chapters ?? 1 } : undefined;
}

const versesLabel = (s: string) => (/[-,]/.test(s) ? `Verses ${s.replace(/-/g, "–")}` : `Verse ${s}`);

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {text.split("\n\n").map((p, i) => (
        <p key={i} className={i ? "mt-3" : undefined}>
          {p}
        </p>
      ))}
    </div>
  );
}

export function Commentary() {
  const [pick, setPick] = useState<Pick>(() => valid(null));
  const [data, setData] = useState<{ key: string; verses: Verse[]; notes: CommentaryBook } | null>(null);
  const [failed, setFailed] = useState("");

  // Where you left off (read after hydration).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the saved pick once, after hydration
      if (saved) setPick(valid(JSON.parse(saved) as Partial<Pick>));
    } catch {
      /* no storage: start at Genesis 1 */
    }
  }, []);

  const key = `${pick.book}/${pick.chapter}`;
  useEffect(() => {
    let live = true;
    Promise.all([loadKjv(pick.book), loadNotes(pick.book)])
      .then(([kjv, notes]) => {
        if (live) setData({ key: `${pick.book}/${pick.chapter}`, verses: kjv.chapters[String(pick.chapter)]?.verses ?? [], notes });
      })
      .catch(() => {
        if (live) setFailed(`${pick.book}/${pick.chapter}`);
      });
    return () => {
      live = false;
    };
  }, [pick.book, pick.chapter]);

  const choose = (p: Pick) => {
    setPick(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* not remembered */
    }
  };

  const book = BOOKS.find((b) => b.id === pick.book)!;
  const ready = data?.key === key ? data : null;
  const error = !ready && failed === key ? "This chapter didn't load. Check your connection and try again." : "";
  const notes = useMemo(() => ready?.notes.chapters[String(pick.chapter)] ?? [], [ready, pick.chapter]);
  const overview = notes.find((n) => !n.verses);
  const rows = useMemo(() => (ready ? commentaryRows(ready.verses, notes) : []), [ready, notes]);
  // Notes whose verses aren't in this chapter's text (rare): shown after the chapter so nothing is lost.
  const leftover = useMemo(() => {
    const shown = new Set(rows.map((r) => r.note));
    return notes.filter((n) => n.verses && !shown.has(n) && noteSpan(n.verses) !== undefined);
  }, [rows, notes]);
  const prev = step(pick, -1);
  const next = step(pick, 1);
  const title = chapterTitle(book, pick.chapter);
  const select = "min-h-11 w-full rounded-lg border border-line bg-raised px-2 text-sm text-ink";
  const btn = "min-h-11 rounded-xl border border-line px-3 text-sm font-medium text-ink hover:bg-raised disabled:opacity-50";

  return (
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <Link href="/study-lab" className="text-xs text-accent hover:underline">
            ← Study lab
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Classic commentary</p>
          <h1 className="font-serif text-3xl font-semibold text-ink">Matthew Henry beside the text</h1>
          <p className="text-muted">
            Read a chapter of the King James Version with short notes from Matthew Henry&apos;s commentary next to the verses they explain.
            They are one Protestant reading of the Bible from the early 1700s, shortened later by other hands: one voice among many.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-panel p-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Book</span>
            <select value={pick.book} onChange={(e) => choose(valid({ book: e.target.value, chapter: 1 }))} className={select}>
              <optgroup label="Old Testament">
                {BOOKS.filter((b) => b.collection.id === "ot").map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="New Testament">
                {BOOKS.filter((b) => b.collection.id === "nt").map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Chapter</span>
            <select value={pick.chapter} onChange={(e) => choose({ book: pick.book, chapter: Number(e.target.value) })} className={select}>
              {Array.from({ length: book.chapters ?? 1 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
            <button type="button" className={btn} disabled={!prev} onClick={() => prev && choose(prev)}>
              ← Previous
            </button>
            <Link href={readHref({ work: "bible", book: pick.book, chapter: pick.chapter }, ["kjv"])} className="text-sm text-accent hover:underline">
              Read in the reader
            </Link>
            <button type="button" className={btn} disabled={!next} onClick={() => next && choose(next)}>
              Next →
            </button>
          </div>
        </section>

        <h2 className="font-serif text-2xl font-semibold text-ink">{title}</h2>

        {error && (
          <p className="rounded-2xl border border-line bg-panel p-4 text-sm text-muted" role="alert">
            {error}
          </p>
        )}
        {!ready && !error && <p className="text-sm text-faint">Loading…</p>}

        {ready && (
          <>
            {pick.chapter === 1 && ready.notes.intro && (
              <details className="rounded-2xl border border-line bg-panel p-4">
                <summary className="cursor-pointer text-sm font-medium text-ink">Matthew Henry&apos;s introduction to {book.name}</summary>
                <Paragraphs text={ready.notes.intro} className="mt-3 text-sm leading-relaxed text-muted" />
              </details>
            )}

            {overview && (
              <section className="rounded-2xl border border-line bg-accent-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">In this chapter</p>
                <Paragraphs text={overview.text} className="mt-2 text-sm leading-relaxed text-ink" />
              </section>
            )}

            {!notes.some((n) => n.verses) && (
              <p className="text-sm text-muted">Matthew Henry&apos;s concise commentary has no notes for this chapter in our copy.</p>
            )}

            <div className="space-y-4">
              {rows.map((row) => (
                <div key={row.verses[0].v} className="grid gap-3 md:grid-cols-2">
                  <div className="font-serif text-base leading-relaxed text-ink">
                    {row.verses.map((v) => (
                      <span key={v.v} id={`v${v.v}`}>
                        <sup className="me-1 font-sans text-xs text-faint">{v.v}</sup>
                        {v.t}{" "}
                      </span>
                    ))}
                  </div>
                  {row.note ? (
                    <aside className="rounded-2xl border border-line bg-panel p-4">
                      <p className="text-xs font-semibold text-accent">{versesLabel(row.note.verses)}</p>
                      <Paragraphs text={row.note.text} className="mt-2 text-sm leading-relaxed text-muted" />
                    </aside>
                  ) : (
                    <div className="hidden md:block" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>

            {leftover.map((n) => (
              <aside key={n.verses} className="rounded-2xl border border-line bg-panel p-4">
                <p className="text-xs font-semibold text-accent">{versesLabel(n.verses)}</p>
                <Paragraphs text={n.text} className="mt-2 text-sm leading-relaxed text-muted" />
              </aside>
            ))}

            <div className="flex justify-between gap-2">
              <button type="button" className={btn} disabled={!prev} onClick={() => prev && choose(prev)}>
                ← Previous
              </button>
              <button type="button" className={btn} disabled={!next} onClick={() => next && choose(next)}>
                Next →
              </button>
            </div>
          </>
        )}

        <footer className="space-y-2 border-t border-line pt-4 text-xs text-faint">
          <p>
            Bible text: King James Version. Notes: {COMMENTARY_SOURCE.author}, {COMMENTARY_SOURCE.title} (public domain), from{" "}
            <a href={COMMENTARY_SOURCE.url} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
              {COMMENTARY_SOURCE.from}
            </a>
            , text from the Christian Classics Ethereal Library&apos;s transcription (ccel.org).
          </p>
          <p>
            Matthew Henry (1662–1714) was a Nonconformist minister, born in Wales. He wrote his full commentary from 1706 until his death;
            Romans to Revelation were completed after he died by other ministers. This concise version is a later abridgement of that work by
            other hands. Its notes reflect one Protestant reading of the Bible from the early 1700s: helpful for seeing how readers of that
            time understood a passage, not the only way to read it.
          </p>
        </footer>
      </div>
    </main>
  );
}
