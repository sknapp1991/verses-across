"use client";
/**
 * Badges and levels (1–60, from experience), worked out from activity (activity.ts) and study items
 * (study.ts). Nothing is stored except which badges and level have already been announced, so they're
 * only celebrated once.
 */
import { dayKey, streaks, totals, type Activity } from "./activity";
import { findBook, scriptureShelves } from "./catalog";
import type { StudyItem } from "./storage";

export type Stats = {
  readSecs: number;
  listenSecs: number;
  verses: number;
  chaptersRead: number;
  /** verses the read-aloud player reached (once per day) */
  versesHeard: number;
  /** chapters whose every verse has played (once per day) */
  chaptersHeard: number;
  /** books whose every chapter has been heard */
  booksHeard: number;
  studied: number;
  /** chapters studied again (each extra time counts) */
  rereads: number;
  /** books studied a second time from start to end */
  booksReread: number;
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
  /** Articles: each depth marked "I read the … version" (Short, Medium, Extensive count separately). */
  articlesRead: number;
  /** Articles read in all three depths. */
  articlesDeep: number;
  /** Reflection questions answered (answer boxes with something written). */
  reflections: number;
  /** Study groups this device is in. */
  groups: number;
  /** Books a study group of mine finished together while I was in it (hub a92da77c). */
  groupBooks: number;
};

export type DeviceCounts = { articlesRead: number; articlesDeep: number; reflections: number; groups: number; groupBooks: number };
const NO_COUNTS: DeviceCounts = { articlesRead: 0, articlesDeep: 0, reflections: 0, groups: 0, groupBooks: 0 };
/** Sent when an article is ticked, a reflection saved, or a study group joined or left (badges update at once). */
export const PROGRESS_EVENT = "va-progress";
export const progressChanged = () => typeof window !== "undefined" && window.dispatchEvent(new Event(PROGRESS_EVENT));
/** For useSyncExternalStore: the counts as a string (a stable snapshot), "" on the server. */
export const deviceCountsKey = () => JSON.stringify(deviceCounts());
export function subscribeDeviceCounts(f: () => void) {
  window.addEventListener(PROGRESS_EVENT, f);
  window.addEventListener("storage", f);
  return () => {
    window.removeEventListener(PROGRESS_EVENT, f);
    window.removeEventListener("storage", f);
  };
}
export const parseCounts = (key: string): DeviceCounts => (key ? { ...NO_COUNTS, ...(JSON.parse(key) as DeviceCounts) } : NO_COUNTS);

/** What the article and study-group features keep on this device (badges, hub 76210685); zero where unreadable. */
export function deviceCounts(): DeviceCounts {
  const read = (k: string) => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? "null");
    } catch {
      return null;
    }
  };
  if (typeof window === "undefined") return NO_COUNTS;
  const r = (read("va-article-read:v1") ?? {}) as Record<string, Record<string, string>>;
  const depths = Object.values(r).map((x) => Object.keys(x ?? {}).length);
  const answers = (read("va-article-answers:v1") ?? {}) as Record<string, string>;
  const groups = read("va-groups:v1");
  const finished = read("va-group-finished:v1"); // (groups.ts records them as it loads each group)
  return {
    groupBooks: Array.isArray(finished) ? finished.length : 0,
    articlesRead: depths.reduce((a, b) => a + b, 0),
    articlesDeep: depths.filter((n) => n >= 3).length,
    reflections: Object.values(answers).filter((v) => typeof v === "string" && v.trim()).length,
    groups: Array.isArray(groups) ? groups.length : 0,
  };
}

/** Counts kept elsewhere (plans.ts, the goal watcher) that feed badges and levels. */
/** `counts`: articles, reflections and groups on this device (passed in, so the hydration render can use zeros). */
export type Extras = { plansDone: number; goalsMet: number; counts?: DeviceCounts };

export function computeStats(a: Activity, items: Map<string, StudyItem>, extras: Extras = { plansDone: 0, goalsMet: 0 }): Stats {
  const t = totals(a);
  const perBook = new Map<string, number>();
  const studyDays: string[] = [];
  let notes = 0;
  let highlights = 0;
  let favorites = 0;
  let studied = 0;
  let rereads = 0;
  const perBookAgain = new Map<string, number>(); // chapters of a book studied twice or more
  for (const it of items.values()) {
    if (it.kind === "studied") {
      studied++;
      perBook.set(`${it.work}/${it.book}`, (perBook.get(`${it.work}/${it.book}`) ?? 0) + 1);
      studyDays.push(dayKey(it.createdAt));
      const again = Array.isArray(it.again) ? it.again : [];
      rereads += again.length;
      for (const t of again) studyDays.push(dayKey(t));
      if (again.length) perBookAgain.set(`${it.work}/${it.book}`, (perBookAgain.get(`${it.work}/${it.book}`) ?? 0) + 1);
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
  let booksReread = 0;
  for (const [k, n] of perBookAgain) {
    const [w, b] = k.split("/");
    const total = findBook(w, b)?.chapters ?? 0;
    if (total > 0 && n >= total) booksReread++;
  }
  const collectionsDone: string[] = [];
  for (const rel of scriptureShelves)
    for (const col of rel.collections) {
      const books = col.items.filter((i) => i.work && i.chapters && i.status !== "coming-soon");
      if (books.length > 1 && books.every((i) => finished.has(`${i.work}/${i.id}`))) collectionsDone.push(col.name);
    }
  // traditions = religions with any reading, listening or study
  const worksTouched = new Set([...t.works, ...[...perBook.keys()].map((k) => k.split("/")[0])]);
  const religions = new Set<string>();
  for (const rel of scriptureShelves)
    for (const col of rel.collections) for (const i of col.items) if (i.work && worksTouched.has(i.work)) religions.add(rel.id);
  const s = streaks(a, studyDays);
  // Books heard: every chapter of the book listened to (at any time)
  const heardPerBook = new Map<string, number>();
  for (const k of t.heard.keys()) {
    const b = k.split("/").slice(0, 2).join("/");
    heardPerBook.set(b, (heardPerBook.get(b) ?? 0) + 1);
  }
  let booksHeard = 0;
  for (const [k, cnt] of heardPerBook) {
    const [w, b] = k.split("/");
    const total = findBook(w, b)?.chapters ?? 0;
    if (total > 0 && cnt >= total) booksHeard++;
  }
  return {
    readSecs: t.read,
    listenSecs: t.listen,
    verses: t.verses,
    chaptersRead: t.chapters,
    versesHeard: t.versesHeard,
    chaptersHeard: t.heard.size,
    booksHeard,
    studied,
    rereads,
    booksReread,
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
    ...(extras.counts ?? NO_COUNTS),
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
  // Re-reading (a studied chapter marked "Studied again")
  tier("reread-1", "🔁", "Back again", "Study a chapter a second time (“Studied again” at the end of a chapter you’ve studied)", (s) => s.rereads, 1),
  tier("reread-25", "🔄", "Re-reader", "Study chapters again 25 times", (s) => s.rereads, 25),
  tier("reread-100", "♾️", "Well worn", "Study chapters again 100 times", (s) => s.rereads, 100),
  tier("book-reread-1", "📖", "Second time through", "Study every chapter of a book a second time", (s) => s.booksReread, 1),
  // Verses
  tier("verses-100", "✨", "100 verses", "Read 100 verses", (s) => s.verses, 100),
  tier("verses-1000", "🌟", "1,000 verses", "Read 1,000 verses", (s) => s.verses, 1000),
  tier("verses-2500", "🌟", "2,500 verses", "Read 2,500 verses", (s) => s.verses, 2500),
  tier("verses-6236", "🌙", "6,236 verses", "Read 6,236 verses (as many as the Quran has)", (s) => s.verses, 6236),
  tier("verses-10000", "💫", "10,000 verses", "Read 10,000 verses", (s) => s.verses, 10000),
  tier("verses-31102", "☀️", "31,102 verses", "Read 31,102 verses (as many as the whole Bible has)", (s) => s.verses, 31102),
  tier("verses-100000", "🌠", "100,000 verses", "Read 100,000 verses", (s) => s.verses, 100000),
  // Streaks: every day from 1 to 15 (the early days count most), then 30, 45, 60, 75, 90, 100, 200, 300, a year, two
  // (hub 76210685; 3, 7, 14, 30, 60, 100 and 365 keep their old ids, so nothing earned is lost)
  tier("streak-1", "🌅", "Day one", "Read or listen today: a streak begins", (s) => s.bestStreak, 1),
  tier("streak-2", "✌️", "2-day streak", "Read or listen 2 days in a row", (s) => s.bestStreak, 2),
  tier("streak-3", "🔥", "3-day streak", "Read or listen 3 days in a row", (s) => s.bestStreak, 3),
  ...[4, 5, 6].map((n) => tier(`streak-${n}`, "🔥", `${n}-day streak`, `Read or listen ${n} days in a row`, (s) => s.bestStreak, n)),
  tier("streak-7", "🔥", "7-day streak", "Read or listen 7 days in a row", (s) => s.bestStreak, 7),
  ...[8, 9, 10, 11, 12, 13].map((n) => tier(`streak-${n}`, n === 10 ? "🔟" : "🕯️", `${n}-day streak`, `Read or listen ${n} days in a row`, (s) => s.bestStreak, n)),
  tier("streak-14", "🕯️", "14-day streak", "Read or listen 14 days in a row", (s) => s.bestStreak, 14),
  tier("streak-15", "🌠", "15-day streak", "Read or listen 15 days in a row", (s) => s.bestStreak, 15),
  tier("streak-30", "🏆", "30-day streak", "Read or listen 30 days in a row", (s) => s.bestStreak, 30),
  tier("streak-45", "🌙", "45-day streak", "Read or listen 45 days in a row", (s) => s.bestStreak, 45),
  tier("streak-60", "🥇", "60-day streak", "Read or listen 60 days in a row", (s) => s.bestStreak, 60),
  tier("streak-75", "🌞", "75-day streak", "Read or listen 75 days in a row", (s) => s.bestStreak, 75),
  tier("streak-90", "🏵️", "90-day streak", "Read or listen 90 days in a row", (s) => s.bestStreak, 90),
  tier("streak-100", "👑", "100-day streak", "Read or listen 100 days in a row", (s) => s.bestStreak, 100),
  tier("streak-200", "🗻", "200-day streak", "Read or listen 200 days in a row", (s) => s.bestStreak, 200),
  tier("streak-300", "🌋", "300-day streak", "Read or listen 300 days in a row", (s) => s.bestStreak, 300),
  tier("streak-365", "💎", "A whole year", "Read or listen 365 days in a row", (s) => s.bestStreak, 365),
  tier("streak-730", "💠", "Two whole years", "Read or listen 730 days in a row", (s) => s.bestStreak, 730),
  // Time
  tier("read-1h", "⏱️", "First hour", "Spend an hour reading", (s) => s.readSecs / H, 1),
  tier("read-5h", "⏱️", "5 hours reading", "Spend 5 hours reading", (s) => s.readSecs / H, 5),
  tier("read-10h", "⌛", "10 hours reading", "Spend 10 hours reading", (s) => s.readSecs / H, 10),
  tier("read-25h", "⌛", "25 hours reading", "Spend 25 hours reading", (s) => s.readSecs / H, 25),
  tier("read-50h", "⏳", "50 hours reading", "Spend 50 hours reading", (s) => s.readSecs / H, 50),
  tier("read-100h", "🕰️", "100 hours reading", "Spend 100 hours reading", (s) => s.readSecs / H, 100),
  tier("listen-1h", "🎧", "First hour listening", "Listen for an hour", (s) => s.listenSecs / H, 1),
  tier("listen-10h", "🎶", "10 hours listening", "Listen for 10 hours", (s) => s.listenSecs / H, 10),
  tier("listen-5h", "🎧", "5 hours listening", "Listen for 5 hours", (s) => s.listenSecs / H, 5),
  tier("listen-25h", "🎶", "25 hours listening", "Listen for 25 hours", (s) => s.listenSecs / H, 25),
  tier("listen-50h", "📻", "50 hours listening", "Listen for 50 hours", (s) => s.listenSecs / H, 50),
  tier("listen-100h", "🎙️", "100 hours listening", "Listen for 100 hours", (s) => s.listenSecs / H, 100),
  // Heard (read aloud)
  tier("heard-verses-100", "👂", "100 verses heard", "Listen to 100 verses", (s) => s.versesHeard, 100),
  tier("heard-verses-2500", "👂", "2,500 verses heard", "Listen to 2,500 verses", (s) => s.versesHeard, 2500),
  tier("heard-verses-31102", "🔊", "31,102 verses heard", "Listen to 31,102 verses (as many as the whole Bible has)", (s) => s.versesHeard, 31102),
  tier("heard-chapters-10", "🎧", "10 chapters heard", "Listen to 10 chapters", (s) => s.chaptersHeard, 10),
  tier("heard-chapters-100", "🎧", "100 chapters heard", "Listen to 100 chapters", (s) => s.chaptersHeard, 100),
  tier("heard-chapters-1189", "🗣️", "1,189 chapters heard", "Listen to 1,189 chapters (as many as the whole Bible has)", (s) => s.chaptersHeard, 1189),
  tier("heard-book-1", "📀", "First book heard", "Listen to every chapter of a book", (s) => s.booksHeard, 1),
  tier("heard-book-10", "💿", "10 books heard", "Listen to every chapter of 10 books", (s) => s.booksHeard, 10),
  tier("heard-book-66", "🎼", "66 books heard", "Listen to every chapter of 66 books (as many as a Protestant Bible has)", (s) => s.booksHeard, 66),
  // Study
  tier("studied-1", "✅", "Studied", "Mark a chapter as studied", (s) => s.studied, 1),
  tier("studied-25", "☑️", "25 studied", "Mark 25 chapters as studied", (s) => s.studied, 25),
  tier("studied-100", "🎓", "100 studied", "Mark 100 chapters as studied", (s) => s.studied, 100),
  tier("book-1", "📕", "First book", "Study every chapter of a book", (s) => s.booksDone, 1),
  tier("book-5", "📙", "5 books", "Study every chapter of 5 books", (s) => s.booksDone, 5),
  tier("book-10", "📗", "10 books", "Study every chapter of 10 books", (s) => s.booksDone, 10),
  tier("book-25", "📒", "25 books", "Study every chapter of 25 books", (s) => s.booksDone, 25),
  tier("book-50", "📔", "50 books", "Study every chapter of 50 books", (s) => s.booksDone, 50),
  tier("book-100", "🏅", "100 books", "Study every chapter of 100 books", (s) => s.booksDone, 100),
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
  // Articles and reflections (hub 76210685)
  tier("article-1", "📰", "First article", "Read an article (tick “I read the … version” at the end)", (s) => s.articlesRead, 1),
  tier("article-5", "🗞️", "5 article reads", "Read articles 5 times (Short, Medium and Extensive each count)", (s) => s.articlesRead, 5),
  tier("article-15", "📰", "15 article reads", "Read articles 15 times (Short, Medium and Extensive each count)", (s) => s.articlesRead, 15),
  tier("article-deep-1", "🔎", "Deep dive", "Read one article in all three depths: Short, Medium and Extensive", (s) => s.articlesDeep, 1),
  tier("reflection-1", "💭", "First reflection", "Answer a reflection question at the end of an article", (s) => s.reflections, 1),
  tier("reflection-10", "🕊️", "Reflective", "Answer 10 reflection questions", (s) => s.reflections, 10),
  tier("reflection-25", "🧘", "Deep thinker", "Answer 25 reflection questions", (s) => s.reflections, 25),
  // Study groups (hub 76210685): joining, and keeping a streak going while in one
  tier("group-1", "🤝", "Better together", "Join or start a study group", (s) => s.groups, 1),
  // a group's reading list (hub a92da77c): a book marked finished together while you were in the group
  tier("group-book-1", "🎉", "Finished together", "Finish a book together with your study group", (s) => s.groupBooks, 1),
  tier("group-book-3", "📚", "Book club", "Finish 3 books together with your study groups", (s) => s.groupBooks, 3),
  tier("group-book-10", "🏆", "Fellowship of readers", "Finish 10 books together with your study groups", (s) => s.groupBooks, 10),
  tier("group-streak-7", "👥", "Group week", "Be in a study group with a 7-day streak", (s) => (s.groups ? s.bestStreak : 0), 7),
  tier("group-streak-30", "🏕️", "Group month", "Be in a study group with a 30-day streak", (s) => (s.groups ? s.bestStreak : 0), 30),
];

export const earned = (b: Badge, s: Stats) => b.value(s) >= b.target;

/* ---------- Levels 1–60 ---------- */

export const MAX_LEVEL = 60;
/** Experience for everything counted: reading, listening, studying, notes, badges, plans and goals. */
export const XP_RULES: { label: string; xp: number; of: (s: Stats) => number }[] = [
  { label: "each verse read", xp: 1, of: (s) => s.verses },
  { label: "each chapter read", xp: 10, of: (s) => s.chaptersRead },
  { label: "each chapter heard", xp: 10, of: (s) => s.chaptersHeard },
  { label: "each book heard from start to end", xp: 150, of: (s) => s.booksHeard },
  { label: "each minute reading or listening", xp: 2, of: (s) => Math.floor((s.readSecs + s.listenSecs) / 60) },
  { label: "each chapter marked as studied", xp: 25, of: (s) => s.studied },
  { label: "each book studied from start to end", xp: 250, of: (s) => s.booksDone },
  { label: "each chapter studied again", xp: 15, of: (s) => s.rereads },
  { label: "each book studied again from start to end", xp: 150, of: (s) => s.booksReread },
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

/** `rank`: the level within its title ("Reader, rank 5 of 10"); `next`: the next title and the level it starts at. */
export type LevelInfo = { level: number; title: string; rank: number; ranks: number; next: { title: string; at: number } | null; xp: number; from: number; to: number | null; progress: number };
export function levelOf(xp: number): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const from = xpForLevel(level);
  const to = level < MAX_LEVEL ? xpForLevel(level + 1) : null;
  const i = TITLES.findIndex(([n]) => level >= n);
  const [start, title] = TITLES[i];
  const next = i > 0 ? { title: TITLES[i - 1][1], at: TITLES[i - 1][0] } : null;
  // the level within the title (my brother's ticket cd8f20f6): Reader is levels 10–19, so level 14 is its rank 5 of 10
  const rank = level - start + 1;
  const ranks = next ? next.at - start : MAX_LEVEL - start + 1;
  return { level, title, rank, ranks, next, xp, from, to, progress: to ? (xp - from) / (to - from) : 1 };
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
