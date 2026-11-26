/**
 * Memorize (study lab, hub 7a62bb28): the pure parts of the memory deck. A card only points at its verses (work,
 * version, book, chapter, first and last verse); the words themselves are always read from the site's text files, so
 * they stay exactly as written and an exported deck stays small. Reviews follow a simple SM-2-style schedule.
 * Everything here is plain data, safe on the server and in old Safari (no .at, no structuredClone, no groupBy).
 */
import { booksOfWork, chapterTitle, findBook, getVersion, versionsForWork } from "./catalog";

export const STORE = "va-memorize:v1";
/** The longest range a person can add (starters may be a little longer, e.g. the Fatiha's seven verses). */
export const MAX_RANGE = 5;

export type Sched = {
  /** Local date (YYYY-MM-DD) the card is next due. */
  due: string;
  /** Days until the next review after the last one (0 = new, or to see again today). */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  last?: string;
};

export type Card = {
  id: string;
  work: string;
  version: string;
  book: string;
  chapter: number;
  /** First and last verse id (as in the text files: "1", "16"). */
  from: string;
  to: string;
  added: string;
  sched: Sched;
  /** The site can't serve these verses right now (kept, not practised, until it can or the person removes it). */
  missing?: boolean;
};

export type Deck = { cards: Card[]; days: string[] };
export const EMPTY_DECK: Deck = { cards: [], days: [] };

export type Grade = "again" | "hard" | "good" | "easy";
export const GRADES: Grade[] = ["again", "hard", "good", "easy"];

export type Starter = { label: string; work: string; version: string; book: string; chapter: number; from: string; to: string };
export const STARTERS: Starter[] = [
  { label: "Psalm 23:1", work: "bible", version: "kjv", book: "psa", chapter: 23, from: "1", to: "1" },
  { label: "John 3:16", work: "bible", version: "kjv", book: "jhn", chapter: 3, from: "16", to: "16" },
  { label: "Micah 6:8", work: "bible", version: "kjv", book: "mic", chapter: 6, from: "8", to: "8" },
  { label: "Dhammapada 1:1-2", work: "dhammapada", version: "sujato", book: "dhp", chapter: 1, from: "1", to: "2" },
  { label: "Tao Te Ching 1", work: "tao-te-ching", version: "legge-ttc", book: "ttc", chapter: 1, from: "1", to: "4" },
  { label: "Quran 1:1-7 (Pickthall)", work: "quran", version: "pickthall", book: "quran", chapter: 1, from: "1", to: "7" },
];

/* ---------------- dates ---------------- */

const pad = (n: number) => String(n).padStart(2, "0");
export function dayOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const today = () => dayOf(new Date());
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayOf(new Date(y, m - 1, d + n)); // (local noon-free arithmetic: Date rolls months and years over)
}
/** Whole days from a to b (b later = positive). */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
export function whenLabel(due: string, now: string): string {
  const n = daysBetween(now, due);
  if (n <= 0) return "today";
  if (n === 1) return "tomorrow";
  if (n < 30) return `in ${n} days`;
  if (n < 365) return `in ${Math.round(n / 30)} month${Math.round(n / 30) === 1 ? "" : "s"}`;
  return "in a year or more";
}

/* ---------------- schedule (SM-2 style) ---------------- */

export const newSched = (day: string): Sched => ({ due: day, interval: 0, ease: 2.5, reps: 0, lapses: 0 });

/** The schedule after a review. "Again" keeps the card for later today; the others push it out. */
export function review(s: Sched, grade: Grade, day: string): Sched {
  const { reps, lapses } = s;
  let { interval, ease } = s;
  if (grade === "again") {
    ease = Math.max(1.3, ease - 0.2);
    return { due: day, interval: 0, ease, reps: 0, lapses: lapses + 1, last: day };
  }
  if (grade === "hard") {
    interval = reps === 0 ? 1 : Math.max(interval + 1, Math.round(interval * 1.2));
    ease = Math.max(1.3, ease - 0.15);
  } else if (grade === "good") {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease));
  } else {
    interval = reps === 0 ? 4 : Math.max(interval + 2, Math.round(interval * ease * 1.3));
    ease = ease + 0.15;
  }
  interval = Math.min(interval, 3650);
  return { due: addDays(day, interval), interval, ease: Math.round(ease * 100) / 100, reps: reps + 1, lapses, last: day };
}

export const isDue = (c: Card, day: string) => !c.missing && c.sched.due <= day;

/** Due cards, the longest-waiting first; a card already seen today (marked "again") waits at the back. */
export function dueCards(cards: Card[], day: string): Card[] {
  const seen = (c: Card) => (c.sched.last === day ? 1 : 0);
  return cards
    .filter((c) => isDue(c, day))
    .sort((a, b) => seen(a) - seen(b) || (a.sched.due < b.sched.due ? -1 : a.sched.due > b.sched.due ? 1 : 0));
}

/** Practice days in a row, ending today (or yesterday, while today is still to come). */
export function streakOf(days: string[], day: string): number {
  const set = new Set(days);
  let d = set.has(day) ? day : addDays(day, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function markDay(days: string[], day: string): string[] {
  if (days.indexOf(day) >= 0) return days;
  return [...days, day].sort().slice(-800);
}

/* ---------------- cards ---------------- */

export const sameVerses = (a: Pick<Card, "work" | "version" | "book" | "chapter" | "from" | "to">, b: typeof a) =>
  a.work === b.work && a.version === b.version && a.book === b.book && a.chapter === b.chapter && a.from === b.from && a.to === b.to;

export function makeCard(p: Omit<Card, "id" | "added" | "sched">, day: string): Card {
  const id = `${p.work}/${p.version}/${p.book}/${p.chapter}/${p.from}-${p.to}`;
  return { ...p, id, added: day, sched: newSched(day) };
}

/** "Psalm 23:1", "Dhammapada 1:1-2", "Surah 1:1-7". */
export function referenceOf(c: Pick<Card, "work" | "book" | "chapter" | "from" | "to">): string {
  const title = chapterTitle(findBook(c.work, c.book), c.chapter, c.book);
  return c.from === c.to ? `${title}:${c.from}` : `${title}:${c.from}-${c.to}`;
}

export type V = { v: string; t: string; n?: string };

/** The card's verses from a chapter, in order, skipping empty continuation slots. */
export function versesIn(chapter: V[], from: string, to: string): V[] {
  const list = chapter.filter((x) => x.t);
  const i = list.findIndex((x) => x.v === from);
  const j = list.findIndex((x) => x.v === to);
  if (i < 0) return [];
  return list.slice(i, (j < i ? i : j) + 1);
}

/** The Hebrew (Old Testament) or Greek (New Testament and Apocrypha) version for a Bible card, if it isn't already one. */
export function originalFor(c: Pick<Card, "work" | "version" | "book">): string | null {
  if (c.work !== "bible" || c.version === "hebrew" || c.version === "greek") return null;
  const b = findBook("bible", c.book);
  if (!b) return null;
  return b.collection.id === "ot" ? "hebrew" : "greek";
}

/* ---------------- words ---------------- */

const LETTER = /[\p{L}\p{N}]/u;

/** A text cut into words and the spaces between them (so it can be put back exactly). */
export function splitWords(text: string): { w: string; space: boolean }[] {
  return (text.match(/\s+|\S+/g) ?? []).map((w) => ({ w, space: /^\s+$/.test(w) }));
}

/**
 * A word in four parts for the first-letter hint: what comes before the first letter (quotes, brackets), the first
 * letter with its marks, the rest of the letters, and what comes after (punctuation).
 */
export function hintParts(word: string): { lead: string; first: string; rest: string; trail: string } {
  const chars = word.match(/\P{M}\p{M}*/gu) ?? [word];
  let a = 0;
  while (a < chars.length && !LETTER.test(chars[a])) a++;
  if (a >= chars.length) return { lead: word, first: "", rest: "", trail: "" };
  let b = chars.length;
  while (b > a + 1 && !LETTER.test(chars[b - 1])) b--;
  return { lead: chars.slice(0, a).join(""), first: chars[a], rest: chars.slice(a + 1, b).join(""), trail: chars.slice(b).join("") };
}

/** A word for comparing: lower case, no marks (accents, vowel points) and no punctuation. */
export function normWord(w: string): string {
  return w
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export const wordsForScore = (text: string) => text.split(/\s+/).map(normWord).filter(Boolean);

export type Scored = { words: { w: string; ok: boolean }[]; right: number; total: number; extra: string[] };

/**
 * Typed words against the real ones, matched in order (longest common sequence), so one missed word doesn't count
 * every word after it as wrong. `words` are the verse's own words as written.
 */
export function scoreTyping(text: string, typed: string): Scored {
  const shown = text.split(/\s+/).filter((w) => normWord(w));
  const a = shown.map(normWord);
  const tw = typed.split(/\s+/).filter((w) => normWord(w));
  const b = tw.map(normWord);
  const n = a.length;
  const m = b.length;
  const L: number[][] = [];
  for (let i = 0; i <= n; i++) L.push(new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ok = new Array<boolean>(n).fill(false);
  const used = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ok[i] = true;
      used[j] = true;
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  const right = ok.filter(Boolean).length;
  return { words: shown.map((w, k) => ({ w, ok: ok[k] })), right, total: n, extra: tw.filter((_, k) => !used[k]) };
}

/** Which words are hidden at a fade step (0 = none … steps = all), in a fixed order that looks random. */
export function fadeOrder(count: number, seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const k = h % (i + 1);
    const t = order[i];
    order[i] = order[k];
    order[k] = t;
  }
  return order;
}

/* ---------------- saving and loading ---------------- */

const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length < 200;
const isDay = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);

/** The most cards a deck keeps (an imported file can't grow it past this). */
export const MAX_CARDS = 500;

/** Verses from first to last, when both are plain numbers (otherwise unknown). */
function rangeLength(from: string, to: string): number | null {
  const a = parseInt(from, 10);
  const b = parseInt(to, 10);
  return isFinite(a) && isFinite(b) ? b - a + 1 : null;
}

/** A card read from storage or a file. Its shape must be right; if the site can't serve it (yet), it is kept, marked missing. */
export function cleanCard(x: unknown, day: string): Card | null {
  if (!x || typeof x !== "object") return null;
  const c = x as Record<string, unknown>;
  if (!isStr(c.work) || !isStr(c.version) || !isStr(c.book) || !isStr(c.from) || !isStr(c.to)) return null;
  const chapter = Number(c.chapter);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  const p = { work: c.work, version: c.version, book: c.book, chapter, from: c.from, to: c.to };
  const len = rangeLength(p.from, p.to);
  if (len !== null && (len < 1 || (len > MAX_RANGE && !STARTERS.some((st) => sameVerses(st, p))))) return null;
  const book = booksOfWork(c.work).find((b) => b.id === c.book);
  const served = !!book && chapter <= (book.chapters ?? 1) && versionsForWork(c.work).some((v) => v.id === c.version) && !!getVersion(c.version);
  const base = makeCard(p, isDay(c.added) ? c.added : day);
  if (!served) base.missing = true;
  const s = (c.sched ?? {}) as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  base.sched = {
    due: isDay(s.due) ? s.due : day,
    interval: Math.round(num(s.interval, 0, 3650, 0)),
    ease: num(s.ease, 1.3, 5, 2.5),
    reps: Math.round(num(s.reps, 0, 10000, 0)),
    lapses: Math.round(num(s.lapses, 0, 10000, 0)),
    ...(isDay(s.last) ? { last: s.last } : {}),
  };
  return base;
}

export function cleanDeck(x: unknown, day: string): Deck {
  if (!x || typeof x !== "object") return EMPTY_DECK;
  const d = x as Record<string, unknown>;
  const cards: Card[] = [];
  const ids = new Set<string>();
  if (Array.isArray(d.cards))
    for (const raw of d.cards) {
      if (cards.length >= MAX_CARDS) break;
      const c = cleanCard(raw, day);
      if (c && !ids.has(c.id)) {
        ids.add(c.id);
        cards.push(c);
      }
    }
  const days = Array.isArray(d.days) ? d.days.filter(isDay).sort().slice(-800) : [];
  return { cards, days };
}

/** An imported deck added to this one: cards already here keep their own schedule; the deck stops at MAX_CARDS. */
export function mergeDecks(mine: Deck, theirs: Deck): { deck: Deck; added: number; skipped: number } {
  const cards = [...mine.cards];
  const ids = new Set(cards.map((c) => c.id));
  let added = 0;
  for (const c of theirs.cards)
    if (!ids.has(c.id) && cards.length < MAX_CARDS) {
      ids.add(c.id);
      cards.push(c);
      added++;
    }
  const days = Array.from(new Set([...mine.days, ...theirs.days])).sort().slice(-800);
  return { deck: { cards, days }, added, skipped: theirs.cards.length - added };
}

export const exportJson = (deck: Deck) =>
  JSON.stringify({ kind: "verses-across-memory-deck", format: 1, exported: today(), cards: deck.cards, days: deck.days }, null, 1);
