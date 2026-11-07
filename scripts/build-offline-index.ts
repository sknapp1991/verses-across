/**
 * Offline downloads: exact sizes, so the app can say "KJV 5.4 MB, with audio 1.5 GB" before anything
 * downloads.
 *
 *   tsx scripts/build-offline-index.ts          (part of `npm run pack`)
 *     → public/offline/index.json: every version's text files with their bytes, plus recorded audio
 *       per voice and book (from data/offline-audio-sizes.json).
 *   tsx scripts/build-offline-index.ts --audio  (run after publishing audio; needs .cache-audio)
 *     → data/offline-audio-sizes.json: bytes of every uploaded recording file, per voice and book.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TEXTS = path.join(ROOT, "public", "texts");
const AUDIO_SIZES = path.join(ROOT, "data", "offline-audio-sizes.json");
const OUT = path.join(ROOT, "public", "offline", "index.json");

/** voice id ("kjv/bm_george") → book → [bytes, chapters] */
type AudioSizes = Record<string, Record<string, [number, number]>>;

function audioSizes() {
  const base = path.join(ROOT, ".cache-audio");
  const index = JSON.parse(readFileSync(path.join(base, "index.json"), "utf8")) as {
    recordings: { id: string; version: string; voice: string; chapters?: Record<string, number[]> }[];
  };
  const out: AudioSizes = {};
  for (const r of index.recordings) {
    const dir = path.join(base, r.version, r.voice);
    const books: Record<string, [number, number]> = {};
    const list = r.chapters ?? Object.fromEntries(readdirSync(dir).map((b) => [b, readdirSync(path.join(dir, b)).filter((f) => f.endsWith(".mp3")).map((f) => Number(f.slice(0, -4)))]));
    for (const [book, chapters] of Object.entries(list)) {
      let bytes = 0;
      for (const c of chapters)
        for (const ext of ["mp3", "json"]) {
          const p = path.join(dir, book, `${c}.${ext}`);
          if (!existsSync(p)) throw new Error(`missing ${r.id} ${book} ${c}.${ext}`);
          bytes += statSync(p).size;
        }
      books[book] = [bytes, chapters.length];
    }
    out[r.id] = books;
  }
  writeFileSync(AUDIO_SIZES, JSON.stringify(out) + "\n");
  console.log(`offline: audio sizes for ${Object.keys(out).length} voices → data/offline-audio-sizes.json`);
}

function index() {
  /** "work/version" → { bytes, books: { book: bytes } } */
  const texts: Record<string, { bytes: number; books: Record<string, number> }> = {};
  for (const work of readdirSync(TEXTS)) {
    const wdir = path.join(TEXTS, work);
    if (!statSync(wdir).isDirectory()) continue;
    for (const version of readdirSync(wdir)) {
      const vdir = path.join(wdir, version);
      if (!statSync(vdir).isDirectory()) continue;
      const books: Record<string, number> = {};
      let bytes = 0;
      for (const f of readdirSync(vdir)) {
        if (!f.endsWith(".json")) continue;
        const size = statSync(path.join(vdir, f)).size;
        books[f.slice(0, -5)] = size;
        bytes += size;
      }
      if (bytes) texts[`${work}/${version}`] = { bytes, books };
    }
  }
  const audio: AudioSizes = existsSync(AUDIO_SIZES) ? JSON.parse(readFileSync(AUDIO_SIZES, "utf8")) : {};
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ texts, audio }));
  console.log(`offline: ${Object.keys(texts).length} versions, ${Object.keys(audio).length} voices → public/offline/index.json`);
}

if (process.argv.includes("--audio")) audioSizes();
else index();
