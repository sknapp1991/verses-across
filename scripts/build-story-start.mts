/**
 * "Skip the Preface": for every Library Across book whose first chapters are front matter (a Preface,
 * Introduction, Foreword, Translator's note, Contents…), the chapter where the book itself begins. The reader
 * shows a small "Skip to the start" bar on those chapters (src/components/skip-front-matter.tsx). Ticket d9e4ffa1.
 *
 * Front matter is found by the chapters' own titles (from the first edition's text files), so a preface that
 * sits inside chapter 1 isn't caught. A book that is nothing but "introduction"-titled parts is left out.
 *
 *   npx tsx scripts/build-story-start.mts
 *     → data/story-start.json   { "<work>/<book>": [start chapter, "Preface · Introduction", start chapter's own title] }   (committed)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const lit = JSON.parse(readFileSync(path.join(ROOT, "data", "literature-catalog.json"), "utf8")) as {
  books: [string, string, string, number, [number, ...unknown[]][]][];
};

/** Chapter titles that are front matter, not the work itself. */
const FRONT =
  /^(the )?(author'?s'? |translator'?s'? |editor'?s'? |publisher'?s'? |transcriber'?s'? )?(preface|foreword|fore-word|introduction|introductory( note| remarks)?|prefatory( note| remarks)?|note|notes|advertisement|dedication|to the reader|contents|table of contents|biographical (note|sketch|introduction)|memoir of the author|chronology|bibliography|editorial note|a note on the text)\b/i;
/** Also front matter, when it comes right after the above (so the skip goes past it too). */
const MORE_FRONT = /^(a foreword|dedicatory epistle|detailed table of contents|list of illustrations)\b/i;
/**
 * Books whose "Preface" or "Introduction" is part of the work itself (a framing story, the author's own first
 * chapter) or where the split into chapters hides the story inside it. Checked by reading them (Fable review).
 */
const PART_OF_THE_STORY = new Set(
  [
    "time-machine", // Wells titles chapter I "Introduction"
    "confessions-of-an-english-opium-eater",
    "sketches-new-and-old",
    "daredevil",
    "wallet-of-kai-lung",
    "kai-lungs-golden-hours",
    "tomb-of-tsin",
    "twilight-land",
    "gods-of-pegana",
    "short-history-of-freethought-volume-1",
    "last-man",
    "to-the-last-man",
    "iron-heel",
    "princess-of-mars",
    "island-of-doctor-moreau",
    "house-on-the-borderland",
    "wealth-of-nations",
    "further-foolishness",
    "love-letters-of-mary-wollstonecraft-to-g",
    "kama-sutra",
    "scarlet-letter",
  ].map((w) => `lit-${w}`),
);
const MAX_SKIP = 6; // more than this many "front matter" chapters in a row: probably the book's own structure
/** A destination title worth showing ("Chapter 1", "Prometheus and Pandora"); odd ones fall back to the chapter's name in the catalog. */
const goodTitle = (t: string) => !["Johnny Gruelle"].includes(t) && t.split(/\s+/).length <= 7 && !/\b[A-Za-z]\. /.test(t) && t.length <= 50 && /^[A-Z0-9"'‘“]/.test(t) && /[a-z]/.test(t) && !/[+=_]|--/.test(t) && !/^part \d+ · /i.test(t);

const out: Record<string, [number, string, string]> = {};
let books = 0;
for (const [work, book, , chapters, editions] of lit.books) {
  const ed = editions[0];
  if (!ed) continue;
  const dir = path.join(ROOT, "data", "texts", work, `pg${ed[0]}`, book);
  if (!existsSync(dir)) continue;
  books++;
  const skipped: string[] = [];
  let start = 1;
  let startTitle = "";
  let split = false; // a "front matter" chapter cut into parts: the story may well be inside it
  for (; start <= Math.min(chapters, MAX_SKIP + 1); start++) {
    const f = path.join(dir, `${start}.json`);
    if (!existsSync(f)) break;
    const title = String((JSON.parse(readFileSync(f, "utf8")) as { title?: string }).title ?? "").trim();
    if (!FRONT.test(title) && !(start > 1 && MORE_FRONT.test(title))) {
      startTitle = title;
      break;
    }
    if (/\(part [2-9]\d*\)$/i.test(title)) split = true;
    skipped.push(title.replace(/\s*\(part \d+\)$/i, ""));
  }
  if (start === 1 || start > chapters || start > MAX_SKIP || split || PART_OF_THE_STORY.has(work)) continue;
  out[`${work}/${book}`] = [start, [...new Set(skipped)].join(" · "), goodTitle(startTitle) ? startTitle : ""];
}

writeFileSync(path.join(ROOT, "data", "story-start.json"), JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"') + "\n");
console.log(`${Object.keys(out).length} of ${books} books start with front matter → data/story-start.json`);
