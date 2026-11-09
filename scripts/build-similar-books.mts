/**
 * "If you liked this…": for every book in the Library, the books most like it, from the paragraph-to-paragraph
 * matches the cross references already found (scripts/xref/build.py, book → book). Two books are alike when
 * many of their paragraphs closely match each other's; a book that matches everything (a huge anthology) counts
 * for less, so it doesn't top every list.
 *
 *   npx tsx scripts/build-similar-books.mts   (needs .cache-xref from the cross-reference build)
 *     → data/similar-books.json   { "<work>": [["<work>", score], …6] }   (committed; read by the reader)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LIBRARY_SHELVES } from "../src/lib/side";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, ".cache-xref");
const KEEP = 6;
const lit = JSON.parse(readFileSync(path.join(ROOT, "data", "literature-catalog.json"), "utf8")) as {
  books: [string, string, string, number, unknown[]][];
  shelves: { id: string; collections: { books: string[] }[] }[];
};
const library = new Set(lit.shelves.filter((s) => LIBRARY_SHELVES.has(s.id)).flatMap((s) => s.collections.flatMap((c) => c.books)));

// pair weights: sum of match scores from A's paragraphs to B's
const pair = new Map<string, Map<string, number>>();
const received = new Map<string, number>();
for (const work of library) {
  const dir = path.join(CACHE, work);
  if (!existsSync(dir)) continue;
  const to = new Map<string, number>();
  for (const f of readdirSync(dir)) {
    const data = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Record<string, [string, number][]>;
    for (const hits of Object.values(data))
      for (const [ref, sc] of hits) {
        const w = ref.split("/")[0];
        if (w === work || !library.has(w)) continue;
        const add = Math.max(0, sc - 60); // only the closer matches count much
        to.set(w, (to.get(w) ?? 0) + add);
        received.set(w, (received.get(w) ?? 0) + add);
      }
  }
  pair.set(work, to);
}
// another edition of the same book ("Alice's Adventures in Wonderland (illustrated by Arthur Rackham)") isn't a suggestion
const titleOf = new Map(lit.books.map((b) => [b[0], b[2]]));
const core = (t: string) => t.toLowerCase().replace(/\s*\(.*$/, "").replace(/[^a-z0-9]+/g, " ").trim();
const out: Record<string, [string, number][]> = {};
for (const [a, to] of pair) {
  const ranked = [...to]
    .filter(([b]) => core(titleOf.get(b) ?? b) !== core(titleOf.get(a) ?? a))
    .map(([b, s]) => {
      const back = pair.get(b)?.get(a) ?? 0; // both directions agree → more alike
      return [b, (s + back) / Math.sqrt((received.get(b) ?? 1) * (received.get(a) ?? 1))] as [string, number];
    })
    .sort((x, y) => y[1] - x[1])
    .slice(0, KEEP)
    .map(([b, s]) => [b, Math.round(s * 1000)] as [string, number]);
  if (ranked.length) out[a] = ranked;
}
writeFileSync(path.join(ROOT, "data", "similar-books.json"), JSON.stringify(out));
const title = new Map(lit.books.map((b) => [b[0], b[2]]));
console.log(`similar books for ${Object.keys(out).length} books`);
for (const w of ["lit-moby-dick", "lit-pride-and-prejudice", "lit-dracula", "lit-alices-adventures-in-wonderland", "lit-iliad"])
  if (out[w]) console.log(`  ${title.get(w)}: ${out[w].map(([b]) => title.get(b)).join(" · ")}`);
