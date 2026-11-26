/**
 * Speed reader helpers (study lab): split a chapter into the words flashed one at a time, where each word's focus
 * letter is, and how long each word stays on screen. Every word is a slice of the verse exactly as written (offsets
 * into the verse text), so the context view can show the verse untouched with the current word marked.
 */
import { booksOfWork, catalog, DEFAULT_VERSIONS, scriptureShelves, sideOfWork, versionsForWork } from "./catalog";
import type { Version } from "./schema";

export type Verse = { v: string; t: string; n?: string };

export type Token = {
  /** Index of the verse in the chapter's verse list. */
  verse: number;
  /** Start and end of this word inside the verse text. */
  s: number;
  e: number;
  /** How long it stays, as a multiple of one word's time at the chosen speed. */
  weight: number;
  /** A sentence (or a verse) starts here: where "back / forward a sentence" stop. */
  start: boolean;
};

const SENTENCE_END = new Set([".", "!", "?", "׃", "।", "॥", "。", "！", "？", "؟", "۔", "…"]);
const CLAUSE_END = new Set([",", ";", ":", "،", "؛", "，", "、", "；", "：", "·", "—", "–", "·", ";"]);
/** Closing quotes and brackets after the punctuation that ends a word ("light." ’ or "said,)"). */
const CLOSERS = new Set(['"', "'", "’", "”", "»", "›", ")", "]", "}", "»", "」", "』", "）", "〕", "》", "〉"]);

/** Scripts whose letters join or combine into shapes (Arabic, Indic, Thai…): a word there is never cut into pieces. */
const JOINED = /[؀-ࣿऀ-෿฀-࿿က-႟᠀-᢯ﭐ-﷿ﹰ-﻿]/;
/** Han, kana and similar: written without spaces between words. */
const UNSPACED = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;
const HAS_LETTER = /[\p{L}\p{N}]/u;

/** User-perceived letters: a base letter with its vowel points, accents and cantillation marks. */
export function graphemes(word: string): string[] {
  return word.match(/\P{M}\p{M}*/gu) ?? [word];
}

/** The focus letter: about a third of the way in (1 letter → 1st, 2–5 → 2nd, 6–9 → 3rd, 10–13 → 4th, longer → 5th). */
export function focusIndex(len: number): number {
  return len <= 1 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : len <= 13 ? 3 : 4;
}

/** The word cut around its focus letter, or null for a joined script, which is always shown whole. */
export function splitWord(word: string): { before: string; focus: string; after: string } | null {
  if (JOINED.test(word)) return null;
  const g = graphemes(word);
  // The focus counts letters only: a leading quote or bracket doesn't push it along.
  let lead = 0;
  while (lead < g.length - 1 && !HAS_LETTER.test(g[lead])) lead++;
  let tail = g.length;
  while (tail > lead + 1 && !HAS_LETTER.test(g[tail - 1])) tail--;
  const i = lead + focusIndex(tail - lead);
  return { before: g.slice(0, i).join(""), focus: g[i] ?? "", after: g.slice(i + 1).join("") };
}

function lastMark(word: string): string {
  const g = graphemes(word);
  let i = g.length - 1;
  while (i > 0 && CLOSERS.has(g[i])) i--;
  return g[i] ?? "";
}

function weightOf(word: string, verseEnd: boolean): { weight: number; ends: boolean } {
  const mark = lastMark(word);
  const ends = SENTENCE_END.has(mark) || (mark.length > 1 && SENTENCE_END.has(mark[0]));
  let w = ends ? 2.5 : CLAUSE_END.has(mark) ? 1.6 : verseEnd ? 2 : 1;
  const len = graphemes(word).filter((c) => HAS_LETTER.test(c)).length;
  if (len > 8) w *= Math.min(1.5, 1 + (len - 8) * 0.06); // a little longer for long words
  return { weight: w, ends };
}

/** Cut a run of unspaced text (Chinese) into short pieces: clauses at punctuation, then two or three characters each. */
function unspacedPieces(run: string, base: number): [number, number][] {
  const out: [number, number][] = [];
  const chars = graphemes(run);
  let pos = 0;
  let clause: { s: number; e: number }[] = [];
  const flush = () => {
    let i = 0;
    while (i < clause.length) {
      const left = clause.length - i;
      const take = left === 3 ? 3 : Math.min(2, left);
      out.push([clause[i].s, clause[i + take - 1].e]);
      i += take;
    }
    clause = [];
  };
  for (const c of chars) {
    const span = { s: base + pos, e: base + pos + c.length };
    pos += c.length;
    if (!HAS_LETTER.test(c)) {
      // Punctuation stays with the piece before it.
      if (clause.length) {
        clause[clause.length - 1].e = span.e;
        flush();
      } else if (out.length) out[out.length - 1][1] = span.e;
      else clause.push(span);
      continue;
    }
    clause.push(span);
  }
  flush();
  return out;
}

/** All the words of a chapter, in reading order. Empty verse slots (text kept in a neighbouring verse) are skipped. */
export function tokenize(verses: Verse[]): Token[] {
  const tokens: Token[] = [];
  let sentenceNext = true;
  verses.forEach((verse, vi) => {
    const text = verse.t ?? "";
    const spans: [number, number][] = [];
    for (const m of text.matchAll(/\S+/g)) {
      const s = m.index ?? 0;
      const e = s + m[0].length;
      if (UNSPACED.test(m[0]) && graphemes(m[0]).length > 3) {
        spans.push(...unspacedPieces(m[0], s));
        continue;
      }
      // A mark on its own ("॥", "—", "¶") joins the word before it, so it is never flashed alone.
      if (!HAS_LETTER.test(m[0]) && spans.length) spans[spans.length - 1][1] = e;
      else spans.push([s, e]);
    }
    // A verse that starts with a lone mark keeps it with its first word.
    if (spans.length > 1 && !HAS_LETTER.test(text.slice(spans[0][0], spans[0][1]))) {
      spans[1][0] = spans[0][0];
      spans.shift();
    }
    spans.forEach(([s, e], i) => {
      const last = i === spans.length - 1;
      const { weight, ends } = weightOf(text.slice(s, e), last);
      tokens.push({ verse: vi, s, e, weight, start: sentenceNext });
      sentenceNext = ends || last;
    });
  });
  return tokens;
}

/** Milliseconds a word stays at this speed. */
export const delayOf = (t: Token, wpm: number) => Math.round((60000 / wpm) * t.weight);

/** Start of the sentence holding word i (or of the one before, when already at its first words). */
export function sentenceBack(tokens: Token[], i: number): number {
  let j = i;
  while (j > 0 && !tokens[j].start) j--;
  if (i - j <= 1 && j > 0) {
    j--;
    while (j > 0 && !tokens[j].start) j--;
  }
  return j;
}

export function sentenceForward(tokens: Token[], i: number): number {
  let j = i + 1;
  while (j < tokens.length && !tokens[j].start) j++;
  return Math.min(j, tokens.length - 1);
}

export type WorkGroup = { shelf: string; works: { id: string; name: string; collection: string }[] };

/** The works on this site that have chapters to read, grouped by tradition like the library shelves. */
export function workGroups(): WorkGroup[] {
  const names = new Map(catalog.works.map((w) => [w.id, w.name]));
  const seen = new Set<string>();
  const groups: WorkGroup[] = [];
  for (const r of scriptureShelves) {
    const g: WorkGroup = { shelf: r.name, works: [] };
    for (const c of r.collections)
      for (const it of c.items) {
        const w = it.work;
        if (!w || seen.has(w) || !it.chapters || it.status === "coming-soon" || sideOfWork(w) !== "scriptures") continue;
        if (!booksOfWork(w).length || !versionsForWork(w).length) continue;
        seen.add(w);
        g.works.push({ id: w, name: names.get(w) ?? it.name, collection: c.name });
      }
    if (g.works.length) groups.push(g);
  }
  return groups;
}

/** A work's versions, its usual ones first. */
export function versionsInOrder(work: string): Version[] {
  const all = versionsForWork(work);
  const first = DEFAULT_VERSIONS[work] ?? [];
  const rank = (v: Version) => {
    const i = first.indexOf(v.id);
    return i < 0 ? first.length : i;
  };
  return all.map((v, i) => ({ v, i })).sort((a, b) => rank(a.v) - rank(b.v) || a.i - b.i).map((x) => x.v);
}
