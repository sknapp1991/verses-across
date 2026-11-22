/**
 * World religions beyond the first six: public-domain (or freely licensed) texts, each with its own
 * small parser. Sources are cached in data/raw/<dir>. Project Gutenberg files are used where they
 * exist (sacred-texts.com now turns automated downloads away).
 *
 *   npx tsx scripts/import-world.ts            (all)
 *   npx tsx scripts/import-world.ts ttc aqdas  (some)
 *
 *   ttc         Tao Te Ching — James Legge (1891), Gutenberg #216; Chinese text, Gutenberg #24039
 *   analects    Analects of Confucius — James Legge (1893) with the Chinese, Gutenberg #4094
 *   australian  Australian Legendary Tales — K. Langloh Parker (1896), Gutenberg #3833
 *   hidden      The Hidden Words — Bahá'u'lláh (Bahá'í Reference Library text), Gutenberg #16941
 *   aqdas       The Kitáb-i-Aqdas — Bahá'u'lláh (Bahá'í Reference Library text), Gutenberg #16523
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { cached, decodeEntities, gutenbergBody, numbered, resetVersion, ROOT, roman, sacredTextsGz, writeChapter, type Verse } from "./lib/world";

const GUT = (id: number) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
const report = (name: string, chapters: number, verses: number) => console.log(`${name.padEnd(12)} ${chapters} chapters, ${verses} verses`);
/** Hard-wrapped lines → one line. */
const unwrap = (s: string) => s.replace(/\s+/g, " ").trim();
/** Blank-line separated paragraphs. */
const paras = (s: string) => s.split(/\n\s*\n/).map(unwrap).filter(Boolean);
const NUM = "一二三四五六七八九";
/** Chinese numerals 一 … 九十九, also 廿 (20), 卅 (30) and positional 四七 (47). */
const cn = (raw: string) => {
  const s = raw.replace("廿", "二十").replace("卅", "三十");
  const d = (c: string) => NUM.indexOf(c) + 1;
  const t = s.indexOf("十");
  if (t < 0) return s.length === 2 ? d(s[0]) * 10 + d(s[1]) : d(s);
  return (t === 0 ? 1 : d(s[0])) * 10 + (t < s.length - 1 ? d(s[t + 1]) : 0);
};

/**
 * The sources' few misprinted chapter numbers (two "XVII"s, "XXXII" for XXIII): a number that breaks
 * the run, where the next one carries it on, is the one in between.
 */
function sequential(list: Verse[]) {
  const out: Verse[] = [];
  list.forEach((x, i) => {
    const prev = out.length ? Number(out[out.length - 1].v) : 0;
    const next = i + 1 < list.length ? Number(list[i + 1].v) : NaN;
    const n = Number(x.v);
    out.push((n !== prev + 1 && next === prev + 2) || n <= prev ? { ...x, v: String(prev + 1) } : x);
  });
  return out;
}

/** Tao Te Ching: 81 chapters with Legge's verse numbers; the Chinese chapter spans them all. */
async function ttc() {
  const txt = gutenbergBody(await cached("ttc", "pg216.txt", GUT(216)));
  const body = txt.slice(txt.indexOf("PART 1."));
  const chunks = body.split(/\n{3,}/).map((c) => c.trim()).filter((c) => /^(Ch\. )?\d+\./.test(c));
  await resetVersion("tao-te-ching", "legge-ttc");
  const counts = new Map<number, number>();
  let total = 0;
  for (const c of chunks) {
    const ch = Number(/^(?:Ch\. )?(\d+)\./.exec(c)![1]);
    const rest = c.replace(/^(?:Ch\. )?\d+\.\s*/, "");
    const verses: Verse[] = [];
    // "1. text" paragraphs; a bare "3." is followed by its verse (a rhyme) in the next paragraph.
    let pending: string | null = null;
    for (const p of rest.split(/\n\s*\n/)) {
      const m = /^(\d+)\.\s*([\s\S]*)$/.exec(p.trim());
      if (m) {
        const t = unwrap(m[2]);
        if (t) verses.push({ v: m[1], t });
        else pending = m[1];
      } else if (pending) {
        verses.push({ v: pending, t: unwrap(p) });
        pending = null;
      } else if (verses.length) verses[verses.length - 1].t += ` ${unwrap(p)}`;
      else verses.push({ v: "1", t: unwrap(p) }); // a chapter in one piece
    }
    counts.set(ch, verses.length);
    total += verses.length;
    await writeChapter("tao-te-ching", "legge-ttc", "ttc", ch, verses);
  }
  report("ttc legge", chunks.length, total);

  const zh = gutenbergBody(await cached("ttc", "pg24039.txt", GUT(24039)));
  await resetVersion("tao-te-ching", "ttc-zh");
  let z = 0;
  for (const m of zh.matchAll(/第([一二三四五六七八九十]+)章\n([\s\S]*?)(?=\n第[一二三四五六七八九十]+章|$)/g)) {
    const ch = cn(m[1]);
    const t = m[2].replace(/\s+/g, "").trim();
    if (!t) continue;
    const n = counts.get(ch) ?? 1;
    await writeChapter("tao-te-ching", "ttc-zh", "ttc", ch, [{ v: "1", t, ...(n > 1 ? { to: String(n) } : {}) }]);
    z++;
  }
  report("ttc zh", z, z);
}

/** Analects: 20 books (chapters here), Legge's numbered chapters as verses; Chinese alongside. */
async function analects() {
  const txt = gutenbergBody(await cached("analects", "pg4094.txt", GUT(4094)));
  const start = txt.search(/^BOOK I\.\s/m);
  const books = txt.slice(start).split(/^BOOK ([IVXL]+)\.[^\n]*\n/m);
  const cjk = /[㐀-鿿　-〿＀-￯【】]/;
  await resetVersion("analects", "legge-an");
  await resetVersion("analects", "analects-zh");
  let ve = 0;
  let vz = 0;
  for (let i = 1; i < books.length; i += 2) {
    const book = roman(books[i]);
    const lines = books[i + 1].split("\n");
    const en = lines.filter((l) => !cjk.test(l)).join("\n");
    const zh = lines.filter((l) => cjk.test(l)).join("");
    const verses: Verse[] = [];
    for (const m of en.matchAll(/CHAP(?:TER|\.)\s+([IVXL]+)\.\s*([\s\S]*?)(?=CHAP(?:TER|\.)\s+[IVXL]+\.|$)/g)) {
      const t = unwrap(m[2]);
      if (t) verses.push({ v: String(roman(m[1])), t });
    }
    await writeChapter("analects", "legge-an", "analects", book, sequential(verses));
    ve += verses.length;
    // Chinese: 【第二章】 starts chapter 2; text before the first marker is chapter 1; 【一節】 marks dropped.
    const zv: Verse[] = [];
    const segs = zh.split(/【第?([一二三四五六七八九十廿卅]+)章】/); // 【第二章】, 【十四章】, 【廿三章】
    const clean = (s: string) => s.replace(/【[^】]*】/g, "").replace(/\s+/g, "").trim();
    if (clean(segs[0])) zv.push({ v: "1", t: clean(segs[0]) });
    for (let k = 1; k < segs.length; k += 2) {
      const t = clean(segs[k + 1]);
      if (t) zv.push({ v: String(cn(segs[k])), t });
    }
    await writeChapter("analects", "analects-zh", "analects", book, sequential(zv));
    vz += zv.length;
  }
  report("analects", (books.length - 1) / 2, ve);
  report("analects zh", (books.length - 1) / 2, vz);
}

/** Australian Legendary Tales: the 31 tales as chapters, paragraphs as verses. */
async function australian() {
  const txt = gutenbergBody(await cached("australian", "pg3833.txt", GUT(3833)));
  const contents = txt.slice(txt.indexOf("CONTENTS"), txt.indexOf("GLOSSARY", txt.indexOf("CONTENTS")));
  const titles = [...contents.matchAll(/^\s*(\d+)\s+(.+)$/gm)].map((m) => m[2].trim());
  await resetVersion("australian", "parker");
  let at = txt.indexOf("GLOSSARY", txt.indexOf("CONTENTS"));
  let total = 0;
  for (let i = 0; i < titles.length; i++) {
    // In the body each tale starts "12.  THE MAYAMAH".
    const s = txt.slice(at).search(new RegExp(`^${i + 1}\\.\\s+[A-Z]`, "m"));
    if (s < 0) throw new Error(`tale not found: ${titles[i]}`);
    const begin = at + s + txt.slice(at + s).indexOf("\n");
    const nextHead = i + 1 < titles.length ? new RegExp(`^${i + 2}\\.\\s+[A-Z]`, "m") : /^APPENDIX\s*$/m;
    const end = begin + txt.slice(begin).search(nextHead);
    const list = paras(txt.slice(begin, end)).map((t, k) => ({ v: String(k + 1), t }));
    // "THE GALAH, AND OOLAH THE LIZARD" → "The Galah, and Oolah the Lizard"
    const title = titles[i]
      .toLowerCase()
      .replace(/(^|[\s,(-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
      .replace(/(?<=\S\s)(The|And|Of|A|In)\b/g, (w) => w.toLowerCase());
    await writeChapter("australian", "parker", "alt", i + 1, list, undefined, title);
    total += list.length;
    at = end;
  }
  report("australian", titles.length, total);
  return titles;
}

/** The Hidden Words: Part I (from the Arabic, 71) and Part II (from the Persian, 82). */
async function hidden() {
  const txt = gutenbergBody(await cached("bahai", "pg16941.txt", GUT(16941)));
  const p1 = txt.indexOf("PART I.--FROM THE ARABIC");
  const p2 = txt.indexOf("PART II--FROM THE PERSIAN");
  if (p1 < 0 || p2 < 0) throw new Error("Hidden Words: parts not found");
  await resetVersion("hidden-words", "bahai-hw");
  let total = 0;
  for (const [ch, part] of [
    [1, txt.slice(p1, p2)],
    [2, txt.slice(p2)],
  ] as const) {
    const items = part.split(/^"(\d+): [\s\S]*?"\s*$/m);
    const preamble = paras(items[0].replace(/^PART[^\n]*\n/, "").replace(/^\s*Preamble\s*$/m, ""))
      .map((t) => t.replace(/^_|_$/g, ""))
      .join(" ");
    const verses: Verse[] = [];
    for (let k = 1; k < items.length; k += 2) {
      const t = paras(items[k + 1])
        .filter((x) => !/^(Footnotes?|Notes?)$/i.test(x))
        .join(" ")
        .replace(/_/g, "");
      if (t) verses.push({ v: items[k], t });
    }
    // The last verse runs on into the closing words of the book; that's part of the text.
    await writeChapter("hidden-words", "bahai-hw", "hw", ch, verses, preamble || undefined);
    total += verses.length;
  }
  report("hidden", 2, total);
}

/** The Kitáb-i-Aqdas: its 190 numbered paragraphs (one chapter). */
async function aqdas() {
  const txt = gutenbergBody(await cached("bahai", "pg16523.txt", GUT(16523)));
  const a = txt.search(/^THE KITAB-I-AQDAS\s*$/m);
  const b = txt.search(/^SOME TEXTS REVEALED BY BAHA'U'LLAH/m);
  const body = txt.slice(a, b);
  const verses: Verse[] = [];
  for (const m of body.matchAll(/^(\d+) ([\s\S]*?)(?=^\d+ |$(?![\s\S]))/gm)) {
    const t = unwrap(m[2]).replace(/\s?#\d+/g, ""); // note numbers ("garment #4")
    verses.push({ v: m[1], t });
  }
  const nums = verses.map((v) => Number(v.v));
  if (nums.some((n, i) => n !== i + 1)) throw new Error(`Aqdas numbering off near ${nums.find((n, i) => n !== i + 1)}`);
  await resetVersion("aqdas", "bahai-aqdas");
  await writeChapter("aqdas", "bahai-aqdas", "aqdas", 1, verses);
  report("aqdas", 1, verses.length);
}

/** Raag sections → books; the short opening prayers, the Svaiyay and the closing saloks are grouped. */
const GGS_GROUP: Record<string, string> = {
  Jap: "Opening Banis (Japji, So Dar, Sohila)",
  "So Dar": "Opening Banis (Japji, So Dar, Sohila)",
  "So Purakh": "Opening Banis (Japji, So Dar, Sohila)",
  Sohila: "Opening Banis (Japji, So Dar, Sohila)",
  "Salok Sehshkritee": "Salok Sehshkritee, Gaathaa, Phunhay",
  "Gaathaa Fifth Mehl": "Salok Sehshkritee, Gaathaa, Phunhay",
  "Phunhay Fifth Mehl": "Salok Sehshkritee, Gaathaa, Phunhay",
  "Salok Vaaran Thay Vadheek": "Closing Saloks and Raagmala",
  "Salok Ninth Mehl": "Closing Saloks and Raagmala",
  Raagmala: "Closing Saloks and Raagmala",
};
const ggsBook = (raag: string) => GGS_GROUP[raag] ?? (raag.startsWith("Svaiyay") ? "Svaiyay (of the Bhatts)" : raag);
const slug = (t: string) => t.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Sri Guru Granth Sahib in Gurmukhi and Dr. Sant Singh Khalsa's English, from Open Granth's corpus
 * (github.com/opengranth/open-granth, itself from the Shabad OS database). Book = raag section;
 * chapter = one ang (page), titled "Ang 359"; verse = line (pankti). → data/ggs-books.json
 */
async function ggs() {
  await resetVersion("ggs", "ggs-gurmukhi");
  await resetVersion("ggs", "khalsa");
  let total = 0;
  const books: { id: string; name: string; chapters: number; first: number }[] = [];
  const strip = (s: string) => s.replace(/^\*\*|\*\*$/g, "").trim();
  for (let ang = 1; ang <= 1430; ang++) {
    const name = `ang-${String(ang).padStart(4, "0")}.md`;
    const md = await cached("ggs", name, `https://raw.githubusercontent.com/opengranth/open-granth/main/corpus/${name}`);
    const raag = /^raag:\s*(.+)$/m.exec(md)?.[1].trim() ?? "";
    const bookName = ggsBook(raag);
    if (books[books.length - 1]?.name !== bookName) books.push({ id: slug(bookName), name: bookName, chapters: 0, first: ang });
    const book = books[books.length - 1];
    book.chapters++;
    const body = md.replace(/^---[\s\S]*?\n---\n/, "");
    const pa: Verse[] = [];
    const en: Verse[] = [];
    for (const block of body.split(/\n---\n/)) {
      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("<!--"));
      const g = lines.find((l) => l.startsWith("**"));
      if (!g) continue;
      const rest = lines.filter((l) => !l.startsWith("**") && !(l.startsWith("*") && l.endsWith("*")));
      const v = String(pa.length + 1);
      pa.push({ v, t: strip(g) });
      en.push({ v, t: rest.join(" ") || "—" });
    }
    await writeChapter("ggs", "ggs-gurmukhi", book.id, book.chapters, pa, undefined, `Ang ${ang}`);
    await writeChapter("ggs", "khalsa", book.id, book.chapters, en, undefined, `Ang ${ang}`);
    total += pa.length;
  }
  await writeFile(path.join(ROOT, "data", "ggs-books.json"), JSON.stringify(books, null, 1) + "\n");
  report("ggs", 1430, total);
  console.log(`  ${books.length} books → data/ggs-books.json`);
}

// ── Philosophy & secular thought ─────────────────────────────────────────────────────────────────

/** Split a text at heading lines; returns each heading's capture and the text up to the next one. */
function sections(text: string, head: RegExp) {
  const re = new RegExp(head.source, head.flags.includes("g") ? head.flags : head.flags + "g");
  const marks = [...text.matchAll(re)];
  return marks.map((m, i) => ({ head: m[1] ?? m[0], body: text.slice(m.index! + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined) }));
}
/** Footnote lines ("    [A] Xenophon…") and markers ("father,[B]") out. */
const noNotes = (s: string) => s.replace(/^[ \t]+\[[A-Z0-9]+\][^\n]*(\n[ \t]+[^\n]+)*/gm, "").replace(/\[[A-Z]\]/g, "");

/**
 * Analects — William Jennings (1895), Gutenberg #10056 ("Chinese Literature"; the Analects part). Read on LibriVox,
 * so it carries a human voice. Jennings doesn't number the sayings: each paragraph is a verse here, numbered in order
 * (they don't line up with Legge's chapter numbers).
 */
async function analectsJennings() {
  const txt = gutenbergBody(await cached("analects", "pg10056.txt", GUT(10056)));
  const at = txt.search(/^BOOK I\s*$/m);
  const rest = txt.slice(at);
  const books = sections(rest.slice(0, rest.search(/^THE SAYINGS OF MEN[CI]+US\s*$/m)), /^BOOK ([IVXL]+)\s*$/m);
  await resetVersion("analects", "jennings");
  let total = 0;
  for (const b of books) {
    const body = b.body.replace(/\[Footnote[^\]]*\]/g, "").replace(/\[\d+\]/g, "").replace(/_/g, "");
    const list = paras(body);
    const title = list.shift()?.replace(/:?--$/, ""); // "On Learning--Miscellaneous Sayings"
    // A paragraph per verse (Jennings runs many sayings together inside one quotation, so quote marks can't
    // separate them); a lead-in ("A saying of the Scholar Yu:--") joins the paragraph after it.
    const sayings: string[] = [];
    for (const t of list) {
      const prev = sayings[sayings.length - 1];
      if (prev !== undefined && /:--$/.test(prev)) sayings[sayings.length - 1] = `${prev} ${t}`;
      else sayings.push(t);
    }
    const verses = sayings.map((t, i) => ({ v: String(i + 1), t }));
    await writeChapter("analects", "jennings", "analects", roman(b.head), verses, undefined, title);
    total += verses.length;
  }
  report("analects jennings", books.length, total);
}

/** Meditations — George W. Chrystal (1902), Gutenberg #55317, read on LibriVox. Numbered like Long's. */
async function meditationsChrystal() {
  const txt = gutenbergBody(await cached("secular", "pg55317.txt", GUT(55317)));
  const books = sections(txt, /^\s+BOOK ([IVX]+)\.\s*$/m);
  await resetVersion("meditations", "chrystal");
  let total = 0;
  for (const b of books) {
    const body = b.body.replace(/^\s+END OF THE [A-Z]+ BOOK\.\s*$/m, "").replace(/\s*THE END\.\s*$/, "").replace(/_/g, "");
    const verses: Verse[] = [];
    for (const p of paras(body)) {
      const m = /^(\d+)\.\s+([\s\S]*)$/.exec(p);
      if (m) verses.push({ v: m[1], t: m[2] });
      else if (verses.length) verses[verses.length - 1].t += ` ${p}`;
    }
    // Book I runs sections 1-4 on in one paragraph ("... anger. 2. In the famous memory ..."): split at the next number.
    for (let i = 0; i < verses.length; i++) {
      const next = String(Number(verses[i].v) + 1);
      if (verses[i + 1]?.v === next) continue;
      const m = new RegExp(`^([\\s\\S]*?[.;:!?])\\s+${next}\\.\\s+([\\s\\S]*)$`).exec(verses[i].t);
      if (m) verses.splice(i, 1, { v: verses[i].v, t: m[1] }, { v: next, t: m[2] });
    }
    await writeChapter("meditations", "chrystal", "med", roman(b.head), sequential(verses));
    total += verses.length;
  }
  report("meditations chrystal", books.length, total);
}

/** Lucretius, On the Nature of Things — William Ellery Leonard (1916), Gutenberg #785. Books I–VI. */
async function lucretius() {
  const txt = gutenbergBody(await cached("secular", "pg785.txt", GUT(785)));
  const books = sections(txt, /^BOOK ([IVX]+)\s*$/m);
  await resetVersion("lucretius", "leonard");
  let total = 0;
  for (const b of books) {
    // Paragraphs of verse; the section headings ("PROEM", "SUBSTANCE IS ETERNAL") are left out.
    const list = paras(b.body)
      .filter((p) => !/^[A-Z][A-Z\s,'’.-]+$/.test(p))
      .map((t, i) => ({ v: String(i + 1), t }));
    await writeChapter("lucretius", "leonard", "dnr", roman(b.head), list);
    total += list.length;
  }
  report("lucretius", books.length, total);
}

/** Marcus Aurelius, Meditations — George Long (1862), Gutenberg #15877. 12 books, numbered sections. */
async function meditations() {
  const txt = gutenbergBody(await cached("secular", "pg15877.txt", GUT(15877)));
  const start = txt.indexOf("THE THOUGHTS", txt.indexOf("THE THOUGHTS", txt.indexOf("INDEX OF TERMS")) + 1);
  const at = start > 0 ? start : txt.lastIndexOf("THE THOUGHTS\n");
  const end = txt.search(/^INDEXES\.\s*$/m);
  const books = sections(txt.slice(at, end > at ? end : undefined), /^([IVX]+)\.\s*$/m);
  await resetVersion("meditations", "long");
  let total = 0;
  for (const b of books) {
    const verses: Verse[] = [];
    for (const p of noNotes(b.body).split(/\n\s*\n/)) {
      const t = unwrap(p);
      if (!t) continue;
      const m = /^(\d+)\.\s+([\s\S]*)$/.exec(t);
      if (m) verses.push({ v: m[1], t: m[2] });
      else if (!verses.length) verses.push({ v: "1", t });
      else verses[verses.length - 1].t += ` ${t}`;
    }
    await writeChapter("meditations", "long", "med", roman(b.head), sequential(verses));
    total += verses.length;
  }
  report("meditations", books.length, total);
}

/** Epictetus, The Enchiridion — Thomas W. Higginson (1865), Gutenberg #45109. 53 sections, one chapter. */
async function enchiridion() {
  const txt = gutenbergBody(await cached("secular", "pg45109.txt", GUT(45109)));
  let body = txt.slice(txt.search(/^\s+THE ENCHIRIDION\s*$/m));
  body = body.slice(0, body.search(/^\s+Footnotes\s*$/m));
  // This edition's 51 sections ("XXIX[2]" carries a note mark).
  const secs = sections(body, /^\s+([IVXL]+)(?:\[\d+\])?\s*$/m);
  const verses = secs
    .map((s) => ({ v: String(roman(s.head)), t: paras(noNotes(s.body)).join(" ").replace(/\[\d+\]/g, "").replace(/_/g, "") }))
    .filter((v) => v.t);
  await resetVersion("enchiridion", "higginson");
  await writeChapter("enchiridion", "higginson", "ench", 1, sequential(verses));
  report("enchiridion", 1, verses.length);
}

/** David Hume, Dialogues Concerning Natural Religion (1779), Gutenberg #4583. 12 parts. */
async function hume() {
  const txt = gutenbergBody(await cached("secular", "pg4583.txt", GUT(4583)));
  const parts = sections(txt, /^PART (\d+)\s*$/m);
  await resetVersion("hume-dialogues", "hume");
  let total = 0;
  for (const p of parts) {
    const list = paras(p.body).map((t, i) => ({ v: String(i + 1), t }));
    await writeChapter("hume-dialogues", "hume", "dnr-hume", Number(p.head), list);
    total += list.length;
  }
  report("hume", parts.length, total);
}

/** Thomas Paine, The Age of Reason (1794–95), Gutenberg #3743. Part I and Part II as two books. */
async function paine() {
  const txt = gutenbergBody(await cached("secular", "pg3743.txt", GUT(3743)));
  const heads = [...txt.matchAll(/^CHAPTER I\.\s*$/gm)].map((m) => m.index!);
  if (heads.length < 2) throw new Error("Age of Reason: parts not found");
  const partText = [txt.slice(heads[0], heads[1]), txt.slice(heads[1])];
  await resetVersion("age-of-reason", "paine");
  let total = 0;
  for (const [k, t] of partText.entries()) {
    const chs = sections(t, /^CHAPTER ([IVXL]+)\.\s*$/m);
    for (const c of chs) {
      // The chapter's title is its first line; then paragraphs.
      const ps = paras(c.body.replace(/^[^\n]*\S[^\n]*\n/, ""));
      const title = unwrap(c.body.trim().split("\n")[0]);
      const list = ps
        .filter((x, i) => !(i === 0 && x === title) && !/^(The End|END OF)/i.test(x))
        .map((x, i) => ({ v: String(i + 1), t: x.replace(/_/g, "") }));
      if (!list.length) continue;
      await writeChapter("age-of-reason", "paine", k === 0 ? "aor1" : "aor2", roman(c.head), list, undefined, title);
      total += list.length;
    }
  }
  report("paine", 2, total);
}

// ── From sacred-texts zipped texts (downloaded by hand into data/raw) ────────────────────────────────

/** Title-case an ALL-CAPS heading ("THE ISLAND OF ONOGORO" → "The Island of Onogoro"). */
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s(-])(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase())
    .replace(/(?<=\S\s)(The|And|Of|A|An|In|To|On|At|By|With|From|For|As|Upon|Or|Is)\b/g, (w) => w.toLowerCase());

/** Kojiki — Basil Hall Chamberlain (1882; 1919 reprint), sacred-texts kj.txt.gz. 180 sections. */
async function kojiki() {
  const p = await sacredTextsGz("kojiki", "kj.txt.gz");
  const end = p.findIndex((x) => /^APPENDIX I\.?$/.test(x));
  const body = p.slice(0, end > 0 ? end : undefined);
  // Headings vary: "[SECT. XIII.--…]", "[SECT XV.--…]", "SECT. XXVII.--…", "[SECT. CXX: …", one with no number.
  const HEAD = /^\[?SECT\.?\s*([IVXLC]*)\s*[.:]?\s*[-—]*\s*([A-Z][^a-z]*?)\.?\]?$/;
  const heads = body.map((x, i) => [i, x] as const).filter(([, x]) => HEAD.test(x));
  await resetVersion("kojiki", "chamberlain");
  let total = 0;
  let prev = 0;
  for (const [k, [at, head]] of heads.entries()) {
    const m = HEAD.exec(head)!;
    // Misprinted numbers in the source ("XLI" for LXI, a second "CXXXV"): a number that goes backwards is the next one.
    const printed = m[1] ? roman(m[1]) : 0;
    const ch = printed > prev ? printed : prev + 1;
    // A section whose heading the source lost (XVIII): its text stays with the one before.
    for (let gap = prev + 1; gap < ch; gap++)
      await writeChapter("kojiki", "chamberlain", "kojiki", gap, [], `Section ${gap} has no heading in the source text; it is included in Section ${gap - 1}.`);
    const title = titleCase(m[2]);
    const paras = body.slice(at + 1, k + 1 < heads.length ? heads[k + 1][0] : undefined).filter((x) => !/^\[?VOL(UME)?\.? [IVX]+/i.test(x));
    await writeChapter("kojiki", "chamberlain", "kojiki", ch, numbered(paras), undefined, title);
    total += paras.length;
    prev = ch;
  }
  report("kojiki", prev, total);
}

const ORD = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH", "THIRTEENTH", "FOURTEENTH", "FIFTEENTH", "SIXTEENTH", "SEVENTEENTH", "EIGHTEENTH", "NINETEENTH"];
const TENS: Record<string, number> = { TWENTY: 20, THIRTY: 30, TWENTIETH: 20, THIRTIETH: 30 };
/** "TWENTY-FIRST" → 21, "SIXTH" → 6 */
function ordinal(w: string) {
  const [a, b] = w.split("-");
  if (b) return (TENS[a] ?? 0) + ORD.indexOf(b) + 1;
  return TENS[a] ?? ORD.indexOf(a) + 1;
}
/** Lines that only structure the Jaina books ("FIRST LESSON.", "CALLED", "SECOND BOOK", "PAGE"). */
const jainaStructure = (x: string) =>
  /^(\(?CALLED\)?|PAGE|([A-Z-]+ )?(LESSON|CHAPTER|PART|BOOK)\.?|[A-Z-]+ (LESSON|CHAPTER|PART|BOOK)[.,]?)$/.test(x);

/**
 * The lectures of a Jaina book as chapters: from paragraph `from` to `to`, a new chapter at each
 * "FIRST LECTURE," line; its title is the next heading line ("KNOWLEDGE OF THE WEAPON.").
 */
async function jainaBook(p: string[], from: number, to: number, work: string, book: string, prefix = (n: number) => `Lecture ${n}`) {
  const LECT = /^([A-Z]+(?:-[A-Z]+)?) LECTURE[,.]?$/;
  let ch = 0;
  let total = 0;
  let verses: string[] = [];
  let title = "";
  const flush = async () => {
    if (!ch) return;
    await writeChapter(work, "jacobi", book, ch, numbered(verses), undefined, title);
    total += verses.length;
  };
  for (let i = from; i < to; i++) {
    const x = p[i];
    if (LECT.test(x)) {
      await flush();
      ch++;
      verses = [];
      let j = i + 1;
      while (j < to && /^\(?CALLED\)?$/.test(p[j])) j++;
      // Some lectures have a name line ("KNOWLEDGE OF THE WEAPON."), others go straight into the text.
      const named = j < to && p[j].length < 90 && !/[a-z]/.test(p[j]);
      title = named ? `${prefix(ch)}: ${titleCase(p[j].replace(/\.$/, ""))}` : prefix(ch);
      i = named ? j : j - 1;
      continue;
    }
    if (!ch || jainaStructure(x) || (x.length < 70 && !/[a-z]/.test(x))) continue; // headings
    verses.push(x);
  }
  await flush();
  report(`${work}/${book}`, ch, total);
}

/** Jaina Sutras — Hermann Jacobi (SBE 22, 1884 and SBE 45, 1895), sacred-texts sbe22/sbe45.txt.gz. */
async function jaina() {
  await resetVersion("jaina", "jacobi");
  const a = await sacredTextsGz("jaina", "sbe22.txt.gz");
  // Body starts at the second "AKARANGA SUTRA." (the first is in the contents).
  const akStart = a.indexOf("AKARANGA SUTRA.", a.indexOf("AKARANGA SUTRA.") + 1);
  const kalpa = a.indexOf("KALPA SUTRA.", akStart);
  // Book I has 8 lectures (the 7th is lost; Jacobi numbers on), Book II 16.
  await jainaBook(a, akStart, kalpa, "jaina", "akaranga", (n) => (n <= 8 ? `Book I, Lecture ${n}` : `Book II, Lecture ${n - 8}`));
  // Kalpa Sutra: its three parts.
  const parts = ["LIVES OF THE GINAS", "LIST OF THE STHAVIRAS", "RULES FOR YATIS"].map((h) => a.findIndex((x, i) => i > kalpa && x.startsWith(h)));
  const end = a.findIndex((x, i) => i > parts[2] && /^INDEX/.test(x));
  let total = 0;
  for (const [k, at] of parts.entries()) {
    const list = a.slice(at + 1, parts[k + 1] ?? (end > 0 ? end : undefined)).filter((x) => !jainaStructure(x) && !/^[A-Z .,'-]+$/.test(x));
    await writeChapter("jaina", "jacobi", "kalpa", k + 1, numbered(list), undefined, titleCase(a[at].replace(/\.$/, "")));
    total += list.length;
  }
  report("jaina/kalpa", 3, total);

  const b = await sacredTextsGz("jaina", "sbe45.txt.gz");
  const utStart = b.indexOf("UTTARADHYAYANA.", b.indexOf("UTTARADHYAYANA.") + 1);
  const suStart = b.indexOf("SUTRAKRITANGA.", b.indexOf("SUTRAKRITANGA.") + 1);
  const suEnd = b.findIndex((x, i) => i > suStart && /^INDEX OF NAMES/.test(x));
  await jainaBook(b, utStart, suStart, "jaina", "uttaradhyayana");
  // Sutrakritanga: Book I has 16 lectures, Book II 7 — numbered straight through, labelled by book.
  await jainaBook(b, suStart, suEnd > 0 ? suEnd : b.length, "jaina", "sutrakritanga", (n) => (n <= 16 ? `Book I, Lecture ${n}` : `Book II, Lecture ${n - 16}`));
  void ordinal;
}

/** Vishnu Purana — H. H. Wilson (1840), archive.sacred-texts.com hin/vp/vp.txt.gz (fetched in the browser,
 * Skylar OK'd Nov 19). Six books, 126 chapters; the chapter's summary line is its title (shortened), paragraphs are
 * verses. Wilson's preface, footnotes, page numbers and the index are left out. */
async function vishnuPurana() {
  const p = await sacredTextsGz("vishnu-purana", "vp.txt.gz", { footnoteBlocks: true });
  const BOOK = /^BOOK ([IVX]+)\.?$/;
  // The body starts at the second "BOOK I." (the first is in the table of contents) and ends at the index.
  const starts = p.map((x, i) => [i, x] as const).filter(([, x]) => x === "BOOK I." || x === "BOOK I");
  const from = starts[starts.length - 1][0];
  const end = p.findIndex((x, i) => i > from && /^INDEX\.?$/.test(x));
  const body = p.slice(from, end > 0 ? end : undefined);
  await resetVersion("vishnu-purana", "wilson-vp");
  let book = 0;
  let total = 0;
  let chapters = 0;
  const heads = body.map((x, i) => [i, x] as const).filter(([, x]) => BOOK.test(x) || /^CHAP\.? ?[IVXL]+\.?$/.test(x));
  for (const [k, [at, head]] of heads.entries()) {
    if (BOOK.test(head)) {
      book = roman(BOOK.exec(head)![1]);
      continue;
    }
    const ch = roman(/^CHAP\.? ?([IVXL]+)/.exec(head)![1]);
    const stop = k + 1 < heads.length ? heads[k + 1][0] : body.length;
    const summary = body[at + 1] ?? "";
    // "Invocation. Maitreya inquires of … Vishnu the origin … of all things." → its first sentence as the title.
    const first = summary.split(/(?<=[a-z\])])(?<!\bviz|&c|\bp)\.\s/)[0].replace(/\.$/, "");
    const title = first.length > 90 ? first.slice(0, first.lastIndexOf(" ", 88)) + "…" : first;
    // Page numbers ("[p. 666]") out; a line that starts in lower case continues the paragraph a page break cut.
    const paras: string[] = [];
    for (const raw of body.slice(at + 2, stop)) {
      const x = raw
        .replace(/\s*\[p\. ?[\divxl]+\]\s*/gi, " ")
        .replace(/,?\s*<page \d+>\.?/g, "")
        .replace(/(\w)- (\w)/g, "$1-$2") // "counter- acting", "Veda- vyasa": the hyphen stays, the space goes
        .replace(/\s+([,;:])/g, "$1")
        // Slips in the transcription, checked against the printed edition's sequence:
        .replace("in the sixteenth, Dhananjaya; in the, Kritanjaya", "in the sixteenth, Dhananjaya; in the seventeenth, Kritanjaya")
        .replace(/root out the nine Nandas$/, "root out the nine Nandas.")
        .trim();
      if (!x || /^VISHNU PURANA\.?$/.test(x)) continue;
      // Wilson appends material from other works under an all-capitals heading ("SACRIFICE OF DAKSHA. (From the
      // Vayu Purana.)" in I, 8; "TOPOGRAPHICAL LISTS," in II, 3; "LEGEND OF PARAS'URAMA. (From the Mahabharata.)" in
      // IV, 7): not the Vishnu Purana, so the chapter ends there.
      if (paras.length && /^[^a-z]{10,}$/.test(x)) break;
      // Cells of Wilson's tables (lists of kings and reigns in IV, 24): bare numbers, single names, "Total".
      if (x.length <= 25 && (/^[\d.]+$/.test(x) || /\d/.test(x) || !/[.,:;!?"')]$/.test(x))) {
        if (process.env.VP_DEBUG) console.log("DROP", x);
        continue;
      }
      if (paras.length && /^[a-z]/.test(x)) paras[paras.length - 1] += ` ${x}`;
      else paras.push(x);
    }
    await writeChapter("vishnu-purana", "wilson-vp", `vp${book}`, ch, numbered(paras), `Summary (Wilson): ${summary.replace(/--P\.\s*<page \d+>\.?$/, "").trim()}`, title);
    total += paras.length;
    chapters++;
  }
  report("vishnu-purana", chapters, total);
}

/** Myths and Legends of China — E. T. C. Werner (1922), sacred-texts mlc.txt.gz. 16 chapters. */
async function chineseMyths() {
  const p = await sacredTextsGz("chinese-myths", "mlc.txt.gz");
  const end = p.findIndex((x) => /^Glossary & Index$/.test(x));
  const heads = p.map((x, i) => [i, x] as const).filter(([i, x]) => /^Chapter [IVXL]+$/.test(x) && (end < 0 || i < end));
  await resetVersion("chinese-myths", "werner");
  let total = 0;
  for (const [k, [at, head]] of heads.entries()) {
    const title = p[at + 1];
    const stop = k + 1 < heads.length ? heads[k + 1][0] : end > 0 ? end : p.length;
    // Sub-headings ("Racial Origin") and picture captions are short lines without a full stop.
    const list = p.slice(at + 2, stop).filter((x) => !(x.length < 70 && !/[.!?:;"')]$/.test(x)));
    await writeChapter("chinese-myths", "werner", "mlc", roman(head.slice(8)), numbered(list), undefined, title);
    total += list.length;
  }
  report("chinese-myths", heads.length, total);
}

/** Yoruba Legends — M. I. Ogumefu (1929, public domain), Global Grey's EPUB edition. 40 tales. */
async function yoruba() {
  const { inflateRawSync } = await import("node:zlib");
  const { readFile } = await import("node:fs/promises");
  const buf = await readFile(path.join(ROOT, "data", "raw", "yoruba", "yoruba-legends.epub"));
  // A tiny ZIP reader: walk the local file headers and inflate each HTML file.
  const files = new Map<string, string>();
  for (let at = 0; buf.readUInt32LE(at) === 0x04034b50; ) {
    const method = buf.readUInt16LE(at + 8);
    const size = buf.readUInt32LE(at + 18);
    const nameLen = buf.readUInt16LE(at + 26);
    const extra = buf.readUInt16LE(at + 28);
    const name = buf.toString("utf8", at + 30, at + 30 + nameLen);
    const data = buf.subarray(at + 30 + nameLen + extra, at + 30 + nameLen + extra + size);
    if (name.endsWith(".html")) files.set(name, (method === 8 ? inflateRawSync(data) : data).toString("utf8"));
    at += 30 + nameLen + extra + size;
  }
  await resetVersion("yoruba", "ogumefu");
  let ch = 0;
  let total = 0;
  for (const [name, html] of [...files].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Headings carry markup for the underdotted letters ("Ol<span>o</span>fin"): tags out, letters kept.
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const h = h1 ? /^(\d+)\.\s*(.*)$/.exec(h1) : null;
    if (!h) continue; // title page, contents, preface
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => decodeEntities(m[1].replace(/<\/?span[^>]*>/gi, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
      .filter(Boolean)
      // The book opens each tale with a word in capitals ("THE ancient King…").
      .map((t, i) => (i === 0 ? t.replace(/^([A-Z])([A-Z]+)\b/, (_, a: string, b: string) => a + b.toLowerCase()) : t));
    ch = Number(h[1]);
    await writeChapter("yoruba", "ogumefu", "yl", ch, numbered(paras), undefined, decodeEntities(h[2]).trim());
    total += paras.length;
    void name;
  }
  report("yoruba", ch, total);
}

/**
 * Zhuangzi — Herbert A. Giles, "Chuang Tzŭ: Mystic, Moralist, and Social Reformer" (1889), Gutenberg
 * #59709. 33 chapters; Giles' indented commentary and chapter "Argument" summaries are left out.
 */
async function zhuangzi() {
  const all = gutenbergBody(await cached("zhuangzi", "pg59709.txt", GUT(59709)));
  const txt = all.slice(0, all.search(/^_INDEX_\s*$/m)); // the index, errata and transcriber's notes follow
  const chs = sections(txt, /^CHAPTER ([IVXL]+)\.\s*$/m);
  await resetVersion("zhuangzi", "giles");
  let total = 0;
  for (const c of chs) {
    const blocks = c.body.split(/\n\s*\n/);
    const title = unwrap(blocks.find((b) => b.trim()) ?? "").replace(/\.$/, "");
    const verses = blocks
      .slice(blocks.findIndex((b) => b.trim()) + 1)
      .filter((b) => b.trim() && !/^[ \t]/.test(b) && !/^\s*_Argument_/.test(b)) // Giles' notes are indented
      .map((b) => unwrap(b).replace(/_/g, "").replace(/\[\d+\]/g, ""))
      .filter((t) => t && !/^(FOOTNOTES?|INDEX)\b/.test(t))
      // A paragraph cut by an indented note ("He who goes to Mang-ts'ang," … "taking three meals…") is one.
      .reduce<string[]>((acc, t) => {
        const prev = acc[acc.length - 1];
        if (prev && (!/[.!?"'’”:)]$/.test(prev) || /^[a-z]/.test(t))) acc[acc.length - 1] = `${prev} ${t}`;
        else acc.push(t);
        return acc;
      }, []);
    if (!verses.length) continue;
    await writeChapter("zhuangzi", "giles", "zhuangzi", roman(c.head), numbered(verses), undefined, titleCase(title));
    total += verses.length;
  }
  report("zhuangzi", chs.length, total);
}

/** Navaho Legends — Washington Matthews (1897), Gutenberg #60165: the Origin Legend's four parts and two more legends. */
async function navaho() {
  const txt = gutenbergBody(await cached("navaho", "pg60165.txt", GUT(60165)));
  const start = txt.search(/^LEGENDS\.\s*$/m);
  const body = txt.slice(start, txt.indexOf("\nNOTES.", start));
  const heads = [
    [/^I\. THE STORY OF THE EMERGENCE\.\s*$/m, "The Origin Legend: The Story of the Emergence"],
    [/^II\. EARLY EVENTS IN THE FIFTH WORLD\.\s*$/m, "The Origin Legend: Early Events in the Fifth World"],
    [/^III\. THE WAR GODS\.\s*$/m, "The Origin Legend: The War Gods"],
    [/^IV\. GROWTH OF THE NAVAHO NATION\.\s*$/m, "The Origin Legend: Growth of the Navaho Nation"],
    [/^NATI'NESTHANI\.\s*$/m, "Nati'nesthani"],
    [/^THE GREAT SHELL OF KINTYÉL\.\s*$/m, "The Great Shell of Kintyél"],
  ] as const;
  const at = heads.map(([re]) => body.search(re));
  if (at.some((x) => x < 0)) throw new Error(`Navaho: heading missing (${at})`);
  await resetVersion("navaho", "matthews");
  let total = 0;
  for (const [k, [, title]] of heads.entries()) {
    const chunk = body.slice(body.indexOf("\n", at[k]), at[k + 1] ?? undefined);
    // Matthews numbers his paragraphs straight through the book ("136."): kept as the verse label.
    const verses: Verse[] = [];
    for (const p of paras(chunk)) {
      const t = p.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
      if (!t || /^[A-Z .'`-]+$/.test(t)) continue; // stray headings
      const m = /^(\d+)\.\s+(.*)$/.exec(t);
      if (m) verses.push({ v: String(verses.length + 1), t: m[2], n: `§${m[1]}` });
      else if (verses.length) verses[verses.length - 1].t += ` ${t}`;
      else verses.push({ v: "1", t });
    }
    await writeChapter("navaho", "matthews", "navaho", k + 1, verses, undefined, title);
    total += verses.length;
  }
  report("navaho", heads.length, total);
}

/** Myths and Legends of the Sioux — Marie L. McLaughlin (1916), Gutenberg #341. One story per chapter. */
async function sioux() {
  const raw = gutenbergBody(await cached("sioux", "pg341.txt", GUT(341)));
  // The transcriber's list of corrections at the end is not part of the book.
  const cut = raw.search(/^\s*Note: I have made the following changes/m);
  const txt = cut >= 0 ? raw.slice(0, cut) : raw;
  // Story titles are lines in capitals after the introduction ("THE PET RABBIT"); a title may wrap.
  const first = txt.search(/^THE PET RABBIT\s*$/m);
  const lines = txt.slice(first).split("\n");
  const stories: { title: string; body: string[] }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const isTitle = /^[A-Z][A-Z ,.'-]{5,}$/.test(l) && (i === 0 || !lines[i - 1].trim());
    if (isTitle) {
      // A wrapped title ("…THE NAME OF THE LONE" / "WARRIOR").
      let title = l;
      while (/^[A-Z][A-Z ,.'-]+$/.test(lines[i + 1]?.trim() ?? "") && lines[i + 1].trim()) title += ` ${lines[++i].trim()}`;
      stories.push({ title, body: [] });
    } else if (stories.length) stories[stories.length - 1].body.push(lines[i]);
  }
  await resetVersion("sioux", "mclaughlin");
  let total = 0;
  for (const [k, s] of stories.entries()) {
    const verses = paras(s.body.join("\n")).map((t, i) => ({ v: String(i + 1), t }));
    await writeChapter("sioux", "mclaughlin", "sioux", k + 1, verses, undefined, titleCase(s.title));
    total += verses.length;
  }
  report("sioux", stories.length, total);
}

/**
 * The Gathas of Zarathustra (Yasna 28–34, 43–51, 53) — L. H. Mills (SBE 31, 1887). Read page by page
 * from sacred-texts in a browser (only the "Translation" part of each page; Mills' commentary and
 * footnotes left out) into data/raw/gathas/gathas-mills.json. Yasna 43 has no verse "11" in that
 * transcription (its text runs on in verse 10).
 */
async function gathas() {
  const { readFile } = await import("node:fs/promises");
  const src = JSON.parse(await readFile(path.join(ROOT, "data", "raw", "gathas", "gathas-mills.json"), "utf8")) as {
    gathas: { yasna: number; title: string; verses: Verse[] }[];
  };
  await resetVersion("gathas", "mills");
  let total = 0;
  for (const [k, g] of src.gathas.entries()) {
    // Mills' heading, first sentence only ("SALVATION IS ANNOUNCED AS UNIVERSAL FOR BELIEVERS. REFLECTIONS …").
    // Two pages lack a usable heading: they get the Gatha's traditional name.
    const NAMED: Record<number, string> = { 47: "The Spenta Mainyu Gatha", 53: "The Vahishtoishti Gatha" };
    const head = NAMED[g.yasna] ?? g.title.split(/\.\s/)[0].replace(/\.$/, "").replace(/\s*\(.*$/, "");
    const title = `Yasna ${g.yasna}${head ? ` — ${titleCase(head)}` : ""}`;
    const note = g.yasna === 43 ? "Verse 11 has no number in this transcription; its text is part of verse 10." : undefined;
    await writeChapter("gathas", "mills", "gathas", k + 1, g.verses.map((v) => ({ v: v.v, t: v.t })), note, title);
    total += g.verses.length;
  }
  report("gathas", src.gathas.length, total);
}

/**
 * Mencius: the Chinese text, all seven books in two parts each (14 chapters; sections as verses),
 * Gutenberg #24178; and James Legge's English for Book I, Part I — the only part on Gutenberg
 * (#10056, "The Sayings of Mencius").
 */
/** [start, end] of commentary passages inside the Gutenberg Mencius (3A:3 and 5A:7), removed whole. */
const ZHU_XI_NOTES: [string, string][] = [
  ["陽虎，陽貨，魯季氏家臣也。", "君子小人，每相反而已矣。"],
  ["林氏曰：", "所論父不得而子之意。"],
];

async function mencius() {
  const zh = gutenbergBody(await cached("mencius", "pg24178.txt", GUT(24178)));
  const parts = sections(zh, /^卷之[一二三四五六七八九十]+(.+)$/m);
  await resetVersion("mencius", "mencius-zh");
  let vz = 0;
  for (const [k, p] of parts.entries()) {
    const secs = p.body.split(/^\s*([一二三四五六七八九十廿卅]+)\s*$/m);
    const verses: Verse[] = [];
    for (let i = 1; i < secs.length; i += 2) {
      let t = secs[i + 1].replace(/\s+/g, "").trim();
      // Two notes from Zhu Xi's commentary slipped into this edition's text; they aren't Mencius.
      for (const [from, to] of ZHU_XI_NOTES) {
        const x = t.indexOf(from);
        const y = x < 0 ? -1 : t.indexOf(to, x);
        if (y >= 0) t = t.slice(0, x) + t.slice(y + to.length);
      }
      if (t) verses.push({ v: String(cn(secs[i])), t });
    }
    await writeChapter("mencius", "mencius-zh", "mencius", k + 1, sequential(verses), undefined, p.head.trim());
    vz += verses.length;
  }
  report("mencius zh", parts.length, vz);

  const en = gutenbergBody(await cached("mencius", "pg10056.txt", GUT(10056)));
  const a = en.indexOf("\nPart I\n", en.indexOf("THE SAYINGS OF MENCIUS\n\n\n\nBOOK I"));
  const b = en.indexOf("[NOTE: _Books II, III, and IV are omitted_]", a);
  // Legge's seven chapters of Book I, Part I each open with a new scene.
  const NEW = /^(When )?Mencius(,)? (went to see|another day)|^King Hwuy of L.ang said|^The king Seuen/;
  const verses: Verse[] = [];
  for (const p of paras(en.slice(a + 8, b))) {
    const t = p.replace(/\s?\[\d+\]/g, "");
    if (!verses.length || NEW.test(t)) verses.push({ v: String(verses.length + 1), t });
    else verses[verses.length - 1].t += ` ${t}`;
  }
  await resetVersion("mencius", "legge-men");
  await writeChapter("mencius", "legge-men", "mencius", 1, verses, "Book I, Part I. The rest of Legge's translation is not available here; see the AI translation for the whole book.");
  for (let ch = 2; ch <= parts.length; ch++)
    await writeChapter("mencius", "legge-men", "mencius", ch, [], "Only Book I, Part I of Legge's translation is available; choose the AI translation for this chapter.");
  report("mencius en", 1, verses.length);
}

/**
 * Popol Vuh — Lewis Spence's retelling of its four books (1908), Gutenberg #56550. Only the retelling;
 * his commentary (from "Cosmogony of the Popol Vuh" on) is left out. Not a full translation.
 */
async function popolVuh() {
  const txt = gutenbergBody(await cached("popol-vuh", "pg56550.txt", GUT(56550)));
  const end = txt.search(/^COSMOGONY OF THE "POPOL VUH"\s*$/m);
  const books = sections(txt.slice(0, end), /^THE (FIRST|SECOND|THIRD|FOURTH) BOOK\s*$/m);
  const ORD2 = ["FIRST", "SECOND", "THIRD", "FOURTH"];
  await resetVersion("popol-vuh", "spence");
  let total = 0;
  for (const b of books) {
    const list = paras(b.body)
      .filter((t) => !/^[A-Z][A-Z ,.'"-]+$/.test(t)) // the "Myth of Vukub-Cakix" sub-heading
      .map((t, i) => ({ v: String(i + 1), t: t.replace(/\s?\[\d+\]/g, "") }));
    const n = ORD2.indexOf(b.head) + 1;
    await writeChapter("popol-vuh", "spence", "popol-vuh", n, list, undefined, `The ${titleCase(b.head)} Book`);
    total += list.length;
  }
  report("popol-vuh", books.length, total);
}

/**
 * The Quran in Spanish — Julio Cortés, from the Tanzil Project's translations (non-commercial use with
 * credit: fine for this free site). data/raw/quran/tanzil-trans/es.cortes.txt, "sura|aya|text" lines;
 * Tanzil's numbering is the site's (Hafs), so it lines up with the Arabic and Pickthall.
 */
async function quranSpanish() {
  const { readFile } = await import("node:fs/promises");
  const txt = await readFile(path.join(ROOT, "data", "raw", "quran", "tanzil-trans", "es.cortes.txt"), "utf8");
  const bySura = new Map<number, Verse[]>();
  for (const line of txt.split(/\r?\n/)) {
    const m = /^(\d+)\|(\d+)\|(.+)$/.exec(line);
    if (!m) continue;
    const list = bySura.get(Number(m[1])) ?? bySura.set(Number(m[1]), []).get(Number(m[1]))!;
    list.push({ v: m[2], t: m[3].trim() });
  }
  await resetVersion("quran", "cortes");
  let total = 0;
  for (const [sura, verses] of bySura) {
    await writeChapter("quran", "cortes", "quran", sura, verses);
    total += verses.length;
  }
  report("quran es", bySura.size, total);
}

/**
 * The Poetic Edda — Henry Adams Bellows (1923), Gutenberg #73533. One chapter per poem (Svipdagsmol keeps
 * its two parts together, as Bellows numbers them straight through; a poem whose numbering restarted at 1
 * would get its own chapter).
 * Verse = Bellows' stanza number; his half-line bars become a wide space and each line stays a line.
 * The manuscript's prose passages are kept, numbered after the stanza they follow ("12a"; before stanza
 * 1: "0", "0a"). Bellows' introductions and his NOTES at the end of each poem are left out.
 */
async function edda() {
  const txt = gutenbergBody(await cached("edda", "pg73533.txt", GUT(73533)));
  const lines = txt.split("\n");
  const start = lines.findIndex((l) => l.trim() === "VOLUSPO");
  const end = lines.findIndex((l, i) => i > start && /^\s*(PRONOUNCING INDEX|INDEX)\s*$/.test(l));
  const body = lines.slice(start, end > 0 ? end : undefined);
  type Poem = { title: string; sub: string; verses: Verse[] };
  const poems: Poem[] = [];
  const caps = (l: string) => /^[A-ZÆØÖÞÐ][A-ZÆØÖÞÐ ,.'’-]{3,}$/.test(l.trim());
  let mode: "skip" | "poem" | "notes" = "skip";
  let cur: Poem | null = null;
  let last = 0; // last stanza number
  let suffix = 0; // prose passages after it
  let blank = 0;
  let para: string[] = [];
  let titleAt = -10; // line of the last poem title (its English subtitle follows within a few lines)
  let speaker = ""; // "Groa spake:" goes on the first line of the next stanza
  // A row of dots marks lines lost from the manuscript: kept as one "…" line. Asterisk rows are dividers.
  const verseLine = (x: string) => (/^[.\s|]+$/.test(x) ? "…" : x.replace(/\s*\|\s*/g, " ").trim());
  const flushProse = () => {
    const t = unwrap(para.join(" "));
    para = [];
    if (!cur || !t || /^[.\s*]+$/.test(t) || /^\([IVXL]+\)$/.test(t)) return;
    if (t.length < 80 && /:$/.test(t)) {
      speaker = speaker ? `${speaker} ${t}` : t;
      return;
    }
    cur.verses.push({ v: `${last}${suffix ? String.fromCharCode(96 + suffix) : ""}`, t });
    suffix++;
  };
  for (let i = 0; i < body.length; i++) {
    const raw = body[i];
    const l = raw.trim();
    if (!l) {
      blank++;
      if (mode === "poem") flushProse();
      // Four blank lines end Bellows' introductory note; the poem follows.
      if (blank >= 4 && mode === "skip" && cur) mode = "poem";
      continue;
    }
    const wasBlank = blank;
    blank = 0;
    // A poem title: capitals, followed within a few lines by INTRODUCTORY NOTE.
    if (caps(l) && body.slice(i + 1, i + 7).some((x) => x.trim() === "INTRODUCTORY NOTE")) {
      if (mode === "poem") flushProse();
      if (cur && !cur.verses.length && i - titleAt <= 4) {
        // The English name under the Norse one ("VOLUSPO" / "THE WISE-WOMAN'S PROPHECY").
        cur.sub = cur.sub || l;
        continue;
      }
      titleAt = i;
      speaker = "";
      cur = { title: l, sub: "", verses: [] };
      poems.push(cur);
      mode = "skip";
      last = 0;
      suffix = 0;
      continue;
    }
    if (l === "NOTES" || l === "NOTE") {
      flushProse();
      mode = "notes";
      continue;
    }
    if (mode === "notes" || mode === "skip") {
      // A second poem after the notes of the first (the Lay of Fjolsvith) — its title has no note of its own.
      if (mode === "notes" && caps(l) && wasBlank >= 2 && /^THE (LAY|BALLAD|POEM|SONG)/.test(l)) {
        cur = { title: l, sub: "", verses: [] };
        poems.push(cur);
        mode = "poem";
        last = 0;
        suffix = 0;
      }
      continue;
    }
    // In a poem: a stanza starts "12.  text | text".
    const m = /^(\d+)\.\s+(.*)$/.exec(raw);
    if (m && Number(m[1]) > last - 5) {
      flushProse();
      const n = Number(m[1]);
      if (n < last && cur && cur.verses.length) {
        // Numbering starts again: a new poem without its own heading line (or with one we skipped).
        cur = { title: `${cur.title} (continued)`, sub: "", verses: [] };
        poems.push(cur);
        suffix = 0;
      }
      const st = [m[2]];
      while (i + 1 < body.length && body[i + 1].trim() && !/^\d+\.\s/.test(body[i + 1])) st.push(body[++i].trim());
      const t = st
        .filter((x) => !/^[\s*]+$/.test(x))
        .map(verseLine)
        .join("\n");
      last = n;
      suffix = 1;
      cur!.verses.push({ v: String(n), t: speaker ? `${speaker}\n${t}` : t });
      speaker = "";
      continue;
    }
    // Indented verse lines with no number continue the last stanza, often after a speaker line
    // (stanza 17 of Svipdagsmol: two lines, "Svipdag spake:", two more lines).
    if (/^\s{4,}\S/.test(raw) || raw.includes("|")) {
      flushProse();
      const st = [l];
      while (i + 1 < body.length && body[i + 1].trim() && !/^\d+\.\s/.test(body[i + 1])) st.push(body[++i].trim());
      const t = st
        .filter((x) => !/^[\s*]+$/.test(x))
        .map(verseLine)
        .join("\n");
      if (!t) continue;
      const prev = cur?.verses[cur.verses.length - 1];
      if (prev && prev.v === String(last)) prev.t += `\n${speaker ? `${speaker}\n` : ""}${t}`;
      else cur?.verses.push({ v: `${last}${suffix ? String.fromCharCode(96 + suffix++) : ""}`, t: speaker ? `${speaker}\n${t}` : t });
      speaker = "";
      continue;
    }
    // A capitals subheading inside a poem ("OF HJORVARTH AND SIGRLIN") is the editor's, not the text's.
    if (caps(l)) continue;
    para.push(l);
  }
  await resetVersion("edda", "bellows");
  let total = 0;
  const kept = poems.filter((p) => p.verses.length);
  for (const [k, p] of kept.entries()) {
    // Bellows' English title, then the Norse name: "The Ballad of the High One (Hovamol)".
    // "HELGAKVITHA HUNDINGSBANA II" → "Helgakvitha Hundingsbana II"; Norse small words stay small ("Brot af …").
    const norse = p.title
      .replace(/\b([A-ZÆØÖÞÐ])([A-ZÆØÖÞÐ’']*)/g, (w: string, a: string, b: string) => (/^[IVX]+$/.test(w) ? w : a + b.toLowerCase()))
      .replace(/(?<=\S )(Af|En|Ok|At)\b/g, (w) => w.toLowerCase())
      .replace(/(?<=\ben )(\p{Lu}\S*)/gu, (w) => w.toLowerCase());
    const title = p.sub ? `${titleCase(p.sub)} (${norse})` : norse.replace(/^The\b/, "The");
    // Any run of spaced dots (lost words, also mid-line: "“.  .  .  .") becomes "…"; repeated "…" lines become one.
    for (const v of p.verses) {
      v.t = v.t
        .split("\n")
        .map((x) => x.replace(/(?:\.\s+){2,}\.?/g, "… ").replace(/(…\s*)+/g, "… ").replace(/\s+$/, "").replace(/…\s+(?=[”’])/g, "…"))
        .filter((x, j, a) => !(j > 0 && /^[“”‘’\s]*…$/.test(x) && /^[“”‘’\s]*…$/.test(a[j - 1])))
        .join("\n");
    }
    await writeChapter("edda", "bellows", "poetic-edda", k + 1, p.verses, undefined, title);
    total += p.verses.length;
  }
  report("edda", kept.length, total);
}

/**
 * The Prose Edda — Snorri Sturluson, tr. Rasmus B. Anderson (The Younger Edda, 1880), Gutenberg #18947.
 * Four books: Snorri's Foreword (the Prologue), the Fooling of Gylfe (Gylfaginning, 17 chapters and its
 * Afterword), Brage's Talk (Bragaraedur, 4 and its Afterword) and the stories from the Poetical Diction
 * (Skaldskaparmal, 9). Verse = paragraph, with the skaldic verses it quotes kept as lines. Anderson's
 * introduction, footnotes, notes, vocabulary and index are left out.
 */
async function proseEdda() {
  const txt = gutenbergBody(await cached("edda", "pg18947.txt", GUT(18947)));
  const lines = txt.split("\n");
  // The text proper starts at Snorri's Foreword (after Anderson's contents and introduction).
  const firstGylfe = lines.findIndex((l) => l.trim() === "THE FOOLING OF GYLFE.");
  const foreword = lines.findIndex((l, i) => i > firstGylfe && l.trim() === "FOREWORD.");
  const notesAt = lines.findIndex((l, i) => i > foreword && l.trim() === "NOTES.");
  const body = lines.slice(foreword, notesAt);
  type Ch = { book: string; title: string; paras: string[] };
  const chapters: Ch[] = [];
  let book = "prologue";
  let cur: Ch | null = null;
  let block: string[] = [];
  const flush = () => {
    if (!cur || !block.length) return (block = []);
    // Prose lines are unwrapped; indented verse lines stay lines.
    const out: string[] = [];
    for (const l of block) {
      if (/^\s{2,}\S/.test(l)) out.push(`\n${l.trim()}`);
      else out.push(out.length && !out[out.length - 1].startsWith("\n") ? ` ${l.trim()}` : (out.length ? `\n${l.trim()}` : l.trim()));
    }
    const t = out
      .join("")
      .replace(/\[\d+\]/g, "")
      .replace(/^\d+\.\s+/, "")
      .replace(/_/g, "") // italics marks
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .trim();
    block = [];
    if (t && !/^\[Footnote/.test(t)) cur.paras.push(t);
  };
  const caps = (l: string) => /^[A-ZÆØÖ][A-ZÆØÖ .,'’()-]{3,}$/.test(l);
  for (let i = 0; i < body.length; i++) {
    const raw = body[i].replace(/\r$/, "").replace(/\[\d+\]/g, "");
    const l = raw.trim();
    // Footnotes are indented "[Footnote n: …]" blocks, possibly several lines long.
    if (/^\[Footnote/.test(l)) {
      flush();
      while (i < body.length && !body[i].includes("]")) i++;
      continue;
    }
    if (!l) {
      flush();
      continue;
    }
    if (l === "FOREWORD.") {
      cur = { book, title: "Foreword", paras: [] };
      chapters.push(cur);
      continue;
    }
    if (l === "THE FOOLING OF GYLFE.") {
      flush();
      (book = "gylfaginning"), (cur = null);
      continue;
    }
    // Snorri's afterword to a part ("AFTERWORD" / "TO THE FOOLING OF GYLFE."): the last chapter of that part.
    if (l === "AFTERWORD") {
      flush();
      cur = { book, title: "Afterword", paras: [] };
      chapters.push(cur);
      while (i + 1 < body.length && !/^TO /.test(body[i + 1].trim()) && !body[i + 1].trim()) i++;
      if (/^TO /.test(body[i + 1]?.trim() ?? "")) i++;
      continue;
    }
    if (l === "BRAGE’S TALK.") {
      flush();
      (book = "bragaraedur"), (cur = null);
      continue;
    }
    if (l === "EXTRACTS FROM") {
      flush();
      (book = "skaldskaparmal"), (cur = null);
      i += 2; // "THE POETICAL DICTION."
      continue;
    }
    if (/^CHAPTER [IVXL]+\.$/.test(l)) {
      flush();
      // The chapter's own title follows on the next non-empty line.
      let j = i + 1;
      while (j < body.length && !body[j].trim()) j++;
      const head = body[j].trim().replace(/\[\d+\]/g, "");
      const title = caps(head) ? head.replace(/\.$/, "") : "";
      cur = { book, title, paras: [] };
      chapters.push(cur);
      if (title) i = j;
      continue;
    }
    if (book === "skaldskaparmal" && caps(l)) {
      flush();
      cur = { book, title: l.replace(/\.$/, ""), paras: [] };
      chapters.push(cur);
      continue;
    }
    if (caps(l) && cur && !cur.paras.length && !block.length) {
      // A second title line (a chapter with two headings, e.g. "THE FIRST WORKS OF THE ASAS. THE GOLDEN AGE.").
      cur.title = cur.title ? `${cur.title}. ${l.replace(/\.$/, "")}` : l.replace(/\.$/, "");
      continue;
    }
    block.push(raw);
  }
  flush();
  await resetVersion("prose-edda", "anderson");
  let total = 0;
  const n: Record<string, number> = {};
  for (const c of chapters) {
    if (!c.paras.length) continue;
    n[c.book] = (n[c.book] ?? 0) + 1;
    const verses = c.paras.map((t, k) => ({ v: String(k + 1), t }));
    // "THE CREATION--(CONTINUED.)" → "The Creation (continued)"; "…ASAS. THE GOLDEN AGE" keeps its capital.
    const cont = /--\(CONTINUED\.?\)/.test(c.title);
    const title = c.title
      ? titleCase(c.title.replace(/--\(CONTINUED\.?\)/, "")).replace(/\. ([a-z])/g, (_, x: string) => `. ${x.toUpperCase()}`) + (cont ? " (continued)" : "")
      : undefined;
    await writeChapter("prose-edda", "anderson", c.book, n[c.book], verses, undefined, title);
    total += verses.length;
  }
  report("prose-edda", chapters.length, total);
  console.log(n);
}

/**
 * The Kalevala — W. F. Kirby (1907), Gutenberg #25953 (Runos I–XXV) and #33089 (XXVI–L). One chapter
 * per runo; verse = stanza (a block between blank lines), labelled with Kirby's own line numbers
 * ("11–36") so his notes and other citations still find it. His "Argument" (a summary with line
 * numbers) becomes the chapter note; his notes at the end of each volume are left out.
 */
async function kalevala() {
  const runos: { n: number; title: string; argument: string; stanzas: { from: number; to: number; t: string }[] }[] = [];
  for (const id of [25953, 33089]) {
    let txt = gutenbergBody(await cached("kalevala", `pg${id}.txt`, GUT(id)));
    // Volume 1's transcription dropped Kirby's umlauts; volume 2 keeps them. Restore the names that differ,
    // so both halves spell (and search) the same: Vainamoinen 281×, Vainola, Vaino, Paivatar, Syojatar.
    if (id === 25953) {
      const fix: Record<string, string> = { Vainamoinen: "Väinämöinen", Vainola: "Väinölä", Vaino: "Väinö", Paivatar: "Päivätär", Syojatar: "Syöjätär" };
      txt = txt.replace(/\b(Vainamoinen|Vainola|Vaino|Paivatar|Syojatar)\b/g, (w) => fix[w]);
    }
    const lines = txt.split("\n");
    let cur: (typeof runos)[number] | null = null;
    let lineNo = 0;
    let block: string[] = [];
    let blockFrom = 0;
    let inArg = false;
    let arg: string[] = [];
    const flush = () => {
      if (cur && block.length) cur.stanzas.push({ from: blockFrom, to: lineNo, t: block.join("\n") });
      block = [];
    };
    for (const raw of lines) {
      const head = /^RUNO ([IVXL]+)\.--(.+)$/.exec(raw.trim());
      if (head) {
        flush();
        cur = { n: roman(head[1]), title: head[2].trim(), argument: "", stanzas: [] };
        runos.push(cur);
        lineNo = 0;
        inArg = false;
        arg = [];
        continue;
      }
      // The notes at the back start with a bare "RUNO I" heading (no title); stop there.
      if (/^RUNO [IVXL]+$/.test(raw.trim()) || /^\s*NOTES\s*$/.test(raw)) {
        flush();
        if (cur && /^RUNO [IVXL]+$/.test(raw.trim())) cur = null;
        if (cur) cur = null;
        continue;
      }
      if (!cur) continue;
      if (raw.trim() === "_Argument_") {
        inArg = true;
        continue;
      }
      if (inArg) {
        // The argument is unindented prose; the poem starts with an indented line.
        if (/^\s{2,}\S/.test(raw)) {
          inArg = false;
          cur.argument = unwrap(arg.join(" "));
        } else {
          if (raw.trim()) arg.push(raw.trim());
          continue;
        }
      }
      if (!raw.trim()) {
        flush();
        continue;
      }
      if (!/^\s{2,}\S/.test(raw)) continue; // stray unindented lines (end-of-volume matter)
      if (/^[\s*]+$/.test(raw)) {
        flush(); // a row of asterisks: a divider, not a line of the poem
        continue;
      }
      lineNo++;
      // Kirby prints every tenth line number at the right margin. His numbers follow the Finnish lines, which
      // his English does not always match one for one, so his number wins wherever he prints one.
      const mark = /\s{3,}(\d+)\s*$/.exec(raw);
      if (mark) lineNo = Number(mark[1]);
      if (!block.length) blockFrom = lineNo;
      block.push(raw.replace(/\s{3,}\d+\s*$/, "").trim());
    }
    flush();
  }
  await resetVersion("kalevala", "kirby");
  let total = 0;
  for (const r of runos) {
    const verses = r.stanzas.map((s, k) => ({ v: String(k + 1), t: s.t, n: s.from === s.to ? String(s.from) : `${s.from}–${s.to}` }));
    // Volume 1's headings lost their umlauts as lower-case letters ("VaINaMoINEN"); volume 2 has them.
    const title = titleCase(r.title.replace(/(?<=[A-Z])[ao]|[ao](?=[A-Z])/g, (m) => (m === "a" ? "Ä" : "Ö")));
    await writeChapter("kalevala", "kirby", "kalevala", r.n, verses, r.argument ? `Kirby's summary: ${r.argument}` : undefined, title);
    total += verses.length;
  }
  report("kalevala", runos.length, total);
}

/**
 * The Egyptian Book of the Dead — P. Le Page Renouf, completed by É. Naville (1904), Gutenberg #69566.
 * Chapters keep Naville's numbers (the ones everyone cites: chapter 125 is the Judgment). Verse =
 * paragraph; Renouf's note marks "(5.)", the plates and his NOTES after each chapter are left out.
 * Variant chapters (53A and 53B) share their chapter, the second starting with its own label; joint
 * headings ("Chapters 141 to 143") go under the first number.
 */
async function bookOfTheDead() {
  const txt = gutenbergBody(await cached("book-of-the-dead", "pg69566.txt", GUT(69566)));
  const lines = txt.split("\n");
  const first = lines.findIndex((l) => /^\s{10,}CHAPTER I\.\s*$/.test(l));
  const chapters = new Map<number, { title: string; verses: string[] }>();
  type Ch = { n: number; label: string; paras: string[]; heading: string };
  let cur: Ch | null = null;
  let para: string[] = [];
  // "text": the translation; "skip": Renouf's notes; "plate": a plate inside a chapter, after which the text resumes.
  let mode: "text" | "skip" | "plate" = "skip";
  let beforePlate: "text" | "skip" = "skip";
  let illus = false;
  const done: Ch[] = [];
  const clean = (s: string) =>
    s
      .replace(/\s*\(\d+\.\)\s*/g, " ")
      .replace(/\[\d+\]/g, "")
      .replace(/_/g, "")
      .replace(/=([^=\n]+)=/g, "$1") // Gutenberg's bold marks
      .replace(/\[\s*\]/g, "") // an empty bracket left by a removed hieroglyph
      .replace(/\s+\]/g, "]")
      .replace(/\s+([,.;:])/g, "$1")
      .trim();
  const flush = () => {
    const lines = para;
    para = [];
    if (!cur || mode !== "text" || !lines.length) return;
    // A list (the names in chapters 141–143) keeps its lines; prose is unwrapped.
    const list = lines.length >= 6 && lines.filter((x) => /,\s*$/.test(x.trim().replace(/\(\d+\.\)$/, ""))).length >= lines.length * 0.7;
    const t = list ? lines.map((x) => clean(x)).join("\n") : clean(unwrap(lines.join(" ")));
    if (!t || /^[-=─\s]+$/.test(t)) return; // a ---- divider is not text
    // The italic line right under the heading is the chapter's own title ("Chapter whereby …").
    if (!cur.paras.length && /^_/.test(lines[0].trim()) && !cur.heading) cur.heading = t;
    cur.paras.push(t);
  };
  for (let i = first; i < lines.length; i++) {
    const raw = lines[i];
    const l = raw.trim();
    if (illus) {
      if (l === "]" || l.endsWith("]")) illus = false;
      continue;
    }
    if (l.startsWith("[Illustration")) {
      flush();
      illus = !l.endsWith("]");
      continue;
    }
    // A plate sits between two full-width rules (captions, "BOOK OF THE DEAD. CHAPTER XVII.", illustrations):
    // skip to the closing rule, and the chapter's text (or its notes) simply goes on after it.
    if (/^-{60,}$/.test(raw)) {
      flush();
      const close = lines.findIndex((x, j) => j > i && /^-{60,}$/.test(x));
      if (close > 0 && close - i < 45 && lines.slice(i + 1, close).some((x) => /^PLATE [IVXLC]+\W*$/.test(x.trim()) || x.trim().startsWith("[Illustration"))) i = close - 1; // the closing rule may open the next plate
      continue;
    }
    if (/^PLATE [IVXLC]+\W*$/.test(l)) {
      flush();
      if (mode !== "plate") beforePlate = mode;
      mode = "plate";
      continue;
    }
    const head = /^\s{10,}CHAPTERS? ([IVXLC]+)([AB])?(?: _bis_)?\.?(.*)$/.exec(raw);
    // A plate's caption repeats a chapter heading just under "PLATE IV." / "BOOK OF THE DEAD.".
    if (head && lines.slice(Math.max(0, i - 7), i).some((x) => /^\s*PLATE [IVXLC]+\W*$/.test(x))) continue;
    if (head && !/Note/.test(head[3])) {
      flush();
      if (cur) done.push(cur);
      cur = { n: roman(head[1]), label: `${head[1]}${head[2] ?? ""}${/_bis_/.test(raw) ? " bis" : ""}${head[3].replace(/\.$/, "")}`.trim(), paras: [], heading: "" };
      mode = "text";
      continue;
    }
    // "NOTES.", "NOTE.", "NOTE.," and "NOTES TO CHAPTERS LXIX AND LXX." (that one with a stray "ce " before it).
    // Naville's introduction to the chapters he translated (after 139) is his, not the text.
    if (/^\s*(\S{1,3}\s+)?NOTES?( TO CHAPTERS? [IVXLC ,AND]+)?[.,]*\s*$/.test(raw) || /^Footnote \d+:$/.test(l) || /^(BY EDOUARD NAVILLE|INTRODUCTORY NOTE\.)/.test(l)) {
      flush();
      mode = "skip";
      continue;
    }
    if (/^BOOK OF THE DEAD\.?$/.test(l) || /^-{6,}$/.test(l)) {
      flush();
      continue;
    }
    if (!l) {
      flush();
      continue;
    }
    // After a plate, the chapter's text (or its notes) goes on.
    if (mode === "plate") mode = beforePlate;
    if (mode === "text") para.push(raw);
  }
  flush();
  if (cur) done.push(cur);
  // Renouf's one-line cross-references ("is identical with Chapter IX.") become the same kind of note as the others.
  const xref: Record<number, string> = {};
  for (const c of done) {
    const only = c.paras.filter((p) => !/^This completes Sir P\. Le Page Renouf/.test(p));
    const m = only.length === 1 ? /^(?:is |are )?(?:only )?(identical with|a repetition of)\s+chapters?\s+([IVXLC]+)\.?$/i.exec(only[0]) : null;
    if (m) xref[c.n] = `Chapter ${c.n} is ${m[1].toLowerCase()} chapter ${roman(m[2])} (Renouf): see chapter ${roman(m[2])}.`;
  }
  for (const c of done) {
    // Naville's note where Renouf's own translation stops (after chapter 139) is not part of the text.
    c.paras = c.paras.filter((p) => !/^This completes Sir P\. Le Page Renouf/.test(p));
    if (!c.paras.length || xref[c.n]) continue; // a plate caption, a heading over notes only, or a cross-reference
    const ch = chapters.get(c.n);
    // The chapter's own italic heading names it; else a rubric that does ("The Chapter of …").
    const rubric = c.heading || c.paras.find((p) => /^(The )?Chapter\b|^(The )?Beginning\b|^Said on arriving\b/i.test(p)) || "";
    // Its first sentence, or its first clause when that is still long ("The Beginning of the Chapters of Coming forth by Day").
    let title = rubric.split(/\. /)[0].replace(/[[\]]/g, "").replace(/\s+/g, " ").trim().replace(/[.:—-]+$/, "");
    if (title.length > 80) title = title.split(/, /)[0];
    if (!ch) chapters.set(c.n, { title, verses: [...c.paras] });
    else ch.verses.push(`[Chapter ${c.label.replace(/^[IVXLC]+/, String(c.n))}]`, ...c.paras); // "[Chapter 53B]"
  }
  const nums = [...chapters.keys()].sort((a, b) => a - b);
  const max = nums[nums.length - 1];
  // Numbers with no text of their own, as Renouf and Naville explain them, so the numbering stays standard.
  const stub: Record<number, string> = {
    16: "Chapter 16 is the picture (vignette) of chapter 15, the rising and the setting Sun (Renouf): see chapter 15.",
    48: "Chapter 48 is identical with chapter 10 (Renouf): see chapter 10.",
    49: "Chapter 49 is identical with chapter 11 (Renouf): see chapter 11.",
    120: "Chapter 120 is a repetition of chapter 12 (Renouf): see chapter 12.",
    121: "Chapter 121 is a repetition of chapter 13 (Renouf): see chapter 13.",
    122: "Chapter 122 is a repetition of chapter 58 (Renouf): see chapter 58.",
    142: "Chapters 141 to 143 are one chapter in this translation: see chapter 141.",
    143: "Chapters 141 to 143 are one chapter in this translation: see chapter 141.",
    146: "Chapters 145 and 146 are one chapter in this translation: see chapter 145.",
    150: "Chapter 150 is not a separate chapter: it is the pictures (vignettes) that go with chapter 149 (Naville).",
    168: "Chapter 168 is not translated in this edition. Naville explains that it belongs to another book, like those on the walls of the royal tombs: a list of the gods of the Netherworld, each granting the dead a blessing, which survives only in fragments.",
  };
  // Naville describes chapter 168 rather than translating it.
  chapters.delete(168);
  chapters.delete(48);
  Object.assign(stub, xref);
  const missing = Array.from({ length: max }, (_, k) => k + 1).filter((k) => !chapters.has(k) && !stub[k]);
  if (missing.length) throw new Error(`book of the dead: no text and no note for chapters ${missing.join(", ")}`);
  await resetVersion("book-of-the-dead", "renouf");
  let total = 0;
  for (let n = 1; n <= max; n++) {
    const ch = chapters.get(n);
    const verses = (ch ? ch.verses : [stub[n]]).map((t, k) => ({ v: String(k + 1), t }));
    await writeChapter("book-of-the-dead", "renouf", "book-of-the-dead", n, verses, undefined, ch?.title || undefined);
    total += verses.length;
  }
  report("book-dead", max, total);
}

/**
 * The Lotus Sutra — W. E. Soothill, The Lotus of the Wonderful Law (Oxford, 1930), Gutenberg #79267: an
 * abridgement from Kumarajiva's Chinese, in which Soothill translates the key passages and summarizes the
 * rest in his own words (the indented paragraphs). Both are kept, as he gives them: 28 chapters, titled from
 * his contents; verse = paragraph, verses keep their lines. His introduction, illustrations, glossary and
 * index are left out.
 */
async function lotus() {
  const txt = gutenbergBody(await cached("lotus", "pg79267.txt", GUT(79267)));
  const lines = txt.split("\n");
  // Chapter titles from the contents ("   III. Parable of the Burning House   81").
  const titles = new Map<number, string>();
  for (const l of lines.slice(0, 400)) {
    const m = /^\s+([IVXL]+)\. (.+?)\s{2,}\d+\s*$/.exec(l);
    if (m) titles.set(roman(m[1]), m[2].trim());
  }
  const glossary = lines.findIndex((l) => l.trim() === "GLOSSARY");
  const first = lines.findIndex((l, i) => i > 400 && /^\s{20,}I\s*$/.test(l));
  const body = lines.slice(first, glossary);
  const chapters: { n: number; paras: string[] }[] = [];
  let block: string[] = [];
  let illus = false;
  const flush = () => {
    if (block.length && chapters.length) {
      // Verse (indented four or more) keeps its lines; prose is unwrapped.
      const verse = block.every((x) => /^\s{4,}\S/.test(x));
      const t = verse ? block.map((x) => x.trim()).join("\n") : unwrap(block.join(" "));
      if (t && !/^[*\s]+$/.test(t)) chapters[chapters.length - 1].paras.push(t);
    }
    block = [];
  };
  for (const raw of body) {
    const l = raw.trim();
    if (illus) {
      if (l.endsWith("]")) illus = false;
      continue;
    }
    if (l.startsWith("[Illustration")) {
      flush();
      illus = !l.endsWith("]");
      continue;
    }
    const head = /^\s{20,}([IVXL]+)\s*$/.exec(raw);
    if (head) {
      flush();
      chapters.push({ n: roman(head[1]), paras: [] });
      continue;
    }
    if (!l) {
      flush();
      continue;
    }
    // The transcriber's correction notes ("♦ “Puddha-way” replaced with “Buddha-way”") are not the text; the
    // corrections themselves stay.
    if (l.startsWith("♦")) {
      flush();
      continue;
    }
    block.push(raw.replace(/[_♦]/g, ""));
  }
  flush();
  await resetVersion("lotus", "soothill");
  let total = 0;
  for (const c of chapters) {
    const verses = c.paras.map((t, k) => ({ v: String(k + 1), t }));
    await writeChapter("lotus", "soothill", "lotus", c.n, verses, undefined, titles.get(c.n));
    total += verses.length;
  }
  report("lotus", chapters.length, total);
}

/**
 * The Jataka tales, volume 1 — Buddhist Birth Stories, tr. T. W. Rhys Davids from Fausbøll's Pali (1880),
 * Gutenberg #51880. Two books: the Nidanakatha (the Buddha's lineage and life that opens the Jataka
 * commentary, in its three Epochs: Distant, Intermediate, Proximate), and Jatakas 1–40 under their standard numbers (7 and 8 are not in this volume: a note
 * gives Rhys Davids' cross-reference). Verse = paragraph, verses keep their lines; his introduction, tables,
 * footnotes, "END OF THE STORY…" lines and the index are left out.
 */
async function jataka() {
  const txt = gutenbergBody(await cached("jataka", "pg51880.txt", GUT(51880)));
  const lines = txt.split("\n");
  const start = lines.findIndex((l) => l.trim() === "THE NIDĀNAKATHĀ");
  const end = lines.findIndex((l, i) => i > start && /^END OF BOOK I\./.test(l.trim()));
  type Ch = { book: "nidana" | "jataka"; n: number; title: string; paras: string[] };
  const chapters: Ch[] = [{ book: "nidana", n: 1, title: "The Distant Epoch", paras: [] }];
  let cur = chapters[0];
  let block: string[] = [];
  let pendingNo = 0; // "No. 17." found at the end of a line: the story starts at the next heading
  const clean = (s: string) =>
    s
      .replace(/\[\d+\]/g, "")
      .replace(/\[vv?\. [\d-]+\.\]\s*/g, "") // "[vv. 1-11.]": verse numbers of the Pali
      // inside a word, underscores mark the transcriber's dotted letters: Nirvā_n_a → Nirvāṇa, Buddhava_m_sa → Buddhavaṃsa
      .replace(/(?<=\p{L})_([a-z]{1,2})_|_([a-z]{1,2})_(?=\p{L})/gu, (_, a?: string, b?: string) =>
        (a ?? b ?? "").replace(/[nmdt]/g, (c) => ({ n: "ṇ", m: "ṃ", d: "ḍ", t: "ṭ" })[c] ?? c),
      )
      .replace(/_/g, "")
      .replace(/\s+([,.;:])/g, "$1")
      .trim();
  const flush = () => {
    if (block.length) {
      const verse = block.length > 1 && block.every((x) => /^\s{2,}\S/.test(x));
      // a verse line too long for the page goes on, indented deeper, on the next line: join it back
      const vlines: string[] = [];
      if (verse) {
        // indent of the text itself, after a Buddhavamsa verse number ("   12. Four…" counts as 7)
        const indent = (x: string) => /^\s*(\d+\.\s+)?/.exec(x)![0].length;
        const ind = Math.min(...block.map(indent));
        for (const x of block) {
          if (vlines.length && indent(x) > ind + 1 && !/^\s*\d+\.\s/.test(x)) vlines[vlines.length - 1] += ` ${x.trim()}`;
          else vlines.push(x.trim().replace(/^\d+\.\s+/, "")); // "12. Four asankheyyas…": the Buddhavamsa's verse numbers
        }
      }
      const t = verse ? vlines.map((x) => clean(x)).join("\n") : clean(unwrap(block.join(" ")));
      if (t) cur.paras.push(t);
    }
    block = [];
  };
  const startStory = (n: number, i: number) => {
    // The Pali name ("MAKHĀ-DEVA JĀTAKA.") and the English title ("The Story of Makhā Deva.") follow.
    const next = lines.slice(i + 1, i + 12).map((x) => x.trim()).filter(Boolean);
    const pi = next.findIndex((x) => /JĀTAKA\.?(\[\d+\])?$/.test(x));
    const pali = pi >= 0 ? next[pi] : "";
    // the English title is the line right under the Pali name; story 1 has it in its heading ("No. 1.--Holding to the Truth.")
    const english = pi >= 0 ? next[pi + 1] : "";
    const inHead = /^No\. \d+\.--(.+?)\.?(\[\d+\])?$/.exec(lines[i].trim())?.[1] ?? "";
    const name = pali.replace(/\[\d+\]/g, "").replace(/\.$/, "");
    const nice = name ? name.toLowerCase().replace(/(^|[\s-])(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : "";
    const eng = (inHead || english).replace(/\[\d+\]/g, "").replace(/\.$/, "").replace(/\.’$/, "’").trim();
    cur = { book: "jataka", n, title: [nice, eng].filter(Boolean).join(": "), paras: [] };
    chapters.push(cur);
    return [pali, english].filter(Boolean);
  };
  let skipHeads: string[] = [];
  for (let i = start + 1; i < end; i++) {
    const raw = lines[i];
    const l = raw.trim();
    if (!l) {
      flush();
      continue;
    }
    if (l === "THE DISTANT EPOCH.") {
      // "The following is" leads straight into this heading
      flush();
      const last = cur.paras.length - 1;
      if (last >= 0 && /The following is$/.test(cur.paras[last])) cur.paras[last] += " the Distant Epoch.";
      continue;
    }
    if (l === "OR" || l === "THE THREE EPOCHS.") continue;
    if (/^II\.--AVIDŪRE NIDĀNA\./.test(l)) {
      flush();
      cur = { book: "nidana", n: 2, title: "The Intermediate Epoch", paras: [] };
      chapters.push(cur);
      continue;
    }
    if (/^THE PROXIMATE OR LAST EPOCH\./.test(l)) {
      flush();
      cur = { book: "nidana", n: 3, title: "The Proximate Epoch", paras: [] };
      chapters.push(cur);
      continue;
    }
    if (/^End of the Story of Sumedha\.?$/i.test(l)) continue;
    if (/^END OF THE ACCOUNT OF THE CAUSES|^ATTAINMENT OF BUDDHAHOOD\.$|^GLORY BE TO THE BLESSED|^BOOK I\.$|^CHAPTER [IVX]+\./.test(l)) continue;
    // "No. 9.[269]" or "No. 1.--Holding to the Truth." starts a story; "… No. 17." at a line's end marks the next one.
    const no = /^No\. (\d+)\./.exec(l);
    const tail = /No\. (\d+)\.\s*$/.exec(l);
    if (no) {
      flush();
      skipHeads = startStory(Number(no[1]), i);
      continue;
    }
    if (/^END OF THE STORY|^END OF THE/.test(l)) {
      flush();
      if (tail) pendingNo = Number(tail[1]);
      // a two-line "END OF THE STORY ON OFFERINGS GIVEN UNDER / …" ending
      while (i + 1 < end && lines[i + 1].trim() && /^[A-Z ,.’'-]+$/.test(lines[i + 1].trim())) i++;
      continue;
    }
    if (pendingNo && /JĀTAKA\.?(\[\d+\])?$/.test(l)) {
      flush();
      skipHeads = startStory(pendingNo, i - 1);
      pendingNo = 0;
    }
    if (skipHeads.includes(l)) continue; // the story's own name and title lines
    block.push(raw);
  }
  flush();
  const byKey = new Map(chapters.map((c) => [`${c.book}/${c.n}`, c]));
  // Rhys Davids' note on story 9: "For Nos. 7 and 8, see respectively Bhaddasāla Jātaka, Book xii., and Saŋvara Jātaka, Book xi."
  const stub: Record<number, string> = {
    7: "Story 7 is not translated in this volume; Rhys Davids refers it to the Bhaddasāla Jātaka (Book XII).",
    8: "Story 8 is not translated in this volume; Rhys Davids refers it to the Saŋvara Jātaka (Book XI).",
  };
  await resetVersion("jataka", "rhys-davids");
  let total = 0;
  for (const c of chapters.filter((x) => x.book === "nidana")) {
    const verses = c.paras.map((t, k) => ({ v: String(k + 1), t }));
    await writeChapter("jataka", "rhys-davids", "nidana", c.n, verses, undefined, c.title);
    total += verses.length;
  }
  for (let n = 1; n <= 40; n++) {
    const c = byKey.get(`jataka/${n}`);
    if (!c && !stub[n]) throw new Error(`jataka: story ${n} missing`);
    const verses = (c ? c.paras : [stub[n]]).map((t, k) => ({ v: String(k + 1), t }));
    await writeChapter("jataka", "rhys-davids", "jataka", n, verses, undefined, c?.title || undefined);
    total += verses.length;
  }
  report("jataka", chapters.length, total);
}

/**
 * Rumi's Masnavi, Book I — tr. James W. Redhouse (1881), Gutenberg #61724. Chapter 1 is the Proem (the Song
 * of the Reed-Flute); chapters 2–18 are Redhouse's seventeen tales (I–XVII). Verse = couplet, counted afresh in
 * each section as Redhouse does (he prints every fifth number; in tales III and XI his numbers slip by one). His preface, the "Acts of the
 * Adepts" anecdotes before the poem, and his footnotes are left out.
 */
async function masnavi() {
  const txt = gutenbergBody(await cached("masnavi", "pg61724.txt", GUT(61724)));
  const lines = txt.split("\n");
  const proem = lines.findIndex((l) => /^\s+PROEM\. The Reed-Flute\.\s*$/.test(l));
  const end = lines.findIndex((l, i) => i > proem && l.trim() === "THE END.");
  type Sec = { title: string; couplets: string[]; marks: [number, number][] };
  const secs: Sec[] = [{ title: "Proem: The Reed-Flute", couplets: [], marks: [] }];
  let pend: string[] = [];
  let warn = 0;
  for (let i = proem + 1; i < end; i++) {
    const raw = lines[i];
    const l = raw.trim();
    if (!l) continue;
    const num = /^([IVXL]+)\.$/.exec(l);
    if (num) {
      const title = lines[i + 2]?.trim().replace(/\[\d+\]/g, "").replace(/\.$/, "") ?? "";
      secs.push({ title: `${num[1]}. ${title}`, couplets: [], marks: [] });
      pend = [];
      i += 2;
      continue;
    }
    if (!/^\s{2,}\S/.test(raw)) continue;
    // Redhouse's couplet number, at the right margin (sometimes only a space or two away) or, once, at the start
    const mark = /\s+(\d{1,3})\s*$/.exec(raw) ?? /^\s*(\d{1,3})\s{2,}/.exec(raw);
    const text = raw
      .replace(/\s+\d{1,3}\s*$/, "")
      .replace(/^\s*\d{1,3}\s{2,}/, "")
      .replace(/\[\d+\]/g, "")
      .replace(/_/g, "")
      .replace(/--/g, "—")
      .replace(/\s{2,}/g, " ")
      .trim();
    const sec = secs[secs.length - 1];
    // A line too long for the page goes on, indented deeper, on the next line: join it back.
    if (/^\s{6,}\S/.test(raw)) {
      if (pend.length) pend[pend.length - 1] += ` ${text}`;
      else if (sec.couplets.length) sec.couplets[sec.couplets.length - 1] += ` ${text}`;
      if (mark && sec.couplets.length !== Number(mark[1])) warn++;
      continue;
    }
    pend.push(text);
    if (pend.length === 2) {
      sec.couplets.push(pend.join("\n"));
      pend = [];
    }
    if (mark) {
      // Redhouse's number should close that couplet; if not, note it (and trust our pairing).
      if (sec.couplets.length !== Number(mark[1]) || pend.length) {
        warn++;
        console.warn(`masnavi "${sec.title}": mark ${mark[1]} at couplet ${sec.couplets.length}${pend.length ? " (mid-couplet)" : ""}`);
      }
    }
  }
  await resetVersion("masnavi", "redhouse");
  let total = 0;
  for (const [k, s] of secs.entries()) {
    const verses = s.couplets.map((t, j) => ({ v: String(j + 1), t }));
    await writeChapter("masnavi", "redhouse", "masnavi-1", k + 1, verses, undefined, s.title);
    total += verses.length;
  }
  report("masnavi", secs.length, total);
  if (warn) console.warn(`masnavi: ${warn} number marks out of step`);
}

/**
 * The Epic of Gilgamish — R. Campbell Thompson (London: Luzac, 1928; public domain in the US), from the Internet
 * Sacred Text Archive's transcription (archive.sacred-texts.com/ane/eog/, pages eog03–eog14 saved in
 * data/raw/gilgamesh). One chapter per tablet (12); verse = paragraph, Thompson's lines kept, with his square
 * brackets for restored words and his notes on gaps ("About thirty lines wanting"); the first verse of each
 * column is labelled with it ("col. II"). His footnotes, the margin line numbers and the note marks are left out.
 */
async function gilgamesh() {
  const { readFile } = await import("node:fs/promises");
  await resetVersion("gilgamesh", "thompson");
  let total = 0;
  for (let n = 1; n <= 12; n++) {
    const page = await readFile(path.join(ROOT, "data", "raw", "gilgamesh", `eog${String(n + 2).padStart(2, "0")}.htm`), "utf8");
    const head = [...page.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/g)].map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim());
    // ["THE EPIC OF GILGAMISH.", "THE FIRST TABLET", "OF THE TYRANNY OF GILGAMISH, …", "Footnotes"]
    const ti = head.findIndex((h) => /TABLET\.?$/.test(h));
    const title = titleCase(head[ti + 1] ?? "").replace(/\.$/, "");
    const start = page.indexOf("</h", page.indexOf(head[ti + 1] ? "TABLET" : "<body"));
    const notes = page.search(/<h[1-4][^>]*>\s*Footnotes/);
    const body = page.slice(start, notes > 0 ? notes : undefined);
    const verses: Verse[] = [];
    let col = "";
    let sub = ""; // a centred sub-heading ("(The Cause of the Flood).") opens the next verse
    let afterBreak = false; // a page marker came between this paragraph and the last
    for (const m of body.matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/g)) {
      const inner = m[2]
        .replace(/<a name="page_\d+">[\s\S]*?<\/a>/g, "\u0000") // page markers ("p. 10")
        .replace(/<span class="margnote">[\s\S]*?<\/span>/g, "") // margin line numbers
        .replace(/<a name="fr_\d+"><\/a><a href="#fn_\d+"><font size="1">\d+<\/font><\/a>/g, "") // note marks
        .replace(/<a [^>]*>[\s\S]*?<\/a>/g, (x) => x.replace(/<[^>]+>/g, ""));
      const pageOnly = /^[\s\u0000]*$/.test(inner.replace(/<[^>]+>/g, "").replace(/&nbsp;| /g, ""));
      if (pageOnly) {
        afterBreak = true;
        continue;
      }
      const lines = inner
        .replace(/\u0000/g, "")
        .split(/<br\s*\/?>/)
        .map((x) =>
          decodeEntities(x.replace(/<[^>]+>/g, ""))
            .replace(/ /g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/^\d{1,3}\.?\s+(?=\S)/, "") // a margin number typed as text ("30. [Anu]")
            // a space left where a note mark was ("Erech ."), but never inside Thompson's ". . . ." gaps
            .replace(/(?<=[\w\])’'])\s+([,;:!?)]|\.(?!\s*\.))/g, "$1")
            .replace(/^0 (?=that\b)/, "O ") // "0 that" (a typo in the transcription)
            .replace(/^\[paragraph continues\]\s*/, ""), // Sacred Texts' mark for a paragraph split by a page
        )
        .filter((x) => x && !/^\d{1,3}\.?$/.test(x) && !/^_+$/.test(x));
      if (!lines.length) continue;
      const all = lines.join(" ");
      const c = /^Column ([IVX]+)\s*\.?$/.exec(all);
      if (c) {
        col = c[1];
        continue;
      }
      if (/^\(?The Argument\)?\.?$/.test(all.replace(/[()]/g, ""))) continue;
      if (/^THE END OF THE EPIC|^SHARP AND SONS/.test(all)) continue; // the last page and the printer's imprint
      // A short bracketed heading ("(The Fight with Humbaba).") opens the next verse; a note on a gap ("(About
      // seventeen lines missing).") stays a verse of its own.
      if (/^\(.*\)\.?$/.test(all) && all.length < 80 && !/lines|gap|wanting|missing|mutilated|broken|lost|Column/i.test(all)) {
        sub = sub ? `${sub}\n${all}` : all;
        continue;
      }
      const prev = verses[verses.length - 1];
      // a sentence cut by a page turn goes on in the next paragraph
      if (afterBreak && prev && !sub && !col && !/[.!?)\]”’"]$/.test(prev.t) && /^[a-z]/.test(lines[0])) {
        prev.t += `\n${lines.join("\n")}`;
        afterBreak = false;
        continue;
      }
      afterBreak = false;
      verses.push({ v: String(verses.length + 1), t: [sub, ...lines].filter(Boolean).join("\n"), ...(col ? { n: `col. ${col}` } : {}) });
      col = "";
      sub = "";
    }
    await writeChapter("gilgamesh", "thompson", "gilgamesh", n, verses, undefined, title);
    total += verses.length;
  }
  report("gilgamesh", 12, total);
}

/**
 * Legge's Sacred Books of the East, volume 3 (1879): the Shû King (Book of History), the Shih King (Book of
 * Poetry: the religious odes Legge selected) and the Hsiâo King (Classic of Filial Piety), from Wikisource's
 * proofread transcription. Pages were saved rendered (data/raw/sbe3html) and turned into blocks by
 * scripts/wikisource-blocks.py (data/raw/sbe3blocks). Legge's small-print notes before a book or ode become the
 * chapter note; his introductions to each work (and to each part and book of the Shih), the headings, footnotes
 * and Wikisource's hidden alignment text and section menus are left out.
 */
async function sbe3() {
  const { readFile, readdir } = await import("node:fs/promises");
  type Block = { kind: "heading" | "note" | "poem" | "prose"; text: string };
  const dir = path.join(ROOT, "data", "raw", "sbe3blocks");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const load = async (f: string) => JSON.parse(await readFile(path.join(dir, f), "utf8")) as Block[];
  const romanOf = (n: number) => {
    const r: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let s = "";
    for (const [v, l] of [[50, "L"], [40, "XL"], ...r] as [number, string][]) while (n >= v) (s += l), (n -= v);
    return s;
  };
  // one chapter from pages' blocks: notes → chapter note, headings left out, the rest verses (poems keep lines)
  const chapterOf = (pages: { label?: string; blocks: Block[] }[]) => {
    const notes: string[] = [];
    const verses: Verse[] = [];
    for (const p of pages) {
      let first = true;
      for (const b of p.blocks) {
        if (b.kind === "heading") continue;
        if (b.kind === "note") {
          if (!verses.length) notes.push(b.text);
          else verses.push({ v: String(verses.length + 1), t: b.text }); // a note between stanzas is Legge's own text
          continue;
        }
        verses.push({ v: String(verses.length + 1), t: b.text, ...(first && p.label ? { n: p.label } : {}) });
        first = false;
      }
    }
    return { note: notes.join("\n\n"), verses };
  };
  const nums = (f: string) => [...f.matchAll(/(Part|Book|Section|Decade|Ode|Chapter)_(\d+)/g)].map((m) => Number(m[2]));
  const byNums = (a: string, b: string) => {
    const x = nums(a), y = nums(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
    return 0;
  };
  let total = 0;

  // The Shû: one chapter per book; a book's sections follow its own page, each labelled "§1" …
  await resetVersion("shu-king", "legge-shu");
  const shuFiles = files.filter((f) => /^The_Shu__Part_\d+__Book_\d+(__Section_\d+)?\.json$/.test(f)).sort(byNums);
  const books = new Map<string, string[]>();
  for (const f of shuFiles) {
    const key = /^The_Shu__Part_(\d+)__Book_(\d+)/.exec(f)!.slice(1).join("/");
    books.set(key, [...(books.get(key) ?? []), f]);
  }
  let k = 0;
  for (const [key, fs] of books) {
    const [part, book] = key.split("/").map(Number);
    const pages = await Promise.all(fs.map(async (f) => ({ label: /Section_(\d+)/.exec(f) ? `§${/Section_(\d+)/.exec(f)![1]}` : undefined, blocks: await load(f) })));
    // the book's title: its "Book III. The Counsels of Kâo-yâo." heading
    const heads = pages.flatMap((p) => p.blocks).filter((b) => b.kind === "heading").map((b) => b.text);
    // Part I has a single book, headed only "The Canon of Yâo."
    const head = heads.find((h) => /^Book [IVXL]+\./.test(h)) ?? heads.find((h) => h !== h.toUpperCase() && !/^Section \d/.test(h)) ?? "";
    const name = head.replace(/^Book [IVXL]+\.\s*/, "").replace(/\.$/, "");
    const c = chapterOf(pages);
    // Legge numbers the text of each book from "1."; anything before it is his introduction, even where
    // Wikisource sets it in ordinary type (Part IV, Book III)
    if (c.verses.some((v) => /^1\.\s/.test(v.t))) {
      const lead: string[] = [];
      while (c.verses.length && !/^\d+\.\s/.test(c.verses[0].t) && !c.verses[0].n) lead.push(c.verses.shift()!.t);
      if (lead.length) {
        c.note = [c.note, ...lead].filter(Boolean).join("\n\n");
        c.verses.forEach((v, j) => (v.v = String(j + 1)));
      }
    }
    await writeChapter("shu-king", "legge-shu", "shu-king", ++k, c.verses, c.note || undefined, `Part ${romanOf(part)}, Book ${romanOf(book)}${name ? `: ${name}` : ""}`);
    total += c.verses.length;
  }
  report("shu-king", k, total);

  // The Shih: one chapter per ode, in Legge's printed order (his Part IV: I. Shang, II. Kâu, III. Lû)
  await resetVersion("shih-king", "legge-shih");
  const parts: [RegExp, string][] = [
    [/^The_Shih__Lessons_from_the_States__Book_\d+__Ode_\d+/, "Lessons from the States"],
    [/^The_Shih__The_Minor_Odes_of_the_Kingdom__Decade_\d+__Ode_\d+/, "Minor Odes of the Kingdom"],
    [/^The_Shih__The_Major_Odes_of_the_Kingdom__Decade_\d+__Ode_\d+/, "Major Odes of the Kingdom"],
    [/^The_Shih__Odes_of_the_Temple_and_the_Altar__The_Sacrificial_Odes_of_Shang__Ode_\d+/, "Sacrificial Odes of Shang"],
    [/^The_Shih__Odes_of_the_Temple_and_the_Altar__The_Sacrificial_Odes_of_Kâu__Decade_\d+__Ode_\d+/, "Sacrificial Odes of Kâu"],
    [/^The_Shih__Odes_of_the_Temple_and_the_Altar__The_Praise_Odes_of_Lû__Ode_\d+/, "Praise Odes of Lû"],
  ];
  let o = 0;
  let shih = 0;
  for (const [re, label] of parts) {
    for (const f of files.filter((x) => re.test(x)).sort(byNums)) {
      const blocks = await load(f);
      const head = blocks.find((b) => b.kind === "heading" && /^Ode \d+/i.test(b.text))?.text ?? ""; // "Ode 5." or "ODE 11, …"
      const [bk, ode] = nums(f).slice(-2);
      const where = /Book_\d+/.test(f) ? `Book ${romanOf(bk)}, ` : /Decade_\d+/.test(f) ? `Decade ${bk}, ` : "";
      const name = head.replace(/^Ode \d+(, Stanzas?[^.]*)?\.\s*/i, "").replace(/\.$/, "");
      const stanzas = /^Ode \d+, (Stanzas?[^.]*)\./i.exec(head)?.[1];
      const c = chapterOf([{ blocks }]);
      const only = stanzas ? `${stanzas} only, as Legge gives ${/^Stanzas/.test(stanzas) ? "them" : "it"}.` : "";
      const note = [only, c.note].filter(Boolean).join("\n\n");
      await writeChapter("shih-king", "legge-shih", "shih-king", ++o, c.verses, note || undefined, `${label}, ${where}Ode ${ode ?? nums(f).slice(-1)[0]}${name ? `: ${name}` : ""}`);
      shih += c.verses.length;
    }
  }
  report("shih-king", o, shih);

  // The Hsiâo: eighteen chapters
  await resetVersion("hsiao-king", "legge-hsiao");
  let h = 0;
  for (let n = 1; n <= 18; n++) {
    const blocks = await load(`The_Hsiao__Chapter_${n}.json`);
    const heads = blocks.filter((b) => b.kind === "heading").map((b) => b.text).filter((x) => !/^THE HSI/.test(x));
    const name = heads.join(" ").replace(/^Chapter [IVXL]+\.\s*/, "").replace(/\.$/, "").trim();
    const c = chapterOf([{ blocks }]);
    await writeChapter("hsiao-king", "legge-hsiao", "hsiao-king", n, c.verses, c.note || undefined, name || undefined);
    h += c.verses.length;
  }
  report("hsiao-king", 18, h);
}

/**
 * The Seven Tablets of Creation (Enuma Elish) — E. A. Wallis Budge, The Babylonian Legends of the Creation
 * (British Museum, 1921), Gutenberg #9914. One chapter per tablet; verse = Budge's line number ("26-28."
 * covers several), his bracketed remarks on gaps kept after the line they follow ("26a"). The Epilogue
 * continues Tablet VII's numbering and stays in it. His introduction, footnotes and illustrations are left out.
 */
async function enumaElish() {
  const txt = gutenbergBody(await cached("enuma-elish", "pg9914.txt", GUT(9914)));
  const lines = txt.split("\n");
  const start = lines.findIndex((l) => l.trim() === "THE SEVEN TABLETS OF CREATION.--TRANSLATION.");
  // the translation ends where Budge's NOTES (or his star list) begin
  const end = lines.findIndex((l, i) => i > start && /^(NOTES\.|LIST OF THE NAMES OF THE STARS)/.test(l.trim()));
  const tablets: Verse[][] = [];
  const names = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH"];
  let cur: Verse[] | null = null;
  let para: string[] = [];
  let skip = false; // inside a [Footnote …] or [Illustration …] block
  let last = "0";
  let suffix = 0;
  const flush = () => {
    const t = unwrap(para.join(" ")).replace(/\[\d+\]/g, "").replace(/_/g, "").trim();
    para = [];
    if (!cur || !t) return;
    const m = /^(\d+)(?:-(\d+))?\.\s+(.*)$/.exec(t);
    if (m) {
      last = m[1];
      suffix = 0;
      const glued = /^(.*["”])\s+(\[[^\]]+\])$/.exec(m[3]);
      cur.push({ v: m[1], t: glued ? glued[1] : m[3], ...(m[2] ? { to: m[2] } : {}) });
      if (glued) cur.push({ v: `${m[1]}${String.fromCharCode(96 + ++suffix)}`, t: glued[2] });
    } else {
      // Budge's own bracketed remark on a gap, after the line it follows
      suffix++;
      cur.push({ v: `${last}${String.fromCharCode(96 + suffix)}`, t });
    }
  };
  for (let i = start + 1; i < end; i++) {
    const l = lines[i].trim();
    if (skip) {
      if (/\]\s*$/.test(l)) skip = false;
      continue;
    }
    if (/^\[(Footnote|Illustration)/.test(l)) {
      flush();
      skip = !/\]\s*$/.test(l);
      continue;
    }
    const tab = /^([A-Z]+) TABLET\./.exec(l);
    if (tab && names.includes(tab[1])) {
      flush();
      cur = [];
      tablets.push(cur);
      last = "0";
      suffix = 0;
      continue;
    }
    if (l === "EPILOGUE.") {
      flush();
      continue;
    }
    if (!l) {
      flush();
      continue;
    }
    para.push(l);
  }
  flush();
  await resetVersion("enuma-elish", "budge");
  let total = 0;
  for (const [k, vs] of tablets.entries()) {
    await writeChapter("enuma-elish", "budge", "enuma-elish", k + 1, vs, undefined, `The ${titleCase(names[k])} Tablet`);
    total += vs.length;
  }
  report("enuma-elish", tablets.length, total);
}

/**
 * The Code of Hammurabi — C. H. W. Johns, The Oldest Code of Laws in the World (Edinburgh, 1903), Gutenberg
 * #17150. Chapter 1: the laws, verse = Johns' section number (1–65 and 100–282: five columns of the stone
 * were erased, as his note at that point explains, kept as "65a"), with the closing line after 282. Chapter 2:
 * the three sections known only from later Assyrian copies, which he adds (X, Y, Z). His introduction and
 * index are left out.
 */
async function hammurabi() {
  const txt = gutenbergBody(await cached("hammurabi", "pg17150.txt", GUT(17150)));
  const lines = txt.split("\n");
  const start = lines.findIndex((l) => l.trim() === "THE TEXT OF THE CODE");
  const end = lines.findIndex((l, i) => i > start && l.trim() === "INDEX");
  const paras: string[] = [];
  let para: string[] = [];
  // a word broken at a line's end ("cow-" / "hide") is joined without a space; "--" is a dash
  const join = (ls: string[]) => unwrap(ls.reduce((a, l) => (/[^-]-$/.test(a) ? a + l : a ? `${a} ${l}` : l), ""));
  for (const raw of lines.slice(start + 1, end)) {
    if (!raw.trim()) {
      if (para.length) paras.push(join(para));
      para = [];
    } else para.push(raw.trim());
  }
  if (para.length) paras.push(join(para));
  const laws: Verse[] = [];
  const later: Verse[] = [];
  let intro = "";
  let inLater = false;
  let last = "0";
  let suffix = 0;
  for (const p0 of paras) {
    const p = p0.replace(/_/g, "").replace(/\s*\[See page \d+\.\]/g, "");
    if (/^\*[\s*]*$/.test(p)) continue;
    if (/^The following three sections/.test(p)) {
      inLater = true;
      intro = p;
      continue;
    }
    const m = /^section (\d+|[XYZ])\.\s*(.*)$/.exec(p);
    // the lettered items of a section's list ("(a) the hire of a brickmaker …", section 274) stay in it, as lines
    if (/^\([a-z]\)\s/.test(p) && laws.length && !inLater) {
      laws[laws.length - 1].t += `\n${p}`;
      continue;
    }
    if (m && inLater) later.push({ v: String(later.length + 1), t: m[2], n: m[1] });
    else if (m) {
      last = m[1];
      suffix = 0;
      laws.push({ v: m[1], t: m[2] });
    } else {
      suffix++;
      (inLater ? later : laws).push({ v: inLater ? String(later.length + 1) : `${last}${String.fromCharCode(96 + suffix)}`, t: p });
    }
  }
  await resetVersion("hammurabi", "johns");
  await writeChapter("hammurabi", "johns", "hammurabi", 1, laws, undefined, "The Laws");
  await writeChapter("hammurabi", "johns", "hammurabi", 2, later, intro || undefined, "Three Sections from Later Assyrian Copies");
  report("hammurabi", 2, laws.length + later.length);
}

/**
 * The Instruction of Ptah-hotep and the Instruction of Ke'gemni — Battiscombe G. Gunn (Wisdom of the East,
 * 1906), Gutenberg #30508, with the Instruction of Amenemhe'et I that he gives in his appendix. One chapter
 * each; verse = paragraph, labelled with Gunn's own letters and numbers ("A", "1"); his list of topics under
 * each title is the chapter note. His introduction, footnotes, page numbers and bibliography are left out.
 */
async function ptahhotep() {
  const txt = gutenbergBody(await cached("ptahhotep", "pg30508.txt", GUT(30508)));
  const lines = txt.split("\n");
  const heads = ["THE INSTRUCTION OF PTAH-HOTEP", "THE INSTRUCTION OF KE'GEMNI", "THE INSTRUCTION OF AMENEMHE'ET"];
  const titles = ["The Instruction of Ptah-hotep", "The Instruction of Ke'gemni", "The Instruction of Amenemhe'et"];
  await resetVersion("ptahhotep", "gunn");
  let total = 0;
  for (const [k, h] of heads.entries()) {
    // the last line with this heading (the first Ptah-hotep one is the title page of the introduction)
    const at = lines.reduce((acc, l, i) => (l.trim() === h ? i : acc), -1);
    const paras: string[] = [];
    let para: string[] = [];
    let colophon = "";
    for (let i = at + 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (/^IT IS FINISHED/.test(l)) {
        // the scribe's colophon is part of the text: its lines run on until a gap of two blank lines
        const col: string[] = [];
        for (let j = i; j < lines.length && !(lines[j].trim() === "" && lines[j + 1]?.trim() === "" && col.length); j++) if (lines[j].trim()) col.push(lines[j].trim());
        colophon = col.join("\n");
        break;
      }
      if (heads.includes(l) || l === "APPENDIX") break;
      if (!l) {
        if (para.length) paras.push(unwrap(para.join(" ")));
        para = [];
      } else para.push(l);
    }
    if (para.length) paras.push(unwrap(para.join(" ")));
    if (colophon) paras.push(`\u0001${colophon}`); // kept with its lines (marked so it is not unwrapped below)
    // the first paragraph is Gunn's list of topics ("The Ethics of Argument--Manners for Guests--…")
    const note = (/--/.test(paras[0]) && paras[0].length < 400) || (paras[0].length < 60 && !/\.$/.test(paras[0])) ? paras.shift()!.replace(/--/g, "; ") : "";
    const verses: Verse[] = [];
    for (const p of paras) {
      if (p.startsWith("\u0001")) {
        verses.push({ v: String(verses.length + 1), t: p.slice(1) });
        continue;
      }
      let t = p
        .replace(/\{\d+\}\s*/g, "") // page numbers
        .replace(/\[\d+\]/g, "") // note marks
        .replace(/_/g, "")
        .replace(/\s+([,.;:])/g, "$1")
        .trim();
      // a closing quote with no opening one (Amenemhe'et 15, as printed)
      if ((t.match(/"/g) ?? []).length % 2 === 1 && /"$/.test(t)) t = t.slice(0, -1);
      if (!t) continue;
      const m = /^([A-D]|\d+)\.\s+(.*)$/.exec(t);
      verses.push({ v: String(verses.length + 1), t: m ? m[2] : t, ...(m ? { n: m[1] } : {}) });
    }
    await writeChapter("ptahhotep", "gunn", "ptahhotep", k + 1, verses, note || undefined, titles[k]);
    total += verses.length;
  }
  report("ptahhotep", heads.length, total);
}

/**
 * The Diamond Sutra — William Gemmell, from Kumarajiva's Chinese (London, 1912), Gutenberg #64623. One chapter
 * per chapter of the sutra (32; Gemmell gives 3 and 4 together, so 4 is a note pointing to 3); verse =
 * paragraph, the Gatha keeping its lines. His footnotes (indented "[1] …" blocks after each paragraph, with
 * the verse they quote), introduction and preface are left out.
 */
async function diamondSutra() {
  const txt = gutenbergBody(await cached("diamond-sutra", "pg64623.txt", GUT(64623)));
  const lines = txt.split("\n");
  const start = lines.findIndex((l) => l.trim() === "THE DIAMOND SUTRA" && /^\s{10,}/.test(l));
  const end = lines.findIndex((l, i) => i > start && /^TRANSCRIBER.S NOTES\.$/.test(l.trim()));
  const chapters = new Map<number, string[]>();
  let cur: string[] | null = null;
  let block: string[] = [];
  let inNotes = false; // a footnote block has begun since the last paragraph of text
  let inBlock = false;
  const flush = () => {
    if (cur && block.length) {
      const indented = block.every((x) => /^\s{2,}\S/.test(x));
      const t = indented
        ? block.map((x) => x.trim()).join("\n")
        : unwrap(block.join(" "));
      cur.push(t.replace(/\[\d+\]/g, "").replace(/_/g, "").replace(/\s+([,.;:])/g, "$1").trim());
    }
    block = [];
  };
  for (let i = start + 1; i < end; i++) {
    const raw = lines[i];
    const l = raw.trim();
    const ch = /^\[Chapters? (\d+)(?: and (\d+))?\]$/.exec(l);
    if (ch) {
      flush();
      cur = [];
      chapters.set(Number(ch[1]), cur);
      inNotes = false;
      inBlock = true;
      continue;
    }
    if (!l) {
      flush();
      inBlock = false;
      continue;
    }
    const indented = /^\s{2,}\S/.test(raw);
    if (!inBlock) {
      // a new block (after a blank line): text unless it is, or follows, a footnote. A footnote's own lines
      // may run on unindented (note 1 of chapter 15), so this is decided only where a block begins.
      inBlock = true;
      if (indented && /^\[\d+\]/.test(l)) inNotes = true;
      else if (!indented) inNotes = false;
    }
    if (inNotes) continue;
    block.push(raw);
  }
  flush();
  await resetVersion("diamond-sutra", "gemmell");
  let total = 0;
  for (let n = 1; n <= 32; n++) {
    const paras = chapters.get(n) ?? (n === 4 ? ["Gemmell gives chapters 3 and 4 together, under chapter 3: chapter 4 begins there at “Moreover, Subhuti, an enlightened disciple ought to act spontaneously…” (3:2)."] : null);
    if (!paras) throw new Error(`diamond sutra: chapter ${n} missing`);
    await writeChapter("diamond-sutra", "gemmell", "diamond-sutra", n, paras.map((t, k) => ({ v: String(k + 1), t })));
    total += paras.length;
  }
  report("diamond", 32, total);
}

/**
 * The Art of War — Sun Tzŭ, tr. Lionel Giles (1910), Gutenberg #132. Thirteen chapters; verse = Giles' section
 * number ("5, 6." covers two). The commentary he gives in square brackets after the text, his introduction and
 * footnotes are left out.
 */
async function artOfWar() {
  const txt = gutenbergBody(await cached("art-of-war", "pg132.txt", GUT(132)));
  const lines = txt.split("\n");
  const firstCh = lines.findIndex((l) => /^Chapter I\. LAYING PLANS/.test(l.trim()));
  const chapters: { title: string; verses: Verse[] }[] = [];
  // Paragraphs first (blank-line separated), then each is text or commentary.
  const paras: { ch?: string; t: string }[] = [];
  let para: string[] = [];
  for (let i = firstCh; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^\*\*\* END/.test(l)) break;
    const ch = /^Chapter ([IVX]+)\. (.+)$/.exec(l);
    if (ch) {
      if (para.length) paras.push({ t: para.join(" ") });
      para = [];
      paras.push({ ch: ch[2], t: "" });
      continue;
    }
    if (/^\]$/.test(l)) continue; // stray closing brackets on lines of their own (XII.9)
    // a section number always starts a paragraph, even with no blank line before it (XII.10)
    if (!l || (/^\d+(?:, \d+)?\.\s/.test(l) && para.length)) {
      if (para.length) paras.push({ t: para.join(" ") });
      para = l ? [l] : [];
    } else para.push(l);
  }
  if (para.length) paras.push({ t: para.join(" ") });
  // Giles' commentary and his footnotes ("[1] See …") are in square brackets, sometimes over several paragraphs and
  // with brackets inside: a commentary runs until its brackets balance. Each chapter starts fresh.
  let depth = 0;
  let lastNote = "";
  for (const p of paras) {
    if (p.ch) {
      chapters.push({ title: titleCase(p.ch), verses: [] });
      depth = 0;
      continue;
    }
    const t = unwrap(p.t);
    const opens = (t.match(/\[/g) ?? []).length - (t.match(/\]/g) ?? []).length;
    if (t.startsWith("[")) {
      depth = Math.max(0, opens);
      lastNote = t;
      continue;
    }
    if (depth > 0) {
      // Giles often leaves a commentary unclosed. It goes on only where this paragraph closes it, opens with a
      // quotation, or carries on a sentence the last one broke off; otherwise Sun Tzŭ's text has resumed.
      const goesOn = opens < 0 || /^["“'‘(]/.test(t) || !/[.!?:;"”’)]$/.test(lastNote);
      if (goesOn && !/^\d+(?:, \d+)?\.?\s/.test(t)) {
        depth = Math.max(0, depth + opens);
        lastNote = t;
        continue;
      }
      depth = 0;
    }
    // a commentary whose opening bracket the printer dropped ("This need not be taken … opinion."]", VIII.12)
    if ((t.match(/\]/g) ?? []).length > (t.match(/\[/g) ?? []).length && /\]$/.test(t)) continue;
    const cur = chapters[chapters.length - 1];
    if (!cur) continue;
    const clean = (x: string) => x.replace(/_/g, "").replace(/\[\d+\]/g, "").replace(/\s+([,.;:])/g, "$1").trim();
    // "5, 6. The Moral Law …", and once "9 There are …" with no full stop
    const m = /^(\d+)(?:, (\d+))?\.?\s+(\S.*)$/.exec(t);
    if (m && Number(m[1]) === (cur.verses.length ? Number(cur.verses[cur.verses.length - 1].to ?? cur.verses[cur.verses.length - 1].v) + 1 : 1))
      cur.verses.push({ v: m[1], t: clean(m[3]), ...(m[2] ? { to: m[2] } : {}) });
    else if (cur.verses.length) cur.verses[cur.verses.length - 1].t += ` ${clean(t)}`; // a section running on
  }
  // every chapter numbered 1..N, no brackets left
  for (const [k, c] of chapters.entries()) {
    c.verses.forEach((v, j) => {
      const prev = j ? Number(c.verses[j - 1].to ?? c.verses[j - 1].v) : 0;
      if (Number(v.v) !== prev + 1) throw new Error(`art of war: chapter ${k + 1} goes from ${prev} to ${v.v}`);
      if (/[[\]]/.test(v.t)) throw new Error(`art of war: bracket left in ${k + 1}:${v.v}: ${v.t.slice(0, 300)}`);
    });
  }
  await resetVersion("art-of-war", "giles-aow");
  let total = 0;
  for (const [k, c] of chapters.entries()) {
    await writeChapter("art-of-war", "giles-aow", "art-of-war", k + 1, c.verses, undefined, c.title);
    total += c.verses.length;
  }
  report("art-of-war", chapters.length, total);
}

/**
 * The Golden Verses of Pythagoras — Fabre d'Olivet's French verse rendering, in Nayán Louise Redfield's English
 * (New York, 1917), Gutenberg #69174: the poem only, from the full English text printed in his notes 229–231.
 * Three chapters (Preparation, Purification, Perfection); verse = Fabre d'Olivet's own section number, the
 * "(2)" … "(36)" that close each segment and key his commentary (the closing lines, unnumbered, are 37). His
 * long commentary, the Greek and French texts and the Discourse on poetry are left out.
 */
async function goldenVerses() {
  const txt = gutenbergBody(await cached("golden-verses", "pg69174.txt", GUT(69174)));
  const lines = txt.split("\n");
  const start = lines.findIndex((l) => /^\s*\[229\] GOLDEN VERSES OF THE PYTHAGOREANS/.test(l));
  const end = lines.findIndex((l, i) => i > start && /^\s*\[232\]/.test(l));
  const parts: { title: string; verses: Verse[] }[] = [];
  let buf: string[] = [];
  for (const raw of lines.slice(start + 1, end)) {
    const l = raw.trim();
    const head = /^(?:\[\d+\]\s*)?(PREPARATION|PURIFICATION|PERFECTION)$/.exec(l);
    if (head) {
      parts.push({ title: titleCase(head[1]), verses: [] });
      buf = [];
      continue;
    }
    if (!l || !parts.length) continue;
    // a wrapped line ("…good" / "father (4)") is indented deeper: join it to the line before
    if (/^\s{9,}\S/.test(raw) && buf.length) buf[buf.length - 1] += ` ${l}`;
    else buf.push(l);
    const all = buf.join("\n");
    // a segment ends at "(n)"; text after it on the same line ("Guard then thy faith (2): Revere…") starts the next
    const m = /^([\s\S]*?)\s*\((\d+)\)([:.;,]?)\s*([\s\S]*)$/.exec(all);
    if (m) {
      // keep the mark after "(n)" unless the line already ends in its own ("what done? (22).")
      parts[parts.length - 1].verses.push({ v: m[2], t: (/[?!]$/.test(m[1].trim()) ? m[1] : m[1] + m[3]).trim() });
      buf = m[4].trim() ? [m[4].trim().replace(/^[:.;,]\s*/, "")] : [];
    }
  }
  if (buf.length) parts[parts.length - 1].verses.push({ v: "37", t: buf.join("\n") }); // the last lines, unnumbered
  await resetVersion("golden-verses", "redfield");
  let total = 0;
  for (const [k, p] of parts.entries()) {
    await writeChapter("golden-verses", "redfield", "golden-verses", k + 1, p.verses, undefined, p.title);
    total += p.verses.length;
  }
  report("golden-verses", parts.length, total);
}

/**
 * The Rubáiyát of Omar Khayyám — Edward FitzGerald's First Edition (1859, 75 quatrains) and Fifth Edition (1889,
 * 101), Gutenberg #246. Two books, one chapter each; verse = quatrain under FitzGerald's own number, lines kept.
 * The First Edition's closing "TAMAM SHUD." stays as its last verse. His preface and notes are left out.
 */
async function rubaiyat() {
  const txt = gutenbergBody(await cached("rubaiyat", "pg246.txt", GUT(246)));
  const lines = txt.split("\n");
  const first = lines.findIndex((l) => l.trim() === "First Edition");
  const fifth = lines.findIndex((l, i) => i > first && l.trim() === "Fifth Edition");
  const notes = lines.findIndex((l, i) => i > fifth && /^Notes:?$/.test(l.trim()));
  const edition = (from: number, to: number) => {
    const verses: Verse[] = [];
    let cur: { n: number; lines: string[] } | null = null;
    let heading = "";
    const push = () => {
      if (cur && cur.lines.length) verses.push({ v: String(cur.n), t: cur.lines.join("\n").replace(/--/g, "—").replace(/(\w)-$/gm, "$1—") }); // "Fears-", "Yes-" are dashes
      cur = null;
    };
    for (const raw of lines.slice(from + 1, to)) {
      const l = raw.trim();
      const num = /^([IVXLC]+)\.$/.exec(l);
      if (num) {
        push();
        // the quatrains run in order; the First Edition misprints 49 as "XLVIX"
        const n = verses.filter((v) => /^\d+$/.test(v.v)).length + 1;
        if (roman(num[1]) !== n && num[1] !== "XLVIX") console.warn(`rubaiyat: ${num[1]} where ${n} was expected`);
        cur = { n, lines: [] };
        continue;
      }
      if (/^TAMAM( SHUD)?\.?$/.test(l)) {
        push();
        verses.push({ v: `${verses.length}a`, t: l }); // the closing "It is finished"
        continue;
      }
      if (/^\*+$/.test(l)) continue; // a divider
      if (/^KUZA/.test(l)) {
        // the heading of the pottery sequence ("KUZA—NAMA ('Book of Pots')") opens the quatrain after it
        push();
        heading = l.replace(/--/g, "—");
        continue;
      }
      if (cur && l) {
        const c = cur as { lines: string[] };
        if (heading && !c.lines.length) c.lines.push(heading), (heading = "");
        c.lines.push(l);
      }
    }
    push();
    return verses;
  };
  await resetVersion("rubaiyat", "fitzgerald");
  const a = edition(first, fifth);
  const b = edition(fifth, notes);
  await writeChapter("rubaiyat", "fitzgerald", "first-edition", 1, a, undefined, "First Edition (1859)");
  await writeChapter("rubaiyat", "fitzgerald", "fifth-edition", 1, b, undefined, "Fifth Edition (1889)");
  report("rubaiyat", 2, a.length + b.length);
}

/**
 * Hafiz — Poems from the Divan of Hafiz, tr. Gertrude Lowthian Bell (London, 1897), Gutenberg #74883. One chapter
 * per poem (43, under Bell's numbers); verse = stanza, lines kept. Her introduction and notes are left out.
 */
async function hafiz() {
  const txt = gutenbergBody(await cached("hafiz", "pg74883.txt", GUT(74883)));
  const lines = txt.split("\n");
  const start = lines.findIndex((l, i) => i > 1200 && l.trim() === "DIVAN OF HAFIZ");
  const end = lines.findIndex((l, i) => i > start && l.trim() === "NOTES");
  const poems: Verse[][] = [];
  let stanza: string[] = [];
  const flush = () => {
    if (stanza.length && poems.length) poems[poems.length - 1].push({ v: String(poems[poems.length - 1].length + 1), t: stanza.join("\n").replace(/_/g, "") });
    stanza = [];
  };
  for (const raw of lines.slice(start + 1, end)) {
    const l = raw.trim();
    if (/^[IVXL]+$/.test(l) && /^\s{20,}/.test(raw)) {
      flush();
      poems.push([]);
      continue;
    }
    if (!l) {
      flush();
      continue;
    }
    stanza.push(l);
  }
  flush();
  await resetVersion("hafiz", "bell");
  let total = 0;
  for (const [k, p] of poems.entries()) {
    await writeChapter("hafiz", "bell", "hafiz", k + 1, p);
    total += p.length;
  }
  report("hafiz", poems.length, total);
}

/**
 * The Legends of the Jews — Louis Ginzberg, volumes I–IV (1909–1913; tr. Henrietta Szold and Paul Radin),
 * Gutenberg #1493, #1494, #2881, #2882: the narrative from the Creation to Esther. Book = Ginzberg's chapter
 * ("The Creation of the World" … "Esther", 23 across the four volumes); chapter = his titled section; verse =
 * paragraph. His note marks ("[12]", "(12)") are left out: the notes themselves are in volumes V–VI, which are not
 * on Gutenberg. The prefaces are left out.
 */
export const LEGENDS_BOOKS: { id: string; name: string; vol: number; sections: number }[] = [];
async function legends() {
  const vols: [number, number][] = [
    [1, 1493],
    [2, 1494],
    [3, 2881],
    [4, 2882],
  ];
  const books: { name: string; vol: number; sections: { title: string; paras: string[] }[] }[] = [];
  const isHead = (l: string) => /^[A-Z][A-Z0-9 ,.;:'’"“”!?()&—-]*[A-Z.)'’]$/.test(l) && l.length < 90 && /[A-Z]{3}/.test(l);
  for (const [vol, id] of vols) {
    const txt = gutenbergBody(await cached("legends-jews", `pg${id}.txt`, GUT(id)));
    const lines = txt.split("\n");
    // the narrative starts at the first chapter heading after the preface and contents: a Roman numeral line
    // followed by the chapter title (I–II, IV), or in III, which is one chapter, the title on its own
    let i = lines.findIndex((l, k) => /^[IVX]+\.?$/.test(l.trim()) && l === l.trim() && isHead(lines[k + 1]?.trim() ?? ""));
    if (vol === 3) i = lines.findIndex((l, k) => l === "MOSES IN THE WILDERNESS" && lines[k + 5]?.trim() === "THE LONG ROUTE") - 1;
    if (i < 0) throw new Error(`legends: no start in volume ${vol}`);
    let para: string[] = [];
    const flush = () => {
      const b = books[books.length - 1];
      const s = b?.sections[b.sections.length - 1];
      if (para.length && s) {
        const t = unwrap(para.join(" "))
          .replace(/\s*\[\s*\d+\s*\]|\s+\d{1,3}\](?=\s|$)/g, "") // note marks, some broken over a line ("[ 33]", "1]")
          .replace(/\s*\(\d{1,3}\)(?=[\s.,;:!?"”’)]|$)/g, "")
          .replace(/\s+([,.;:!?])/g, "$1")
          .replace(/_/g, "")
          .replace(/unto thee\.\[\]/, `unto thee.'"`) // a lost closing quote (II, Moses in Egypt)
          .trim()
          .replace(/(\w)$/, "$1."); // a full stop lost with the note mark after it ("great, indeed[6]")
        if (t) s.paras.push(t);
      }
      para = [];
    };
    for (let k = i; k < lines.length; k++) {
      const raw = lines[k];
      const l = raw.trim();
      if (/^\*\*\* END/.test(l)) break;
      const prevBlank = !lines[k - 1]?.trim();
      const nextBlank = !lines[k + 1]?.trim();
      // a chapter: "I" / "I." then its title on the next line (or volume III's single title)
      if (/^[IVX]+\.?$/.test(l) && raw === l && isHead(lines[k + 1]?.trim() ?? "")) {
        flush();
        books.push({ name: lines[k + 1].trim(), vol, sections: [] });
        k++;
        continue;
      }
      if (vol === 3 && k === i + 1) {
        books.push({ name: l, vol, sections: [] });
        continue;
      }
      // a section: an upper-case line on its own, at the margin (in III some are indented by a space)
      if (/^ ?\S/.test(raw) && isHead(l) && prevBlank && nextBlank) {
        flush();
        books[books.length - 1].sections.push({ title: l.replace(/\.$/, ""), paras: [] });
        continue;
      }
      if (!l) flush();
      else para.push(l);
    }
    flush();
  }
  await resetVersion("legends-jews", "ginzberg");
  LEGENDS_BOOKS.length = 0;
  // section titles: "The 'Akedah"; small words lower-case throughout; "Vasthi" is a slip for Vashti (IV's contents)
  const title = (x: string) =>
    titleCase(x.replace(/^VASTHI/, "VASHTI"))
      .replace(/(\s')(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase())
      .replace(/(?<=\S\s)(Into|Unto|Against|Toward|Before|Between|Over|Under|Through|After|Among|Without|Within)\b/g, (w) => w.toLowerCase());
  let total = 0;
  for (const b of books) {
    const id = slug(titleCase(b.name));
    for (const [k, s] of b.sections.entries()) {
      if (!s.paras.length) throw new Error(`legends: empty section ${b.name} / ${s.title}`);
      await writeChapter("legends-jews", "ginzberg", id, k + 1, s.paras.map((t, j) => ({ v: String(j + 1), t })), undefined, title(s.title));
      total += s.paras.length;
    }
    LEGENDS_BOOKS.push({ id, name: titleCase(b.name), vol: b.vol, sections: b.sections.length });
  }
  console.log(LEGENDS_BOOKS.map((b) => `${b.vol} ${b.id} ${b.sections}`).join("\n"));
  report("legends-jews", books.reduce((a, b) => a + b.sections.length, 0), total);
}

/**
 * The Guide for the Perplexed — Moses Maimonides, tr. M. Friedländer (2nd ed., 1904), Gutenberg #73584.
 * Books: Maimonides' Introduction (his letter to his pupil, prefatory remarks, directions for study, introductory
 * remarks on method), Part I (76 chapters), the Introduction to Part II (the propositions), Part II (48), the
 * Introduction to Part III, Part III (54). Verse = paragraph; epigraphs keep their lines. Friedländer's own
 * introduction (his life of Maimonides and analysis of the Guide) and his notes are left out.
 */
async function guide() {
  const txt = gutenbergBody(await cached("guide-perplexed", "pg73584.txt", GUT(73584)));
  const lines = txt.split("\n");
  const at = (re: RegExp, from = 0) => {
    const i = lines.findIndex((l, k) => k >= from && re.test(l));
    if (i < 0) throw new Error(`guide: ${re} not found`);
    return i;
  };
  const intro = at(/^INTRODUCTION$/, at(/^PART III\.$/));
  const p1 = at(/^PART I$/, intro);
  const p2 = at(/^PART II$/, p1);
  const p3 = at(/^PART III$/, p2);
  const end = at(/^NOTES$/, p3);
  // paragraphs of a stretch of lines; an indented block (an epigraph) keeps its lines
  const paras = (from: number, to: number) => {
    const out: string[] = [];
    let buf: string[] = [];
    let verse = false;
    const flush = () => {
      if (buf.length) {
        // an epigraph: the quotation unwrapped, its reference ("(Psalm cxliii. 8.)") on a line of its own
        const t = verse
          ? unwrap(buf.map((x) => x.trim()).join(" "))
              .replace(/\s+/g, " ")
              .replace(/\s*—?\s*(\([^()]+\.\))$/, "\n$1")
          : unwrap(buf.map((x) => x.trim()).join(" "));
        out.push(t.replace(/\s*\[\d+\]/g, "").replace(/_/g, ""));
      }
      buf = [];
    };
    for (const raw of lines.slice(from, to)) {
      if (!raw.trim()) {
        flush();
        continue;
      }
      const ind = /^\s{8,}\S/.test(raw);
      if (buf.length && ind !== verse) flush();
      verse = ind;
      buf.push(raw);
    }
    flush();
    return out.filter(Boolean);
  };
  // a heading ("Proposition IV.", "First Proposition.", "Third Argument.") opens the paragraph after it
  const isSub = (t: string) => /^(?:Proposition [IVXL]+|(?:The )?\w+ (?:Proposition|Argument|Method))\.$/.test(t);
  const toVerses = (ps: string[]) =>
    ps
      .reduce<string[]>((a, t) => (a.length && isSub(a[a.length - 1]) ? [...a.slice(0, -1), `${a[a.length - 1]}\n${t}`] : [...a, t]), [])
      .map((t, k) => ({ v: String(k + 1), t }));
  await resetVersion("guide-perplexed", "friedlander");
  let total = 0;
  const write = async (book: string, n: number, ps: string[], title?: string) => {
    if (!ps.length) throw new Error(`guide: empty ${book} ${n}`);
    await writeChapter("guide-perplexed", "friedlander", book, n, toVerses(ps), undefined, title);
    total += ps.length;
  };
  // Maimonides' Introduction, in four parts
  const heads: [RegExp, string][] = [
    [/^\[Letter of the Author to his Pupil/, "Letter to his Pupil, R. Joseph Ibn Aknin"],
    [/^\[PREFATORY REMARKS\.\]$/, "Prefatory Remarks"],
    [/^DIRECTIONS FOR THE STUDY OF THIS WORK\.$/, "Directions for the Study of This Work"],
    [/^INTRODUCTORY REMARKS\.$/, "Introductory Remarks: On Method"],
  ];
  const hs = heads.map(([re]) => at(re, intro));
  for (const [k, h] of hs.entries()) {
    let ps = paras(h + 1, hs[k + 1] ?? p1);
    if (k === 3) ps = ps.filter((p) => p !== "[On Method.]");
    await write("introduction", k + 1, ps, heads[k][1]);
  }
  // the Parts: "CHAPTER I" … ; what comes before chapter I is the Part's epigraph (I) or introduction (II, III)
  const parts: [string, number, number, number][] = [
    ["part-1", p1, p2, 76],
    ["part-2", p2, p3, 48],
    ["part-3", p3, end, 54],
  ];
  for (const [book, from, to, n] of parts) {
    const chs: number[] = [];
    for (let k = from; k < to; k++) if (/^CHAPTER [IVXL]+\.?$/.test(lines[k].trim())) chs.push(k);
    if (chs.length !== n) throw new Error(`guide: ${book} has ${chs.length} chapters, expected ${n}`);
    chs.forEach((c, j) => {
      if (roman(lines[c].trim().replace(/^CHAPTER |\.$/g, "")) !== j + 1) throw new Error(`guide: ${book} chapter ${j + 1} is ${lines[c]}`);
    });
    const pre = paras(from + 1, chs[0]).filter((p) => p !== "INTRODUCTION");
    if (book === "part-1") {
      // the Part's epigraph opens chapter 1
      await write(book, 1, [...pre, ...paras(chs[0] + 1, chs[1])]);
      for (let j = 1; j < chs.length; j++) await write(book, j + 1, paras(chs[j] + 1, chs[j + 1] ?? to));
    } else {
      await write(`${book}-introduction`, 1, pre, book === "part-2" ? "Introduction: The Propositions" : "Introduction");
      for (let j = 0; j < chs.length; j++) await write(book, j + 1, paras(chs[j] + 1, chs[j + 1] ?? to));
    }
  }
  report("guide-perplexed", 4 + 2 + 178, total);
}

/**
 * The Mabinogion — tr. Lady Charlotte Guest (1838–49), Gutenberg #5160. One chapter
 * per tale (12, in her order: the three romances, Kilhwch and Olwen, Rhonabwy, the Four Branches, Maxen, Lludd and
 * Llevelys, Taliesin); verse = paragraph, poems keep their lines. Each Branch's own heading ("Here is the second
 * portion of the Mabinogi") is the chapter note. Her introduction, footnotes and the dividers are left out.
 */
async function mabinogion() {
  const txt = gutenbergBody(await cached("mabinogion", "pg5160.txt", GUT(5160)));
  const lines = txt.split("\n");
  const tales: [RegExp, string][] = [
    [/^THE LADY OF THE FOUNTAIN$/, "The Lady of the Fountain"],
    [/^PEREDUR THE SON OF EVRAWC$/, "Peredur the Son of Evrawc"],
    [/^GERAINT THE SON OF ERBIN$/, "Geraint the Son of Erbin"],
    [/^KILHWCH AND OLWEN$/, "Kilhwch and Olwen, or the Twrch Trwyth"],
    [/^THE DREAM OF RHONABWY$/, "The Dream of Rhonabwy"],
    [/^PWYLL PRINCE OF DYVED$/, "Pwyll Prince of Dyved"],
    [/^BRANWEN THE DAUGHTER OF LLYR$/, "Branwen the Daughter of Llyr"],
    [/^MANAWYDDAN THE SON OF LLYR$/, "Manawyddan the Son of Llyr"],
    [/^MATH THE SON OF MATHONWY$/, "Math the Son of Mathonwy"],
    [/^THE DREAM OF MAXEN WLEDIG$/, "The Dream of Maxen Wledig"],
    [/^HERE IS THE STORY OF LLUDD AND LLEVELYS$/, "The Story of Lludd and Llevelys"],
    [/^TALIESIN$/, "Taliesin"],
  ];
  const intro = lines.findIndex((l) => l.trim() === "INTRODUCTION" && !l.startsWith(" "));
  const end = lines.findIndex((l) => l.trim() === "FOOTNOTES");
  let from = intro;
  const starts = tales.map(([re]) => {
    const i = lines.findIndex((l, k) => k > from && re.test(l.trim()));
    if (i < 0) throw new Error(`mabinogion: ${re} not found`);
    return (from = i);
  });
  await resetVersion("mabinogion", "guest");
  let total = 0;
  for (const [k, s] of starts.entries()) {
    const body = lines.slice(s + 1, starts[k + 1] ?? end);
    let note: string | undefined;
    const paras: string[] = [];
    let buf: string[] = [];
    let poem = false;
    const flush = () => {
      if (buf.length) {
        const t = (poem ? buf.map((x) => x.trim()).join("\n") : unwrap(buf.map((x) => x.trim()).join(" ")))
          .replace(/\s*\{\d+\}/g, "") // footnote marks
          .replace(/_/g, "")
          .replace(/ {2,}/g, " ");
        // the Branch headings ("HERE IS THE SECOND PORTION OF THE MABINOGI") and Kilhwch's "OR THE / TWRCH TRWYTH"
        if (!paras.length && !note && /^[A-Z][A-Z ,.'’\n-]+$/.test(t)) {
          if (/PORTION OF THE MABINOGI/.test(t)) note = titleCase(t.replace(/\n/g, " ")) + ".";
        } else paras.push(t);
      }
      buf = [];
    };
    for (const raw of body) {
      const l = raw.trim();
      if (!l || /^(\* ?)+$/.test(l)) {
        flush();
        continue;
      }
      const ind = /^ {2,}\S/.test(raw);
      if (buf.length && ind !== poem) flush();
      poem = ind;
      buf.push(raw);
    }
    flush();
    // "Pwyll PRINCE OF DYVED was lord…": the opening words set in capitals, as in her book
    if (paras[0]) paras[0] = paras[0].replace(/^(\w+) ([A-Z][A-Z ]+[A-Z])(?= [a-z])/, (_, a: string, b: string) => `${a} ${titleCase(b)}`);
    // and the closing "And this is the tale of THE LADY OF THE FOUNTAIN." likewise
    const last = paras.length - 1;
    paras[last] = paras[last].replace(/\b([A-Z]{2,}(?: [A-Z]{2,})+)(?=\.$)/, (m) => titleCase(m).replace(/^the /, "the "));
    if (!paras.length) throw new Error(`mabinogion: ${tales[k][1]} is empty`);
    await writeChapter("mabinogion", "guest", "mabinogion", k + 1, paras.map((t, j) => ({ v: String(j + 1), t })), note, tales[k][1]);
    total += paras.length;
  }
  report("mabinogion", tales.length, total);
}

/**
 * The Bustan of Sadi — tr. A. Hart Edwards (Wisdom of the East, London: John Murray, 1911), Gutenberg #60471:
 * a prose rendering of Sa'di's Bustan in two books, the Prologue and the ten chapters ("Concerning Justice" …
 * "Concerning Prayer"). Verse = paragraph; each story's or discourse's title labels the paragraph it opens. His
 * introduction and notes (and their marks) are left out.
 */
async function bustan() {
  const txt = gutenbergBody(await cached("bustan", "pg60471.txt", GUT(60471)));
  const lines = txt.split("\n");
  const pro = lines.findIndex((l) => l === "PROLOGUE");
  const end = lines.findIndex((l, k) => k > pro && l === "NOTES");
  const isHead = (l: string) => /^[\p{Lu}][\p{Lu}0-9 ,.;:'’"“”!?()&—\[\]-]*[\p{Lu}.)\]]$/u.test(l) && /\p{Lu}{3}/u.test(l);
  const chapters: { book: string; title?: string; verses: Verse[] }[] = [];
  let label = "";
  let buf: string[] = [];
  const clean = (t: string) => t.replace(/\[\d+\]/g, "").replace(/_/g, "").replace(/ {2,}/g, " ").trim();
  const flush = () => {
    const cur = chapters[chapters.length - 1];
    if (buf.length && cur) {
      cur.verses.push({ v: String(cur.verses.length + 1), t: clean(unwrap(buf.join(" "))), ...(label ? { n: label } : {}) });
      label = "";
    }
    buf = [];
  };
  for (let k = pro; k < end; k++) {
    const l = lines[k].trim();
    if (l === "PROLOGUE") {
      chapters.push({ book: "prologue", verses: [] });
      continue;
    }
    const ch = /^CHAPTER ([IVX]+)$/.exec(l);
    if (ch) {
      flush();
      // the chapter's subject is on the next line that has text
      let j = k + 1;
      while (!lines[j].trim()) j++;
      chapters.push({ book: "bustan", title: titleCase(clean(lines[j].trim())), verses: [] });
      if (roman(ch[1]) !== chapters.filter((c) => c.book === "bustan").length) throw new Error(`bustan: ${l} out of order`);
      k = j;
      continue;
    }
    if (isHead(l) && !lines[k - 1].trim() && !lines[k + 1]?.trim()) {
      flush();
      // titleCase takes the "At" of "Atābak" for the small word "at"
      label = titleCase(clean(l)).replace(/(\p{L})’S\b/gu, "$1’s").replace(/\batābak\b/, "Atābak");
      continue;
    }
    if (!l) flush();
    else buf.push(l);
  }
  flush();
  await resetVersion("bustan", "edwards");
  let total = 0;
  const pr = chapters.filter((c) => c.book === "prologue");
  const bs = chapters.filter((c) => c.book === "bustan");
  if (pr.length !== 1 || bs.length !== 10) throw new Error(`bustan: ${pr.length} prologue, ${bs.length} chapters`);
  await writeChapter("bustan", "edwards", "prologue", 1, pr[0].verses, undefined, "Prologue");
  total += pr[0].verses.length;
  for (const [k, c] of bs.entries()) {
    await writeChapter("bustan", "edwards", "bustan", k + 1, c.verses, undefined, c.title);
    total += c.verses.length;
  }
  report("bustan", 11, total);
}

/**
 * Josephus — tr. William Whiston (1737), Gutenberg #2848 (The Antiquities of the Jews) and #2850 (The Wars of the
 * Jews). Books: each work's Preface, then its books (Antiquities I–XX, Wars I–VII); chapter = Whiston's chapter
 * (his title kept); verse = his numbered section. Each book's summary line ("Containing the interval of …") is the
 * note of its chapter 1. Whiston's footnotes and their marks are left out: the marks ("over1", "soul.2", "; 4 a")
 * are found in order, 1, 2, 3 … through each book, and their number checked against the footnotes it has.
 */
export const JOSEPHUS_BOOKS: { id: string; name: string; chapters: number }[] = [];
async function josephus() {
  const works: [string, string, number][] = [
    ["antiquities", "Antiquities of the Jews", 2848],
    ["wars", "The Wars of the Jews", 2850],
  ];
  type Ch = { title: string; verses: Verse[]; note?: string };
  type Bk = { id: string; name: string; chapters: Ch[]; notes: number[] };
  const all: Bk[] = [];
  for (const [w, wname, gid] of works) {
    const txt = gutenbergBody(await cached("josephus", `pg${gid}.txt`, GUT(gid)))
      // faults in the Gutenberg file: HTML links left in two Wars titles (their number is a note mark, removed below),
      // a doubled phrase (Wars III.7.27), and a footnote spliced into Antiquities XX.11.3 (Whiston: "I will briefly
      // run over this war again, with what befell us therein to this very day")
      .replace(/<a\b[^>]*>(\d+)<\/a>/g, "$1")
      .replace("trumpetersAnd now the trumpeters", "trumpeters")
      .replace(
        /this war 29, and\s+to add what befell them further to that very day, the 13th of Domitian,\s+or A\.D\. 03, is not, that I have observed, taken distinct notice of by\s+any one; nor do we ever again,/,
        "this war 29 again,",
      );
    const lines = txt.split("\n");
    // the text starts at the Preface after the contents
    const start = lines.findIndex((l, k) => /^PREFACE\.?\d*$/.test(l) && /^1\. /.test(lines.slice(k + 1).find((x) => x.trim()) ?? ""));
    if (start < 0) throw new Error(`josephus: no preface in ${w}`);
    const books: Bk[] = [{ id: `${w}-preface`, name: `${wname}: Preface`, chapters: [{ title: "Preface", verses: [] }], notes: [] }];
    let inNotes = false;
    let para: string[] = [];
    let pendingNote = "";
    // Whiston's titles capitalise nearly every word ("Also Concerning Antiochus Grypus, … And Others")
    const titleCased = (t: string) => {
      const w = t.split(/\s+/).filter((x) => /^[\p{L}]/u.test(x));
      return w.length > 1 && w.filter((x) => /^\p{Lu}/u.test(x)).length / w.length > 0.7;
    };
    const flush = () => {
      if (!para.length) return;
      const ch = books[books.length - 1].chapters[books[books.length - 1].chapters.length - 1];
      // a section can begin on a line of its own with no blank line before it (and once as "43,"): split there,
      // but only at the number that comes next
      // the number that comes next, or one after it where the printer skipped one (Antiquities II.6 has no 9)
      const lastNum = () => (ch && ch.verses.length ? Number(ch.verses[ch.verses.length - 1].v) : 0);
      const fits = (n: number, after: number) => n === after + 1 || n === after + 2;
      // "4.24 "Had I": a section number with a note mark glued on
      const SEC = /^(\d+)(?:\.\d{1,3}|[.,])\s/;
      const parts: string[][] = [[]];
      let next = lastNum();
      for (const l of para) {
        const m = SEC.exec(l);
        if (m && fits(Number(m[1]), next) && parts[parts.length - 1].length) parts.push([]);
        if (m && fits(Number(m[1]), next)) next = Number(m[1]);
        parts[parts.length - 1].push(l);
      }
      para = [];
      if (!ch) return;
      // and a section can begin in the middle of a line ("ran away. 3. But Herod"): split at the number that comes
      // next, after the end of a sentence, never after "sect." or "ch."
      const split: string[] = [];
      let want = lastNum() + 1;
      for (const p of parts) {
        let t = unwrap(p.join(" ")).replace(/_/g, "").replace(/^(\d+)\.\d{1,3}\s/, "$1. ");
        const lead = /^(\d+)[.,]\s/.exec(t);
        if (lead && fits(Number(lead[1]), want - 1)) want = Number(lead[1]) + 1;
        for (;;) {
          const re = new RegExp(`(?<=[.!?;:"”’)\\]] ?)(?<!\\b(?:sect|ch|chap|ver|vol|B|Antiq|p|pp|No)\\. ?)${want}\\.(?:\\d{1,3})?\\s+(?=["“‘'(\\[]?\\p{Lu})`, "u");
          const m = re.exec(t);
          if (!m) break;
          split.push(t.slice(0, m.index).trim());
          t = `${want}. ${t.slice(m.index + m[0].length)}`;
          want++;
        }
        split.push(t);
      }
      for (const t of split) {
        const m = /^(\d+)[.,]\s+([\s\S]*)$/.exec(t);
        if (m && fits(Number(m[1]), lastNum())) ch.verses.push({ v: m[1], t: m[2] });
        else if (ch.verses.length) ch.verses[ch.verses.length - 1].t += `\n${t}`; // a section running on to a new paragraph
        else if (t.length < 300 && titleCased(t)) ch.title += ` ${t.replace(/\.$/, "")}`; // the rest of the title, after a gap
        else ch.verses.push({ v: "1", t }); // a chapter whose first section has no number
      }
    };
    for (let k = start + 1; k < lines.length; k++) {
      const raw = lines[k];
      const l = raw.trim();
      const bk = /^BOOK ([IVXL]+)\.(.*)$/.exec(raw);
      if (bk) {
        flush();
        inNotes = false;
        // the summary: the rest of this line and the lines after it, up to the first chapter
        const sum: string[] = [bk[2].trim()];
        let j = k + 1;
        for (; j < lines.length && !/^CHAPTER \d+\./.test(lines[j]); j++) sum.push(lines[j].trim());
        pendingNote = unwrap(sum.filter(Boolean).join(" ")).replace(/\s*—\s*/g, "—").replace(/\s+/g, " ").trim();
        // Antiquities VIII's list of contents is printed again just before the book: the second heading replaces it
        if (books[books.length - 1].id === `${w}-${roman(bk[1])}`) books.pop();
        books.push({ id: `${w}-${roman(bk[1])}`, name: `${wname}, Book ${bk[1]}`, chapters: [], notes: [] });
        k = j - 1;
        continue;
      }
      const ch = /^CHAPTER (\d+|[IVXL]+)\.?(.*)$/.exec(raw); // two are numbered "V." in the Wars
      if (ch) {
        if (!/^\d/.test(ch[1])) ch[1] = String(roman(ch[1]));
        flush();
        inNotes = false;
        // the title: the rest of the line and its run-on lines; or, when the line has only the number (the Wars,
        // and Antiquities XVI.3), the block of lines after the gap
        const tl: string[] = [ch[2].trim()];
        let j = k + 1;
        if (!ch[2].trim()) while (j < lines.length && !lines[j].trim()) j++;
        for (; j < lines.length && lines[j].trim() && !/^\d+\.\s/.test(lines[j]); j++) tl.push(lines[j].trim());
        // a title broken off before its last word, printed after a gap ("… Their Burial At" / "Alexandrium.", XVI.11)
        {
          let g = j;
          while (g < lines.length && !lines[g].trim()) g++;
          const one = lines[g]?.trim() ?? "";
          if (/\b(At|Of|And|The|In|To|By|With|From|Upon)$/.test(tl.join(" ").trim()) && one && one.length < 40 && !lines[g + 1]?.trim()) {
            tl.push(one);
            j = g + 1;
          }
        }
        const b = books[books.length - 1];
        if (Number(ch[1]) !== b.chapters.length + 1) throw new Error(`josephus: ${b.id} chapter ${ch[1]} after ${b.chapters.length}`);
        b.chapters.push({ title: unwrap(tl.filter(Boolean).join(" ")).replace(/\s+/g, " ").replace(/\.$/, ""), verses: [], ...(b.chapters.length ? {} : { note: pendingNote }) });
        k = j - 1;
        continue;
      }
      // the footnotes heading; in Wars VII the first note runs on from it on the same line
      if (/FOOTNOTES:?(\s|$)/.test(l)) {
        flush();
        inNotes = true;
      }
      if (inNotes) {
        // the numbers of the notes it has (some are skipped: Wars IV has no 15)
        for (const m of l.matchAll(/(?:^|\s)(\d+) \(return\)/g)) books[books.length - 1].notes.push(Number(m[1]));
        continue;
      }
      if (!l) flush();
      else para.push(l);
    }
    flush();
    all.push(...books);
  }
  // note marks, in order through each book
  let missing = 0;
  for (const b of all) {
    // the marks run through the chapter titles too ("How Caius 1 Was Slain"): search titles and sections in order
    const titles = b.chapters.map((c) => ({ v: "title", t: c.title }));
    const vs = b.chapters.flatMap((c, k) => [titles[k], ...c.verses]);
    let vi = 0;
    let off = 0;
    // where mark n next occurs from the current place: [verse, index, length] or null
    const find = (n: number): [number, number, number] | null => {
      const re = new RegExp(`(?:^|(?<=[\\p{L}.,;:!?)\\]’”'"]))( ?)${n}(?=[\\s,.;:!?)\\]’”"]|$)`, "gu");
      for (let i = vi; i < vs.length; i++) {
        re.lastIndex = i === vi ? off : 0;
        const m = re.exec(vs[i].t);
        if (m) return [i, m.index, m[0].length];
      }
      return null;
    };
    const before = (a: [number, number, number], c: [number, number, number] | null) => !c || a[0] < c[0] || (a[0] === c[0] && a[1] < c[1]);
    const nums = [...new Set(b.notes)].sort((x, y) => x - y);
    for (const [j, n] of nums.entries()) {
      const at = find(n);
      // a mark the printer left out: do not take a later number for it (it must come before the next mark)
      if (!at || (j + 1 < nums.length && !before(at, find(nums[j + 1])))) {
        missing++;
        console.warn(`josephus: ${b.id} note ${n} not found`);
        continue;
      }
      const [i, idx, len] = at;
      vs[i].t = vs[i].t.slice(0, idx) + vs[i].t.slice(idx + len);
      vi = i;
      off = idx;
    }
    for (const v of vs) v.t = v.t.replace(/\s+([,.;:])/g, "$1").replace(/ {2,}/g, " ").trim();
    b.chapters.forEach((c, k) => (c.title = titles[k].t.replace(/\.$/, "")));
    // no section number may be left inside a section
    for (const [k, c] of b.chapters.entries())
      for (const v of c.verses) {
        const n = Number(v.v) + 1;
        if (new RegExp(`(?:^|[.!?;:"”’)\\]] ?|\\n)${n}\\. \\p{Lu}`, "u").test(v.t)) console.warn(`josephus: ${b.id} ${k + 1}:${v.v} still holds section ${n}`);
      }
  }
  await resetVersion("josephus", "whiston");
  JOSEPHUS_BOOKS.length = 0;
  let total = 0;
  let chapters = 0;
  for (const b of all) {
    for (const [k, c] of b.chapters.entries()) {
      if (!c.verses.length) throw new Error(`josephus: ${b.id} ${k + 1} empty`);
      await writeChapter("josephus", "whiston", b.id, k + 1, c.verses, c.note || undefined, c.title);
      total += c.verses.length;
    }
    chapters += b.chapters.length;
    JOSEPHUS_BOOKS.push({ id: b.id, name: b.name, chapters: b.chapters.length });
  }
  console.log(JOSEPHUS_BOOKS.map((b) => `${b.id} ${b.chapters}`).join(" | "), `| marks not found: ${missing}`);
  report("josephus", chapters, total);
}

/**
 * Aesop's Fables — Three Hundred Aesop's Fables, literally translated from the Greek by George Fyler Townsend
 * (London: Routledge, 1867), Gutenberg #21. One chapter per fable, in his order and under his titles (found one by
 * one from his contents list); verse = paragraph. The opening words he sets in capitals ("A LION was…") are in
 * normal case. His preface, Life of Aesop and index are left out.
 */
async function aesop() {
  const txt = gutenbergBody(await cached("aesop", "pg21.txt", GUT(21)));
  const lines = txt.split("\n");
  const toc0 = lines.findIndex((l) => l.trim() === "AESOP’S FABLES" && l.startsWith(" "));
  const tocEnd = lines.findIndex((l, k) => k > toc0 && l.trim() === "INDEX");
  // (the contents end with his footnotes, which belong to the preface)
  const titles = lines.slice(toc0 + 1, tocEnd).map((l) => l.trim()).filter((t) => t && t !== "FOOTNOTES");
  const body = lines.findIndex((l, k) => k > tocEnd && l.trim() === "AESOP’S FABLES");
  const end = lines.findIndex((l, k) => k > body && (l.trim() === "INDEX" || l.trim() === "FOOTNOTES"));
  // each title as it stands in the text: on its own line, with blank lines around it
  const at: number[] = [];
  let from = body;
  for (const t of titles) {
    const i = lines.findIndex((l, k) => k > from && k < end && l.trim().toLowerCase() === t.toLowerCase() && !lines[k - 1].trim() && !lines[k + 1]?.trim());
    if (i < 0) throw new Error(`aesop: "${t}" not found after line ${from}`);
    at.push((from = i));
  }
  await resetVersion("aesop", "townsend");
  let total = 0;
  const small = /^(A|An|And|The|Of|In|On|At|To|By|For|With|From)$/;
  const smallWord = /^(a|an|and|the|of|in|on|at|to|by|for|with|from|upon|time|once|when|who|which|that|some|one|two|his|her|their|its|was|were|had|having|being|should|would|could|shall|will|there|this|it|is|you|i|we|they|he|she|do|not)$/;
  for (const [k, i] of at.entries()) {
    const ps: string[] = [];
    let buf: string[] = [];
    for (const l of [...lines.slice(i + 1, at[k + 1] ?? end), ""]) {
      if (l.trim()) buf.push(l.trim());
      else if (buf.length) {
        ps.push(unwrap(buf.join(" ")).replace(/_/g, ""));
        buf = [];
      }
    }
    if (!ps.length) throw new Error(`aesop: "${titles[k]}" is empty`);
    ps[0] = ps[0].replace(/^TEE KITES\b/, "THE KITES"); // a misprint (fable 181)
    // "A LION was awakened…", "THE FROGS, grieved…": the capitals of the opening words in normal case
    // the first word capitalised, the others only where the fable capitalises them elsewhere (its characters:
    // "A Lion", "The Frogs", but "Why should")
    const rest = `${ps.join(" ").replace(/^\S+/, "")} ${titles[k]}`;
    ps[0] = ps[0].replace(/^(“?(?:[A-Z’'-]+[,;]? )*[A-Z’'-]{2,}[,;]?)(?= |$)/, (m) =>
      m
        .toLowerCase()
        .split(" ")
        .map((w, j) => {
          const cap = w.replace(/(^“?)(\p{Ll})/u, (_, a: string, b: string) => a + b.toUpperCase());
          if (j === 0) return cap;
          const bare = w.replace(/^“|[,;]$/g, "");
          if (smallWord.test(bare)) return w;
          // the word as the fable or its title writes it, singular or plural ("Charcoal-Burner", "Monkeys")
          const stem = bare.replace(/s$/, "").replace(/[-’']/g, (c) => `\\${c}`);
          const seen = new RegExp(`\\b(${stem}s?)\\b`, "gi");
          const form = [...rest.matchAll(seen)].map((m) => m[1]).find((x) => /^\p{Lu}/u.test(x));
          if (!form) return w;
          // keep this word's own ending, with the fable's capitals
          const parts = bare.split("-");
          const fparts = form.split("-");
          const out = parts.map((p, n) => (fparts[n] && /^\p{Lu}/u.test(fparts[n]) ? p[0].toUpperCase() + p.slice(1) : p)).join("-");
          return w.replace(bare, out);
        })
        .join(" "),
    );
    // Townsend's titles: small words lower-case
    const title = titles[k]
      .split(" ")
      .map((w, j) => (j && small.test(w) ? w.toLowerCase() : w))
      .join(" ");
    await writeChapter("aesop", "townsend", "aesop", k + 1, ps.map((t, j) => ({ v: String(j + 1), t })), undefined, title);
    total += ps.length;
  }
  report("aesop", at.length, total);
}

/**
 * The Confessions of Al Ghazzali (al-Munqidh min al-Dalal) — tr. Claud Field (Wisdom of the East, London: John
 * Murray, 1909), Gutenberg #58977. One chapter per section (8, under Field's headings); verse = paragraph, verse
 * quotations keep their lines. His introduction, footnotes and the dividers are left out.
 */
async function ghazali() {
  const txt = gutenbergBody(await cached("ghazali", "pg58977.txt", GUT(58977)));
  const lines = txt.split("\n");
  const heads: [RegExp, string][] = [
    [/^GHAZZALI’S SEARCH FOR TRUTH$/, "Ghazzali’s Search for Truth"],
    [/^THE SUBTERFUGES OF THE SOPHISTS$/, "The Subterfuges of the Sophists"],
    [/^THE DIFFERENT KINDS OF SEEKERS AFTER TRUTH$/, "The Different Kinds of Seekers after Truth"],
    [/^THE AIM OF SCHOLASTIC THEOLOGY AND ITS RESULTS$/, "The Aim of Scholastic Theology and Its Results"],
    [/^CONCERNING THE PHILOSOPHICAL SECTS AND THE STIGMA OF INFIDELITY WHICH$/, "Concerning the Philosophical Sects and the Stigma of Infidelity Which Attaches to Them All"],
    [/^DIVISIONS OF THE PHILOSOPHIC SCIENCES$/, "Divisions of the Philosophic Sciences"],
    [/^SUFISM$/, "Sufism"],
    [/^THE REALITY OF INSPIRATION: ITS IMPORTANCE FOR THE HUMAN RACE$/, "The Reality of Inspiration: Its Importance for the Human Race"],
  ];
  const body = lines.findIndex((l) => l.trim() === "THE CONFESSIONS OF AL GHAZZALI" && !l.startsWith(" "));
  const end = lines.findIndex((l, k) => k > body && l.trim() === "FOOTNOTES");
  let from = body;
  const at = heads.map(([re]) => {
    const i = lines.findIndex((l, k) => k > from && k < end && re.test(l.trim()));
    if (i < 0) throw new Error(`ghazali: ${re} not found`);
    return (from = i);
  });
  await resetVersion("ghazali", "field");
  let total = 0;
  for (const [k, i] of at.entries()) {
    // chapter 5's heading runs over two lines
    const s = k === 4 ? i + 2 : i + 1;
    const ps: string[] = [];
    let buf: string[] = [];
    let poem = false;
    const flush = () => {
      if (buf.length) ps.push((poem ? buf.join("\n") : unwrap(buf.join(" "))).replace(/\[\d+\]/g, "").replace(/_/g, ""));
      buf = [];
    };
    for (const raw of lines.slice(s, at[k + 1] ?? end)) {
      const l = raw.trim();
      if (!l || /^(\*\s*)+$/.test(l)) {
        flush();
        continue;
      }
      const ind = /^ {2,}\S/.test(raw);
      if (buf.length && ind !== poem) flush();
      poem = ind;
      buf.push(l);
    }
    flush();
    await writeChapter("ghazali", "field", "confessions", k + 1, ps.map((t, j) => ({ v: String(j + 1), t })), undefined, heads[k][1]);
    total += ps.length;
  }
  report("ghazali", at.length, total);
}

const ALL: Record<string, () => Promise<unknown>> = {
  ghazali,
  aesop,
  josephus,
  bustan,
  mabinogion,
  guide,
  legends,
  hafiz,
  rubaiyat,
  goldenVerses,
  artOfWar,
  diamondSutra,
  ptahhotep,
  hammurabi,
  enumaElish,
  sbe3,
  gilgamesh,
  masnavi,
  jataka,
  lotus,
  edda,
  proseEdda,
  kalevala,
  bookOfTheDead,
  quranSpanish,
  popolVuh,
  gathas,
  mencius,
  zhuangzi,
  navaho,
  sioux,
  kojiki,
  yoruba,
  chineseMyths,
  vishnuPurana,
  jaina,
  ttc,
  analects,
  analectsJennings,
  australian,
  hidden,
  aqdas,
  ggs,
  lucretius,
  meditations,
  meditationsChrystal,
  enchiridion,
  hume,
  paine,
};

async function main() {
  const want = process.argv.slice(2);
  for (const [name, fn] of Object.entries(ALL)) if (!want.length || want.includes(name)) await fn();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
