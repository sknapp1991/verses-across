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
import type { Article, ArticleSummary, Depth, Tier, TocEntry } from "../src/lib/articles";

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
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
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

async function main() {
  const index: ArticleSummary[] = [];
  const files: [string, string][] = []; // written only once every article has built
  const dirs = (await readdir(SRC, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory());
  for (const d of dirs) {
    const meta = JSON.parse(await readFile(path.join(SRC, d.name, "article.json"), "utf8")) as Omit<Article, "tiers" | "depths">;
    if (meta.slug !== d.name) throw new Error(`${d.name}: slug in article.json is "${meta.slug}"`);
    if (meta.status === "draft") continue;
    const tiers: Article["tiers"] = {};
    for (const depth of DEPTHS) {
      const md = await readFile(path.join(SRC, d.name, `${depth}.md`), "utf8").catch(() => "");
      if (!md.trim()) continue;
      const { html, toc, words } = markdown(md);
      tiers[depth] = { html, toc, words, minutes: Math.max(1, Math.round(words / WPM)) } satisfies Tier;
    }
    if (!Object.keys(tiers).length) throw new Error(`${d.name}: no depth written yet`);
    const depths = Object.fromEntries(Object.entries(tiers).map(([k, t]) => [k, { words: t!.words, minutes: t!.minutes }]));
    const summary: ArticleSummary = { ...meta, depths };
    index.push(summary);
    files.push([`${d.name}.json`, JSON.stringify({ ...summary, tiers } satisfies Article)]);
  }
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
