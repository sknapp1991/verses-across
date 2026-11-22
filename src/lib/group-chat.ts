"use client";
/**
 * Study-group chat (hub a3b33a99). Messages are sealed on the device with the group's key (everyone with the group
 * code can read them; the server cannot). A whisper ("/w name message") is sealed with a key only the sender and
 * the recipient can make: ECDH between this device's key pair for the group (MyGroup.dh, made the first time the
 * chat opens; its public half goes on my card) and theirs. Others in the group see nothing of it.
 * See src/app/api/group/[gid]/chat/route.ts.
 */
import { getGroups, keysFor, memberId, updateMyGroup, type Member, type MyGroup } from "./groups";
import { fromBase64, open, seal } from "./secret-code";

const toB64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};

export type ChatLine = {
  id: string;
  from: string; // member id
  at: number;
  text: string;
  /** A whisper: the other person's member id (to them, or from them). */
  whisper?: { to: string };
  /** Sent by me and stored on the server (✓). */
  mine: boolean;
};
type Raw = { id: string; from: string; to?: string; at: number; ct: string };

const MAX = 1000;

const making = new Map<string, Promise<MyGroup | null>>();
/** This device's whisper key pair for the group (made once, kept with the group). Null if the group was left. */
export function ensureWhisperKeys(code: string): Promise<MyGroup | null> {
  let p = making.get(code);
  if (!p) {
    p = (async () => {
      const g = getGroups().find((x) => x.code === code);
      if (!g || g.dh) return g ?? null;
      const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"])) as CryptoKeyPair;
      const dh = { pub: await crypto.subtle.exportKey("jwk", pair.publicKey), priv: await crypto.subtle.exportKey("jwk", pair.privateKey) };
      // (another tab may have made them meanwhile: keep the first)
      if (getGroups().find((x) => x.code === code)?.dh) return getGroups().find((x) => x.code === code)!;
      updateMyGroup(code, { dh });
      return getGroups().find((x) => x.code === code) ?? null;
    })();
    making.set(code, p);
  }
  return p;
}

const pairKeys = new Map<string, Promise<CryptoKey>>();
/** The key for whispers between me and one other member (the same on both devices). */
function whisperKey(g: MyGroup, theirPub: JsonWebKey): Promise<CryptoKey> {
  const id = `${g.code}|${g.dh!.pub.x}|${theirPub.x}|${theirPub.y}`;
  let p = pairKeys.get(id);
  if (!p) {
    p = (async () => {
      const mine = await crypto.subtle.importKey("jwk", g.dh!.priv, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
      const theirs = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: theirPub.x, y: theirPub.y }, { name: "ECDH", namedCurve: "P-256" }, false, []);
      return crypto.subtle.deriveKey({ name: "ECDH", public: theirs }, mine, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    })();
    pairKeys.set(id, p);
  }
  return p;
}

/** The chat since `etag` (null = changed, with every line I can read), or "same". */
export async function loadChat(g: MyGroup, members: Member[], etag: string | null): Promise<{ etag: string | null; lines: ChatLine[]; stale: boolean } | "same"> {
  const k = await keysFor(g.code);
  const res = await fetch(`/api/group/${k.id}/chat${etag ? `?etag=${encodeURIComponent(etag)}` : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn’t load the chat.");
  const data = (await res.json()) as { same?: true; etag: string | null; msgs: Raw[] };
  if (data.same) return "same";
  const me = await memberId(g.secret);
  const byId = new Map(members.map((m) => [m.id, m]));
  const lines: ChatLine[] = [];
  // someone we don't know yet (joined after the list was loaded) or a whisper we can't open for lack of a key
  let stale = false;
  for (const m of data.msgs) {
    if (!byId.has(m.from)) stale = true;
    try {
      if (m.to) {
        // a whisper: only between the two of them
        if (m.from !== me && m.to !== me) continue;
        const other = byId.get(m.from === me ? m.to : m.from);
        if (!g.dh || !other?.pub) {
          stale = true;
          continue;
        }
        const v = await open<{ t: string }>(await whisperKey(g, other.pub), fromBase64(m.ct));
        lines.push({ id: m.id, from: m.from, at: m.at, text: v.t, whisper: { to: m.to }, mine: m.from === me });
      } else {
        const v = await open<{ t: string }>(k.key, fromBase64(m.ct));
        lines.push({ id: m.id, from: m.from, at: m.at, text: v.t, mine: m.from === me });
      }
    } catch {
      /* not readable here (an old key, or someone who left): skip */
    }
  }
  return { etag: data.etag, lines, stale };
}

/**
 * Send a line. "/w name message" (or /whisper) whispers to the member of that name. Returns an error to show, or
 * null when it was stored.
 */
export async function sendChat(g: MyGroup, members: Member[], input: string): Promise<string | null> {
  let text = input.trim();
  if (!text) return null;
  let to: Member | undefined;
  const w = /^\/(?:w|whisper)\s+([\s\S]+)$/i.exec(text);
  if (/^\/(?:w|whisper)\b/i.test(text)) {
    if (!w) return "To whisper: /w name your message";
    const rest = w[1];
    const low = rest.toLowerCase();
    const others = members.filter((m) => !m.mine);
    // the longest full name the line starts with ("/w Sam Lee hi"), else the first word of a name ("/w Sam hi")
    const full = others
      .filter((m) => low.startsWith(m.name.toLowerCase()) && /^\s/.test(rest.slice(m.name.length)))
      .sort((a, b) => b.name.length - a.name.length);
    const first = rest.split(/\s+/)[0].toLowerCase();
    const hits = full.length ? full.filter((m) => m.name.length === full[0].name.length) : others.filter((m) => m.name.toLowerCase().split(/\s+/)[0] === first);
    const said = full.length ? full[0].name : rest.split(/\s+/)[0];
    if (!hits.length) return `No one called “${said}” in this group.`;
    if (hits.length > 1) return `More than one “${said}”: use their full name.`;
    to = hits[0];
    if (!to.pub) return `${to.name} hasn’t opened the chat yet, so a whisper can’t reach them. (If they just did, wait a moment and try again.)`;
    text = rest.slice(full.length ? full[0].name.length : said.length).trim();
    if (!text) return "To whisper: /w name your message";
  }
  if (text.length > MAX) return `That’s too long (${MAX} letters at most).`;
  const k = await keysFor(g.code);
  const key = to ? await whisperKey(g, to.pub!) : k.key;
  const res = await fetch(`/api/group/${k.id}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-member-key": g.secret },
    body: JSON.stringify({ ct: toB64(await seal(key, { t: text })), ...(to ? { to: to.id } : {}) }),
  });
  if (!res.ok) return (await res.json().catch(() => null))?.error ?? "Couldn’t send.";
  return null;
}
