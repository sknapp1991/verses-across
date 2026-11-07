/**
 * Re-check machine-aligned Strong's tags (Louis Segond 1910) against the original-language words of each verse.
 *
 * eBible's fraLSG tags are often off: in John 3:16 "aimé" carries G3588 (the Greek article) instead of G25 (agapaō),
 * and "le", "son" carry G1519 ("into"), a word that isn't in the verse at all. Here every tag is scored against the
 * Strong's numbers that really are in that verse (Greek NT / Hebrew OT tags, plus the KJV's), using how often the
 * French word and the number appear in the same verses across the whole Bible (Dice coefficient):
 *   - a tag that fits (number in the verse and about as likely as the best candidate) is kept;
 *   - a tag with a clearly better candidate is moved to it;
 *   - otherwise a tag whose number is in the verse is kept, and one whose number isn't is dropped (the word is then just untagged).
 * French articles and little grammar words (le, la, de, et, il, qu…) are left untagged, as the KJV leaves "the";
 * and nothing is moved onto the Greek article (G3588) or the Hebrew object marker (H853), which are in almost
 * every verse and so look related to every word.
 * Run after `npm run strongs:extract`: tsx scripts/realign-strongs.ts [--dry] [--show jhn:3:16,...]
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data", "strongs");
const TARGET = "lsg1910";
const REFS = ["greek", "hebrew", "kjv"];
const dry = process.argv.includes("--dry");
const showArg = process.argv[process.argv.indexOf("--show") + 1];
const SHOW = new Set(process.argv.includes("--show") ? showArg.split(",") : ["jhn:3:16", "gen:1:1", "psa:23:1", "rom:5:8", "1jn:4:8", "jhn:1:1", "mat:5:9"]);

type Tag = [string, ...string[]];
type BookTags = Record<string, Tag[]>;

const read = async (dir: string, f: string): Promise<BookTags | null> => {
  try {
    return JSON.parse(await readFile(path.join(DATA, dir, f), "utf8"));
  } catch {
    return null;
  }
};

/** Light French stemmer: lower case, drop common verb/plural/gender endings (aimé, aimer, aimons, aime → aim). */
function stem(surface: string): string {
  const w = surface.toLowerCase().normalize("NFC").trim();
  if (w.includes(" ")) return w;
  const m = /^(.{3,}?)(aient|ions|iez|ons|ez|ent|ais|ait|ées|és|ée|er|é|es|e|s)$/.exec(w);
  return m ? m[1] : w;
}

/** Grammar words: untagged (their tags were mostly spill-over from the words next to them). */
const STOP = new Set("le la les l un une des du de d au aux et a à ont est été il ils elle elles qu que qui se s y en ce c".split(" "));
/** Strong's numbers in nearly every verse: never a target for a move. */
const PARTICLES = new Set(["G3588", "H853"]);

async function main() {
const files = (await readdir(path.join(DATA, TARGET))).filter((f) => f.endsWith(".json"));
type Verse = { book: string; key: string; tags: Tag[]; cand: Set<string> };
const verses: Verse[] = [];
const books = new Map<string, BookTags>();
for (const f of files) {
  const book = f.replace(/\.json$/, "");
  const tags = (await read(TARGET, f))!;
  books.set(book, tags);
  const refs = (await Promise.all(REFS.map((r) => read(r, f)))).filter(Boolean) as BookTags[];
  for (const [key, t] of Object.entries(tags)) {
    const cand = new Set<string>();
    for (const r of refs) for (const [, ...nums] of r[key] ?? []) for (const n of nums) cand.add(n);
    if (cand.size) verses.push({ book, key, tags: t, cand });
  }
}

// Verse-level co-occurrence counts.
const nW = new Map<string, number>();
const nN = new Map<string, number>();
const nWN = new Map<string, number>();
const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
for (const v of verses) {
  const ws = new Set(v.tags.map(([s]) => stem(s)));
  for (const n of v.cand) inc(nN, n);
  for (const w of ws) {
    inc(nW, w);
    for (const n of v.cand) inc(nWN, `${w}|${n}`);
  }
}
const dice = (w: string, n: string) => (2 * (nWN.get(`${w}|${n}`) ?? 0)) / ((nW.get(w) ?? 0) + (nN.get(n) ?? 0) || 1);

let kept = 0, moved = 0, dropped = 0, total = 0;
const shown: string[] = [];
for (const v of verses) {
  const before = v.tags.map((t) => [...t] as Tag);
  const next: Tag[] = [];
  for (const [surface, ...nums] of v.tags) {
    total++;
    if (STOP.has(surface.toLowerCase())) {
      dropped++;
      continue;
    }
    const w = stem(surface);
    let best = "", bestD = 0;
    for (const n of v.cand) {
      if (PARTICLES.has(n)) continue;
      const d = dice(w, n);
      if (d > bestD) (best = n), (bestD = d);
    }
    const src = nums.find((n) => v.cand.has(n) && !PARTICLES.has(n));
    const srcD = src ? dice(w, src) : 0;
    if (src && srcD >= 0.6 * bestD) {
      next.push([surface, src]);
      kept++;
    } else if (best && bestD >= 0.05 && (nWN.get(`${w}|${best}`) ?? 0) >= 3) {
      next.push([surface, best]);
      moved++;
    } else if (src) {
      next.push([surface, src]); // no strong alternative: trust the source
      kept++;
    } else {
      dropped++; // untagged: the word card still works, it just shows no original word
    }
  }
  books.get(v.book)![v.key] = next;
  if (SHOW.has(`${v.book}:${v.key}`))
    shown.push(
      `${v.book} ${v.key}\n  before: ${before.map(([s, ...n]) => `${s}=${n.join("/")}`).join(" ")}\n  after:  ${next.map(([s, n]) => `${s}=${n}`).join(" ")}`,
    );
}

console.log(shown.join("\n"));
console.log(`${TARGET}: ${total} tags in ${verses.length} verses: ${kept} kept, ${moved} moved, ${dropped} dropped`);
if (!dry) {
  for (const [book, tags] of books)
    await writeFile(
      path.join(DATA, TARGET, `${book}.json`),
      `{\n${Object.entries(tags).map(([k, t]) => `${JSON.stringify(k)}:${JSON.stringify(t)}`).join(",\n")}\n}\n`,
    );
  console.log(`wrote data/strongs/${TARGET}`);
}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
