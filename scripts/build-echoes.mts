/**
 * Echoes (hidden study page /echoes): the Bible's cross references, book to book, small enough to ship in git.
 *
 * Reads the per-book cross-reference files that scripts/xref/build.py writes (.cache-xref/bible/<book>.json, the same
 * files the reader serves from R2 through /api/xref) and keeps only Bible → Bible links between the 66 books of the
 * Protestant canon, each verse pair counted once (A → B and B → A are one pair, at the higher score).
 *
 *   npx tsx scripts/build-echoes.mts
 *     → public/echoes/books.json   { books: ["gen", …], links: [[i, j, count], …] }   (i < j, indexes into books)
 *     → public/echoes/<book>.json  { "<other book>": [["c:v here", "c:v there", score], …] }   (strongest pairs first)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, ".cache-xref", "bible");
const OUT = path.join(ROOT, "public", "echoes");
const TOP = 8; // verse pairs kept per pair of books

const BOOKS =
  "gen exo lev num deu jos jdg rut 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro ecc sng isa jer lam ezk dan hos jol amo oba jon mic nam hab zep hag zec mal mat mrk luk jhn act rom 1co 2co gal eph php col 1th 2th 1ti 2ti tit phm heb jas 1pe 2pe 1jn 2jn 3jn jud rev".split(
    " ",
  );
const index = new Map(BOOKS.map((b, i) => [b, i]));

// "a|b" (book indexes, a < b) → verse pair key → [ref in a, ref in b, score]
const pairs = new Map<string, Map<string, [string, string, number]>>();

for (const book of BOOKS) {
  const file = JSON.parse(await readFile(path.join(SRC, `${book}.json`), "utf8")) as Record<string, [string, number][]>;
  const i = index.get(book)!;
  for (const [cv, hits] of Object.entries(file)) {
    for (const [ref, score] of hits) {
      const [work, other, ocv] = ref.split("/");
      if (work !== "bible") continue;
      const j = index.get(other);
      if (j === undefined || j === i) continue;
      const [a, b, ra, rb] = i < j ? [i, j, cv, ocv] : [j, i, ocv, cv];
      const k = `${a}|${b}`;
      let m = pairs.get(k);
      if (!m) pairs.set(k, (m = new Map()));
      const pk = `${ra}|${rb}`;
      const prev = m.get(pk);
      if (!prev || prev[2] < score) m.set(pk, [ra, rb, score]);
    }
  }
}

const links: [number, number, number][] = [];
const perBook: Record<string, [string, string, number][]>[] = BOOKS.map(() => ({}));
for (const [k, m] of pairs) {
  const [a, b] = k.split("|").map(Number);
  links.push([a, b, m.size]);
  const top = [...m.values()].sort((x, y) => y[2] - x[2]).slice(0, TOP);
  perBook[a][BOOKS[b]] = top.map(([ra, rb, s]) => [ra, rb, s]);
  perBook[b][BOOKS[a]] = top.map(([ra, rb, s]) => [rb, ra, s]);
}
links.sort((x, y) => x[0] - y[0] || x[1] - y[1]);

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "books.json"), JSON.stringify({ books: BOOKS, links }));
let bytes = 0;
for (let i = 0; i < BOOKS.length; i++) {
  const s = JSON.stringify(perBook[i]);
  bytes += s.length;
  await writeFile(path.join(OUT, `${BOOKS[i]}.json`), s);
}
const total = links.reduce((n, l) => n + l[2], 0);
console.log(`${links.length} pairs of books, ${total} verse pairs; per-book files ${(bytes / 1024).toFixed(0)} KB in all`);
