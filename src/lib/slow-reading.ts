/**
 * Slow reading (study lab, hub 7a62bb28): one short passage read slowly several times, in four movements (read,
 * reflect, respond, rest), in the spirit of lectio divina and the contemplative reading found in many traditions.
 * Here: the suggested passages, the neutral prompts, the private journal kept on this device, and the soft chime.
 * Texts are always shown exactly as written; a chosen phrase is a slice of the verse, never retyped.
 */
import { chapterTitle, findBook } from "./catalog";

/* ---------------- passages ---------------- */

export type Passage = { work: string; version: string; book: string; chapter: number; from: number; to: number };
export type Verse = { v: string; t: string; n?: string };

/** The longest passage offered: this is meant to be short. */
export const MAX_VERSES = 12;

export type Suggestion = { label: string; tradition: string; passage: Passage };

/** Starting places across traditions (each checked against public/texts). */
export const SUGGESTIONS: Suggestion[] = [
  { label: "Psalm 23", tradition: "Hebrew Bible", passage: { work: "bible", version: "kjv", book: "psa", chapter: 23, from: 1, to: 6 } },
  { label: "Matthew 5:3–10", tradition: "New Testament", passage: { work: "bible", version: "kjv", book: "mat", chapter: 5, from: 3, to: 10 } },
  { label: "Isaiah 40:28–31", tradition: "Hebrew Bible", passage: { work: "bible", version: "kjv", book: "isa", chapter: 40, from: 28, to: 31 } },
  { label: "Al-Fatiha (Quran 1)", tradition: "Quran, Pickthall's English", passage: { work: "quran", version: "pickthall", book: "quran", chapter: 1, from: 1, to: 7 } },
  { label: "Dhammapada 1–2", tradition: "Buddhist", passage: { work: "dhammapada", version: "sujato", book: "dhp", chapter: 1, from: 1, to: 2 } },
  { label: "Tao Te Ching 8", tradition: "Taoist", passage: { work: "tao-te-ching", version: "legge-ttc", book: "ttc", chapter: 8, from: 1, to: 3 } },
  { label: "Bhagavad Gita 2:47", tradition: "Hindu", passage: { work: "gita", version: "besant", book: "gita", chapter: 2, from: 47, to: 47 } },
  { label: "The Discourse on Love (Metta Sutta)", tradition: "Buddhist", passage: { work: "tipitaka", version: "sc-en", book: "kp", chapter: 9, from: 1, to: 10 } },
  { label: "Japji, the opening", tradition: "Sikh", passage: { work: "ggs", version: "khalsa", book: "opening-banis-japji-so-dar-sohila", chapter: 1, from: 1, to: 4 } },
];

export const passageKey = (p: Passage) => `${p.work}/${p.version}/${p.book}/${p.chapter}/${p.from}-${p.to}`;
export const samePassage = (a: Passage, b: Passage) => passageKey(a) === passageKey(b);

/** "Psalm 23:1–6", or the suggestion's own name when it is one. */
export function passageTitle(p: Passage, verses?: Verse[]): string {
  const s = SUGGESTIONS.find((x) => samePassage(x.passage, p));
  if (s) return s.label;
  const head = chapterTitle(findBook(p.work, p.book), p.chapter, p.book);
  const label = (n: number) => verses?.find((v) => verseNum(v) === n)?.n ?? String(n);
  // "Bhagavad Gita, Chapter 2, verse 47" rather than "Chapter 2:47"
  if (/chapter \d+$/i.test(head)) return p.from === p.to ? `${head}, verse ${label(p.from)}` : `${head}, verses ${label(p.from)}–${label(p.to)}`;
  return p.from === p.to ? `${head}:${label(p.from)}` : `${head}:${label(p.from)}–${label(p.to)}`;
}

/** A verse's number ("42a", an added part of a verse in some versions, counts as 42). */
export const verseNum = (v: Verse) => parseInt(v.v, 10);

/** The verses of a passage, in order, from a chapter's verse list. */
export function versesIn(all: Verse[], p: Passage): Verse[] {
  return all.filter((v) => {
    const n = verseNum(v);
    return n >= p.from && n <= p.to;
  });
}

/** The distinct verse numbers of a chapter, in order. */
export function verseNumbers(all: Verse[]): number[] {
  const out: number[] = [];
  for (const v of all) {
    const n = verseNum(v);
    if (!isNaN(n) && out[out.length - 1] !== n && !out.includes(n)) out.push(n);
  }
  return out;
}

/* ---------------- words to tap ---------------- */

/** Han, kana and similar: written without spaces, so each character can be tapped. */
const UNSPACED = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;
const HAS_LETTER = /[\p{L}\p{N}]/u;

/** A verse cut into pieces that join back to it exactly; `word` pieces can be tapped. */
export type Piece = { text: string; word: boolean; s: number; e: number };
export function piecesOf(text: string): Piece[] {
  const out: Piece[] = [];
  let at = 0;
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    const isWord = HAS_LETTER.test(part);
    if (isWord && UNSPACED.test(part)) {
      for (const ch of Array.from(part)) {
        out.push({ text: ch, word: HAS_LETTER.test(ch), s: at, e: at + ch.length });
        at += ch.length;
      }
      continue;
    }
    out.push({ text: part, word: isWord, s: at, e: at + part.length });
    at += part.length;
  }
  return out;
}

/** The phrase chosen: in one verse, from piece `a` to piece `b`. */
export type Chosen = { verse: number; a: number; b: number };

/** Tap a word: a new word starts a phrase; another word in the same verse stretches it; a tap on it clears it. */
export function tapWord(sel: Chosen | null, verse: number, i: number): Chosen | null {
  if (!sel || sel.verse !== verse) return { verse, a: i, b: i };
  if (i >= sel.a && i <= sel.b) return null;
  return { verse, a: Math.min(sel.a, i), b: Math.max(sel.b, i) };
}

/** The chosen phrase exactly as written (a slice of the verse). */
export function phraseOf(verses: Verse[], sel: Chosen | null): string {
  if (!sel) return "";
  const v = verses[sel.verse];
  if (!v) return "";
  const ps = piecesOf(v.t);
  const a = ps[sel.a];
  const b = ps[sel.b];
  return a && b ? v.t.slice(a.s, b.e) : "";
}

/* ---------------- the four movements ---------------- */

export type Movement = "read" | "reflect" | "respond" | "rest";
export const MOVEMENTS: { id: Movement; name: string; lead: string }[] = [
  { id: "read", name: "Read", lead: "Read slowly, one line at a time, as if for the first time. There is nothing to figure out yet." },
  {
    id: "reflect",
    name: "Reflect",
    lead: "Read it again, more slowly. Notice a word or a phrase that stays with you, and tap it. No need to know why.",
  },
  { id: "respond", name: "Respond", lead: "Stay with what you chose. If you like, write a few words. Only you will see them." },
  { id: "rest", name: "Rest", lead: "Let the words go quiet. Nothing to do now: stay with the phrase, or with the silence." },
];

/** Gentle prompts for the third movement, meant to fit any tradition, or none. */
export const PROMPTS = [
  "What does this word or phrase stir in you today?",
  "Is there something in your life right now that it touches?",
  "If it were a question to you, what would it be asking?",
  "What would you like to say back: to the text, to yourself, or to what you hold dear?",
  "What feels hard here, and what feels like a gift?",
  "Write freely for a minute, without stopping to fix anything.",
  "Where in your day could you carry this phrase with you?",
];

/* ---------------- timers ---------------- */

/** Minutes for each movement's timer: 0 is no timer. */
export type Timers = Record<Movement, number>;
export const DEFAULT_TIMERS: Timers = { read: 0, reflect: 0, respond: 0, rest: 1 };
export const TIMER_CHOICES = [0, 1, 2, 3, 4, 5];

/* ---------------- the journal (this device only) ---------------- */

export const JOURNAL_KEY = "va-slow-reading:journal:v1";
export const PREFS_KEY = "va-slow-reading:prefs:v1";

export type Sitting = { time: string; phrase: string; prompt: string; note: string };
/** One day with one passage: every sitting with it that day. */
export type Entry = { id: string; date: string; passage: Passage; title: string; sittings: Sitting[] };

/** Today's date on this device, as 2026-11-26. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const entryId = (date: string, p: Passage) => `${date}|${passageKey(p)}`;

const isStr = (x: unknown): x is string => typeof x === "string";
function validPassage(x: unknown): x is Passage {
  const p = x as Passage;
  return !!p && isStr(p.work) && isStr(p.version) && isStr(p.book) && [p.chapter, p.from, p.to].every((n) => typeof n === "number" && n >= 0);
}

/** The journal as kept, dropping anything malformed. Newest first. */
export function parseJournal(raw: string | null): Entry[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    const out: Entry[] = [];
    for (const e of list as Entry[]) {
      if (!e || !isStr(e.id) || !isStr(e.date) || !isStr(e.title) || !validPassage(e.passage) || !Array.isArray(e.sittings)) continue;
      const sittings = e.sittings.filter((s) => s && isStr(s.time) && isStr(s.phrase) && isStr(s.prompt) && isStr(s.note));
      if (sittings.length) out.push({ id: e.id, date: e.date, passage: e.passage, title: e.title, sittings });
    }
    return sortJournal(out);
  } catch {
    return [];
  }
}

export function sortJournal(list: Entry[]): Entry[] {
  const last = (e: Entry) => e.sittings[e.sittings.length - 1]?.time ?? e.date;
  return [...list].sort((a, b) => (last(a) < last(b) ? 1 : last(a) > last(b) ? -1 : 0));
}

/** The journal with one more sitting: added to today's entry for this passage, or a new entry. */
export function addSitting(list: Entry[], passage: Passage, title: string, sitting: Sitting, now = new Date()): Entry[] {
  const date = localDate(now);
  const id = entryId(date, passage);
  const found = list.find((e) => e.id === id);
  const next = found
    ? list.map((e) => (e.id === id ? { ...e, sittings: [...e.sittings, sitting] } : e))
    : [...list, { id, date, passage, title, sittings: [sitting] }];
  return sortJournal(next);
}

/** "Thursday, November 26, 2026" */
export function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export function clockTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** The whole journal as plain text, for a file to keep. */
export function journalText(list: Entry[]): string {
  const lines = ["Slow reading: my journal", `Saved from Verses Across on ${longDate(localDate())}`, ""];
  for (const e of [...list].reverse()) {
    lines.push("----------------------------------------", `${longDate(e.date)}: ${e.title}`, "");
    for (const s of e.sittings) {
      const t = clockTime(s.time);
      if (t) lines.push(`(${t})`);
      if (s.phrase) lines.push(`Phrase: "${s.phrase}"`);
      if (s.note.trim()) {
        if (s.prompt) lines.push(`Prompt: ${s.prompt}`);
        lines.push(s.note.trim());
      }
      lines.push("");
    }
  }
  return lines.join("\r\n");
}

/* ---------------- the chime ---------------- */

type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };

export type Chime = { ring: () => void; close: () => void };

/**
 * A soft bell, opened when a timer starts (a tap, so Safari lets it sound later) and rung by the timer itself when
 * its time is up (wall clock, so a locked phone doesn't make it late). If the audio can't resume after the page comes
 * back, it stays silent. Never used with the Quran (no tones there).
 */
export function openChime(): Chime | null {
  const Ctx = typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as WithWebkit).webkitAudioContext);
  if (!Ctx) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctx();
  } catch {
    return null;
  }
  void ctx.resume?.().catch(() => {});
  let closed = false;
  let rung = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    void ctx.close().catch(() => {}); // (Safari allows only a few open audio contexts)
  };
  const play = () => {
    if (closed || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.05;
    const out = ctx.createGain();
    out.gain.value = 0.16;
    out.connect(ctx.destination);
    // a struck bowl: a low partial and quieter, higher ones, fading over a few seconds
    for (const [f, g, len] of [
      [432, 1, 5],
      [432 * 2.76, 0.28, 2.6],
      [432 * 5.4, 0.08, 1.2],
    ] as const) {
      const o = ctx.createOscillator();
      const gain = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(g, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(gain);
      gain.connect(out);
      o.start(t);
      o.stop(t + len + 0.1);
    }
    timer = setTimeout(close, 6000);
  };
  const ring = () => {
    if (closed || rung) return;
    rung = true;
    if (ctx.state === "running") return play();
    Promise.resolve(ctx.resume?.())
      .then(play)
      .catch(close);
  };
  return { ring, close };
}

/** No sound with the Quran: many Muslims hold that its words shouldn't be joined to tones. */
export const quietWork = (work: string) => work === "quran";
