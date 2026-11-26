/**
 * The hidden layer's Genesis 1 (hub c74b9402): each verse exactly as in public/texts (WLC), and each word's sound and
 * meaning from the site's interlinear (STEP Bible TAHOT, Tyndale House, CC BY 4.0), written to src/lib/layer-gen1.ts.
 *   npx tsx scripts/build-layer-gen1.mts <interlinear gen/1.json>   (fetched from versesacross.com/api/interlinear/gen/1.json)
 * Checks that the interlinear's words line up one to one with the counted words (letter-values.ts), or stops.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { wordsOf } from "../src/lib/letter-values";

const src = process.argv[2];
if (!src) throw new Error("usage: build-layer-gen1.mts <gen-1 interlinear json>");
const il = JSON.parse(readFileSync(src, "utf8")) as Record<string, [string, string, string, string, number][]>;
const verses = JSON.parse(readFileSync("public/texts/bible/hebrew/gen.json", "utf8")).chapters["1"].verses as { v: string; t: string }[];
const cons = (s: string) => s.replace(/[^א-ת]/g, "");
const tidy = (g: string) => g.replace(/<obj\.>/g, "(object marker)").replace(/<([^>]+)>/g, "$1").replace(/\s+/g, " ").trim();

const out = verses.map((v) => {
  const words = wordsOf(v.t, "hebrew");
  const iw = (il[v.v] ?? []).map(([he, say, means]) => ({ he: he.replace(/\s+[פס]$/, ""), say, means: tidy(means) }));
  if (words.length !== iw.length || words.some((w, i) => cons(w.text) !== cons(iw[i].he))) throw new Error(`Genesis 1:${v.v}: words don't line up`);
  return { v: Number(v.v), text: v.t, words: iw };
});

writeFileSync(
  "src/lib/layer-gen1.ts",
  `/** Genesis 1 for the hidden layer: verses verbatim (WLC, public/texts) with each word's sound and meaning (STEP Bible\n * TAHOT, Tyndale House, Cambridge, CC BY 4.0). Made by scripts/build-layer-gen1.mts; don't edit by hand. */\n` +
    `export type LayerWord = { he: string; say: string; means: string };\nexport type LayerVerse = { v: number; text: string; words: LayerWord[] };\n` +
    `export const GENESIS_1: LayerVerse[] = ${JSON.stringify(out, null, 1)};\n`,
);
console.log(`Genesis 1: ${out.length} verses, ${out.reduce((n, v) => n + v.words.length, 0)} words`);
