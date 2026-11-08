/**
 * The Literature shelf: Project Gutenberg books (public domain in the US) listed in data/literature-list.json,
 * grouped like Gutenberg's own reading lists (For Children, Fiction, Crime, …).
 *
 * One work per book ("lit-<slug>"), one version per Gutenberg file ("pg<number>"; a book's original-language
 * edition, when listed, is a second version shown side by side). Chapters are found automatically
 * (CHAPTER / LETTER / STAVE / CANTO / BOOK / ACT … headings, numbered or titled stories), with a report of
 * anything that looks off. Paragraphs become the units you can highlight and note (verse numbers are not
 * shown for literature); poems keep their line breaks. Gutenberg's header and licence footer, the
 * "[Illustration]" captions, footnote marks and tables of contents are left out.
 *
 *   npx tsx scripts/import-literature.ts            (all; downloads once into data/raw/gutenberg-lit/)
 *   npx tsx scripts/import-literature.ts 11 84      (some, by Gutenberg number)
 *
 * → data/texts/lit-*\/pg*\/<book>/<n>.json, and the "literature" shelf + works + versions in data/catalog.json.
 * Texts come from Project Gutenberg's PGLAF mirror (Gutenberg asks automated tools to use mirrors).
 */
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { cached, gutenbergBody, resetVersion, ROOT, roman, writeChapter, type Verse } from "./lib/world";

const MIRROR = (id: number) => `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.txt`;
/** The older layout on the same mirror (some books have no generated pg<n>.txt): /3/3/2/8/33283/33283-0.txt */
const MIRROR_OLD = (id: number, suffix = "-0") => {
  const d = String(id);
  const dirs = d.length === 1 ? ["0"] : d.slice(0, -1).split("");
  return `https://gutenberg.pglaf.org/${dirs.join("/")}/${d}/${d}${suffix}.txt`;
};
/** A book's plain text, from whichever file the mirror has; null when there is none. */
/** Windows-1252's characters in 0x80–0x9F (the rest of the range up to 0xFF is the same as the code point). */
const CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};
/** "blasÃ©" (a UTF-8 file read as Windows-1252) → "blasé": re-encode as it was misread, then read as UTF-8. */
export function fixMojibake(t: string) {
  const bad = (x: string) => x.match(/Ã[\u0080-\u00BF]|Â[\u00A0-\u00BF]|â€/g)?.length ?? 0;
  if (!bad(t)) return t;
  const bytes: number[] = [];
  for (const ch of t) {
    const c = ch.codePointAt(0)!;
    if (c <= 0xff) bytes.push(c);
    else if (CP1252[ch] != null) bytes.push(CP1252[ch]);
    else return t; // not a simple misreading: leave it
  }
  const fixed = Buffer.from(bytes).toString("utf8");
  return bad(fixed) < bad(t) && (fixed.match(/\uFFFD/g)?.length ?? 0) <= 3 ? fixed : t;
}
/**
 * Gutenberg marks the few books still under copyright ("This is a COPYRIGHTED Project Gutenberg eBook"),
 * and some carry a Creative Commons licence: neither is public domain, so neither is imported.
 * (Publisher notices like "All rights reserved" in books Gutenberg has cleared are not a mark.)
 */
export function isCopyrighted(t: string) {
  return /COPYRIGHTED Project Gutenberg|creativecommons\.org|Creative Commons (Attribution|license)/i.test(t);
}
async function bookText(id: number): Promise<string | null> {
  const t = await rawBookText(id);
  return t == null ? null : fixMojibake(t);
}
async function rawBookText(id: number): Promise<string | null> {
  for (const [name, url] of [[`pg${id}.txt`, MIRROR(id)], [`${id}-0.txt`, MIRROR_OLD(id)], [`${id}.txt`, MIRROR_OLD(id, "")], [`${id}-8.txt`, MIRROR_OLD(id, "-8")]]) {
    try {
      return await cached("gutenberg-lit", name, url);
    } catch {
      /* try the next file */
    }
  }
  return null;
}

type Entry = { gid: number; title: string; author: string; lang: string; also?: number[]; group?: number[]; name?: string; year?: number };
type List = { collections: { id: string; name: string; books: Entry[] }[] };

/* ---------- names, authors, years ---------- */

/** Display titles (Gutenberg's catalog titles often carry subtitles) and first-publication years. */
const META: Record<number, [string | null, number]> = {
  11: [null, 1865], 12: [null, 1871], 16: [null, 1911], 55: [null, 1900], 37106: ["Little Women", 1868], 120: [null, 1883], 45: [null, 1908],
  2591: [null, 1812], 67098: [null, 1926], 46: ["A Christmas Carol", 1843], 41: [null, 1820], 113: [null, 1911], 1448: [null, 1881], 500: [null, 1883],
  11757: [null, 1922], 14838: [null, 1902], 146: ["A Little Princess", 1905], 1597: [null, 1835], 11339: [null, 1912], 1450: [null, 1913],
  498: [null, 1903], 1874: [null, 1906], 778: [null, 1902], 3836: ["The Swiss Family Robinson", 1812], 902: ["The Happy Prince and Other Tales", 1888],
  764: ["Hans Brinker, or The Silver Skates", 1865], 74: ["The Adventures of Tom Sawyer", 1876], 501: [null, 1920], 289: [null, 1908],
  128: [null, 1898], 708: [null, 1872], 421: [null, 1886], 1837: [null, 1881], 2306: ["Uncle Remus: His Songs and His Sayings", 1880],
  32488: ["Just So Stories", 1902], 18190: ["Raggedy Ann Stories", 1918], 17371: ["Raggedy Andy Stories", 1920], 38567: [null, 1875], 35555: [null, 1901],
  39784: ["Mother Goose's Nursery Rhymes", 1877], 26197: [null, 1897], 27602: [null, 1893], 28308: [null, 1915], 5312: [null, 1897], 14872: ["Tales of Beatrix Potter", 1903],
  271: [null, 1877], 215: ["The Call of the Wild", 1903], 910: [null, 1906], 236: [null, 1894], 2818: ["Beautiful Joe", 1893], 72577: [null, 1923],
  944: [null, 1839], 2009: ["On the Origin of Species (sixth edition)", 1872],
  2641: [null, 1908], 103: [null, 1872], 3176: [null, 1869], 535: ["Travels with a Donkey in the Cévennes", 1879], 10636: [null, 1300],
  61: [null, 1848], 1: [null, 1776], 2160: [null, 1771], 829: ["Gulliver's Travels", 1726], 61221: ["A Passage to India", 1924],
  1661: [null, 1892], 2852: [null, 1902], 244: [null, 1887], 2097: ["The Sign of the Four", 1890], 2554: [null, 1866], 155: [null, 1868], 863: [null, 1920],
  1155: [null, 1922], 43: ["The Strange Case of Dr. Jekyll and Mr. Hyde", 1886], 2148: ["The Works of Edgar Allan Poe, Volume 2", 1845], 8492: [null, 1895],
  345: [null, 1897], 10007: [null, 1872],
  39863: ["The Montessori Method", 1912], 852: ["Democracy and Education", 1916], 5427: [null, 1762], 2044: [null, 1907], 935: ["Self-Help", 1859],
  33283: ["Calculus Made Easy", 1910], 20203: ["The Autobiography of Benjamin Franklin", 1791], 12439: ["Notes on Nursing", 1859], 2397: ["The Story of My Life", 1903],
  1342: [null, 1813], 84: ["Frankenstein", 1818], 2701: ["Moby-Dick", 1851], 98: [null, 1859], 174: [null, 1890], 1260: ["Jane Eyre", 1847],
  64317: [null, 1925], 5200: [null, 1915], 1400: [null, 1861], 1952: [null, 1892], 1184: [null, 1844], 2600: [null, 1869], 76: [null, 1884],
  768: [null, 1847], 145: [null, 1871], 135: [null, 1862], 996: [null, 1605], 1399: [null, 1878], 28054: [null, 1880], 219: [null, 1899],
  4300: [null, 1922], 2814: [null, 1914], 25344: [null, 1850], 161: [null, 1811], 158: [null, 1815], 105: [null, 1817], 35: [null, 1895],
  36: ["The War of the Worlds", 1898], 164: [null, 1870], 844: ["The Importance of Being Earnest", 1895], 2542: ["A Doll's House", 1879],
  1513: [null, 1597], 1524: ["Hamlet", 1603], 1533: ["Macbeth", 1623], 67979: ["The Blue Castle", 1926], 16389: [null, 1922], 394: [null, 1853],
  6593: ["The History of Tom Jones, a Foundling", 1749], 2413: [null, 1857], 1257: [null, 1844], 521: ["Robinson Crusoe", 1719], 160: [null, 1899],
  1080: ["A Modest Proposal", 1729], 14591: ["Faust (Part One)", 1808], 2610: ["The Hunchback of Notre-Dame", 1831], 766: [null, 1850], 730: [null, 1838],
  209: [null, 1898], 5230: ["The Invisible Man", 1897], 159: ["The Island of Doctor Moreau", 1896], 1322: [null, 1855], 67138: [null, 1926],
  110: ["Tess of the d'Urbervilles", 1891], 599: [null, 1848], 121: [null, 1817], 141: [null, 1814],
  1404: [null, 1788], 147: [null, 1776], 5: [null, 1787], 2: [null, 1791], 1232: [null, 1532], 3300: ["The Wealth of Nations", 1776],
  17474: ["How to Listen to Music", 1896], 16248: ["The Opera", 1897], 3528: ["Beethoven, the Man and the Artist", 1905], 5197: ["Wagner, My Life", 1911],
  175: [null, 1910], 17461: [null, 1879], 17462: [null, 1879], 14968: ["The Standard Operas", 1886],
  131: ["The Pilgrim's Progress", 1678], 26: [null, 1667], 1004: ["The Divine Comedy", 1320], 4928: [null, 1867], 16328: ["Beowulf", 1000],
  72679: ["The Lesser Key of Solomon (Goetia)", 1904], 27827: ["The Kama Sutra", 1883], 58585: [null, 1923], 2500: [null, 1922], 58: [null, 1671],
  3623: ["The Golden Bough", 1890], 7145: ["The Book of the Dead", 1895], 5657: [null, 1692], 130: [null, 1908],
  1228: ["On the Origin of Species (first edition)", 1859], 5001: ["Relativity: The Special and General Theory", 1916], 33504: [null, 1704], 15491: [null, 1665],
  21076: ["Euclid's Elements, Books I–VI", 1847], 2300: ["The Descent of Man", 1871], 30775: ["Elements of Chemistry", 1789],
  14986: ["Experimental Researches in Electricity, Volume 1", 1839], 25267: [null, 1904],
  23: ["Narrative of the Life of Frederick Douglass", 1845], 408: [null, 1903], 2376: ["Up from Slavery", 1901], 3420: [null, 1792],
  11030: ["Incidents in the Life of a Slave Girl", 1861], 140: [null, 1906], 45502: ["How the Other Half Lives", 1890], 205: ["Walden", 1854],
  815: ["Democracy in America, Volume 1", 1835], 833: [null, 1899], 27083: [null, 1869], 2130: [null, 1516],
  65061: ["The Boston Cooking-School Cook Book", 1896], 10136: ["Mrs. Beeton's Book of Household Management", 1861],
  39272: ["The Inventions, Researches and Writings of Nikola Tesla", 1894], 21531: ["Woodwork Joints", 1910], 15147: ["Beeton's Book of Needlework", 1870],
  132: [null, -500], 73: ["The Red Badge of Courage", 1895], 1946: [null, 1832], 75011: ["All Quiet on the Western Front", 1929],
  4367: [null, 1885], 7142: [null, -400], 10657: ["The Gallic Wars", -50], 4361: ["Memoirs of General William T. Sherman", 1875], 75201: ["A Farewell to Arms", 1929],
};

const ROLE = /\[(Translator|Illustrator|Editor|Commentator|Author of introduction, etc\.|Contributor|Compiler|Annotator|Photographer)\]/i;
/** "Carroll, Lewis, 1832-1898" → "Lewis Carroll"; "Baum, L. Frank (Lyman Frank), 1856-1919" → "L. Frank Baum". */
function personName(s: string) {
  const t = s.replace(ROLE, "").replace(/\([^)]*\)/g, "").replace(/,?\s*-?\d{1,4}\??\s*(BCE|CE)?\s*-\s*-?\d{0,4}\??\s*(BCE|CE)?/g, "").replace(/\s+/g, " ").trim();
  const parts = t.split(/,\s*/).filter(Boolean);
  if (parts.length >= 2 && !/^(Saint|Sir|of|the)/i.test(parts[1])) return `${parts[1]} ${parts[0]}`.replace(/\s+/g, " ").trim();
  return parts.join(" ").trim();
}
function people(authors: string) {
  const list = authors.split(/;\s*/).filter(Boolean);
  const authorsOnly = list.filter((a) => !ROLE.test(a));
  const translators = list.filter((a) => /\[Translator\]/i.test(a)).map(personName);
  return { author: authorsOnly.length ? authorsOnly.slice(0, 2).map(personName).join(" & ") : "Anonymous", translator: translators[0] };
}
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^(the|a|an)-/, "")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/, "");

/* ---------- the Gutenberg catalog (languages and authors of the extra editions) ---------- */

async function catalogRows() {
  const csv = await readFile(path.join(ROOT, "data", "raw", "gutenberg-catalog", "pg_catalog.csv"), "utf8");
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
  return new Map(rows.slice(1).map((r) => [Number(r[0]), { title: r[3].replace(/\s+/g, " "), lang: r[4].split(";")[0].trim(), authors: r[5] }]));
}

/* ---------- cleaning ---------- */

/** Drop transcriber notes, illustration captions, footnote marks; keep the words. */
function cleanBlock(b: string) {
  const t = b.trim();
  // Whole blocks that are not the book: captions, notes, image files, Gutenberg's own lines.
  if (/^\[?\s*(Illustration|Picture|Transcriber|Frontispiece|Copyright|Decoration)\b/i.test(t.replace(/^[\[(_\s]+/, "")) && /\]\s*$/.test(t)) return "";
  if (/Project Gutenberg|Transcriber['’]?s? [Nn]ote|Distributed Proofread|www\.pgdp\.net|Internet Archive|HTML version|This e-?text was produced|typographical errors have been|Transcriber['’]?s? (Notes?|corrections)|errors? (has|have) been (silently )?corrected|(added|inserted|corrected|changed) by the transcriber|^On page \d+,|advertising pages|in the original (book|edition|text)\b.{0,80}\b(typeset|spelled|printed|reads)|printer['’]s errors|inconsisten(t|cies) (in )?(spelling|hyphenation)/i.test(t) && t.length < 1500) return "";
  if (/^F\s+I\s+N\s+I\s+S\.?$/.test(t)) return "";
  if (/^\S+\.(jpg|jpeg|png|gif)\b/i.test(t)) return "";
  if (/^\[?\s*(Full Size|Enlarge|Larger image)\s*\]?$/i.test(t)) return ""; // a picture link's leftover text
  return b
    .replace(/\[Illustration[\s\S]*?\]\s*\]?/gi, "")
    .replace(/\[_?(Copyright|Picture)[^\]]*\]\]?/gi, "")
    .replace(/\[Illustration[^\]]*\]/gi, "")
    .replace(/\[(Footnote|Note)[^\]]*\]/gi, "")
    .replace(/\[(\d{1,3}|[A-Z]|[*†‡])\]/g, "")
    .replace(/\{\d{1,3}\}/g, "")
    .replace(/\s*\[(Pg|Page|p\.)\s*[\divxlcIVXLC]+\]\s*/g, " ") // page markers: [Pg 12], [Pg xix]
    .replace(/_(?=\S)([^_\n]{1,200}?)_/g, "$1") // _italics_ (Gutenberg's plain-text italics)
    .replace(/(^|\s)=(?=\S)([^=\n]+?)=(?=[\s.,;:!?]|$)/gm, "$1$2"); // =bold=
}

const SEPARATOR = /^[\s*.·•_—=-]{3,}$/;
const NOISE = /^(Produced by|Transcriber['’]s? [Nn]ote|E-text prepared|This e-?book|Updated editions|Illustrated by|\[?Contents\]?$|CONTENTS$|List of Illustrations|ILLUSTRATIONS$)/;

/** One block of lines → a paragraph (prose unwrapped; poems keep their lines). */
function toParagraph(block: string, poem: boolean) {
  const lines = block.split("\n").map((l) => l.replace(/\s+$/, ""));
  const text = lines.map((l) => l.trim()).filter(Boolean);
  if (!text.length) return "";
  const short = text.filter((l) => l.length < 52).length;
  const lowerStarts = text.slice(1).filter((l) => /^[a-z]/.test(l)).length;
  const wrappedProse = text.length >= 2 && lowerStarts / (text.length - 1) > 0.4;
  const verse = poem || (!wrappedProse && text.length >= 2 && (Math.max(...text.map((l) => l.length)) <= 58 || (text.length >= 3 && short / text.length >= 0.6 && lines.some((l) => /^\s{2,}\S/.test(l)))));
  const out = verse ? text.join("\n") : text.join(" ").replace(/\s+/g, " ");
  return out.replace(/ {2,}/g, " ").trim();
}

/* ---------- chapters ---------- */

const WORDS = "CHAPTER|CHAP\\.?|LETTER|STAVE|CANTO|BOOK|PART|VOLUME|ACT|SCENE|SECTION|LECTURE|ADVENTURE|TALE|STORY|ESSAY|FEDERALIST|PAPER|CAPÍTULO|CAPITULO|CAPITOLO|KAPITEL";
const NUM = "[IVXLCDM]+|\\d{1,3}|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY(?:[- ](?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|THIRTY|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH|SIXTEENTH|SEVENTEENTH|EIGHTEENTH|NINETEENTH|TWENTIETH|LAST|PRIMERO|PRIMO";
const WORD_HEAD = new RegExp(`^\\s*(${WORDS})\\s+(?:the\\s+|No\\.?\\s*)?(${NUM})\\b[.:—-]?\\s*(.*)$`, "i");
const ROMAN_TITLE = /^\s*([IVXLC]+)\.\s+([A-Z][A-Z0-9'’,.:;!?\- ]{2,70})$/; // "I. A SCANDAL IN BOHEMIA"
const ROMAN_ALONE = /^\s*([IVXLC]+)\.?\s*$/;
const NUM_ALONE = /^\s*(\d{1,3})\.?\s*$/;
const CAPS_TITLE = /^\s*([A-Z][A-Z0-9'’,.:;!?&\- ]{2,60}[A-Z.!?])\s*$/; // stories: "THE GOLDEN BIRD"

type Head = { line: number; family: string; label: string; title: string };
type Found = { chapters: { title: string; paras: string[] }[]; how: string; warnings: string[] };

const isUpperish = (s: string) => s === s.toUpperCase() && /[A-Z]/.test(s);
const tidyTitle = (s: string) =>
  s
    .replace(/[_=]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[.:—\-\s\]]+|[.,;\s\]]+$/g, "") // "Chapter I.]" (the end of an illustration caption) → no title
    .trim();
/** "Chapter Ii" → "Chapter II" (a word that is a Roman numeral, after title-casing). */
const romanUpper = (s: string) =>
  s.replace(/\b([IVXLCivxlc]{2,8})\b/g, (w, _m, at: number) => {
    if (!/^(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i.test(w) || !/^[IVXL]/.test(w)) return w;
    // Words that are also names or ordinary words ("Ill", "Li", "Liv", "Xi") only after "Chapter", "Book"…
    if (/^(Ill|Li|Liv|Lix|Xi)$/.test(w) && !/(Chapter|Book|Part|Letter|Canto|Section|Act|Scene|Volume|Stave)\s$/i.test(s.slice(0, at))) return w;
    return w.toUpperCase();
  });
const titleCase = (s: string) => (isUpperish(s) && s.length > 3 ? romanUpper(s.toLowerCase().replace(/(^|[\s(“"'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(Of|The|And|A|An|In|On|To|For|With|At|By|From)\b/g, (w, _a, i) => (i ? w.toLowerCase() : w))) : romanUpper(s));

function numberWord(s: string) {
  const u = s.toUpperCase();
  if (/^\d+$/.test(u)) return Number(u);
  if (/^[IVXLCDM]+$/.test(u)) return roman(u);
  const w = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN", "TWENTY"];
  const i = w.indexOf(u);
  if (i > 0) return i;
  const ord = ["", "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH", "THIRTEENTH", "FOURTEENTH", "FIFTEENTH", "SIXTEENTH", "SEVENTEENTH", "EIGHTEENTH", "NINETEENTH", "TWENTIETH"].indexOf(u);
  return ord > 0 ? ord : NaN;
}

/** Normalised for comparing a contents entry with a heading line: letters and digits only. */
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[_=*]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/** A contents line → its title (no page number, dot leaders or "I." / "CHAPTER I." / "01" in front). */
function tocTitle(line: string) {
  return line
    .replace(/\s*(\.\s*){2,}\s*\d*\s*$/, "")
    .replace(/\s{2,}\d{1,4}\s*$/, "")
    .replace(/\s+\d{1,4}\s*$/, (m) => (/\D/.test(line.replace(m, "")) ? "" : m))
    .replace(new RegExp(`^\\s*((${WORDS})\\s+)?(${NUM})\\b[.:—\\-]?\\s*`, "i"), "")
    .replace(/^\s*\d{1,3}\s+/, "")
    .trim();
}
const LOWER_WORDS = /^(PART|BOOK|VOLUME)\s/i;

/** Split a book's text into chapters. */
export function findChapters(body: string, opts: { poem?: boolean; title?: string; whole?: boolean; noOpening?: boolean } = {}): Found {
  const warnings: string[] = [];
  // Cut what follows the story: "THE END", footnotes, index (only in the last stretch of the book).
  const tailAt = (re: RegExp) => {
    const m = [...body.matchAll(re)].pop();
    return m && m.index! > body.length * 0.75 ? m.index! : -1;
  };
  // "End of the Project Gutenberg EBook of …" (older files put it before the end marker): cut there.
  const pgEnd = body.search(/^\s*\**\s*End of (the |this )?Project Gutenberg/im);
  if (pgEnd > 0) body = body.slice(0, pgEnd);
  // THE END / FINIS (in capitals), then little more: the story is over. Footnotes / index after it go too.
  for (const re of [/^\s*(THE END|FINIS)\.?\s*$/gm, /^\s*(FOOTNOTES?|INDEX|ENDNOTES)\s*:?\s*$/gm]) {
    const at = tailAt(re);
    if (at > 0 && body.length - at < Math.max(20_000, body.length * 0.08)) body = body.slice(0, re.source.includes("THE END") ? body.indexOf("\n", at) + 1 || body.length : at);
  }
  const lines = body.split("\n");
  // "CHAPTER" on one line and its number on the next ("CHAPTER\n   1"): one heading line.
  for (let i = 0; i < lines.length - 1; i++) {
    if (!new RegExp(`^\\s*(${WORDS})\\s*$`, "i").test(lines[i])) continue;
    const j = lines[i + 1].trim() ? i + 1 : i + 2;
    if (j < lines.length && new RegExp(`^\\s*(${NUM})\\.?\\s*$`, "i").test(lines[j])) {
      lines[i] = `${lines[i].trim()} ${lines[j].trim()}`;
      lines[j] = "";
    }
  }
  const blankBefore = (i: number) => i === 0 || !lines[i - 1].trim();

  const paras = (from: number, to: number) => {
    const blocks = lines.slice(from, to).join("\n").split(/\n\s*\n/);
    const out: string[] = [];
    for (const b of blocks) {
      const c = cleanBlock(b);
      const first = c.trim().split("\n")[0]?.trim() ?? "";
      if (!c.trim() || SEPARATOR.test(c.trim()) || NOISE.test(first) || /^\[\d+\]|^Footnote\b/i.test(first)) continue;
      const p = toParagraph(c, !!opts.poem);
      if (!p) continue;
      // A poem printed without blank lines: break it into stanzas of about 12–24 lines at sentence ends.
      const ls = p.split("\n");
      if (ls.length > 30) {
        let cur: string[] = [];
        for (const l of ls) {
          cur.push(l);
          if ((cur.length >= 12 && /[.!?;:]["’”)]?$/.test(l)) || cur.length >= 24) {
            out.push(cur.join("\n"));
            cur = [];
          }
        }
        if (cur.length) out.push(cur.join("\n"));
      } else if (p.length > 4000 && !p.includes("\n")) {
        const sentences = p.match(/[^.!?]+[.!?]+["’”)]*\s*|[^.!?]+$/g) ?? [p];
        let cur = "";
        for (const x of sentences) {
          if (cur.length + x.length > 2200 && cur) {
            out.push(cur.trim());
            cur = "";
          }
          cur += x;
        }
        if (cur.trim()) out.push(cur.trim());
      } else out.push(p);
    }
    // A contents list left at the start of a chapter (most of its lines look like chapter entries).
    return out.filter((p) => {
      const ls = p.split(/\n| {3,}/).filter(Boolean);
      return !(ls.length >= 4 && ls.filter((l) => WORD_HEAD.test(l) || ROMAN_TITLE.test(l) || /\s(\.\s*){2,}\d+\s*$|\s\d{1,4}\s*$/.test(l)).length / ls.length > 0.6);
    });
  };
  /** Chapters longer than a phone reads comfortably → parts of about 60k characters. */
  const finish = (chs: { title: string; paras: string[] }[], how: string): Found => {
    const out: { title: string; paras: string[] }[] = [];
    for (const [ci, c] of chs.entries()) {
      // Gutenberg's own notes at the end are not a chapter.
      if (/transcriber/i.test(c.title) && ci >= chs.length - 2) continue;
      // A picture caption taken for a heading: a plain chapter number instead.
      if (/^\[?\s*illustration\b/i.test(c.title)) c.title = `Chapter ${ci + 1}`;
      c.title = c.title.replace(/^\p{Ll}/u, (ch) => ch.toUpperCase()); // "the juniper-tree" → "The juniper-tree"
      // The next section's name left at the end of a chapter ("Inferno", "PURGATORIO" in the Divine Comedy).
      while (c.paras.length > 1 && /^(INFERNO|PURGATORIO|PARADISO|HELL|PURGATORY|PARADISE)$/i.test(c.paras[c.paras.length - 1].trim())) c.paras.pop();
      const size = c.paras.join(" ").length;
      if (size <= 110_000) {
        out.push(c);
        continue;
      }
      const n = Math.ceil(size / 60_000);
      const per = size / n;
      let cur: string[] = [];
      let len = 0;
      let part = 1;
      for (const p of c.paras) {
        cur.push(p);
        len += p.length;
        if (len >= per && part < n) {
          out.push({ title: `${c.title} (part ${part})`, paras: cur });
          cur = [];
          len = 0;
          part++;
        }
      }
      if (cur.length) out.push({ title: part > 1 ? `${c.title} (part ${part})` : c.title, paras: cur });
    }
    return { chapters: out, how, warnings };
  };

  // Books whose "headings" are really short entries (maxims, recipes, numbered paragraphs, jokes): the
  // text in order, split into parts by length, every line kept.
  if (opts.whole) return finish([{ title: opts.title ?? "The Text", paras: paras(0, lines.length) }], "whole");
  /* 1. The book's own table of contents: find each listed title, in order, as a heading in the text. */
  let tocRange: [number, number] | null = null;
  let tocResult: { starts: { line: number; skip: number; title: string; upper?: string }[]; tocEnd: number; coverage: number } | null = null;
  const tocAt = lines.findIndex((l, i) => i < lines.length * 0.3 && /^\s*(CONTENTS|Contents|TABLE OF CONTENTS|Table of Contents)\b[.:]?(\s+(OF\s+)?(VOLUME|VOL\.|PART|BOOK)\s+\S+)?\s*$/.test(l));
  if (tocAt >= 0) {
    const entries: { title: string; upper: boolean }[] = [];
    let blanks = 0;
    let seen = 0;
    const seenLines = new Set<string>();
    let i = tocAt + 1;
    for (; i < lines.length && i < tocAt + 500; i++) {
      const l = lines[i];
      if (!l.trim()) {
        if (++blanks >= 4 && seen) break;
        continue;
      }
      blanks = 0;
      seen++;
      const entryLike = WORD_HEAD.test(l) || ROMAN_TITLE.test(l) || /\s(\.\s*){2,}\d*\s*$|\s{2,}\d{1,4}\s*$/.test(l);
      if (!entryLike && (l.trim().length > 100 || (/[a-z][.!?]["’”]?$/.test(l.trim()) && l.trim().length > 60))) break; // prose: the contents list is over
      if (/^\s*(Page|PAGE|Chapter|CHAPTER|CHAP\.)\s*$/.test(l)) continue;
      let t = tocTitle(l);
      if (t.length < 2 || !norm(t) || new RegExp(`^(${WORDS})$`, "i").test(t)) t = l.trim().replace(/\s*(\.\s*){2,}\s*\d*\s*$|\s{2,}\d{1,4}\s*$/, "");
      // An entry seen before ("VOLUME ONE", "Chapter 1. Marseilles" again): the book itself has begun.
      // (the whole line, number included: Moby-Dick has two chapters called "Knights and Squires")
      if (norm(l) && seenLines.has(norm(l))) {
        while (i > tocAt + 1 && !lines[i - 1].trim()) i--; // the list ends at the blank lines before it
        break;
      }
      seenLines.add(norm(l));
      if (t.length >= 2 && norm(t) && !/^(page|index|contents)$/i.test(t)) entries.push({ title: t, upper: LOWER_WORDS.test(l.trim()) });
    }
    const tocEnd = i;
    tocRange = [tocAt, tocEnd];
    const chapterEntries = entries.filter((e) => !e.upper);
    if (chapterEntries.length >= 3) {
      const starts: { line: number; skip: number; title: string; upper?: string }[] = [];
      let at = tocEnd;
      let upper = "";
      for (const e of entries) {
        const want = norm(e.title);
        for (let j = at; j < lines.length; j++) {
          const l = lines[j].trim();
          if (!l || l.length > 120 || !blankBefore(j)) continue;
          const n = norm(tocTitle(l));
          const n2 = norm(l);
          let skip = 1;
          let hit = n === want || n2 === want;
          // "I." / "CHAPTER I." on one line, the title on the next.
          if (!hit && (ROMAN_ALONE.test(l) || NUM_ALONE.test(l) || WORD_HEAD.test(l))) {
            let k = j + 1;
            while (k < lines.length && k < j + 4 && !lines[k].trim()) k++;
            if (norm(tocTitle(lines[k] ?? "")) === want) {
              hit = true;
              skip = k - j + 1;
            }
          }
          if (hit) {
            if (e.upper) upper = titleCase(tidyTitle(e.title));
            else starts.push({ line: j, skip, title: titleCase(tidyTitle(e.title)), upper: upper || undefined });
            at = j + skip;
            break;
          }
        }
      }
      if (starts.length >= Math.max(3, chapterEntries.length * 0.6)) {
        tocResult = { starts, tocEnd, coverage: starts.length / chapterEntries.length };
      }
    }
    // Only a contents list that matched the book's chapters marks text to skip: one of bare numerals
    // ("I", "II") isn't recognised, and the scan above may have run on into chapter one.
    if (!tocResult) tocRange = null;
  }
  const fromContents = (): Found | null => {
    if (!tocResult) return null;
    const { starts, tocEnd } = tocResult;
    {
      {
        const chs: { title: string; paras: string[] }[] = [];
        // Text before the first chapter after the contents list: a preface or introduction, if real.
        const pre = paras(tocEnd, starts[0].line);
        if (pre.join(" ").length >= 1500 && /^(PREFACE|INTRODUCTION|FOREWORD|PROLOGUE|TO THE READER|AUTHOR)/i.test(norm(lines.slice(tocEnd, starts[0].line).join(" ").trim()).toUpperCase())) {
          chs.push({ title: "Preface", paras: pre });
        }
        starts.forEach((s, k) => {
          const ps = paras(s.line + s.skip, starts[k + 1]?.line ?? lines.length);
          if (ps.length) chs.push({ title: s.upper ? `${s.upper} · ${s.title}` : s.title, paras: ps });
        });
        return finish(chs, "contents");
      }
    }
  };
  // Both methods are tried; the one that finds more chapters wins (contents on a tie: it has the real titles).

  /* 2. Headings: CHAPTER I, LETTER 2, STAVE ONE, ACT II, "I. A SCANDAL IN BOHEMIA", numbers, titles in capitals. */
  const heads: Head[] = [];
  lines.forEach((l, i) => {
    if (tocRange && i >= tocRange[0] && i < tocRange[1]) return; // a line of the contents list
    // "Inferno" on one line, "Canto I" on the next (the Italian Divine Comedy).
    const cc = /^\s*Canto\s+([IVXLC]+)\.?\s*$/i.exec(l);
    const cantica = /^\s*(Inferno|Purgatorio|Paradiso)\s*$/i.exec(lines[i - 1] ?? "");
    if (cc && cantica && blankBefore(i - 1)) return void heads.push({ line: i, family: "CANTO", label: `${titleCase(cantica[1])}, Canto ${roman(cc[1])}`, title: "" });
    if (!blankBefore(i) || l.length > 90) return;
    let m = /^\s*(?:(Inferno|Purgatorio|Purgatory|Paradiso|Paradise|Hell)\s*[:.,•·—-]?\s*)Canto\s+([IVXLC]+)\b\.?\s*$/i.exec(l);
    if (m) return void heads.push({ line: i, family: "CANTO", label: `${titleCase(m[1])}, Canto ${roman(m[2])}`, title: "" });
    m = WORD_HEAD.exec(l);
    if (m) {
      const fam = m[1].toUpperCase().replace(/\.$/, "").replace("CHAP", "CHAPTER").replace("CHAPTERTER", "CHAPTER").replace(/^CAP[IÍ]TU?LO$|^KAPITEL$|^CAPITOLO$|^FEDERALIST$|^PAPER$/, "CHAPTER");
      heads.push({ line: i, family: fam === "LETTER" ? "CHAPTER" : fam, label: `${titleCase(m[1].replace(/\.$/, ""))} ${numberWord(m[2]) || m[2]}`, title: tidyTitle(m[3] ?? "") });
      return;
    }
    if ((m = ROMAN_TITLE.exec(l))) return void heads.push({ line: i, family: "ROMAN", label: m[1], title: titleCase(tidyTitle(m[2])) });
    if ((m = ROMAN_ALONE.exec(l))) return void heads.push({ line: i, family: "ROMAN", label: m[1], title: "" });
    if ((m = NUM_ALONE.exec(l))) return void heads.push({ line: i, family: "NUM", label: m[1], title: "" });
    if ((m = /^\s*(\d{1,3})\.?\s{1,8}([A-Z][^.!?]{2,70})$/.exec(l))) return void heads.push({ line: i, family: "NUM", label: m[1], title: tidyTitle(m[2]) });
    if ((m = CAPS_TITLE.exec(l)) && (i + 1 >= lines.length || !lines[i + 1].trim()) && !/^(THE END|CONTENTS|FINIS|PREFACE|INTRODUCTION)/.test(m[1])) {
      heads.push({ line: i, family: "CAPS", label: "", title: titleCase(tidyTitle(m[1])) });
    }
  });
  const textAfter = (hs: Head[], k: number) => lines.slice(hs[k].line + 1, hs[k + 1]?.line ?? lines.length).join("\n");
  const real = (fam: string) => {
    const hs = heads.filter((h) => h.family === fam);
    return { hs, n: hs.filter((_, k) => textAfter(hs, k).replace(/\s+/g, " ").length >= 700).length };
  };
  const counts = Object.fromEntries(["CHAPTER", "STAVE", "CANTO", "ADVENTURE", "ACT", "LECTURE", "ESSAY", "TALE", "STORY", "SECTION", "BOOK", "PART", "VOLUME", "ROMAN", "NUM", "CAPS"].map((f) => [f, real(f)]));
  const ok = (f: string) => counts[f].n >= 3 && counts[f].n <= 700;
  const named = ["CHAPTER", "STAVE", "CANTO", "ADVENTURE", "ACT", "LECTURE", "ESSAY", "TALE", "STORY", "SECTION"].filter(ok).sort((a, b) => counts[b].n - counts[a].n);
  const numeric = ["ROMAN", "NUM"].filter(ok).sort((a, b) => counts[b].n - counts[a].n);
  const upperFams = ["BOOK", "PART", "VOLUME"].filter(ok).sort((a, b) => counts[b].n - counts[a].n);
  let fam: string | null = named[0] ?? null;
  // Bare numbers / numerals win when there are clearly more of them (chapters numbered without the word).
  if (numeric[0] && (!fam || counts[numeric[0]].n > counts[fam].n * 1.5)) fam = numeric[0];
  // Books / parts only when there is nothing finer.
  if (!fam && upperFams[0]) fam = upperFams[0];
  if (!fam && ok("CAPS")) fam = "CAPS";
  if (!fam && tocResult) return fromContents()!;
  if (!fam) {
    const all = paras(0, lines.length);
    // No headings: one piece (a long one is split into parts by size).
    if (all.join(" ").length > 300_000) warnings.push("no chapter headings found: split into parts by length");
    return finish([{ title: opts.title ?? "The Text", paras: all }], "whole");
  }
  const hs = counts[fam].hs;
  // Book / part / volume headings name the chapters under them, when a chapter heading follows soon after
  // (not "BOOK I. (Folio)" inside a chapter's text).
  const upper =
    fam !== "BOOK" && fam !== "PART" && fam !== "VOLUME" && fam !== "CAPS"
      ? heads.filter((h) => ["BOOK", "PART", "VOLUME"].includes(h.family) && hs.some((c) => c.line > h.line && c.line - h.line <= 15))
      : [];
  const chapters: { title: string; paras: string[] }[] = [];
  let firstReal = hs.findIndex((_, k) => textAfter(hs, k).replace(/\s+/g, " ").length >= 700);
  // Numbered chapters start at 1: a "Chapter 74" before a later "Chapter 1" is the end of a contents list.
  const numOf = (h: Head) => numberWord(h.label.split(" ").pop() ?? "");
  if (numOf(hs[firstReal]) > 1) {
    const one = hs.findIndex((h, k) => k > firstReal && numOf(h) === 1 && textAfter(hs, k).replace(/\s+/g, " ").length >= 700);
    if (one > 0) firstReal = one;
  }
  const front = lines.slice(0, hs[firstReal].line).join("\n");
  const pre = /^\s*(PREFACE|INTRODUCTION|FOREWORD|PROLOGUE|AUTHOR['’]S PREFACE|TO THE READER|PRELUDE)\b.*$/im.exec(front);
  if (pre) {
    const start = front.slice(0, pre.index).split("\n").length;
    const ps = paras(start, hs[firstReal].line).filter((p) => !/^(CHAPTER|CHAP\.)\s/i.test(p));
    if (ps.join(" ").length >= 800) chapters.push({ title: titleCase(tidyTitle(pre[1])), paras: ps });
  } else {
    // Text before the first heading that isn't called a preface (a book's first story or chapter without a
    // heading of its kind): kept as its own first section, not lost.
    const ps = paras(tocRange ? tocRange[1] : 0, hs[firstReal].line).filter((p) => !/^(CHAPTER|CHAP\.)\s/i.test(p));
    // (not a leftover contents list: most of its lines would be "Canto XIII. …" / "Chapter 4" entries)
    const ls = ps.flatMap((p) => p.split(/\n| {3,}/));
    const listy = ls.filter((l) => new RegExp(`^\\s*(${WORDS})\\b`, "i").test(l) || ROMAN_TITLE.test(l) || /^\s*[IVXLC]+\.\s/.test(l)).length;
    // (a contents list run together into paragraphs: many bare numbers, "4 The Story of… 13 Richard Talketh…")
    const words = ps.join(" ").split(/\s+/);
    const numbers = words.filter((w) => /^(\d{1,3}|[IVXLC]{1,6})[.:]?$/.test(w)).length;
    if (!opts.noOpening && ps.join(" ").length >= 3000 && listy < ls.length * 0.25 && numbers < words.length * 0.04) chapters.push({ title: "Opening pages", paras: ps });
  }
  for (let k = firstReal; k < hs.length; k++) {
    const h = hs[k];
    const end = hs[k + 1]?.line ?? lines.length;
    let start = h.line + 1;
    let title = h.title;
    if (!title) {
      let j = start;
      while (j < end && !lines[j].trim()) j++;
      const cand = lines[j]?.trim() ?? "";
      const after = lines[j + 1]?.trim() ?? "";
      if (cand && cand.length <= 80 && !/^[\[\](_*“"‘'«]/.test(cand) && !/[,;]$/.test(cand) && !/[a-z]\.$/.test(cand) && (isUpperish(cand) || !after) && !/^[a-z]/.test(cand)) {
        title = titleCase(tidyTitle(cand));
        start = j + 1;
      }
    }
    // A long title wrapped onto the next lines (in capitals, then a blank line): keep all of it.
    if (title) {
      const block: string[] = [];
      let k = start;
      while (k < end && block.length < 3 && lines[k].trim() && lines[k].trim().length <= 80 && isUpperish(lines[k].trim())) block.push(lines[k++].trim());
      if (block.length && (k >= end || !lines[k].trim())) {
        // The title's own line, without its "CHAPTER V." / "IV." / "12." in front.
        const own = title === h.title ? lines[h.line].trim().replace(new RegExp(`^(?:(?:${WORDS})\\s+(?:the\\s+|No\\.?\\s*)?(?:${NUM})|[IVXLC]+|\\d{1,3})\\b[.:—-]?\\s*`, "i"), "") : lines[start - 1].trim();
        const whole = own + " " + block.join(" ");
        title = titleCase(tidyTitle(whole));
        start = k;
      }
    }
    const ps = paras(start, end);
    if (ps.join(" ").length < 120) continue; // a contents line that slipped through
    if (/^(page|index|general index)$/i.test(title.trim())) continue; // an index, not a chapter
    const up = upper.filter((u) => u.line < h.line).pop();
    const n = numberWord(h.label.split(" ").pop() ?? "");
    const word = h.label.split(" ")[0];
    const label = h.label && fam !== "CAPS" ? (["CHAPTER", "ROMAN", "NUM"].includes(fam) ? (n ? `${/^[A-Za-z]+$/.test(word) && !/^[IVXLC]+$/.test(word) ? titleCase(word) : "Chapter"} ${n}` : titleCase(h.label)) : h.label) : "";
    const name = [up ? up.label : "", title && title !== label ? title : label].filter(Boolean).join(" · ");
    chapters.push({ title: name || `Part ${chapters.length + 1}`, paras: ps });
  }
  // Numbering that starts again ("Chapter 1" … "Chapter 12", then "Chapter 1" again, in a book of epochs or
  // volumes without a recognised heading for them): number the runs, "Part 2 · Chapter 1".
  // Only a real restart counts (another "Chapter 1"); chapters before the first one (a preface) keep their title.
  const isOne = (t: string) => /^(Chapter|Letter|Section) (1|I)$/.test(t);
  if (chapters.filter((c) => isOne(c.title)).length > 1) {
    let part = 0;
    for (const c of chapters) {
      if (isOne(c.title)) part++;
      if (part > 0) c.title = `Part ${part} · ${c.title}`;
    }
  }
  const byHeadings = finish(chapters, fam);
  const byContents = fromContents();
  // Count only chapters with real text: a contents list matched against a second list (of illustrations,
  // say) gives many one-line "chapters" and one huge last one.
  // A result where one chapter holds over half the book (the rest one-liners) scores as one chapter.
  const solid = (f: Found) => {
    const sizes = f.chapters.map((c) => c.paras.join(" ").length);
    const total = sizes.reduce((a, b) => a + b, 0);
    // (a long chapter is already cut into "… (part 2)": add its parts back up)
    const byTitle = new Map<string, number>();
    f.chapters.forEach((c, i) => byTitle.set(c.title.replace(/ \(part \d+\)$/, ""), (byTitle.get(c.title.replace(/ \(part \d+\)$/, "")) ?? 0) + sizes[i]));
    if (f.chapters.length > 5 && Math.max(...byTitle.values()) > total * 0.5) return 1;
    return sizes.filter((s) => s >= 300).length;
  };
  const best = byContents && solid(byContents) >= solid(byHeadings) ? byContents : byHeadings;
  // Never lose text: the chapters must hold at least 90% of the book's (cleaned) letters. If not, the other
  // method; if that loses text too, the whole book in order, split into parts by length.
  const letters = (s: string) => (s.match(/\p{L}/gu) ?? []).length;
  const kept = (f: Found) => f.chapters.reduce((n, c) => n + letters(c.paras.join(" ")), 0);
  const all = paras(0, lines.length);
  const total = letters(all.join(" "));
  if (kept(best) >= total * 0.9) return best;
  const other = best === byContents ? byHeadings : byContents;
  if (other && kept(other) >= total * 0.9) return other;
  warnings.push(`chapters would keep only ${Math.round((100 * kept(best)) / Math.max(1, total))}% of the text: split into parts by length`);
  return finish([{ title: opts.title ?? "The Text", paras: all }], "whole");
}

/* ---------- main ---------- */

/** A catalog title → a display title: "Frankenstein; or, The modern Prometheus" → "Frankenstein". */
function autoTitle(t: string) {
  let s = t.replace(/\s+/g, " ").trim();
  const cut = s.split(/;\s|:\s|\s—\s|,\s+or,?\s|\s+Or,\s/i)[0];
  if (cut.length >= 3) s = cut;
  s = s.replace(/[,.]?\s*(—|-)?\s*Complete\.?$/i, "").replace(/\.$/, "").trim();
  // Sentence case in the catalog ("The call of the wild") → title case.
  if (s === s.slice(0, 1) + s.slice(1).toLowerCase() || /^[a-z]/.test(s))
    s = s.replace(/(^|[\s(“"'-])(\p{L})(\p{L}*)/gu, (m, a, b, c, i) => (i && /^(of|the|and|a|an|in|on|to|for|with|at|by|from|or|nor|but)$/.test(b + c) ? m : a + b.toUpperCase() + c));
  return s;
}
/** "Verne, Jules, 1828-1905" → [1828, 1905]. */
function lifespan(authors: string): [number, number] | null {
  const m = /(\d{3,4})\??\s*-\s*(\d{3,4})/.exec(authors.split(";")[0]);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

type ShelfOut = { id: string; name: string; collections: { id: string; name: string; items: Record<string, unknown>[] }[] };

async function main() {
  const raw = JSON.parse(await readFile(path.join(ROOT, "data", "literature-list.json"), "utf8")) as List & { shelves?: { id: string; name: string; collections: List["collections"] }[] };
  const shelvesIn = raw.shelves ?? [{ id: "literature", name: "Literature", collections: raw.collections }];
  const pg = await catalogRows();
  const only = new Set(process.argv.slice(2).map(Number).filter(Boolean));
  const catalogPath = path.join(ROOT, "data", "catalog.json");
  const report: string[] = [];
  const works: { id: string; name: string; versification: string }[] = [];
  const versions: Record<string, unknown>[] = [];
  /** Each Gutenberg book is imported once, however many shelves it is on. */
  const done = new Map<number, { work: string; bookSlug: string; title: string; chapters: number } | null>();
  const slugOwner = new Map<string, number>();
  const shelvesOut: ShelfOut[] = [];

  for (const sh of shelvesIn) {
    const out: ShelfOut = { id: sh.id, name: sh.name, collections: [] };
    for (const col of sh.collections) {
      const items: Record<string, unknown>[] = [];
      for (const e of col.books) {
        if (!done.has(e.gid)) done.set(e.gid, await importBook(e, col.name));
        const b = done.get(e.gid);
        if (b) items.push({ id: b.bookSlug, name: b.title, work: b.work, chapters: b.chapters, chapterName: b.title });
      }
      if (items.length) out.collections.push({ id: col.id, name: col.name, items });
    }
    shelvesOut.push(out);
  }

  async function importBook(e: Entry, colName: string) {
    const [nameOverride, knownYear] = META[e.gid] ?? [null, 0];
    const title = e.name ?? nameOverride ?? autoTitle(e.title);
    const { author, translator } = people(e.author);
    let bookSlug = slug(title) || `book-${e.gid}`;
    if (slugOwner.has(bookSlug) && slugOwner.get(bookSlug) !== e.gid) bookSlug = `${bookSlug}-${slug(author.split(/\s+/).pop() ?? String(e.gid)) || e.gid}`.slice(0, 48);
    if (slugOwner.has(bookSlug) && slugOwner.get(bookSlug) !== e.gid) bookSlug = `${bookSlug}-${e.gid}`;
    slugOwner.set(bookSlug, e.gid);
    const work = `lit-${bookSlug}`;
    const life = lifespan(e.author);
    const year = knownYear || (life ? life[1] : 1900);
    const yearNote = knownYear ? undefined : life ? `author lived ${life[0]}–${life[1]}` : "date of first publication not recorded";
    const files = e.group ?? [e.gid];
    const editions: { gid: number; lang: string; author: string; translator?: string }[] = [{ gid: e.gid, lang: e.lang.split(";")[0].trim(), author, translator }];
    for (const a of e.also ?? []) {
      const c = pg.get(a)!;
      const p = people(c.authors);
      editions.push({ gid: a, lang: c.lang, author: p.author, translator: p.translator });
    }
    let mainCount = 0;
    let mainTitles: string[] = [];
    for (const [ei, ed] of editions.entries()) {
      const version = `pg${ed.gid}`;
      let found: Found;
      if (ei === 0 && e.group) {
        // Several short books read as one: each is a chapter.
        const chapters: { title: string; paras: string[] }[] = [];
        for (const g of files) {
          const t = await bookText(g);
          if (!t || isCopyrighted(t)) continue;
          const f = findChapters(gutenbergBody(t));
          chapters.push({ title: autoTitle(pg.get(g)?.title ?? `Tale ${chapters.length + 1}`), paras: f.chapters.flatMap((c) => c.paras) });
        }
        found = { chapters, how: "group", warnings: [] };
      } else {
        const t = await bookText(ed.gid);
        if (!t) {
          report.push(`${String(ed.gid).padStart(6)} ${title}: NO PLAIN TEXT on the mirror, skipped`);
          if (ei === 0) return null;
          continue;
        }
        if (isCopyrighted(t)) {
          report.push(`${String(ed.gid).padStart(6)} ${title}: COPYRIGHTED (not public domain), skipped`);
          if (ei === 0) return null;
          continue;
        }
        found = findChapters(gutenbergBody(t), { poem: [1322, 26, 58, 1004, 1000, 16328, 39784, 26197].includes(ed.gid), whole: [132, 14986, 10136, 44833, 20352].includes(ed.gid), noOpening: ei > 0, title }); // a second edition lines up chapter by chapter
      }
      if (!found.chapters.length) {
        report.push(`${String(ed.gid).padStart(6)} ${title}: no text found, skipped`);
        if (ei === 0) return null;
        continue;
      }
      // The original-language edition sits beside the English chapter by chapter. The English may open
      // with a translator's introduction or preface the original doesn't have: those chapters are skipped.
      let offset = 0;
      if (ei > 0 && found.chapters.length !== mainCount) {
        const lead = mainTitles.findIndex((x) => !/^(Preface|Introduction|Translator|Author|Prologue|Dedication)/i.test(x));
        if (lead > 0 && found.chapters.length === mainCount - lead) offset = lead;
        else {
          report.push(`  ${ed.gid} (${ed.lang}) skipped: ${found.chapters.length} chapters vs ${mainCount} in the English`);
          continue;
        }
      }
      if (ei === 0) {
        mainCount = found.chapters.length;
        mainTitles = found.chapters.map((c) => c.title);
      }
      if (!only.size || only.has(e.gid)) {
        await resetVersion(work, version);
        // Chapters only the English has (a translator's introduction): a note in their place.
        for (let i = 1; i <= offset; i++) await writeChapter(work, version, bookSlug, i, [], `“${mainTitles[i - 1]}” is only in the English edition.`, mainTitles[i - 1]);
        for (const [i, c] of found.chapters.entries()) {
          const verses: Verse[] = c.paras.map((x, k) => ({ v: String(k + 1), t: x }));
          await writeChapter(work, version, bookSlug, i + 1 + offset, verses, undefined, c.title);
        }
      }
      const by = ed.translator ? `${ed.author}, translated by ${ed.translator}` : ed.author;
      versions.push({
        id: version,
        work,
        abbr: (ed.translator ?? ed.author).split(/\s+/).pop()!.replace(/[^\p{L}'-]/gu, "") || "Gutenberg",
        name: `${title} (${by})`,
        language: ed.lang,
        kind: "native",
        dir: "ltr",
        year,
        ...(yearNote ? { yearNote } : {}),
        translator: ed.translator ?? `${ed.author} (written in ${ed.lang === "en" ? "English" : "the original language"})`,
        license: "Public Domain",
        attribution: `${by}, ${title}; public domain in the US; text from Project Gutenberg #${ed.gid}.`,
        sourceUrl: `https://www.gutenberg.org/ebooks/${ed.gid}`,
        licensed: false,
        versification: work,
        author: ed.author,
        ...(ed.translator ? { translatorName: ed.translator } : {}),
      });
      const paraCount = found.chapters.reduce((n, c) => n + c.paras.length, 0);
      report.push(
        `${String(ed.gid).padStart(6)} ${colName.padEnd(15).slice(0, 15)} ${title.slice(0, 40).padEnd(40)} ${String(found.chapters.length).padStart(4)} ch ${String(paraCount).padStart(6)} ¶  [${found.how}]${found.warnings.length ? "  ⚠ " + found.warnings.join("; ") : ""}`,
      );
    }
    if (!mainCount) return null;
    works.push({ id: work, name: title, versification: work });
    return { work, bookSlug, title, chapters: mainCount };
  }

  // The shelves live in their own compact file (src/lib/catalog.ts expands it), so the main catalog stays
  // small for scripture tools and the browser downloads about a fifth of the bytes.
  let text = (await readFile(catalogPath, "utf8")).replace(/\r\n/g, "\n");
  text = text.replace(/^ {4}\{ "id": "lit-[^\n]*\n/gm, "").replace(/^ {4}\{ "id": "pg\d+", "work": "lit-[^\n]*\n/gm, "");
  const at = Math.min(...["literature", "fiction"].map((id) => text.indexOf(`,\n    {\n      "id": "${id}"`)).filter((n) => n >= 0), Infinity);
  if (at !== Infinity) text = text.slice(0, at) + text.slice(text.lastIndexOf("\n  ]\n}"));
  text = text.replace(/,(\n {2}\],\n {2}"(versions|religions)")/g, "$1");
  JSON.parse(text);
  await writeFile(catalogPath, text);
  const byWork = new Map(works.map((w) => [w.id, w]));
  const books = works.map((w) => {
    const vs = versions.filter((v) => v.work === w.id) as { id: string; language: string; abbr: string; year: number; yearNote?: string; author: string; translatorName?: string }[];
    const item = shelvesOut.flatMap((sh) => sh.collections.flatMap((c) => c.items)).find((it) => it.work === w.id)!;
    return [w.id, item.id, w.name, item.chapters, vs.map((v) => [Number(v.id.slice(2)), v.language, v.abbr, v.year, v.author, v.translatorName ?? null, v.yearNote ?? null])];
  });
  const lit = {
    $comment:
      "The Literature and Fiction shelves (Project Gutenberg, public domain in the US). Written by scripts/import-literature.ts; expanded into works, versions and shelves by src/lib/catalog.ts. books: [work, book id, title, chapters, editions: [Gutenberg number, language, column label, year, author, translator, year note]].",
    books,
    shelves: shelvesOut.map((sh) => ({ id: sh.id, name: sh.name, collections: sh.collections.map((c) => ({ id: c.id, name: c.name, books: c.items.map((it) => it.work as string).filter((wk) => byWork.has(wk)) })) })),
  };
  await writeFile(path.join(ROOT, "data", "literature-catalog.json"), JSON.stringify(lit).replace(/\],\["lit-/g, '],\n["lit-') + "\n");
  // Text folders of books no longer on a shelf (or renamed) go, so they aren't packed and served.
  if (!only.size) {
    const keepWorks = new Set(works.map((w) => w.id));
    for (const d of await readdir(path.join(ROOT, "data", "texts"))) {
      if (d.startsWith("lit-") && !keepWorks.has(d)) {
        await rm(path.join(ROOT, "data", "texts", d), { recursive: true, force: true });
        report.push(`removed old folder data/texts/${d}`);
      } else if (d.startsWith("lit-")) {
        // An edition dropped from a book (a copyrighted one replaced, say): its folder goes too.
        const keepVersions = new Set(versions.filter((v) => v.work === d).map((v) => String(v.id)));
        for (const v of await readdir(path.join(ROOT, "data", "texts", d))) {
          if (!keepVersions.has(v)) {
            await rm(path.join(ROOT, "data", "texts", d, v), { recursive: true, force: true });
            report.push(`removed old edition data/texts/${d}/${v}`);
          }
        }
      }
    }
  }
  console.log(report.join("\n"));
  console.log(`\n${works.length} books, ${versions.length} editions on ${shelvesOut.length} shelves → data/texts/lit-*, data/catalog.json`);
}

if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
