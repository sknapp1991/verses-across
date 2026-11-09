"use client";
/**
 * Search across every book in the Library ("which books mention a whale?"), by chapter, from the index
 * scripts/build-search.ts writes to public/search/_library/. Words are normalised like the reader's own search;
 * every word must be in the chapter; "whale*" matches words starting with "whale". Words in more than half of
 * all chapters ("the", "and"…) aren't indexed: they're skipped and reported.
 */
import { normalizeWord, RAW_WORD } from "./search-text";

type Meta = { books: [work: string, book: string, title: string, chapters: number][]; shards: string[]; words: number; common: string[] };
type Shard = Record<string, number[]>;

let metaP: Promise<Meta> | null = null;
const shardP = new Map<number, Promise<Shard>>();
const meta = () =>
  (metaP ??= fetch("/search/_library/meta.json")
    .then((r) => {
      if (!r.ok) throw new Error("The Library's search isn't available right now.");
      return r.json() as Promise<Meta>;
    })
    .catch((e) => {
      metaP = null;
      throw e;
    }));
const shard = (i: number) => {
  if (!shardP.has(i))
    shardP.set(
      i,
      fetch(`/search/_library/s${i}.json`)
        .then((r) => {
          if (!r.ok) throw new Error("The Library's search isn't available right now.");
          return r.json() as Promise<Shard>;
        })
        .catch((e: Error) => {
          shardP.delete(i); // not kept: the next search tries again
          throw e;
        }),
    );
  return shardP.get(i)!;
};
/** The file holding a word: the last one whose first word sorts at or before it. */
function shardOf(m: Meta, w: string) {
  let lo = 0;
  let hi = m.shards.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (m.shards[mid] <= w) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
const decode = (d: number[]) => {
  const out: number[] = [];
  let n = 0;
  for (const x of d) out.push((n += x));
  return out;
};

export type LibraryBookHit = { work: string; book: string; title: string; chapters: number[]; total: number };
export type LibraryResult = { books: LibraryBookHit[]; chapters: number; skipped: string[]; terms: string[] };

export async function searchLibrary(query: string): Promise<LibraryResult> {
  const m = await meta();
  const raw = query.trim().split(/\s+/).filter(Boolean);
  const terms: { word: string; prefix: boolean }[] = [];
  const skipped: string[] = [];
  // Split like the index (and the reader's search): "o'clock" → o, clock; "mother-in-law" → mother, in, law.
  for (const r of raw) {
    const star = r.endsWith("*");
    const parts = [...r.matchAll(RAW_WORD)].map((x) => normalizeWord(x[0])).filter(Boolean);
    parts.forEach((word, i) => {
      // "*" applies to the last piece, and only from 3 letters ("s*" would read most of the index)
      const prefix = star && i === parts.length - 1 && word.length >= 3;
      if (word.length < 2) return;
      if (/^\d+$/.test(word) || (!prefix && m.common.includes(word))) skipped.push(word);
      else terms.push({ word, prefix });
    });
  }
  if (!terms.length) return { books: [], chapters: 0, skipped, terms: [] };
  // each term → the set of chapter ordinals that contain it
  const sets: Set<number>[] = [];
  for (const t of terms) {
    const set = new Set<number>();
    if (!t.prefix) {
      for (const n of decode((await shard(shardOf(m, t.word)))[t.word] ?? [])) set.add(n);
    } else {
      // the file where the prefix would sort, then the next ones while they still start with it
      for (let i = shardOf(m, t.word); i < m.shards.length; i++) {
        const s = await shard(i);
        for (const [w, d] of Object.entries(s)) if (w.startsWith(t.word)) for (const n of decode(d)) set.add(n);
        if (!m.shards[i + 1]?.startsWith(t.word)) break;
      }
    }
    sets.push(set);
  }
  sets.sort((a, b) => a.size - b.size);
  const found = [...sets[0]].filter((n) => sets.every((s) => s.has(n))).sort((a, b) => a - b);
  // ordinals → books and chapters
  const books: LibraryBookHit[] = [];
  let start = 0;
  let bi = 0;
  for (const n of found) {
    while (bi < m.books.length && n >= start + m.books[bi][3]) start += m.books[bi++][3];
    if (bi >= m.books.length) break;
    const [work, book, title, total] = m.books[bi];
    const last = books[books.length - 1];
    if (last && last.work === work) last.chapters.push(n - start + 1);
    else books.push({ work, book, title, chapters: [n - start + 1], total });
  }
  // most chapters first (a book about whales before one that mentions a whale once)
  books.sort((a, b) => b.chapters.length - a.chapters.length || a.title.localeCompare(b.title));
  return { books, chapters: found.length, skipped, terms: terms.map((t) => t.word + (t.prefix ? "*" : "")) };
}
