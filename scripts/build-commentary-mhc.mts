/**
 * Matthew Henry's Concise Commentary → public/commentary/mhc/<book>.json (the hidden "Classic commentary" page).
 *
 * Source: the CrossWire SWORD module MHCC (Distribution License: Public Domain; its text from ccel.org's plain-text
 * edition), downloaded once into data/raw/commentary/ (gitignored):
 *   https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/MHCC.zip
 * The module is a zCom commentary in KJV versification: per testament, a verse index (.bzv: block, offset, size), a
 * block index (.bzs) and zlib blocks (.bzz). A note spanning several verses is stored once and linked from each verse.
 * Each note starts with a bold "Verses 4-7" label; the chapter's outline (and, in chapter 1, the book's introduction)
 * comes before the first label.
 *
 * Output per book: { intro?: string, chapters: { "1": [{ verses: "", text: outline }, { verses: "1-2", text }, …] } }
 * (verses "" is the chapter overview). Paragraphs are separated by a blank line.
 *
 *   npx tsx scripts/build-commentary-mhc.mts
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import path from "node:path";
import { booksOfWork } from "../src/lib/catalog";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "data", "raw", "commentary");
const MOD = path.join(RAW, "mhcc", "modules", "comments", "zcom", "mhcc");
const OUT = path.join(ROOT, "public", "commentary", "mhc");
const URL = "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/MHCC.zip";
const exists = (p: string) => access(p).then(() => true, () => false);

async function fetchModule() {
  if (await exists(path.join(MOD, "nt.bzz"))) return;
  const zip = path.join(RAW, "MHCC.zip");
  if (!(await exists(zip))) {
    const res = await fetch(URL, { headers: { "user-agent": "Mozilla/5.0 VersesAcross-import" } });
    if (!res.ok) throw new Error(`download ${URL}: ${res.status}`);
    await mkdir(RAW, { recursive: true });
    await writeFile(zip, Buffer.from(await res.arrayBuffer()));
  }
  execFileSync("unzip", ["-o", "-q", zip, "-d", path.join(RAW, "mhcc")]);
}

async function testament(t: "ot" | "nt") {
  const [bzs, bzv, bzz] = await Promise.all(["bzs", "bzv", "bzz"].map((x) => readFile(path.join(MOD, `${t}.${x}`))));
  const blocks: Buffer[] = [];
  for (let i = 0; i < bzs.length / 12; i++) {
    const off = bzs.readUInt32LE(i * 12), size = bzs.readUInt32LE(i * 12 + 4);
    blocks.push(inflateSync(bzz.subarray(off, off + size)));
  }
  return (i: number) => {
    const b = bzv.readUInt32LE(i * 10), o = bzv.readUInt32LE(i * 10 + 4), s = bzv.readUInt16LE(i * 10 + 8);
    return { key: `${b}:${o}:${s}`, raw: s ? blocks[b].subarray(o, o + s).toString("utf8") : "" };
  };
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&(\w+);/g, (m, n: string) => ENT[n] ?? m);

/** OSIS → paragraphs of plain text; outline table rows become "Topic (1-3)" lines; titles are dropped. */
function plain(osis: string): string {
  const s = osis
    .replace(/<note\b[^>]*\/>/g, "")
    .replace(/<note\b[\s\S]*?<\/note>/g, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, "")
    .replace(/<\/cell>\s*<cell>/g, " ")
    .replace(/<row>/g, "\n\n")
    .replace(/<div\b[^>]*type="x-p"[^>]*\/>/g, "\n\n")
    .replace(/<lb\b[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, " ");
  return decode(s)
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t\r\n]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

const LABEL = /<hi type="bold">\s*Verses?\s+([^<]*?)\s*<\/hi>/g;

async function main() {
  await fetchModule();
  const books = booksOfWork("bible").filter((b) => b.collection.id === "ot" || b.collection.id === "nt");
  if (books.length !== 66) throw new Error(`expected 66 books, got ${books.length}`);
  const read = { ot: await testament("ot"), nt: await testament("nt") };
  const index = { ot: 2, nt: 2 }; // 0: module header, 1: testament heading
  await mkdir(OUT, { recursive: true });
  const gaps: string[] = [];
  const odd: string[] = [];
  let total = 0;
  for (const book of books) {
    const t = book.collection.id as "ot" | "nt";
    const kjv = JSON.parse(await readFile(path.join(ROOT, "public", "texts", "bible", "kjv", `${book.id}.json`), "utf8")) as {
      chapters: Record<string, { verses: { v: string }[] }>;
    };
    index[t]++; // book heading
    let intro = "";
    const chapters: Record<string, { verses: string; text: string }[]> = {};
    for (let c = 1; c <= book.chapters!; c++) {
      const n = kjv.chapters[String(c)].verses.length;
      index[t]++; // chapter heading
      const seen = new Set<string>();
      let raw = "";
      for (let v = 1; v <= n; v++) {
        const e = read[t](index[t] + v - 1);
        if (!e.raw || seen.has(e.key)) continue;
        seen.add(e.key);
        raw += " " + e.raw;
      }
      index[t] += n;
      const items: { verses: string; text: string }[] = [];
      const marks = [...raw.matchAll(LABEL)];
      let before = marks.length ? raw.slice(0, marks[0].index) : raw;
      if (c === 1) {
        // The book's introduction comes before the chapter outline's title in chapter 1.
        const cut = before.search(/<title type="x-IS">\s*Chapter Outline/);
        if (cut > 0) {
          intro = plain(before.slice(0, cut));
          before = before.slice(cut);
        }
      }
      const overview = plain(before);
      // A chapter with one note for all of it has no label: "Summary.\n\n--The note…" (the note covers every verse).
      if (!marks.length && overview) {
        const paras = overview.split("\n\n");
        const summary = paras.length > 1 && paras[0].length < 300 ? paras.shift()! : "";
        if (summary) items.push({ verses: "", text: summary });
        items.push({ verses: n > 1 ? `1-${n}` : "1", text: paras.join("\n\n").replace(/^\s*--\s*/, "") });
      } else if (overview) items.push({ verses: "", text: overview });
      marks.forEach((m, i) => {
        const end = i + 1 < marks.length ? marks[i + 1].index : raw.length;
        const verses = m[1].replace(/\s+/g, "").replace(/[–—]/g, "-").replace(/\.$/, "");
        if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(verses)) odd.push(`${book.id} ${c}: "${m[1]}"`);
        const text = plain(raw.slice(m.index + m[0].length, end));
        if (text) items.push({ verses, text });
      });
      if (!items.some((x) => x.verses)) gaps.push(`${book.id} ${c}${items.length ? " (overview only)" : " (nothing)"}`);
      chapters[String(c)] = items;
    }
    const json = JSON.stringify(intro ? { intro, chapters } : { chapters });
    total += json.length;
    await writeFile(path.join(OUT, `${book.id}.json`), json);
  }
  console.log(`66 books, ${(total / 1e6).toFixed(1)} MB`);
  console.log(gaps.length ? `chapters without verse notes (${gaps.length}): ${gaps.join("; ")}` : "every chapter has verse notes");
  if (odd.length) console.log(`odd labels (${odd.length}): ${odd.slice(0, 40).join("; ")}`);
}

void main();
