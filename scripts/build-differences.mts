/**
 * Phase 1 of TX (ROADMAP): verses and passages that English Bibles print differently.
 *   npx tsx scripts/build-differences.mts
 * Reads data/bible-differences-notes.json (the notes), checks them against the texts on the site and writes
 * data/bible-differences.json (notes + each version's wording) for /differences and the marks in the reader.
 * Fails if a New Testament verse is in the KJV but missing from the WEB, ASV or BBE without a note, so a new
 * difference can't slip through unexplained.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TEXTS = path.join(ROOT, "data", "texts", "bible");
const SHOWN = ["kjv", "web", "asv"] as const; // the versions compared on the page
const CHECKED = ["web", "asv", "bbe"]; // a KJV verse missing from any of these needs a note
const NT = ["mat", "mrk", "luk", "jhn", "act", "rom", "1co", "2co", "gal", "eph", "php", "col", "1th", "2th", "1ti", "2ti", "tit", "phm", "heb", "jas", "1pe", "2pe", "1jn", "2jn", "3jn", "jud", "rev"];

type Item = { id: string; group: string; book: string; chapter: number; from: number; to?: number; through?: string; note: string; parallel?: string };
const notes = JSON.parse(readFileSync(path.join(ROOT, "data", "bible-differences-notes.json"), "utf8")) as { groups: unknown[]; items: Item[] };

const cache = new Map<string, Map<string, string>>();
function chapter(version: string, book: string, ch: number) {
  const k = `${version}/${book}/${ch}`;
  if (!cache.has(k)) {
    const m = new Map<string, string>();
    try {
      const d = JSON.parse(readFileSync(path.join(TEXTS, version, book, `${ch}.json`), "utf8")) as { verses: { v: string; t: string }[] };
      for (const x of d.verses) if (x.t?.trim()) m.set(x.v, x.t.trim());
    } catch {
      /* no such chapter */
    }
    cache.set(k, m);
  }
  return cache.get(k)!;
}

// 1. every KJV verse missing elsewhere must have a note (a verse entry, or inside a passage / moved range)
const covered = (book: string, ch: number, v: number) =>
  notes.items.some((it) => it.book === book && it.chapter === ch && v >= it.from && v <= (it.to ?? it.from));
const unexplained: string[] = [];
for (const book of NT)
  for (const f of readdirSync(path.join(TEXTS, "kjv", book))) {
    const ch = Number(f.replace(".json", ""));
    for (const v of chapter("kjv", book, ch).keys()) {
      const missing = CHECKED.filter((x) => !chapter(x, book, ch).has(v));
      if (missing.length && !covered(book, ch, Number(v))) unexplained.push(`${book} ${ch}:${v} (missing in ${missing.join(", ")})`);
    }
  }
if (unexplained.length) {
  console.error(`build-differences: no note for ${unexplained.length} verse(s):\n  ${unexplained.join("\n  ")}`);
  process.exit(1);
}

// 2. each item with each version's wording (up to 3 verses; null = not in that version)
const items = notes.items.map((it) => {
  const last = Math.min(it.to ?? it.from, it.from + 2);
  const texts: Record<string, { v: string; t: string }[] | null> = {};
  for (const ver of SHOWN) {
    const c = chapter(ver, it.book, it.chapter);
    const list: { v: string; t: string }[] = [];
    for (let v = it.from; v <= last; v++) if (c.has(String(v))) list.push({ v: String(v), t: c.get(String(v))! });
    texts[ver] = list.length ? list : null;
  }
  const missingIn = SHOWN.filter((v) => !texts[v]);
  return { ...it, texts, missingIn, more: (it.to ?? it.from) > last || !!it.through };
});
// the reader's marks: the first verse of each entry → its id
const marks: Record<string, string> = {};
for (const it of notes.items) marks[`${it.book}/${it.chapter}/${it.from}`] = it.id;

writeFileSync(path.join(ROOT, "data", "bible-differences.json"), JSON.stringify({ groups: notes.groups, items }, null, 1) + "\n");
// (a separate small file, so the reader doesn't carry the page's texts)
writeFileSync(path.join(ROOT, "data", "bible-differences-marks.json"), JSON.stringify(marks) + "\n");
console.log(`build-differences: ${items.length} entries; every KJV verse missing from the WEB, ASV or BBE has a note`);
for (const it of items) console.log(`  ${it.id.padEnd(10)} missing in: ${it.missingIn.join(", ") || "(none)"}`);
