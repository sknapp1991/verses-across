/**
 * Interlinear data (ROADMAP ST1): every word of the Hebrew Old Testament and the Greek New Testament with its
 * transliteration, an English gloss, its Strong's number and its grammar in plain words, verse by verse, plus a
 * brief lexicon entry per Strong's number. From STEP Bible's tagged texts (Tyndale House, Cambridge; CC BY 4.0):
 * TAHOT (Hebrew, Leningrad Codex) and TAGNT (Greek: the words the Textus Receptus has, as TAGNT spells them), the
 * TBESH / TBESG lexicons and the TEHMC / TEGMC grammar codes. Verse numbers follow the KJV.
 *
 * Input: data/raw/stepbible/*.txt (downloaded from github.com/STEPBible/STEPBible-Data; not in git).
 *   npx tsx scripts/build-interlinear.mts      → .cache-interlinear/ (too big for git: ~1,200 files)
 *   npx tsx scripts/upload-interlinear.ts      → R2 interlinear/…, served by /api/interlinear/…
 * Files:
 *   <book>/<chapter>.json   { "<verse>": [[original, transliteration, gloss, strong, grammar index], …] }
 *   grammar.json            ["Verb · Qal · Perfect · third person masculine singular", …]
 *   lex/<H|G><thousands>.json   { "<strong>": [lemma, transliteration, gloss, definition] }
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "data", "raw", "stepbible");
const OUT = path.join(ROOT, ".cache-interlinear");
const lines = (f: string) => readFileSync(path.join(RAW, f), "utf8").split(/\r?\n/);
const files = readdirSync(RAW);

/* ---------- grammar codes → plain words ---------- */
const GRAM = new Map<string, Map<string, string>>();
for (const f of files.filter((x) => /^TE[HG]MC/.test(x)))
  for (const l of lines(f)) {
    const [code, desc] = l.split("\t");
    if (!code || !desc || !/Function=/.test(desc) || GRAM.has(code.trim())) continue;
    const kv = new Map<string, string>();
    for (const part of desc.replace(/\([^)]*\)/g, "").split(";")) {
      const [k, v] = part.split("=").map((x) => x?.trim());
      if (k && v) kv.set(k, v);
    }
    GRAM.set(code.trim(), kv);
  }
/** "HVqp3ms" → "Verb · Qal · Perfect · third person masculine singular" */
function plain(code: string): string {
  const kv = GRAM.get(code);
  if (!kv) return "";
  const out: string[] = [];
  const fn = kv.get("Function") ?? "";
  if (fn) out.push(fn);
  for (const k of ["Stem", "Tense", "Form", "Voice", "Mood"]) {
    const v = kv.get(k);
    if (v && v !== "Common" && !out.includes(v)) out.push(v);
  }
  const pgn = [kv.get("Person") ? `${kv.get("Person")!.toLowerCase()} person` : "", kv.get("Case")?.toLowerCase() ?? "", kv.get("Gender")?.toLowerCase() ?? "", kv.get("Number")?.toLowerCase() ?? ""]
    .filter(Boolean)
    .join(" ");
  if (pgn) out.push(pgn);
  if (kv.get("State") === "Construct") out.push("construct (\"of\")");
  return out.join(" · ");
}
/** A Hebrew prefix in a word: "the", "and", "in"… as a grammar name. */
function prefixName(code: string): string {
  const kv = GRAM.get(code);
  if (!kv) return "";
  const fn = kv.get("Function") ?? "";
  return (fn === "Particle" && kv.get("Form") ? kv.get("Form")! : fn).replace(/\s*\(Hebrew\)/, "").toLowerCase();
}
const grammar: string[] = [];
const gIndex = new Map<string, number>();
const gid = (s: string) => {
  let i = gIndex.get(s);
  if (i === undefined) {
    i = grammar.push(s) - 1;
    gIndex.set(s, i);
  }
  return i;
};

/* ---------- texts ---------- */
type Word = [string, string, string, string, number];
const chapters = new Map<string, Record<string, Word[]>>(); // "book/chapter" → verse → words
const add = (book: string, ch: string, v: string, w: Word) => {
  const k = `${book}/${ch}`;
  const c = chapters.get(k) ?? {};
  (c[v] ??= []).push(w);
  chapters.set(k, c);
};
// The verse number our KJV-based reader uses: TAHOT gives the English one first (the Hebrew, if different, in
// round brackets); TAGNT gives its own first and the KJV's, if different, in square brackets (2Co.13.12[13.13]).
const REF = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:\[(\d+)\.(\d+)\])?/;
const refOf = (m: RegExpExecArray) => ({ book: m[1].toLowerCase(), ch: m[4] ?? m[2], v: m[5] ?? m[3] });
/** "[14] The", "{14.24} To Him" → "The", "To Him" (verse markers the taggers left in a few glosses). */
const gloss = (s: string) => s.replace(/^\s*(?:\[\d+\]|\{\d+\.\d+\})\s*/, "").replace(/\s+/g, " ").trim();
/** Hebrew as shown: vowels kept, cantillation marks and the editors' separators dropped. */
const hebrew = (s: string) => s.replace(/[֑-ֽ֯׃\\/]/g, "").trim();

// Hebrew: ref, Hebrew, transliteration, gloss, dStrongs, grammar … (prefixes split by "/"; the main word in {})
for (const f of files.filter((x) => x.startsWith("TAHOT")))
  for (const l of lines(f)) {
    const c = l.split("\t");
    const m = REF.exec(c[0] ?? "");
    if (!m || !c[1] || !c[4] || !/#\d/.test(c[0])) continue;
    const strongs = c[4].split("/");
    const main = Math.max(0, strongs.findIndex((s) => s.startsWith("{")));
    const strong = (strongs[main] ?? "").replace(/[{}]/g, "").replace(/\\.*$/, "");
    const grams = (c[5] ?? "").split("/");
    const lang = grams[0]?.[0] ?? "H"; // H (Hebrew) or A (Aramaic)
    const full = (g: string, i: number) => (i === 0 ? g : lang + g);
    const prefix = grams.slice(0, main).map((p, i) => prefixName(full(p, i))).filter(Boolean);
    const gram = [prefix.length ? `with ${prefix.join(" + ")}` : "", plain(full(grams[main] ?? "", main))].filter(Boolean).join("; ");
    const at = refOf(m);
    add(at.book, at.ch, at.v, [hebrew(c[1]), c[2].replace(/[./]/g, "").toLowerCase(), gloss(c[3].replace(/\//g, "")), strong, gid(gram)]);
  }

// Greek: ref, "Greek (translit)", English, "dStrongs=Grammar", "lemma=gloss", editions … — the TR's words only
let greekSkipped = 0;
for (const f of files.filter((x) => x.startsWith("TAGNT")))
  for (const l of lines(f)) {
    const c = l.split("\t");
    const m = REF.exec(c[0] ?? "");
    if (!m || !c[1] || !c[3] || !/#\d/.test(c[0])) continue;
    if (!/\bTR\b/.test(c[5] ?? "")) {
      greekSkipped++;
      continue;
    }
    const wm = /^(.*?)\s*\((.*)\)\s*$/.exec(c[1]);
    // "G0976=N-NSF"; a crasis (two words in one) is "G1473=P-1NS + G2532=CONJ": grammar of each, joined
    const parts = c[3].split(/\s*\+\s*/).map((p) => p.split("="));
    const strong = parts[0][0].trim();
    const gram = parts.map(([, code]) => plain(code?.trim() ?? "")).filter(Boolean).join(" + ");
    const at = refOf(m);
    const word = (wm ? wm[1] : c[1]).replace(/[.,;·:!?]+$/, ""); // punctuation is the editor's, not the word
    add(at.book, at.ch, at.v, [word, (wm ? wm[2] : "").toLowerCase(), gloss(c[2]), strong, gid(gram)]);
  }

/* ---------- lexicons ---------- */
const lex: Record<string, Record<string, [string, string, string, string]>> = {};
const strip = (h: string) =>
  h
    .replace(/<br\s*\/?>/gi, "; ")
    .replace(/<[^>]+>/g, "")
    .replace(/_{2,}/g, "")
    .replace(/\s*;\s*(;\s*)+/g, "; ")
    .replace(/^[\s;:]+/, "")
    .replace(/\s+/g, " ")
    .trim();
for (const f of files.filter((x) => /^TBES[HG]/.test(x)))
  for (const l of lines(f)) {
    const c = l.split("\t");
    if (!/^[HG]\d{4}/.test(c[0] ?? "") || !c[1]) continue;
    const key = c[1].replace(/\s*=.*$/, "").trim(); // the extended Strong's number of this entry
    if (!/^[HG]\d{4}[A-Z]?$/.test(key)) continue;
    let def = strip(c[7] ?? "");
    if (def.length > 600) def = def.slice(0, def.lastIndexOf(" ", 600)) + " …";
    const shard = key[0] + Math.floor(parseInt(key.slice(1, 5), 10) / 1000);
    (lex[shard] ??= {})[key] = [hebrew(c[3] ?? ""), (c[4] ?? "").replace(/\./g, ""), strip(c[6] ?? ""), def];
  }

/* ---------- write ---------- */
// Clear the old build but keep the upload record, so only changed files are uploaded again.
mkdirSync(OUT, { recursive: true });
for (const d of readdirSync(OUT)) if (d !== ".uploaded.json") rmSync(path.join(OUT, d), { recursive: true, force: true });
let words = 0;
for (const [k, verses] of chapters) {
  const [book, ch] = k.split("/");
  mkdirSync(path.join(OUT, book), { recursive: true });
  writeFileSync(path.join(OUT, book, `${ch}.json`), JSON.stringify(verses));
  for (const v of Object.values(verses)) words += v.length;
}
writeFileSync(path.join(OUT, "grammar.json"), JSON.stringify(grammar));
mkdirSync(path.join(OUT, "lex"), { recursive: true });
for (const [shard, entries] of Object.entries(lex)) writeFileSync(path.join(OUT, "lex", `${shard}.json`), JSON.stringify(entries));
console.log(
  `${chapters.size} chapters, ${words} words (${greekSkipped} Greek words not in the TR left out), ${grammar.length} grammar descriptions, ${Object.values(lex).reduce((a, x) => a + Object.keys(x).length, 0)} lexicon entries`,
);
