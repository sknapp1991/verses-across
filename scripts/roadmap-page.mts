/**
 * The published roadmap page (SESSION-PLAYBOOK §5, Skylar Nov 20): ROADMAP.md → .cache-roadmap/index.html, published
 * as an Artifact at the same URL every time. The hub's Roadmap tab reads ROADMAP.md from the repo by itself; this page
 * is the shareable / desktop-shortcut copy.
 *
 *   npx tsx scripts/roadmap-page.mts            → writes .cache-roadmap/index.html (+ built.json with ROADMAP.md's hash)
 *   node scripts/roadmap-sync-check.mjs --published   (after publishing: records that this version is live)
 *
 * A Stop hook (scripts/roadmap-sync-check.mjs) refuses to end a turn while ROADMAP.md differs from the published one.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, ".cache-roadmap");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Inline Markdown the roadmap uses: **bold**, `code`, [links](https://…), bare https links. */
const inline = (s: string) =>
  esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])((?:https:\/\/)?(?:versesacross|libraryacross)\.com\/[^\s),]*)/g, (m, a: string, u: string) => `${a}<a href="${u.startsWith("http") ? u : `https://${u}`}" target="_blank" rel="noopener">${u}</a>`);

type Row = { id: string; item: string; status?: string; notes: string };

function parse(md: string) {
  const sections: { title: string; rows: Row[]; bullets: string[]; intro: string[] }[] = [];
  let cur: (typeof sections)[number] | null = null;
  let header: string[] = [];
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      cur = { title: h[1].trim(), rows: [], bullets: [], intro: [] };
      sections.push(cur);
      header = [];
      continue;
    }
    if (!cur) continue;
    if (/^\|/.test(line)) {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue;
      if (!header.length) {
        header = cells.map((c) => c.toLowerCase());
        continue;
      }
      const get = (k: string) => cells[header.indexOf(k)] ?? "";
      cur.rows.push({ id: get("#"), item: get("item"), status: header.includes("status") ? get("status") : undefined, notes: get("notes") });
      continue;
    }
    if (/^- /.test(line)) cur.bullets.push(line.slice(2));
    else if (line.trim() && !cur.rows.length && !cur.bullets.length) cur.intro.push(line.trim());
  }
  return sections;
}

async function main() {
  const md = await readFile(path.join(ROOT, "ROADMAP.md"), "utf8");
  const hash = createHash("sha256").update(md).digest("hex").slice(0, 16);
  const sections = parse(md);
  const updated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const card = (r: Row) => `
      <article class="item" id="item-${esc(r.id.toLowerCase())}">
        <header><span class="tag">${esc(r.id)}</span><h3>${inline(r.item)}</h3>${r.status ? `<span class="status">${inline(r.status)}</span>` : ""}</header>
        <p>${inline(r.notes)}</p>
      </article>`;
  const body = sections
    .map((s) => {
      const isHistory = /history/i.test(s.title);
      const inner = [
        s.intro.length ? `<p class="intro">${inline(s.intro.join(" "))}</p>` : "",
        s.rows.map(card).join(""),
        s.bullets.length ? `<ul>${s.bullets.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>` : "",
      ].join("");
      return isHistory
        ? `<section><details><summary><h2>${esc(s.title)}</h2></summary>${inner}</details></section>`
        : `<section><h2>${esc(s.title)}</h2>${inner}</section>`;
    })
    .join("\n");
  const html = `<title>Verses Across Roadmap</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,650&family=Inter:wght@400;500;600&display=swap">
<style>
/* Layout: one reading column; Now / Next / Later as stacked item cards keyed by their roadmap id, history folded. */
:root {
  --bg: #f7f6f2; --fg: #22252b; --muted: #5d6470; --line: #dedbd2; --card: #ffffff; --accent: #1f3a5f; --accent-soft: #e5ebf3;
  --serif: "Source Serif 4", Georgia, serif; --sans: Inter, system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #14171c; --fg: #e8e6e1; --muted: #9aa1ab; --line: #2b313a; --card: #1b1f26; --accent: #8fb3e0; --accent-soft: #223247; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #14171c; --fg: #e8e6e1; --muted: #9aa1ab; --line: #2b313a; --card: #1b1f26; --accent: #8fb3e0; --accent-soft: #223247; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 15px/1.55 var(--sans); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 760px; margin: 0 auto; display: grid; gap: 32px; }
h1 { font: 650 2rem/1.15 var(--serif); margin: 0; text-wrap: balance; }
h2 { font: 650 1.35rem/1.2 var(--serif); margin: 0 0 12px; display: inline; }
section { display: grid; gap: 12px; min-width: 0; }
section > h2 { display: block; }
.meta { color: var(--muted); font-size: 13px; display: flex; flex-wrap: wrap; gap: 6px 16px; }
.meta a { color: var(--accent); }
.item { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; display: grid; gap: 6px; min-width: 0; }
.item header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
.item h3 { font: 600 1rem/1.3 var(--sans); margin: 0; flex: 1 1 260px; min-width: 0; }
.item p { margin: 0; color: var(--muted); overflow-wrap: anywhere; }
.tag { font: 600 12px/1 var(--sans); letter-spacing: .04em; color: var(--accent); background: var(--accent-soft); border-radius: 6px; padding: 4px 6px; }
.status { font-size: 12px; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; max-width: 100%; }
ul { margin: 0; padding-left: 20px; display: grid; gap: 6px; color: var(--muted); }
code { font-size: .9em; background: var(--accent-soft); border-radius: 4px; padding: 0 4px; }
a { color: var(--accent); }
details summary { cursor: pointer; list-style: revert; }
details[open] summary { margin-bottom: 12px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
<main>
  <header style="display:grid;gap:8px">
    <h1>Verses Across Roadmap</h1>
    <div class="meta"><span>Updated ${esc(updated)}</span><span>From ROADMAP.md (${hash})</span><a href="https://hub.versesacross.com/" target="_blank" rel="noopener">Team hub</a><a href="https://versesacross.com" target="_blank" rel="noopener">versesacross.com</a></div>
  </header>
${body}
</main>
`;
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "index.html"), html);
  await writeFile(path.join(OUT, "built.json"), JSON.stringify({ hash, built: new Date().toISOString() }) + "\n");
  console.log(`roadmap page built (${sections.length} sections, ROADMAP.md ${hash})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
