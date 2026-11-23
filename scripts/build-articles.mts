/**
 * Articles: data/articles/<slug>/{article.json, short.md, medium.md, long.md} → public/articles/index.json (summaries
 * of "review" and "published" articles) + public/articles/<slug>.json (each depth as HTML with its contents list).
 * "draft" articles are left out entirely. See src/lib/articles.ts.
 *
 *   npx tsx scripts/build-articles.mts
 *
 * Markdown supported (all an article needs, nothing that can carry markup in): # / ## / ### headings, paragraphs,
 * **bold**, *italic*, [links](https://…), > quotes, "- " and "1. " lists, "---" rules. Text is HTML-escaped first.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Article, ArticleSummary, Depth, RelatedArticle, StudyRef, Tier, TocEntry } from "../src/lib/articles";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "data", "articles");
const OUT = path.join(ROOT, "public", "articles");
const DEPTHS: Depth[] = ["short", "medium", "long"];
const WPM = 200;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/** Inline: links (http(s) and site-relative only), bold, italic — on already-escaped text. */
function inline(s: string) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/(?!\/))[^)\s]+)\)/g, (_, t: string, u: string) => {
      const ext = u.startsWith("http");
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${t}</a>`;
    })
    // bold may hold italics: **Judaism (*emet*).**
    .replace(/\*\*((?:[^*]|\*(?!\*))+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>");
}

export function markdown(md: string): { html: string; toc: TocEntry[]; words: number } {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const toc: TocEntry[] = [];
  const used = new Set<string>();
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
    if (quote.length) out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
    quote = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      if (level === 1) continue; // the title comes from article.json
      const base = slugify(h[2]) || "section";
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      toc.push({ id, text: h[2].replace(/[*_]/g, ""), level: level as 2 | 3 });
      out.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^-{3,}$/.test(line.trim())) {
      flush();
      out.push("<hr>");
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      if (para.length || list) flush();
      quote.push(q[1]);
      continue;
    }
    // ("1965. " opening a paragraph is not a list: numbered items need a blank line or a list before them)
    const li = /^\s*(?:([-*])|(\d+)\.)\s+(.*)$/.exec(line);
    if (li && li[2] && para.length) {
      para.push(line.trim());
      continue;
    }
    if (li) {
      const tag = li[1] ? "ul" : "ol";
      if (para.length || quote.length || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push(li[3]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`; // a wrapped list item
      continue;
    }
    if (list || quote.length) flush();
    para.push(line.trim());
  }
  flush();
  const words = md.replace(/[#>*_\-[\]()]/g, " ").split(/\s+/).filter((w) => /\w/.test(w)).length;
  return { html: out.join("\n"), toc, words };
}

// ── Study guide (hub 9c346b55, b53fdab9) ─────────────────────────────────────────────────────────────────────────
type RefSpec = { lang?: string; wiki?: string; wikt?: string; wiktLang?: string; by?: string; aka?: string[]; show?: string; read?: string };
type RefFile = { terms: Record<string, RefSpec>; books: Record<string, RefSpec>; names: Record<string, RefSpec>; skip: string[] };
type CardData = NonNullable<StudyRef["card"]>;
let REFS: RefFile = { terms: {}, books: {}, names: {}, skip: [] };
let CACHE: Record<string, CardData & { fetched?: string }> = {};
const cardFor = (r: RefSpec): CardData | undefined => {
  const c = CACHE[r.wikt ? `wikt:${r.wiktLang}:${r.wikt}` : `wiki:${r.wiki}`];
  return c ? { source: c.source, title: c.title, text: c.text, url: c.url } : undefined;
};
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The words, names and books of one depth, in order of first mention, with that first mention marked in the HTML
 * (data-ref) so the reader can open its card there. Words and books are the italics found in references.json
 * (or one of their other spellings); names are found in the running text (not in headings or links).
 */
export function studyRefs(html: string): { html: string; refs: StudyRef[] } {
  const found: { at: number; ref: StudyRef }[] = [];
  const seen = new Set<string>();
  const find = (word: string, table: Record<string, RefSpec>) => {
    const w = word.trim();
    for (const [k, r] of Object.entries(table)) if (k === w || r.aka?.includes(w)) return [k, r] as const;
    for (const [k, r] of Object.entries(table)) if (k.toLowerCase() === w.toLowerCase()) return [k, r] as const;
    return null;
  };
  // italic words and book titles
  html = html.replace(/<em>([^<]{2,60})<\/em>(\s*\(([^()<]{3,140})\))?/g, (all, inner: string, _p, gloss: string | undefined, at: number) => {
    const text = unesc(inner);
    if (REFS.skip.includes(text.toLowerCase())) return all;
    const term = find(text, REFS.terms);
    const book = term ? null : find(text, REFS.books);
    const hit = term ?? book;
    if (!hit) return all;
    // not in a heading (a card would open inside it): the mention in the text after it gets the mark
    const before = html.slice(0, at);
    if (/<h[1-3][^>]*>(?:(?!<\/h[1-3]>)[\s\S])*$/.test(before)) return all;
    const [key, r] = hit;
    const id = `${term ? "w" : "b"}:${key}`;
    if (seen.has(id)) {
      // a later mention may be the one the article explains ("Ein Sof (the Endless)")
      const earlier = found.find((f) => f.ref.key === id)?.ref;
      if (earlier && !earlier.gloss && gloss && term) earlier.gloss = unesc(gloss);
      return all;
    }
    seen.add(id);
    found.push({
      at,
      ref: {
        key: id,
        kind: term ? "word" : "book",
        label: r.show ?? key,
        ...(r.lang ? { lang: r.lang } : {}),
        ...(r.by ? { by: r.by } : {}),
        ...(r.read ? { read: r.read } : {}),
        ...(gloss && term ? { gloss: unesc(gloss) } : {}),
        ...(cardFor(r) ? { card: cardFor(r) } : {}),
      },
    });
    return all.replace("<em>", `<em data-ref="${esc(id)}">`);
  });
  // names in the running text: the full name first, then a shorter form if only that appears ("Eckhart")
  const parts = html.split(/(<[^>]+>)/);
  let skipDepth = 0;
  const names = Object.entries(REFS.names).sort((a, b) => b[0].length - a[0].length);
  for (const [key, r] of names) {
    const id = `n:${key}`;
    for (const form of [key, ...(r.aka ?? [])]) {
      if (seen.has(id)) break;
      // not part of a book's title or a reference: "1 Enoch 72:1", "the Book of Enoch"
      const re = new RegExp(`(?<![\\p{L}-])(?<!\\d )(?<!Book of )${reEsc(esc(form))}(?![\\p{L}])(?! \\d)`, "u");
      skipDepth = 0;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.startsWith("<")) {
          if (/^<(h[1-3]|a)\b/.test(p)) skipDepth++;
          else if (/^<\/(h[1-3]|a)>/.test(p)) skipDepth = Math.max(0, skipDepth - 1);
          continue;
        }
        if (skipDepth) continue;
        // (not inside a name already marked: "Luther" in "Martin Luther")
        if (/^<span data-ref="n:[^"]*">$/.test(parts[i - 1] ?? "")) continue;
        const m = re.exec(p);
        if (!m) continue;
        const marked = `${p.slice(0, m.index)}<span data-ref="${esc(id)}">${m[0]}</span>${p.slice(m.index + m[0].length)}`;
        parts.splice(i, 1, ...marked.split(/(<[^>]+>)/)); // (so later names see this text as text again)
        seen.add(id);
        found.push({ at: 0, ref: { key: id, kind: "name", label: key, ...(cardFor(r) ? { card: cardFor(r) } : {}) } });
        break;
      }
    }
  }
  html = parts.join("");
  // a word with neither an outside summary nor the article's explanation is left out of the guide (its mention keeps
  // the older dictionary card, if it has one)
  for (const f of found.filter((f) => f.ref.kind === "word" && !f.ref.card && !f.ref.gloss)) html = html.replace(` data-ref="${esc(f.ref.key)}"`, "");
  for (let i = found.length - 1; i >= 0; i--) if (found[i].ref.kind === "word" && !found[i].ref.card && !found[i].ref.gloss) found.splice(i, 1);
  // in order of first mention: where each one's mark stands in the finished text
  for (const f of found) f.at = html.indexOf(`data-ref="${esc(f.ref.key)}"`);
  return { html, refs: found.sort((a, b) => a.at - b.at).map((f) => f.ref) };
}

async function main() {
  REFS = JSON.parse(await readFile(path.join(SRC, "references.json"), "utf8").catch(() => '{"terms":{},"books":{},"names":{},"skip":[]}'));
  CACHE = JSON.parse(await readFile(path.join(SRC, "refs-cache.json"), "utf8").catch(() => "{}"));
  const index: ArticleSummary[] = [];
  const built: { name: string; article: Article }[] = []; // written only once every article has built
  const dirs = (await readdir(SRC, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory());
  for (const d of dirs) {
    const meta = JSON.parse(await readFile(path.join(SRC, d.name, "article.json"), "utf8")) as Omit<Article, "tiers" | "depths">;
    if (meta.slug !== d.name) throw new Error(`${d.name}: slug in article.json is "${meta.slug}"`);
    if (meta.status === "draft") continue;
    const tiers: Article["tiers"] = {};
    for (const depth of DEPTHS) {
      const md = await readFile(path.join(SRC, d.name, `${depth}.md`), "utf8").catch(() => "");
      if (!md.trim()) continue;
      const built = markdown(md);
      const { html, refs } = studyRefs(built.html);
      tiers[depth] = { html, toc: built.toc, words: built.words, minutes: Math.max(1, Math.round(built.words / WPM)), study: refs } satisfies Tier;
    }
    if (!Object.keys(tiers).length) throw new Error(`${d.name}: no depth written yet`);
    const depths = Object.fromEntries(Object.entries(tiers).map(([k, t]) => [k, { words: t!.words, minutes: t!.minutes }]));
    const summary: ArticleSummary = { ...meta, depths };
    index.push(summary);
    built.push({ name: d.name, article: { ...summary, tiers } });
  }
  // related articles: the ones sharing most themes (two points each) and traditions (one), at most four; a published
  // article lists only published ones (a preview may also list other previews)
  for (const { article: a } of built) {
    a.related = built
      .map(({ article: b }) => b)
      .filter((b) => b.slug !== a.slug && (a.status !== "published" || b.status === "published"))
      .map((b) => {
        const themes = b.themes.filter((t) => a.themes.includes(t));
        const trads = b.traditions.filter((t) => a.traditions.includes(t));
        return { b, score: themes.length * 2 + trads.length, shared: [...themes, ...trads] };
      })
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score || y.b.date.localeCompare(x.b.date))
      .slice(0, 4)
      .map((x): RelatedArticle => ({ slug: x.b.slug, title: x.b.title, volume: x.b.volume, shared: x.shared.slice(0, 3) }));
  }
  const files: [string, string][] = built.map(({ name, article }) => [`${name}.json`, JSON.stringify(article satisfies Article)]);
  index.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const [name, body] of files) await writeFile(path.join(OUT, name), body);
  await writeFile(path.join(OUT, "index.json"), JSON.stringify(index, null, 1) + "\n");
  console.log(`articles: ${index.filter((a) => a.status === "published").length} published, ${index.filter((a) => a.status === "review").length} in review`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("build-articles.mts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
