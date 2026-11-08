/**
 * Run `npm run pack` only when something it reads changed since the last pack (prebuild / predev).
 *
 * Packing (texts, search indexes, word data, preview images…) takes 10–20 minutes on this library; a local
 * rebuild after a code-only change doesn't need it. Inputs: data/ (except data/raw), scripts/, src/lib/.
 * The stamp lives in .cache/ (git-ignored), so a fresh checkout — e.g. Cloudflare's build — always packs.
 *
 *   node scripts/pack-if-stale.mjs          (FORCE_PACK=1 to pack anyway)
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const STAMP = path.join(ROOT, ".cache", "pack-stamp");
const INPUTS = ["data", "scripts", path.join("src", "lib")];
const SKIP = new Set([path.join(ROOT, "data", "raw")]);

function newest(p) {
  if (SKIP.has(p)) return 0;
  const st = statSync(p);
  if (!st.isDirectory()) return st.mtimeMs;
  let m = st.mtimeMs; // a removed file changes its folder's time
  for (const name of readdirSync(p)) m = Math.max(m, newest(path.join(p, name)));
  return m;
}

const packed = ["texts", "search"].every((d) => existsSync(path.join(ROOT, "public", d)));
const stamp = existsSync(STAMP) ? statSync(STAMP).mtimeMs : 0;
const changed = Math.max(...INPUTS.map((d) => newest(path.join(ROOT, d))));

if (!process.env.FORCE_PACK && packed && stamp && changed < stamp) {
  console.log("pack: nothing changed since the last pack, skipped (FORCE_PACK=1 to pack anyway)");
} else {
  // The stamp gets the time the pack STARTED: a data change made while it runs still counts next time.
  const started = new Date();
  execSync("npm run pack", { cwd: ROOT, stdio: "inherit" });
  mkdirSync(path.dirname(STAMP), { recursive: true });
  writeFileSync(STAMP, started.toISOString());
  utimesSync(STAMP, started, started);
}
