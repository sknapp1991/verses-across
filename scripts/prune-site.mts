/**
 * Two sites from one codebase (src/lib/site.ts): before a Cloudflare build, drop the other site's texts, search
 * files and preview pictures from public/, so each Worker ships only its own books (Verses Across: the scriptures and
 * philosophy; Library Across: literature, Freethought, Psychology) and both stay well under the static-file limit.
 *
 * Runs only on Cloudflare's build machines (WORKERS_CI=1), or with PRUNE_SITE=1: on this computer public/ is the
 * working copy, and deleting from it would remove the files from git.
 *
 *   NEXT_PUBLIC_SITE=library PRUNE_SITE=1 tsx scripts/prune-site.mts   (try it on a throwaway copy only)
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalog, sideOfWork } from "../src/lib/catalog";
import { SITE_NAME, SITE_SIDE } from "../src/lib/site";

if (!process.env.WORKERS_CI && !process.env.PRUNE_SITE) {
  console.log(`prune-site: skipped (not a Cloudflare build); ${SITE_NAME} keeps every file locally`);
  process.exit(0);
}

// PRUNE_PUBLIC: another folder to prune instead (for testing on a dummy copy)
const PUBLIC = process.env.PRUNE_PUBLIC || join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const workOfVersion = new Map(catalog.versions.map((v) => [v.id, v.work]));
const known = new Set(catalog.works.map((w) => w.id));

let removed = 0;
function prune(dir: string, belongsElsewhere: (name: string) => boolean) {
  const root = join(PUBLIC, dir);
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    if (!belongsElsewhere(name)) continue;
    rmSync(join(root, name), { recursive: true, force: true });
    removed++;
  }
}

// /texts/<work>/<version>/<book>.json and /og/<work>/<book>.png: by work
const otherWork = (work: string) => known.has(work) && sideOfWork(work) !== SITE_SIDE;
prune("texts", otherWork);
prune("og", otherWork);
// /search/<version>/…: by the version's work; /search/_library is the Library's all-books index
prune("search", (name) => {
  if (name === "_library") return SITE_SIDE !== "library";
  const work = workOfVersion.get(name);
  return !!work && otherWork(work);
});

console.log(`prune-site: ${SITE_NAME} build, removed ${removed} folders of the other site's books`);
