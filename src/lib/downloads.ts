"use client";
/**
 * Offline downloads: save whole versions (and, if wanted, their recorded read-along audio, book by
 * book) on this device. Files go straight into two caches that the service worker (public/sw.js)
 * serves from: va-saved for scripture files, va-audio for recordings and their timings. Sizes come
 * from /offline/index.json (scripts/build-offline-index.ts), so they're known before anything starts.
 * Downloads resume: files already saved are skipped. Nothing about the person is sent anywhere.
 */
import { useSyncExternalStore } from "react";
import { booksOfWork, getVersion } from "./catalog";
import { AUDIO_BASE, getRecordings, type Recording } from "./recordings";

export const TEXT_CACHE = "va-saved";
export const AUDIO_CACHE = "va-audio";
const KEY = "va-downloads:v1";
/** Download requests carry this flag so the service worker sends them to the network, never to a cache. */
const FRESH = "va-dl=1";

export type OfflineIndex = {
  /** "work/version" → total bytes and bytes per book */
  texts: Record<string, { bytes: number; books: Record<string, number> }>;
  /** "version/voice" → book → [bytes, chapters] */
  audio: Record<string, Record<string, [number, number]>>;
};

export type Saved =
  | { kind: "text"; work: string; version: string; bytes: number; at: number; files?: number }
  | { kind: "audio"; version: string; voice: string; books: string[]; bytes: number; at: number; files?: number };

export type Job = { label: string; done: number; total: number; bytesDone: number; bytesTotal: number; error?: string };

/** saved: what's on this device; missing: saved entries whose files the browser has since cleared. */
type State = { saved: Record<string, Saved>; job: Job | null; missing: Record<string, number> };
let state: State = { saved: {}, job: null, missing: {} };
const EMPTY: State = state;
const subs = new Set<() => void>();
const emit = (p: Partial<State>) => {
  state = { ...state, ...p };
  subs.forEach((l) => l());
};

function readSaved(): Record<string, Saved> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Saved>;
  } catch {
    return {};
  }
}
function writeSaved(saved: Record<string, Saved>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* private mode */
  }
  emit({ saved });
}

let loaded = false;
export function useDownloads(): State {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      if (!loaded) {
        loaded = true;
        emit({ saved: readSaved() });
      }
      return () => subs.delete(l);
    },
    () => state,
    () => EMPTY,
  );
}

export const supported = () => typeof window !== "undefined" && "caches" in window && "serviceWorker" in navigator;

let indexPromise: Promise<OfflineIndex> | null = null;
export function loadIndex(): Promise<OfflineIndex> {
  // Through the service worker, which keeps a copy, so sizes still show offline.
  indexPromise ??= fetch("/offline/index.json")
    .then((r) => (r.ok ? (r.json() as Promise<OfflineIndex>) : Promise.reject(new Error(String(r.status)))))
    .catch(() => {
      indexPromise = null;
      return { texts: {}, audio: {} };
    });
  return indexPromise;
}

export const textKey = (work: string, version: string) => `text:${work}/${version}`;
export const audioKey = (version: string, voice: string) => `audio:${version}/${voice}`;

export function formatBytes(n: number): string {
  if (n < 1e6) return `${Math.max(1, Math.round(n / 1e3))} KB`;
  if (n < 1e9) return `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)} MB`;
  return `${(n / 1e9).toFixed(1)} GB`;
}

/** Free space this browser will give the site (an estimate), or null if unknown. */
export async function storageInfo(): Promise<{ used: number; free: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e?.quota) return null;
    return { used: e.usage ?? 0, free: e.quota - (e.usage ?? 0) };
  } catch {
    return null;
  }
}

/* ---------- file lists ---------- */

const textPrefix = (work: string, version: string) => `/texts/${work}/${version}/`;
const audioPrefix = (version: string, voice: string, book: string) => `${AUDIO_BASE}/${version}/${voice}/${book}/`;

function textFiles(index: OfflineIndex, work: string, version: string) {
  const t = index.texts[`${work}/${version}`];
  return t ? Object.entries(t.books).map(([b, bytes]) => ({ url: `${textPrefix(work, version)}${b}.json`, bytes })) : [];
}

function recordingChapters(r: Recording, index: OfflineIndex, book: string): number[] {
  if (r.chapters) return r.chapters[book] ?? [];
  // Every chapter: the count measured from the uploaded files, else the catalog's.
  const work = getVersion(r.version)?.work ?? "bible";
  const n = index.audio[r.id]?.[book]?.[1] ?? booksOfWork(work).find((b) => b.id === book)?.chapters ?? 0;
  return Array.from({ length: n }, (_, i) => i + 1);
}

function audioFiles(index: OfflineIndex, r: Recording, books: string[]) {
  const sizes = index.audio[r.id] ?? {};
  return books.flatMap((book) => {
    const chapters = recordingChapters(r, index, book);
    const per = chapters.length ? (sizes[book]?.[0] ?? 0) / chapters.length : 0; // the book's bytes spread over its chapters, for the progress bar
    return chapters.flatMap((c) => [
      { url: `${audioPrefix(r.version, r.voice, book)}${c}.mp3`, bytes: per },
      { url: `${audioPrefix(r.version, r.voice, book)}${c}.json`, bytes: 0 },
    ]);
  });
}

/** Cached request paths (no origin, no query) under one of these prefixes. */
async function cachedUnder(cacheName: string, prefixes: string[]): Promise<Request[]> {
  const cache = await caches.open(cacheName);
  return (await cache.keys()).filter((req) => {
    const p = new URL(req.url).pathname;
    return prefixes.some((pre) => p.startsWith(pre));
  });
}

const prefixesOf = (s: Saved) => (s.kind === "text" ? [textPrefix(s.work, s.version)] : s.books.map((b) => audioPrefix(s.version, s.voice, b)));
const cacheOf = (s: Saved) => (s.kind === "text" ? TEXT_CACHE : AUDIO_CACHE);

/** Check that every saved download is still complete (browsers can clear storage on their own). */
export async function checkSaved() {
  const missing: Record<string, number> = {};
  for (const [key, s] of Object.entries(readSaved())) {
    if (!s.files) continue;
    const have = (await cachedUnder(cacheOf(s), prefixesOf(s))).length;
    if (have < s.files) missing[key] = s.files - have;
  }
  emit({ missing });
}

/* ---------- running a download ---------- */

let abort: AbortController | null = null;
export const cancelDownload = () => abort?.abort();

class QuotaFull extends Error {}

async function run(label: string, cacheName: string, files: { url: string; bytes: number }[], missingOk = false, force = false): Promise<boolean> {
  if (state.job && !state.job.error) return false;
  abort = new AbortController();
  const signal = abort.signal;
  const job: Job = { label, done: 0, total: files.length, bytesDone: 0, bytesTotal: files.reduce((a, f) => a + f.bytes, 0) };
  emit({ job });
  // Ask the browser not to clear this when space runs low (it may ask the person, or decide itself).
  void navigator.storage?.persist?.().catch(() => false);
  const cache = await caches.open(cacheName);
  const queue = [...files];
  let failed = 0;
  let full = false;
  const step = (f: { bytes: number }) => {
    job.done++;
    job.bytesDone += f.bytes;
    emit({ job: { ...job } });
  };
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let f = queue.shift(); f && !signal.aborted && !full; f = queue.shift()) {
        try {
          if (force || !(await cache.match(f.url))) {
            const res = await fetch(`${f.url}?${FRESH}`, { signal, cache: "no-store" });
            if (res.ok && res.status === 200) {
              await cache.put(f.url, res).catch((e: unknown) => {
                throw (e as Error)?.name === "QuotaExceededError" ? new QuotaFull() : e;
              });
            } else if (!(missingOk && res.status === 404)) failed++;
          }
        } catch (e) {
          if (e instanceof QuotaFull) full = true;
          else if (!signal.aborted) failed++;
        }
        step(f);
      }
    }),
  );
  abort = null;
  if (signal.aborted || failed || full) void checkSaved();
  if (signal.aborted) emit({ job: null });
  else if (full) emit({ job: { ...job, error: "This device ran out of space for the site. Delete some downloads (or free up space), then press Download again: it carries on where it stopped." } });
  else if (failed) emit({ job: { ...job, error: `${failed} file${failed === 1 ? "" : "s"} couldn’t be saved. Check your connection, then press Download again: it carries on where it stopped.` } });
  else emit({ job: null });
  return !signal.aborted && !failed && !full;
}

export const dismissJob = () => emit({ job: null });
export const busy = () => !!state.job && !state.job.error;

export async function downloadText(work: string, version: string, force = false): Promise<boolean> {
  if (busy()) return false;
  const index = await loadIndex();
  const files = textFiles(index, work, version);
  if (!files.length) return false;
  const v = getVersion(version);
  const ok = await run(`${v?.abbr ?? version} text`, TEXT_CACHE, files, true, force);
  if (ok) {
    const have = (await cachedUnder(TEXT_CACHE, [textPrefix(work, version)])).length;
    writeSaved({ ...readSaved(), [textKey(work, version)]: { kind: "text", work, version, bytes: index.texts[`${work}/${version}`].bytes, at: Date.now(), files: have } });
    void checkSaved();
  }
  return ok;
}

export async function downloadAudio(r: Recording, books: string[]): Promise<boolean> {
  if (busy()) return false;
  const index = await loadIndex();
  const files = audioFiles(index, r, books);
  if (!files.length) return false;
  const v = getVersion(r.version);
  const ok = await run(`${v?.abbr ?? r.version} audio · ${r.label.split(" · ")[0]}`, AUDIO_CACHE, files);
  if (ok) {
    const saved = readSaved();
    const prev = saved[audioKey(r.version, r.voice)];
    const all = [...new Set([...(prev?.kind === "audio" ? prev.books : []), ...books])];
    const sizes = index.audio[r.id] ?? {};
    const have = (await cachedUnder(AUDIO_CACHE, all.map((b) => audioPrefix(r.version, r.voice, b)))).length;
    saved[audioKey(r.version, r.voice)] = { kind: "audio", version: r.version, voice: r.voice, books: all, bytes: all.reduce((a, b) => a + (sizes[b]?.[0] ?? 0), 0), at: Date.now(), files: have };
    writeSaved(saved);
    void checkSaved();
  }
  return ok;
}

/** Download a saved entry again (fills anything the browser cleared; text also picks up corrections). */
export async function refreshDownload(key: string): Promise<boolean> {
  const s = readSaved()[key];
  if (!s || busy()) return false;
  // Text: fetched again over the saved copy (kept until each new file arrives), picking up corrections.
  if (s.kind === "text") return downloadText(s.work, s.version, true);
  const r = getRecordings().find((x) => x.version === s.version && x.voice === s.voice);
  return r ? downloadAudio(r, s.books) : false;
}

/** Delete one saved entry's files (found by path, so it works offline too). */
export async function removeDownload(key: string) {
  const s = readSaved()[key];
  if (!s) return;
  const cache = await caches.open(cacheOf(s));
  // Audio: everything of that voice, so half-finished books from a stopped download go too.
  const prefixes = s.kind === "audio" ? [`${AUDIO_BASE}/${s.version}/${s.voice}/`] : prefixesOf(s);
  for (const req of await cachedUnder(cacheOf(s), prefixes)) await cache.delete(req);
  const saved = readSaved();
  delete saved[key];
  writeSaved(saved);
  void checkSaved();
}

/** Remove every download (both caches), including any half-finished ones. */
export async function removeAllDownloads() {
  await caches.delete(TEXT_CACHE);
  await caches.delete(AUDIO_CACHE);
  writeSaved({});
  emit({ missing: {} });
}
