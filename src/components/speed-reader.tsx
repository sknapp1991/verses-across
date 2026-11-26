"use client";
/**
 * Speed reader (study lab, hub 7a62bb28): any chapter on the site flashed one word at a time (rapid serial visual
 * presentation), from 60 to 1000 words a minute. Each word's focus letter, about a third of the way in, sits at the
 * same spot every time, so the eye never has to move. Longer stops at the end of a sentence or a clause. Pausing shows
 * the verse in full, exactly as written, with the word marked. Arabic and other joined scripts are shown whole (never
 * cut into pieces), right to left where they are written that way. Visual reading only: no sound.
 * The last text, place, speed and the comprehension option are kept on this device.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { adjacentChapters, booksOfWork, chapterTitle, findBook, getVersion } from "@/lib/catalog";
import { fetchBook } from "@/lib/chapter-store";
import { getLanguage } from "@/lib/languages";
import {
  delayOf,
  graphemes,
  sentenceBack,
  sentenceForward,
  splitWord,
  tokenize,
  versionsInOrder,
  workGroups,
  type Token,
  type Verse,
} from "@/lib/speed-reader";

const STORE = "va-speed-reader";
const PRESETS = [150, 250, 400, 600];
const MIN_WPM = 60;
const MAX_WPM = 1000;
/** Where the focus letter sits, from the start of the line. */
const FOCUS_AT = 38;

type Pick = { work: string; version: string; book: string; chapter: number };
const DEFAULT_PICK: Pick = { work: "bible", version: "kjv", book: "gen", chapter: 1 };
const keyOf = (p: Pick) => `${p.work}/${p.version}/${p.book}/${p.chapter}`;

type Load =
  | { key: string; status: "error"; message: string }
  | { key: string; status: "ok"; verses: Verse[]; tokens: Token[]; mean: number; cum: number[] };

/** One finished reading of a chapter, rated at the speed actually read. */
type Rating = { round: number; title: string; wpm: number; rating: number };

/** A pick that the catalog can serve: unknown parts fall back to the work's first book, usual version, chapter 1. */
function validPick(p: Partial<Pick>): Pick | null {
  if (!p.work) return null;
  const books = booksOfWork(p.work);
  const versions = versionsInOrder(p.work);
  if (!books.length || !versions.length) return null;
  const version = versions.some((v) => v.id === p.version) ? p.version! : versions[0].id;
  const book = books.find((b) => b.id === p.book) ?? books[0];
  const max = book.chapters ?? 1;
  const chapter = typeof p.chapter === "number" && p.chapter >= 1 && p.chapter <= max ? Math.floor(p.chapter) : 1;
  return { work: p.work, version, book: book.id, chapter };
}

function fontFor(lang: string): CSSProperties | undefined {
  if (lang === "he") return { fontFamily: 'var(--font-hebrew), "SBL Hebrew", "Ezra SIL", serif' };
  if (lang === "ar") return { fontFamily: 'var(--font-arabic), "Noto Naskh Arabic", serif' };
  if (lang === "el") return { fontFamily: "var(--font-greek), var(--font-serif)" };
  return undefined;
}

const clampWpm = (n: number) => Math.max(MIN_WPM, Math.min(MAX_WPM, Math.round(n)));

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m % 60).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/* ---------------- the word box ---------------- */

function Flash({ word, dir, lang }: { word: string; dir: "ltr" | "rtl"; lang: string }) {
  const parts = splitWord(word);
  const len = graphemes(word).length;
  const size = len > 16 ? "text-xl sm:text-3xl" : len > 12 ? "text-2xl sm:text-4xl" : len > 9 ? "text-3xl sm:text-5xl" : "text-4xl sm:text-6xl";
  // A word shown whole (Arabic, Indic) grows smaller with length and, as a last resort, wraps instead of being cut off.
  const wholeSize = len > 28 ? "text-base sm:text-2xl" : len > 20 ? "text-lg sm:text-3xl" : len > 14 ? "text-xl sm:text-4xl" : len > 9 ? "text-2xl sm:text-5xl" : "";
  const tick: CSSProperties = { insetInlineStart: `calc(${FOCUS_AT}% + 0.28em)` };
  return (
    <span dir={dir} lang={lang} className={`absolute inset-0 block ${size}`} style={fontFor(lang)}>
      <span aria-hidden className="absolute top-8 h-3 w-0.5 bg-accent" style={tick} />
      <span aria-hidden className="absolute bottom-4 h-3 w-0.5 bg-accent" style={tick} />
      {parts ? (
        <span className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 whitespace-nowrap py-2 leading-normal">
          <span className="flex shrink-0 justify-end text-ink" style={{ width: `${FOCUS_AT}%` }}>
            <span>{parts.before}</span>
          </span>
          <span className="min-w-0 flex-1 overflow-hidden text-start">
            <span className="font-semibold text-accent">{parts.focus}</span>
            <span className="text-ink">{parts.after}</span>
          </span>
        </span>
      ) : (
        <span
          className={`absolute inset-x-0 top-1/2 block -translate-y-1/2 px-3 py-2 text-center leading-normal text-ink [overflow-wrap:anywhere] ${wholeSize}`}
        >
          {word}
        </span>
      )}
    </span>
  );
}

/** The verse exactly as written, the current word marked. */
function Context({ text, s, e, dir, lang }: { text: string; s: number; e: number; dir: "ltr" | "rtl"; lang: string }) {
  return (
    <p dir={dir} lang={lang} className="font-serif text-lg leading-relaxed text-ink" style={fontFor(lang)}>
      {text.slice(0, s)}
      <mark className="rounded bg-accent-soft px-0.5 text-ink">{text.slice(s, e)}</mark>
      {text.slice(e)}
    </p>
  );
}

/* ---------------- the page ---------------- */

export function SpeedReader() {
  const groups = useMemo(() => workGroups(), []);
  const [pick, setPick] = useState<Pick>(DEFAULT_PICK);
  const key = keyOf(pick);
  const [load, setLoad] = useState<Load | null>(null);
  const [pos, setPos] = useState<{ key: string; i: number }>({ key: keyOf(DEFAULT_PICK), i: 0 });
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [wpm, setWpm] = useState(250);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const [stats, setStats] = useState({ words: 0, ms: 0 });
  const [check, setCheck] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  /** Counts finished readings, so a re-read can be rated again. */
  const [round, setRound] = useState(0);
  /** This reading of this chapter: words and time, for the speed actually read. */
  const [chap, setChap] = useState({ key: "", words: 0, ms: 0 });
  /** How much of the current word was already shown before a pause or a speed change. */
  const partRef = useRef<{ key: string; i: number; frac: number } | null>(null);
  const [restored, setRestored] = useState(false);

  const book = findBook(pick.work, pick.book);
  const version = getVersion(pick.version);
  const lang = version?.language ?? "en";
  const dir = version?.dir ?? "ltr";
  const versions = useMemo(() => versionsInOrder(pick.work), [pick.work]);
  const books = useMemo(() => booksOfWork(pick.work), [pick.work]);
  const chapters = book?.chapters ?? 1;

  const ready = load?.key === key && load.status === "ok" ? load : null;
  const loadError = load?.key === key && load.status === "error" ? load.message : null;
  const tokens = ready?.tokens ?? [];
  const idx = pos.key === key ? Math.max(0, Math.min(pos.i, tokens.length - 1)) : 0;
  const token: Token | undefined = tokens[idx];
  const verse = token && ready ? ready.verses[token.verse] : undefined;
  const word = token && verse ? verse.t.slice(token.s, token.e) : "";
  const finished = doneKey === key;
  const title = chapterTitle(book, pick.chapter);
  const reference = verse ? `${title}:${verse.n ?? verse.v}` : title;
  const next = adjacentChapters({ work: pick.work, book: pick.book, chapter: pick.chapter }).next;

  // The last pick, place, speed and option, after hydration.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw) as Partial<Pick> & { i?: number; wpm?: number; check?: boolean };
        const p = validPick(s);
        if (p && groups.some((g) => g.works.some((w) => w.id === p.work))) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the saved pick once, after hydration
          setPick(p);
          if (keyOf(p) === `${s.work}/${s.version}/${s.book}/${s.chapter}` && typeof s.i === "number") setPos({ key: keyOf(p), i: s.i });
        }
        if (typeof s.wpm === "number") setWpm(clampWpm(s.wpm));
        if (typeof s.check === "boolean") setCheck(s.check);
      }
    } catch {
      /* (no storage here: start at Genesis 1) */
    }
    setRestored(true);
  }, [groups]);

  // Keep the place (every 20 words while reading, and whenever paused).
  useEffect(() => {
    if (!restored || !ready || (playing && idx % 20 !== 0)) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({ ...pick, i: idx, wpm, check }));
    } catch {
      /* (private mode: nothing kept) */
    }
  }, [restored, ready, pick, idx, wpm, check, playing]);

  // The chapter's text (each book file is fetched once and shared with the reader's cache).
  useEffect(() => {
    let live = true;
    fetchBook(pick.work, pick.version, pick.book)
      .then((b) => {
        const ch = b.chapters[String(pick.chapter)];
        if (!ch) throw new Error("This chapter isn't in this version.");
        const verses = (ch.verses ?? []) as Verse[];
        const t = tokenize(verses);
        if (!t.length) throw new Error("This chapter has no text in this version.");
        const cum = [0];
        for (const k of t) cum.push(cum[cum.length - 1] + k.weight);
        if (live) setLoad({ key, status: "ok", verses, tokens: t, mean: cum[t.length] / t.length, cum });
      })
      .catch((e: unknown) => {
        if (!live) return;
        const msg = String((e as Error)?.message ?? e);
        setPlaying(false); // (a next chapter that can't load doesn't stay on "Pause")
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setLoad({
          key,
          status: "error",
          message: offline ? "You seem to be offline." : msg.includes("Not available") ? "This book isn't in this version. Try another version." : msg,
        });
      });
    return () => {
      live = false;
    };
  }, [key, pick.work, pick.version, pick.book, pick.chapter]);

  // One timer at a time: each word schedules the next, and any change (pause, speed, a jump) clears it. Pauses scale by
  // the chapter's mean so the average pace is the speed chosen. A word cut short by a pause or a speed change keeps
  // what was already shown, and its time still counts.
  useEffect(() => {
    if (!playing || !ready || !token) return;
    const started = Date.now();
    const full = delayOf(token, slow ? wpm / 2 : wpm) / ready.mean;
    const part = partRef.current;
    const doneFrac = part && part.key === key && part.i === idx ? part.frac : 0;
    let fired = false;
    const add = (words: number, ms: number) => {
      setStats((st) => ({ words: st.words + words, ms: st.ms + ms }));
      setChap((c) => (c.key === key ? { key, words: c.words + words, ms: c.ms + ms } : { key, words, ms }));
    };
    const id = setTimeout(
      () => {
        fired = true;
        partRef.current = null;
        add(1, Date.now() - started);
        if (idx + 1 >= ready.tokens.length) {
          setPlaying(false);
          setDoneKey(key);
          setRound((r) => r + 1);
        } else setPos({ key, i: idx + 1 });
      },
      Math.max(0, full * (1 - doneFrac)),
    );
    return () => {
      clearTimeout(id);
      if (fired) return;
      const spent = Date.now() - started;
      partRef.current = { key, i: idx, frac: Math.min(1, doneFrac + (full > 0 ? spent / full : 1)) };
      add(0, spent);
    };
  }, [playing, ready, token, idx, wpm, slow, key]);

  // A hidden tab pauses.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") setPlaying(false);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const jump = (i: number) => {
    if (!tokens.length) return;
    setDoneKey(null);
    setPos({ key, i: Math.max(0, Math.min(tokens.length - 1, i)) });
  };

  const toggle = () => {
    if (!ready) return;
    if (finished) {
      setDoneKey(null);
      setChap({ key, words: 0, ms: 0 });
      setPos({ key, i: 0 });
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  const back = () => jump(sentenceBack(tokens, idx));
  const forward = () => jump(sentenceForward(tokens, idx));

  const choose = (p: Pick | null, play = false) => {
    if (!p) return;
    setPlaying(play);
    setDoneKey(null);
    setChap({ key: keyOf(p), words: 0, ms: 0 });
    setPick(p);
    setPos({ key: keyOf(p), i: 0 });
  };

  // Space plays and pauses, the arrows move a sentence, holding S reads at half speed.
  useEffect(() => {
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || isField(e.target)) return;
      if (e.key === " " || e.key === "Spacebar") {
        if ((e.target as HTMLElement | null)?.tagName === "BUTTON") return; // (the button itself answers)
        e.preventDefault();
        if (!e.repeat) toggle();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        // (in a right-to-left text, left is forward)
        e.preventDefault();
        if ((e.key === "ArrowRight") === (dir === "ltr")) forward();
        else back();
      } else if (e.key === "s" || e.key === "S") setSlow(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "s" || e.key === "S") setSlow(false);
    };
    const blur = () => setSlow(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  });

  const progress = tokens.length > 1 ? idx / (tokens.length - 1) : 0;
  const avg = stats.ms > 1000 ? Math.round(stats.words / (stats.ms / 60000)) : 0;
  const chapWpm = chap.key === key && chap.ms > 1000 ? Math.round(chap.words / (chap.ms / 60000)) : wpm;
  const askRating = finished && check && !ratings.some((r) => r.round === round);
  const lastRating = finished ? ratings.find((r) => r.round === round) : undefined;
  const left = ready ? ((ready.cum[tokens.length] - ready.cum[idx]) / ready.mean) * (60000 / wpm) : 0;
  const noFocus = (e: MouseEvent) => e.preventDefault(); // (a click doesn't keep focus, so Space stays play / pause)

  const btn = "min-h-11 rounded-xl border border-line px-3 text-sm font-medium text-ink hover:bg-raised disabled:opacity-50";

  return (
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <Link href="/study-lab" className="text-xs text-accent hover:underline">
            ← Study lab
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Speed reader</p>
          <h1 className="font-serif text-3xl font-semibold text-ink">One word at a time</h1>
          <p className="text-muted">
            Words appear one by one in the same place, so your eyes can stay still. Start slow, then raise the speed a little at a time. Pause
            whenever you like to see the whole verse.
          </p>
        </header>

        {/* What to read */}
        <section className="grid gap-3 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Text</span>
            <select
              value={pick.work}
              onChange={(e) => choose(validPick({ work: e.target.value }))}
              className="min-h-11 w-full rounded-lg border border-line bg-raised px-2 text-sm text-ink"
            >
              {groups.map((g) => (
                <optgroup key={g.shelf} label={g.shelf}>
                  {g.works.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Version</span>
            <select
              value={pick.version}
              onChange={(e) => choose({ ...pick, version: e.target.value })}
              className="min-h-11 w-full rounded-lg border border-line bg-raised px-2 text-sm text-ink"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.abbr}: {v.name} ({getLanguage(v.language).name})
                </option>
              ))}
            </select>
          </label>
          {books.length > 1 && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">Book</span>
              <select
                value={pick.book}
                onChange={(e) => choose({ ...pick, book: e.target.value, chapter: 1 })}
                className="min-h-11 w-full rounded-lg border border-line bg-raised px-2 text-sm text-ink"
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Chapter</span>
            <select
              value={pick.chapter}
              onChange={(e) => choose({ ...pick, chapter: Number(e.target.value) })}
              className="min-h-11 w-full rounded-lg border border-line bg-raised px-2 text-sm text-ink"
            >
              {Array.from({ length: chapters }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {chapterTitle(book, n)}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* The reader */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium text-muted">{reference}</span>
            <span className="text-faint">{version?.abbr}</span>
          </div>
          <button
            type="button"
            onClick={toggle}
            onMouseDown={noFocus}
            aria-label={playing ? "Pause" : "Play"}
            className="relative block h-44 w-full overflow-hidden rounded-2xl border border-line bg-panel sm:h-52"
          >
            {verse && (
              <span className="absolute start-4 top-2 text-xs text-faint" dir="ltr">
                {verse.n ?? verse.v}
              </span>
            )}
            {ready && word ? (
              <Flash word={word} dir={dir} lang={lang} />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center px-6 text-sm text-muted">{loadError ?? "Loading…"}</span>
            )}
          </button>

          {/* Where you are in the chapter: tap to jump */}
          <button
            type="button"
            dir={dir}
            onMouseDown={noFocus}
            disabled={!ready}
            aria-label={`Jump within the chapter (${Math.round(progress * 100)}% read)`}
            onClick={(e) => {
              if (e.detail === 0) return; // (Enter or Space on the bar: no place was tapped)
              const r = e.currentTarget.getBoundingClientRect();
              const f = dir === "rtl" ? (r.right - e.clientX) / r.width : (e.clientX - r.left) / r.width;
              jump(Math.round(f * (tokens.length - 1)));
            }}
            className="block w-full py-2"
          >
            <span className="block h-2 overflow-hidden rounded-full bg-raised">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
            </span>
          </button>
          <div className="flex justify-between text-xs text-faint">
            <span>
              Word {ready ? idx + 1 : 0} of {tokens.length}
            </span>
            {ready && <span>about {formatTime(left)} left</span>}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={back} onMouseDown={noFocus} disabled={!ready} className={btn} aria-label="Back a sentence">
              ← Sentence
            </button>
            <button
              type="button"
              onClick={toggle}
              onMouseDown={noFocus}
              disabled={!ready}
              className="min-h-11 min-w-28 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink disabled:opacity-50"
            >
              {playing ? "Pause" : finished ? "Read again" : "Play"}
            </button>
            <button type="button" onClick={forward} onMouseDown={noFocus} disabled={!ready} className={btn} aria-label="Forward a sentence">
              Sentence →
            </button>
            <button
              type="button"
              onMouseDown={noFocus}
              onPointerDown={() => setSlow(true)}
              onPointerUp={() => setSlow(false)}
              onPointerLeave={() => setSlow(false)}
              onPointerCancel={() => setSlow(false)}
              onContextMenu={(e) => e.preventDefault()}
              disabled={!ready}
              className={`${btn} touch-none select-none ${slow ? "bg-accent-soft" : ""}`}
            >
              {slow ? "Half speed" : "Hold to slow down"}
            </button>
          </div>
          <p className="text-center text-xs text-faint">Keyboard: Space to play or pause, ← and → for a sentence{dir === "rtl" ? " (← goes forward in this right-to-left text)" : ""}, hold S to slow down.</p>

          {finished && (
            <div className="space-y-3 rounded-2xl border border-line bg-panel p-4 text-center">
              <p className="font-serif text-lg text-ink">End of {title}</p>
              {askRating && (
                <div className="space-y-2">
                  <p className="text-sm text-muted">How much did you take in? (1 = very little, 5 = all of it)</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onMouseDown={noFocus}
                        onClick={() => setRatings((r) => [...r, { round, title, wpm: chapWpm, rating: n }])}
                        className="min-h-11 min-w-11 rounded-xl border border-line text-sm font-semibold text-ink hover:bg-raised"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {lastRating && (
                <p className="text-sm text-muted">
                  Noted: {lastRating.rating} of 5 at {lastRating.wpm} words a minute. Understanding often drops above about 500 words a minute, so
                  compare a few speeds to find your own pace.
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {next && (
                  <button
                    type="button"
                    onMouseDown={noFocus}
                    onClick={() => choose(validPick({ ...pick, book: next.book, chapter: next.chapter }), true)}
                    className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink"
                  >
                    Next chapter →
                  </button>
                )}
                <button type="button" onMouseDown={noFocus} onClick={toggle} className={btn}>
                  Read again
                </button>
              </div>
            </div>
          )}

          {!playing && verse && token && !finished && (
            <div className="space-y-1 rounded-2xl border border-line bg-panel p-4">
              <p className="text-xs font-medium text-muted">{reference}</p>
              <Context text={verse.t} s={token.s} e={token.e} dir={dir} lang={lang} />
            </div>
          )}
        </section>

        {/* Speed */}
        <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="sr-wpm" className="text-sm font-medium text-ink">
              Speed
            </label>
            <span className="text-sm text-ink">
              <span className="font-semibold">{wpm}</span> words a minute
            </span>
          </div>
          <input
            id="sr-wpm"
            type="range"
            min={MIN_WPM}
            max={MAX_WPM}
            step={10}
            value={wpm}
            onChange={(e) => setWpm(clampWpm(Number(e.target.value)))}
            className="w-full"
            style={{ accentColor: "var(--accent)" }}
          />
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onMouseDown={noFocus}
                onClick={() => setWpm(p)}
                className={`min-h-9 rounded-lg border px-3 text-xs font-medium ${wpm === p ? "border-accent bg-accent text-accent-ink" : "border-line text-ink hover:bg-raised"}`}
              >
                {p}
              </button>
            ))}
          </div>
          {wpm > 500 && <p className="text-xs text-muted">Above about 500 words a minute, most readers take in less. Good for skimming; slow down for close reading.</p>}
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" checked={check} onChange={(e) => setCheck(e.target.checked)} className="mt-1" style={{ accentColor: "var(--accent)" }} />
            <span>After each chapter, ask me how much I took in</span>
          </label>
        </section>

        {/* This session */}
        <section className="space-y-2 rounded-2xl border border-line bg-panel p-4">
          <p className="text-sm font-medium text-ink">This session</p>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="text-xs text-faint">Words</dt>
              <dd className="text-lg font-semibold text-ink">{stats.words.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Time</dt>
              <dd className="text-lg font-semibold text-ink">{formatTime(stats.ms)}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Average</dt>
              <dd className="text-lg font-semibold text-ink">{avg ? `${avg} wpm` : "-"}</dd>
            </div>
          </dl>
          {ratings.length > 0 && (
            <ul className="space-y-1 border-t border-line pt-2 text-xs text-muted">
              {ratings.map((r) => (
                <li key={r.round}>
                  {r.title}: {r.rating} of 5 at {r.wpm} wpm
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="space-y-1 text-xs text-faint">
          <p>Texts are shown exactly as they appear on the site. Arabic and other joined scripts are shown a whole word at a time.</p>
          {version?.attribution && <p>{version.attribution}</p>}
        </footer>
      </div>
    </main>
  );
}
