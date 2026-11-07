"use client";
/**
 * Badges and levels (1–60, from experience), worked out from activity (activity.ts) and study items
 * (study.ts). Nothing is stored except which badges and level have already been announced, so they're
 * only celebrated once.
 */
import { dayKey, streaks, totals, type Activity } from "./activity";
import { catalog, findBook } from "./catalog";
import type { StudyItem } from "./storage";

export type Stats = {
  readSecs: number;
  listenSecs: number;
  verses: number;
  chaptersRead: number;
  studied: number;
  booksDone: number;
  collectionsDone: string[];
  traditions: number;
  works: number;
  notes: number;
  highlights: number;
  favorites: number;
  streak: number;
  bestStreak: number;
  /** Reading plans finished (of those still started on this device). */
  plansDone: number;
  /** Goals reached so far (each daily or weekly goal counts once per day or week). */
  goalsMet: number;
};

/** Counts kept elsewhere (plans.ts, the goal watcher) that feed badges and levels. */
export type Extras = { plansDone: number; goalsMet: number };

export function computeStats(a: Activity, items: Map<string, StudyItem>, extras: Extras = { plansDone: 0, goalsMet: 0 }): Stats {
  const t = totals(a);
  const perBook = new Map<string, number>();
  const studyDays: string[] = [];
  let notes = 0;
  let highlights = 0;
  let favorites = 0;
  let studied = 0;
  for (const it of items.values()) {
    if (it.kind === "studied") {
      studied++;
      perBook.set(`${it.work}/${it.book}`, (perBook.get(`${it.work}/${it.book}`) ?? 0) + 1);
      studyDays.push(dayKey(it.createdAt));
    } else if (it.kind === "note") notes++;
    else if (it.kind === "highlight") highlights++;
    else if (it.kind === "favorite") favorites++;
  }
  const finished = new Set<string>();
  for (const [k, n] of perBook) {
    const [w, b] = k.split("/");
    const total = findBook(w, b)?.chapters ?? 0;
    if (total > 0 && n >= total) finished.add(k);
  }
  const collectionsDone: string[] = [];
  for (const rel of catalog.religions)
    for (const col of rel.collections) {
      const books = col.items.filter((i) => i.work && i.chapters && i.status !== "coming-soon");
      if (books.length > 1 && books.every((i) => finished.has(`${i.work}/${i.id}`))) collectionsDone.push(col.name);
    }
  // traditions = religions with any reading, listening or study
  const worksTouched = new Set([...t.works, ...[...perBook.keys()].map((k) => k.split("/")[0])]);
  const religions = new Set<string>();
  for (const rel of catalog.religions)
    for (const col of rel.collections) for (const i of col.items) if (i.work && worksTouched.has(i.work)) religions.add(rel.id);
  const s = streaks(a, studyDays);
  return {
    readSecs: t.read,
    listenSecs: t.listen,
    verses: t.verses,
    chaptersRead: t.chapters,
    studied,
    booksDone: finished.size,
    collectionsDone,
    traditions: religions.size,
    works: worksTouched.size,
    notes,
    highlights,
    favorites,
    streak: s.current,
    bestStreak: s.best,
    plansDone: extras.plansDone,
    goalsMet: extras.goalsMet,
  };
}

export type Badge = { id: string; icon: string; name: string; how: string; value: (s: Stats) => number; target: number };

const tier = (id: string, icon: string, name: string, how: string, value: (s: Stats) => number, target: number): Badge => ({ id, icon, name, how, value, target });
const H = 3600;

export const BADGES: Badge[] = [
  // Chapters
  tier("first-chapter", "📖", "First chapter", "Read a chapter for 30 seconds or more", (s) => s.chaptersRead, 1),
  tier("chapters-10", "📘", "10 chapters", "Read 10 chapters", (s) => s.chaptersRead, 10),
  tier("chapters-50", "📚", "50 chapters", "Read 50 chapters", (s) => s.chaptersRead, 50),
  tier("chapters-150", "📜", "150 chapters", "Read 150 chapters", (s) => s.chaptersRead, 150),
  tier("chapters-500", "🏛️", "500 chapters", "Read 500 chapters", (s) => s.chaptersRead, 500),
  tier("chapters-1189", "🗿", "1,189 chapters", "Read 1,189 chapters (as many as the whole Bible has)", (s) => s.chaptersRead, 1189),
  tier("chapters-3000", "🌌", "3,000 chapters", "Read 3,000 chapters", (s) => s.chaptersRead, 3000),
  // Verses
  tier("verses-100", "✨", "100 verses", "Read 100 verses", (s) => s.verses, 100),
  tier("verses-1000", "🌟", "1,000 verses", "Read 1,000 verses", (s) => s.verses, 1000),
  tier("verses-6236", "🌙", "6,236 verses", "Read 6,236 verses (as many as the Quran has)", (s) => s.verses, 6236),
  tier("verses-10000", "💫", "10,000 verses", "Read 10,000 verses", (s) => s.verses, 10000),
  tier("verses-31102", "☀️", "31,102 verses", "Read 31,102 verses (as many as the whole Bible has)", (s) => s.verses, 31102),
  tier("verses-100000", "🌠", "100,000 verses", "Read 100,000 verses", (s) => s.verses, 100000),
  // Streaks
  tier("streak-3", "🔥", "3-day streak", "Read or listen 3 days in a row", (s) => s.bestStreak, 3),
  tier("streak-7", "🔥", "7-day streak", "Read or listen 7 days in a row", (s) => s.bestStreak, 7),
  tier("streak-14", "🕯️", "14-day streak", "Read or listen 14 days in a row", (s) => s.bestStreak, 14),
  tier("streak-30", "🏆", "30-day streak", "Read or listen 30 days in a row", (s) => s.bestStreak, 30),
  tier("streak-60", "🥇", "60-day streak", "Read or listen 60 days in a row", (s) => s.bestStreak, 60),
  tier("streak-100", "👑", "100-day streak", "Read or listen 100 days in a row", (s) => s.bestStreak, 100),
  tier("streak-365", "💎", "A whole year", "Read or listen 365 days in a row", (s) => s.bestStreak, 365),
  // Time
  tier("read-1h", "⏱️", "First hour", "Spend an hour reading", (s) => s.readSecs / H, 1),
  tier("read-10h", "⌛", "10 hours reading", "Spend 10 hours reading", (s) => s.readSecs / H, 10),
  tier("read-50h", "⏳", "50 hours reading", "Spend 50 hours reading", (s) => s.readSecs / H, 50),
  tier("read-100h", "🕰️", "100 hours reading", "Spend 100 hours reading", (s) => s.readSecs / H, 100),
  tier("listen-1h", "🎧", "First hour listening", "Listen for an hour", (s) => s.listenSecs / H, 1),
  tier("listen-10h", "🎶", "10 hours listening", "Listen for 10 hours", (s) => s.listenSecs / H, 10),
  tier("listen-50h", "📻", "50 hours listening", "Listen for 50 hours", (s) => s.listenSecs / H, 50),
  // Study
  tier("studied-1", "✅", "Studied", "Mark a chapter as studied", (s) => s.studied, 1),
  tier("studied-25", "☑️", "25 studied", "Mark 25 chapters as studied", (s) => s.studied, 25),
  tier("studied-100", "🎓", "100 studied", "Mark 100 chapters as studied", (s) => s.studied, 100),
  tier("book-1", "📕", "First book", "Study every chapter of a book", (s) => s.booksDone, 1),
  tier("book-5", "📙", "5 books", "Study every chapter of 5 books", (s) => s.booksDone, 5),
  tier("book-10", "📗", "10 books", "Study every chapter of 10 books", (s) => s.booksDone, 10),
  tier("book-25", "📒", "25 books", "Study every chapter of 25 books", (s) => s.booksDone, 25),
  tier("collection-1", "🗂️", "A whole collection", "Study every book of a collection (e.g. the Gospels or the Torah)", (s) => s.collectionsDone.length, 1),
  tier("collection-3", "🗃️", "Three collections", "Study every book of 3 collections", (s) => s.collectionsDone.length, 3),
  // Plans and goals
  tier("plan-1", "🗓️", "Plan finished", "Finish a reading plan", (s) => s.plansDone, 1),
  tier("plan-3", "📅", "Three plans", "Finish 3 reading plans", (s) => s.plansDone, 3),
  tier("goal-1", "🎯", "Goal reached", "Reach a goal you set", (s) => s.goalsMet, 1),
  tier("goal-10", "🏹", "10 goals", "Reach your goals 10 times", (s) => s.goalsMet, 10),
  tier("goal-50", "🎖️", "50 goals", "Reach your goals 50 times", (s) => s.goalsMet, 50),
  // Breadth
  tier("traditions-3", "🌍", "Explorer", "Read in 3 traditions", (s) => s.traditions, 3),
  tier("traditions-7", "🌏", "World reader", "Read in 7 traditions", (s) => s.traditions, 7),
  tier("traditions-12", "🌎", "Pilgrim", "Read in 12 traditions", (s) => s.traditions, 12),
  tier("works-10", "🧭", "Wide reader", "Read 10 different works", (s) => s.works, 10),
  tier("works-25", "🗺️", "Library wanderer", "Read 25 different works", (s) => s.works, 25),
  // Notes, highlights, favorites
  tier("note-1", "📝", "First note", "Write a note on a verse", (s) => s.notes, 1),
  tier("notes-25", "🖋️", "Note taker", "Write 25 notes", (s) => s.notes, 25),
  tier("notes-100", "📓", "Commentator", "Write 100 notes", (s) => s.notes, 100),
  tier("highlights-25", "🖍️", "Highlighter", "Highlight 25 verses", (s) => s.highlights, 25),
  tier("highlights-100", "🎨", "Illuminator", "Highlight 100 verses", (s) => s.highlights, 100),
  tier("favorites-10", "⭐", "Treasured", "Save 10 favorite verses", (s) => s.favorites, 10),
  tier("favorites-50", "🌻", "Collector", "Save 50 favorite verses", (s) => s.favorites, 50),
];

export const earned = (b: Badge, s: Stats) => b.value(s) >= b.target;

/* ---------- Levels 1–60 ---------- */

export const MAX_LEVEL = 60;
/** Experience for everything counted: reading, listening, studying, notes, badges, plans and goals. */
export const XP_RULES: { label: string; xp: number; of: (s: Stats) => number }[] = [
  { label: "each verse read", xp: 1, of: (s) => s.verses },
  { label: "each chapter read", xp: 10, of: (s) => s.chaptersRead },
  { label: "each minute reading or listening", xp: 2, of: (s) => Math.floor((s.readSecs + s.listenSecs) / 60) },
  { label: "each chapter marked as studied", xp: 25, of: (s) => s.studied },
  { label: "each book studied from start to end", xp: 250, of: (s) => s.booksDone },
  { label: "each whole collection", xp: 1000, of: (s) => s.collectionsDone.length },
  { label: "each day of your best streak", xp: 20, of: (s) => s.bestStreak },
  { label: "each note, highlight or favorite", xp: 5, of: (s) => s.notes + s.highlights + s.favorites },
  { label: "each goal reached", xp: 50, of: (s) => s.goalsMet },
  { label: "each reading plan finished", xp: 500, of: (s) => s.plansDone },
  { label: "each badge", xp: 100, of: (s) => BADGES.filter((b) => earned(b, s)).length },
];
export const xpOf = (s: Stats) => XP_RULES.reduce((n, r) => n + r.xp * r.of(s), 0);

/** Total experience needed to reach a level (level 1 = 0; level 60 ≈ 231,000). */
export const xpForLevel = (level: number) => (level <= 1 ? 0 : Math.round(100 * Math.pow(level - 1, 1.9)));

const TITLES: [number, string][] = [
  [60, "Master"],
  [50, "Luminary"],
  [40, "Sage"],
  [30, "Scholar"],
  [20, "Student"],
  [10, "Reader"],
  [1, "Seeker"],
];

export type LevelInfo = { level: number; title: string; xp: number; from: number; to: number | null; progress: number };
export function levelOf(xp: number): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const from = xpForLevel(level);
  const to = level < MAX_LEVEL ? xpForLevel(level + 1) : null;
  return { level, title: TITLES.find(([n]) => level >= n)![1], xp, from, to, progress: to ? (xp - from) / (to - from) : 1 };
}

/* Announced level (so a level-up is celebrated once). */
const LEVEL_SEEN = "va-level-seen:v1";
export function seenLevel(): number | null {
  try {
    const n = Number(localStorage.getItem(LEVEL_SEEN));
    return n > 0 ? n : null;
  } catch {
    return MAX_LEVEL; // storage blocked: never announce
  }
}
export function markLevel(n: number) {
  try {
    localStorage.setItem(LEVEL_SEEN, String(n));
  } catch {
    /* private mode */
  }
}

/* Goals reached, counted once each (the watcher in progress-panel adds to it). */
const GOALS_MET = "va-goals-count:v1";
export function goalsMetCount(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(GOALS_MET)) || 0);
  } catch {
    return 0;
  }
}
export function addGoalMet() {
  try {
    localStorage.setItem(GOALS_MET, String(goalsMetCount() + 1));
  } catch {
    /* private mode */
  }
}

/* Announced badges (so a new one is celebrated once). */
const SEEN = "va-badges-seen:v1";
export function seenBadges(): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return new Set();
  }
}
export function markSeen(ids: Iterable<string>) {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...ids]));
  } catch {
    /* private mode */
  }
}
