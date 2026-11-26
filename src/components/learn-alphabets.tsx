"use client";
/**
 * Learn the alphabets (a hidden study page, reached from /study-lab): a short course in the Hebrew, Greek and Arabic
 * alphabets, five or six letters a lesson (name, sound, number value, the shapes that matter, one real word), a quick
 * quiz after each, and a last lesson that reads Genesis 1:1, John 1:1 or the Quran's first verse word by word.
 * Progress stays on this device (localStorage). The device voice may say Hebrew and Greek letter names and words; the
 * Quran's words are never spoken by a synthetic voice.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ALPHABETS, HEBREW_FINALS, type AlphaId, type Alphabet, type LessonLetter } from "@/lib/alphabet-lessons";
import { LAYER_VERSES } from "@/lib/layer-verses";
import { LAYER_GLOSSES } from "@/lib/layer-glosses";
import { valueOf, wordsOf } from "@/lib/letter-values";
import { lettersOf as namedLetters } from "@/lib/alphabets";

/* ---------------- progress (this device only) ---------------- */

type AlphaProgress = { done: number[]; best: Record<string, number> };
type Progress = Record<AlphaId, AlphaProgress>;
const KEY = "va-learn-alphabets-v1";
const empty = (): Progress => ({ hebrew: { done: [], best: {} }, greek: { done: [], best: {} }, arabic: { done: [], best: {} } });

function readProgress(): Progress {
  const out = empty();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Record<AlphaId, Partial<AlphaProgress>>>;
    for (const id of ["hebrew", "greek", "arabic"] as AlphaId[]) {
      const p = raw?.[id];
      if (!p) continue;
      if (Array.isArray(p.done)) out[id].done = p.done.filter((n): n is number => typeof n === "number");
      if (p.best && typeof p.best === "object") {
        for (const [k, v] of Object.entries(p.best)) if (typeof v === "number") out[id].best[k] = v;
      }
    }
  } catch {
    /* nothing saved yet, or storage blocked */
  }
  return out;
}
function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: progress lasts while the page is open */
  }
}

/* ---------------- small helpers ---------------- */

const FONT: Record<AlphaId, string> = {
  hebrew: "var(--font-hebrew), 'SBL Hebrew', 'Ezra SIL', serif",
  greek: "var(--font-greek), var(--font-serif), serif",
  arabic: "var(--font-arabic), 'Noto Naskh Arabic', serif",
};
const LANG_ATTR: Record<AlphaId, string> = { hebrew: "he", greek: "grc", arabic: "ar" };

function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/** One letter in the script's own type, sized and set the right way round. */
function Glyph({ a, text, className = "" }: { a: Alphabet; text: string; className?: string }) {
  return (
    <span dir={a.rtl ? "rtl" : "ltr"} lang={LANG_ATTR[a.id]} style={{ fontFamily: FONT[a.id] }} className={className}>
      {text}
    </span>
  );
}

/* ---------------- the device voice (Hebrew and Greek only) ---------------- */

const VOICE_LANG: Partial<Record<AlphaId, string>> = { hebrew: "he", greek: "el" };
const voiceFor = (lang: string) => {
  try {
    return window.speechSynthesis?.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null;
  } catch {
    return null;
  }
};
/** Says a Hebrew or Greek word with the device's voice, if it has one. Never used for Arabic (the Quran). */
function sayIt(text: string, id: AlphaId): boolean {
  const lang = VOICE_LANG[id];
  if (!lang || id === "arabic") return false;
  const voice = voiceFor(lang);
  if (!voice || typeof SpeechSynthesisUtterance === "undefined") return false;
  try {
    window.speechSynthesis.cancel();
    // Hebrew is spoken from its bare letters (voices read plain Hebrew best; what is shown is unchanged)
    const u = new SpeechSynthesisUtterance(id === "hebrew" ? text.replace(/־/g, " ").replace(/[֑-ׇ]/g, "") : text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.8;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

function SayButton({ a, text, label, onNoVoice }: { a: Alphabet; text: string; label: string; onNoVoice: () => void }) {
  if (!a.voice) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (!sayIt(text, a.id)) onNoVoice();
      }}
      className="min-h-9 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-raised"
    >
      🔊 {label}
    </button>
  );
}

function NoVoiceNote({ a, show }: { a: Alphabet; show: boolean }) {
  if (!show) return null;
  return (
    <p className="text-xs text-faint" aria-live="polite">
      This device has no {a.title} voice. On a phone, you can add one in the system&rsquo;s text-to-speech settings.
    </p>
  );
}

/* ---------------- progress bar ---------------- */

function Bar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums">
          {done} of {total}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------------- a letter in its lesson ---------------- */

/** A word split into letters with their marks, so the letter being learned can be lit (Hebrew and Greek only: in
 * Arabic a split would break the joined shapes, so the word is shown whole). */
function ExampleWord({ a, l }: { a: Alphabet; l: LessonLetter }) {
  const w = l.word;
  if (a.id === "arabic") return <Glyph a={a} text={w.text} className="text-4xl leading-loose text-ink" />;
  const clusters: string[] = [];
  for (const c of w.text) {
    if (/\p{M}/u.test(c) && clusters.length) clusters[clusters.length - 1] += c;
    else clusters.push(c);
  }
  const isIt = (cl: string) => {
    const base = a.id === "greek" ? cl.normalize("NFD").toLowerCase()[0] : cl[0];
    if (base === l.ch) return true;
    if (a.id === "hebrew" && HEBREW_FINALS[base] === l.ch) return true;
    return a.id === "greek" && l.ch === "σ" && base === "ς";
  };
  return (
    <span dir={a.rtl ? "rtl" : "ltr"} lang={LANG_ATTR[a.id]} style={{ fontFamily: FONT[a.id] }} className="text-4xl leading-loose text-ink">
      {clusters.map((cl, i) => (
        <span key={i} className={isIt(cl) ? "text-accent" : undefined}>
          {cl}
        </span>
      ))}
    </span>
  );
}

function LetterCard({ a, l, onNoVoice }: { a: Alphabet; l: LessonLetter; onNoVoice: () => void }) {
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center gap-5">
        <Glyph a={a} text={l.ch} className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-raised text-7xl leading-none text-ink" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-serif text-2xl font-semibold text-ink">{l.name}</p>
          <p className="text-ink">
            <span className="text-faint">Sound: </span>
            {l.sound}
          </p>
          <p className="text-ink">
            <span className="text-faint">Number: </span>
            <span className="tabular-nums">{l.value}</span>
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {l.voiceName && <SayButton a={a} text={l.voiceName} label="Say the name" onNoVoice={onNoVoice} />}
          </div>
        </div>
      </div>
      {l.forms && l.forms.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-faint">{a.id === "arabic" ? "Its shapes in a word" : "Other forms"}</p>
          <ul className="mt-2 flex flex-wrap gap-2" dir={a.rtl ? "rtl" : "ltr"}>
            {l.forms.map((f) => (
              <li key={f.label} className="flex min-w-16 flex-col items-center rounded-lg border border-line bg-raised px-3 py-2">
                <Glyph a={a} text={f.ch} className="text-3xl leading-normal text-ink" />
                <span dir="ltr" className="text-xs text-muted">
                  {f.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {l.note && <p className="text-sm text-muted">{l.note}</p>}
      <div className="rounded-xl bg-raised p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-faint">In a real word · {l.word.ref}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <ExampleWord a={a} l={l} />
          <span>
            <span className="italic text-ink">{l.word.say}</span> <span className="text-muted">· {l.word.means}</span>
          </span>
        </div>
        <div className="mt-2">
          <SayButton a={a} text={l.word.text} label="Say the word" onNoVoice={onNoVoice} />
        </div>
      </div>
    </div>
  );
}

function LessonView({ a, i, onQuiz, onBack }: { a: Alphabet; i: number; onQuiz: () => void; onBack: () => void }) {
  const letters = a.lessons[i];
  const [step, setStep] = useState(0);
  const [noVoice, setNoVoice] = useState(false);
  const l = letters[step];
  const last = step === letters.length - 1;
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-ink">
          ← All lessons
        </button>
        <span className="text-sm text-faint">
          Lesson {i + 1} of {a.lessons.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2" dir={a.rtl ? "rtl" : "ltr"} role="group" aria-label="Letters in this lesson">
        {letters.map((x, j) => (
          <button
            key={x.ch}
            type="button"
            onClick={() => setStep(j)}
            aria-pressed={j === step}
            aria-label={x.name}
            className={`flex h-11 w-11 items-center justify-center rounded-lg border text-2xl ${j === step ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:bg-raised"}`}
            style={{ fontFamily: FONT[a.id] }}
          >
            {x.ch}
          </button>
        ))}
      </div>
      <LetterCard a={a} l={l} onNoVoice={() => setNoVoice(true)} />
      <NoVoiceNote a={a} show={noVoice} />
      <div className="flex flex-wrap justify-between gap-2">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
          className="min-h-10 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-raised disabled:opacity-40"
        >
          Previous
        </button>
        {last ? (
          <button type="button" onClick={onQuiz} className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">
            Take the quiz
          </button>
        ) : (
          <button type="button" onClick={() => setStep(step + 1)} className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">
            Next letter
          </button>
        )}
      </div>
    </section>
  );
}

/* ---------------- the quiz ---------------- */

type Kind = "sound" | "letter" | "value";
type Option = { label: string; glyph: boolean; correct: boolean };
type Question = { kind: Kind; letter: LessonLetter; options: Option[] };

const shares = (x: LessonLetter, y: LessonLetter) => x.tokens.some((t) => y.tokens.includes(t));

/** Five questions on the lesson's letters, mixed kinds; wrong answers from the lesson first, then the alphabet. */
function makeQuiz(a: Alphabet, i: number): Question[] {
  const lesson = a.lessons[i];
  const all = a.lessons.flat();
  const picks = shuffle(lesson).slice(0, 5);
  const kinds = shuffle<Kind>(["sound", "letter", "value", "sound", "letter"]);
  return picks.map((letter, n) => {
    const kind = kinds[n];
    const pool = shuffle(lesson.filter((x) => x !== letter)).concat(shuffle(all.filter((x) => !lesson.includes(x))));
    const wrong: LessonLetter[] = [];
    for (const x of pool) {
      if (wrong.length === 3) break;
      if (kind !== "value" && shares(x, letter)) continue;
      if (kind === "sound" && wrong.some((w) => w.say === x.say)) continue;
      if (kind === "value" && (x.value === letter.value || wrong.some((w) => w.value === x.value))) continue;
      wrong.push(x);
    }
    const label = (x: LessonLetter) => (kind === "sound" ? x.say : kind === "letter" ? x.ch : String(x.value));
    const options = shuffle([letter, ...wrong]).map((x) => ({ label: label(x), glyph: kind === "letter", correct: x === letter }));
    return { kind, letter, options };
  });
}

function QuizView({ a, i, onDone, onBack, onNext }: { a: Alphabet; i: number; onDone: (score: number) => void; onBack: () => void; onNext: (() => void) | null }) {
  const [qs, setQs] = useState<Question[]>(() => makeQuiz(a, i));
  const [n, setN] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const restart = () => {
    setQs(makeQuiz(a, i));
    setN(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <section className="space-y-4 rounded-2xl border border-line bg-panel p-5 text-center">
        <p className="font-serif text-3xl font-semibold text-ink">
          {score} of {qs.length}
        </p>
        <p className="text-muted">{score === qs.length ? "Every one right. Well done!" : score >= 3 ? "Good work. Try again any time to beat your score." : "A good start. Look over the letters once more and try again."}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={restart} className="min-h-10 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-raised">
            Try again
          </button>
          <button type="button" onClick={onBack} className="min-h-10 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-raised">
            All lessons
          </button>
          {onNext && (
            <button type="button" onClick={onNext} className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">
              Next lesson
            </button>
          )}
        </div>
      </section>
    );
  }

  const q = qs[n];
  const choose = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    if (q.options[k].correct) setScore(score + 1);
  };
  const next = () => {
    if (n + 1 < qs.length) {
      setN(n + 1);
      setPicked(null);
    } else {
      setFinished(true);
      onDone(score);
    }
  };
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-ink">
          ← All lessons
        </button>
        <span className="text-sm text-faint">
          Lesson {i + 1} quiz · question {n + 1} of {qs.length}
        </span>
      </div>
      <div className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        {q.kind === "letter" ? (
          <p className="text-lg text-ink">
            Which letter says <span className="font-semibold">{q.letter.say}</span>?
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <Glyph a={a} text={q.letter.ch} className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-raised text-5xl leading-none text-ink" />
            <p className="text-lg text-ink">{q.kind === "sound" ? "What sound does this letter make?" : "What number is this letter worth?"}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {q.options.map((o, k) => {
            const state = picked === null ? "" : o.correct ? "border-accent bg-accent-soft text-ink" : picked === k ? "border-line bg-raised text-faint line-through" : "border-line text-faint";
            return (
              <button
                key={k}
                type="button"
                onClick={() => choose(k)}
                disabled={picked !== null}
                className={`min-h-14 rounded-xl border px-3 py-2 text-ink ${state || "border-line hover:bg-raised"}`}
              >
                {o.glyph ? <Glyph a={a} text={o.label} className="text-4xl leading-normal" /> : <span className="text-lg">{o.label}</span>}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <div aria-live="polite" className="space-y-3">
            <p className={q.options[picked].correct ? "font-medium text-accent" : "text-ink"}>
              {q.options[picked].correct ? "Right!" : "Not quite."}{" "}
              <span className="text-muted">
                <Glyph a={a} text={q.letter.ch} className="text-xl text-ink" /> is {q.letter.name}: it says {q.letter.say} and is worth {q.letter.value}.
              </span>
            </p>
            <button type="button" onClick={next} className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">
              {n + 1 < qs.length ? "Next question" : "See my score"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- marks ---------------- */

function MarksView({ a, onBack }: { a: Alphabet; onBack: () => void }) {
  return (
    <section className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-muted hover:text-ink">
        ← All lessons
      </button>
      <div className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-serif text-2xl font-semibold text-ink">{a.marksTitle}</h2>
        <p className="text-muted">{a.marksIntro}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {a.marks.map((m) => (
            <li key={m.name} className="flex items-center gap-3 rounded-xl bg-raised p-3">
              <Glyph a={a} text={m.sample} className="w-14 shrink-0 text-center text-4xl leading-loose text-ink" />
              <span>
                <span className="font-medium text-ink">{m.name}</span>
                <span className="block text-sm text-muted">{m.says}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">{a.marksNote}</p>
      </div>
    </section>
  );
}

/* ---------------- the last lesson: reading the verse ---------------- */

/** Where each letter was taught, so the reading can point back to it. */
function lessonIndex(a: Alphabet): Map<string, number> {
  const m = new Map<string, number>();
  a.lessons.forEach((ls, i) => ls.forEach((l) => m.set(l.ch, i)));
  if (a.id === "hebrew") for (const [fin, base] of Object.entries(HEBREW_FINALS)) m.set(fin, m.get(base) ?? 0);
  if (a.id === "greek") m.set("ς", m.get("σ") ?? 0);
  if (a.id === "arabic") for (const c of ["أ", "إ", "آ", "ٱ"]) m.set(c, m.get("ا") ?? 0);
  return m;
}
const letterValue = (ch: string, id: AlphaId) => valueOf(ch, id) || valueOf(ch + ch, id) / 2; // (a lone פ or ס reads as a paragraph mark)

function ReadView({ a, opened, onOpen, onBack }: { a: Alphabet; opened: number[]; onOpen: (k: number) => void; onBack: () => void }) {
  const verse = LAYER_VERSES.find((v) => v.id === a.verseId)!;
  const words = useMemo(() => wordsOf(verse.text, a.id), [verse.text, a.id]);
  const glosses = LAYER_GLOSSES[a.verseId] ?? [];
  const taught = useMemo(() => lessonIndex(a), [a]);
  const [sel, setSel] = useState<number | null>(null);
  const [noVoice, setNoVoice] = useState(false);
  const w = sel === null ? null : words[sel];
  const g = sel === null ? null : glosses[sel];
  const letters = w ? namedLetters(w.text, a.lang) ?? [] : [];
  return (
    <section className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-muted hover:text-ink">
        ← All lessons
      </button>
      <div className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-serif text-2xl font-semibold text-ink">Read {verse.ref} yourself</h2>
        <p className="text-sm text-muted">
          Here is the verse exactly as written ({verse.lang}). Tap each word to take it apart into the letters you have learned.
          {a.rtl && " It reads from right to left."}
        </p>
        <p dir={a.rtl ? "rtl" : "ltr"} lang={LANG_ATTR[a.id]} style={{ fontFamily: FONT[a.id] }} className="text-3xl leading-loose text-ink">
          {verse.text}
        </p>
        <ul dir={a.rtl ? "rtl" : "ltr"} className="flex flex-wrap gap-2">
          {words.map((x, k) => (
            <li key={k}>
              <button
                type="button"
                aria-pressed={sel === k}
                onClick={() => {
                  setSel(k);
                  onOpen(k);
                }}
                className={`min-h-12 rounded-xl border px-3 ${sel === k ? "border-accent bg-accent-soft" : opened.includes(k) ? "border-line bg-raised" : "border-line hover:bg-raised"}`}
              >
                <Glyph a={a} text={x.text} className="text-2xl leading-loose text-ink" />
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-faint">
          {opened.length >= words.length ? "You have opened every word. This lesson is done." : `Words opened: ${opened.length} of ${words.length}`}
        </p>
        {w && (
          <div className="space-y-3 rounded-xl bg-raised p-4" aria-live="polite">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Glyph a={a} text={w.text} className="text-4xl leading-loose text-ink" />
              {g && (
                <span>
                  <span className="italic text-ink">{g.say}</span> <span className="text-muted">· {g.means}</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SayButton a={a} text={w.text} label="Say the word" onNoVoice={() => setNoVoice(true)} />
              {a.id === "arabic" && (
                <a href="https://quran.com/1/1" target="_blank" rel="noopener" className="text-xs font-medium text-accent hover:underline">
                  Hear the verse recited at Quran.com ↗
                </a>
              )}
            </div>
            <NoVoiceNote a={a} show={noVoice} />
            <ol className="space-y-1">
              {letters.map((x, k) => {
                const base = a.id === "greek" ? x.base.normalize("NFD").toLowerCase()[0] : x.base;
                const lesson = taught.get(base);
                return (
                  <li key={k} className="flex items-start gap-3 border-t border-line pt-2">
                    <Glyph a={a} text={x.char} className="w-12 shrink-0 text-center text-3xl leading-loose text-ink" />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-ink">{x.name || "a mark"}</span>
                      {lesson !== undefined && <span className="text-faint"> · lesson {lesson + 1}</span>}
                      <span className="block text-muted">{x.sound}</span>
                      {x.marks.length > 0 && <span className="block text-xs text-faint">with {x.marks.map((m) => `${m.name} (${m.says})`).join("; ")}</span>}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">{letterValue(x.char, a.id) || ""}</span>
                  </li>
                );
              })}
            </ol>
            <p className="text-right text-sm text-muted">
              The word&rsquo;s letters add up to <span className="font-medium tabular-nums text-ink">{w.value}</span>
            </p>
          </div>
        )}
        <p className="text-sm text-muted">
          <span className="text-faint">In English, word by word: </span>
          {glosses.map((x) => x.means).join(" · ")}
        </p>
      </div>
    </section>
  );
}

/* ---------------- the page ---------------- */

type View = { kind: "home" } | { kind: "lesson"; i: number } | { kind: "quiz"; i: number } | { kind: "marks" } | { kind: "read" };

export function LearnAlphabets() {
  const [alphaId, setAlphaId] = useState<AlphaId>("hebrew");
  const [view, setView] = useState<View>({ kind: "home" });
  const [progress, setProgress] = useState<Progress>(empty);
  const [opened, setOpened] = useState<Record<AlphaId, number[]>>({ hebrew: [], greek: [], arabic: [] });
  const mainRef = useRef<HTMLElement>(null);
  const a = ALPHABETS.find((x) => x.id === alphaId)!;
  const p = progress[alphaId];
  const total = a.lessons.length + 1; // the letter lessons and the reading
  const readIndex = a.lessons.length;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's record is only readable after hydration
    setProgress(readProgress());
  }, []);
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [view, alphaId]);

  const update = (fn: (ap: AlphaProgress) => AlphaProgress) => {
    setProgress((prev) => {
      const next = { ...prev, [alphaId]: fn(prev[alphaId]) };
      saveProgress(next);
      return next;
    });
  };
  const markDone = (i: number, score?: number) =>
    update((ap) => {
      const done = ap.done.includes(i) ? ap.done : ap.done.concat(i).sort((x, y) => x - y);
      const best = { ...ap.best };
      if (score !== undefined && (best[i] === undefined || score > best[i])) best[i] = score;
      return { done, best };
    });

  const openWord = (k: number) => {
    const list = opened[alphaId].includes(k) ? opened[alphaId] : opened[alphaId].concat(k);
    setOpened({ ...opened, [alphaId]: list });
    const verse = LAYER_VERSES.find((v) => v.id === a.verseId)!;
    if (list.length >= wordsOf(verse.text, a.id).length) markDone(readIndex);
  };

  const verse = LAYER_VERSES.find((v) => v.id === a.verseId)!;
  const home = () => setView({ kind: "home" });

  return (
    <main ref={mainRef} className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <Link href="/study-lab" className="text-xs text-muted hover:text-accent">
            ← Study lab
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">א · α · ا</p>
          <h1 className="font-serif text-3xl font-semibold text-ink">Learn the alphabets</h1>
          <p className="text-muted">
            A short course in the Hebrew, Greek and Arabic alphabets: a few letters at a time, a quick quiz after each lesson, and at the end you read the first verse of Genesis, of John or of the Quran yourself.
          </p>
        </header>

        <div role="group" aria-label="Alphabet" className="grid grid-cols-3 gap-2">
          {ALPHABETS.map((x) => {
            const n = progress[x.id].done.length;
            const t = x.lessons.length + 1;
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={x.id === alphaId}
                onClick={() => {
                  setAlphaId(x.id);
                  setView({ kind: "home" });
                }}
                className={`rounded-xl border p-3 text-left ${x.id === alphaId ? "border-accent bg-accent-soft" : "border-line bg-panel hover:bg-raised"}`}
              >
                <Glyph a={x} text={x.badge} className="block text-2xl leading-normal text-ink" />
                <span className="block text-sm font-medium text-ink">{x.title}</span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-raised">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round((n / t) * 100)}%` }} />
                </span>
              </button>
            );
          })}
        </div>

        {view.kind === "home" && (
          <section className="space-y-4">
            <div className="space-y-3 rounded-2xl border border-line bg-panel p-5">
              <h2 className="font-serif text-2xl font-semibold text-ink">{a.title}</h2>
              <p className="text-ink">{a.intro}</p>
              <Bar done={p.done.length} total={total} label="Your progress" />
              <p className="text-xs text-faint">{a.soundNote}</p>
            </div>
            <ol className="space-y-2">
              {a.lessons.map((ls, i) => {
                const done = p.done.includes(i);
                const best = p.best[i];
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setView({ kind: "lesson", i })}
                      className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel p-3 text-left hover:bg-raised"
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-accent text-accent-ink" : "bg-raised text-muted"}`}>
                        {done ? "✓" : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">Lesson {i + 1}</span>
                        <Glyph a={a} text={ls.map((l) => l.ch).join(" ")} className="block text-2xl leading-normal text-ink" />
                      </span>
                      {best !== undefined && (
                        <span className="shrink-0 text-xs tabular-nums text-muted">
                          best {best}/5
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              <li>
                <button type="button" onClick={() => setView({ kind: "marks" })} className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel p-3 text-left hover:bg-raised">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-sm text-muted">✎</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{a.marksTitle}</span>
                    <span className="block text-xs text-muted">A short note to read before the verse</span>
                  </span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setView({ kind: "read" })} className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel p-3 text-left hover:bg-raised">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${p.done.includes(readIndex) ? "bg-accent text-accent-ink" : "bg-raised text-muted"}`}>
                    {p.done.includes(readIndex) ? "✓" : "★"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">Last lesson: read {verse.ref}</span>
                    <span className="block text-xs text-muted">Word by word, with the letters you have learned</span>
                  </span>
                </button>
              </li>
            </ol>
            <div className="space-y-2 text-sm text-muted">
              <p>
                <span className="font-medium text-ink">Letters as numbers. </span>
                {a.numberNote}
              </p>
              <p>
                <span className="font-medium text-ink">Shapes. </span>
                {a.formsNote}
              </p>
            </div>
          </section>
        )}

        {view.kind === "lesson" && (
          <LessonView key={`${alphaId}-${view.i}`} a={a} i={view.i} onBack={home} onQuiz={() => setView({ kind: "quiz", i: view.i })} />
        )}
        {view.kind === "quiz" && (
          <QuizView
            key={`${alphaId}-${view.i}`}
            a={a}
            i={view.i}
            onBack={home}
            onDone={(score) => markDone(view.i, score)}
            onNext={view.i + 1 < a.lessons.length ? () => setView({ kind: "lesson", i: view.i + 1 }) : () => setView({ kind: "marks" })}
          />
        )}
        {view.kind === "marks" && <MarksView a={a} onBack={home} />}
        {view.kind === "read" && <ReadView key={alphaId} a={a} opened={opened[alphaId]} onOpen={openWord} onBack={home} />}

        <footer className="space-y-1 border-t border-line pt-4 text-xs text-faint">
          <p>
            Progress is kept only on this device. Sounds are a learner&rsquo;s guide, not a full pronunciation course. Number values follow the
            traditional counts (gematria, isopsephy, abjad).
          </p>
          <p>
            Texts shown exactly as written: Hebrew from the Westminster Leningrad Codex; Greek from the Textus Receptus; Arabic from the Tanzil Project (
            <a href="https://tanzil.net" target="_blank" rel="noopener" className="underline">
              tanzil.net
            </a>
            ), CC BY 3.0. Hebrew and Greek words&rsquo; sounds and meanings: STEP Bible (Tyndale House, Cambridge), CC BY 4.0. The scripture text is never
            changed, and the Quran&rsquo;s words are never spoken by a device voice.
          </p>
        </footer>
      </div>
    </main>
  );
}
