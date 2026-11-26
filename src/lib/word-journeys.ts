/**
 * Word journeys (hidden study page, /word-journeys): the data side. One original-language word (a Strong's number)
 * followed through the Hebrew Old Testament or the Greek New Testament, from the interlinear data (STEP Bible's
 * TAHOT / TAGNT and TBESH / TBESG lexicons, Tyndale House, Cambridge, CC BY 4.0) served by /api/interlinear:
 *   lex/<H|G><thousands>.json   { "<strong>": [lemma, transliteration, gloss, longer gloss] }
 *   conc/<H|G><hundreds>.json   { "<strong>": { n, f: [forms], g: [glosses], r: ["<book> <ch>:<v> <form> <gloss>", …] } }
 * STEP splits some numbers into separate entries with a letter (H2617A "kindness", H2617B "shame"; H7965G–L the
 * senses of shalom): a "word" here is the plain number, with its lettered entries as senses you can switch on and off.
 * Concordance counts are verses (a word twice in one verse is listed once), in the KJV's verse numbering.
 */
import { wordKey } from "./lexicon-key";

export const OT_BOOKS = (
  "gen exo lev num deu jos jdg rut 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro ecc sng isa jer lam ezk dan hos jol amo oba jon mic nam hab zep hag zec mal"
).split(" ");
export const NT_BOOKS = "mat mrk luk jhn act rom 1co 2co gal eph php col 1th 2th 1ti 2ti tit phm heb jas 1pe 2pe 1jn 2jn 3jn jud rev".split(" ");
/** The usual sections, for the strip under the chart (counts of books, in order). */
export const OT_GROUPS = [
  { name: "Law", n: 5 },
  { name: "History", n: 12 },
  { name: "Poetry", n: 5 },
  { name: "Prophets", n: 17 },
];
export const NT_GROUPS = [
  { name: "Gospels", n: 4 },
  { name: "Acts", n: 1 },
  { name: "Paul", n: 13 },
  { name: "Letters", n: 8 },
  { name: "Rev.", n: 1 },
];

/** Starting words (each checked against the lexicon and concordance, Nov 26). */
export const STARTERS: { id: string; name: string; hint: string }[] = [
  { id: "H2617", name: "chesed", hint: "loyal love" },
  { id: "H7965", name: "shalom", hint: "peace" },
  { id: "H7307", name: "ruach", hint: "spirit, wind" },
  { id: "H0430", name: "elohim", hint: "God" },
  { id: "H8451", name: "torah", hint: "teaching, law" },
  { id: "G3056", name: "logos", hint: "word" },
  { id: "G0026", name: "agapē", hint: "love" },
  { id: "G5485", name: "charis", hint: "grace" },
  { id: "G4102", name: "pistis", hint: "faith" },
  { id: "G1515", name: "eirēnē", hint: "peace" },
];

/** "h2617", "G26", "g0026a" → "H2617" / "G0026" (the plain number, four digits); null if it isn't one. */
export function normStrong(s: string): string | null {
  const m = /^\s*([hg])\s*0*(\d{1,4})\s*[a-z]?\s*$/i.exec(s);
  if (!m || m[2] === "") return null;
  return m[1].toUpperCase() + m[2].padStart(4, "0");
}
/** "H0430" → "H430", as Strong's (and the KJV's tags) write it. */
export const shortStrong = (base: string) => base.replace(/^([HG])0*/, "$1");
/** The entry key a tag stands for ("H2617A", "G0026"), or null. */
export const keyOf = (tag: string) => {
  const m = /^([HG]\d{4}[A-Z]?)/.exec(tag ?? "");
  return m ? m[1] : null;
};
const belongs = (key: string, base: string) => key.slice(0, 5) === base && /^[HG]\d{4}[A-Z]?$/.test(key);

const cache = new Map<string, Promise<unknown>>();
/** A JSON file, fetched once per page (and kept by the browser's cache between visits); null if it can't be had. */
export function getJson<T>(url: string): Promise<T | null> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then(
      (r) => (r.ok ? r.json() : null),
      () => null,
    );
    cache.set(url, p);
    void p.then((d) => {
      if (d === null) cache.delete(url); // a failed load isn't kept: the next look tries again
    });
  }
  return p as Promise<T | null>;
}

export type Lex = [string, string, string, string];
export type ConcEntry = { n: number; f: string[]; g: string[]; r: string[] };
export type Sense = { key: string; lex: Lex | null; conc: ConcEntry | null };

const lexShard = (base: string) => `/api/interlinear/lex/${base[0]}${Math.floor(parseInt(base.slice(1, 5), 10) / 1000)}.json`;
const concShard = (base: string) => `/api/interlinear/conc/${base[0]}${Math.floor(parseInt(base.slice(1, 5), 10) / 100)}.json`;

/** Every lettered entry of one number, with its lexicon line and its places. null: the data couldn't be loaded. */
export async function loadWord(base: string): Promise<Sense[] | null> {
  const [lex, conc] = await Promise.all([getJson<Record<string, Lex>>(lexShard(base)), getJson<Record<string, ConcEntry>>(concShard(base))]);
  if (!lex && !conc) return null;
  const keys = new Set<string>();
  for (const k of Object.keys(lex ?? {})) if (belongs(k, base)) keys.add(k);
  for (const k of Object.keys(conc ?? {})) if (belongs(k, base)) keys.add(k);
  return [...keys]
    .map((key) => ({ key, lex: lex?.[key] ?? null, conc: conc?.[key] ?? null }))
    .sort((a, b) => (b.conc?.n ?? 0) - (a.conc?.n ?? 0) || (a.key < b.key ? -1 : 1));
}

export type Place = { book: string; bi: number; ch: number; v: string; form: string; gloss: string; keys: string[] };

/** The places of the chosen senses, merged into canonical order (a verse with two senses is one place). */
export function placesOf(senses: Sense[], on: Set<string>): Place[] {
  const books = senses[0]?.key[0] === "G" ? NT_BOOKS : OT_BOOKS;
  const byVerse = new Map<string, Place>();
  for (const s of senses) {
    if (!on.has(s.key) || !s.conc) continue;
    for (const x of s.conc.r) {
      const [book, cv, fi, gi] = x.split(" ");
      const id = `${book} ${cv}`;
      const had = byVerse.get(id);
      if (had) {
        if (had.keys.indexOf(s.key) < 0) had.keys.push(s.key);
        continue;
      }
      const [ch, v] = cv.split(":");
      byVerse.set(id, { book, bi: books.indexOf(book), ch: parseInt(ch, 10), v, form: s.conc.f[+fi] ?? "", gloss: s.conc.g[+gi] ?? "", keys: [s.key] });
    }
  }
  return [...byVerse.values()].sort((a, b) => a.bi - b.bi || a.ch - b.ch || parseInt(a.v, 10) - parseInt(b.v, 10));
}

/* ---------- search: by transliteration, Hebrew / Greek letters, or English gloss ---------- */

export type Found = { base: string; lemma: string; translit: string; glosses: string[]; verses: number };
type Row = Found & { tkey: string; lemmaKey: string; gl: string[] };

const rows = new Map<"H" | "G", Promise<Row[]>>();
/**
 * One language's word list (public/word-journeys/<H|G>.json, built by scripts/build-word-journeys-index.mts: only
 * words that occur, with short glosses; about 150 KB / 100 KB gzipped), loaded only when someone searches it.
 */
function wordList(lang: "H" | "G"): Promise<Row[]> {
  let p = rows.get(lang);
  if (!p) {
    p = getJson<[string, string, string, string, number][]>(`/word-journeys/${lang}.json`).then((list) =>
      (list ?? []).map(([base, lemma, translit, glosses, verses]) => {
        const gs = glosses ? glosses.split("|") : [];
        return { base, lemma, translit, glosses: gs, verses, tkey: wordKey(translit), lemmaKey: wordKey(lemma), gl: gs.map((g) => g.toLowerCase()) };
      }),
    );
    rows.set(lang, p);
    void p.then((list) => {
      if (!list.length) rows.delete(lang); // nothing loaded (offline): try again next time
    });
  }
  return p;
}

/** Best matches first: the exact spelling or meaning, then words starting with it, then words containing it. */
export async function searchWords(q: string, langs: ("H" | "G")[]): Promise<Found[]> {
  const text = q.trim().toLowerCase();
  if (text.length < 2) return [];
  const key = wordKey(text);
  const lists = await Promise.all(langs.map(wordList));
  const whole = new RegExp(`(^|[\\s:;,(/-])${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[\\s:;,)/-])`);
  const hits: { r: Row; score: number }[] = [];
  for (const list of lists)
    for (const r of list) {
      let score = 99;
      if (key && (r.tkey === key || r.lemmaKey === key)) score = 0;
      for (const g of r.gl) {
        if (g === text) score = Math.min(score, 1);
        else if (whole.test(g)) score = Math.min(score, 2);
      }
      if (score > 3 && key.length >= 2 && (r.tkey.indexOf(key) === 0 || r.lemmaKey.indexOf(key) === 0)) score = 3;
      if (score > 4) for (const g of r.gl) if (g.indexOf(text) >= 0) score = Math.min(score, text.length >= 3 ? 4 : 99);
      if (score < 99) hits.push({ r, score });
    }
  // within a score: the most used words first
  hits.sort((a, b) => a.score - b.score || b.r.verses - a.r.verses);
  return hits.slice(0, 30).map(({ r }) => ({ base: r.base, lemma: r.lemma, translit: r.translit, glosses: r.glosses, verses: r.verses }));
}

/* ---------- verse texts ---------- */

export type BookText = { chapters: Record<string, { verses: { v: string; t: string }[] }> };
/** Interlinear words of a chapter: [original, transliteration, gloss, strong, grammar]. */
export type IWord = [string, string, string, string, number];

export const kjvBook = (book: string) => getJson<BookText>(`/texts/bible/kjv/${book}.json`);
export const interChapter = (book: string, ch: number) => getJson<Record<string, IWord[]>>(`/api/interlinear/${book}/${ch}.json`);
