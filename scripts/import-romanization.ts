/**
 * How to say the words in the word cards' "other languages" row, and what each Chinese character means.
 *
 * Russian and Greek words are read out by src/lib/translit.ts, and so are Hebrew and Arabic words that carry
 * their vowel marks. Wiktionary's translation tables usually write Hebrew and Arabic without vowels (so
 * they can't be read out by rule) and Chinese needs pinyin: those tables give a romanization next to the
 * word, which this keeps. For Chinese, each character's own Wiktionary entry gives its pinyin and meanings
 * (the "what do these characters mean" panel).
 *
 *   npx tsx scripts/import-romanization.ts     (one pass over the Wiktionary dump, ~5 minutes)
 *     → data/words/rom.json   { r: { "<lang>:<word>": "<romanization>" }, zh: { "<char>": { p: [pinyin…], d: [meaning…] } } }
 *
 * Only words that appear in data/words/*.json translations are kept (and only their characters).
 * Source: Wiktionary (CC BY-SA 4.0) via kaikki.org / wiktextract, the same dump as scripts/import-words.ts.
 */
import { createReadStream } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";

const ROOT = path.resolve(__dirname, "..");
const WORDS = path.join(ROOT, "data", "words");
const DUMP = path.join(ROOT, "data", "raw", "words", "kaikki", "raw-wiktextract-data.jsonl.gz");
/** Translation-table language code → site language (as in import-words.ts). */
const TR_LANG: Record<string, string> = { he: "he", ar: "ar", cmn: "zh", zh: "zh", grc: "el", el: "el", ru: "ru" };
const HAN = /\p{Script=Han}/u;

type Entry = { tr?: Record<string, string[]> };

async function wanted() {
  const words = new Set<string>(); // "<lang>:<word>"
  const chars = new Set<string>();
  for (const f of await readdir(WORDS)) {
    if (!/^[a-z]{2}\.json$/.test(f)) continue;
    const src = JSON.parse(await readFile(path.join(WORDS, f), "utf8")) as { w: Record<string, Entry> };
    for (const e of Object.values(src.w))
      for (const [l, ws] of Object.entries(e.tr ?? {}))
        if (Object.values(TR_LANG).includes(l))
          for (const w of ws) {
            words.add(`${l}:${w}`);
            if (l === "zh") for (const c of w) if (HAN.test(c)) chars.add(c);
          }
  }
  return { words, chars };
}

/** The display form of a translation word (the same cleaning as import-words.ts cleanTr). */
function clean(l: string, w: string): string {
  let x = w.replace(/\s*\(.*?\)\s*/g, " ").trim();
  if (l === "zh") x = x.split(/\s*\/\s*/)[0];
  if (l === "he") x = x.split(/\s*[\\/]\s*/).pop()!.trim();
  return x;
}

/** Pinyin as Wiktionary writes it ("ài", "shàngdì"); not Zhuyin or other systems. */
function pinyinOf(sounds: { zh_pron?: string; tags?: string[] }[] | undefined): string[] {
  // Standard Mandarin only (Wiktionary also lists Xi'an, Nanjing, Sichuanese… readings in pinyin)
  const out: string[] = [];
  for (const s of sounds ?? []) {
    const t = s.tags ?? [];
    if (!s.zh_pron || !t.includes("Mandarin") || !t.includes("Standard") || !t.includes("Pinyin")) continue;
    for (const p of s.zh_pron.replace(/\s*\(.*?\)\s*/g, " ").split(/[,，]\s*/)) {
      const x = p.trim();
      if (x && !out.includes(x) && /^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü' ]+$/.test(x)) out.push(x);
    }
  }
  return out.slice(0, 3);
}

async function main() {
  const { words, chars } = await wanted();
  console.log(`import-romanization: ${words.size} translation words, ${chars.size} Chinese characters wanted`);
  const r: Record<string, string> = {};
  const zh: Record<string, { p: string[]; d: string[] }> = {};
  const wordPinyin: Record<string, string> = {};
  const rl = readline.createInterface({ input: createReadStream(DUMP).pipe(zlib.createGunzip({ chunkSize: 1 << 20 })), crlfDelay: Infinity });
  let n = 0;
  const t0 = Date.now();
  for await (const line of rl) {
    if (++n % 2_000_000 === 0) console.log(`  ${n / 1e6}M lines, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    // the record's own language is near the end of the line; skip everything but English and Chinese quickly
    const li = line.lastIndexOf('"lang_code": "');
    if (li < 0) continue;
    const lang = line.slice(li + 14, line.indexOf('"', li + 14));
    if (lang === "en") {
      if (!line.includes('"roman"')) continue;
      const rec = JSON.parse(line) as { translations?: { lang_code?: string; code?: string; word?: string; roman?: string }[] };
      for (const t of rec.translations ?? []) {
        const l = TR_LANG[t.lang_code ?? t.code ?? ""];
        if (!l || !t.word || !t.roman) continue;
        const key = `${l}:${clean(l, t.word)}`;
        const roman = t.roman.replace(/\s*\(.*?\)\s*/g, " ").split(/\s*[,/]\s*/)[0].trim();
        if (words.has(key) && !r[key] && roman && roman.length <= 40) r[key] = roman;
      }
    } else if (lang === "zh") {
      const wi = line.lastIndexOf('"word": "');
      if (wi < 0) continue;
      const word = line.slice(wi + 9, line.indexOf('"', wi + 9));
      const single = [...word].length === 1 && chars.has(word);
      if (!single && !words.has(`zh:${word}`)) continue;
      const rec = JSON.parse(line) as { sounds?: { zh_pron?: string; tags?: string[] }[]; senses?: { glosses?: string[]; tags?: string[] }[] };
      // a word's own entry gives its standard pinyin ("shìjiè"), better than its characters' first readings
      const own = pinyinOf(rec.sounds)[0];
      if (own && !wordPinyin[word]) wordPinyin[word] = own;
      if (!single) continue;
      const z = (zh[word] ??= { p: [], d: [] });
      for (const p of pinyinOf(rec.sounds)) if (!z.p.includes(p) && z.p.length < 3) z.p.push(p);
      for (const s of rec.senses ?? []) {
        if ((s.tags ?? []).some((t) => /obsolete|archaic|rare|Cantonese|Hokkien|dialect/i.test(t))) continue;
        const g = (s.glosses ?? []).join("; ").replace(/\s+/g, " ").trim();
        if (g && g.length <= 90 && !/^(alternative|variant|simplified|traditional) (form|of)/i.test(g) && !z.d.includes(g) && z.d.length < 4) z.d.push(g);
      }
    }
  }
  for (const [c, z] of Object.entries(zh)) if (!z.p.length && !z.d.length) delete zh[c];
  // Chinese: the word's own pinyin wins over the translation table's
  for (const [w, py] of Object.entries(wordPinyin)) if (words.has(`zh:${w}`)) r[`zh:${w}`] = py;
  const sort = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  await writeFile(path.join(WORDS, "rom.json"), JSON.stringify({ r: sort(r), zh: sort(zh) }));
  const by = (l: string) => Object.keys(r).filter((k) => k.startsWith(l + ":")).length;
  console.log(`  romanizations: he ${by("he")}, ar ${by("ar")}, zh ${by("zh")}, el ${by("el")}, ru ${by("ru")}; Chinese characters: ${Object.keys(zh).length}/${chars.size}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
