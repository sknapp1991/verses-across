/**
 * Import the Quran (Islam):
 *   - tanzil     Arabic (Uthmani), Tanzil Project, CC BY 3.0. Shown VERBATIM (Tanzil forbids changes);
 *                credit + link in the catalog attribution.
 *   - pickthall  "The Meaning of the Glorious Koran", Marmaduke Pickthall (Knopf, 1930); public domain in
 *                the US since 1 Jan 2026. Text from Wikisource's proofread transcription of the 1930 edition
 *                where available, otherwise from the Internet Archive scan's text layer (MN40248ucmf_9),
 *                cleaned of page headers / footnotes. Aligned word by word to the Arabic (Hafs) numbering
 *                against Tanzil's en.pickthall (data/raw/quran/tanzil-trans/en.pickthall.txt, a later revised
 *                Pickthall in Hafs numbering, Tanzil terms: non-commercial use with credit). The reference only
 *                places verse breaks and replaces scan non-words (align(), cleanScan()); the wording shown is
 *                the 1930 text's. Every scan repair is listed by `PICK_FIXES=<file.json>`.
 * One book "quran" with 114 chapters (surahs). Pickthall counts the Bismillah of Surah 1 as a heading
 * and divides some verses differently; we align it to the standard numbering and keep his number in `n`
 * (Wikisource surahs and Surah 1 only: the scan's verse numbers are too often misread to show).
 *
 *   npx tsx scripts/import-quran.ts && npx tsx scripts/fix-texts.mts --only quran/pickthall
 *   (sources cached in data/raw/; PICK_DIAG=1 / PICK_GAPS=1 print alignment diagnostics)
 */
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chapterSchema } from "../src/lib/schema";

const ROOT = path.resolve(__dirname, "..");
const RAW = path.join(ROOT, "data", "raw");
const OUT = path.join(ROOT, "data", "texts", "quran");
const UA = { "User-Agent": "VersesAcross-importer/1.0 (https://versesacross.com)" };
const exists = (p: string) => access(p).then(() => true, () => false);

async function cached(file: string, url: string) {
  const p = path.join(RAW, file);
  if (!(await exists(p))) {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, await res.text());
  }
  return readFile(p, "utf8");
}

/** `to`: this English verse also covers a later standard verse; `cont`: this verse's text is in "s:v". */
type Verses = Map<number, { t: string; n?: string; to?: string; cont?: string }>;

/* ---------- Arabic (Tanzil) ---------- */
async function arabic(): Promise<Map<number, Verses>> {
  const txt = await readFile(path.join(RAW, "tanzil", "quran-uthmani.txt"), "utf8");
  const out = new Map<number, Verses>();
  for (const line of txt.split(/\r?\n/)) {
    const m = /^(\d+)\|(\d+)\|(.+)$/.exec(line);
    if (!m) continue;
    const s = +m[1];
    (out.get(s) ?? out.set(s, new Map()).get(s)!).set(+m[2], { t: m[3].trim() });
  }
  return out;
}

/* ---------- Pickthall ---------- */
function roman(r: string) {
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let n = 0;
  for (let i = 0; i < r.length; i++) {
    const a = v[r[i]], b = v[r[i + 1]] ?? 0;
    n += a < b ? -a : a;
  }
  return n;
}
const tidy = (t: string) =>
  t
    .replace(/[  ]/g, " ")
    .replace(/([.,;:!?)'"’”])\s*\d{1,2}(?=\s|$)/g, "$1") // footnote reference numbers after punctuation
    .replace(/([a-z])\s+\d{1,2}(?=\s+[a-z])/g, "$1") // …and between words ("the taming 1 of Qureysh")
    .replace(/\s+/g, " ")
    .trim();

/** Wikisource: one page per surah, "N text" lines (proofread 1930 text). */
async function wikisource(): Promise<Map<number, Verses>> {
  const list = JSON.parse(
    await cached(
      "pickthall-wikisource/_list.json",
      "https://en.wikisource.org/w/api.php?action=query&list=allpages&apprefix=The%20Meaning%20of%20the%20Glorious%20Koran%20(1930)/&aplimit=500&format=json",
    ),
  ) as { query: { allpages: { title: string }[] } };
  const out = new Map<number, Verses>();
  for (const { title } of list.query.allpages) {
    const slug = title.split("/").pop()!.replace(/[^A-Za-z0-9]+/g, "_");
    const json = JSON.parse(
      await cached(
        `pickthall-wikisource/${slug}.json`,
        `https://en.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(title.replace(/ /g, "_"))}&prop=text&format=json&formatversion=2`,
      ),
    ) as { parse?: { text: string } };
    if (!json.parse) continue;
    let h = json.parse.text;
    h = h.replace(/<style[\s\S]*?<\/style>/g, "");
    h = h.replace(/<sup[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/g, "");
    h = h.replace(/<span[^>]*class="[^"]*(pagenum|ws-pagenum)[^"]*"[^>]*>[\s\S]*?<\/span>/g, "");
    h = h.replace(/<(ol|div)[^>]*class="[^"]*references[^"]*"[\s\S]*?<\/\1>/g, "");
    h = h.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/g, "\n").replace(/<[^>]+>/g, "");
    // A line opening with a no-break space carries on the verse before (2:87 "Is it ever so…").
    h = h.replace(/\n[ \t]*&#160;/g, "\n\u0001");
    const text = h.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const head = /S[ÛU]RAH\s+([IVXLC]+)\b/.exec(text);
    if (!head) continue;
    const surah = roman(head[1]);
    const verses: Verses = new Map();
    let expect = 1;
    for (const raw of text.split("\n")) {
      if (raw.startsWith("\u0001") && verses.has(expect - 1) && !raw.slice(1).trim().startsWith(`${expect} `)) {
        const x = verses.get(expect - 1)!;
        if (raw.slice(1).trim()) x.t = tidy(`${x.t} ${raw.slice(1)}`);
        continue;
      }
      const line = raw.replace("\u0001", "").trim();
      // "173a", "173b": the transcription's halves of one printed verse (4:173).
      const m = /^(\d{1,3})([a-c])?\s+(.+)$/.exec(line);
      if (m && m[2] && m[2] !== "a" && +m[1] === expect - 1) {
        const x = verses.get(expect - 1)!;
        x.t = tidy(`${x.t} ${m[3]}`);
      } else if (m && +m[1] === expect) {
        verses.set(expect, { t: tidy(m[3]) });
        expect++;
      }
    }
    if (verses.size) out.set(surah, verses);
  }
  return out;
}

/**
 * Internet Archive scan text layer (Knopf 1930), for surahs not yet on Wikisource.
 * Driven by the standard verse counts (facts, from the Arabic numbering): after the last verse of a surah,
 * the next "1." starts the next surah, so garbled headings don't matter. Common misreadings of verse
 * numbers ("ii." for 11, "l." for 1, "O" for 0…) are mapped back to digits.
 */
async function scan(counts: Map<number, number>): Promise<Map<number, Verses>> {
  const txt = await cached("pickthall-ia/MN40248ucmf_9_djvu.txt", "https://archive.org/download/MN40248ucmf_9/MN40248ucmf_9_djvu.txt");
  const lines = txt.split(/\r?\n/);
  const out = new Map<number, Verses>();
  let surah = 0;
  let expect = 1;
  // cand: indexes into parts of lines that look like a verse start whose number was unreadable
  let cur: { v: number; parts: string[]; cand: number[] } | null = null;
  let inFootnote = false;
  let pending = 0; // a readable "SURAH XXVII" heading: the next "1." starts that surah
  const header = /^([ivxlc]+\s+[A-Z][A-Za-z' ,.\-]+\s+\d+|\d+\s+[A-Z][A-Za-z' ,.\-]+\s+[ivxlc]+|[\dIl]{1,3}|[ivxlc]+)$/;
  const num = (tok: string) => {
    const d = tok.replace(/[lI|!iJ]/g, "1").replace(/[Oo]/g, "0").replace(/S/g, "5").replace(/B/g, "8").replace(/Z/g, "2").replace(/G/g, "6");
    return /^\d{1,3}$/.test(d) ? +d : NaN;
  };
  const save = (v: number, parts: string[]) => {
    const t = tidy(parts.join(" ").replace(/-\s+(?=[a-z])/g, ""));
    (out.get(surah) ?? out.set(surah, new Map()).get(surah)!).set(v, { t });
  };
  /** Save the current verse. Verses whose numbers were unreadable stay inside it here: align() splits
   * them off against the reference. (Guessing the split from lines like "you. And We cause…" cut words
   * off: 22:5 lost "you.", 22:60 "Mild,".) */
  const flush = () => {
    if (cur && surah) save(cur.v, cur.parts);
    cur = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Headings are in capitals ("SURAH XIX", scanned as "SORAH", "SDRAH"…); running text says "Surah X."
    const heading = /^S[A-Za-z0-9ÛÜ>]{0,3}R[AÂ]H\s+([IVXLC]+)\.?$/.exec(line); // also "StjRAH V", "SftRAH VI"
    if (heading) {
      const r = roman(heading[1].toUpperCase());
      if (r > surah && r <= 114) {
        flush();
        pending = r;
        expect = Infinity; // ignore numbers until this surah's verse 1
      }
      continue;
    }
    // Running heads: "250 THE GLORIOUS KORAN SURAH" (even pages), "xii - JOSEPH 239" (odd pages). Missing
    // them left the text after a page's footnotes out (13:11–12, 20:116, 28:61…).
    const runningHead =
      line.length < 70 &&
      (/G\s?L\s?O\s?R\s?I\s?O\s?U\s?S\s+K\s?O\s?R\s?A|\bK\s?O\s?R\s?A\s?N\s+S\S{0,3}R/.test(line) ||
        /^S\S{0,3}RAH\s*[ivxlcmnujIVXLC]+\s+[A-Z].*\d\s*$/.test(line) ||
        /^[ivxlcmnujIVXL]{1,8}\s*[-.]?\s+[A-Z][A-Z' ,.\-]{2,}[\s.]*[\dizoIlSn]{0,4}$/.test(line));
    if (header.test(line) || runningHead) {
      inFootnote = false; // a new page starts after the footnotes
      continue;
    }
    const lead = /^["'‘“/]?([0-9lIi|!JOoSBZG]{1,4})\s*([.,:;])?\s*(.*)$/.exec(line);
    const n = lead ? num(lead[1]) : NaN;
    const total = counts.get(surah) ?? Infinity;
    // Pickthall's 1930 numbering can run a few verses longer than the standard one (e.g. 6:166).
    const done = surah > 0 && expect > total + 3;
    // Start of the next surah: verse "1." once the current surah is (nearly) complete — a few verse
    // numbers may have been unreadable — or at the very beginning.
    const nearlyDone = surah > 0 && expect > total - Math.max(2, Math.ceil(total * 0.04));
    // After a readable heading, verse 1 may itself be unreadable: start at verse 2 or 3 then (gap before).
    if (pending && n >= 2 && n <= 3 && lead![2]) {
      flush();
      surah = pending;
      pending = 0;
      expect = n + 1;
      inFootnote = false;
      cur = { v: n, parts: [lead![3]], cand: [] };
      continue;
    }
    if ((surah === 0 || done || nearlyDone || pending) && n === 1 && lead![2] && surah < 114) {
      flush();
      surah = pending || surah + 1;
      pending = 0;
      expect = 2;
      inFootnote = false;
      cur = { v: 1, parts: [lead![3]], cand: [] };
      continue;
    }
    if (!surah) continue;
    // The expected verse, or one or two further on when a verse number was unreadable (left as a gap).
    if (!done && n >= expect && n <= expect + 6 && n <= total + 3 && (lead![2] || n >= 10) && /^[A-Z(‘'"“]/.test(lead![3] || "A")) {
      flush();
      inFootnote = false;
      cur = { v: n, parts: [lead![3]], cand: [] };
      expect = n + 1;
      continue;
    }
    if (/^\d{1,2}\s+[A-Z(‘'"][a-z.']/.test(line) && cur) { // not "1 G>" (a stray mark, 17:1)
      inFootnote = true; // "1 Three letters of the Arabic alphabet…"
      continue;
    }
    if (inFootnote || !cur || done) continue;
    if (/^(Revealed at|In the name of Allah|S[UÛOÜ]R[AÂ]H\b)/i.test(line)) continue;
    if (/^\S{1,5}\s*[.,:;]\s+[A-Z(‘'"“]/.test(line)) cur.cand.push(cur.parts.length);
    cur.parts.push(line);
  }
  flush();
  if (process.env.DEBUG_SCAN) for (const [k, v] of out) console.log("scan surah", k, "verses", v.size, "max", Math.max(...v.keys()));
  return out;
}

async function write(version: string, data: Map<number, Verses>) {
  const dir = path.join(OUT, version, "quran");
  await rm(path.join(OUT, version), { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (let s = 1; s <= 114; s++) {
    const vs = data.get(s);
    if (!vs?.size) continue;
    const verses = [...vs.entries()]
      .filter(([, x]) => x.t || x.cont)
      .sort((a, b) => a[0] - b[0])
      .map(([v, x]) => ({ v: String(v), t: x.t, ...(x.to ? { to: x.to } : {}), ...(x.n ? { n: x.n } : {}), ...(x.cont ? { cont: x.cont } : {}) }));
    const ch = chapterSchema.parse({ work: "quran", version, book: "quran", chapter: s, verses });
    await writeFile(path.join(dir, `${s}.json`), `{"work":"quran","version":"${version}","book":"quran","chapter":${s},"verses":[\n${ch.verses.map((x) => JSON.stringify(x)).join(",\n")}\n]}\n`);
  }
}

/**
 * Line Pickthall's verses up with the standard (Hafs) numbering, word by word, against a reference copy
 * of Pickthall that is already in Hafs numbering (Tanzil's en.pickthall, data/raw/quran/tanzil-trans; used
 * only to find where each Hafs verse starts — the words shown are the 1930 text's). Where a Hafs verse
 * starts inside one of his verses (he, or the scan, ran two together), his verse is split there; where
 * no clean place to split exists, his verse stays whole on the first verse and the next is a "see v."
 * slot (`to` / `cont`). His own number stays in `n`.
 */
type Tok = { w: string; k: string; p: number }; // word, normalized key, index of his verse
const key = (w: string) => w.normalize("NFD").toLowerCase().replace(/[^a-z]/g, "");
const isNum = (w: string) => /^["'‘“(]?[\dlIiOoSB|!]{1,4}[.,:;*]?$/.test(w) && /\d/.test(w);
/** What the scan left of a verse number it couldn't read ("12", "6.", "F57.", "^", "."): a digit, or
 * neither letters nor quote marks. */
const junk = (w: string) => /\d/.test(w) || (!/[A-Za-z]/.test(w) && !/^["'‘’“”()]+$/.test(w));
function near(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  // one edit apart
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}
/** Banded LCS of two token lists (near-identical texts): ref token index → P token index (or -1). */
function lcs(P: Tok[], R: { k: string }[]): Int32Array {
  const n = P.length, m = R.length, W = 700;
  const lo = (i: number) => Math.max(0, Math.floor((i * m) / Math.max(1, n)) - W);
  const width = 2 * W + 2;
  const dir = new Uint8Array((n + 1) * width); // 1 diag, 2 up (skip P), 3 left (skip R)
  let prev = new Float64Array(m + 1), cur = new Float64Array(m + 1);
  for (let i = 1; i <= n; i++) {
    const j0 = Math.max(1, lo(i - 1)), j1 = Math.min(m, lo(i - 1) + width - 1);
    cur.fill(0);
    for (let j = j0; j <= j1; j++) {
      const a = P[i - 1].k, b = R[j - 1].k;
      const s = a && b ? (a === b ? 1 : near(a, b) ? 0.7 : 0) : 0;
      let best = prev[j], d = 2;
      if (cur[j - 1] > best) { best = cur[j - 1]; d = 3; }
      if (s && prev[j - 1] + s >= best) { best = prev[j - 1] + s; d = 1; }
      cur[j] = best;
      dir[i * width + (j - lo(i - 1))] = d;
    }
    [prev, cur] = [cur, prev];
  }
  const map = new Int32Array(m).fill(-1);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const off = j - lo(i - 1);
    const d = off >= 0 && off < width ? dir[i * width + off] : 0;
    if (d === 1) { map[j - 1] = i - 1; i--; j--; }
    else if (d === 3) j--;
    else if (d === 2) i--;
    else if (off < 0) i--; // left the band: walk back towards it
    else j--;
  }
  return map;
}

let refCache: Map<number, Map<number, string>> | null = null;
async function reference() {
  if (refCache) return refCache;
  const txt = await cached("quran/tanzil-trans/en.pickthall.txt", "https://tanzil.net/trans/?transID=en.pickthall&type=txt-2");
  refCache = new Map();
  for (const line of txt.split(/\r?\n/)) {
    const m = /^(\d+)\|(\d+)\|(.+)$/.exec(line);
    if (m) (refCache.get(+m[1]) ?? refCache.set(+m[1], new Map()).get(+m[1])!).set(+m[2], m[3]);
  }
  return refCache;
}

/** Hafs verses with no clean place to split them from the verse before: kept joined ("see v."), by hand. */
const JOIN = new Set<string>([]);

/** What the alignment did that isn't a plain 1:1, for the import report. */
const alignNotes: string[] = [];

type RTok = { w: string; k: string; v: number };
/** Stretches between two matched words where either text has words the other lacks: P[p0,p1) vs R[r0,r1). */
function gaps(P: Tok[], R: RTok[], map: Int32Array) {
  const out: { p0: number; p1: number; r0: number; r1: number }[] = [];
  let pi = -1, rj = -1;
  const visit = (j: number, i: number) => {
    if (i - pi > 1 || j - rj > 1) out.push({ p0: pi + 1, p1: i, r0: rj + 1, r1: j });
    pi = i;
    rj = j;
  };
  for (let j = 0; j < R.length; j++) if (map[j] >= 0) visit(j, map[j]);
  visit(R.length, P.length);
  return out;
}

/** English words (lower case, letters only) from proofread texts: Wikisource's Pickthall, the reference, the KJV. */
const VOCAB = new Set<string>();
/** Spellings the scan has that aren't in VOCAB but are plausibly the 1930 text's own: left as they are. */
const OWN_SPELLING = new Set(["impostor", "sayeth", "commiteth", "similtudes"]);
const isWord = (w: string) =>
  w.split(/[-—]+/).every((part) => {
    const k = key(part);
    return !k || VOCAB.has(k) || OWN_SPELLING.has(k) || (k.endsWith("s") && VOCAB.has(k.slice(0, -1)));
  });
/** Every scan correction, for data/raw/pickthall-fixes.md: [surah:verse, rule, before, after]. */
const fixLog: [string, string, string, string][] = [];
const PUNCT = /^[?!;:,.]+$/;
/** Words the scan has and the reference lacks that are Pickthall's own (checked against the scan by hand). */
const KEEP_EXTRA = new Set<string>(["17:59", "22:71", "30:47"]);
/** Scan errors no rule above mends, fixed by hand after reading the scan: [surah, verse, scan text, 1930 text]. */
const SCAN_HAND: [number, number, string, string][] = [
  [9, 73, "journey's-end.", "journey's end."],
  [14, 31, 'neither train" nor', "neither traffick nor"],
  [20, 117, "We said: Adam!", "We said: O Adam!"],
  [25, 53, "sweet, and the earth. other saltish", "sweet, and the other saltish"],
  [38, 63, " i A prophet of the Arabs whose story is like that of Ezekiel.", ""],
  [11, 44, "wrongdoing folk! O O", "wrongdoing folk!"],
  [20, 132, "for righteousness. I O", "for righteousness."],
  [38, 78, "Day of Judgement. o.", "Day of Judgement."],
  [22, 3, "fro ward", "froward"],
  [6, 105, "' 'Thou hast studied, ' '", '"Thou hast studied,"'],
  [6, 128, "He will i Al-Islam. say:", "He will say:"],
  [7, 126, "(unto Thee.", "(unto Thee)."],
  [11, 8, "What withholdeth it)", "What withholdeth it?"],
  [11, 31, "treasures of Allah' nor", 'treasures of Allah" nor'],
  [11, 31, "give them good Allah knoweth best what is in their hearts Lo!", "give them good—Allah knoweth best what is in their hearts—Lo!"],
  [15, 87, "(verses and", "(verses) and"],
  [19, 11, "sanctuary. and", "sanctuary, and"],
  [32, 29, "Say (unto them:", "Say (unto them):"],
  [37, 129, "(the salutation:", "(the salutation):"],
  [30, 26, "heavens and o in the earth", "heavens and in the earth"],
  [38, 8, "Hath, the reminder", "Hath the reminder"],
  [21, 5, "dreams; nay he hath", "dreams; nay, he hath"], // the scan has "nay*"
  [28, 76, "Moses ' folk", "Moses' folk"],
  [41, 31, "for which ye.", "for which ye pray."], // the scan has only "." on the line: word from the reference
];
function lev(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}
/** The reference's word with the scan's capitalisation of its first letter, when the scan read that letter right. */
const asCase = (ref: string, scan: string) => {
  const a = scan.search(/[A-Za-z]/), b = ref.search(/[A-Za-z]/);
  if (a < 0 || b < 0 || scan[a].toLowerCase() !== ref[b].toLowerCase()) return ref;
  const up = scan[a] === scan[a].toUpperCase();
  return ref.slice(0, b) + (up ? ref[b].toUpperCase() : ref[b].toLowerCase()) + ref.slice(b + 1);
};

/**
 * Scan (OCR) repairs, using the reference only where the 1930 scan has no real word: what's left of
 * verse numbers and marks, words the scan broke or ran together, non-words read for words, "I"/"l" read
 * for "!", and footnotes / running heads / surah introductions caught between words. Real words that
 * differ from the reference (its later revision: "God" → "Allah", "Friend" → "Guardian") are left alone.
 */
function cleanScan(s: number, P: Tok[], R: RTok[], map: Int32Array, vOf: (i: number) => number) {
  const log = (v: number, rule: string, from: string, to: string) => fixLog.push([`${s}:${v}`, rule, from, to]);
  // Matched words with one letter misread ("trie", "Lol"): a non-word becomes the reference's word.
  for (let j = 0; j < R.length; j++) {
    const i = map[j];
    if (i < 0) continue;
    // Marks stuck to a word ("/of", "therein^", "Allah1").
    const bare = P[i].w.replace(/[\/^|\\{}_~<>*\[\]]/g, "").replace(/(?<=[A-Za-z][.,;:!?'’"”)]?)\d+$/, "");
    if (bare !== P[i].w && bare && !/[\/^|\\{}_~<>*\[\]\d]/.test(R[j].w)) {
      log(R[j].v, "stray mark / verse number", P[i].w, bare);
      P[i].w = bare;
    }
    // "Lo." / "Lo" for "Lo!" (the "!" misread or dropped).
    if (/^[Ll]o[.,]?$/.test(P[i].w) && /^[Ll]o!$/.test(R[j].w)) {
      log(R[j].v, "misread punctuation", P[i].w, `${P[i].w[0]}o!`);
      P[i].w = `${P[i].w[0]}o!`;
      continue;
    }
    if (P[i].k === R[j].k || isWord(P[i].w)) continue;
    const to = asCase(R[j].w, P[i].w);
    log(R[j].v, "misread word", P[i].w, to);
    P[i].w = to;
  }
  /** Mend a stretch of scan words against the reference's; false if no rule fits. */
  const mend = (v: number, rest: Tok[], rs: RTok[], final: boolean): boolean => {
    const replace = (rule: string, to: string) => {
      log(v, rule, rest.map((x) => x.w).join(" "), to);
      rest[0].w = to;
      for (const x of rest.slice(1)) x.w = "";
      return true;
    };
    const pk = rest.map((x) => x.k).join(""), rk = rs.map((x) => x.k).join("");
    if (rs.length && pk === rk && rest.length > rs.length) {
      // A word broken at a line end ("deliver eth", "Qur 'an."): put back together as the scan has it.
      const hyph = rs.some((x) => x.w.includes("-"));
      return replace("word broken by the scan", rest.map((x, n) => (n < rest.length - 1 && !hyph ? x.w.replace(/-$/, "") : x.w)).join(""));
    }
    const fromRef = () => rs.map((x, n) => (n === 0 ? asCase(x.w, rest[0].w) : x.w)).join(" ");
    const close = rs.length > 0 && (pk === rk || (Math.min(pk.length, rk.length) >= 6 && lev(pk, rk) <= 2));
    if (close && (rest.length !== rs.length || pk === rk)) {
      // Words run together ("disbelieveareinfalse…") or garbled across a space ("abundr ance").
      return replace(rest.length < rs.length ? "words run together" : "garbled word", fromRef());
    }
    if (rest.length === rs.length) {
      rest.forEach((x, n) => {
        if (isWord(x.w)) return;
        const to = asCase(rs[n].w, x.w);
        log(v, "misread word", x.w, to);
        x.w = to;
      });
      return true;
    }
    if (final && rest.every((x) => !isWord(x.w)) && rs.length && rs.length <= 3) return replace("garbled word", fromRef());
    return false;
  };
  /** A token as the scan may have misread a word: "110" = "no", "011" = "on", "1" = "I". */
  const shape = (w: string) =>
    w.toLowerCase().replace(/11/g, "n").replace(/rn/g, "m").replace(/[1l|!]/g, "i").replace(/0/g, "o").replace(/5/g, "s").replace(/8/g, "b").replace(/[^a-z]/g, "");
  const shapeFits = (w: string, r: RTok) => {
    const a = shape(w);
    if (!a || !r.k) return false;
    if (a === r.k || (r.k === "i" && /^[1lI|!]$/.test(w.replace(/[.,;:]$/, "")))) return true;
    return a.length >= 3 && r.k.length >= 3 && lev(a, r.k) <= 1;
  };
  const isPunctTok = (w: string) => PUNCT.test(w);
  const endPunct = (w: string) => /[.,;:!?]$/.test(w);
  for (const g of gaps(P, R, map)) {
    const orig = P.slice(g.p0, g.p1).map((x) => x.w);
    try {
    const v = vOf(g.p0 < g.p1 ? g.p0 : Math.max(0, g.p0 - 1));
    const ps = P.slice(g.p0, g.p1), rs = R.slice(g.r0, g.r1).filter((x) => x.k);
    const pText = ps.map((x) => x.w).join(" ");
    const prev = g.p0 > 0 ? P[g.p0 - 1] : null;
    const prevR = g.r0 > 0 ? R[g.r0 - 1] : null;
    /** Join punctuation the scan set apart to the word before; never double it ("me.." → "me."). */
    const attach = (x: Tok, before: Tok | null) => {
      if (!before?.w) return false;
      if (endPunct(before.w)) {
        log(v, "doubled punctuation", `${before.w} ${x.w}`, before.w);
      } else {
        log(v, "space before punctuation", `${before.w} ${x.w}`, before.w + x.w);
        before.w += x.w;
      }
      x.w = "";
      return true;
    };
    // Punctuation set apart ("sense ?") and a possessive ("potter 's") join their word.
    let lead = 0;
    while (lead < ps.length && prev && (isPunctTok(ps[lead].w) || /^['’]s\b/.test(ps[lead].w))) {
      if (isPunctTok(ps[lead].w)) attach(ps[lead], prev);
      else {
        log(v, "space before punctuation", `${prev.w} ${ps[lead].w}`, prev.w + ps[lead].w);
        prev.w += ps[lead].w;
        ps[lead].w = "";
      }
      lead++;
    }
    let rest = ps.slice(lead);
    if (!rest.length) continue;
    // Footnotes, running heads and the next surah's introduction caught in the text (nothing in the reference).
    if (!rs.length && (rest.length >= 3 || /^i\.e\./.test(rest[0].w)) && !KEEP_EXTRA.has(`${s}:${v}`) && !rest.every((x) => isWord(x.w) && !junk(x.w)) ) {
      log(v, "footnote / page head / introduction", rest.map((x) => x.w).join(" "), "");
      for (const x of rest) x.w = "";
      continue;
    }
    if (!rs.length && rest.length >= 3 && !KEEP_EXTRA.has(`${s}:${v}`)) {
      // Only real words, nothing in the reference: footnote prose, or Pickthall's own words? Footnotes start
      // with a footnote mark or "i.e."; otherwise keep the words and say so.
      if (/^(?:i\.e\.|[1-9i*]$|A tradition|I give the usual)/.test(rest[0].w + (rest[1] ? ` ${rest[1].w}` : "")) || /^[1-9i*]$/.test(rest[0].w)) {
        log(v, "footnote / page head / introduction", rest.map((x) => x.w).join(" "), "");
        for (const x of rest) x.w = "";
      } else alignNotes.push(`KEPT ${s}:${v} words not in the reference: ${rest.map((x) => x.w).join(" ")}`);
      continue;
    }
    // A footnote printed inside a word broken at a line end: "pro- [footnote] tecting".
    if (rs.length === 1 && rest.length >= 4 && rest[0].w.endsWith("-") && rest[0].k + rest[rest.length - 1].k === rs[0].k) {
      const to = rest[0].w.slice(0, -1) + rest[rest.length - 1].w;
      log(v, "footnote inside a broken word", rest.map((x) => x.w).join(" "), to);
      rest[0].w = to;
      for (const x of rest.slice(1)) x.w = "";
      continue;
    }
    // Punctuation set apart inside the stretch joins the word before it.
    rest = rest.filter((x, n) => {
      if (!isPunctTok(x.w)) return true;
      const before = n === 0 ? prev : rest[n - 1].w ? rest[n - 1] : null;
      return !attach(x, before);
    });
    if (!rest.length) continue;
    const doubtful = (x: Tok) => junk(x.w) || !isWord(x.w) || x.w.replace(/[^A-Za-z]/g, "").length <= 2;
    // A word the scan misread as a verse number or a mark, where the reference has a word: "110" → "no",
    // "011" → "on", "1" → "I". Paired in order; the reference word replaces it.
    {
      let r = 0;
      for (const x of rest) {
        if (!x.w || !doubtful(x) || isWord(x.w) && x.w.replace(/[^A-Za-z]/g, "").length > 2) continue;
        let hit = -1;
        for (let j = r; j < rs.length; j++) if (shapeFits(x.w, rs[j])) { hit = j; break; }
        if (hit < 0) continue;
        const to = asCase(rs[hit].w, x.w).replace(/[.,;:!?]+$/, "") + (x.w.match(/[.,;:!?]+$/)?.[0] ?? "");
        if (to !== x.w) log(v, "misread word (read as a number or mark)", x.w, to);
        x.w = to;
        x.k = rs[hit].k;
        r = hit + 1;
      }
    }
    // A "!" or "?" the scan read as "1", "l" or "I" after a word: the reference has the mark, the scan a token.
    if (prev && prevR && /[!?]$/.test(prevR.w) && !/[!?]$/.test(prev.w) && /^[Il1|]$/.test(rest[0].w) && !rs.some((x) => x.k === "i")) {
      const mark = prevR.w.slice(-1);
      log(v, `"I" for "${mark}"`, `${prev.w} ${rest[0].w}`, prev.w.replace(/[.,;:]$/, "") + mark);
      prev.w = prev.w.replace(/[.,;:]$/, "") + mark;
      rest[0].w = "";
      rest = rest.slice(1);
      if (!rest.length) continue;
    }
    // Words broken or run together, trying the stretch without one or two doubtful tokens too ("N co me" → "come").
    const tryConcat = (): boolean => {
      const cands = rest.map((x, n) => (doubtful(x) ? n : -1)).filter((n) => n >= 0);
      const drops: number[][] = [[]];
      for (const a of cands) drops.push([a]);
      for (const a of cands) for (const b of cands) if (a < b) drops.push([a, b]);
      for (let d of drops) {
        // Tokens with no letters (numbers, marks) never belong to the word.
        const bare = rest.map((x, n) => n).filter((n) => !rest[n].k && !d.includes(n));
        d = [...d, ...bare];
        const keep = rest.filter((_, n) => !d.includes(n));
        if (!keep.length || !rs.length) continue;
        const pk = keep.map((x) => x.k).join(""), rk = rs.map((x) => x.k).join("");
        if (pk !== rk || (keep.length === rs.length && keep.every((x, n) => x.k === rs[n].k))) continue;
        // Real words only, nothing dropped and no line-end hyphen: Pickthall's own spacing ("any one").
        if (!d.length && keep.every((x) => isWord(x.w)) && !keep.some((x) => x.w.endsWith("-"))) continue;
        for (const n of d) {
          log(v, junk(rest[n].w) ? "stray mark / verse number" : "stray letters (misread verse number)", rest[n].w, "");
          rest[n].w = "";
        }
        mend(v, keep, rs, false);
        return true;
      }
      return false;
    };
    if (rs.length && tryConcat()) continue;
    // Marks and numbers left over go.
    rest = rest.filter((x) => {
      if (junk(x.w) && !/^[-—]+$/.test(x.w)) {
        log(v, "stray mark / verse number", x.w, "");
        x.w = "";
        return false;
      }
      return true;
    });
    if (!rest.length) continue;
    // "no." / "in." / "ii." for 110 / 111 / 11: a misread verse number the reference doesn't have.
    rest = rest.filter((x) => {
      const num = /^(?:no|in|ii|io|il|ill|iii|n|m)[.,]$/.test(x.w) && !rs.some((y) => y.k === x.k);
      if (num) {
        log(v, "stray letters (misread verse number)", x.w, "");
        x.w = "";
      }
      return !num;
    });
    if (!rest.length) continue;
    if (rest.length === 1 && rest[0].w === "I" && !rs.length) {
      // A lone "I" where the reference has nothing: a misread mark ("know not. I They will…").
      log(v, "stray letters (misread verse number)", "I", "");
      rest[0].w = "";
      continue;
    }
    if (rest.every((x) => isWord(x.w))) continue; // Pickthall's own words
    if (mend(v, rest, rs, false)) continue;
    // Stray letters (misread verse numbers, "ii", "n", "J"): non-words of one or two letters, single
    // letters standing alone, or a lone "I" the reference doesn't have.
    const singles = !rs.length && rest.every((y) => y.w.replace(/[^A-Za-z]/g, "").length === 1);
    rest = rest.filter((x) => {
      const letters = x.w.replace(/[^A-Za-z]/g, "");
      const stray = (letters.length <= 2 && !isWord(x.w)) || singles || (x.w === "I" && !rs.some((y) => y.k === "i"));
      if (stray) {
        log(v, "stray letters (misread verse number)", x.w, "");
        x.w = "";
      }
      return !stray;
    });
    if (!rest.length || rest.every((x) => isWord(x.w))) continue;
    if (!mend(v, rest, rs, true)) alignNotes.push(`UNFIXED ${s}:${v} P«${pText}» R«${rs.map((x) => x.w).join(" ")}»`);
    } finally {
      // A mark the scan made of the punctuation after a word ("Aaron 1 Thy", "thereof * His") was dropped:
      // the word gets the reference's punctuation back.
      const prev = g.p0 > 0 ? P[g.p0 - 1] : null, prevR = g.r0 > 0 ? R[g.r0 - 1] : null;
      const dropped = orig.some((w, n) => w && !P[g.p0 + n].w && (junk(w) || w.replace(/[^A-Za-z]/g, "").length <= 2));
      const rWords = R.slice(g.r0, g.r1).filter((x) => x.k);
      if (dropped && rWords.length)
        alignNotes.push(`AUDIT ${s}:${vOf(Math.max(0, g.p0 - 1))} scan «${orig.join(" ")}» → «${P.slice(g.p0, g.p1).map((x) => x.w).filter(Boolean).join(" ")}» reference «${rWords.map((x) => x.w).join(" ")}»`);
      const mark = prevR?.w.match(/[.,;:!?\"”’—)]+$/)?.[0];
      if (dropped && prev?.w && mark && !/[.,;:!?\"”’—)]$/.test(prev.w) && g.r0 === g.r1) {
        fixLog.push([`${s}:${vOf(g.p0 - 1)}`, "punctuation the scan misread, from the reference", prev.w, prev.w + mark]);
        prev.w += mark;
      }
    }
  }
}

/**
 * Last pass over a scan verse's text, word by word against the reference verse: punctuation the scan put
 * inside, before or between words where the reference has none ("tw.o", ".Allah", "from. the"), stray
 * quote marks, doubled punctuation, hyphens the scan added or split, stray single letters, a lowercase
 * verse start, and capitals for the divine pronouns where the reference has them in the same place.
 */
function sweep(s: number, v: number, t: string, ref: string): string {
  const log = (rule: string, from: string, to: string) => fixLog.push([`${s}:${v}`, rule, from, to]);
  const R = ref.split(/\s+/).filter(Boolean).map((w) => ({ w, k: key(w) }));
  const rKeys = new Set(R.map((x) => x.k));
  const pairs = new Map<string, { a: string; b: string }[]>();
  for (let i = 0; i + 1 < R.length; i++) {
    const id = `${R[i].k} ${R[i + 1].k}`;
    (pairs.get(id) ?? pairs.set(id, []).get(id)!).push({ a: R[i].w, b: R[i + 1].w });
  }
  const rHas = (k: string) => rKeys.has(k);
  let w = t.split(/\s+/).filter(Boolean);
  const put = (rule: string, i: number, to: string) => {
    if (to === w[i]) return;
    log(rule, w[i], to);
    w[i] = to;
  };
  for (let i = 0; i < w.length; i++) {
    // ".them", ",Allah": punctuation glued to the start of a word.
    if (/^[.,;:]+[A-Za-z]/.test(w[i])) put("punctuation glued before a word", i, w[i].replace(/^[.,;:]+/, ""));
    // "tw.o", "th.ee": a period or comma inside a word.
    const inside = /^([A-Za-z']+)[.,]([a-z']+)([.,;:!?)]*)$/.exec(w[i]);
    if (inside && !/^i\.e/.test(w[i]) && (rHas(key(inside[1] + inside[2])) || VOCAB.has(key(inside[1] + inside[2])))) put("period/comma inside a word", i, inside[1] + inside[2] + inside[3]);
    // "-more": a hyphen the reference doesn't have, at the start of a word.
    if (/^-[a-z]/.test(w[i]) && rHas(key(w[i]))) put("stray hyphen", i, w[i].slice(1));
    // Stray quote marks at the edge of a word, where the reference's word has none.
    const q = /^(["'‘“]*)(.*?)(["'’”]*)$/.exec(w[i])!;
    if ((q[1] || q[3]) && q[2] && !/^s$/i.test(q[2])) {
      const rw = R.filter((x) => x.k === key(w[i]));
      if (rw.length && rw.every((x) => !/^["'‘“]|["'’”]$/.test(x.w))) put("stray quote mark", i, q[2]);
    }
    if (/^[.,;:]+[A-Za-z]/.test(w[i])) put("punctuation glued before a word", i, w[i].replace(/^[.,;:]+/, ""));
    // Doubled punctuation ("me..", "said:.", "Worlds,.").
    if (/[A-Za-z)][.,;:!?][.,;:]+$/.test(w[i])) put("doubled punctuation", i, w[i].replace(/([.,;:!?])[.,;:]+$/, "$1"));
    // "(with.)": a period or comma before the closing bracket that the reference's word doesn't have.
    const shut = /^(\(?[A-Za-z]+)[.,](\)[.,;:!?]?)$/.exec(w[i]);
    if (shut && R.some((x) => x.k === key(w[i])) && R.filter((x) => x.k === key(w[i])).every((x) => !/[A-Za-z][.,]\)/.test(x.w)))
      put("punctuation inside brackets the reference doesn't have", i, shut[1] + shut[2]);
    // A quote mark standing alone ("water, ' introduce") where the reference has none.
    if (/^["'‘’“”]+$/.test(w[i]) && !R.some((x) => /["'‘’“”]/.test(x.w))) put("stray quote mark", i, "");
  }
  w = w.filter(Boolean);
  for (let i = 0; i + 1 < w.length; i++) {
    const a = key(w[i]), b = key(w[i + 1]);
    const here = pairs.get(`${a} ${b}`);
    // "that. which", "from. the", "from, sending": punctuation before a lowercase word where the reference
    // has the same two words with none.
    if (here && /[a-z]/.test(w[i + 1][0]) && (/[a-z)]\.$/.test(w[i]) || /^(?:from|of|the|a|an|to|unto|in|on|by|with|for|its|their|his|her|our|your|my|thy|each),$/i.test(w[i])) && !/^i\.e\.$/.test(w[i]) && here.every((p) => !/[.,;:!?]$/.test(p.a)))
      put("punctuation between words the reference runs on", i, w[i].slice(0, -1));
    // Inside brackets, a period or comma the reference doesn't have: "(though. We sent", "(from, them)".
    const open = w.slice(0, i + 1).join(" ").split("(").length - w.slice(0, i + 1).join(" ").split(")").length;
    if (here && open > 0 && /[a-z][.,]$/.test(w[i]) && here.every((p) => !/[.,;:!?]$/.test(p.a)))
      put("punctuation inside brackets the reference doesn't have", i, w[i].slice(0, -1));
    // "guests, Affront", "Ra, These": a comma where the reference ends the sentence, before a capital.
    if (here && /[a-z],$/.test(w[i]) && /^[A-Z]/.test(w[i + 1]) && w[i + 1] !== "I" && here.every((p) => /[.!?]$/.test(p.a)))
      put("comma for the end of a sentence", i, w[i].slice(0, -1) + here[0].a.slice(-1));
    // "aloof- O my son": a dash the scan printed as a hyphen, where the reference has " - ".
    if (/[a-z]-$/.test(w[i]) && /^[A-Z]/.test(w[i + 1]) && R.some((x, j) => x.k === key(w[i]) && R[j + 1]?.w === "-" && R[j + 2]?.k === b)) {
      log("dash the scan read as a hyphen", `${w[i]} ${w[i + 1]}`, `${w[i].slice(0, -1)}—${w[i + 1]}`);
      w[i] = `${w[i].slice(0, -1)}—${w[i + 1]}`;
      w[i + 1] = "";
      continue;
    }
    // Divine pronouns the reference capitalises in the same place ("unto him" → "unto Him").
    const pron = /^(he|his|him|we|us|our|me|my)$/;
    if (pron.test(b) && /^[a-z]/.test(w[i + 1]) && here?.length && here.every((p) => /^[A-Z]/.test(p.b)) && i > 0)
      put("capital for the divine pronoun (as the reference has it)", i + 1, w[i + 1][0].toUpperCase() + w[i + 1].slice(1));
  }
  // "It-will": a hyphen joining two words the reference has apart.
  w = w.flatMap((x) => {
    const m = /^([A-Za-z]+)-([a-z]+)([.,;:!?]*)$/.exec(x);
    if (m && pairs.has(`${key(m[1])} ${key(m[2])}`) && !rHas(key(x))) {
      log("hyphen joining two words", x, `${m[1]} ${m[2]}${m[3]}`);
      return [m[1], m[2] + m[3]];
    }
    return [x];
  });
  // "All- Wise", "fro ward": a word the scan split, where the reference has it whole.
  for (let i = 0; i + 1 < w.length; i++) {
    const joined = key(w[i] + w[i + 1]);
    const rw = R.find((x) => x.k === joined);
    if (!rw || pairs.has(`${key(w[i])} ${key(w[i + 1])}`)) continue;
    if (!key(w[i]) || !key(w[i + 1])) continue;
    if (!w[i].endsWith("-") && isWord(w[i]) && isWord(w[i + 1])) continue; // two real words: his own spacing ("No one")
    const to = w[i].endsWith("-") && !rw.w.includes("-") ? w[i].slice(0, -1) + w[i + 1] : w[i] + w[i + 1];
    log("word split by the scan", `${w[i]} ${w[i + 1]}`, to);
    w[i] = to;
    w[i + 1] = "";
  }
  w = w.filter(Boolean);
  // A stray single letter between two words the reference has side by side ("foreign o tongue").
  // Also a lowercase "o" (never Pickthall's vocative "O"), and runs of them ("lie o o concerning").
  const strayLetter = (x: string) => /^[b-zB-HJ-NP-Z]$/.test(x);
  for (let i = 1; i < w.length; i++) {
    if (!strayLetter(w[i])) continue;
    let e = i;
    while (e < w.length && strayLetter(w[e])) e++;
    const next = e < w.length ? w[e] : null;
    // Between two words the reference has side by side, or at the very end of the verse.
    if (next === null ? true : pairs.has(`${key(w[i - 1])} ${key(next)}`)) {
      log("stray letter", w.slice(i - 1, e + 1).join(" "), [w[i - 1], next].filter(Boolean).join(" "));
      for (let j = i; j < e; j++) w[j] = "";
    }
    i = e;
  }
  w = w.filter(Boolean);
  let out = w.join(" ");
  // "( and say)", "(O mankind! )": a space inside brackets.
  const tight = out.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  if (tight !== out) {
    log("space inside brackets", out, tight);
    out = tight;
  }
  if (/^[a-z]/.test(out) && /^[A-Z("']/.test(ref)) {
    const to = out[0].toUpperCase() + out.slice(1);
    log("verse starts with a capital", out.split(" ")[0], to.split(" ")[0]);
    out = to;
  }
  return out;
}

function align(s: number, en: Verses, ref: Map<number, string>, arab: Verses, fromScan: boolean): Verses {
  const E = [...en.entries()].sort((a, b) => a[0] - b[0]);
  const P: Tok[] = [];
  const starts = new Set<number>(); // P token indexes where one of his verses starts
  E.forEach(([, x], p) => {
    starts.add(P.length);
    for (const w of x.t.split(/\s+/).filter(Boolean)) P.push({ w, k: isNum(w) ? "" : key(w), p });
  });
  const hafs = [...arab.keys()].sort((a, b) => a - b);
  const R: RTok[] = [];
  const rEnd: number[] = [];
  for (const v of hafs) {
    for (const w of (ref.get(v) ?? "").split(/\s+/).filter(Boolean)) R.push({ w, k: key(w), v });
    rEnd.push(R.length - 1);
  }
  const map = lcs(P, R);
  if (process.env.PICK_GAPS) {
    for (const g of gaps(P, R, map)) {
      const pw = P.slice(g.p0, g.p1).map((x) => x.w).join(" "), rw = R.slice(g.r0, g.r1).map((x) => x.w).join(" ");
      alignNotes.push(`GAP ${s}:${R[Math.min(g.r0, R.length - 1)].v} [${P[Math.max(0, g.p0 - 1)]?.w ?? ""}] P«${pw}» R«${rw}» [${P[g.p1]?.w ?? ""}]`);
    }
  }
  if (process.env.PICK_DIAG) {
    // Runs of reference words with nothing matching in the 1930 text (text lost from the source) and runs
    // of 1930 words matching nothing (page heads, footnotes, garbled lines).
    const used = new Uint8Array(P.length);
    for (const i of map) if (i >= 0) used[i] = 1;
    for (let j = 0; j < R.length; ) {
      let e = j;
      while (e < R.length && map[e] < 0) e++;
      if (e - j >= 4) alignNotes.push(`LOST ${s}:${R[j].v} (${e - j} words)`);
      j = e + 1;
    }
    for (let i = 0; i < P.length; ) {
      let e = i;
      while (e < P.length && !used[e]) e++;
      if (e - i >= 3) alignNotes.push(`EXTRA ${s} his ${E[P[i].p][0]}: ${P.slice(i, e).map((x) => x.w).join(" ")}`);
      i = e + 1;
    }
  }
  // cut[k]: P token index where Hafs verse hafs[k] starts.
  const cut: number[] = [0];
  const unsure = new Set<number>();
  // Opening letters ("Ya Sin.", "Ta. Ha.") the scan didn't read at all (printed apart from the text).
  const lostLetters = new Set<number>();
  hafs.forEach((v, k) => {
    const r0 = k ? rEnd[k - 1] + 1 : 0;
    let hit = false;
    for (let j = r0; j <= rEnd[k]; j++) if (map[j] >= 0) hit = true;
    if (!hit && /^(?:[A-Z][a-z']{0,4}\.?\s*){1,5}$/.test(ref.get(v) ?? "")) lostLetters.add(k);
  });
  for (let k = 0; k + 1 < hafs.length; k++) {
    if (lostLetters.has(k)) {
      cut.push(cut[cut.length - 1]);
      continue;
    }
    let a = rEnd[k];
    while (a >= 0 && map[a] < 0) a--;
    let b = rEnd[k] + 1;
    while (b < R.length && map[b] < 0) b++;
    const pa = a >= 0 ? map[a] : -1, pb = b < R.length ? map[b] : P.length;
    let c = -1;
    const from = Math.max(pa + 1, cut[cut.length - 1] + 1);
    for (let x = from; x <= pb; x++) if (starts.has(x)) { c = x; break; } // his own verse break
    if (c < 0) {
      // Inside one of his verses: before a stray verse number, else after the last word that ends a clause.
      for (let x = from; x < pb; x++) if (junk(P[x].w)) { c = x; break; }
      if (c < 0) {
        c = from;
        for (let x = from; x < pb; x++) if (/[.,;:!?'"’”)]$/.test(P[x - 1]?.w ?? "")) c = x;
        if (pb - pa > 1) unsure.add(k + 1);
      }
      if (!/[.,;:!?'"’”)\-—]$/.test(P[c - 1]?.w ?? "") && !junk(P[c]?.w ?? "")) unsure.add(k + 1);
    }
    cut.push(Math.max(c, cut[cut.length - 1]));
  }
  cut.push(P.length);
  if (fromScan) {
    // The Hafs verse each scan word ends up in, for the fix log.
    const vOf = (i: number) => hafs[Math.max(0, cut.findIndex((c, k) => k + 1 < cut.length && i >= c && i < cut[k + 1]))];
    cleanScan(s, P, R, map, vOf);
  }
  const out: Verses = new Map();
  let lastFull = -1;
  for (let k = 0; k < hafs.length; k++) {
    const v = hafs[k];
    if (lostLetters.has(k) && cut[k] === cut[k + 1]) {
      out.set(v, { t: ref.get(v)! });
      fixLog.push([`${s}:${v}`, "opening letters missing from the source, from the reference", "", ref.get(v)!]);
      lastFull = k;
      continue;
    }
    let toks = P.slice(cut[k], cut[k + 1]).filter((x) => x.w);
    // What the scan left of a verse number it couldn't read, on either side of a cut inside his verse.
    if (!starts.has(cut[k])) while (toks.length && junk(toks[0].w)) toks = toks.slice(1);
    if (k + 1 < hafs.length && !starts.has(cut[k + 1])) while (toks.length > 1 && junk(toks[toks.length - 1].w)) toks = toks.slice(0, -1);
    if (!toks.length || JOIN.has(`${s}:${v}`)) {
      // Nothing here, or no clean place to split: the words stay in the verse before (shown as "see v.").
      if (lastFull >= 0) {
        const prevV = hafs[lastFull];
        const pv = out.get(prevV)!;
        if (toks.length) {
          const add = toks.map((x) => x.w).join(" ");
          pv.t = `${pv.t} ${add}`;
          const pn = Number(pv.n?.split("–")[0] ?? E[toks[0].p][0]);
          const last = E[toks[toks.length - 1].p][0];
          if (pv.n && last !== pn) pv.n = `${pn}–${last}`;
        }
        pv.to = String(v);
        out.set(v, { t: "", cont: `${s}:${prevV}` });
        alignNotes.push(`${s}:${v} joined to ${s}:${prevV}${toks.length ? " (no clean split)" : " (no words)"}`);
      }
      continue;
    }
    const first = E[toks[0].p][0], last = E[toks[toks.length - 1].p][0];
    const whole = starts.has(cut[k]) && (k + 1 >= cut.length - 1 || starts.has(cut[k + 1]) || cut[k + 1] === P.length);
    const n = s === 1 ? (first === 0 ? undefined : first === last ? String(first) : `${first}–${last}`) : first === last ? (first !== v ? String(first) : undefined) : `${first}–${last}`;
    if (!whole) {
      const before = P.slice(Math.max(0, cut[k] - 6), cut[k]).map((x) => x.w).join(" ");
      alignNotes.push(`${s}:${v} split from his ${first}${first !== last ? `–${last}` : ""}${unsure.has(k) ? " UNSURE" : ""}: …${before} | ${toks.slice(0, 6).map((x) => x.w).join(" ")}…`);
    }
    out.set(v, { t: toks.map((x) => x.w).join(" "), ...(n ? { n } : {}) });
    lastFull = k;
  }
  return out;
}

/**
 * A verse number the scan read short ("105." as "6.") leaves two verses run together and that number
 * missing: "… of the believers. 6. And, (O Muhammad) set thy purpose …" (10:104–105). Split them again.
 */
function splitHidden(vs: Verses): boolean {
  let any = false;
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const v of [...vs.keys()].sort((a, b) => a - b)) {
      const x = vs.get(v)!;
      if (vs.has(v + 1) || !x.t) continue;
      const want = String(v + 1);
      const re = /(?<=[.;:!?'"’”)] )(\d{1,3})\. (?=[A-Z(‘'"“])/g;
      for (const m of x.t.matchAll(re)) {
        if (!want.endsWith(m[1])) continue;
        vs.set(v, { ...x, t: x.t.slice(0, m.index).trim() });
        vs.set(v + 1, { t: x.t.slice(m.index! + m[0].length).trim() });
        changed = any = true;
        break;
      }
    }
    if (!changed) break;
  }
  return any;
}

async function main() {
  const ar = await arabic();
  await write("tanzil", ar);
  const ws = await wikisource();
  const counts = new Map([...ar.entries()].map(([k, v]) => [k, v.size]));
  counts.set(1, 7); // Pickthall's own count for Surah 1 (Bismillah as a heading)
  const sc = await scan(counts);
  const ref = await reference();
  // Words of proofread English (Wikisource's Pickthall, the reference, the KJV): a scan "word" not among them is a misreading.
  const addWords = (t: string) => { for (const w of t.split(/[\s\-—]+/)) if (key(w)) VOCAB.add(key(w)); };
  for (const vs of ws.values()) for (const x of vs.values()) addWords(x.t);
  for (const vs of ref.values()) for (const t of vs.values()) addWords(t);
  const kjv = path.join(ROOT, "data", "texts", "bible", "kjv");
  for (const book of (await readdir(kjv, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name))
    for (const f of await readdir(path.join(kjv, book)))
      for (const x of (JSON.parse(await readFile(path.join(kjv, book, f), "utf8")) as { verses: { t: string }[] }).verses) addWords(x.t);
  const en = new Map<number, Verses>();
  const report: string[] = [];
  let fromWs = 0, fromScan = 0;
  for (let s = 1; s <= 114; s++) {
    const want = ar.get(s)!.size;
    const w = ws.get(s), c = sc.get(s);
    // Surah 1: Pickthall's 1–5 are standard 2–6 and his 6–7 are standard 7; the Bismillah is standard 1.
    const fit = (v?: Verses) => (s === 1 ? v && v.size === 7 : v && v.size === want);
    const pick = fit(w) ? w : fit(c) ? c : w && c ? (Math.abs(w.size - want) <= Math.abs(c.size - want) ? w : c) : (w ?? c);
    if (!pick) {
      report.push(`surah ${s}: no English found`);
      continue;
    }
    if (pick === w) fromWs++;
    else fromScan++;
    // Fill verses missing at the end of a Wikisource page from the scan (same numbering source).
    if (pick === w && c && s !== 1 && pick.size < want) {
      // Numbered on from where the page ends, starting after the scan's copy of its last verse (the two
      // number 4:173–177 differently).
      const last = Math.max(...pick.keys());
      const head = (t: string) => t.toLowerCase().replace(/[^a-z]/g, "").slice(0, 40);
      const lastHead = head(pick.get(last)!.t);
      const sv = [...c.keys()].sort((a, b) => a - b);
      const at = sv.findLastIndex((v) => head(c.get(v)!.t) === lastHead);
      let next = last + 1;
      for (const v of at >= 0 ? sv.slice(at + 1) : sv.filter((v) => v > last)) pick.set(next++, c.get(v)!);
    }
    splitHidden(pick);
    const before = pick.size;
    if (s === 1) {
      // Pickthall prints the Bismillah as an unnumbered heading; standard numbering counts it as verse 1.
      pick.set(0, { t: "In the name of Allah, the Beneficent, the Merciful." });
    }
    const aligned = align(s, pick, ref.get(s)!, ar.get(s)!, pick !== w);
    if (pick !== w) {
      for (const [v, x] of aligned) {
        // The scan's verse numbers are often misread, so its "own number" would mislead: none shown.
        if (s !== 1) delete x.n; // Surah 1: his numbering is known (the Bismillah unnumbered, his 6–7 = 7)
        if (!x.t) continue;
        const was = x.t;
        x.t = x.t.replace(/(?<![A-Za-z])([Ll])o[lJ](?=[\s,;:]|$)/g, "$1o!");
        if (x.t !== was) fixLog.push([`${s}:${v}`, "misread word", "loJ / Lol", "lo! / Lo!"]);
        for (const [hs, hv, from, to] of SCAN_HAND) {
          if (hs !== s || hv !== v || !x.t.includes(from)) continue;
          x.t = x.t.replace(from, to);
          fixLog.push([`${s}:${v}`, "by hand (checked against the scan)", from, to]);
        }
        x.t = sweep(s, v, x.t, ref.get(s)!.get(v) ?? "");
        // A verse ending in a comma or nothing where the reference ends the sentence (. ! ?) and the next
        // verse starts with a capital: the scan lost or misread the mark.
        const rEnd = (ref.get(s)!.get(v) ?? "").match(/[.!?]["”’)]?$/)?.[0];
        const next = aligned.get(v + 1)?.t ?? "";
        if (rEnd && (!next || /^["'‘“(]?[A-Z]/.test(next)) && /(?:[A-Za-z)],?|,["”’])$/.test(x.t) && !/[.!?;:]["”’)]?$/.test(x.t)) {
          const to = x.t.replace(/,(?=["”’]?$)/, "").replace(/(["”’]?)$/, `${rEnd[0]}$1`);
          fixLog.push([`${s}:${v}`, "verse end: the reference's mark (scan had a comma or none)", x.t.slice(-30), to.slice(-30)]);
          x.t = to;
        }
        // Hand fixes whose text only appears once the sweep has tidied the verse.
        for (const [hs, hv, from, to] of SCAN_HAND) {
          if (hs !== s || hv !== v || !x.t.includes(from)) continue;
          x.t = x.t.replace(from, to);
          fixLog.push([`${s}:${v}`, "by hand (checked against the scan)", from, to]);
        }
      }
    }
    for (const [v, x] of aligned) {
      // The 1930 print (and nearly all of Wikisource's surahs) spell it "Qur'ân"; the scan lost the accent.
      if (!x.t?.includes("Qur'an")) continue;
      x.t = x.t.replace(/Qur'an/g, "Qur'ân");
      fixLog.push([`${s}:${v}`, "accent lost (Qur'ân, as the 1930 print)", "Qur'an", "Qur'ân"]);
    }
    const joined = [...aligned.values()].filter((x) => x.cont).length;
    const gaps = want - [...aligned.values()].filter((x) => x.t || x.cont).length;
    if (before !== want || joined || gaps)
      report.push(`surah ${s}: ${before} Pickthall verses → ${want}${joined ? `, ${joined} joined` : ""}${gaps ? `, ${gaps} gap(s)` : ""} (${pick === w ? "wikisource" : "scan"})`);
    en.set(s, aligned);
  }
  await write("pickthall", en);
  console.log(`tanzil: 114 surahs, ${[...ar.values()].reduce((a, v) => a + v.size, 0)} verses`);
  console.log(`pickthall: ${fromWs} surahs from Wikisource, ${fromScan} from the scan`);
  console.log(report.length ? report.join("\n") : "all verse counts match");
  console.log(alignNotes.join("\n"));
  console.log(`scan repairs: ${fixLog.length}`);
  if (process.env.PICK_FIXES) await writeFile(process.env.PICK_FIXES, JSON.stringify(fixLog, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
