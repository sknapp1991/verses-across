// Stop hook (SESSION-PLAYBOOK §5): refuse to end a turn while ROADMAP.md differs from the published roadmap page.
//   node scripts/roadmap-sync-check.mjs              → exit 0 if in sync, else exit 2 with what to do (shown to Claude)
//   node scripts/roadmap-sync-check.mjs --published  → record the current ROADMAP.md as published (run after publishing)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stamp = path.join(ROOT, ".cache-roadmap", "published.json");
const hash = createHash("sha256").update(readFileSync(path.join(ROOT, "ROADMAP.md"), "utf8")).digest("hex").slice(0, 16);

if (process.argv.includes("--published")) {
  mkdirSync(path.dirname(stamp), { recursive: true });
  writeFileSync(stamp, JSON.stringify({ hash, published: new Date().toISOString() }) + "\n");
  console.log(`roadmap ${hash} recorded as published`);
  process.exit(0);
}
let published = "";
try {
  published = JSON.parse(readFileSync(stamp, "utf8")).hash;
} catch {
  /* never published */
}
if (published === hash) process.exit(0);
process.stderr.write(
  "ROADMAP.md changed since the roadmap page was last published. Run `npx tsx scripts/roadmap-page.mts`, publish " +
    ".cache-roadmap/index.html with the Artifact tool (same file path, so the same URL), then " +
    "`node scripts/roadmap-sync-check.mjs --published`.\n",
);
process.exit(2);
