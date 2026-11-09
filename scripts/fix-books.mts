/**
 * Tidy the books' text (works "lit-*", the Library and Freethought) after import: leftovers of Gutenberg's plain
 * text that the importer missed in books imported before its later rules. Never adds or removes a paragraph (notes,
 * highlights, reading places and cross references point at paragraph numbers): only the text inside one changes.
 * Idempotent.
 *
 *   npx tsx scripts/fix-books.mts          (writes; prints what each rule changed)
 *   npx tsx scripts/fix-books.mts --dry    (only counts, with examples)
 *
 * Rules:
 *   _italics_ marks           "_Daily Megaphone_" → "Daily Megaphone" (not inside a word: "2BR02_B" stays)
 *   [Sidenote: …]             a paragraph that is only a margin note keeps its words as a line; one inside the text
 *                             (a margin date, "[Sidenote: 1315]") is removed
 *   [Illustration: caption]   the picture isn't there: the caption stays, without the brackets; "[Illustration]"
 *                             alone becomes "(illustration)"
 *   [Footnote …]              removed
 *   garbled accents           "rï¿½gime" → "régime" (the few found), "BalafrÃ©" → "Balafré"
 *   double spaces             → one
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "data", "texts");
const DRY = process.argv.includes("--dry");
const counts = new Map<string, number>();
const examples = new Map<string, string[]>();
function sub(rule: string, t: string, re: RegExp, to: string | ((...a: string[]) => string)): string {
  const out = typeof to === "string" ? t.replace(re, to) : t.replace(re, (...a) => to(...(a as string[])));
  if (out !== t) {
    counts.set(rule, (counts.get(rule) ?? 0) + (re.global ? (t.match(re)?.length ?? 1) : 1));
    const ex = examples.get(rule) ?? examples.set(rule, []).get(rule)!;
    if (ex.length < 3) ex.push(`${t.slice(0, 90).replace(/\n/g, " ")}  →  ${out.slice(0, 90).replace(/\n/g, " ")}`);
  }
  return out;
}

/** Words whose accented letter was lost in the Gutenberg file (the "ï¿½" replacement character). */
const LOST: [RegExp, string][] = [
  [/rï¿½gime/g, "régime"],
  [/seï¿½orita/g, "señorita"],
  [/dï¿½but/g, "début"],
  [/caf(ï¿½|�)/g, "café"],
];

function fix(t: string): string {
  let x = t;
  // _italics_: an underscore pair at word edges (inside a word, like "2BR02_B", is left alone)
  x = sub("_italics_ marks", x, /(^|[\s(“"‘'—–-])_(?=\S)([^_\n]{1,400}?\S)_(?=$|[\s.,;:!?’”"')—–-])/g, (_m, a, b) => a + b);
  // a lone italics mark where a passage in italics starts or ends in another paragraph ("…in a black one._")
  if ((x.match(/_/g) ?? []).length === 1) x = sub("lone _ at a paragraph's edge", x, /^_(?=\S)|(?<=\S)_$/, "");
  // [Sidenote: …]
  // (a paragraph that is only a margin note, maybe with a year in its own brackets: "[Sidenote: 1315] The Scots
  // enter Dundalk]" → "1315 — The Scots enter Dundalk")
  if (/^\s*\[Sidenote:[^\n]*\]\s*$/.test(x))
    x = sub("[Sidenote] paragraph → its words", x, /^\s*\[Sidenote:\s*([^\n]*)\]\s*$/, (_m, inner) => inner.replace(/\s*\]\s*/g, " — ").replace(/\s*\[\s*/g, "").trim());
  x = sub("[Sidenote] inside the text, removed", x, /\s*\[Sidenote:\s*[^\]]*\]\s*/g, " ").trim();
  // [Illustration…]
  x = sub("[Illustration: caption] → the caption", x, /\[Illustration:\s*([^\]]*?)\s*\]/g, "$1");
  x = sub("[Illustration] alone → (illustration)", x, /^\s*\[Illustration\]\s*$/, "(illustration)");
  x = sub("[Illustration] inside the text, removed", x, /\s*\[Illustration\]\s*/g, " ").trim();
  // "[Illustration:" alone, its caption in the next paragraph
  x = sub("[Illustration: alone → (illustration)", x, /^\s*\[Illustration:?\s*$/, "(illustration)");
  // an [Illustration: caption that runs past the paragraph (its closing bracket in another paragraph)
  x = sub("[Illustration: unclosed caption → the caption", x, /^\[Illustration:\s*/, "");
  // [Footnote …]
  x = sub("[Footnote] removed", x, /\s*\[Footnote[^\]]*\]\s*/g, " ").trim();
  // garbled accents
  for (const [re, to] of LOST) x = sub("lost accent restored", x, re, to);
  x = sub("Windows-1252 misreading (Ã©) fixed", x, /Ã([©¨ª¡ ³¶º¼±§])/g, (_m, c) => ({ "©": "é", "¨": "è", "ª": "ê", "¡": "á", " ": "à", "³": "ó", "¶": "ö", "º": "ú", "¼": "ü", "±": "ñ", "§": "ç" })[c] ?? _m);
  // double spaces (not at a line start: poems indent with spaces)
  x = sub("double space → one", x, /(\S) {2,}(?=\S)/g, "$1 ");
  return x;
}

async function walk(d: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/^\d+\.json$/.test(e.name)) out.push(p);
  }
  return out;
}

let changedFiles = 0;
let emptied = 0;
for (const work of (await readdir(ROOT)).filter((w) => w.startsWith("lit-"))) {
  for (const file of await walk(path.join(ROOT, work))) {
    const raw = await readFile(file, "utf8");
    const j = JSON.parse(raw) as { verses: { v: string; t: string }[] };
    let changed = false;
    let captionOpen = false; // the paragraph before opened an [Illustration: caption without closing it
    for (const v of j.verses ?? []) {
      let t = fix(v.t);
      // that caption's closing bracket, left at the end of this paragraph
      if (captionOpen && !t.includes("[")) t = sub("a caption's closing ] (from the paragraph before) removed", t, /\s*\]\s*$/, "");
      captionOpen = /^\s*\[Illustration:?[^\]]*$/.test(v.t);
      if (t !== v.t) {
        if (!t.trim()) {
          emptied++;
          if (emptied <= 6) console.log("  (left as it was) " + v.t.slice(0, 100).replace(/\n/g, " "));
          continue; // never leave a paragraph empty
        }
        v.t = t;
        changed = true;
      }
    }
    if (changed) {
      changedFiles++;
      if (!DRY) {
        // the same layout the importer writes (one verse per line)
        const at = raw.indexOf('"verses":[');
        if (at < 0) throw new Error(`${file}: not in the importer's layout; not rewritten`);
        const head = raw.slice(0, at + '"verses":['.length);
        await writeFile(file, `${head}\n${j.verses.map((x) => JSON.stringify(x)).join(",\n")}\n]}\n`);
      }
    }
  }
}
for (const [r, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(n).padStart(7)}  ${r}`);
  for (const e of examples.get(r) ?? []) console.log(`           ${e}`);
}
console.log(`${DRY ? "would change" : "changed"} ${changedFiles} chapter files${emptied ? `; ${emptied} paragraphs left as they were (would have become empty)` : ""}`);
