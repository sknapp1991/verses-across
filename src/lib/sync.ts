"use client";
/**
 * Sync codes: keep notes, highlights, favorites, progress, goals, plans and settings the same on every
 * device that has the same code. No account: the code is the key. Everything is encrypted on the
 * device (secret-code.ts) before upload; the server stores bytes it can't read.
 *
 * Merging: study items by newest change (deletions are remembered for 90 days); reading activity per
 * device (each device only adds to its own, so totals never double; the device id outlives turning sync
 * off and on); goals, plans and settings entry by entry (each goal, each plan, each setting), the most
 * recently changed one winning, with removals remembered, so changes on two devices don't undo each other.
 * Articles (read ticks, saved items, reflection answers) and study groups go the same way, entry by entry (my brother's
 * ticket 2d90a8f3, Nov 25). A group joined from two browsers is one member after syncing: the identity holding a role
 * (owner, then mod), else the one that joined first, is kept everywhere, and the other's card is taken out of the group.
 * The study lab's earned badges and badges the team gave (issued tokens) go entry by entry too ("lab", "badges"; Nov 26).
 */
import { useSyncExternalStore } from "react";
import { getOtherActivity, getOwnActivity, setOtherActivity, type Activity } from "./activity";
import { getGoals, setGoals, type Goal } from "./goals";
import { getStartedPlans, setStartedPlans } from "./plans";
import { deriveKeys, newCode, normalizeCode, open, seal, type CodeKeys } from "./secret-code";
import { getSettings, SYNCED_SETTINGS, updateSettings, type Settings } from "./settings";
import { onLocalChange, stampOf } from "./stamps";
import { allItems, getDeleted, mergeFromSync, onStudyChange, type StudyItem } from "./study";
import { toast } from "./ui-store";
import { isPrivate, PrivateModeError } from "./privacy";
import { dropIdentity, flushDrops, getGroups, pickIdentity, setGroupsFromSync, type MyGroup } from "./groups";
import { readEarned, setEarnedFromSync } from "./lab-badges";
import { savedBadges, setBadgesFromSync, tokenId } from "./issued-badges";

type Payload = {
  v: 1;
  at: number;
  items: StudyItem[];
  deleted: Record<string, number>;
  activity: Record<string, Activity>;
  goals: { at: number; list: Goal[] };
  plans: { at: number; data: Record<string, { start: number }> };
  settings: { at: number; data: Partial<Settings> };
  devices: Record<string, { name: string; seen: number }>;
  /** Entry-by-entry versions of goals, plans and settings (newer clients); the blobs above stay for older ones. */
  entries?: Partial<Record<Area, Entries>>;
};

/** lab: the study lab's earned badges (badge id -> day earned); badges: issued badge tokens, by badge id (Nov 26). */
type Area = "goals" | "plans" | "settings" | "articles" | "groups" | "lab" | "badges";
const AREAS: Area[] = ["goals", "plans", "settings", "articles", "groups", "lab", "badges"];
/** Articles' storage on the device (article-study.ts, article-reader.tsx): what's saved, read and answered. */
const ART = { saved: "va-article-saved:v1", read: "va-article-read:v1", answers: "va-article-answers:v1" } as const;
const readJson = <T,>(key: string, empty: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? empty;
  } catch {
    return empty;
  }
};
/** key -> when it last changed and its value as JSON (null = removed). */
type Entries = Record<string, { at: number; v: string | null }>;

type Saved = { code: string; device: string; etag: string | null; last: number };
export type SyncState = {
  on: boolean;
  code: string | null;
  status: "off" | "syncing" | "ok" | "error";
  last: number;
  error: string | null;
  devices: number;
  /** A sync link was opened: the code waiting for the person to confirm. */
  pending: string | null;
};

const KEY = "va-sync:v1";
const ENTRIES_KEY = "va-sync-entries:v1";
const DEVICE_KEY = "va-sync-device:v1";
let state: SyncState = { on: false, code: null, status: "off", last: 0, error: null, devices: 0, pending: null };
const OFF = state;
const subs = new Set<() => void>();
const set = (p: Partial<SyncState>) => {
  state = { ...state, ...p };
  subs.forEach((l) => l());
};
export function useSync() {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => state,
    () => OFF,
  );
}

function readSaved(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    return s?.code ? s : null;
  } catch {
    return null;
  }
}
function writeSaved(s: Saved | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

/** This device's id in the synced reading activity. Kept when sync is turned off, so rejoining never counts its history twice. */
function deviceId(fallback?: string): string {
  try {
    const id = localStorage.getItem(DEVICE_KEY);
    if (id) return id;
    const fresh = fallback ?? crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return fallback ?? crypto.randomUUID();
  }
}

function readEntries(): Record<Area, Entries> {
  try {
    return { goals: {}, plans: {}, settings: {}, articles: {}, groups: {}, lab: {}, badges: {}, ...(JSON.parse(localStorage.getItem(ENTRIES_KEY) ?? "{}") as Partial<Record<Area, Entries>>) };
  } catch {
    return { goals: {}, plans: {}, settings: {}, articles: {}, groups: {}, lab: {}, badges: {} };
  }
}
function writeEntries(e: Record<Area, Entries>) {
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(e));
  } catch {
    /* private mode */
  }
}

/** What this device has now, per area, as key -> JSON. */
function localValues(area: Area): Record<string, string> {
  const out: Record<string, string> = {};
  if (area === "goals") for (const g of getGoals()) out[g.id] = JSON.stringify(g);
  else if (area === "plans") for (const [id, p] of Object.entries(getStartedPlans())) out[id] = JSON.stringify(p);
  else if (area === "articles") {
    // s:<id> a saved item · r:<slug>|<depth> the day it was marked read · a:<question key> a reflection answer
    for (const [id, ref] of Object.entries(readJson<Record<string, unknown>>(ART.saved, {}))) out[`s:${id}`] = JSON.stringify(ref);
    for (const [slug, depths] of Object.entries(readJson<Record<string, Record<string, string>>>(ART.read, {})))
      for (const [d, day] of Object.entries(depths ?? {})) if (day) out[`r:${slug}|${d}`] = JSON.stringify(day);
    for (const [k, v] of Object.entries(readJson<Record<string, string>>(ART.answers, {}))) if (v) out[`a:${k}`] = JSON.stringify(v);
  } else if (area === "groups") for (const g of getGroups()) out[g.code] = JSON.stringify(g);
  else if (area === "lab") for (const [id, day] of Object.entries(readEarned())) out[id] = JSON.stringify(day);
  else if (area === "badges")
    // each kept badge (token + its holder key; sync is end-to-end encrypted), kinds this app doesn't know included
    for (const kb of savedBadges()) {
      const id = tokenId(kb.t);
      if (id) out[id] = JSON.stringify(kb);
    }
  else for (const [k, v] of Object.entries(pickSettings(getSettings()))) out[k] = JSON.stringify(v ?? null);
  return out;
}

/** The articles' storage rebuilt from synced entries (then the bookcase, My Study and badges update). */
function applyArticles(live: [string, { at: number; v: string }][]) {
  const saved: Record<string, unknown> = {};
  const read: Record<string, Record<string, string>> = {};
  const answers: Record<string, string> = {};
  for (const [k, e] of live) {
    const v = JSON.parse(e.v);
    if (k.startsWith("s:")) saved[k.slice(2)] = v;
    else if (k.startsWith("r:")) {
      const [slug, d] = [k.slice(2, k.lastIndexOf("|")), k.slice(k.lastIndexOf("|") + 1)];
      (read[slug] ??= {})[d] = v;
    } else if (k.startsWith("a:")) answers[k.slice(2)] = v;
  }
  try {
    localStorage.setItem(ART.saved, JSON.stringify(saved));
    localStorage.setItem(ART.read, JSON.stringify(read));
    localStorage.setItem(ART.answers, JSON.stringify(answers));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event("va-article-study"));
  window.dispatchEvent(new Event("va-progress"));
}

/**
 * Before merging groups: a group this device is in under one identity and the synced copy under another (joined from
 * two browsers) keeps one identity, the same on every device: owner, then mod, then the first to join. The synced entry
 * is replaced by the kept one (stamped newer, so every device takes it) and the other card leaves the group.
 */
async function oneIdentityPerGroup(remote: Entries | null): Promise<Entries | null> {
  if (!remote) return remote;
  const out: Entries = { ...remote };
  const newest = Math.max(Date.now(), ...Object.values(remote).map((e) => e.at)) + 1;
  for (const mine of getGroups()) {
    const r = remote[mine.code];
    if (!r?.v) continue;
    const theirs = JSON.parse(r.v) as MyGroup;
    if (theirs.secret === mine.secret) continue;
    const pick = await pickIdentity(mine, theirs);
    if (pick === "gone") continue; // the group no longer exists: the synced copy stands, nothing to remove
    if (!pick) {
      delete out[mine.code]; // roles unreadable (offline?): keep this device's identity for now, decide next time
      continue;
    }
    out[mine.code] = { at: newest, v: JSON.stringify(pick.keep) };
    await dropIdentity(pick.drop).catch(() => null); // (kept in a retry list until the server confirms)
  }
  return out;
}

/** Older payloads only have whole blobs: read them as entries all stamped with the blob's time. */
function legacyEntries(remote: Payload, area: Area): Entries {
  const out: Entries = {};
  if (area === "articles" || area === "groups" || area === "lab" || area === "badges") return out; // (not in older payloads)
  if (area === "goals") for (const g of remote.goals?.list ?? []) out[g.id] = { at: remote.goals.at, v: JSON.stringify(g) };
  else if (area === "plans") for (const [id, p] of Object.entries(remote.plans?.data ?? {})) out[id] = { at: remote.plans.at, v: JSON.stringify(p) };
  else for (const [k, v] of Object.entries(remote.settings?.data ?? {})) out[k] = { at: remote.settings.at, v: JSON.stringify(v ?? null) };
  return out;
}

/**
 * Merge one area entry by entry. Local changes since the last sync are stamped with the area's last
 * local change time; a removed entry becomes a removal marker. For each key the newer side wins
 * (on a tie, the synced copy). Applies the result here and returns it for upload.
 */
function mergeArea(area: Area, remote: Entries | null, known: Entries): Entries {
  const now = localValues(area);
  // A device joining an existing code: its settings (mostly defaults) shouldn't override the synced ones.
  const joining = area === "settings" && remote !== null && !Object.keys(known).length;
  const stamp = joining ? 0 : stampOf(area);
  const mine: Entries = { ...known };
  for (const [k, v] of Object.entries(now)) if (mine[k]?.v !== v) mine[k] = { at: stamp, v };
  for (const [k, e] of Object.entries(mine)) if (e.v !== null && !(k in now)) mine[k] = { at: stamp, v: null };
  const merged: Entries = { ...mine };
  for (const [k, e] of Object.entries(remote ?? {})) if (!merged[k] || e.at >= merged[k].at) merged[k] = e;
  // a reflection answered differently on two devices before they first synced: keep both texts, not just the newer
  if (area === "articles")
    for (const [k, e] of Object.entries(remote ?? {})) {
      if (!k.startsWith("a:") || known[k] || !e.v || !now[k] || e.v === now[k]) continue;
      const [a, b] = [JSON.parse(now[k]) as unknown, JSON.parse(e.v) as unknown];
      if (typeof a !== "string" || typeof b !== "string") continue;
      merged[k] = { at: Math.max(e.at, mine[k]?.at ?? 0) + 1, v: JSON.stringify(a.includes(b) ? a : b.includes(a) ? b : b + "\n\n" + a) };
    }

  const changed = Object.keys(merged).some((k) => (merged[k].v ?? undefined) !== now[k]);
  if (changed) {
    const live = Object.entries(merged).filter(([, e]) => e.v !== null) as [string, { at: number; v: string }][];
    if (area === "goals") {
      const order = getGoals().map((g) => g.id);
      const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
      live.sort(([a], [b]) => rank(a) - rank(b));
      setGoals(live.map(([, e]) => JSON.parse(e.v) as Goal), true);
    } else if (area === "plans") setStartedPlans(Object.fromEntries(live.map(([k, e]) => [k, JSON.parse(e.v)])));
    else if (area === "articles") applyArticles(live);
    else if (area === "groups") {
      const order = getGroups().map((g) => g.code);
      const rank = (c: string) => (order.includes(c) ? order.indexOf(c) : order.length);
      live.sort(([a], [b]) => rank(a) - rank(b));
      // a group left on another device: this device's card goes too (it may have republished it meanwhile)
      for (const g of getGroups()) if (!live.some(([c]) => c === g.code)) void dropIdentity(g).catch(() => null);
      setGroupsFromSync(live.map(([, e]) => JSON.parse(e.v) as MyGroup));
    } else if (area === "lab") {
      const earned: Record<string, string> = {};
      for (const [k, e] of live) {
        const v = JSON.parse(e.v) as unknown;
        if (typeof v === "string") earned[k] = v;
      }
      setEarnedFromSync(earned);
    } else if (area === "badges") {
      // the newest kept first, as on the device that kept it; each token is checked again wherever it's shown
      const order = savedBadges().map((kb) => tokenId(kb.t));
      const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : -1);
      live.sort(([a], [b]) => rank(a) - rank(b));
      setBadgesFromSync(live.map(([, e]) => JSON.parse(e.v) as unknown));
    } else {
      const patch: Record<string, unknown> = {};
      for (const [k, e] of live) if ((SYNCED_SETTINGS as readonly string[]).includes(k) && e.v !== now[k]) patch[k] = JSON.parse(e.v);
      if (Object.keys(patch).length) updateSettings(patch as Partial<Settings>, true);
    }
  }
  return merged;
}

function deviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return br ? `${os} · ${br}` : os;
}

let keys: { code: string; k: CodeKeys } | null = null;
async function keysFor(code: string) {
  if (keys?.code !== code) keys = { code, k: await deriveKeys(code, "sync") };
  return keys.k;
}

function pickSettings(s: Settings): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const k of SYNCED_SETTINGS) out[k] = s[k];
  return out as Partial<Settings>;
}

/** Merge what's on the server into this device, then build the combined payload to upload. */
async function mergeAndBuild(remote: Payload | null, device: string): Promise<Payload> {
  const now = Date.now();
  await flushDrops().catch(() => null); // group cards still to take out (an extra identity, a group left elsewhere)
  let deleted = getDeleted();
  if (remote) {
    deleted = await mergeFromSync(remote.items ?? [], remote.deleted ?? {});
    const others = { ...getOtherActivity() };
    for (const [d, a] of Object.entries(remote.activity ?? {})) if (d !== device) others[d] = a;
    setOtherActivity(others);
  }
  const known = readEntries();
  const entries = {} as Record<Area, Entries>;
  for (const area of AREAS) {
    let r = remote ? (remote.entries?.[area] ?? legacyEntries(remote, area)) : null;
    if (area === "groups") r = await oneIdentityPerGroup(r);
    entries[area] = mergeArea(area, r, known[area]);
  }
  writeEntries(entries);
  const newest = (e: Entries) => Math.max(0, ...Object.values(e).map((x) => x.at));
  const activity: Record<string, Activity> = { ...(remote?.activity ?? {}), ...getOtherActivity(), [device]: getOwnActivity() };
  const devices = { ...(remote?.devices ?? {}), [device]: { name: deviceName(), seen: now } };
  return {
    v: 1,
    at: now,
    items: await allItems(),
    deleted,
    activity,
    goals: { at: newest(entries.goals), list: getGoals() },
    plans: { at: newest(entries.plans), data: getStartedPlans() },
    settings: { at: newest(entries.settings), data: pickSettings(getSettings()) },
    devices,
    entries,
  };
}

let running: Promise<void> | null = null;
let again = false;

/** Pull, merge, push (retrying if another device wrote in between). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const saved = readSaved();
    if (!saved) return;
    if (isPrivate()) return set({ status: "error", error: new PrivateModeError("Sync").message }); // paused; resumes when it's off
    set({ status: "syncing", error: null });
    try {
      const k = await keysFor(saved.code);
      for (let attempt = 0; attempt < 4; attempt++) {
        if (isPrivate()) return set({ status: "error", error: new PrivateModeError("Sync").message }); // switched on mid-sync
        const res = await fetch(`/api/sync/${k.id}`, { cache: "no-store" });
        let remote: Payload | null = null;
        let etag: string | null = null;
        if (res.ok) {
          etag = res.headers.get("etag");
          try {
            remote = await open<Payload>(k.key, await res.arrayBuffer());
          } catch {
            throw new Error("This code’s data couldn’t be unlocked.");
          }
        } else if (res.status === 404 && (saved.etag || saved.last)) {
          // The synced copy was deleted (on this or another device): stop here instead of re-creating it.
          turnOffSync();
          toast("The synced copy was deleted, so sync is off on this device. Your data here is kept.", 6000);
          return;
        } else if (res.status !== 404) throw new Error((await res.json().catch(() => null))?.error ?? "Sync is unavailable right now.");
        const payload = await mergeAndBuild(remote, saved.device);
        if (isPrivate()) return set({ status: "error", error: new PrivateModeError("Sync").message }); // nothing uploads
        const put = await fetch(`/api/sync/${k.id}`, {
          method: "PUT",
          headers: { "content-type": "application/octet-stream", ...(etag ? { "if-match": etag } : { "if-none-match": "*" }) },
          body: (await seal(k.key, payload)) as BodyInit,
        });
        if (put.status === 412) continue; // another device just synced: merge again
        if (!put.ok) throw new Error((await put.json().catch(() => null))?.error ?? "Couldn’t upload.");
        if (readSaved()?.code !== saved.code) return; // turned off or switched while this was running
        const last = Date.now();
        writeSaved({ ...saved, etag: put.headers.get("etag"), last });
        set({ status: "ok", last, devices: Object.keys(payload.devices).length });
        return;
      }
      throw new Error("Other devices are busy syncing. Trying again shortly.");
    } catch (e) {
      set({ status: "error", error: navigator.onLine ? (e as Error).message : "Offline: will sync when you’re back online." });
    }
  })().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return running;
}

/** Start syncing with a new code (returns it). */
export async function turnOnSync(): Promise<string> {
  if (isPrivate()) throw new PrivateModeError("Sync");
  const code = newCode();
  writeSaved({ code, device: deviceId(), etag: null, last: 0 });
  set({ on: true, code, status: "syncing", pending: null });
  await syncNow();
  return code;
}

/** Join an existing code from another device. Returns an error message, or null when joined. */
export async function joinSync(input: string): Promise<string | null> {
  const code = normalizeCode(input);
  if (!code) return "That doesn’t look like a sync code (25 letters and numbers).";
  if (isPrivate()) return new PrivateModeError("Sync").message;
  const k = await deriveKeys(code, "sync");
  const res = await fetch(`/api/sync/${k.id}`, { cache: "no-store" }).catch(() => null);
  if (!res) return "You’re offline.";
  if (res.status === 404) return "No data was found for that code. Check it and try again.";
  if (!res.ok) return "Sync is unavailable right now.";
  try {
    await open(k.key, await res.arrayBuffer());
  } catch {
    return "That code didn’t unlock anything. Check it and try again.";
  }
  const prev = readSaved();
  if (running) await running.catch(() => null);
  writeSaved({ code, device: deviceId(prev?.device), etag: null, last: 0 });
  set({ on: true, code, status: "syncing", pending: null });
  await syncNow();
  return null;
}

/** Stop syncing on this device (data stays here and on the other devices). */
export function turnOffSync() {
  const saved = readSaved();
  if (saved) deviceId(saved.device); // keep this device's id for next time
  writeSaved(null);
  setOtherActivity({});
  try {
    localStorage.removeItem(ENTRIES_KEY);
  } catch {
    /* private mode */
  }
  set({ on: false, code: null, status: "off", last: 0, error: null, devices: 0 });
}

/** Delete the synced copy from the server. Other devices notice on their next sync and turn sync off. */
export async function deleteSyncedData(): Promise<boolean> {
  const saved = readSaved();
  if (!saved) return true;
  const k = await keysFor(saved.code);
  turnOffSync(); // first, so no sync on this device can upload it again
  if (running) await running.catch(() => null);
  const res = await fetch(`/api/sync/${k.id}`, { method: "DELETE" }).catch(() => null);
  return !!res && (res.ok || res.status === 404);
}

/** A sync link was opened: connect after the person confirms, or forget it. */
export async function confirmPendingSync(yes: boolean): Promise<string | null> {
  const code = state.pending;
  set({ pending: null });
  if (!yes || !code) return null;
  return joinSync(code);
}

/* ---------- automatic syncing ---------- */

let started = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const soon = (ms = 4000) => {
  if (!readSaved()) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
};

export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  const saved = readSaved();
  if (saved) set({ on: true, code: saved.code, last: saved.last, status: "ok" });
  // A sync link (#sync=CODE) from a QR code or message: ask before connecting (a link from someone
  // else would otherwise copy this device's notes into their sync), then tidy the address bar.
  const m = /[#&]sync=([0-9A-Za-z-]+)/.exec(location.hash);
  if (m) history.replaceState(null, "", location.pathname + location.search);
  const code = m ? normalizeCode(m[1]) : null;
  if (code && code !== saved?.code) set({ pending: code });
  if (saved) void syncNow();
  onStudyChange(() => soon());
  onLocalChange(() => soon());
  setInterval(() => document.visibilityState === "visible" && soon(0), 3 * 60_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") soon(500);
    else if (readSaved()) void syncNow(); // leaving: upload reading time
  });
  window.addEventListener("online", () => soon(500));
}
