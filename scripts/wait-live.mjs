#!/usr/bin/env node
// Wait until a commit is live: the site's /api/version names that commit or a later one on main.
// (Nov 25, hub review: when commits land minutes apart, Workers Builds skips the older builds, so waiting on one
// commit's own build can hang; what matters is whether the live site includes it.)
//   node scripts/wait-live.mjs [sha] [--site verses|library] [--minutes 40]
// Prints LIVE <build> or NOT LIVE after the time limit (exit 1).
import { execFileSync } from "node:child_process";

const a = process.argv.slice(2);
const opt = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d);
const sha = a[0] && !a[0].startsWith("--") ? a[0] : execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const origin = opt("--site", "verses") === "library" ? "https://libraryacross.com" : "https://versesacross.com";
const end = Date.now() + Number(opt("--minutes", 40)) * 60_000;

/** true when `sha` is the build or an ancestor of it (the build includes the change). */
const includes = (build) => {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sha, build], { stdio: "ignore" });
    return true;
  } catch {
    return false; // not an ancestor, or a build commit this checkout doesn't have yet
  }
};

let last = "";
while (Date.now() < end) {
  try {
    const r = await fetch(`${origin}/api/version?t=${Date.now()}`, { headers: { "cache-control": "no-cache" } });
    if (r.ok) {
      const { build } = await r.json();
      if (build !== last) console.log(`live build: ${build}`);
      last = build;
      if (build && build !== "local" && includes(build)) {
        console.log(`LIVE ${build} (includes ${sha.slice(0, 9)})`);
        process.exit(0);
      }
    }
  } catch {
    /* a blip: try again */
  }
  await new Promise((res) => setTimeout(res, 30_000));
}
console.log(`NOT LIVE after the time limit (last build seen: ${last || "none"})`);
process.exit(1);
