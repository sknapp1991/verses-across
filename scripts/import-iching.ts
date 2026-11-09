/**
 * The I Ching (Book of Changes), under Confucianism › The Five Classics: the 64 hexagrams, one chapter each.
 *
 *   English: James Legge, The Sacred Books of the East vol. 16 (1882), public domain; "The Text" only (king
 *            Wăn's judgment and the duke of Kâu's lines), without Legge's notes or the Appendixes (Ten Wings).
 *            Read from sacred-texts.com with Skylar's go-ahead (Nov 8, 2026; Wikisource has only hexagrams 1–32).
 *   Chinese: 周易, the 易經 part of each hexagram's page on zh.wikisource (public domain).
 *   Verses:  1 = the judgment on the whole figure; 2–7 = lines one to six (2–8 for hexagrams 1 and 2, which
 *            have a seventh "use of nine / six" paragraph). The two versions line up verse by verse.
 *
 * Inputs (git-ignored): data/raw/iching/st/p-<slug>.htm (sacred-texts pages), data/raw/iching/zh/NN.json.
 *   npx tsx scripts/import-iching.ts
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { resetVersion, ROOT, writeChapter, type Verse } from "./lib/world";

const RAW = path.join(ROOT, "data", "raw", "iching");
const WORK = "i-ching";
const BOOK = "i-ching";

const roman = (s: string) => {
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let n = 0;
  for (let i = 0; i < s.length; i++) n += v[s[i]] < (v[s[i + 1]] ?? 0) ? -v[s[i]] : v[s[i]];
  return n;
};
const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

/** Legge's English for one page: the hexagram number and name, and its paragraphs (notes left out). */
export function english(html: string) {
  const a = html.indexOf('data-slot="reader-prose"');
  const b = html.indexOf("</article>", a);
  const body = html.slice(a, b).replace(/<script[\s\S]*?<\/script>/g, "");
  const head = /<h3>([\s\S]*?)<\/h3>/.exec(body);
  const title = decode((head?.[1] ?? "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(); // "I. THE KHIEN HEXAGRAM"
  const m = /^([IVXLC]+)\.\s+THE\s+(.+?)(?:\s+HEXAGRAM)?\.?$/i.exec(title);
  if (!m) throw new Error("no title: " + title);
  const n = roman(m[1].toUpperCase());
  const name = m[2]
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, s, c) => s + c.toUpperCase());
  const text = body.slice(head ? head.index! + head[0].length : 0);
  const end = text.search(/<h\d[^>]*>\s*Footnotes/i);
  const paras = (end > 0 ? text.slice(0, end) : text)
    .split(/<\/p>/)
    .map((p) => decode(p.replace(/<a[^>]*href="[^"]*#fn_[^"]*"[^>]*>[\s\S]*?<\/a>/g, "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .map((p) => p.replace(/\s*\bp\. \d+\s*/g, " ").replace(/\bT he\b/g, "The").trim()) // page numbers of the printed book; a scanning slip
    .filter((p) => p && !/^(TEXT SECTION|Explanation of (the entire figure|the separate lines))/i.test(p));
  return { n, name, paras };
}

/** The Chinese judgment and lines of one hexagram (the 易經 block of its Wikisource page). */
export function chinese(wikitext: string) {
  const clean = (s: string) =>
    s
      .replace(/<[^>]+>/g, "")
      .replace(/'''/g, "")
      .replace(/\{\{\*\|[^}]*\}\}/g, "")
      .replace(/\{\{另\|([^|}]*)\|[^}]*\}\}/g, "$1") // {{另|惟|維}}: the main reading (a variant character is noted)
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/-\{([^}]*)\}-/g, "$1")
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
      .trim();
  const lines = wikitext.split("\n");
  const at = lines.findIndex((l) => l.includes("易經："));
  if (at < 0) throw new Error("no 易經 block");
  const out: string[] = [];
  for (const l of lines.slice(at + 1)) {
    if (!l.trim()) break;
    if (/^\*\*\*/.test(l) && out.length) out[out.length - 1] += clean(l.replace(/^\*+/, "")); // the judgment goes on
    else if (/^\*\*(?!\*)/.test(l) || /^\*#/.test(l)) out.push(clean(l.replace(/^\*[*#]+/, "")));
    else break;
  }
  return out;
}

const HEX = (n: number) => String.fromCodePoint(0x4dbf + n); // ䷀ is hexagram 1

async function main() {
  const st = path.join(RAW, "st");
  const pages = (await readdir(st)).filter((f) => f.startsWith("p-") && f.endsWith(".htm"));
  const en = new Map<number, { name: string; paras: string[] }>();
  for (const f of pages) {
    const html = await readFile(path.join(st, f), "utf8");
    if (!/^p-[ivxlc]+-the-/.test(f)) continue; // a hexagram page ("p-xiii-the-thung-zan"), not an appendix
    const e = english(html);
    if (en.has(e.n)) console.log(`  hexagram ${e.n} twice (${f}); keeping the first`);
    else en.set(e.n, e);
  }
  const problems: string[] = [];
  await resetVersion(WORK, "legge-ic");
  await resetVersion(WORK, "i-ching-zh");
  for (let n = 1; n <= 64; n++) {
    const e = en.get(n);
    if (!e) {
      problems.push(`${n}: no English page`);
      continue;
    }
    const z = JSON.parse(await readFile(path.join(RAW, "zh", `${String(n).padStart(2, "0")}.json`), "utf8")) as { name: string; wikitext: string };
    const zh = chinese(z.wikitext);
    // English: the judgment (one or more paragraphs before line 1), then the lines. A line starts with its
    // number and/or its name ("4. In the fourth SIX, divided, …", "The third SIX …"); the transcription has a
    // few misread numbers ("S." for 5, "I." for 1, "2 .") and two lines without one, so the wording decides.
    const LINE = /^(?:[\dSI]\s?\.\s*)?(?:\(?In\s+)?the\s+(first|second|third|fourth|fifth|sixth|topmost)(?:\s+\([^)]*\))?\s*,?\s+(NINE|SIX)\b/i;
    const SEVENTH = /^7\s?\.\s/;
    // (only the lines are numbered: a number in front is enough, even "3. . The third" or "1. From the first")
    const NUMBERED = /^[\dSI]\s?\.(\s*\.)?\s/;
    const isLine = (p: string) => NUMBERED.test(p) || LINE.test(p) || SEVENTH.test(p);
    const first = e.paras.findIndex(isLine);
    const judgment = e.paras.slice(0, first).join(" ");
    const numbered: string[] = [];
    for (const p of e.paras.slice(first)) {
      if (isLine(p)) numbered.push(p.replace(/^[\dSI]\s?\.(\s*\.)?\s*/, ""));
      else if (numbered.length) numbered[numbered.length - 1] += " " + p; // a line's text in two paragraphs
    }
    const enVerses = [judgment, ...numbered];
    const want = n <= 2 ? 8 : 7;
    if (first <= 0 || enVerses.length !== want) problems.push(`${n} ${e.name}: English ${enVerses.length} parts (want ${want})`);
    if (zh.length !== enVerses.length) problems.push(`${n} ${e.name} / ${z.name}: Chinese ${zh.length} vs English ${enVerses.length}`);
    const title = `${e.name} ${z.name} ${HEX(n)}`;
    const v = (list: string[]): Verse[] => list.map((t, i) => ({ v: String(i + 1), t }));
    await writeChapter(WORK, "legge-ic", BOOK, n, v(enVerses), undefined, title);
    await writeChapter(WORK, "i-ching-zh", BOOK, n, v(zh), undefined, title);
  }
  console.log(problems.length ? "problems:\n  " + problems.join("\n  ") : "all 64 hexagrams line up (English and Chinese)");
}

if (/import-iching\.ts$/.test(process.argv[1] ?? ""))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
