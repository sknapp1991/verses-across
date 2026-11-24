"use client";
/**
 * Unread group chat (my brother's ticket a92da77c, Nov 23: the chat is hard to find unless you know it's there):
 * how many messages each of my groups has that I haven't seen. Only the log's plain parts are used (who sent a line,
 * to whom, when); no message is opened. "Seen" is when this device last showed that group's chat (group-chat.tsx
 * marks it). Checked every 2 minutes while the page is visible (one request per group, with the log's etag so an
 * unchanged chat costs little), and not at all for 10 minutes after the server says "too many".
 */
import { useEffect, useSyncExternalStore } from "react";
import { getGroups, keysFor, memberId, type MyGroup } from "./groups";

const SEEN = "va-group-chat-seen:v1"; // { [group code]: ms of the newest line shown }
type Raw = { id: string; from: string; to?: string; at: number };

let unread: Record<string, number> = {};
const subs = new Set<() => void>();
const emit = () => subs.forEach((l) => l());
const etags = new Map<string, { etag: string | null; msgs: Raw[] }>();

function seen(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** The chat of `code` was shown up to `at` (its newest line): nothing before that is unread. */
export function markChatSeen(code: string, at: number) {
  const s = seen();
  if ((s[code] ?? 0) >= at) return;
  s[code] = at;
  try {
    localStorage.setItem(SEEN, JSON.stringify(s));
  } catch {
    /* private mode */
  }
  if (unread[code]) {
    unread = { ...unread, [code]: 0 };
    emit();
  }
}

async function countFor(g: MyGroup, since: number): Promise<number> {
  const k = await keysFor(g.code);
  const had = etags.get(g.code);
  const res = await fetch(`/api/group/${k.id}/chat${had?.etag ? `?etag=${encodeURIComponent(had.etag)}` : ""}`, { cache: "no-store" });
  if (res.status === 429) pausedUntil = Date.now() + 10 * 60_000; // (the server asked us to slow down)
  if (!res.ok) return unread[g.code] ?? 0;
  const data = (await res.json()) as { same?: true; etag: string | null; msgs?: Raw[] };
  const msgs = data.same ? (had?.msgs ?? []) : (data.msgs ?? []);
  if (!data.same) etags.set(g.code, { etag: data.etag, msgs: msgs.map((m) => ({ id: m.id, from: m.from, to: m.to, at: m.at })) });
  const me = await memberId(g.secret);
  return msgs.filter((m) => m.at > since && m.from !== me && (!m.to || m.to === me)).length;
}

let pausedUntil = 0;
async function check() {
  const groups = getGroups();
  if (!groups.length || Date.now() < pausedUntil) return;
  const s = seen();
  const next: Record<string, number> = {};
  for (const g of groups) {
    try {
      // (a first look at a group: what's there already counts as seen, so an old chat isn't all "new")
      if (s[g.code] == null) {
        await countFor(g, Number.MAX_SAFE_INTEGER);
        const newest = Math.max(0, ...(etags.get(g.code)?.msgs ?? []).map((m) => m.at));
        markChatSeen(g.code, newest || Date.now());
        next[g.code] = 0;
      } else next[g.code] = await countFor(g, s[g.code]);
    } catch {
      next[g.code] = unread[g.code] ?? 0; // offline, Private mode…
    }
  }
  if (JSON.stringify(next) !== JSON.stringify(unread)) {
    unread = next;
    emit();
  }
}

let running = 0;
/** Unread messages per group code (starts the 90-second check while something on screen uses it). */
export function useGroupsUnread(): Record<string, number> {
  useEffect(() => {
    if (running++ === 0) {
      void check();
      timer = window.setInterval(() => document.visibilityState === "visible" && void check(), 120_000);
    }
    return () => {
      if (--running === 0) window.clearInterval(timer);
    };
  }, []);
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => unread,
    () => EMPTY,
  );
}
let timer = 0;
const EMPTY: Record<string, number> = {};

/** All unread messages across my groups. */
export const totalUnread = (u: Record<string, number>) => Object.values(u).reduce((n, x) => n + x, 0);
