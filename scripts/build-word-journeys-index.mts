/**
 * Word journeys search index (hidden page /word-journeys): one small file per language so searching doesn't download
 * the whole lexicon (long entries and all). Only words that actually occur in the Hebrew OT / Greek NT are kept, each
 * with how many verses it's in, so the most used come first.
 *
 *   npx tsx scripts/build-word-journeys-index.mts   .cache-interlinear/{lex,conc} → public/word-journeys/{H,G}.json
 *
 * Run after scripts/build-interlinear.mts + build-concordance.mts. Output is committed (small, and the data rarely changes).
 * Format: [[plain number, lemma, transliteration, "gloss|gloss…", verses], …]. Data: STEP Bible (Tyndale House), CC BY 4.0.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, ".cache-interlinear");
const OUT = path.join(ROOT, "public", "word-journeys");

type Lex = [string, string, string, string];
const lex: Record<string, Lex> = {};
for (const f of readdirSync(path.join(SRC, "lex"))) Object.assign(lex, JSON.parse(readFileSync(path.join(SRC, "lex", f), "utf8")));
const verses = new Map<string, number>(); // plain number → verses (lettered entries summed)
for (const f of readdirSync(path.join(SRC, "conc"))) {
  const shard: Record<string, { n: number }> = JSON.parse(readFileSync(path.join(SRC, "conc", f), "utf8"));
  for (const [k, e] of Object.entries(shard)) verses.set(k.slice(0, 5), (verses.get(k.slice(0, 5)) ?? 0) + e.n);
}

const rows = new Map<string, [string, string, string, string[], number]>();
for (const [k, [lemma, translit, gloss]] of Object.entries(lex)) {
  if (!/^[HG]\d{4}[A-Z]?$/.test(k)) continue;
  const base = k.slice(0, 5);
  const n = verses.get(base);
  if (!n) continue;
  let r = rows.get(base);
  if (!r) rows.set(base, (r = [base, lemma, translit, [], n]));
  const g = gloss.trim();
  if (g && !r[3].includes(g)) r[3].push(g);
}
mkdirSync(OUT, { recursive: true });
for (const lang of ["H", "G"]) {
  const list = [...rows.values()].filter((r) => r[0][0] === lang).sort((a, b) => b[4] - a[4]).map(([b, l, t, g, n]) => [b, l, t, g.join("|"), n]);
  const body = JSON.stringify(list);
  writeFileSync(path.join(OUT, `${lang}.json`), body);
  console.log(`${lang}: ${list.length} words, ${(body.length / 1024).toFixed(0)} KB`);
}
