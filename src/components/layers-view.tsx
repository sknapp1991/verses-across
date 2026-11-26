"use client";
/**
 * The hidden layer (hub c74b9402). Three opening verses (Genesis 1:1 in Hebrew, John 1:1 in Greek, the Quran's first
 * verse in Arabic) shown exactly as written, with each counted letter as a bead on a strand, coloured by its size
 * (ones, tens, hundreds, thousands), and played as a short melody: a letter's first digit picks the note, its size the
 * octave. Then puzzles, solved only from the verses themselves; what you've solved is kept on this device.
 * Art and puzzle, built on the real traditions (gematria, isopsephy, abjad): never offered as hidden prophecy.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LAYER_VERSES } from "@/lib/layer-verses";
import { lettersOf, valueOf, wordsOf, type Letter, type Script } from "@/lib/letter-values";
import { LAYER_GLOSSES } from "@/lib/layer-glosses";

const SIZE_COLOUR = ["#f59e0b", "#60a5fa", "#c084fc", "#f472b6"]; // ones, tens, hundreds, thousands
const sizeOf = (v: number) => (v >= 1000 ? 3 : v >= 100 ? 2 : v >= 10 ? 1 : 0);
const firstDigit = (v: number) => Number(String(v)[0]);
const SYSTEM: Record<Script, { name: string; how: string }> = {
  hebrew: { name: "Gematria", how: "Hebrew letters count 1–9, then 10–90, then 100–400 (aleph 1, bet 2 … tav 400); a final letter counts as its usual form." },
  greek: { name: "Isopsephy", how: "Greek letters count 1–9, 10–90, 100–800 (alpha 1 … omega 800), with the old numerals stigma (6), koppa (90) and sampi (900); an iota written under a letter counts as an iota." },
  arabic: { name: "Abjad", how: "Arabic letters in the old abjad order count 1–9, 10–90, 100–1000 (alif 1 … ghayn 1000); vowel marks and the small alif are not counted." },
};

/* ---------------- sound ---------------- */

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19]; // first digits 1–9 on a pentatonic ladder
const BASE = [523.25, 261.63, 130.81, 65.41]; // ones high … thousands low (C5, C4, C3, C2)
type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };

let stopPlaying: (() => void) | null = null; // (one strand plays at a time)

function playStrand(letters: Letter[], onStep: (i: number) => void): () => void {
  stopPlaying?.();
  const Ctx = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  void ctx.resume?.();
  const out = ctx.createGain();
  out.gain.value = 0.18;
  out.connect(ctx.destination);
  let t = ctx.currentTime + 0.05;
  const timers: ReturnType<typeof setTimeout>[] = [];
  letters.forEach((l, i) => {
    if (i > 0 && letters[i - 1].word !== l.word) t += 0.14; // a breath between words
    const f = BASE[sizeOf(l.value)] * Math.pow(2, SCALE[firstDigit(l.value) - 1] / 12);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.34);
    timers.push(setTimeout(() => onStep(i), (t - ctx.currentTime) * 1000));
    t += 0.17;
  });
  let closed = false;
  const stop = () => {
    if (closed) return;
    closed = true;
    timers.forEach(clearTimeout);
    onStep(-1);
    void ctx.close(); // (Safari allows only a few open audio contexts)
    if (stopPlaying === stop) stopPlaying = null;
  };
  timers.push(setTimeout(stop, (t - ctx.currentTime) * 1000 + 300));
  stopPlaying = stop;
  return stop;
}

/* ---------------- saying a word ---------------- */

const VOICE_LANG: Partial<Record<Script, string>> = { hebrew: "he", greek: "el" };
/** The device's voice for a language, if it has one (they load late on some browsers: asked each time). */
const voiceFor = (lang: string) => {
  try {
    return window.speechSynthesis?.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null;
  } catch {
    return null;
  }
};
function sayWord(text: string, script: Script): boolean {
  const lang = VOICE_LANG[script];
  const voice = lang ? voiceFor(lang) : null;
  if (!lang || !voice || typeof SpeechSynthesisUtterance === "undefined") return false;
  stopPlaying?.();
  window.speechSynthesis.cancel();
  // the cantillation (chanting) marks would trip the voice: dropped for speaking only (the shown text is unchanged)
  const u = new SpeechSynthesisUtterance(script === "hebrew" ? text.replace(/[֑-ֽ֯׀׃]/g, "") : text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.8;
  window.speechSynthesis.speak(u);
  return true;
}

/* ---------------- the strand ---------------- */

function Strand({ letters, rtl, lit, word }: { letters: Letter[]; rtl: boolean; lit: number; word: number | null }) {
  const step = 14;
  const w = Math.max(240, letters.length * step + 24);
  const h = 96;
  const x = (i: number) => (rtl ? w - 12 - i * step : 12 + i * step);
  const y = (i: number, phase: number) => h / 2 + Math.sin(i * 0.55 + phase) * 26;
  return (
    <div className="overflow-x-auto" dir={rtl ? "rtl" : "ltr"}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${letters.length} letters as a strand`}>
        {letters.map((_, i) => (
          <line key={`r${i}`} x1={x(i)} x2={x(i)} y1={y(i, 0)} y2={y(i, Math.PI)} stroke="var(--line)" strokeWidth={1} />
        ))}
        {letters.map((_, i) => (
          <circle key={`m${i}`} cx={x(i)} cy={y(i, Math.PI)} r={2.2} fill="var(--faint)" />
        ))}
        {letters.map((l, i) => (
          <circle
            key={`b${i}`}
            cx={x(i)}
            cy={y(i, 0)}
            r={(lit === i ? 2.5 : 0) + (word === l.word ? 1.5 : 0) + 3 + sizeOf(l.value) * 1.4}
            fill={SIZE_COLOUR[sizeOf(l.value)]}
            stroke={word === l.word ? "var(--ink)" : "none"}
            strokeWidth={1.5}
            opacity={lit >= 0 ? (lit === i ? 1 : 0.45) : word === null || word === l.word ? 1 : 0.25}
          >
            <title>
              {l.ch} = {l.value}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function VerseCard({ v }: { v: (typeof LAYER_VERSES)[number] }) {
  const script = v.script as Script;
  const letters = useMemo(() => lettersOf(v.text, script), [v.text, script]);
  const words = useMemo(() => wordsOf(v.text, script), [v.text, script]);
  const total = useMemo(() => valueOf(v.text, script), [v.text, script]);
  const [lit, setLit] = useState(-1);
  const [word, setWord] = useState<number | null>(null); // a word picked from the list (hub c74b9402, his second ask)
  const stop = useRef<(() => void) | null>(null);
  const playing = word === null ? letters : letters.filter((l) => l.word === word);
  const gloss = word !== null ? LAYER_GLOSSES[v.id]?.[word] : undefined;
  const [noVoice, setNoVoice] = useState(false);
  useEffect(() => () => stop.current?.(), []);
  const rtl = script !== "greek";
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold text-ink">{v.ref}</h2>
        <span className="text-xs text-faint">
          {v.lang} · {SYSTEM[script].name}
        </span>
      </div>
      <p dir={rtl ? "rtl" : "ltr"} lang={script === "hebrew" ? "he" : script === "greek" ? "grc" : "ar"} className="font-serif text-2xl leading-relaxed text-ink">
        {v.text}
      </p>
      <Strand letters={letters} rtl={rtl} lit={lit < 0 ? -1 : letters.indexOf(playing[lit])} word={word} />
      <div className="flex flex-wrap items-center gap-2">
        {script === "arabic" ? (
          <span className="text-xs text-faint">No tones for the Quran: many Muslims hold that its words shouldn&rsquo;t be set to music.</span>
        ) : (
        <button
          type="button"
          onClick={() => {
            if (stop.current) {
              stop.current();
              stop.current = null;
              return;
            }
            stop.current = playStrand(playing, (i) => {
              setLit(i);
              if (i === -1) stop.current = null;
            });
          }}
          className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink"
        >
          {lit >= 0 ? "■ Stop" : word === null ? "▶ Play its letters as tones" : "▶ Play this word"}
        </button>
        )}
        <span className="text-sm text-muted">
          {letters.length} letters · {words.length} words · total <strong className="tabular-nums text-ink">{total.toLocaleString("en-US")}</strong>
        </span>
      </div>
      <details className="text-sm text-muted">
        <summary className="cursor-pointer">Each word&rsquo;s value</summary>
        <p className="mt-2 text-xs text-faint">Tap a word to see it on the strand, letter by letter{script === "arabic" ? "" : ", and to play it alone"}.</p>
        <ul dir={rtl ? "rtl" : "ltr"} className="mt-2 flex flex-wrap gap-2">
          {words.map((w, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  stop.current?.();
                  setNoVoice(false);
                  setWord(word === i ? null : i);
                }}
                aria-pressed={word === i}
                className={`min-h-9 rounded-lg border px-2 py-1 ${word === i ? "border-accent bg-accent-soft" : "border-line hover:bg-raised"}`}
              >
                <span className="font-serif text-base text-ink">{w.text}</span> <span className="tabular-nums text-faint">{w.value}</span>
              </button>
            </li>
          ))}
        </ul>
        {word !== null && (
          <p dir={rtl ? "rtl" : "ltr"} aria-live="polite" className="mt-2 rounded-lg bg-raised px-3 py-2 font-serif text-base text-ink">
            {letters
              .filter((l) => l.word === word)
              .map((l, i) => (
                <span key={i} className="whitespace-nowrap">
                  {i > 0 && <span className="text-faint"> + </span>}
                  {l.ch} <span className="text-sm tabular-nums" style={{ color: SIZE_COLOUR[sizeOf(l.value)] }}>{l.value}</span>
                </span>
              ))}
            <span className="text-faint"> = </span>
            <strong className="tabular-nums">{words[word]?.value}</strong>
          </p>
        )}
        {/* the study layer: how it sounds and what it means, and the word said aloud (my brother's third ask) */}
        {word !== null && gloss && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
            <p className="text-sm">
              <span className="font-serif text-base text-ink">{words[word]?.text}</span> <span className="italic text-ink">{gloss.say}</span>{" "}
              <span className="text-muted">· {gloss.means}</span>
            </p>
            {script === "arabic" ? (
              <a href="https://quran.com/1/1" target="_blank" rel="noopener" className="text-xs font-medium text-accent hover:underline">
                Hear it recited ↗
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setNoVoice(!sayWord(words[word]?.text ?? "", script))}
                className="min-h-9 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-raised"
              >
                🔊 Say it
              </button>
            )}
            {noVoice && <p className="w-full text-xs text-faint">This device has no {script === "hebrew" ? "Hebrew" : "Greek"} voice installed, so it can&rsquo;t say it.</p>}
            {script !== "arabic" && <p className="w-full text-[11px] text-faint">Said by your device&rsquo;s voice, in today&rsquo;s {script === "hebrew" ? "Hebrew" : "Greek"} pronunciation.</p>}
          </div>
        )}
        <p className="mt-2 text-xs">{SYSTEM[script].how}</p>
      </details>
      <Link href={v.href} className="text-xs text-accent hover:underline">
        Read it in context →
      </Link>
    </section>
  );
}

/* ---------------- puzzles ---------------- */

const SOLVED_KEY = "va-layers:v1";
type Puzzle = { id: string; ask: string; hint: string; check: (a: string) => boolean; after: string };
const PUZZLES: Puzzle[] = [
  {
    id: "86",
    ask: "In Genesis 1:1, one word adds up to 86. Which word is it? (Type it in English.)",
    hint: "It's the third word: the one who creates.",
    check: (a) => /^(god|elohim|elohiym)$/i.test(a.trim()),
    after: "Elohim: aleph 1 + lamed 30 + he 5 + yod 10 + mem 40 = 86.",
  },
  {
    id: "373",
    ask: "John 1:1 says one word three times. What is that word's value?",
    hint: "The Word: lambda, omicron, gamma, omicron, sigma.",
    check: (a) => a.trim() === "373",
    after: "Logos: 30 + 70 + 3 + 70 + 200 = 373, said three times in one verse.",
  },
  {
    id: "786",
    ask: "What is the value of the whole first verse of the Quran?",
    hint: "Add its 19 counted letters (the small alif isn't counted).",
    check: (a) => a.trim() === "786",
    after: "786: a number some Muslims, mainly in South Asia, write in place of the Bismillah.",
  },
  {
    id: "73",
    ask: "Genesis 1:1 adds up to 2701. That's 37 times what?",
    hint: "Divide, or try the number with 37's digits turned around.",
    check: (a) => a.trim() === "73",
    after: "2701 = 37 × 73, and 37 and 73 are each other's mirror. Make of it what you will; it's arithmetic, not a message.",
  },
];

function Puzzles() {
  const [solved, setSolved] = useState<string[]>([]);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SOLVED_KEY) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's record is only readable after hydration
      if (Array.isArray(s)) setSolved(s.filter((x): x is string => typeof x === "string"));
    } catch {
      /* none yet */
    }
  }, []);
  const save = (next: string[]) => {
    setSolved(next);
    try {
      localStorage.setItem(SOLVED_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };
  // one at a time: the first not solved yet
  const open = PUZZLES.findIndex((p) => !solved.includes(p.id));
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
      <h2 className="font-serif text-xl font-semibold text-ink">
        Puzzles <span className="text-sm font-normal text-faint">{PUZZLES.filter((p) => solved.includes(p.id)).length} of {PUZZLES.length}</span>
      </h2>
      <ol className="space-y-3">
        {PUZZLES.map((p, i) => (i < open || open === -1 ? <Solved key={p.id} p={p} /> : i === open ? <Open key={p.id} p={p} onSolve={() => save([...solved, p.id])} /> : null))}
      </ol>
      {open === -1 && <p className="text-sm text-accent">All solved, for now.</p>}
    </section>
  );
}

function Solved({ p }: { p: Puzzle }) {
  return (
    <li className="text-sm">
      <p className="text-muted line-through decoration-faint">{p.ask}</p>
      <p className="text-ink">✓ {p.after}</p>
    </li>
  );
}

function Open({ p, onSolve }: { p: Puzzle; onSolve: () => void }) {
  const [a, setA] = useState("");
  const [wrong, setWrong] = useState(0);
  return (
    <li className="space-y-2 text-sm">
      <p className="text-ink">{p.ask}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (p.check(a)) onSolve();
          else setWrong(wrong + 1);
        }}
        className="flex gap-2"
      >
        <input value={a} onChange={(e) => setA(e.target.value)} aria-label="Your answer" className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 text-ink" />
        <button type="submit" className="min-h-10 rounded-lg border border-line px-4 text-ink hover:bg-raised">
          Check
        </button>
      </form>
      {wrong > 0 && <p className="text-faint">{wrong > 1 ? `Hint: ${p.hint}` : "Not quite. Try again."}</p>}
    </li>
  );
}

/* ---------------- the page ---------------- */

export function LayersView() {
  return (
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">א · α · ا</p>
        <h1 className="font-serif text-3xl font-semibold text-ink">Letters as numbers</h1>
        <p className="text-muted">
          In Hebrew, Greek and Arabic every letter was also a number, so every verse has a sum and a shape (and, for the Bible
          verses, a row of tones). Here are three first verses, exactly as written, with their letters counted the traditional ways. Each bead is a
          letter: <span style={{ color: SIZE_COLOUR[0] }}>ones</span>, <span style={{ color: SIZE_COLOUR[1] }}>tens</span>,{" "}
          <span style={{ color: SIZE_COLOUR[2] }}>hundreds</span>, <span style={{ color: SIZE_COLOUR[3] }}>a thousand</span>.
        </p>
        <p className="text-xs text-faint">
          This is art and puzzle built on real traditions, not a hidden code or prophecy. The texts are never changed; we only
          count their letters.
        </p>
      </header>
      {LAYER_VERSES.map((v) => (
        <VerseCard key={v.id} v={v} />
      ))}
      <Puzzles />
      <footer className="space-y-1 text-xs text-faint">
        <p>
          Quran text from the Tanzil Project (
          <a href="https://tanzil.net" target="_blank" rel="noopener" className="underline">
            tanzil.net
          </a>
          ), licensed CC BY 3.0, shown verbatim. Hebrew: Westminster Leningrad Codex. Greek: Textus Receptus.
        </p>
        <p>
          <Link href="/" className="text-accent hover:underline">
            Verses Across
          </Link>
        </p>
      </footer>
      </div>
    </main>
  );
}
