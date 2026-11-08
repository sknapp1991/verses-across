/**
 * Scan every chapter in data/texts for transcription slips: sub-verse labels left in the text ("14 a.",
 * "b."), stray verse numbers, footnote marks, leftover HTML, page markers, OCR slips ("tbe", "aud"),
 * words broken by a hyphen ("right- eous"), doubled words, unbalanced brackets, odd characters.
 * Writes a report (counts and samples per version) to the path given, default scan-report.json.
 *
 *   npx tsx scripts/scan-texts.mts [out.json]
 *
 * It only reports; fixing is done in the importers (or a version's own fix list) and checked by hand.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "data", "texts");
const OUT = process.argv[2] ?? "scan-report.json";

type Check = { id: string; re: RegExp; only?: (lang: string) => boolean; skip?: RegExp };
const CHECKS: Check[] = [
  { id: "subverse-label", re: /(?:^|\s)\d{1,3} ?[a-f]\.(?=\s)|(?:[,.;:!?'"]\s+|^)[b-f]\.\s+[A-Z]/ },
  { id: "inline-verse-number", re: /[.;:!?'"’”]\s+\d{1,3}\.?\s+(?:And|But|For|Then|The|He|I|Now|So|Thus|And|Yea|O)\b/ },
  { id: "footnote-mark", re: /\[\d+\]|\{\d+\}|[†‡¶§]|\w\*|\*\d|\(\d{1,2}\)(?=\s|$)/ },
  { id: "html", re: /<\/?[a-z][^>]*>|&[a-z]{2,8};|&#x?[0-9a-f]+;/i },
  { id: "page-marker", re: /\[p(?:age|\.)\s*\d+\]|\bp\.\s?\d{1,4}\b|\bPage \d+\b|\[Pg \d+\]/ },
  { id: "ocr-slip", re: /\b(?:tbe|tlie|aud|wliich|wbich|fhe|ihe|thc|bc|tbat|tliat|wlien|bim|liis|witli|tbis|tliis|tbey|tliey|nnto|nnder|tbou|thon|tliou|bnt|aud|anel|tlie|hy the|ou the|iu the)\b/, only: (l) => l === "en" },
  { id: "broken-hyphen", re: /\b[a-z]{2,}- [a-z]{2,}\b/, only: (l) => ["en", "fr", "es", "it", "de", "pt", "la"].includes(l), skip: /\b(?:and|or|und|et|y|e|ou|o|oder)\b(?=[^-]*$)/ },
  { id: "doubled-word", re: /\b([A-Za-z]{3,})\s+\1\b/i, skip: /\b(that that|had had|verily,? verily|holy,? holy|amen,? amen|very very|is is)\b/i },
  { id: "unbalanced-bracket", re: /^[^[\]]*\][^[]*$|^[^[\]]*\[[^\]]*$|\($/ },
  { id: "dangling-open", re: /[[(]\s*$/ },
  { id: "odd-char", re: /[�\u0000-\u0008\u000B\u000C\u000E-\u001F­​]/ },
  { id: "double-space", re: / {2,}/ },
  { id: "digit-in-word", re: /[a-z]\d|\d[a-z]{3,}/, only: (l) => l === "en", skip: /\d(?:st|nd|rd|th)\b/ },
  { id: "space-before-punct", re: /\w [,.;:!?](?!\.)/, only: (l) => l === "en" },
  { id: "empty-verse", re: /^\s*$/ },
];

type Hit = { file: string; v: string; at: string };
const report: Record<string, { lang: string; verses: number; checks: Record<string, { n: number; samples: Hit[] }> }> = {};

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

// Language of each version, from the catalogue.
const catalog = JSON.parse(await readFile(path.join(process.cwd(), "data", "catalog.json"), "utf8")) as { versions: { id: string; work: string; language: string }[] };
const langOf = new Map(catalog.versions.map((v) => [`${v.work}/${v.id}`, v.language]));

const files = await walk(ROOT);
let done = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep);
  const key = `${rel[0]}/${rel[1]}`; // work/version
  const lang = langOf.get(key) ?? "?";
  let data: { verses?: { v: string; t: string }[] };
  try {
    data = JSON.parse(await readFile(f, "utf8"));
  } catch {
    continue;
  }
  if (!Array.isArray(data.verses)) continue;
  const r = (report[key] ??= { lang, verses: 0, checks: {} });
  for (const { v, t } of data.verses) {
    if (typeof t !== "string") continue;
    r.verses++;
    for (const c of CHECKS) {
      if (c.only && !c.only(lang)) continue;
      const m = c.re.exec(t);
      if (!m) continue;
      if (c.skip && c.skip.test(m[0])) continue;
      const slot = (r.checks[c.id] ??= { n: 0, samples: [] });
      slot.n++;
      if (slot.samples.length < 6) {
        const i = Math.max(0, m.index - 40);
        slot.samples.push({ file: rel.slice(2).join("/"), v, at: t.slice(i, m.index + m[0].length + 40) });
      }
    }
  }
  if (++done % 5000 === 0) console.error(`${done}/${files.length}`);
}
await writeFile(OUT, JSON.stringify(report, null, 1));
console.error(`done: ${files.length} files → ${OUT}`);
