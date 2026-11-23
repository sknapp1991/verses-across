/**
 * Study-guide references for the articles (hub 9c346b55, b53fdab9): reads data/articles/references.json and fetches
 * a short summary for each word, name and book from English Wikipedia (the page's lead, REST summary API) or, for a
 * word with a Wiktionary entry, its definitions in that language (REST definition API). The result is saved in
 * data/articles/refs-cache.json (committed), which build-articles reads: the site build never goes online, and no
 * reader's browser contacts Wikipedia. Text from Wikipedia and Wiktionary is CC BY-SA 4.0; each card names its
 * source and links to the page.
 *
 *   npx tsx scripts/article-refs.mts            (fetch what's missing)
 *   npx tsx scripts/article-refs.mts --all      (fetch everything again)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const REFS = path.join(ROOT, "data", "articles", "references.json");
const CACHE = path.join(ROOT, "data", "articles", "refs-cache.json");
const UA = { "user-agent": "VersesAcross-study-guide/1.0 (versesacross.com)" };

type Ref = { lang?: string; wiki?: string; wikt?: string; wiktLang?: string; by?: string };
export type CachedRef = { source: "Wikipedia" | "Wiktionary"; title: string; text: string; url: string; fetched: string };

const OFFENSIVE = /offensive|derogatory|ethnic|racial|\bslur\b|vulgar|pejorative|term of abuse|abusive|insult|nigg/i;
// senses that say nothing about the word's meaning
const NOISE = /spelling of|given name|surname|alternative form|inflection of|form of\b|plural of|romanization of/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** A GET that waits and tries again when the site asks us to slow down (429). */
async function get(url: string) {
  for (const wait of [0, 20000, 60000, 120000]) {
    if (wait) await sleep(wait);
    const r = await fetch(url, { headers: UA });
    if (r.status !== 429) return r;
  }
  throw new Error(`still rate-limited: ${url}`);
}
const strip = (h: string) =>
  h
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

async function wikipedia(title: string): Promise<CachedRef | null> {
  const r = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`);
  if (!r.ok) return null;
  const d = (await r.json()) as { type?: string; title: string; extract?: string; content_urls?: { desktop?: { page?: string } } };
  if (d.type === "disambiguation" || !d.extract) return null;
  return { source: "Wikipedia", title: d.title, text: d.extract, url: d.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, fetched: new Date().toISOString().slice(0, 10) };
}

async function wiktionary(word: string, language: string): Promise<CachedRef | null> {
  const r = await get(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
  if (!r.ok) return null;
  const d = (await r.json()) as Record<string, { language: string; partOfSpeech: string; definitions: { definition: string }[] }[]>;
  const entries = Object.values(d)
    .flat()
    .filter((e) => e.language === language);
  if (!entries.length) return null;
  const parts = entries
    .slice(0, 2)
    .map((e) => `${e.partOfSpeech.toLowerCase()}: ${e.definitions
      .map((x) => strip(x.definition))
      // never an offensive sense, a slur or an inflection table on a card
      // (Wiktionary's text loses its "(offensive)" labels, so match the wording too: "term of abuse for…")
      .filter((x) => x && !OFFENSIVE.test(x) && !NOISE.test(x) && x.length < 400)
      .slice(0, 3)
      .join("; ")}`)
    .filter((p) => !/:\s*$/.test(p));
  if (!parts.length) return null;
  return { source: "Wiktionary", title: word, text: parts.join(" · "), url: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#${language.replace(/ /g, "_")}`, fetched: new Date().toISOString().slice(0, 10) };
}

async function main() {
  const all = process.argv.includes("--all");
  const refs = JSON.parse(await readFile(REFS, "utf8")) as { terms: Record<string, Ref>; books: Record<string, Ref>; names: Record<string, Ref> };
  const cache: Record<string, CachedRef> = all ? {} : JSON.parse(await readFile(CACHE, "utf8").catch(() => "{}"));
  const missing: string[] = [];
  const jobs: [string, Ref][] = [...Object.entries(refs.terms), ...Object.entries(refs.books), ...Object.entries(refs.names)];
  for (const [key, ref] of jobs) {
    if (!ref.wikt && !ref.wiki) continue; // (on purpose: the article's own explanation only)
    const id = ref.wikt ? `wikt:${ref.wiktLang}:${ref.wikt}` : `wiki:${ref.wiki}`;
    if (cache[id]) continue;
    const got = ref.wikt ? await wiktionary(ref.wikt, ref.wiktLang ?? "") : ref.wiki ? await wikipedia(ref.wiki) : null;
    if (got) {
      cache[id] = got;
      // every new card is printed for a person to read before refs-cache.json is committed
      console.log(`NEW ${id}: ${got.text.slice(0, 300)}`);
    }
    else missing.push(`${key} (${id})`);
    await sleep(2500);
  }
  await writeFile(CACHE, JSON.stringify(Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b))), null, 1) + "\n");
  console.log(`refs: ${Object.keys(cache).length} cached${missing.length ? `; not found: ${missing.join(", ")}` : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
