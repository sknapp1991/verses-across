"use client";
/**
 * Two spaces in one app (Skylar, Nov 8): the **Scriptures** (every tradition's texts, with Philosophy beside
 * them) and the **Library** (Literature: fiction, poetry, drama, children's books, non-fiction; and Freethought,
 * moved here on Nov 9). The same reader underneath; each side lists its own shelves, finds its own books and has its
 * own "continue reading".
 *
 * Which side shows: the side of the page being read, unless the reader flipped the switch ("Scriptures |
 * Library"); opening a book on the other side follows it again. The Scriptures are always the default.
 *
 * The switch's one explainer: shown once; after it's closed it may show one more time about three weeks
 * later, and never if the Library has been opened even once.
 */
import { useSyncExternalStore } from "react";
import { catalog } from "./catalog";

export type Side = "scriptures" | "library";

/** The shelves that make up the Library side (everything else is the Scriptures side). */
export const LIBRARY_SHELVES = new Set(["literature", "fiction", "freethought"]);
const LIBRARY_WORKS = new Set(
  catalog.religions.filter((r) => LIBRARY_SHELVES.has(r.id)).flatMap((r) => r.collections.flatMap((c) => c.items.map((i) => i.work).filter(Boolean) as string[])),
);
/** A work's side: the Library for the books on the Literature and Freethought shelves (Paine's Age of Reason too). */
export const sideOfWork = (work: string): Side => (LIBRARY_WORKS.has(work) ? "library" : "scriptures");
export const shelvesOf = (side: Side) => catalog.religions.filter((r) => LIBRARY_SHELVES.has(r.id) === (side === "library"));
export const SIDE_NAME: Record<Side, string> = { scriptures: "Scriptures", library: "Library" };

/* ---------- the side being shown ---------- */

let chosen: Side | null = null; // the switch's choice; null = follow the page
let pageWork = "";
const subs = new Set<() => void>();
const emit = () => subs.forEach((l) => l());

/** Called by the reader with the work on screen: a new page's own side shows again. */
export function setPageWork(work: string) {
  if (work === pageWork) return;
  pageWork = work;
  // a work on the other side from the one being shown: show its side (the switch's choice ends)
  if (chosen && sideOfWork(work) !== chosen) chosen = null;
  if (sideOfWork(work) === "library") noteLibraryOpened();
  emit();
}
export function chooseSide(side: Side) {
  chosen = side;
  if (side === "library") noteLibraryOpened();
  emit();
}
const current = (): Side => chosen ?? (pageWork ? sideOfWork(pageWork) : "scriptures");
export function useSide(): Side {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    current,
    () => "scriptures",
  );
}

/* ---------- the explainer's schedule ---------- */

const TIP = "va-side-tip:v1";
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
