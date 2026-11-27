"use client";
/**
 * The hidden layer (hub c74b9402). Three opening verses (Genesis 1:1 in Hebrew, John 1:1 in Greek, the Quran's first
 * verse in Arabic) shown exactly as written, with each counted letter as a bead on a strand, coloured by its size
 * (ones, tens, hundreds, thousands), and played as a short melody: a letter's first digit picks the note, its size the
 * octave. Then puzzles, solved only from the verses themselves; what you've solved is kept on this device.
 * Art and puzzle, built on the real traditions (gematria, isopsephy, abjad): never offered as hidden prophecy.
 */
import Link from "next/link";
import { createContext, memo, Suspense, useDeferredValue, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AiWindow } from "./ai-window";
import { askAboutVerse, openAi } from "@/lib/ai-chat";
import { updateSettings } from "@/lib/settings";
import { LAYER_VERSES } from "@/lib/layer-verses";
import { lettersOf, tokensOf, valueOf, wordsOf, type Letter, type Script } from "@/lib/letter-values";
import { LAYER_GLOSSES } from "@/lib/layer-glosses";
import { GENESIS_1 } from "@/lib/layer-gen1";

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

function playStrand(letters: Letter[], onStep: (i: number) => void, speed = 1): () => void {
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
    if (i > 0 && letters[i - 1].word !== l.word) t += 0.14 / speed; // a breath between words
    const f = BASE[sizeOf(l.value)] * Math.pow(2, SCALE[firstDigit(l.value) - 1] / 12);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.015);
    const len = Math.min(0.32, 0.32 / speed + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + len + 0.02);
    timers.push(setTimeout(() => onStep(i), (t - ctx.currentTime) * 1000));
    t += 0.17 / speed;
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

/** How fast the tones go (my brother's ask): kept for the page while it's open. */
const SPEEDS = [0.5, 0.75, 1, 1.5, 2, 3];
function Tempo({ speed, onChange }: { speed: number; onChange: (s: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted">
      Tempo
      <select value={speed} onChange={(e) => onChange(Number(e.target.value))} aria-label="Tempo" className="min-h-9 rounded-lg border border-line bg-raised px-2 text-ink">
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s === 1 ? "1× (normal)" : `${s}×`}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * A verse exactly as written, each word its own span so the word sounding can be lit (the spaces, maqaf and marks
 * between them are kept as they are). `lit`: the word's number as lettersOf counts them, or -1.
 */
const VerseText = memo(function VerseText({ text, script, lit }: { text: string; script: Script; lit: number }) {
  const counted = new Set(tokensOf(text, script));
  let n = -1;
  return (
    <>
      {text.split(script === "hebrew" ? /([\s\u05BE]+)/ : /(\s+)/).map((part, i) => {
        if (!part || /^[\s\u05BE]+$/.test(part) || !counted.has(part) || !lettersOf(part, script).length) return <span key={i}>{part}</span>;
        n++;
        return (
          <span key={i} className={n === lit ? "rounded bg-accent/30 text-ink" : undefined}>
            {part}
          </span>
        );
      })}
    </>
  );
});

/* ---------------- views: helix, circle, score (my brother's asks) ---------------- */

type View = "helix" | "circle" | "score";
const VIEWS: { id: View; label: string }[] = [
  { id: "helix", label: "Helix" },
  { id: "circle", label: "Circle" },
  { id: "score", label: "Score" },
];
/** The view chosen, the same for every card (the switch on any card changes them all). */
const ViewCtx = createContext<{ view: View; setView: (v: View) => void }>({ view: "helix", setView: () => {} });

function ViewSwitch() {
  const { view, setView } = useContext(ViewCtx);
  return (
    <div role="group" aria-label="View" className="inline-flex rounded-lg border border-line p-0.5">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          aria-pressed={view === v.id}
          onClick={() => setView(v.id)}
          className={`min-h-8 rounded-md px-3 text-xs font-medium ${view === v.id ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

type ViewProps = { letters: Letter[]; rtl: boolean; lit: number; word: number | null; marks?: { at: number; label: string }[] };

/**
 * Memoised: a whole chapter is ~1,700 beads (several SVG nodes each), so it re-renders only when its own props
 * change, not on every state change of the card around it.
 */
const LetterView = memo(function LetterView(p: ViewProps) {
  const { view } = useContext(ViewCtx);
  return view === "circle" ? <Ring {...p} /> : view === "score" ? <Score {...p} /> : <Strand {...p} />;
});

const beadOpacity = (i: number, l: Letter, lit: number, word: number | null) => (lit >= 0 ? (lit === i ? 1 : 0.45) : word === null || word === l.word ? 1 : 0.25);

/** A verse as a ring of beads, read clockwise from the top; several verses are rings inside each other (the first innermost). */
function Ring({ letters, lit, word, marks = [] }: ViewProps) {
  const starts = marks.length ? marks.map((m) => m.at) : [0];
  const rings = starts.map((s, k) => ({ from: s, to: k + 1 < starts.length ? starts[k + 1] : letters.length, label: marks[k]?.label }));
  const size = 320;
  const c = size / 2;
  const gap = Math.min(30, (c - 34) / Math.max(1, rings.length));
  return (
    <div className="flex justify-center">
      <svg width="100%" style={{ maxWidth: size }} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${letters.length} letters in ${rings.length} ring${rings.length === 1 ? "" : "s"}`}>
        {rings.map((r, k) => {
          const radius = rings.length === 1 ? c - 24 : 30 + gap * (k + 1);
          const n = r.to - r.from;
          return (
            <g key={k}>
              <circle cx={c} cy={c} r={radius} fill="none" stroke="var(--line)" strokeWidth={1} />
              {r.label && rings.length > 1 && (
                <text x={c} y={c - radius - 2} fontSize={8} textAnchor="middle" fill="var(--faint)">
                  {r.label}
                </text>
              )}
              {letters.slice(r.from, r.to).map((l, j) => {
                const i = r.from + j;
                const a = -Math.PI / 2 + (j / n) * Math.PI * 2;
                const big = rings.length === 1 ? 1.4 : 0.6;
                return (
                  <circle
                    key={i}
                    cx={c + radius * Math.cos(a)}
                    cy={c + radius * Math.sin(a)}
                    r={((lit === i ? 2.5 : 0) + (word === l.word ? 1.2 : 0) + 2.2 + sizeOf(l.value) * big) * (rings.length > 8 ? 0.7 : 1)}
                    fill={SIZE_COLOUR[sizeOf(l.value)]}
                    stroke={word === l.word ? "var(--ink)" : "none"}
                    strokeWidth={1.2}
                    opacity={beadOpacity(i, l, lit, word)}
                  >
                    <title>
                      {l.ch} = {l.value}
                    </title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** The tones as notes on a two-part staff (treble above, bass below): higher notes for ones, lower for hundreds and
 * thousands; a bar line between words and a mark where each verse starts. Read left to right, as music is. */
function Score({ letters, lit, word, marks = [] }: ViewProps) {
  const semis = (l: Letter) => (3 - sizeOf(l.value)) * 12 + SCALE[firstDigit(l.value) - 1]; // above C2
  const H = 200;
  const yOf = (s: number) => H - 12 - s * 3.1;
  const step = 16;
  const W = Math.max(240, letters.length * step + 40);
  const xOf = (i: number) => 30 + i * step;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el && lit >= 0) el.scrollLeft = xOf(lit) - el.clientWidth / 2;
  });
  const lines = [28, 31, 35, 38, 41, 7, 11, 14, 17, 21]; // E4 G4 B4 D5 F5 · G2 B2 D3 F3 A3
  const markAt = new Set(marks.map((m) => m.at));
  return (
    <div ref={box} className="overflow-x-auto" dir="ltr">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${letters.length} notes on a staff`}>
        {lines.map((s) => (
          <line key={s} x1={0} x2={W} y1={yOf(s)} y2={yOf(s)} stroke="var(--line)" strokeWidth={1} />
        ))}
        {letters.map((l, i) =>
          i > 0 && letters[i - 1].word !== l.word ? (
            <line key={`w${i}`} x1={xOf(i) - step / 2} x2={xOf(i) - step / 2} y1={yOf(41)} y2={yOf(7)} stroke={markAt.has(i) ? "var(--faint)" : "var(--line)"} strokeWidth={markAt.has(i) ? 1.5 : 0.8} />
          ) : null,
        )}
        {marks.map((m) => (
          <text key={`v${m.at}`} x={xOf(m.at)} y={10} fontSize={10} textAnchor="middle" fill="var(--muted)">
            {m.label}
          </text>
        ))}
        {letters.map((l, i) => {
          const y = yOf(semis(l));
          return (
            <g key={i} opacity={beadOpacity(i, l, lit, word)}>
              <line x1={xOf(i) + 4.5} x2={xOf(i) + 4.5} y1={y} y2={y - 20} stroke="var(--muted)" strokeWidth={1} />
              <ellipse
                cx={xOf(i)}
                cy={y}
                rx={(lit === i ? 7 : 5.5) + (word === l.word ? 0.8 : 0)}
                ry={lit === i ? 5 : 4}
                transform={`rotate(-20 ${xOf(i)} ${y})`}
                fill={SIZE_COLOUR[sizeOf(l.value)]}
                stroke={word === l.word || lit === i ? "var(--ink)" : "none"}
                strokeWidth={1.2}
              >
                <title>
                  {l.ch} = {l.value}
                </title>
              </ellipse>
            </g>
          );
        })}
      </svg>
    </div>
  );
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
  // Hebrew is spoken from its bare letters: chanting marks and vowel points dropped (voices read plain Hebrew best; the shown text is unchanged)
  const u = new SpeechSynthesisUtterance(script === "hebrew" ? text.replace(/[\u0591-\u05C7]/g, "") : text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.8;
  window.speechSynthesis.speak(u);
  return true;
}

/* ---------------- the strand ---------------- */

function Strand({ letters, rtl, lit, word, marks = [] }: { letters: Letter[]; rtl: boolean; lit: number; word: number | null; marks?: { at: number; label: string }[] }) {
  const step = letters.length > 300 ? 8 : 14;
  const w = Math.max(240, letters.length * step + 24);
  const h = marks.length ? 110 : 96;
  const top = marks.length ? 14 : 0;
  const x = (i: number) => (rtl ? w - 12 - i * step : 12 + i * step);
  const y = (i: number, phase: number) => top + (h - top) / 2 + Math.sin(i * 0.55 + phase) * 26;
  const box = useRef<HTMLDivElement>(null);
  // a right-to-left strand opens at its start (the right end); while playing, the bead sounding stays in view
  useEffect(() => {
    if (rtl && box.current) box.current.scrollLeft = box.current.scrollWidth;
  }, [rtl, letters.length]);
  useEffect(() => {
    const el = box.current;
    if (!el || lit < 0) return;
    el.scrollLeft = x(lit) - el.clientWidth / 2;
  });
  // a word picked: the strand moves to it if it's out of view (my brother's video)
  useEffect(() => {
    const el = box.current;
    if (!el || word === null) return;
    const idx = letters.map((l, i) => (l.word === word ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return;
    const [a, z] = [x(idx[0]), x(idx[idx.length - 1])];
    const lo = Math.min(a, z) - step, hi = Math.max(a, z) + step;
    if (lo < el.scrollLeft || hi > el.scrollLeft + el.clientWidth) el.scrollTo({ left: (lo + hi) / 2 - el.clientWidth / 2, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the picked word changes
  }, [word]);
  return (
    <div ref={box} className="overflow-x-auto" dir="ltr">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${letters.length} letters as a strand`}>
        {marks.map((m) => (
          <g key={`v${m.at}`}>
            <line x1={x(m.at) + (rtl ? step / 2 : -step / 2)} x2={x(m.at) + (rtl ? step / 2 : -step / 2)} y1={10} y2={h - 4} stroke="var(--faint)" strokeDasharray="2 3" strokeWidth={1} />
            <text x={x(m.at)} y={10} fontSize={10} textAnchor="middle" fill="var(--muted)">
              {m.label}
            </text>
          </g>
        ))}
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

/**
 * Genesis 1, any part of it (my brother's ask): one verse, several, or the whole chapter. The verses chosen are listed
 * (the one sounding is lit), their letters make one strand marked where each verse starts, and one verse at a time
 * opens to its words: value, letters, sound and meaning, and Say it.
 */
function ChapterCard() {
  const [chosen, setChosen] = useState<number[]>([1]);
  const [focus, setFocus] = useState(1); // the verse whose words are shown
  const [word, setWord] = useState<number | null>(null); // a word of the focus verse
  const [lit, setLit] = useState(-1);
  const [noVoice, setNoVoice] = useState(false);
  const [speed, setSpeed] = useState(1);
  const stop = useRef<(() => void) | null>(null);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => () => stop.current?.(), []);
  // The picks show at once (pressed buttons, heading); the strand they feed (for the whole chapter ~1,700 beads)
  // follows as a deferred render, so a tap is answered before it's drawn.
  const shownChosen = useDeferredValue(chosen);
  const verses = useMemo(() => GENESIS_1.filter((v) => shownChosen.includes(v.v)), [shownChosen]);
  // all chosen letters in one strand: the word numbers run on across verses; where each verse starts
  const { letters, marks, starts } = useMemo(() => {
    const letters: (Letter & { verse: number })[] = [];
    const marks: { at: number; label: string }[] = [];
    const starts: Record<number, number> = {}; // verse -> its first word's number in the strand
    let wordBase = 0;
    for (const v of verses) {
      const ls = lettersOf(v.text, "hebrew");
      marks.push({ at: letters.length, label: String(v.v) });
      starts[v.v] = wordBase;
      for (const l of ls) letters.push({ ...l, word: l.word + wordBase, verse: v.v });
      wordBase += v.words.length;
    }
    return { letters, marks: verses.length > 1 ? marks : [], starts };
  }, [verses]);
  const total = letters.reduce((n, l) => n + l.value, 0);
  const focusVerse = GENESIS_1.find((v) => v.v === focus) ?? GENESIS_1[0];
  const focusWords = useMemo(() => wordsOf(focusVerse.text, "hebrew"), [focusVerse]);
  const strandWord = word !== null && shownChosen.includes(focus) ? (starts[focus] ?? 0) + word : null;
  const playing = strandWord === null ? letters : letters.filter((l) => l.word === strandWord);
  const now = lit >= 0 ? (playing[lit] as (typeof letters)[number] | undefined) : undefined;
  const sounding = now?.verse;
  const soundingWord = now ? now.word - (starts[now.verse] ?? 0) : -1; // within its verse
  // the list follows the verse sounding (only its own scroll box moves, not the page)
  useEffect(() => {
    const box = list.current;
    const row = sounding ? (box?.querySelector(`[data-v="${sounding}"]`) as HTMLElement | null) : null;
    if (box && row && box.scrollHeight > box.clientHeight) box.scrollTop = row.offsetTop - box.offsetTop - box.clientHeight / 2 + row.clientHeight / 2;
  }, [sounding]);
  const pick = (to: (prev: number[]) => number[]) => {
    stop.current?.();
    const tidy = (list: number[]) => {
      const next = [...new Set(list)].sort((a, b) => a - b);
      return next.length ? next : [1];
    };
    const next = tidy(to(chosen));
    setChosen((prev) => tidy(to(prev)));
    if (!next.includes(focus)) setFocus(next[0] ?? 1);
    setWord(null);
  };
  const gloss = word !== null ? focusVerse.words[word] : undefined;
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold text-ink">
          Genesis 1{chosen.length === GENESIS_1.length ? "" : chosen.length === 1 ? `:${chosen[0]}` : ` · ${chosen.length} verses`}
        </h2>
        <span className="text-xs text-faint">Hebrew (Masoretic Text, WLC) · Gematria</span>
      </div>
      {/* which verses: tap to add or remove; the whole chapter, or back to one */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Verses shown">
          {GENESIS_1.map((v) => (
            <button
              key={v.v}
              type="button"
              aria-pressed={chosen.includes(v.v)}
              onClick={() => pick((c) => (c.includes(v.v) ? c.filter((x) => x !== v.v) : [...c, v.v]))}
              className={`h-8 min-w-8 rounded-md border px-1 text-xs tabular-nums ${chosen.includes(v.v) ? "border-accent bg-accent text-accent-ink" : "border-line text-muted hover:bg-raised"}`}
            >
              {v.v}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <button type="button" onClick={() => pick(() => GENESIS_1.map((v) => v.v))} className="font-medium text-accent hover:underline">
            Whole chapter
          </button>
          <button type="button" onClick={() => pick(() => [1])} className="font-medium text-accent hover:underline">
            Just verse 1
          </button>
          <span className="text-faint">Tap numbers to add or take away verses.</span>
        </div>
      </div>
      {/* the chosen verses, exactly as written; the one sounding is lit; tap one to open its words */}
      <ol ref={list} dir="rtl" lang="he" className={`relative space-y-1 ${verses.length > 6 ? "max-h-80 overflow-y-auto pe-1" : ""}`}>
        {verses.map((v) => (
          <li key={v.v} data-v={v.v}>
            <button
              type="button"
              onClick={() => (setFocus(v.v), setWord(null))}
              className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1 text-right ${sounding === v.v ? "bg-accent-soft" : focus === v.v && verses.length > 1 ? "bg-raised" : ""}`}
            >
              <span dir="ltr" className="shrink-0 text-xs tabular-nums text-faint">{v.v}</span>
              <span className="flex-1 font-serif text-xl leading-relaxed text-ink">
                <VerseText text={v.text} script="hebrew" lit={sounding === v.v ? soundingWord : -1} />
              </span>
              <span dir="ltr" className="shrink-0 text-xs tabular-nums text-faint">{valueOf(v.text, "hebrew").toLocaleString("en-US")}</span>
            </button>
          </li>
        ))}
      </ol>
      <ViewSwitch />
      <LetterView letters={letters} rtl lit={lit < 0 ? -1 : letters.indexOf(playing[lit])} word={strandWord} marks={marks} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (stop.current) {
              stop.current();
              stop.current = null;
              return;
            }
            stop.current = playStrand(
              playing,
              (i) => {
                setLit(i);
                if (i === -1) stop.current = null;
              },
              speed,
            );
          }}
          className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink"
        >
          {lit >= 0 ? "■ Stop" : strandWord !== null ? "▶ Play this word" : verses.length > 1 ? `▶ Play ${verses.length} verses as tones` : "▶ Play its letters as tones"}
        </button>
        <Tempo speed={speed} onChange={(s) => (stop.current?.(), setSpeed(s))} />
        <span className="text-sm text-muted">
          {letters.length.toLocaleString("en-US")} letters · {verses.reduce((n, v) => n + v.words.length, 0)} words · total{" "}
          <strong className="tabular-nums text-ink">{total.toLocaleString("en-US")}</strong>
        </span>
      </div>
      <details className="text-sm text-muted">
        <summary className="cursor-pointer">
          Each word&rsquo;s value{verses.length > 1 ? ` (verse ${focus}; tap a verse above for another)` : ""}
        </summary>
        <p className="mt-2 text-xs text-faint">Tap a word to see it on the strand, letter by letter, how it sounds and what it means.</p>
        <ul dir="rtl" className="mt-2 flex flex-wrap gap-2">
          {focusWords.map((w, i) => (
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
          <p dir="rtl" aria-live="polite" className="mt-2 rounded-lg bg-raised px-3 py-2 font-serif text-base text-ink">
            {lettersOf(focusVerse.text, "hebrew")
              .filter((l) => l.word === word)
              .map((l, i) => (
                <span key={i} className="whitespace-nowrap">
                  {i > 0 && <span className="text-faint"> + </span>}
                  {l.ch} <span className="text-sm tabular-nums" style={{ color: SIZE_COLOUR[sizeOf(l.value)] }}>{l.value}</span>
                </span>
              ))}
            <span className="text-faint"> = </span>
            <strong className="tabular-nums">{focusWords[word]?.value}</strong>
          </p>
        )}
        {gloss && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
            <p className="text-sm">
              <span className="font-serif text-base text-ink">{gloss.he}</span> <span className="italic text-ink">{gloss.say}</span> <span className="text-muted">· {gloss.means}</span>
            </p>
            <button type="button" onClick={() => setNoVoice(!sayWord(gloss.he, "hebrew"))} className="min-h-9 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-raised">
              🔊 Say it
            </button>
            {noVoice && <p className="w-full text-xs text-faint">This device has no Hebrew voice installed, so it can&rsquo;t say it.</p>}
            <p className="w-full text-[11px] text-faint">Said by your device&rsquo;s voice, in today&rsquo;s Hebrew pronunciation.</p>
          </div>
        )}
        <p className="mt-2 text-xs">{SYSTEM.hebrew.how} A lone פ after a verse marks a new paragraph; it isn&rsquo;t a word and isn&rsquo;t counted.</p>
      </details>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link href="/read/bible/gen/1" className="text-xs text-accent hover:underline">
          Read Genesis 1 in context →
        </Link>
        <button
          type="button"
          onClick={() =>
            askAboutVerse({
              reference: chosen.length === 1 ? `Genesis 1:${chosen[0]}` : `Genesis 1 (verses ${chosen.join(", ")})`,
              texts: [{ abbr: "Gematria", name: "Hebrew (Masoretic Text, WLC)", language: "Hebrew", text: verses.map((v) => v.text).join(" ") }],
            })
          }
          className="text-xs font-medium text-accent hover:underline"
        >
          ✦ Ask AI about {chosen.length === 1 ? "this verse" : "these verses"}
        </button>
      </div>
    </section>
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
  const [speed, setSpeed] = useState(1);
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
        <VerseText text={v.text} script={script} lit={lit >= 0 ? (playing[lit]?.word ?? -1) : -1} />
      </p>
      <ViewSwitch />
      <LetterView letters={letters} rtl={rtl} lit={lit < 0 ? -1 : letters.indexOf(playing[lit])} word={word} />
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
            stop.current = playStrand(
              playing,
              (i) => {
                setLit(i);
                if (i === -1) stop.current = null;
              },
              speed,
            );
          }}
          className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink"
        >
          {lit >= 0 ? "■ Stop" : word === null ? "▶ Play its letters as tones" : "▶ Play this word"}
        </button>
        )}
        {script !== "arabic" && <Tempo speed={speed} onChange={(s) => (stop.current?.(), setSpeed(s))} />}
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
                Hear it recited on Quran.com ↗
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link href={v.href} className="text-xs text-accent hover:underline">
          Read it in context →
        </Link>
        <button
          type="button"
          onClick={() =>
            askAboutVerse({
              reference: v.ref,
              texts: [{ abbr: SYSTEM[script].name, name: v.lang, language: script === "hebrew" ? "Hebrew" : script === "greek" ? "Greek" : "Arabic", text: v.text }],
            })
          }
          className="text-xs font-medium text-accent hover:underline"
        >
          ✦ Ask AI about this verse
        </button>
      </div>
    </section>
  );
}

/* ---------------- puzzles ---------------- */

const SOLVED_KEY = "va-layers:v1";
type Puzzle = { id: string; ask: string; hint: string; answer: string; check: (a: string) => boolean; after: string };
const PUZZLES: Puzzle[] = [
  {
    id: "86",
    ask: "In Genesis 1:1, one word adds up to 86. Which word is it? (Type it in English.)",
    hint: "It's the third word: the one who creates.",
    answer: "God (Elohim, אֱלֹהִים)",
    check: (a) => /^(god|elohim|elohiym)$/i.test(a.trim()),
    after: "Elohim: aleph 1 + lamed 30 + he 5 + yod 10 + mem 40 = 86.",
  },
  {
    id: "373",
    ask: "John 1:1 says one word three times. What is that word's value?",
    hint: "The Word: lambda, omicron, gamma, omicron, sigma.",
    answer: "373",
    check: (a) => a.trim() === "373",
    after: "Logos: 30 + 70 + 3 + 70 + 200 = 373, said three times in one verse.",
  },
  {
    id: "786",
    ask: "What is the value of the whole first verse of the Quran?",
    hint: "Add its 19 counted letters (the small alif isn't counted).",
    answer: "786",
    check: (a) => a.trim() === "786",
    after: "786: a number some Muslims, mainly in South Asia, write in place of the Bismillah.",
  },
  {
    id: "73",
    ask: "Genesis 1:1 adds up to 2701. That's 37 times what?",
    hint: "Divide, or try the number with 37's digits turned around.",
    answer: "73",
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
      {wrong > 0 && wrong < 3 && <p className="text-faint">{wrong > 1 ? `Hint: ${p.hint}` : "Not quite. Try again."}</p>}
      {/* after three misses: the answer, then on (my brother's ask) */}
      {wrong >= 3 && (
        <p className="flex flex-wrap items-center gap-2 text-ink">
          <span>
            The answer: <strong>{p.answer}</strong>
          </span>
          <button type="button" onClick={onSolve} className="min-h-9 rounded-lg border border-line px-3 text-xs hover:bg-raised">
            Next →
          </button>
        </p>
      )}
    </li>
  );
}

/* ---------------- the page ---------------- */

export function LayersView() {
  const [view, setView] = useState<View>("helix");
  return (
    <ViewCtx.Provider value={{ view, setView }}>
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <header className="space-y-2">
        <Link href="/study-lab" className="text-xs text-accent hover:underline">
          ← Study lab
        </Link>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">א · α · ا</p>
          <span className="flex gap-2">
            <button type="button" onClick={() => openAi()} className="min-h-9 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-raised">
              ✦ Ask AI
            </button>
            <button
              type="button"
              aria-label="Dark or light"
              title="Dark or light"
              onClick={() => {
                // (this page isn't inside the reader, which keeps the theme in step: so switch it here too)
                const dark = !document.documentElement.classList.contains("dark");
                document.documentElement.classList.toggle("dark", dark);
                updateSettings({ theme: dark ? "dark" : "light" });
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:bg-raised"
            >
              ◐
            </button>
          </span>
        </div>
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
      <ChapterCard />
      {LAYER_VERSES.filter((v) => v.id !== "gen").map((v) => (
        <VerseCard key={v.id} v={v} />
      ))}
      <Puzzles />
      <footer className="space-y-1 text-xs text-faint">
        <p>
          Quran text from the Tanzil Project (
          <a href="https://tanzil.net" target="_blank" rel="noopener" className="underline">
            tanzil.net
          </a>
          ), licensed CC BY 3.0, shown verbatim. Hebrew: Westminster Leningrad Codex. Greek: Textus Receptus. Hebrew words&rsquo; sounds and meanings: STEP Bible (Tyndale House, Cambridge), CC BY 4.0. Recitation:{" "}
          <a href="https://quran.com" target="_blank" rel="noopener" className="underline">
            Quran.com
          </a>
          , a project of the Quran Foundation, with thanks.
        </p>
        <p>
          <Link href="/" className="text-accent hover:underline">
            Verses Across
          </Link>
        </p>
      </footer>
      </div>
      <Suspense fallback={null}>
        <AiWindow />
      </Suspense>
    </main>
    </ViewCtx.Provider>
  );
}
