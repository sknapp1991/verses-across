"use client";
/**
 * Read-along engine on the browser's built-in text-to-speech (Web Speech API). Free, offline-capable,
 * and works for any language the device has a voice for.
 *
 * Text is spoken one verse at a time (long verses in sentence-sized chunks: Chrome cuts off long
 * utterances), so the reader can highlight the verse being read. "Pause" cancels and remembers the
 * verse; "resume" restarts that verse. Native pause/resume is unreliable on Android and in Chrome.
 */
import { SITE_NAME } from "@/lib/site";
import { useSyncExternalStore } from "react";
import { RAW_WORD } from "./search-text";

/** One verse to speak. lang/voice/version are set when several versions are read in turn. */
export type SpeechItem = { v: string; text: string; lang?: string; voice?: SpeechSynthesisVoice | null; version?: string; rate?: number };

export type SpeechState = {
  /** Player bar visible. */
  open: boolean;
  status: "idle" | "playing" | "paused";
  /** Version being read and the chapter ("bible/gen/1") the queue belongs to. */
  version: string | null;
  chapterKey: string | null;
  /** Verse being read (canonical id). */
  verse: string | null;
  /** Version whose text is being spoken right now (differs from `version` when several are read in turn). */
  speaking: string | null;
  /** Set when a chapter finished and the next one should start once it has loaded. */
  continuePending: boolean;
  /** Playing a verse range: stop after this verse (no continuing into the next chapter). */
  until: string | null;
  /** Does the current voice report word positions? null = not known yet. */
  wordTiming: boolean | null;
  /** "device" = browser text-to-speech; "recorded" = a pre-made recording (keeps playing with the screen off). */
  engine: "device" | "recorded";
  /** The player was just opened and is waiting for the user to choose where to start. */
  ready: boolean;
  error: string | null;
};

const IDLE: SpeechState = {
  open: false,
  status: "idle",
  version: null,
  chapterKey: null,
  verse: null,
  speaking: null,
  continuePending: false,
  until: null,
  wordTiming: null,
  engine: "device",
  ready: false,
  error: null,
};
let state: SpeechState = IDLE;
const subs = new Set<() => void>();
function set(patch: Partial<SpeechState>) {
  const was = state;
  state = { ...state, ...patch };
  noteHiddenStop(was);
  subs.forEach((l) => l());
}

/**
 * Listening that stops with the screen off (ticket 4d80ea44: Samsung Internet stopping after 15–30 minutes,
 * sometimes mid-chapter): remember where and why, and say so when the screen comes back, so the cause can be
 * found. Kept on this device only.
 */
const STOPS = "va-audio-stops:v1";
let hiddenStop: { where: string; why: string; at: number } | null = null;
function noteHiddenStop(was: SpeechState) {
  if (typeof document === "undefined" || document.visibilityState !== "hidden") return;
  if (was.status !== "playing" || state.status === "playing") return;
  const why =
    state.error ??
    (state.status === "idle" ? "it reached the end (or the next chapter wasn't available)" : "the browser paused it (or it lost the audio)");
  const where = [state.chapterKey ?? was.chapterKey, state.verse ?? was.verse].filter(Boolean).join(":");
  hiddenStop = { where, why, at: Date.now() };
  try {
    const list = JSON.parse(localStorage.getItem(STOPS) ?? "[]") as unknown[];
    localStorage.setItem(STOPS, JSON.stringify([...list, { ...hiddenStop, engine: state.engine }].slice(-20)));
  } catch {
    /* private mode */
  }
}
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !hiddenStop) return;
    const s = hiddenStop;
    hiddenStop = null;
    const [work, book, ch, v] = s.where.replace(":", "/").split("/");
    const time = new Date(s.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    void Promise.all([import("./ui-store"), import("./catalog")]).then(([{ toast }, { chapterTitle, findBook }]) => {
      const place = book ? `${chapterTitle(findBook(work, book), Number(ch), book)}${v ? `:${v}` : ""}` : "";
      toast(`Listening stopped${place ? ` at ${place}` : ""} at ${time} while the screen was off: ${s.why}.`, 9000);
    });
  });
function subscribe(l: () => void) {
  subs.add(l);
  return () => subs.delete(l);
}
export function useSpeech() {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}
export const getSpeech = () => state;
export const setSpeech = set;

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;
const noop = () => () => {};
/** Same answer on the server and during hydration (false), then the real one. */
export const useSpeechSupported = () => useSyncExternalStore(noop, speechSupported, () => false);

/* ---------- voices ---------- */

let voices: SpeechSynthesisVoice[] = [];
const voiceSubs = new Set<() => void>();
const EMPTY: SpeechSynthesisVoice[] = [];
function loadVoices() {
  voices = window.speechSynthesis.getVoices();
  voiceSubs.forEach((l) => l());
}
export function useVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(
    (l) => {
      if (!speechSupported()) return () => {};
      voiceSubs.add(l);
      if (!voices.length) loadVoices();
      // Safari 15 (iOS 15): speechSynthesis has no addEventListener, and calling it took the whole page down.
      const synth = window.speechSynthesis;
      const evented = typeof synth.addEventListener === "function";
      if (evented) synth.addEventListener("voiceschanged", loadVoices);
      else synth.onvoiceschanged = loadVoices;
      return () => {
        voiceSubs.delete(l);
        if (voiceSubs.size) return; // the one shared listener stays while anyone still listens
        if (evented) synth.removeEventListener("voiceschanged", loadVoices);
        else if (synth.onvoiceschanged === loadVoices) synth.onvoiceschanged = null;
      };
    },
    () => (voices.length ? voices : EMPTY),
    () => EMPTY,
  );
}

/** When a language has no voice of its own, read it with a close one (Latin → Italian). */
const FALLBACK_LANG: Record<string, string> = { la: "it" };

export function voicesFor(all: SpeechSynthesisVoice[], lang: string) {
  const match = (l: string) => all.filter((v) => v.lang.toLowerCase().replace("_", "-").split("-")[0] === l);
  const own = match(lang);
  if (own.length) return { list: own, fallback: null as string | null };
  const fb = FALLBACK_LANG[lang];
  return { list: fb ? match(fb) : [], fallback: fb ?? null };
}

/** The saved voice, else the most natural-sounding one available. */
export function pickVoice(all: SpeechSynthesisVoice[], lang: string, savedUri?: string) {
  const { list } = voicesFor(all, lang);
  // Prefer natural voices, then voices on the device (they report word positions, so single words can
  // be highlighted; Chrome's online "Google …" voices on desktop don't).
  return (
    list.find((v) => v.voiceURI === savedUri) ??
    list.find((v) => /natural|neural/i.test(v.name)) ??
    list.find((v) => v.localService && v.default) ??
    list.find((v) => v.localService) ??
    list.find((v) => v.default) ??
    list[0] ??
    null
  );
}

/** Apple's novelty voices (and the robotic "Eloquence" ones): last in the list, never in the top few. */
const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Deranged|Hysterical|Pipe Organ|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley)\b/i;

/**
 * The few device voices worth showing first (a phone can have dozens per language): the chosen one, then
 * the natural-sounding ones (Siri, Enhanced / Premium, Natural / Neural), the user's own accent, on-device.
 */
export function topVoices(list: SpeechSynthesisVoice[], chosenUri: string | undefined, n = 3) {
  const here = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "";
  const score = (v: SpeechSynthesisVoice) =>
    (v.voiceURI === chosenUri ? 100 : 0) +
    (/premium|enhanced|natural|neural|siri/i.test(v.name + v.voiceURI) ? 8 : 0) +
    (v.lang.toLowerCase().replace("_", "-") === here ? 2 : 0) +
    (v.localService ? 1 : 0) +
    (v.default ? 1 : 0) -
    (NOVELTY.test(v.name) ? 50 : 0);
  return [...list].sort((a, b) => score(b) - score(a)).slice(0, n);
}

/* ---------- speaking ---------- */

/** Make text easier to speak: drop Hebrew cantillation marks and the sof pasuq, brackets, stray symbols. */
export function speakable(text: string, lang: string) {
  let t = text.replace(/[[\]{}¶*†‡]/g, "");
  if (lang === "he") t = t.replace(/[֑-ֽ֯׃׀]/g, "").replace(/־/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

/** Split into pieces of at most ~220 characters at sentence or clause breaks. */
function chunks(text: string): string[] {
  if (text.length <= 220) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > 220) {
    const window = rest.slice(0, 220);
    const cut = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("; "),
      window.lastIndexOf(": "),
      window.lastIndexOf("? "),
      window.lastIndexOf("! "),
      window.lastIndexOf("، "),
      window.lastIndexOf("׃"),
    );
    const at = cut > 60 ? cut + 1 : Math.max(window.lastIndexOf(", "), window.lastIndexOf(" ")) + 1 || 220;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/* ---------- word-by-word position (boundary events; not every voice sends them) ---------- */

/** `word`: exact word index (device voices); `frac`: how far through the verse (recordings, approximate). */
export type WordPos = { verse: string; word?: number; frac?: number } | null;
const wordSubs = new Set<(w: WordPos) => void>();
/** Called with the index of the word being spoken in the current verse (null when it ends). */
export function onWord(cb: (w: WordPos) => void) {
  wordSubs.add(cb);
  return () => {
    wordSubs.delete(cb);
  };
}
const emitWord = (w: WordPos) => wordSubs.forEach((cb) => cb(w));
const countWords = (s: string) => (s.match(RAW_WORD) ?? []).length;

/* ---------- keep the screen on while listening (Screen Wake Lock API) ---------- */

let wakeLock: { release(): Promise<void> } | null = null;
let wantWake = false;
async function acquireWake() {
  wantWake = true;
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
    if (nav.wakeLock && !wakeLock && document.visibilityState === "visible") wakeLock = await nav.wakeLock.request("screen");
  } catch {
    /* not allowed (battery saver, iframe…) — reading still works */
  }
}
function releaseWake() {
  wantWake = false;
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    // The browser drops the lock when the tab is hidden; take it again on return.
    wakeLock = null;
    if (wantWake && document.visibilityState === "visible") acquireWake();
  });

type Run = {
  items: SpeechItem[];
  index: number;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  onDone: () => void;
  keepAwake: boolean;
};
let run: Run | null = null;
let lastVoice: string | undefined;
let token = 0;
// Keep a reference: Chrome can garbage-collect a playing utterance and never fire onend.
let current: SpeechSynthesisUtterance | null = null;

function speakItem(r: Run, my: number) {
  if (my !== token) return;
  const item = r.items[r.index];
  if (!item) {
    run = null;
    emitWord(null);
    pauseKeepAlive();
    set({ status: "idle", verse: null });
    releaseWake();
    r.onDone();
    return;
  }
  set({ verse: item.v, speaking: item.version ?? null, status: "playing", error: null });
  emitWord(null);
  const parts = chunks(item.text);
  // "Say each verse": "Verse 3." first, as its own part (not counted for the word highlight). Once per verse
  // (several versions can read the same verse; a chapter announcement shares verse 1's number), not at the start.
  const sayNumber = sayEach.verse && r.index > 0 && r.items[r.index - 1]?.v !== item.v;
  if (sayNumber) parts.unshift(`Verse ${item.v}.`);
  let p = 0;
  let base = 0; // words spoken in earlier chunks of this verse
  let sawWord = false;
  const next = () => {
    if (my !== token) return;
    if (p > 0 && !(sayNumber && p === 1)) base += countWords(parts[p - 1]);
    if (p >= parts.length) {
      // A whole verse without word positions: this voice can't follow word by word.
      if (!sawWord && countWords(item.text) > 3 && state.wordTiming !== false) set({ wordTiming: false });
      r.index++;
      // "Pause after each verse": stop at the next verse (after every version of this one); ▶ goes on.
      const upcoming = r.items[r.index];
      if (stopEachVerse && upcoming && upcoming.v !== item.v) {
        pause();
        set({ verse: upcoming.v });
        return;
      }
      speakItem(r, my);
      return;
    }
    const u = new SpeechSynthesisUtterance(parts[p++]);
    const voice = item.voice !== undefined ? item.voice : r.voice;
    u.lang = voice?.lang ?? item.lang ?? r.lang;
    if (voice) u.voice = voice;
    u.rate = item.rate ?? r.rate;
    const chunkText = parts[p - 1];
    const chunkBase = base;
    const isNumber = sayNumber && p === 1;
    u.onboundary = (e) => {
      if (my !== token || e.name !== "word" || isNumber) return;
      if (!sawWord) {
        sawWord = true;
        if (state.wordTiming !== true) set({ wordTiming: true });
      }
      emitWord({ verse: item.v, word: chunkBase + countWords(chunkText.slice(0, e.charIndex)) });
    };
    // `current` stays set until this utterance really ends, so a restart can wait for it (Firefox keeps a
    // cancelled utterance in its queue until its end event; speaking before that leaves the new one stuck).
    u.onend = () => {
      if (current === u) current = null;
      next();
    };
    u.onerror = (e) => {
      if (current === u) current = null;
      if (my !== token || e.error === "interrupted" || e.error === "canceled") return;
      set({ status: "idle", error: e.error === "not-allowed" ? "Tap play to start reading." : `Speech stopped (${e.error}).` });
    };
    let started = false;
    u.onstart = () => {
      started = true;
    };
    current = u;
    const ss = window.speechSynthesis;
    ss.resume(); // some browsers stay "paused" after a cancel
    ss.speak(u);
    // Watchdog: if the browser silently dropped this utterance, queue it once more.
    setTimeout(() => {
      if (my !== token || started || current !== u) return;
      ss.cancel();
      setTimeout(() => {
        if (my === token && current === u) ss.speak(u);
      }, 150);
    }, 1500);
  };
  next();
}

/* ---------- lock-screen controls while a device voice reads ---------- */

/**
 * Phones only show lock-screen / notification controls for a page that is playing audio. While a
 * device voice reads, a silent looping track gives the page those controls (play / pause / previous /
 * next verse) — and on iPhones it also helps speech carry on with the screen locked.
 */
let keepAlive: HTMLAudioElement | null = null;
let deviceControls: { title: string; artist: string; toggle: () => void; step: (d: number) => void } | null = null;
/** The reader registers what the lock-screen buttons do (and the chapter shown there). */
export function setDeviceControls(c: typeof deviceControls) {
  deviceControls = c;
  if (state.engine === "device" && state.status !== "idle") showDeviceSession();
}
const isPhone = () => typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;
function showDeviceSession() {
  const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
  if (!ms || !deviceControls || rec) return;
  const c = deviceControls;
  try {
    ms.metadata = new MediaMetadata({ title: c.title, artist: c.artist, album: SITE_NAME });
    ms.setActionHandler("play", () => c.toggle());
    ms.setActionHandler("pause", () => c.toggle());
    ms.setActionHandler("previoustrack", () => c.step(-1));
    ms.setActionHandler("nexttrack", () => c.step(1));
    for (const a of ["seekbackward", "seekforward"] as MediaSessionAction[]) ms.setActionHandler(a, null);
    ms.playbackState = state.status === "playing" ? "playing" : "paused";
  } catch {
    /* not supported */
  }
}
function startKeepAlive() {
  if (!isPhone()) return;
  try {
    keepAlive ??= new Audio(SILENT);
    keepAlive.loop = true;
    void keepAlive.play().catch(() => {});
  } catch {
    /* no audio: speech still works with the screen on */
  }
  showDeviceSession();
}
function pauseKeepAlive() {
  keepAlive?.pause();
  const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
  if (ms && !rec && deviceControls) ms.playbackState = "paused";
}

/** Start (or restart) reading `items` from index `start`. */
export function play(opts: {
  items: SpeechItem[];
  start: number;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  version: string;
  chapterKey: string;
  onDone: () => void;
  keepAwake: boolean;
}) {
  if (!speechSupported()) {
    set({ error: "This browser can’t read aloud." });
    return;
  }
  const my = ++token;
  window.speechSynthesis.cancel();
  run = {
    items: opts.items,
    index: Math.max(0, opts.start),
    lang: opts.lang,
    voice: opts.voice,
    rate: opts.rate,
    onDone: opts.onDone,
    keepAwake: opts.keepAwake,
  };
  if (opts.keepAwake) acquireWake();
  stopRecording();
  set({ open: true, version: opts.version, chapterKey: opts.chapterKey, continuePending: false, status: "playing", engine: "device", ready: false, speaking: null });
  startKeepAlive();
  if (opts.voice?.voiceURI !== lastVoice) {
    lastVoice = opts.voice?.voiceURI;
    set({ wordTiming: null });
  }
  const r = run;
  // Speak right away when nothing is playing: phones only allow speech that starts inside the tap,
  // and a timer would lose that. Otherwise wait for cancel() to settle (some browsers drop the next
  // utterance if speak() follows it too quickly).
  const ss = window.speechSynthesis;
  const prev = current; // the utterance being cancelled, if any
  if (!prev && !ss.speaking && !ss.pending) speakItem(r, my);
  else {
    // Wait until the cancelled utterance has really ended; if it never reports, cancel again and go on.
    let tries = 0;
    const go = () => {
      if (my !== token) return;
      if ((prev && current === prev) || ss.speaking) {
        if (tries++ < 10) {
          setTimeout(go, 50);
          return;
        }
        ss.cancel();
        current = null;
      }
      speakItem(r, my);
    };
    setTimeout(go, 30);
  }
}

/** Index of the verse being read in the current queue. */
export function currentIndex() {
  return run ? run.index : -1;
}

/** Pause after each verse instead of reading on (set from the player's settings). */
let stopEachVerse = false;
export function setStopEachVerse(on: boolean) {
  stopEachVerse = on;
}

export function pause() {
  token++;
  if (rec) cancelAnimationFrame(rec.raf);
  if (rec?.mix) clearTimeout(rec.mix.timer);
  if (audio && !audio.paused) audio.pause();
  emitWord(null);
  releaseWake();
  window.speechSynthesis?.cancel(); // `current` clears itself when the utterance's end event arrives
  pauseKeepAlive();
  set({ status: "paused" });
}

export function stop() {
  token++;
  stopRecording();
  emitWord(null);
  releaseWake();
  run = null;
  if (speechSupported()) window.speechSynthesis.cancel(); // `current` clears on the end event
  set({ status: "idle", verse: null, continuePending: false, until: null });
}

export function close() {
  stop();
  set({ open: false, error: null });
  const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
  if (ms && deviceControls) {
    ms.metadata = null;
    ms.playbackState = "none";
  }
}

/* ---------- recorded audio (audio v2): an <audio> element keeps playing with the screen locked ---------- */

export type Timing = { duration: number; verses: { v: string; s: number; e: number }[] };
let audio: HTMLAudioElement | null = null;
let rec: {
  timing: Timing;
  until: string | null;
  onDone: () => void;
  raf: number;
  lastVerse: string | null;
  /** Advance straight to this chapter when one ends (works with the screen off). */
  /** The chapter after `from` ("work/book/chapter": the one just finished), or null to stop. */
  getNext?: (from: string) => Promise<{ url: string; timing: Timing; chapterKey: string; title: string } | null>;
  onAdvance?: (chapterKey: string) => void;
  title: string;
  artist: string;
  /** Several versions in turn from their recordings (one verse of one file at a time). */
  mix?: Mix;
  getMixNext?: (from: string) => Promise<MixNext | null>;
  /** Where the chapter now heard starts in the audio element's timeline (0 unless chapters are streamed one after another). */
  base: number;
  /** "Say each verse": the last verse said (undefined until playing has begun). */
  said?: string;
  /** Chapters streamed one after another into one MediaSource (see "one continuous stream" below). */
  stream?: Stream;
} | null = null;

/* ---------- one continuous stream: chapter after chapter with the screen off ---------- */

/**
 * Some phone browsers (Samsung Internet, ticket 4d80ea44) won't start a new file while the screen is off, so a
 * recording stopped at the end of each chapter. Where the browser has MediaSource (Android browsers, desktop),
 * the chapters are appended one after another to a single stream: the next chapter is fetched and added a couple
 * of minutes before the current one ends, and playback simply carries on — no new file is ever started. iPhones
 * (no MediaSource for this) keep switching files, which they allow.
 */
type StreamSeg = { key: string; title: string; timing: Timing; start: number; end: number };
type Stream = { ms: MediaSource; sb: SourceBuffer; url: string; segs: StreamSeg[]; busy: boolean; done: boolean; failedAt: number; fails: number; timer: number };
/** Android only (where a new file can't start with the screen off); elsewhere the tried path of switching files. */
const canStream = () =>
  typeof window !== "undefined" && /Android/i.test(navigator.userAgent) && "MediaSource" in window && MediaSource.isTypeSupported("audio/mpeg");

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.arrayBuffer();
}
function appendBytes(s: Stream, bytes: ArrayBuffer): Promise<{ start: number; end: number }> {
  return new Promise((resolve, reject) => {
    const b = s.sb.buffered;
    const start = b.length ? b.end(b.length - 1) : 0;
    const done = () => {
      s.sb.removeEventListener("updateend", done);
      s.sb.removeEventListener("error", fail);
      const bb = s.sb.buffered;
      resolve({ start, end: bb.length ? bb.end(bb.length - 1) : start });
    };
    const fail = () => {
      s.sb.removeEventListener("updateend", done);
      s.sb.removeEventListener("error", fail);
      reject(new Error("append failed"));
    };
    s.sb.addEventListener("updateend", done);
    s.sb.addEventListener("error", fail);
    s.sb.appendBuffer(bytes);
  });
}
/** Open a stream with the first chapter in it; null if the browser can't (the caller plays the file directly). */
async function openStream(a: HTMLAudioElement, url: string, seg: Omit<StreamSeg, "start" | "end">, isCurrent: () => boolean): Promise<Stream | null> {
  let obj = "";
  try {
    const bytes = await fetchBytes(url);
    if (!isCurrent()) return null; // a newer play started meanwhile: leave the element alone
    const ms = new MediaSource();
    obj = URL.createObjectURL(ms);
    a.src = obj;
    await new Promise<void>((res, rej) => {
      ms.addEventListener("sourceopen", () => res(), { once: true });
      setTimeout(() => rej(new Error("sourceopen timeout")), 8000);
    });
    const sb = ms.addSourceBuffer("audio/mpeg");
    sb.mode = "sequence";
    const s: Stream = { ms, sb, url: obj, segs: [], busy: false, done: false, failedAt: 0, fails: 0, timer: 0 };
    const span = await appendBytes(s, bytes);
    s.segs.push({ ...seg, ...span });
    // timeupdate stops once playback reaches the end of what was added and waits: check on a timer too, so a
    // failed fetch is tried again (and after a few tries the stream ends cleanly instead of waiting in silence).
    s.timer = window.setInterval(streamCheck, 5000);
    return s;
  } catch {
    if (obj) URL.revokeObjectURL(obj);
    return null;
  }
}
function closeStream(s?: Stream) {
  if (!s) return;
  clearInterval(s.timer);
  try {
    URL.revokeObjectURL(s.url);
  } catch {
    /* already gone */
  }
}
/* ---------- "Say each…" verse / chapter / book (ticket c1ec4dc5) ---------- */

export type SayEach = { verse: boolean; chapter: boolean; book: boolean };
let sayEach: SayEach = { verse: false, chapter: false, book: false };
/** The reader keeps this in step with the "Say each…" setting. */
export function setSayEach(s: SayEach) {
  sayEach = s;
}
/** What to say when a recording moves on by itself from chapter `fromKey` to `toKey` ("Exodus 1", "Exodus", or nothing). */
function chapterWords(fromKey: string, toKey: string, title: string): string {
  if (sayEach.chapter) return title;
  const book = (k: string) => k.split("/").slice(0, 2).join("/");
  if (sayEach.book && book(fromKey) !== book(toKey)) return title.replace(/\s+\d+$/, "");
  return "";
}
/** "Verse 12" for the verse a recording has just reached (not verse 1 when the chapter was just said). */
function sayVerse() {
  const r = rec;
  const a = audio;
  if (!sayEach.verse || !r || !a || a.muted || r.mix || r.until) return;
  const t = a.currentTime - r.base;
  const vs = r.timing.verses;
  const i = vs.findIndex((x) => t >= x.s && t < x.e);
  if (i < 0) return;
  const v = vs[i];
  if (r.said === v.v) return;
  const first = r.said === undefined;
  r.said = v.v;
  if (first || (i === 0 && sayEach.chapter)) return; // the verse pressed play on, or a chapter just announced
  const base = r.base;
  announce(`Verse ${v.v}`, () => {
    if (rec === r && audio) audio.currentTime = base + v.s;
  });
}
/**
 * Say something over a recording: "Exodus 1" when it moves on to a new chapter, "Verse 12" at a new verse. Nothing
 * is paused or restarted (a phone with the screen off may not allow starting again): the recording carries on muted
 * while the device voice speaks, then goes back to where it was, unmuted. If the voice never reports back, it
 * carries on after 5 s.
 */
function announce(title: string, again: () => void) {
  const a = audio;
  if (!a || !speechSupported() || !title) return;
  a.muted = true;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(t);
    a.muted = false;
    again();
  };
  const t = window.setTimeout(finish, 5000);
  try {
    const u = new SpeechSynthesisUtterance(title);
    u.lang = "en";
    u.rate = 1;
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    finish();
  }
}

/** On every timeupdate (it fires with the screen off too): follow chapter changes, and add the next chapter early. */
function streamCheck() {
  sayVerse();
  const r = rec;
  const s = r?.stream;
  if (!audio || !r || !s) return;
  const t = audio.currentTime;
  // Which chapter is playing now?
  const seg = s.segs.find((x) => t >= x.start - 0.05 && t < x.end) ?? s.segs[s.segs.length - 1];
  if (seg && seg.start !== r.base) {
    r.base = seg.start;
    r.timing = seg.timing;
    r.lastVerse = null;
    const from = state.chapterKey ?? "";
    set({ chapterKey: seg.key, verse: seg.timing.verses[0]?.v ?? null });
    mediaSession(seg.title, r.artist);
    r.onAdvance?.(seg.key);
    const at = seg.start;
    announce(chapterWords(from, seg.key, seg.title), () => {
      if (audio && rec === r) audio.currentTime = at;
    });
    // Free what was already heard (keep a few seconds for "previous verse").
    if (!s.sb.updating && seg.start > 10)
      try {
        s.sb.remove(0, seg.start - 5);
      } catch {
        /* nothing to free */
      }
  }
  if (s.done && s.ms.readyState === "open" && !s.sb.updating)
    try {
      s.ms.endOfStream(); // nothing more to add: let it end after the last chapter
    } catch {
      /* already ended */
    }
  // Add the next chapter about two minutes before the last one in the stream ends.
  const last = s.segs[s.segs.length - 1];
  if (s.busy || s.done || r.until || !r.getNext || last.end - t > 120 || Date.now() - s.failedAt < 15000) return;
  s.busy = true;
  void (async () => {
    try {
      const next = await r.getNext!(last.key);
      if (rec !== r) return;
      if (!next) {
        s.done = true;
        if (s.ms.readyState === "open" && !s.sb.updating) s.ms.endOfStream(); // ends after the last chapter
        return;
      }
      const span = await appendBytes(s, await fetchBytes(next.url));
      if (rec !== r) return;
      s.segs.push({ key: next.chapterKey, title: next.title, timing: next.timing, ...span });
      s.fails = 0;
    } catch {
      s.failedAt = Date.now(); // network blip: try again in a little while...
      if (++s.fails >= 3) s.done = true; // ...but after three failed tries, end after what is there (no silent wait)
    } finally {
      s.busy = false;
    }
  })();
}

/* ---------- several recorded versions in turn (keeps going with the screen locked) ---------- */

export type MixSeg = { v: string; version: string; rate: number };
type Seg = MixSeg & { s: number; e: number };
type MixTrack = { src: string; timing: Timing; blob: boolean };
type Mix = { seq: Seg[]; i: number; tracks: Record<string, MixTrack>; cur: string | null; timer: number; next?: Promise<MixNext | null> };
export type MixTrackSpec = { version: string; url: string; timingUrl: string };
type MixNext = { seq: Seg[]; tracks: Record<string, MixTrack>; chapterKey: string; title: string };

/** Timing plus the whole file in memory, so switching between versions is instant (also with the screen off). */
async function loadTrack(t: MixTrackSpec): Promise<MixTrack> {
  const timing = await loadTiming(t.timingUrl);
  try {
    const r = await fetch(t.url);
    if (r.ok) return { src: URL.createObjectURL(await r.blob()), timing, blob: true };
  } catch {
    /* stream it instead */
  }
  return { src: t.url, timing, blob: false };
}
async function loadTracks(specs: MixTrackSpec[]) {
  const list = await Promise.all(specs.map(loadTrack));
  const tracks: Record<string, MixTrack> = {};
  specs.forEach((s, k) => (tracks[s.version] = list[k]));
  return tracks;
}
function freeTracks(t?: Record<string, MixTrack>) {
  for (const x of Object.values(t ?? {})) if (x.blob) URL.revokeObjectURL(x.src);
}
/** Attach start / end times; drop verses a recording doesn't have. */
function resolveSeq(seq: MixSeg[], tracks: Record<string, MixTrack>): Seg[] {
  const out: Seg[] = [];
  for (const x of seq) {
    const t = tracks[x.version]?.timing.verses.find((y) => y.v === x.v);
    if (t) out.push({ ...x, s: t.s, e: t.e });
  }
  return out;
}

/** Next chapter for several versions in turn: verse order follows the first version's recording. */
export async function buildMixNext(opts: {
  specs: MixTrackSpec[];
  rates: Record<string, number>;
  order: "verse" | "chapter";
  chapterKey: string;
  title: string;
}): Promise<MixNext | null> {
  const tracks = await loadTracks(opts.specs);
  const ids = opts.specs.map((s) => s.version);
  const seg = (v: string, version: string) => ({ v, version, rate: opts.rates[version] ?? 1 });
  const seq =
    opts.order === "chapter"
      ? ids.flatMap((id) => tracks[id].timing.verses.map((x) => seg(x.v, id)))
      : tracks[ids[0]].timing.verses.flatMap((x) => ids.map((id) => seg(x.v, id)));
  return { seq: resolveSeq(seq, tracks), tracks, chapterKey: opts.chapterKey, title: opts.title };
}

function mixGo(i: number, autoplay = true) {
  const m = rec?.mix;
  if (!audio || !rec || !m) return;
  const seg = m.seq[i];
  if (!seg) return void mixEnd();
  m.i = i;
  clearTimeout(m.timer);
  const a = audio;
  if (m.cur !== seg.version) {
    m.cur = seg.version;
    a.src = m.tracks[seg.version].src;
    a.currentTime = seg.s;
  } else if (Math.abs(a.currentTime - seg.s) > 0.35) a.currentTime = seg.s; // the next verse of the same file just carries on
  a.defaultPlaybackRate = seg.rate;
  a.playbackRate = seg.rate;
  rec.lastVerse = seg.v;
  set({ verse: seg.v, speaking: seg.version });
  // Fetch the next chapter early, so carrying on with the screen off doesn't wait on the network.
  if (!m.next && rec.getMixNext && !rec.until && i >= m.seq.length / 2) {
    m.next = rec.getMixNext(state.chapterKey ?? "").catch(() => null);
  }
  if (autoplay) a.play().catch(() => set({ status: "paused", error: "Tap play to start." }));
}

/** Has the verse being heard finished? (timeupdate + a timer, so it works with the screen off too) */
function mixCheck() {
  const m = rec?.mix;
  if (!audio || !rec || !m || audio.paused) return;
  const seg = m.seq[m.i];
  if (!seg || m.cur !== seg.version) return;
  clearTimeout(m.timer);
  const left = seg.e - audio.currentTime;
  if (left <= 0.04) return mixNext();
  m.timer = window.setTimeout(mixCheck, Math.max(30, (left / (audio.playbackRate || 1)) * 1000));
}

function mixNext() {
  const m = rec?.mix;
  if (!audio || !m) return;
  const seg = m.seq[m.i];
  const nx = m.seq[m.i + 1];
  if (!nx) return void mixEnd();
  if (stopEachVerse && nx.v !== seg.v) {
    mixGo(m.i + 1, false);
    pause();
    return;
  }
  mixGo(m.i + 1);
}

async function mixEnd() {
  const r = rec;
  const m = r?.mix;
  if (!r || !m) return;
  cancelAnimationFrame(r.raf);
  clearTimeout(m.timer);
  const next = !r.until && r.getMixNext ? await (m.next ?? r.getMixNext(state.chapterKey ?? "").catch(() => null)) : null;
  if (rec !== r) {
    freeTracks(next?.tracks);
    return;
  }
  if (next && next.seq.length) {
    freeTracks(m.tracks);
    r.mix = { seq: next.seq, i: 0, tracks: next.tracks, cur: null, timer: 0 };
    const from = state.chapterKey ?? "";
    set({ chapterKey: next.chapterKey });
    mediaSession(next.title, r.artist);
    r.onAdvance?.(next.chapterKey);
    mixGo(0);
    announce(chapterWords(from, next.chapterKey, next.title), () => {
      if (rec === r && r.mix) mixGo(0);
    });
    r.raf = requestAnimationFrame(tick);
    return;
  }
  stopRecording();
  set({ status: "idle", verse: null, until: null, speaking: null });
  emitWord(null);
  r.onDone();
}

/** Read several versions in turn from their recordings, starting at `start` in `seq`. */
export async function playRecordedMix(opts: {
  tracks: MixTrackSpec[];
  seq: MixSeg[];
  start: number;
  version: string;
  chapterKey: string;
  until: string | null;
  title: string;
  artist: string;
  onDone: () => void;
  /** The chapter after `from` (the one just finished), or null to stop. */
  getNext?: (from: string) => Promise<MixNext | null>;
  onAdvance?: (chapterKey: string) => void;
}): Promise<boolean> {
  const my = ++token;
  if (speechSupported()) window.speechSynthesis.cancel();
  run = null;
  current = null;
  emitWord(null);
  releaseWake();
  stopRecording();
  const startAt = opts.seq[opts.start];
  set({ open: true, version: opts.version, chapterKey: opts.chapterKey, continuePending: false, status: "playing", engine: "recorded", error: null, wordTiming: true, ready: false, verse: startAt?.v ?? null, speaking: startAt?.version ?? null });
  let tracks: Record<string, MixTrack>;
  try {
    tracks = await loadTracks(opts.tracks);
  } catch {
    if (my !== token) return true;
    set({ status: "idle", engine: "device" });
    return false;
  }
  if (my !== token) {
    freeTracks(tracks);
    return true;
  }
  // Positions in the full list → positions after dropping verses a recording lacks.
  const before = resolveSeq(opts.seq.slice(0, opts.start), tracks).length;
  const seq = resolveSeq(opts.seq, tracks);
  if (!seq.length) {
    freeTracks(tracks);
    set({ status: "idle", engine: "device" });
    return false;
  }
  audio ??= new Audio();
  audio.preload = "auto";
  const first = tracks[opts.tracks[0].version].timing;
  rec = { timing: first, until: opts.until, onDone: opts.onDone, raf: 0, lastVerse: null, onAdvance: opts.onAdvance, title: opts.title, artist: opts.artist, getMixNext: opts.getNext, base: 0 };
  rec.mix = { seq, i: 0, tracks, cur: null, timer: 0 };
  const a = audio;
  a.onended = () => {
    if (rec?.mix) mixNext();
  };
  a.ontimeupdate = mixCheck;
  a.onpause = () => {
    // Switching to another version's file pauses for a moment: only a real pause counts.
    if (rec && !a.ended)
      setTimeout(() => {
        if (rec && a.paused) set({ status: "paused" });
      }, 250);
  };
  a.onplay = () => {
    if (rec) {
      set({ status: "playing" });
      cancelAnimationFrame(rec.raf);
      rec.raf = requestAnimationFrame(tick);
      mixCheck();
    }
  };
  mediaSession(opts.title, opts.artist);
  mixGo(Math.min(before, seq.length - 1), false);
  try {
    await a.play();
  } catch (e) {
    if ((e as DOMException)?.name === "NotAllowedError") set({ status: "paused", error: "Tap play to start." });
    else {
      stopRecording();
      set({ status: "idle", engine: "device" });
      return false;
    }
  }
  return true;
}

const timings = new Map<string, Promise<Timing>>();
export function loadTiming(url: string): Promise<Timing> {
  let p = timings.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<Timing>;
    });
    p.catch(() => timings.delete(url));
    timings.set(url, p);
  }
  return p;
}

function tick() {
  if (!audio || !rec) return;
  const t = audio.currentTime - rec.base; // (the chapter now heard, in a stream of chapters)
  if (rec.mix) {
    // Several versions in turn: mixCheck moves between verses; this only follows the words.
    const seg = rec.mix.seq[rec.mix.i];
    if (seg && rec.mix.cur === seg.version)
      emitWord(t >= seg.s && t <= seg.e ? { verse: seg.v, frac: (t - seg.s) / Math.max(0.1, seg.e - seg.s) } : null);
    rec.raf = requestAnimationFrame(tick);
    return;
  }
  const vs = rec.timing.verses;
  let i = vs.findIndex((x) => t < x.e + 0.2);
  if (i < 0) i = vs.length - 1;
  const cur = vs[i];
  if (cur && cur.v !== rec.lastVerse) {
    const moved = rec.lastVerse !== null;
    rec.lastVerse = cur.v;
    set({ verse: cur.v });
    // "Pause after each verse": wait at the start of the next verse.
    if (stopEachVerse && moved && audio) {
      audio.currentTime = rec.base + cur.s;
      pause();
      return;
    }
  }
  if (cur) emitWord(t >= cur.s && t <= cur.e ? { verse: cur.v, frac: (t - cur.s) / Math.max(0.1, cur.e - cur.s) } : null);
  // End of a chosen verse range.
  if (rec.until) {
    const end = vs.find((x) => x.v === rec!.until);
    if (end && t >= end.e) {
      const r = rec;
      stopRecording();
      set({ status: "idle", verse: null, until: null });
      r.onDone();
      return;
    }
  }
  rec.raf = requestAnimationFrame(tick);
}

function mediaSession(title: string, artist: string) {
  const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
  if (!ms) return;
  ms.metadata = new MediaMetadata({ title, artist, album: SITE_NAME });
  const step = (d: number) => () => {
    if (!audio || !rec) return;
    if (rec.mix) {
      // Previous / next verse (its first version).
      const m = rec.mix;
      const vs = [...new Set(m.seq.map((x) => x.v))];
      const at = vs.indexOf(m.seq[m.i]?.v);
      const target = vs[Math.min(vs.length - 1, Math.max(0, at + d))];
      const j = m.seq.findIndex((x) => x.v === target);
      if (j >= 0) mixGo(j, !audio.paused);
      return;
    }
    const vs = rec.timing.verses;
    const i = Math.max(0, vs.findIndex((x) => x.v === state.verse));
    const j = Math.min(vs.length - 1, Math.max(0, i + d));
    audio.currentTime = rec.base + vs[j].s;
    rec.lastVerse = vs[j].v;
    set({ verse: vs[j].v });
  };
  ms.setActionHandler("play", () => audio?.play());
  ms.setActionHandler("pause", () => pause());
  ms.setActionHandler("previoustrack", step(-1));
  ms.setActionHandler("nexttrack", step(1));
  try {
    ms.setActionHandler("seekbackward", step(-1));
    ms.setActionHandler("seekforward", step(1));
  } catch {
    /* not supported */
  }
}

function stopRecording() {
  pauseKeepAlive(); // a recording has its own audio (and lock-screen controls)
  if (rec) cancelAnimationFrame(rec.raf);
  closeStream(rec?.stream);
  if (rec?.mix) {
    clearTimeout(rec.mix.timer);
    freeTracks(rec.mix.tracks);
    void rec.mix.next?.then((n) => freeTracks(n?.tracks));
  }
  const had = !!rec;
  rec = null;
  if (audio) {
    audio.ontimeupdate = null;
    audio.muted = false; // (a chapter announcement may have been under way)
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
  if (had && ms) {
    for (const a of ["play", "pause", "previoustrack", "nexttrack", "seekbackward", "seekforward"] as MediaSessionAction[])
      try {
        ms.setActionHandler(a, null);
      } catch {
        /* not supported */
      }
    ms.metadata = null;
    ms.playbackState = "none";
  }
}

/** Play a recorded chapter from verse `startVerse` (or the top). */
export async function playRecording(opts: {
  url: string;
  timingUrl: string;
  startVerse: string | null;
  rate: number;
  version: string;
  chapterKey: string;
  until: string | null;
  title: string;
  artist: string;
  onDone: () => void;
  /** The chapter after `from` ("work/book/chapter": the one just finished), or null to stop. */
  getNext?: (from: string) => Promise<{ url: string; timing: Timing; chapterKey: string; title: string } | null>;
  onAdvance?: (chapterKey: string) => void;
}): Promise<boolean> {
  const my = ++token;
  if (speechSupported()) window.speechSynthesis.cancel();
  run = null;
  current = null;
  emitWord(null);
  releaseWake();
  stopRecording();
  set({ open: true, version: opts.version, chapterKey: opts.chapterKey, continuePending: false, status: "playing", engine: "recorded", error: null, wordTiming: true, ready: false, speaking: null });
  let timing: Timing;
  try {
    timing = await loadTiming(opts.timingUrl);
  } catch {
    if (my !== token) return true;
    set({ status: "idle", engine: "device" });
    return false; // caller falls back to a device voice
  }
  if (my !== token) return true; // something else started meanwhile
  audio ??= new Audio();
  audio.preload = "auto";
  // Chapter after chapter in one stream where the browser can (see "one continuous stream"); else the file itself.
  const stream = opts.getNext && !opts.until && canStream() ? await openStream(audio, opts.url, { key: opts.chapterKey, title: opts.title, timing }, () => my === token) : null;
  if (my !== token) {
    closeStream(stream ?? undefined);
    return true;
  }
  if (!stream) audio.src = opts.url;
  audio.playbackRate = opts.rate;
  const start = opts.startVerse ? timing.verses.find((x) => x.v === opts.startVerse) ?? timing.verses.find((x) => parseInt(x.v, 10) >= parseInt(opts.startVerse!, 10)) : null;
  rec = { timing, until: opts.until, onDone: opts.onDone, raf: 0, lastVerse: null, getNext: opts.getNext, onAdvance: opts.onAdvance, title: opts.title, artist: opts.artist, base: 0, ...(stream ? { stream } : {}) };
  const a = audio;
  a.ontimeupdate = stream ? streamCheck : sayVerse;
  a.onended = async () => {
    const r = rec;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    if (r.stream) {
      // The stream ran out: the last chapter (or the end of the Bible / book) has been heard.
      stopRecording();
      set({ status: "idle", verse: null, until: null });
      emitWord(null);
      r.onDone();
      return;
    }
    // From the chapter that just ended (not the one where playing began: chapter after chapter, screen off).
    const next = !r.until && r.getNext ? await r.getNext(state.chapterKey ?? "").catch(() => null) : null;
    if (rec !== r) return;
    if (next) {
      // Keep the audio session alive: go straight into the next chapter, then tell the page.
      r.timing = next.timing;
      r.lastVerse = null;
      a.src = next.url;
      a.playbackRate = opts.rate;
      const from = state.chapterKey ?? "";
      set({ chapterKey: next.chapterKey, verse: next.timing.verses[0]?.v ?? null });
      mediaSession(next.title, r.artist);
      r.onAdvance?.(next.chapterKey);
      await a.play().catch(() => {});
      announce(chapterWords(from, next.chapterKey, next.title), () => {
        if (rec === r) a.currentTime = 0;
      });
      r.raf = requestAnimationFrame(tick);
      return;
    }
    stopRecording();
    set({ status: "idle", verse: null, until: null });
    emitWord(null);
    r.onDone();
  };
  a.onpause = () => {
    if (rec && !a.ended) set({ status: "paused" });
  };
  a.onplay = () => {
    if (rec) {
      set({ status: "playing" });
      cancelAnimationFrame(rec.raf);
      rec.raf = requestAnimationFrame(tick);
    }
  };
  if (start) a.currentTime = start.s;
  mediaSession(opts.title, opts.artist);
  try {
    await a.play();
  } catch (e) {
    if ((e as DOMException)?.name === "NotAllowedError") set({ status: "paused", error: "Tap play to start." });
    else {
      stopRecording();
      set({ status: "idle", engine: "device" });
      return false;
    }
  }
  return true;
}

/** Resume a paused recording where it stopped. Returns false when there is nothing to resume. */
export function resumeRecording(): boolean {
  if (!audio || !rec || !audio.src) return false;
  audio.play().catch(() => set({ error: "Tap play to start." }));
  return true;
}

/** Jump within the playing recording to a verse (stays in the same chapter). */
export function seekRecording(v: string, version?: string): boolean {
  if (!audio || !rec) return false;
  if (rec.mix) {
    const m = rec.mix;
    let j = m.seq.findIndex((x) => x.v === v && (!version || x.version === version));
    if (j < 0) j = m.seq.findIndex((x) => x.v === v);
    if (j < 0) return false;
    mixGo(j, !audio.paused);
    return true;
  }
  const x = rec.timing.verses.find((t) => t.v === v);
  if (!x) return false;
  audio.currentTime = rec.base + x.s;
  rec.lastVerse = v; // a jump isn't "reaching the next verse" (pause-after-each-verse)
  set({ verse: v });
  return true;
}

export function setRecordingRate(rate: number) {
  if (audio) audio.playbackRate = rate;
}

/**
 * iPhones (and some Android browsers) only allow sound that starts inside a tap. A single tap on a verse
 * waits briefly to rule out a double tap, so later playback can fall outside the tap. Unlock both the
 * speech engine and the audio element on the first touch/click of each page visit.
 */
let unlocked = false;
const SILENT =
  "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
let speechPrimed = false;
const UNLOCK_EVENTS = ["pointerup", "touchend", "click", "keydown"] as const;
export function unlockAudio() {
  if (unlocked) return;
  try {
    // Only phones/tablets need speech unlocked; on desktops the silent word can wedge Firefox's queue.
    if (speechSupported() && !speechPrimed && !window.speechSynthesis.speaking && matchMedia("(pointer: coarse)").matches) {
      speechPrimed = true;
      const u = new SpeechSynthesisUtterance("a"); // iOS may drop an empty / whitespace utterance
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
    audio ??= new Audio();
    if (!audio.src) {
      audio.src = SILENT;
      audio
        .play()
        .then(() => {
          audio?.pause();
          if (audio?.src === SILENT) audio.removeAttribute("src");
          unlocked = true;
          UNLOCK_EVENTS.forEach((ev) => window.removeEventListener(ev, unlockAudio, true));
        })
        .catch(() => {
          if (audio?.src === SILENT) audio.removeAttribute("src"); // not a gesture yet: try on the next tap
        });
    } else unlocked = true; // a recording is already playing
  } catch {
    /* nothing to unlock */
  }
}
if (typeof window !== "undefined") UNLOCK_EVENTS.forEach((ev) => window.addEventListener(ev, unlockAudio, true));

// Stop speaking when the page goes away.
if (typeof window !== "undefined") window.addEventListener("pagehide", () => speechSupported() && window.speechSynthesis.cancel());
void current;
