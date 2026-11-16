/**
 * Concordance (ROADMAP ST2): every verse where an original-language word (one Strong's number) occurs, with the
 * form used there and its English gloss, from the interlinear data (scripts/build-interlinear.mts → STEP Bible's
 * TAHOT / TAGNT, CC BY 4.0). Run after the interlinear build, then upload with scripts/upload-interlinear.ts.
 *
 *   npx tsx scripts/build-concordance.mts   → .cache-interlinear/conc/<H|G><hundreds>.json
 *
 * One shard per hundred Strong's numbers (G30 = G3000–G3099), so the upload stays ~150 files:
 *   { "<strong>": { "n": count, "f": [forms], "g": [glosses], "r": ["<book> <chapter>:<verse> <form idx> <gloss idx>", …] } }
 * References are in canonical order. STEP's prefix and suffix tags (H9000+: "and", "the", "to"…) are left out:
 * they're grammar, not words, and occur tens of thousands of times.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, ".cache-interlinear");
const OUT = path.join(SRC, "conc");

const ORDER = (
  "gen exo lev num deu jos jdg rut 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro ecc sng isa jer lam ezk dan hos jol amo oba jon mic nam hab zep hag zec mal " +
  "mat mrk luk jhn act rom 1co 2co gal eph php col 1th 2th 1ti 2ti tit phm heb jas 1pe 2pe 1jn 2jn 3jn jud rev"
).split(" ");

type Word = [string, string, string, string, number];
type Entry = { n: number; f: string[]; g: string[]; r: string[]; fi: Map<string, number>; gi: Map<string, number> };
const conc = new Map<string, Entry>();

const present = new Set(readdirSync(SRC));
const missing = ORDER.filter((b) => !present.has(b));
if (missing.length) throw new Error(`interlinear books missing: ${missing.join(" ")} (run scripts/build-interlinear.mts first)`);

for (const book of ORDER) {
  const chapters = readdirSync(path.join(SRC, book))
    .map((f) => parseInt(f, 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  for (const ch of chapters) {
    const verses: Record<string, Word[]> = JSON.parse(readFileSync(path.join(SRC, book, `${ch}.json`), "utf8"));
    const keys = Object.keys(verses).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    for (const v of keys) {
      const seen = new Set<string>(); // a word twice in one verse is listed once (with its first form)
      for (const [form, , gloss, strongRaw] of verses[v]) {
        // The letter after the number (H1254A, H1254B) marks separate dictionary entries: keep them apart.
        const m = /^([HG])(\d{4})([A-Z]?)/.exec(strongRaw ?? "");
        if (!m || (m[1] === "H" && parseInt(m[2], 10) >= 9000)) continue;
        const strong = m[1] + m[2] + m[3];
        if (seen.has(strong)) continue;
        seen.add(strong);
        let e = conc.get(strong);
        if (!e) conc.set(strong, (e = { n: 0, f: [], g: [], r: [], fi: new Map(), gi: new Map() }));
        const g = gloss.replace(/[[\]<>.,;:!?“”"']/g, "").trim().toLowerCase() || "—";
        let fi = e.fi.get(form);
        if (fi === undefined) e.fi.set(form, (fi = e.f.push(form) - 1));
        let gi = e.gi.get(g);
        if (gi === undefined) e.gi.set(g, (gi = e.g.push(g) - 1));
        e.n++;
        e.r.push(`${book} ${ch}:${v} ${fi} ${gi}`);
      }
    }
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const shards = new Map<string, Record<string, { n: number; f: string[]; g: string[]; r: string[] }>>();
for (const [strong, e] of conc) {
  const shard = strong[0] + Math.floor(parseInt(strong.slice(1, 5), 10) / 100);
  if (!shards.has(shard)) shards.set(shard, {});
  shards.get(shard)![strong] = { n: e.n, f: e.f, g: e.g, r: e.r };
}
let bytes = 0;
for (const [shard, entries] of shards) {
  const s = JSON.stringify(entries);
  bytes += s.length;
  writeFileSync(path.join(OUT, `${shard}.json`), s);
}
const top = [...conc].sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([k, e]) => `${k} ${e.n}`);
console.log(`${conc.size} words, ${shards.size} shards, ${(bytes / 1e6).toFixed(1)} MB; most frequent: ${top.join(", ")}`);
