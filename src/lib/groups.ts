"use client";
/**
 * Study groups: friends share a group code and see each other's progress. Each member chooses a name
 * and what to share; their card is encrypted with the group's key (only people with the code can read
 * it) and only their own device can change or remove it. No accounts.
 */
import { useSyncExternalStore } from "react";
import { dayKey, getActivity, periodStart, streaks, totals } from "./activity";
import { findBook } from "./catalog";
import { bookProgress } from "./goals";
import { BADGES, earned, levelOf, xpOf } from "./achievements";
import { statsNow } from "./stats-now";
import { deriveKeys, fromBase64, hex, newCode, normalizeCode, open, seal, type CodeKeys } from "./secret-code";
import { allItems } from "./study";
import { isPrivate, PrivateModeError } from "./privacy";

export type Share = { progress: boolean; reading: boolean };
/** `dh`: this device's key pair for whispers in the group chat (made the first time the chat opens). */
export type MyGroup = { code: string; name: string; me: string; secret: string; share: Share; joined: number; dh?: { pub: JsonWebKey; priv: JsonWebKey } };
/**
 * A group's shared settings (sealed with the group key, so the server never reads them). `book` is the book the group
 * is reading now; `list` (my brother's ticket a92da77c, Nov 23) the others: up next (no `done`), and finished
 * together (`done`: when). Older apps only know `book`, which stays the current one.
 */
export type GroupBook = { work: string; book: string };
export type GroupMeta = { name: string; book?: GroupBook | null; list?: (GroupBook & { done?: number })[]; created: number };
export type Card = {
  name: string;
  at: number;
  streak?: number;
  todayMins?: number;
  weekMins?: number;
  weekChapters?: number;
  studied?: number;
  /** Chapters of the group's book studied; `of` says which book (older apps leave it out). */
  book?: { done: number; total: number; of?: { work: string; book: string } } | null;
  /** Chapters of the group's book listened to all the way through (hub 65b00b23). */
  heard?: { done: number; total: number } | null;
  /** The same for every book on the group's readings, by "work/book" (hub a92da77c: each person views any of them). */
  books?: Record<string, { studied: number; heard: number; total: number }>;
  /** The scorecard others see when they tap this member's name (only with progress shared). */
  profile?: Profile;
  reading?: { work: string; book: string; chapter: number } | null;
  /** Public key for whispers in the group chat (ECDH P-256), when this member has opened the chat. */
  pub?: JsonWebKey;
};
export type Profile = {
  level: number;
  title: string;
  /** Earned badge ids (achievements.ts BADGES). */
  badges: string[];
  chaptersRead: number;
  chaptersHeard: number;
  studied: number;
  bestStreak: number;
  /** All-time reading and listening, in minutes. */
  mins: number;
  traditions: number;
  booksDone: number;
};
/** `seen`: when this member's app last wrote their card (opened the group), from the server. */
export type Member = Card & { id: string; mine: boolean; seen: number };
/** Who runs the group, by member id (server: src/app/api/group/[gid]/roles/route.ts). Null: no owner yet. */
export type Roles = { owner: string; mods: Record<string, number>; joined: Record<string, number>; at: number };
export type GroupView = { meta: GroupMeta | null; metaEtag: string | null; members: Member[]; roles: Roles | null; me: string };

const KEY = "va-groups:v1";
let groups: MyGroup[] | null = null;
const subs = new Set<() => void>();
const NONE: MyGroup[] = [];
export function getGroups(): MyGroup[] {
  if (groups) return groups;
  try {
    const g = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    groups = Array.isArray(g) ? g : [];
  } catch {
    groups = [];
  }
  return groups!;
}
function saveGroups(next: MyGroup[]) {
  groups = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  subs.forEach((l) => l());
  if (typeof window !== "undefined") window.dispatchEvent(new Event("va-progress")); // (badges: PROGRESS_EVENT)
}
export function useGroups(): MyGroup[] {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    getGroups,
    () => NONE,
  );
}

const keyCache = new Map<string, Promise<CodeKeys>>();
/** Every group request starts here, so Private mode pauses them all (src/lib/privacy.ts). */
export const keysFor = (code: string) => {
  if (isPrivate()) return Promise.reject(new PrivateModeError("Study groups"));
  return keysAlways(code);
};
/** Leaving a group (a delete that carries nothing about the reader) works in Private mode too. */
const keysAlways = (code: string) => {
  let p = keyCache.get(code);
  if (!p) keyCache.set(code, (p = deriveKeys(code, "group")));
  return p;
};
export const memberId = async (secret: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));

/** My card for a group, from what this device knows and what I chose to share. */
async function myCard(g: MyGroup, meta: GroupMeta | null): Promise<Card> {
  const card: Card = { name: g.me.slice(0, 40), at: Date.now(), ...(g.dh ? { pub: g.dh.pub } : {}) };
  if (g.share.progress) {
    const a = getActivity();
    const items = await allItems();
    const map = new Map(items.map((i) => [i.id, i]));
    // each time through counts (re-reads too, as in the badges)
    const studyDays = items.filter((i) => i.kind === "studied").flatMap((i) => [i.createdAt, ...(Array.isArray(i.again) ? i.again : [])].map((t) => dayKey(t)));
    const t = totals(a, periodStart("week"));
    const d = a.days[dayKey()];
    card.streak = streaks(a, studyDays).current;
    card.todayMins = d ? Math.round((d.r + d.l) / 60) : 0;
    card.weekMins = Math.round((t.read + t.listen) / 60);
    card.weekChapters = t.chapters;
    card.studied = items.filter((i) => i.kind === "studied").length;
    const bp = meta?.book ? bookProgress(map, meta.book.work, meta.book.book) : null;
    card.book = bp && meta?.book ? { ...bp, of: { work: meta.book.work, book: meta.book.book } } : null;
    if (meta?.book) {
      // chapters of the book heard (every verse played), at any time
      const prefix = `${meta.book.work}/${meta.book.book}/`;
      const total = card.book?.total ?? findBook(meta.book.work, meta.book.book)?.chapters ?? 0;
      let done = 0;
      for (const k of totals(a).heard.keys()) if (k.startsWith(prefix)) done++;
      card.heard = { done: Math.min(done, total), total };
    } else card.heard = null;
    // every book on the group's readings (the focus, up next and finished), at most 20
    const heardKeys = [...totals(a).heard.keys()];
    const readings = [...(meta?.book ? [meta.book] : []), ...(Array.isArray(meta?.list) ? meta!.list : [])].slice(0, 51);
    card.books = {};
    for (const b of readings) {
      if (!b || typeof b.work !== "string" || typeof b.book !== "string") continue;
      const p = bookProgress(map, b.work, b.book);
      const total = p?.total ?? findBook(b.work, b.book)?.chapters ?? 0;
      const prefix = `${b.work}/${b.book}/`;
      card.books[`${b.work}/${b.book}`] = { studied: p?.done ?? 0, heard: Math.min(total, heardKeys.filter((k) => k.startsWith(prefix)).length), total };
    }
    const s = statsNow(a, map);
    const lv = levelOf(xpOf(s));
    card.profile = {
      level: lv.level,
      title: lv.title,
      badges: BADGES.filter((b) => earned(b, s)).map((b) => b.id),
      chaptersRead: s.chaptersRead,
      chaptersHeard: s.chaptersHeard,
      studied: s.studied,
      bestStreak: s.bestStreak,
      mins: Math.round((s.readSecs + s.listenSecs) / 60),
      traditions: s.traditions,
      booksDone: s.booksDone,
    };
  }
  if (g.share.reading) {
    const m = /^\/read\/([^/]+)\/([^/]+)\/(\d+)/.exec(location.pathname);
    card.reading = m ? { work: m[1], book: m[2], chapter: Number(m[3]) } : null;
  }
  return card;
}

async function publish(g: MyGroup, meta: GroupMeta | null) {
  const k = await keysFor(g.code);
  const res = await fetch(`/api/group/${k.id}/${await memberId(g.secret)}`, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream", "x-member-key": g.secret },
    body: (await seal(k.key, await myCard(g, meta))) as BodyInit,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn’t update the group.");
}

/** Everyone's cards (and refresh mine first). */
export async function loadGroup(g: MyGroup, opts: { publishFirst?: boolean } = {}): Promise<GroupView> {
  const k = await keysFor(g.code);
  const get = async () => {
    const res = await fetch(`/api/group/${k.id}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn’t load the group.");
    return (await res.json()) as { meta: { etag: string; data: string } | null; members: { id: string; data: string; at?: string }[]; roles?: Roles | null };
  };
  let raw = await get();
  let meta: GroupMeta | null = null;
  if (raw?.meta) meta = await open<GroupMeta>(k.key, fromBase64(raw.meta.data)).catch(() => null);
  if (meta) noteFinished(g, meta);
  if (opts.publishFirst !== false) {
    await publish(g, meta);
    raw = await get();
  }
  if (!raw) throw new Error("This group no longer exists.");
  const mine = await memberId(g.secret);
  const members: Member[] = [];
  for (const m of raw.members) {
    const c = await open<Card>(k.key, fromBase64(m.data)).catch(() => null);
    if (c) members.push({ ...c, id: m.id, mine: m.id === mine, seen: m.at ? Date.parse(m.at) : 0 });
  }
  members.sort((a, b) => (b.weekMins ?? -1) - (a.weekMins ?? -1) || a.name.localeCompare(b.name));
  return { meta, metaEtag: raw.meta?.etag ?? null, members, roles: raw.roles ?? null, me: mine };
}

/** Change the group's name or shared book. */
export async function updateMeta(g: MyGroup, meta: GroupMeta, etag: string | null) {
  const k = await keysFor(g.code);
  const res = await fetch(`/api/group/${k.id}`, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream", "x-member-key": g.secret, ...(etag ? { "if-match": etag } : { "if-none-match": "*" }) },
    body: (await seal(k.key, meta)) as BodyInit,
  });
  if (res.status === 412) throw new Error("Someone else just changed the group. Try again.");
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn’t save.");
  if (meta.name !== g.name) saveGroups(getGroups().map((x) => (x.code === g.code ? { ...x, name: meta.name } : x)));
}

/** A roles action (claim, mod, unmod, owner, takeover): see the server route. Throws the server's message. */
export async function groupRole(g: MyGroup, action: "claim" | "mod" | "unmod" | "owner" | "takeover", target?: string): Promise<Roles> {
  const k = await keysFor(g.code);
  const res = await fetch(`/api/group/${k.id}/roles`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-member-key": g.secret },
    body: JSON.stringify({ action, ...(target ? { target } : {}) }),
  });
  const j = (await res.json().catch(() => null)) as { roles?: Roles; error?: string } | null;
  if (!res.ok || !j?.roles) throw new Error(j?.error ?? "Couldn’t change that.");
  return j.roles;
}

/** What I may do in a group: run it (owner, moderator), and whether I'm next in line to take it over (the same rule
 * as the server's takeover, src/app/api/group/[gid]/roles/route.ts). `ownerLeft`: the owner isn't in the group. */
export function myRole(view: GroupView) {
  const r = view.roles;
  const AWAY = 30 * 86_400_000;
  const now = Date.now();
  const active = (id: string) => (view.members.find((m) => m.id === id)?.seen ?? 0) > now - AWAY;
  const owner = !!r && r.owner === view.me;
  const mod = !!r && view.me in r.mods;
  let takeover = false;
  if (r && !owner && !active(r.owner)) {
    const mods = Object.entries(r.mods).filter(([id]) => active(id)).sort((x, y) => x[1] - y[1]);
    const members = view.members.filter((m) => active(m.id) && m.id !== r.owner).sort((x, y) => (r.joined[x.id] ?? now) - (r.joined[y.id] ?? now));
    takeover = (mods.length ? mods[0][0] : members[0]?.id) === view.me;
  }
  return { owner, mod, runs: owner || mod, takeover, unclaimed: !r, ownerLeft: !!r && !view.members.some((m) => m.id === r.owner) };
}
export const roleOf = (r: Roles | null, id: string) => (r?.owner === id ? "Owner" : r && id in r.mods ? "Moderator" : null);

const secret = () => hex(crypto.getRandomValues(new Uint8Array(24)).buffer);

export async function createGroup(name: string, me: string, book: GroupMeta["book"]): Promise<MyGroup> {
  const g: MyGroup = { code: newCode(), name: name.trim().slice(0, 60) || "Study group", me: me.trim().slice(0, 40) || "Me", secret: secret(), share: { progress: true, reading: false }, joined: Date.now() };
  const meta: GroupMeta = { name: g.name, book: book ?? null, created: Date.now() };
  await updateMeta(g, meta, null);
  await publish(g, meta);
  // (the maker is the owner; once more after a moment if the first try fails)
  await groupRole(g, "claim").catch(() => new Promise((r) => setTimeout(r, 1500)).then(() => groupRole(g, "claim")).catch(() => {}));
  saveGroups([...getGroups(), g]);
  return g;
}

/** Join with a code or invite link. Returns an error message, or null. */
export async function joinGroup(input: string, me: string): Promise<string | null> {
  const code = normalizeCode(input.replace(/^.*[#&]group=/, ""));
  if (!code) return "That doesn’t look like a group code.";
  if (getGroups().some((g) => g.code === code)) return "You’re already in this group.";
  const g: MyGroup = { code, name: "Study group", me: me.trim().slice(0, 40) || "Me", secret: secret(), share: { progress: true, reading: false }, joined: Date.now() };
  try {
    const view = await loadGroup(g, { publishFirst: false });
    if (!view.meta) return "That code didn’t unlock a group. Check it and try again.";
    g.name = view.meta.name;
    await publish(g, view.meta);
  } catch (e) {
    return (e as Error).message === "This group no longer exists." ? "No group was found for that code." : (e as Error).message;
  }
  saveGroups([...getGroups(), g]);
  return null;
}

/** Remove my card from the group, then forget the group here. Throws (and keeps the group) if the card couldn't be removed. */
export async function leaveGroup(g: MyGroup) {
  const k = await keysAlways(g.code);
  const res = await fetch(`/api/group/${k.id}/${await memberId(g.secret)}`, { method: "DELETE", headers: { "x-member-key": g.secret } }).catch(() => null);
  if (!res || !(res.ok || res.status === 404)) throw new Error(navigator.onLine ? "Couldn’t leave the group right now. Try again." : "You’re offline. Try again when you’re back online.");
  saveGroups(getGroups().filter((x) => x.code !== g.code));
}

export function updateMyGroup(code: string, patch: Partial<Pick<MyGroup, "me" | "share" | "dh">>) {
  saveGroups(getGroups().map((x) => (x.code === code ? { ...x, ...patch } : x)));
}

export const inviteLink = (g: MyGroup) => `${location.origin}/#group=${g.code}`;
export const bookLabel = (b: GroupMeta["book"]) => (b ? (findBook(b.work, b.book)?.name ?? b.book) : null);

/* ---- The reading list (hub a92da77c): add, switch, finish; nothing is replaced by accident ---- */

/** Books the group finished while I was in it, kept on this device for the "Finished together" badges. */
const FINISHED = "va-group-finished:v1";
function noteFinished(g: MyGroup, meta: GroupMeta) {
  try {
    const have = new Set<string>(JSON.parse(localStorage.getItem(FINISHED) ?? "[]"));
    const before = have.size;
    for (const x of Array.isArray(meta.list) ? meta.list : [])
      if (x && typeof x.done === "number" && x.done >= (g.joined || 0)) have.add(`${g.code}:${x.work}/${x.book}:${x.done}`);
    if (have.size !== before) {
      localStorage.setItem(FINISHED, JSON.stringify([...have]));
      window.dispatchEvent(new Event("va-progress")); // (the badges look again)
    }
  } catch {
    /* fine without */
  }
}
const same = (a: GroupBook | null | undefined, b: GroupBook | null | undefined) => !!a && !!b && a.work === b.work && a.book === b.book;
const cleanList = (meta: GroupMeta) =>
  (Array.isArray(meta.list) ? meta.list : []).filter((x) => x && typeof x.work === "string" && typeof x.book === "string").slice(-50); // (the newest 50)

/** The group's books: now, up next (in order) and finished (newest first). */
export function readingList(meta: GroupMeta | null) {
  if (!meta) return { now: null, next: [] as GroupBook[], finished: [] as (GroupBook & { done: number })[] };
  const list = cleanList(meta);
  return {
    now: meta.book ?? null,
    next: list.filter((x) => !x.done && !same(x, meta.book)),
    finished: list.filter((x): x is GroupBook & { done: number } => typeof x.done === "number").sort((a, b) => b.done - a.done),
  };
}
/** Put a book on the list, after the others (not if it's the current one or already waiting). */
export function withAdded(meta: GroupMeta, b: GroupBook): GroupMeta {
  const list = cleanList(meta);
  if (same(meta.book, b) || list.some((x) => !x.done && same(x, b))) return meta;
  return { ...meta, list: [...list, { work: b.work, book: b.book }] };
}
/** Make a book the current one; the one it replaces goes to the top of Up next. */
export function withCurrent(meta: GroupMeta, b: GroupBook): GroupMeta {
  const list = cleanList(meta).filter((x) => x.done || !same(x, b));
  const was = meta.book;
  return { ...meta, book: { work: b.work, book: b.book }, list: was && !same(was, b) ? [{ work: was.work, book: was.book }, ...list] : list };
}
/** Take a book off Up next. */
export function withRemoved(meta: GroupMeta, b: GroupBook): GroupMeta {
  return { ...meta, list: cleanList(meta).filter((x) => x.done || !same(x, b)) };
}
/** The current book is finished together: into Finished, and the first of Up next (if any) becomes current. */
export function withFinished(meta: GroupMeta): GroupMeta {
  if (!meta.book) return meta;
  const list = cleanList(meta);
  const next = list.find((x) => !x.done && !same(x, meta.book));
  return {
    ...meta,
    book: next ? { work: next.work, book: next.book } : null,
    list: [...list.filter((x) => !(next && !x.done && same(x, next))), { work: meta.book.work, book: meta.book.book, done: Date.now() }],
  };
}

/** Keep my cards fresh while reading (every 5 minutes, and when leaving the page). */
let started = false;
export function startGroups() {
  if (started || typeof window === "undefined") return;
  started = true;
  const refresh = () => {
    for (const g of getGroups()) void loadGroup(g).catch(() => null);
  };
  if (getGroups().length) setTimeout(refresh, 8000);
  setInterval(() => document.visibilityState === "visible" && getGroups().length && refresh(), 5 * 60_000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && getGroups().length && refresh());
}

/** An invite link was opened (#group=CODE): returns the code to offer joining. */
export function pendingInvite(): string | null {
  const m = /[#&]group=([0-9A-Za-z-]+)/.exec(location.hash);
  return m ? normalizeCode(m[1]) : null;
}
