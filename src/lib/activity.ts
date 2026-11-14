"use client";
/**
 * Reading activity, counted on this device only (localStorage), for Progress, goals and badges:
 * - reading time: seconds on a chapter page while the tab is visible and the reader has touched,
 *   scrolled or typed in the last minute (an app left open doesn't count);
 * - listening time: seconds the read-aloud player is playing;
 * - verses read: verses that stayed on screen for at least 2 seconds while reading (once per day);
 * - chapters read: chapters read for at least 30 seconds (once per day), and per-work seconds;
 * - verses heard: each verse the read-aloud player reaches (once per day); chapters heard: chapters listened to for
 *   at least 30 seconds (once per day). Until Nov 14, listening counted toward chapters read instead.
 */
import { useSyncExternalStore } from "react";
import { getSpeech, subscribeSpeech } from "./speech";

export type Day = {
  /** reading seconds */ r: number;
  /** listening seconds */ l: number;
  /** verses read */ v: number;
  /** chapters read: "work/book/chapter" */ ch: string[];
  /** seconds per work */ w: Record<string, number>;
  /** verses heard */ hv?: number;
  /** chapters heard: "work/book/chapter" */ hc?: string[];
};
export type Activity = { v: 1; days: Record<string, Day> };

const KEY = "va-activity:v1";
const EMPTY: Activity = { v: 1, days: {} };
let data: Activity | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((l) => l());

/** Local calendar date, "2026-11-07". */
export const dayKey = (t: number | Date = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** This device's own counts. */
export function getOwnActivity(): Activity {
  if (data) return data;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Activity | null;
    data = raw && raw.v === 1 && raw.days ? raw : { v: 1, days: {} };
  } catch {
    data = { v: 1, days: {} };
  }
  return data;
}

/* Other devices' counts, from sync (each device only ever adds to its own). */
const OTHERS = "va-activity-others:v1";
let others: Record<string, Activity> | null = null;
export function getOtherActivity(): Record<string, Activity> {
  if (others) return others;
  try {
    others = (JSON.parse(localStorage.getItem(OTHERS) ?? "{}") as Record<string, Activity>) ?? {};
  } catch {
    others = {};
  }
  return others;
}
export function setOtherActivity(next: Record<string, Activity>) {
  others = next;
  try {
    localStorage.setItem(OTHERS, JSON.stringify(next));
  } catch {
    /* storage full */
  }
  combined = null;
  emit();
}

function addInto(into: Record<string, Day>, from: Record<string, Day>) {
  for (const [k, d] of Object.entries(from)) {
    const t: Day = into[k] ? { ...into[k], ch: [...into[k].ch], w: { ...into[k].w }, hc: [...(into[k].hc ?? [])] } : { r: 0, l: 0, v: 0, ch: [], w: {} };
    t.r += d.r || 0;
    t.l += d.l || 0;
    t.v += d.v || 0;
    t.hv = (t.hv ?? 0) + (d.hv || 0);
    for (const c of d.ch ?? []) if (!t.ch.includes(c)) t.ch.push(c);
    for (const c of d.hc ?? []) if (!(t.hc ??= []).includes(c)) t.hc.push(c);
    for (const [w, n] of Object.entries(d.w ?? {})) t.w[w] = (t.w[w] ?? 0) + n;
    into[k] = t;
  }
}

/** Every device's counts together (what Progress shows). */
let combined: { own: Activity; all: Activity } | null = null;
export function getActivity(): Activity {
  const own = getOwnActivity();
  if (combined && combined.own === own) return combined.all;
  const o = getOtherActivity();
  if (!Object.keys(o).length) {
    combined = { own, all: own };
    return own;
  }
  const days: Record<string, Day> = {};
  addInto(days, own.days);
  for (const a of Object.values(o)) addInto(days, a.days ?? {});
  combined = { own, all: { v: 1, days } };
  return combined.all;
}
export function useActivity(): Activity {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    getActivity,
    () => EMPTY,
  );
}

let dirty = false;
function save() {
  if (!dirty || !data) return;
  dirty = false;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full / private mode */
  }
}
function today(): Day {
  const a = getOwnActivity();
  const k = dayKey();
  const d = (a.days[k] ??= { r: 0, l: 0, v: 0, ch: [], w: {} });
  return d;
}
function bump(fn: (d: Day) => void) {
  const a = getOwnActivity();
  fn(today());
  data = { ...a, days: { ...a.days } }; // new object so React re-renders
  dirty = true;
  emit();
}

/* ---------- the tracker (started once by <ActivityTracker />) ---------- */

const TICK = 5000;
let lastInput = 0;
let started = false;
const seenToday = new Set<string>(); // verse keys counted today
let seenDay = "";
const onScreenSince = new Map<string, number>();
const chapterSecs = new Map<string, number>();
const heardSecs = new Map<string, number>();
const heardToday = new Set<string>(); // verse keys heard today
let heardDay = "";
let lastHeard = "";
/** A verse the player has reached: counted once per day. */
function noteHeard() {
  const s = getSpeech();
  if (s.status !== "playing" || !s.verse || !s.chapterKey) return;
  const k = `${s.chapterKey.split("/").slice(0, 3).join("/")}:${s.verse}`;
  if (k === lastHeard) return;
  lastHeard = k;
  if (dayKey() !== heardDay) {
    heardDay = dayKey();
    heardToday.clear();
  }
  if (heardToday.has(k)) return;
  heardToday.add(k);
  bump((d) => {
    d.hv = (d.hv ?? 0) + 1;
  });
}

function currentChapter(): { work: string; key: string } | null {
  const m = /^\/read\/([^/]+)\/([^/]+)\/(\d+)/.exec(location.pathname);
  return m ? { work: m[1], key: `${m[1]}/${m[2]}/${m[3]}` } : null;
}

function countVerses(chapter: string, now: number) {
  if (dayKey() !== seenDay) {
    seenDay = dayKey();
    seenToday.clear();
  }
  const h = innerHeight;
  const visible = new Set<string>();
  for (const el of document.querySelectorAll<HTMLElement>("[data-v]")) {
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.bottom < 56 || r.top > h - 40) continue;
    // mostly on screen
    const shown = Math.min(r.bottom, h) - Math.max(r.top, 0);
    if (shown < Math.min(r.height, h) * 0.6) continue;
    visible.add(`${chapter}:${el.dataset.v}`);
  }
  let n = 0;
  for (const k of visible) {
    const since = onScreenSince.get(k);
    if (since == null) onScreenSince.set(k, now);
    else if (now - since >= 2000 && !seenToday.has(k)) {
      seenToday.add(k);
      n++;
    }
  }
  for (const k of [...onScreenSince.keys()]) if (!visible.has(k)) onScreenSince.delete(k);
  return n;
}

function tick() {
  const now = Date.now();
  const sp = getSpeech();
  const listening = sp.status === "playing";
  const ch = currentChapter();
  const reading = !!ch && document.visibilityState === "visible" && now - lastInput < 60_000;
  if (!listening && !reading) return;
  const secs = TICK / 1000;
  const verses = reading && ch ? countVerses(ch.key, now) : 0;
  bump((d) => {
    if (listening) d.l += secs;
    if (reading && ch) {
      d.r += secs;
      d.v += verses;
      d.w[ch.work] = (d.w[ch.work] ?? 0) + secs;
      const s = (chapterSecs.get(ch.key) ?? 0) + secs;
      chapterSecs.set(ch.key, s);
      if (s >= 30 && !d.ch.includes(ch.key)) d.ch.push(ch.key);
    } else if (listening && sp.chapterKey) {
      // listening counts toward the work too, and the chapter as heard once listened to for 30 s
      const work = sp.chapterKey.split("/")[0];
      d.w[work] = (d.w[work] ?? 0) + secs;
      const k = sp.chapterKey.split("/").slice(0, 3).join("/");
      const s = (heardSecs.get(k) ?? 0) + secs;
      heardSecs.set(k, s);
      if (s >= 30 && /^[^/]+\/[^/]+\/\d+$/.test(k) && !(d.hc ??= []).includes(k)) d.hc.push(k);
    }
  });
}

export function startActivityTracking() {
  if (started || typeof window === "undefined") return;
  started = true;
  const input = () => (lastInput = Date.now());
  for (const ev of ["pointerdown", "keydown", "wheel", "scroll", "touchstart"]) window.addEventListener(ev, input, { passive: true, capture: true });
  input();
  setInterval(tick, TICK);
  subscribeSpeech(noteHeard);
  setInterval(save, 15_000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && save());
  window.addEventListener("pagehide", save);
}

/* ---------- sums ---------- */

export type Totals = {
  read: number;
  listen: number;
  verses: number;
  chapters: number;
  days: number;
  works: Set<string>;
  versesHeard: number;
  chaptersHeard: number;
  /** each chapter heard ("work/book/chapter") → the first day it was heard */
  heard: Map<string, string>;
};

/** Totals over days from `from` to `to` (inclusive "YYYY-MM-DD"; omit for all time). */
export function totals(a: Activity, from?: string, to?: string): Totals {
  const t: Totals = { read: 0, listen: 0, verses: 0, chapters: 0, days: 0, works: new Set(), versesHeard: 0, chaptersHeard: 0, heard: new Map() };
  for (const [k, d] of Object.entries(a.days)) {
    if ((from && k < from) || (to && k > to)) continue;
    t.read += d.r;
    t.listen += d.l;
    t.verses += d.v;
    t.chapters += d.ch.length;
    t.versesHeard += d.hv ?? 0;
    t.chaptersHeard += d.hc?.length ?? 0;
    for (const c of d.hc ?? []) if (!t.heard.has(c) || k < t.heard.get(c)!) t.heard.set(c, k);
    if (d.r + d.l >= 60) t.days++;
    for (const w of Object.keys(d.w)) t.works.add(w);
  }
  return t;
}

/** Start of this week (Sunday) / month / year as "YYYY-MM-DD". */
export function periodStart(p: "day" | "week" | "month" | "year", now = new Date()): string {
  const d = new Date(now);
  if (p === "week") d.setDate(d.getDate() - d.getDay());
  if (p === "month") d.setDate(1);
  if (p === "year") d.setMonth(0, 1);
  return dayKey(d);
}

/** A day counts toward a streak with at least a minute of reading or listening. */
export function streaks(a: Activity, extraDays: Iterable<string> = []): { current: number; best: number } {
  const active = new Set(Object.entries(a.days).filter(([, d]) => d.r + d.l >= 60).map(([k]) => k));
  for (const k of extraDays) active.add(k);
  if (!active.size) return { current: 0, best: 0 };
  const sorted = [...active].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T12:00:00`);
    prev.setDate(prev.getDate() + 1);
    run = dayKey(prev) === sorted[i] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  // current: ending today, or yesterday (today not started yet)
  let current = 0;
  const d = new Date();
  if (!active.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (active.has(dayKey(d))) {
    current++;
    d.setDate(d.getDate() - 1);
  }
  return { current, best };
}

export const fmtDuration = (secs: number) => {
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
};
