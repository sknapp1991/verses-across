"use client";
/**
 * Study lab badges (hidden: shown only on /study-lab, never on the Progress page or in achievements.ts). Most are
 * worked out from what the study pages already keep on this device; where a page keeps nothing usable, it calls
 * `noteLab` (a word journeyed, a verse compared, an echo pair or a place opened) or `labBest` (the fastest chapter in
 * the speed reader). A badge once earned is remembered (`va-lab-earned:v1`, synced entry by entry as the "lab" area),
 * so clearing a page's data later doesn't take it away.
 * Old Safari safe: no .at, no structuredClone, no groupBy.
 */
import { touch } from "./stamps";

/** The little counters some pages add (sets of things opened, and best numbers). */
const COUNTS = "va-lab:v1";
/** Badges earned so far: id -> the day it was first seen earned (YYYY-MM-DD). */
export const LAB_EARNED = "va-lab-earned:v1";
/** Fired when the earned badges change (here or from sync). */
export const LAB_EVENT = "va-lab-badges";
const MAX_SET = 500;

type Counts = { s: Record<string, string[]>; b: Record<string, number> };
export type LabSet = "journeys" | "verses" | "echoes" | "places";

function readCounts(): Counts {
  try {
    const c = JSON.parse(localStorage.getItem(COUNTS) ?? "null") as Partial<Counts> | null;
    return { s: c && typeof c.s === "object" && c.s ? c.s : {}, b: c && typeof c.b === "object" && c.b ? c.b : {} };
  } catch {
    return { s: {}, b: {} };
  }
}
function writeCounts(c: Counts) {
  try {
    localStorage.setItem(COUNTS, JSON.stringify(c));
  } catch {
    /* private mode: not counted */
  }
}

/** One more thing opened (each distinct key counts once). */
export function noteLab(set: LabSet, key: string) {
  if (!key) return;
  const c = readCounts();
  const list = Array.isArray(c.s[set]) ? c.s[set] : [];
  if (list.indexOf(key) >= 0 || list.length >= MAX_SET) return;
  c.s[set] = list.concat(key);
  writeCounts(c);
}
/** Keep the best (highest) number seen, e.g. the fastest chapter read. */
export function labBest(name: "wpm", n: number) {
  if (!isFinite(n)) return;
  const c = readCounts();
  if ((c.b[name] ?? 0) >= n) return;
  c.b[name] = Math.round(n);
  writeCounts(c);
}

const readJson = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
};
const obj = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

export type LabBadge = { id: string; name: string; icon: string; how: string; href: string };
export const LAB_BADGES: LabBadge[] = [
  { id: "first-journey", name: "First journey", icon: "🧭", how: "Follow one word in Word journeys.", href: "/word-journeys" },
  { id: "seven-translations", name: "Seven translations", icon: "📜", how: "Compare 7 different verses in the Translation lab.", href: "/translation-lab" },
  { id: "aleph-bet", name: "Aleph-bet", icon: "א", how: "Finish every Hebrew lesson in Learn the alphabets, reading included.", href: "/learn-alphabets" },
  { id: "alpha-beta", name: "Alpha-beta", icon: "α", how: "Finish every Greek lesson in Learn the alphabets, reading included.", href: "/learn-alphabets" },
  { id: "alif-ba", name: "Alif-ba", icon: "ا", how: "Finish every Arabic lesson in Learn the alphabets, reading included.", href: "/learn-alphabets" },
  { id: "path-walked", name: "The whole path", icon: "🛤️", how: "Tick every day of one Study path.", href: "/study-paths" },
  { id: "by-heart", name: "By heart", icon: "💛", how: "Learn 10 verses in Memorize (each one due a week or more away).", href: "/memorize" },
  { id: "still-waters", name: "Still waters", icon: "🌊", how: "Sit with a passage 7 times in Slow reading.", href: "/slow-reading" },
  { id: "cartographer", name: "Cartographer", icon: "🗺️", how: "Open 100 places in Time and place.", href: "/time-and-place" },
  { id: "echo-hunter", name: "Echo hunter", icon: "🔔", how: "Open 25 pairs of books in Echoes.", href: "/echoes" },
  { id: "swift-reader", name: "Swift reader", icon: "⚡", how: "Read a whole chapter at 600 words a minute or faster in the Speed reader.", href: "/speed-reader" },
  { id: "letters-as-numbers", name: "Letters as numbers", icon: "🔢", how: "Solve all 4 puzzles in Letters as numbers.", href: "/aleph-alpha-alif" },
];

export type LabStatus = { earned: boolean; since?: string; have: number; need: number };

export function readEarned(): Record<string, string> {
  const e = obj(readJson(LAB_EARNED));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e)) if (typeof v === "string") out[k] = v;
  return out;
}
function writeEarned(e: Record<string, string>, fromSync = false) {
  try {
    localStorage.setItem(LAB_EARNED, JSON.stringify(e));
  } catch {
    /* private mode */
  }
  if (!fromSync) touch("lab");
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LAB_EVENT));
}
/** The earned badges as synced from another device (sync.ts). */
export const setEarnedFromSync = (e: Record<string, string>) => writeEarned(e, true);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Every lab badge's state on this device (the course data is loaded only when this runs). */
export async function labStatus(): Promise<Record<string, LabStatus>> {
  const [{ ALPHABETS }, { STUDY_PATHS }] = await Promise.all([import("./alphabet-lessons"), import("./study-paths")]);
  const c = readCounts();
  const size = (s: LabSet) => (Array.isArray(c.s[s]) ? c.s[s].length : 0);
  const got: Record<string, [number, number]> = {};

  got["first-journey"] = [size("journeys"), 1];
  got["seven-translations"] = [size("verses"), 7];

  // Learn the alphabets: every lesson and the last reading (index lessons.length) done
  const alpha = obj(readJson("va-learn-alphabets-v1"));
  const ids: Record<string, string> = { hebrew: "aleph-bet", greek: "alpha-beta", arabic: "alif-ba" };
  for (const a of ALPHABETS) {
    const total = a.lessons.length + 1;
    const done = obj(alpha[a.id]).done;
    const n = Array.isArray(done) ? done.filter((x, i, all) => typeof x === "number" && x >= 0 && x < total && all.indexOf(x) === i).length : 0;
    if (ids[a.id]) got[ids[a.id]] = [n, total];
  }

  // Study paths: the most days ticked on any one path, against its length
  const paths = obj(obj(readJson("study-paths:v1")).paths);
  let bestPath: [number, number] = [0, STUDY_PATHS.length ? STUDY_PATHS[0].weeks.reduce((n, w) => n + w.days.length, 0) : 1];
  for (const p of STUDY_PATHS) {
    const done = obj(obj(paths[p.id]).done);
    const total = p.weeks.reduce((n, w) => n + w.days.length, 0);
    let n = 0;
    p.weeks.forEach((w, wi) => w.days.forEach((_, di) => (done[`${wi}-${di}`] === true ? n++ : 0)));
    if (total && n / total > bestPath[0] / bestPath[1]) bestPath = [n, total];
  }
  got["path-walked"] = bestPath;

  // Memorize: cards reviewed until they're due a week or more away
  const cards = obj(readJson("va-memorize:v1")).cards;
  const learned = Array.isArray(cards) ? cards.filter((x) => !obj(x).missing && Number(obj(obj(x).sched).interval) >= 7).length : 0;
  got["by-heart"] = [learned, 10];

  // Slow reading: every sitting in the journal
  const journal = readJson("va-slow-reading:journal:v1");
  const sittings = Array.isArray(journal) ? journal.reduce((n: number, e) => n + (Array.isArray(obj(e).sittings) ? (obj(e).sittings as unknown[]).length : 0), 0) : 0;
  got["still-waters"] = [sittings, 7];

  got["cartographer"] = [size("places"), 100];
  got["echo-hunter"] = [size("echoes"), 25];
  got["swift-reader"] = [Math.min(c.b.wpm ?? 0, 600), 600];

  const solved = readJson("va-layers:v1");
  got["letters-as-numbers"] = [Array.isArray(solved) ? solved.filter((x, i, all) => typeof x === "string" && all.indexOf(x) === i).length : 0, 4];

  // remember newly earned ones (kept even if the page's own data is cleared later)
  const earned = readEarned();
  let fresh = false;
  for (const b of LAB_BADGES) {
    const [have, need] = got[b.id] ?? [0, 1];
    if (have >= need && !earned[b.id]) {
      earned[b.id] = today();
      fresh = true;
    }
  }
  if (fresh) writeEarned(earned);

  const out: Record<string, LabStatus> = {};
  for (const b of LAB_BADGES) {
    const [have, need] = got[b.id] ?? [0, 1];
    out[b.id] = { earned: !!earned[b.id], since: earned[b.id], have: Math.min(have, need), need };
  }
  return out;
}
