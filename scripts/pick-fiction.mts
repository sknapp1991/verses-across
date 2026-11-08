/**
 * Build the Fiction shelf of data/literature-list.json from Project Gutenberg's own catalog:
 * each fiction bookshelf (Adventure, Science Fiction, Gothic Fiction, Horror…), English books only, ranked
 * by downloads (the last 30 days, from Gutenberg's RDF feed), the top 100 kept (or all, when fewer).
 * Several editions of one book keep only the most downloaded. Books on several shelves are listed on each.
 * Also re-sorts the Literature shelf's collections and books by downloads.
 *
 *   npx tsx scripts/pick-fiction.mts
 *   (needs data/raw/gutenberg-catalog/pg_catalog.csv and downloads.json; see scripts/import-literature.ts)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "data", "raw", "gutenberg-catalog");
const LIST = path.join(ROOT, "data", "literature-list.json");
const PER_SHELF = 100;

/** Our sub-shelves → the Gutenberg bookshelves they draw from. */
const SHELVES: { id: string; name: string; from: string[] }[] = [
  { id: "fic-adventure", name: "Adventure", from: ["Category: Adventure", "Adventure"] },
  { id: "fic-sff", name: "Science Fiction & Fantasy", from: ["Category: Science-Fiction & Fantasy"] },
  { id: "fic-scifi", name: "Science Fiction", from: ["Science Fiction"] },
  { id: "fic-fantasy", name: "Fantasy", from: ["Fantasy"] },
  { id: "fic-precursors", name: "Precursors of Science Fiction", from: ["Precursors of Science Fiction"] },
  { id: "fic-scifi-women", name: "Science Fiction by Women", from: ["Science Fiction by Women"] },
  { id: "fic-historical", name: "Historical Fiction", from: ["Historical Fiction", "Category: Historical Novels"] },
  { id: "fic-gothic", name: "Gothic Fiction", from: ["Gothic Fiction"] },
  { id: "fic-horror", name: "Horror", from: ["Horror"] },
  { id: "fic-detective", name: "Detective Fiction", from: ["Detective Fiction"] },
  { id: "fic-crime", name: "Crime, Thrillers & Mystery", from: ["Category: Crime, Thrillers and Mystery", "Crime Fiction", "Mystery Fiction"] },
  { id: "fic-romance", name: "Romance", from: ["Category: Romance", "Romantic Fiction"] },
  { id: "fic-western", name: "Western", from: ["Western"] },
  { id: "fic-humor", name: "Humor", from: ["Humor"] },
  { id: "fic-short", name: "Short Stories", from: ["Category: Short Stories", "Short Stories"] },
];

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (q) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(f);
      f = "";
    } else if (c === "\n") {
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
    } else if (c !== "\r") f += c;
  }
  return rows;
}

type Book = { gid: number; title: string; author: string; lang: string; shelves: string[]; downloads: number };
const rows = parseCsv(await readFile(path.join(RAW, "pg_catalog.csv"), "utf8"));
const head = rows.shift()!;
const ix = Object.fromEntries(head.map((h, i) => [h, i]));
const downloads = JSON.parse(await readFile(path.join(RAW, "downloads.json"), "utf8")) as Record<string, number>;
const books: Book[] = rows
  .filter((r) => r[ix.Type] === "Text")
  .map((r) => ({
    gid: Number(r[ix["Text#"]]),
    title: r[ix.Title].replace(/\s+/g, " ").trim(),
    author: r[ix.Authors],
    lang: r[ix.Language],
    shelves: r[ix.Bookshelves].split(";").map((s) => s.trim()).filter(Boolean),
    downloads: downloads[r[ix["Text#"]]] ?? 0,
  }));

/** One edition per book: "Les Misérables, v. 1/5", "Moby Dick — Complete" and "Moby Dick" are one book. */
const baseKey = (b: Book) =>
  `${b.title
    .toLowerCase()
    .replace(/[,.;:]?\s*(—|-|–)?\s*(complete|volume \d+|vol\.? \d+|v\. \d+(\/\d+)?|part \d+|book \d+)\b.*$/i, "")
    .replace(/\s*\(of \d+\)|\[.*?\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()}|${b.author.split(",")[0].toLowerCase()}`;

/** Books Gutenberg marks as still under copyright (or Creative Commons): not public domain, never listed. */
const isCopyrighted = (t: string) => /COPYRIGHTED Project Gutenberg|creativecommons\.org|Creative Commons (Attribution|license)/i.test(t);
const notFree = new Set<number>();
for (const b of books) {
  const t = await readFile(path.join(ROOT, "data", "raw", "gutenberg-lit", `pg${b.gid}.txt`), "utf8").catch(() => "");
  if (t && isCopyrighted(t)) notFree.add(b.gid);
}
// A public-domain edition in place of a copyrighted one.
const REPLACE: Record<number, number> = { 2488: 164, 3836: 78017 };

const list = JSON.parse(await readFile(LIST, "utf8"));
for (const c of list.shelves?.find((s: { id: string }) => s.id === "literature")?.collections ?? list.collections) {
  c.books = c.books
    .map((b: { gid: number; title: string; author: string; lang: string }) => {
      const to = REPLACE[b.gid] && books.find((x) => x.gid === REPLACE[b.gid]);
      return to ? { gid: to.gid, title: to.title, author: to.author, lang: to.lang } : b;
    })
    .filter((b: { gid: number }) => !notFree.has(b.gid));
}
const lit = list.shelves ? list.shelves.find((s: { id: string }) => s.id === "literature") : { id: "literature", name: "Literature", collections: list.collections };
// The hand-picked "Fiction" reading list becomes "Classic Novels, Plays & Poems" (the Fiction shelf is its own now).
for (const c of lit.collections) if (c.id === "lit-fiction") c.name = "Classic Novels, Plays & Poems";

const shelfCollections = [];
for (const sh of SHELVES) {
  const seen = new Map<string, Book>();
  for (const b of books) {
    if (b.lang !== "en" || !b.shelves.some((s) => sh.from.includes(s)) || notFree.has(b.gid)) continue;
    // Not books to read through: magazine issues, compilations, a volume of collected works, index files.
    if (/Astounding Stories|Compilation|Linked Index|Complete Project Gutenberg|Works of William Shakespeare|Magazine|Index of the Project Gutenberg|Collected Works|Complete Works/i.test(b.title)) continue;
    const k = baseKey(b);
    const prev = seen.get(k);
    if (!prev || b.downloads > prev.downloads) seen.set(k, b);
  }
  const top = [...seen.values()].sort((a, b) => b.downloads - a.downloads).slice(0, PER_SHELF);
  shelfCollections.push({
    id: sh.id,
    name: sh.name,
    books: top.map((b) => ({ gid: b.gid, title: b.title, author: b.author, lang: b.lang, downloads: b.downloads })),
  });
  console.log(`${sh.name.padEnd(30)} ${String(top.length).padStart(3)} books (of ${seen.size}); top: ${top.slice(0, 3).map((b) => b.title.slice(0, 30)).join(" | ")}`);
}

// Popularity order everywhere: books by downloads, collections by their books' total downloads.
const dl = (gid: number) => downloads[String(gid)] ?? 0;
const sortCols = (cols: { books: { gid: number; downloads?: number }[] }[]) => {
  for (const c of cols) {
    for (const b of c.books) b.downloads = dl(b.gid);
    c.books.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
  }
  return cols.sort((a, b) => b.books.reduce((n, x) => n + (x.downloads ?? 0), 0) - a.books.reduce((n, x) => n + (x.downloads ?? 0), 0));
};
const out = {
  $comment: list.$comment,
  shelves: [
    { id: "literature", name: "Literature", collections: sortCols(lit.collections) },
    { id: "fiction", name: "Fiction", collections: sortCols(shelfCollections) },
  ],
};
await writeFile(LIST, JSON.stringify(out, null, 1) + "\n");
const unique = new Set(out.shelves.flatMap((s) => s.collections.flatMap((c: { books: { gid: number }[] }) => c.books.map((b) => b.gid))));
console.log(`\n${unique.size} different books on the two shelves`);
