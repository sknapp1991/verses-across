"use client";
/**
 * What a reader saves from the articles' Study guide (hub b53fdab9): a verse, a word, a name, a book, a theme or a
 * related article, ticked to study later. Kept on this device (like the reflection answers), shown in My Study's
 * Articles tab with the articles read there, and used for the bookcase's "Suggested for you" shelf.
 */
import { useSyncExternalStore } from "react";
import { touch } from "./stamps";

export const SAVED = "va-article-saved:v1"; // localStorage: { [id]: SavedRef }
export const READ = "va-article-read:v1"; // localStorage: { slug: { depth: "YYYY-MM-DD" } } (article-reader writes it)
const EVENT = "va-article-study";

export type SavedKind = "verse" | "word" | "name" | "book" | "theme" | "article" | "text";
export type SavedRef = {
  id: string;
  kind: SavedKind;
  label: string;
  /** where it opens: a verse or chapter in the reader, an article, a Wikipedia page… */
  href?: string;
  /** the article it was saved from */
  slug: string;
  articleTitle: string;
  note?: string;
  at: number;
};

function read<T>(key: string, empty: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? empty;
  } catch {
    return empty;
  }
}

let snapshot: Record<string, SavedRef> | null = null;
const subscribe = (cb: () => void) => {
  const on = () => {
    snapshot = null;
    cb();
  };
  window.addEventListener(EVENT, on);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener(EVENT, on);
    window.removeEventListener("storage", on);
  };
};
const get = () => (snapshot ??= read<Record<string, SavedRef>>(SAVED, {}));
const EMPTY: Record<string, SavedRef> = {};

/** Everything saved from the articles, by id (the server and first paint see nothing). */
export function useSavedRefs(): Record<string, SavedRef> {
  return useSyncExternalStore(subscribe, get, () => EMPTY);
}

export function toggleSaved(ref: Omit<SavedRef, "at">, on: boolean) {
  const all = { ...read<Record<string, SavedRef>>(SAVED, {}) };
  if (on) all[ref.id] = { ...ref, at: Date.now() };
  else delete all[ref.id];
  try {
    localStorage.setItem(SAVED, JSON.stringify(all));
  } catch {
    /* storage blocked: nothing kept */
  }
  touch("articles"); // (sync carries it to the other devices)
  snapshot = null;
  window.dispatchEvent(new Event(EVENT));
}

/** The articles read on this device, by slug: the depths and the day each was marked read. */
export function readArticles(): Record<string, Partial<Record<string, string>>> {
  return read(READ, {});
}
/** Tell the bookcase and My Study that an article was marked read (article-reader calls it). */
export const articleStudyChanged = () => window.dispatchEvent(new Event(EVENT));

let readSnap: Record<string, Partial<Record<string, string>>> | null = null;
const subscribeRead = (cb: () => void) => {
  const on = () => {
    readSnap = null;
    cb();
  };
  window.addEventListener(EVENT, on);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener(EVENT, on);
    window.removeEventListener("storage", on);
  };
};
const EMPTY_READ: Record<string, Partial<Record<string, string>>> = {};
export function useReadArticles() {
  return useSyncExternalStore(subscribeRead, () => (readSnap ??= readArticles()), () => EMPTY_READ);
}

/**
 * Articles to suggest: unread ones that share the most themes and traditions with what this reader has read and
 * saved (each read article counts its themes twice), newest first among equals. With nothing read yet: the newest.
 */
export function suggestArticles<T extends { slug: string; themes: string[]; traditions: string[]; date: string }>(
  all: T[],
  read: Record<string, unknown>,
  saved: Record<string, SavedRef>,
  limit = 4,
): T[] {
  const weight = new Map<string, number>();
  const bump = (k: string, n: number) => weight.set(k, (weight.get(k) ?? 0) + n);
  for (const a of all)
    if (read[a.slug]) {
      a.themes.forEach((t) => bump(`t:${t}`, 2));
      a.traditions.forEach((t) => bump(`r:${t}`, 1));
    }
  for (const s of Object.values(saved)) if (s.kind === "theme") bump(`t:${s.label}`, 3);
  const unread = all.filter((a) => !read[a.slug]);
  if (!weight.size) return [...unread].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  return unread
    .map((a) => ({ a, s: a.themes.reduce((n, t) => n + (weight.get(`t:${t}`) ?? 0), 0) + a.traditions.reduce((n, t) => n + (weight.get(`r:${t}`) ?? 0), 0) }))
    .sort((x, y) => y.s - x.s || y.a.date.localeCompare(x.a.date))
    .slice(0, limit)
    .map((x) => x.a);
}

/* ---- The Articles page's Library view (my brother's ticket e555be87): the whole page as a bookcase. On this device. ---- */
const VIEW = "va-articles-view:v1";
const viewSubs = new Set<() => void>();
function readView(): boolean {
  try {
    return localStorage.getItem(VIEW) === "library";
  } catch {
    return false;
  }
}
export function setLibraryView(on: boolean) {
  try {
    if (on) localStorage.setItem(VIEW, "library");
    else localStorage.removeItem(VIEW);
  } catch {
    /* fine without */
  }
  viewSubs.forEach((l) => l());
}
export function useLibraryView(): boolean {
  return useSyncExternalStore(
    (l) => {
      viewSubs.add(l);
      return () => viewSubs.delete(l);
    },
    readView,
    () => false,
  );
}

/* ---- The bookcase in HD (my brother's ticket 126db598): textures and spine details; SD (the plain one) by default ---- */
const HD = "va-bookcase-hd:v1";
const hdSubs = new Set<() => void>();
function readHd(): boolean {
  try {
    return localStorage.getItem(HD) === "1";
  } catch {
    return false;
  }
}
export function setBookcaseHd(on: boolean) {
  try {
    if (on) localStorage.setItem(HD, "1");
    else localStorage.removeItem(HD);
  } catch {
    /* fine without */
  }
  hdSubs.forEach((l) => l());
}
export function useBookcaseHd(): boolean {
  return useSyncExternalStore(
    (l) => {
      hdSubs.add(l);
      return () => hdSubs.delete(l);
    },
    readHd,
    () => false,
  );
}
