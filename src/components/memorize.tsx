"use client";
/**
 * Memorize (study lab, hub 7a62bb28): learn verses by heart. A small deck of verses from any text on the site, each
 * practiced four ways (read it, first letters, fade, type it) and brought back on a gentle SM-2-style schedule. The
 * words are always read from the site's text files, exactly as written. Bible cards can show the Hebrew or Greek
 * underneath. The deck, the schedule and the practice days live on this device only, and can be saved to a small file.
 * Visual only: no audio and no synthetic voice.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { booksOfWork, findBook, getVersion } from "@/lib/catalog";
import { fetchBook } from "@/lib/chapter-store";
import { versionsInOrder, workGroups } from "@/lib/speed-reader";
import {
  EMPTY_DECK,
  GRADES,
  MAX_RANGE,
  STARTERS,
  STORE,
  cleanDeck,
  dueCards,
  exportJson,
  fadeOrder,
  hintParts,
  isDue,
  makeCard,
  markDay,
  mergeDecks,
  originalFor,
  referenceOf,
  review,
  sameVerses,
  scoreTyping,
  splitWords,
  streakOf,
  today,
  versesIn,
  whenLabel,
  type Card,
  type Deck,
  type Grade,
  type Scored,
  type V,
} from "@/lib/memorize";

const PREFS = "va-memorize-prefs";
type Mode = "read" | "letters" | "fade" | "type";
const MODES: { id: Mode; label: string }[] = [
  { id: "read", label: "Read it" },
  { id: "letters", label: "First letters" },
  { id: "fade", label: "Fade" },
  { id: "type", label: "Type it" },
];
const GRADE_LABEL: Record<Grade, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };
const FADE_STEPS = 5;

const btn = "min-h-11 rounded-xl border border-line px-3 text-sm font-medium text-ink hover:bg-raised disabled:opacity-50";
const btnOn = "min-h-11 rounded-xl border border-line bg-accent px-3 text-sm font-medium text-accent-ink disabled:opacity-50";
const field = "min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-ink";

function fontFor(lang: string): CSSProperties | undefined {
  if (lang === "he") return { fontFamily: 'var(--font-hebrew), "SBL Hebrew", "Ezra SIL", serif' };
  if (lang === "ar") return { fontFamily: 'var(--font-arabic), "Noto Naskh Arabic", serif' };
  if (lang === "el") return { fontFamily: "var(--font-greek), var(--font-serif)" };
  return undefined;
}

/* ---------------- loading a chapter ---------------- */

type ChapterLoad = { key: string; verses?: V[]; error?: string };

/** One chapter's verses (each book file is fetched once and shared with the reader's cache). */
function useChapter(work: string, version: string, book: string, chapter: number): { verses?: V[]; error?: string } {
  const key = work && version && book ? `${work}|${version}|${book}|${chapter}` : "";
  const [load, setLoad] = useState<ChapterLoad>({ key: "" });
  useEffect(() => {
    if (!key) return;
    const [w, ver, b, ch] = key.split("|");
    let live = true;
    fetchBook(w, ver, b)
      .then((file) => {
        const c = file.chapters[ch];
        if (!live) return;
        if (c && c.verses.length) setLoad({ key, verses: c.verses as V[] });
        else setLoad({ key, error: "This chapter isn't in this version." });
      })
      .catch(() => {
        if (live) setLoad({ key, error: "Couldn't load the text. Check your connection and try again." });
      });
    return () => {
      live = false;
    };
  }, [key]);
  return load.key === key ? load : {};
}

/* ---------------- the verses, in each practice mode ---------------- */

type Shown = { verses: V[]; lang: string; dir: "ltr" | "rtl" };

function Num({ v }: { v: V }) {
  return <sup className="me-1 select-none text-xs font-sans text-faint">{v.v}</sup>;
}

function ReadText({ verses, lang, dir, size = "text-xl" }: Shown & { size?: string }) {
  return (
    <div dir={dir} lang={lang} className={`space-y-2 font-serif leading-relaxed text-ink ${size}`} style={fontFor(lang)}>
      {verses.map((v) => (
        <p key={v.v}>
          {verses.length > 1 && <Num v={v} />}
          {v.t}
        </p>
      ))}
    </div>
  );
}

/** First letters (`hidden` = null) or fade (`hidden` = the words faded out). A tap shows a word. */
function HintText({ verses, lang, dir, hidden, revealed, onReveal }: Shown & { hidden: Set<number> | null; revealed: Set<number>; onReveal: (i: number) => void }) {
  let k = -1;
  return (
    <div dir={dir} lang={lang} className="space-y-2 font-serif text-xl leading-loose text-ink" style={fontFor(lang)}>
      {verses.map((v) => (
        <p key={v.v}>
          {verses.length > 1 && <Num v={v} />}
          {splitWords(v.t).map((part, j) => {
            if (part.space) return <span key={j}>{part.w}</span>;
            const i = ++k;
            const open = revealed.has(i) || (hidden !== null && !hidden.has(i));
            if (open) return <span key={j}>{part.w}</span>;
            if (hidden === null) {
              const h = hintParts(part.w);
              if (!h.rest) return <span key={j}>{part.w}</span>;
              return (
                <button key={j} type="button" onClick={() => onReveal(i)} className="inline rounded-sm">
                  {h.lead}
                  {h.first}
                  <span aria-hidden className="border-b-2 border-faint text-transparent">
                    {h.rest}
                  </span>
                  <span className="sr-only"> (the rest is hidden: show the word)</span>
                  {h.trail}
                </button>
              );
            }
            return (
              <button key={j} type="button" onClick={() => onReveal(i)} className="inline rounded-sm border-b-2 border-faint">
                <span aria-hidden className="text-transparent">
                  {part.w}
                </span>
                <span className="sr-only">(hidden word: show it)</span>
              </button>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function countWords(verses: V[]) {
  return verses.reduce((n, v) => n + splitWords(v.t).filter((p) => !p.space).length, 0);
}

function TypeIt({ verses, lang, dir, onScore }: Shown & { onScore: (s: Scored | null) => void }) {
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<Scored | null>(null);
  const text = verses.map((v) => v.t).join(" ");
  if (result)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          You had <span className="font-semibold text-ink">{result.right}</span> of {result.total} words. The marked words were missed or
          different.
        </p>
        <p dir={dir} lang={lang} className="font-serif text-xl leading-loose text-ink" style={fontFor(lang)}>
          {result.words.map((w, i) => (
            <span key={i}>
              {i > 0 && " "}
              {w.ok ? w.w : <mark className="rounded bg-accent-soft px-0.5 text-ink underline decoration-dotted">{w.w}</mark>}
            </span>
          ))}
        </p>
        {result.extra.length > 0 && (
          <p className="text-sm text-muted">
            Words you typed that aren&apos;t in the text here: <span dir={dir}>{result.extra.join(", ")}</span>
          </p>
        )}
        <button
          type="button"
          className={btn}
          onClick={() => {
            setResult(null);
            onScore(null);
          }}
        >
          Try again
        </button>
      </div>
    );
  return (
    <div className="space-y-3">
      <textarea
        dir={dir}
        lang={lang}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        rows={5}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Type it from memory. Capitals and punctuation don't matter."
        className="w-full rounded-xl border border-line bg-paper p-3 font-serif text-lg text-ink"
        style={fontFor(lang)}
      />
      <button
        type="button"
        className={btnOn}
        disabled={!typed.trim()}
        onClick={() => {
          const s = scoreTyping(text, typed);
          setResult(s);
          onScore(s);
        }}
      >
        Check
      </button>
    </div>
  );
}

/* ---------------- one card ---------------- */

function Original({ card }: { card: Card }) {
  const id = originalFor(card) ?? "";
  const ver = getVersion(id);
  const ch = useChapter(card.work, id, card.book, card.chapter);
  const verses = ch.verses ? versesIn(ch.verses, card.from, card.to) : [];
  return (
    <div className="space-y-2 border-t border-line pt-3">
      {ch.error ? (
        <p className="text-sm text-muted">{ch.error}</p>
      ) : !ch.verses ? (
        <p className="text-sm text-faint">Loading…</p>
      ) : verses.length ? (
        <ReadText verses={verses} lang={ver?.language ?? "he"} dir={ver?.dir ?? "ltr"} size="text-2xl" />
      ) : (
        <p className="text-sm text-muted">These verses aren&apos;t in the {id === "hebrew" ? "Hebrew" : "Greek"} text.</p>
      )}
      <p className="text-xs text-faint">{ver?.name}</p>
    </div>
  );
}

function Practice({
  card,
  day,
  mode,
  setMode,
  original,
  setOriginal,
  onGrade,
}: {
  card: Card;
  day: string;
  mode: Mode;
  setMode: (m: Mode) => void;
  original: boolean;
  setOriginal: (b: boolean) => void;
  onGrade: (g: Grade) => void;
}) {
  const version = getVersion(card.version);
  const lang = version?.language ?? "en";
  const dir = version?.dir ?? "ltr";
  const ch = useChapter(card.work, card.version, card.book, card.chapter);
  const verses = useMemo(() => (ch.verses ? versesIn(ch.verses, card.from, card.to) : []), [ch.verses, card.from, card.to]);
  const total = useMemo(() => countWords(verses), [verses]);
  const order = useMemo(() => fadeOrder(total, card.id), [total, card.id]);
  const [revealed, setRevealed] = useState<{ key: string; set: Set<number> }>({ key: "", set: new Set() });
  const [step, setStep] = useState({ key: "", n: 1 });
  const [score, setScore] = useState<{ key: string; s: Scored | null }>({ key: "", s: null });
  const viewKey = `${card.id}|${mode}`;
  const open = revealed.key === viewKey ? revealed.set : new Set<number>();
  const fade = step.key === card.id ? step.n : 1;
  const hidden = useMemo(() => new Set(order.slice(0, Math.round((fade / FADE_STEPS) * total))), [order, fade, total]);
  const typedScore = score.key === viewKey ? score.s : null;
  const hasOriginal = !!originalFor(card);
  const early = !isDue(card, day);

  const suggest: Grade | null = typedScore
    ? typedScore.right === typedScore.total
      ? "good"
      : typedScore.right >= typedScore.total * 0.8
        ? "hard"
        : "again"
    : null;
  const reveal = (i: number) => setRevealed({ key: viewKey, set: new Set(open).add(i) });

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl font-semibold text-ink">{referenceOf(card)}</h2>
        <span className="text-xs text-faint">{version?.name}</span>
      </div>
      {early && <p className="text-xs text-muted">Next due {whenLabel(card.sched.due, day)}. Practicing early is fine.</p>}

      <div role="tablist" aria-label="Practice mode" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={mode === m.id ? btnOn : btn} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="min-h-24 rounded-xl bg-paper p-4">
        {ch.error ? (
          <p className="text-sm text-muted">{ch.error}</p>
        ) : !ch.verses ? (
          <p className="text-sm text-faint">Loading…</p>
        ) : !verses.length ? (
          <p className="text-sm text-muted">These verses couldn&apos;t be found in this version.</p>
        ) : mode === "read" ? (
          <ReadText verses={verses} lang={lang} dir={dir} />
        ) : mode === "letters" ? (
          <HintText verses={verses} lang={lang} dir={dir} hidden={null} revealed={open} onReveal={reveal} />
        ) : mode === "fade" ? (
          <HintText verses={verses} lang={lang} dir={dir} hidden={hidden} revealed={open} onReveal={reveal} />
        ) : (
          <TypeIt key={viewKey} verses={verses} lang={lang} dir={dir} onScore={(s) => setScore({ key: viewKey, s })} />
        )}
      </div>

      {mode === "letters" && verses.length > 0 && <p className="text-xs text-muted">Each word shows its first letter. Tap a word to see it whole.</p>}
      {mode === "fade" && verses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} disabled={fade <= 0} onClick={() => setStep({ key: card.id, n: fade - 1 })}>
            Bring words back
          </button>
          <button type="button" className={btn} disabled={fade >= FADE_STEPS} onClick={() => setStep({ key: card.id, n: fade + 1 })}>
            Fade more
          </button>
          <span className="text-xs text-muted">
            {fade >= FADE_STEPS ? "All words hidden: say it from memory." : `Step ${fade} of ${FADE_STEPS}.`} Tap a blank to peek.
          </span>
        </div>
      )}

      {hasOriginal && (
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="h-5 w-5" checked={original} onChange={(e) => setOriginal(e.target.checked)} />
          Show the original {originalFor(card) === "hebrew" ? "Hebrew" : "Greek"} underneath
        </label>
      )}
      {hasOriginal && original && <Original card={card} />}

      <div className="space-y-2 border-t border-line pt-3">
        <p className="text-sm text-muted">
          How well did you know it?
          {suggest && <span className="ms-1 text-ink">From your typing: {GRADE_LABEL[suggest]}{suggest === "good" ? " or Easy" : ""}.</span>}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <button key={g} type="button" className={suggest === g ? btnOn : btn} onClick={() => onGrade(g)} disabled={!verses.length}>
              <span className="block">{GRADE_LABEL[g]}</span>
              <span className={`block text-xs font-normal ${suggest === g ? "" : "text-faint"}`}>
                {g === "again" ? "later today" : whenLabel(review(card.sched, g, day).due, day)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- adding verses ---------------- */

function AddVerses({ deck, day, onAdd }: { deck: Deck; day: string; onAdd: (c: Card) => void }) {
  const groups = useMemo(() => workGroups(), []);
  const [work, setWork] = useState("bible");
  const [version, setVersion] = useState("kjv");
  const [book, setBook] = useState("psa");
  const [chapter, setChapter] = useState(23);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("1");
  const versions = useMemo(() => versionsInOrder(work), [work]);
  const books = useMemo(() => booksOfWork(work), [work]);
  const chapters = findBook(work, book)?.chapters ?? 1;
  const ver = getVersion(version);
  const ch = useChapter(work, version, book, chapter);
  const list = useMemo(() => (ch.verses ?? []).filter((v) => v.t), [ch.verses]);
  const fromIdx = Math.max(0, list.findIndex((v) => v.v === from));
  const fromV = list[fromIdx]?.v ?? "";
  const toChoices = list.slice(fromIdx, fromIdx + MAX_RANGE);
  const toV = toChoices.some((v) => v.v === to) ? to : fromV;
  const preview = fromV ? versesIn(list, fromV, toV) : [];
  const draft = { work, version, book, chapter, from: fromV, to: toV };
  const inDeck = !!fromV && deck.cards.some((c) => sameVerses(c, draft));

  const pickWork = (w: string) => {
    setWork(w);
    setVersion(versionsInOrder(w)[0]?.id ?? "");
    setBook(booksOfWork(w)[0]?.id ?? "");
    setChapter(1);
    setFrom("1");
    setTo("1");
  };

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
        <h2 className="font-serif text-xl font-semibold text-ink">Good places to start</h2>
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => {
            const have = deck.cards.some((c) => sameVerses(c, s));
            return (
              <button
                key={s.label}
                type="button"
                className={btn}
                disabled={have}
                onClick={() => onAdd(makeCard({ work: s.work, version: s.version, book: s.book, chapter: s.chapter, from: s.from, to: s.to }, day))}
              >
                {have ? `${s.label} ✓` : `+ ${s.label}`}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
        <h2 className="font-serif text-xl font-semibold text-ink">Choose your own</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Text</span>
            <select className={field} value={work} onChange={(e) => pickWork(e.target.value)}>
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
            <select className={field} value={version} onChange={(e) => setVersion(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.abbr}: {v.name}
                </option>
              ))}
            </select>
          </label>
          {books.length > 1 && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">Book</span>
              <select
                className={field}
                value={book}
                onChange={(e) => {
                  setBook(e.target.value);
                  setChapter(1);
                  setFrom("1");
                  setTo("1");
                }}
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
              className={field}
              value={chapter}
              onChange={(e) => {
                setChapter(Number(e.target.value));
                setFrom("1");
                setTo("1");
              }}
            >
              {Array.from({ length: chapters }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">From verse</span>
            <select className={field} value={fromV} disabled={!list.length} onChange={(e) => {
                setFrom(e.target.value);
                setTo(e.target.value);
              }}>
              {list.map((v) => (
                <option key={v.v} value={v.v}>
                  {v.v}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">To verse (up to {MAX_RANGE})</span>
            <select className={field} value={toV} disabled={!list.length} onChange={(e) => setTo(e.target.value)}>
              {toChoices.map((v) => (
                <option key={v.v} value={v.v}>
                  {v.v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="rounded-xl bg-paper p-4">
          {ch.error ? (
            <p className="text-sm text-muted">{ch.error}</p>
          ) : !ch.verses ? (
            <p className="text-sm text-faint">Loading…</p>
          ) : (
            <ReadText verses={preview} lang={ver?.language ?? "en"} dir={ver?.dir ?? "ltr"} size="text-lg" />
          )}
        </div>
        <button type="button" className={btnOn} disabled={!preview.length || inDeck} onClick={() => onAdd(makeCard(draft, day))}>
          {inDeck ? "Already in your deck" : `Add ${fromV ? referenceOf(draft) : ""} to my deck`}
        </button>
      </section>
    </div>
  );
}

/* ---------------- the deck ---------------- */

function DeckList({
  deck,
  day,
  onPractice,
  onRemove,
  onImport,
}: {
  deck: Deck;
  day: string;
  onPractice: (id: string) => void;
  onRemove: (id: string) => void;
  onImport: (d: Deck) => string;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cards = [...deck.cards].sort((a, b) => (a.sched.due < b.sched.due ? -1 : a.sched.due > b.sched.due ? 1 : 0));

  const save = () => {
    try {
      const blob = new Blob([exportJson(deck)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memory-deck-${day}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setNote("Saved. Keep the file somewhere safe; you can load it here again on any device.");
    } catch {
      setNote("Couldn't save the file on this browser.");
    }
  };
  const load = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 2_000_000) {
      setNote("That file is too big to be a memory deck.");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = cleanDeck(JSON.parse(String(r.result)), day);
        setNote(d.cards.length ? onImport(d) : "No verses found in that file.");
      } catch {
        setNote("That file couldn't be read. Is it a memory deck saved from this page?");
      }
    };
    r.onerror = () => setNote("That file couldn't be read.");
    r.readAsText(f);
  };

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
        <h2 className="font-serif text-xl font-semibold text-ink">My deck</h2>
        {!cards.length && <p className="text-sm text-muted">No verses yet. Add one to begin.</p>}
        <ul className="divide-y divide-line">
          {cards.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">{referenceOf(c)}</p>
                <p className="text-xs text-muted">
                  {getVersion(c.version)?.abbr ?? c.version} ·{" "}
                  {c.missing ? "not available on the site right now (kept)" : isDue(c, day) ? "due today" : `next ${whenLabel(c.sched.due, day)}`}
                  {c.sched.reps > 0 && ` · ${c.sched.reps} in a row`}
                </p>
              </div>
              <div className="flex gap-2">
                {confirm === c.id ? (
                  <>
                    <button type="button" className={btn} onClick={() => {
                        onRemove(c.id);
                        setConfirm(null);
                      }}>
                      Remove
                    </button>
                    <button type="button" className={btn} onClick={() => setConfirm(null)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className={btn} disabled={c.missing} onClick={() => onPractice(c.id)}>
                      Practice
                    </button>
                    <button type="button" className={btn} onClick={() => setConfirm(c.id)} aria-label={`Remove ${referenceOf(c)}`}>
                      ✕
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
        <h2 className="font-serif text-xl font-semibold text-ink">Keep it safe</h2>
        <p className="text-sm text-muted">Your deck lives only in this browser. Save it as a small file now and then, and load it here to bring it back.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={save} disabled={!deck.cards.length}>
            Save deck to a file
          </button>
          <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
            Load a deck file
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={load} />
        </div>
        {note && <p className="text-sm text-ink">{note}</p>}
      </section>
    </div>
  );
}

/* ---------------- the page ---------------- */

type Tab = "practice" | "deck" | "add";

export function Memorize() {
  const [deck, setDeck] = useState<Deck>(EMPTY_DECK);
  const [day, setDay] = useState("");
  const [restored, setRestored] = useState(false);
  /** False when the saved deck couldn't be read: changes then stay on this page only. */
  const [canSave, setCanSave] = useState(true);
  const [tab, setTab] = useState<Tab>("practice");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("read");
  const [original, setOriginal] = useState(false);
  const [added, setAdded] = useState("");

  // The deck and preferences, after hydration.
  useEffect(() => {
    const d = today();
    let next = EMPTY_DECK;
    let prefs: { mode?: Mode; original?: boolean } = {};
    let ok = false;
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) next = cleanDeck(JSON.parse(raw), d);
      ok = true;
    } catch {
      /* (no storage here, or the saved deck can't be read: never save over it) */
    }
    try {
      const p = localStorage.getItem(PREFS);
      if (p) prefs = JSON.parse(p) as typeof prefs;
    } catch {
      /* (default preferences) */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring what was saved, once, after hydration
    setDay(d);
    setDeck(next);
    if (prefs.mode && MODES.some((m) => m.id === prefs.mode)) setMode(prefs.mode);
    if (typeof prefs.original === "boolean") setOriginal(prefs.original);
    if (!next.cards.length) setTab("add");
    setCanSave(ok);
    setRestored(true);
  }, []);

  // Saved only after a restore that worked, so a deck that couldn't be read is never written over.
  useEffect(() => {
    if (!restored || !canSave) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(deck));
      localStorage.setItem(PREFS, JSON.stringify({ mode, original }));
    } catch {
      /* (private mode: kept only while the page is open) */
    }
  }, [restored, canSave, deck, mode, original]);

  const due = useMemo(() => (day ? dueCards(deck.cards, day) : []), [deck.cards, day]);
  const streak = day ? streakOf(deck.days, day) : 0;
  const active = (activeId && deck.cards.find((c) => c.id === activeId && !c.missing)) || due[0] || null;

  const grade = (g: Grade) => {
    if (!active) return;
    const d = today();
    setDay(d);
    setDeck((prev) => ({
      cards: prev.cards.map((c) => (c.id === active.id ? { ...c, sched: review(c.sched, g, d) } : c)),
      days: markDay(prev.days, d),
    }));
    setActiveId(null);
  };
  const add = (c: Card) => {
    setDeck((prev) => (prev.cards.some((o) => o.id === c.id) ? prev : { ...prev, cards: [...prev.cards, c] }));
    setAdded(`${referenceOf(c)} is in your deck, ready to practice today.`);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "practice", label: due.length ? `Practice (${due.length})` : "Practice" },
    { id: "deck", label: `My deck (${deck.cards.length})` },
    { id: "add", label: "Add verses" },
  ];

  return (
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <Link href="/study-lab" className="text-xs text-accent hover:underline">
            ← Study lab
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Memorize</p>
          <h1 className="font-serif text-3xl font-semibold text-ink">Learn it by heart</h1>
          <p className="text-muted">
            Keep a few verses close. Read them, then lean on the first letters, let the words fade, and finally type them from memory. Each
            verse comes back when it&apos;s time, a little later each time you know it.
          </p>
        </header>

        {restored && !canSave && (
          <p className="rounded-xl bg-accent-soft p-3 text-sm text-ink">
            Your saved deck couldn&apos;t be read in this browser, so it is left untouched and changes made here won&apos;t be kept. If you
            have a deck file, you can still load it to practice.
          </p>
        )}

        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Due today", restored ? due.length : "·"],
            ["Verses", restored ? deck.cards.length : "·"],
            ["Day streak", restored ? streak : "·"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col-reverse rounded-2xl border border-line bg-panel p-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-serif text-2xl font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <nav role="tablist" aria-label="Sections" className="grid grid-cols-3 gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? btnOn : btn}
              onClick={() => {
                setTab(t.id);
                setAdded("");
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {!restored ? (
          <p className="text-sm text-faint">Loading…</p>
        ) : tab === "practice" ? (
          active ? (
            <Practice key={`${active.id}|${active.sched.last}|${active.sched.reps}|${active.sched.lapses}`} card={active} day={day} mode={mode} setMode={setMode} original={original} setOriginal={setOriginal} onGrade={grade} />
          ) : (
            <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
              <h2 className="font-serif text-xl font-semibold text-ink">{deck.cards.length ? "All done for today" : "Nothing to practice yet"}</h2>
              <p className="text-sm text-muted">
                {deck.cards.length
                  ? "Every verse is resting until its next day. You can still practice any of them from your deck."
                  : "Add a verse or two to begin."}
              </p>
              <button type="button" className={btn} onClick={() => setTab(deck.cards.length ? "deck" : "add")}>
                {deck.cards.length ? "Open my deck" : "Add verses"}
              </button>
            </section>
          )
        ) : tab === "deck" ? (
          <DeckList
            deck={deck}
            day={day}
            onPractice={(id) => {
              setActiveId(id);
              setTab("practice");
            }}
            onRemove={(id) => {
              setDeck((prev) => ({ ...prev, cards: prev.cards.filter((c) => c.id !== id) }));
              if (activeId === id) setActiveId(null);
            }}
            onImport={(d) => {
              const m = mergeDecks(deck, d);
              setDeck(m.deck);
              return `Loaded ${m.added} verse${m.added === 1 ? "" : "s"}${m.skipped ? `; ${m.skipped} ${m.skipped === 1 ? "was" : "were"} already here and kept as they were` : ""}.`;
            }}
          />
        ) : (
          <>
            {added && (
              <p className="rounded-xl bg-accent-soft p-3 text-sm text-ink">
                {added}{" "}
                <button type="button" className="font-medium text-accent underline" onClick={() => {
                    setTab("practice");
                    setAdded("");
                  }}>
                  Practice now
                </button>
              </p>
            )}
            <AddVerses deck={deck} day={day} onAdd={add} />
          </>
        )}

        <p className="text-xs text-faint">
          Your deck and practice days stay in this browser. The Hebrew is the Westminster Leningrad Codex; the Greek is the Septuagint and
          the Textus Receptus.
        </p>
      </div>
    </main>
  );
}
