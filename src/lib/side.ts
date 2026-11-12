"use client";
/**
 * Two sites from one codebase (src/lib/site.ts, Skylar, Nov 10): until then the **Scriptures** and the **Library**
 * were two sides of one app with a switch; now Verses Across is the Scriptures and Library Across is the Library.
 * The helpers keep their names (sidebar, search, themes, cross references use them): the side shown is always this
 * site's, and choosing the other side goes to the other site, taking the reader's saved data along.
 *
 * The switch's one explainer: shown once; after it's closed it may show one more time about three weeks
 * later, and never if the other site has been opened from here.
 */
import { useSyncExternalStore } from "react";
import { catalog, sideOfWork } from "./catalog";
import { LIBRARY_SHELVES, ORIGINS, SITE_NAMES, SITE_SIDE, type Side } from "./site";
import { forwardTo } from "@/components/domain-move";

export type { Side };
export { LIBRARY_SHELVES, sideOfWork };
export const shelvesOf = (side: Side) => catalog.religions.filter((r) => LIBRARY_SHELVES.has(r.id) === (side === "library"));
export const SIDE_NAME: Record<Side, string> = SITE_NAMES;

/** Called by the reader with the work on screen (kept for the reader; the side no longer changes within a site). */
export function setPageWork(work: string) {
  void work;
}
/** The other side lives on the other site: go there (same path when it's a page both have), with the saved data. */
export function chooseSide(side: Side, path = "/", newTab = false) {
  if (side === SITE_SIDE) return;
  noteLibraryOpened();
  forwardTo(ORIGINS[side], path, newTab);
}
const noop = () => () => {};
export function useSide(): Side {
  return useSyncExternalStore(noop, () => SITE_SIDE, () => SITE_SIDE);
}

/* ---------- the explainer's schedule ---------- */

const TIP = "va-side-tip:v2"; // v2: the sites split (Nov 10), so everyone hears about it once
type Tip = { first?: number; second?: number; library?: 1 };
const REPEAT_MS = 21 * 86_400_000; // about three weeks
function readTip(): Tip {
  try {
    return (JSON.parse(localStorage.getItem(TIP) ?? "{}") as Tip) ?? {};
  } catch {
    return {};
  }
}
function writeTip(t: Tip) {
  try {
    localStorage.setItem(TIP, JSON.stringify(t));
  } catch {
    /* private mode: it may show again, which is harmless */
  }
}
function noteLibraryOpened() {
  const t = readTip();
  if (!t.library) writeTip({ ...t, library: 1 });
}
/** Should the explainer show now? First time: yes. Once more ~3 weeks after the first, unless the Library was opened. */
export function tipDue(now = Date.now()): boolean {
  const t = readTip();
  if (!t.first) return true;
  if (t.second || t.library) return false;
  return now - t.first >= REPEAT_MS;
}
/** The explainer was closed. */
export function tipShown(now = Date.now()) {
  const t = readTip();
  writeTip(t.first ? { ...t, second: now } : { ...t, first: now });
}
