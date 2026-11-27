"use client";
/**
 * Issued badges: marks the Verses Across team gives to a person (Steward, Moderator, Partner, Tester), signed so they
 * can't be faked. Only Skylar and my brother can issue them, from the team hub's Badges tab (hub/src/index.ts, which
 * signs with the private key in its secret BADGE_SIGNING_KEY). The site only ever verifies, with the public key below.
 *
 * Token: base64url(JSON payload) + "." + base64url(signature). The signature is ECDSA P-256 with SHA-256 (WebCrypto;
 * not Ed25519, which Safari 15.6 lacks), raw r||s (64 bytes, IEEE P-1363), over the ASCII bytes of the first part.
 * Payload: { v: 2, id: 16 hex, b: badge id, n: display name (max 40), i: issued ISO date, by: "steward" | "owner",
 * h: { x, y } the badge's own "holder" public key }.
 *
 * Proof of possession: each badge has its own holder key pair, made by the hub at issue. The private half travels only
 * in the link's fragment (/badge#<token>.<holder key>, never sent to a server; the hub doesn't keep it) and is kept
 * with the token on the device (va-issued-badges:v2, and in end-to-end encrypted sync). In a study group the card
 * carries the token plus a proof: the holder key's signature over "va-badge-proof:v1|<group id>|<member id>". Others
 * check the token with the team's key and the proof with `h`, for THAT card's member id, so a token copied from
 * someone's card fails for anyone else. Revoked badges (GET /api/badges/revoked, written by the hub) are skipped.
 */
import { touch } from "./stamps";

/*
 * ============================ PLACEHOLDER: THE REAL PUBLIC KEY GOES HERE ============================
 * Until this is filled in, no badge verifies (the badge page says badges aren't set up yet).
 * Paste the PUBLIC half of the P-256 key pair as a JWK, e.g.
 *   export const BADGE_PUBLIC_KEY: JsonWebKey | null = { kty: "EC", crv: "P-256", x: "…", y: "…" };
 * Never paste the private key ("d") here: it lives only in the hub's secret BADGE_SIGNING_KEY.
 * =====================================================================================================
 */
export const BADGE_PUBLIC_KEY: JsonWebKey | null = { kty: "EC", crv: "P-256", x: "8YNH3RVFUmbMOzTySNuoyLWqgHAyrdDZFNHjhSwwvnQ", y: "3tOnrEwo7F6Ufmo1avlslD72wRa93_TvQ-jHaUjEzMA" };

export type BadgeDef = {
  id: string;
  /** The full name, e.g. "Steward". */
  label: string;
  /** The short mark next to a name, shown as ⟨mark⟩. */
  mark: string;
  icon: string;
  /** A solid chip that reads in both themes: background and text colour. */
  bg: string;
  ink: string;
  description: string;
};

/** The catalogue (the hub keeps the same ids in hub/src/index.ts BADGE_KINDS: add new ones in both places). */
export const ISSUED_BADGES: BadgeDef[] = [
  {
    id: "steward",
    label: "Steward",
    mark: "Steward",
    icon: "✦",
    bg: "#d4a017",
    ink: "#1d1305",
    description: "Looks after Verses Across with the team: says yes to what goes on the site and helps it grow.",
  },
  {
    id: "moderator",
    label: "Moderator",
    mark: "Moderator",
    icon: "⚑",
    bg: "#6ea8e0",
    ink: "#0b1a2b",
    description: "Helps keep study groups and shared spaces kind, safe and on topic.",
  },
  {
    id: "partner",
    label: "Partner",
    mark: "Partner",
    icon: "❖",
    bg: "#4fb477",
    ink: "#08210f",
    description: "Works with Verses Across to bring the texts to more readers.",
  },
  {
    id: "tester",
    label: "Tester",
    mark: "Tester",
    icon: "◎",
    bg: "#b48ae0",
    ink: "#1c0f2b",
    description: "Tries new parts of the site before everyone else and says what needs fixing.",
  },
];
/** A badge issued after this app was built (a kind it doesn't know yet): still checked, shown plainly. */
const UNKNOWN: Omit<BadgeDef, "id"> = {
  label: "A badge",
  mark: "Badge",
  icon: "✦",
  bg: "#857a6f",
  ink: "#ffffff",
  description: "A badge this app doesn't know yet. Reloading the site later may show what it is.",
};
export const badgeDef = (id: string): BadgeDef => ISSUED_BADGES.find((b) => b.id === id) ?? { id, ...UNKNOWN };

export type BadgePayload = { v: 2; id: string; b: string; n: string; i: string; by: "steward" | "owner"; h: { x: string; y: string } };
export type Verified = BadgePayload & { token: string; def: BadgeDef; known: boolean };
/** A badge kept on this device: its token and its holder private key (base64url JSON { d, x, y }). */
export type Kept = { t: string; k: string };
/** What a member card carries for one badge: the token and the proof for this group and member. */
export type CardBadge = { t: string; p: string };

const PART = /^[A-Za-z0-9_-]+$/;
const COORD = /^[A-Za-z0-9_-]{43}$/;
const MAX_TOKEN = 1200;
const MAX_KEPT = 50;

function unb64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const enc = (s: string) => new TextEncoder().encode(s);
const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN = { name: "ECDSA", hash: "SHA-256" } as const;

function payloadJson(token: string): Record<string, unknown> | null {
  try {
    const head = token.split(".")[0];
    if (!head || !PART.test(head)) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64url(head))) as unknown;
    return p && typeof p === "object" ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
/** A token's id, whatever its version (for keeping and syncing tokens this app may not fully understand). */
export function tokenId(token: unknown): string | null {
  if (typeof token !== "string" || token.length > MAX_TOKEN) return null;
  const id = payloadJson(token)?.id;
  return typeof id === "string" && /^[0-9a-f]{16}$/.test(id) ? id : null;
}

/** The payload, if the token is a well formed v2 token (NOT verified: use verifyBadge before trusting it). */
export function parseToken(token: unknown): BadgePayload | null {
  if (typeof token !== "string" || token.length > MAX_TOKEN) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !PART.test(parts[0]) || !PART.test(parts[1])) return null;
  const p = payloadJson(token);
  if (!p || p.v !== 2) return null; // (v1 tokens had no holder key: refused)
  if (typeof p.id !== "string" || !/^[0-9a-f]{16}$/.test(p.id)) return null;
  if (typeof p.b !== "string" || !/^[a-z0-9-]{1,30}$/.test(p.b)) return null;
  if (typeof p.n !== "string" || !p.n.trim() || Array.from(p.n).length > 40) return null;
  if (typeof p.i !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(p.i) || isNaN(Date.parse(p.i))) return null;
  if (p.by !== "steward" && p.by !== "owner") return null;
  const h = p.h as { x?: unknown; y?: unknown } | null;
  if (!h || typeof h.x !== "string" || typeof h.y !== "string" || !COORD.test(h.x) || !COORD.test(h.y)) return null;
  return { v: 2, id: p.id, b: p.b, n: p.n, i: p.i, by: p.by, h: { x: h.x, y: h.y } };
}

/** The token checked against a given issuer key (exported for the hub's interop test). Never throws. */
export async function verifyWith(token: string, issuer: JsonWebKey): Promise<Verified | null> {
  try {
    const payload = parseToken(token);
    if (!payload) return null;
    const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: issuer.x, y: issuer.y, ext: true }, ECDSA, false, ["verify"]);
    const [data, sig] = token.split(".");
    const raw = unb64url(sig);
    if (raw.length !== 64) return null;
    if (!(await crypto.subtle.verify(SIGN, key, raw, enc(data)))) return null;
    const def = badgeDef(payload.b);
    return { ...payload, token, def, known: ISSUED_BADGES.some((b) => b.id === payload.b) };
  } catch {
    return null;
  }
}

/** False while the public key is still the placeholder (or this browser has no WebCrypto). */
export const badgesReady = () => !!BADGE_PUBLIC_KEY && typeof crypto !== "undefined" && !!crypto.subtle;

const verified = new Map<string, Promise<Verified | null>>();
/** The badge, only if the team's signature is good (cached per token). Revocation is checked separately. */
export function verifyBadge(token: string): Promise<Verified | null> {
  if (!badgesReady()) return Promise.resolve(null);
  let p = verified.get(token);
  if (!p) {
    p = verifyWith(token, BADGE_PUBLIC_KEY!);
    if (verified.size > 300) verified.clear();
    verified.set(token, p);
  }
  return p;
}

/* ---------------- the holder key and proofs ---------------- */

type Holder = { d: string; x: string; y: string };
function decodeHolder(k: string): Holder | null {
  try {
    if (!PART.test(k) || k.length > 400) return null;
    const h = JSON.parse(new TextDecoder().decode(unb64url(k))) as Partial<Holder>;
    return h && typeof h.d === "string" && typeof h.x === "string" && typeof h.y === "string" && COORD.test(h.d) && COORD.test(h.x) && COORD.test(h.y) ? (h as Holder) : null;
  } catch {
    return null;
  }
}
export const proofMessage = (gid: string, mid: string) => `va-badge-proof:v1|${gid}|${mid}`;

/** The holder's signature over the proof message (null if the key is unusable). Never throws. */
export async function makeProof(k: string, gid: string, mid: string): Promise<string | null> {
  try {
    const h = decodeHolder(k);
    if (!h) return null;
    const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: h.d, x: h.x, y: h.y, ext: true }, ECDSA, false, ["sign"]);
    return b64url(new Uint8Array(await crypto.subtle.sign(SIGN, key, enc(proofMessage(gid, mid)))));
  } catch {
    return null;
  }
}
/** Does the proof come from the badge's holder key, for this group and this member? Never throws. */
export async function verifyProof(h: { x: string; y: string }, gid: string, mid: string, proof: unknown): Promise<boolean> {
  try {
    if (typeof proof !== "string" || !PART.test(proof) || proof.length > 100) return false;
    const raw = unb64url(proof);
    if (raw.length !== 64) return false;
    const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: h.x, y: h.y, ext: true }, ECDSA, false, ["verify"]);
    return await crypto.subtle.verify(SIGN, key, raw, enc(proofMessage(gid, mid)));
  } catch {
    return false;
  }
}
/** The holder key belongs to the badge (same public point, and it really signs for it). */
async function holderFits(b: BadgePayload, k: string): Promise<boolean> {
  const h = decodeHolder(k);
  if (!h || h.x !== b.h.x || h.y !== b.h.y) return false;
  const p = await makeProof(k, "check", "check");
  return !!p && (await verifyProof(b.h, "check", "check", p));
}

/* ---------------- revoked badges (the site's list, written by the hub) ---------------- */

const REVOKED_KEY = "va-badge-revoked:v1";
let revoked: { at: number; ids: Promise<Set<string>> } | null = null;
const lastRevoked = (): Set<string> => {
  try {
    const l = JSON.parse(localStorage.getItem(REVOKED_KEY) ?? "[]");
    return new Set<string>(Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set<string>();
  }
};
/** Ids of revoked badges: fetched at most every 5 minutes. When a fetch fails, the last list this device saw is used
 * (and kept: only a good answer replaces it). */
export function revokedIds(): Promise<Set<string>> {
  if (revoked && Date.now() - revoked.at < 5 * 60_000) return revoked.ids;
  const ids = fetch("/api/badges/revoked")
    .then((r) => (r.ok ? (r.json() as Promise<{ ids?: unknown }>) : Promise.reject(new Error(String(r.status)))))
    .then((j) => {
      if (!Array.isArray(j.ids)) throw new Error("bad answer");
      const list = j.ids.filter((x): x is string => typeof x === "string" && /^[0-9a-f]{16}$/.test(x));
      try {
        localStorage.setItem(REVOKED_KEY, JSON.stringify(list));
      } catch {
        /* private mode */
      }
      return new Set(list);
    })
    .catch(() => {
      revoked = null; // try again next time
      return lastRevoked();
    });
  revoked = { at: Date.now(), ids };
  return ids;
}

export type BadgeCheck = { ok: true; badge: Verified } | { ok: false; why: "unset" | "invalid" | "revoked" };
/** Verified and not revoked. Never throws. */
export async function checkBadge(token: string): Promise<BadgeCheck> {
  try {
    if (!badgesReady()) return { ok: false, why: "unset" };
    const b = await verifyBadge(token);
    if (!b) return { ok: false, why: "invalid" };
    if ((await revokedIds()).has(b.id)) return { ok: false, why: "revoked" };
    return { ok: true, badge: b };
  } catch {
    return { ok: false, why: "invalid" };
  }
}

/** A badge link's fragment (<token>.<holder key>): checked, with the holder key that belongs to it. Never throws. */
export async function checkLink(fragment: string): Promise<{ ok: true; badge: Verified; kept: Kept } | { ok: false; why: "unset" | "invalid" | "revoked" }> {
  try {
    const parts = fragment.split(".");
    if (parts.length !== 3) return { ok: false, why: badgesReady() ? "invalid" : "unset" };
    const t = `${parts[0]}.${parts[1]}`;
    const c = await checkBadge(t);
    if (!c.ok) return c;
    if (!(await holderFits(c.badge, parts[2]))) return { ok: false, why: "invalid" };
    return { ok: true, badge: c.badge, kept: { t, k: parts[2] } };
  } catch {
    return { ok: false, why: "invalid" };
  }
}

/** A member's badges in a group: only the ones whose token verifies, aren't revoked, and whose proof is from the
 * badge's holder for THIS group and member id. Bad ones are silently left out. */
export async function groupBadges(list: unknown, gid: string, mid: string): Promise<Verified[]> {
  if (!Array.isArray(list) || !badgesReady()) return [];
  const items = list.slice(0, 5).filter((x): x is CardBadge => !!x && typeof x === "object" && typeof (x as CardBadge).t === "string" && typeof (x as CardBadge).p === "string");
  const res = await Promise.all(
    items.map(async (x) => {
      const c = await checkBadge(x.t);
      return c.ok && (await verifyProof(c.badge.h, gid, mid, x.p)) ? c.badge : null;
    }),
  );
  const out: Verified[] = [];
  for (const b of res) if (b && !out.some((x) => x.id === b.id)) out.push(b);
  return out;
}

/** My badges for a card in a group: the ones that verify and aren't revoked, each with a fresh proof for this group
 * and my member id (at most 5). */
export async function cardBadges(gid: string, mid: string): Promise<CardBadge[]> {
  const out: CardBadge[] = [];
  for (const kb of savedBadges()) {
    if (out.length >= 5) break;
    if (!parseToken(kb.t) || !(await checkBadge(kb.t)).ok) continue;
    const p = await makeProof(kb.k, gid, mid);
    if (p) out.push({ t: kb.t, p });
  }
  return out;
}

/* ---------------- the badges kept on this device ---------------- */

const KEY = "va-issued-badges:v2";
export const BADGES_EVENT = "va-issued-badges";

const isKept = (x: unknown): x is Kept => !!x && typeof x === "object" && typeof (x as Kept).t === "string" && typeof (x as Kept).k === "string" && (x as Kept).k.length <= 400 && !!tokenId((x as Kept).t);

/** Every kept badge (tokens of kinds or versions this app doesn't know are kept too, never dropped). */
export function savedBadges(): Kept[] {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(l) ? l.filter(isKept).slice(0, MAX_KEPT) : [];
  } catch {
    return [];
  }
}
function writeBadges(list: Kept[], fromSync = false) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_KEPT)));
  } catch {
    /* private mode */
  }
  if (!fromSync) touch("badges");
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BADGES_EVENT));
}
/** Keep a badge (after checkLink said ok). The newest first; the same badge id once. */
export function keepBadge(kb: Kept) {
  const id = tokenId(kb.t);
  if (!id) return;
  writeBadges([{ t: kb.t, k: kb.k }, ...savedBadges().filter((x) => tokenId(x.t) !== id)]);
}
export function removeBadge(id: string) {
  writeBadges(savedBadges().filter((x) => tokenId(x.t) !== id));
}
/** The kept badges as synced from another device (sync.ts). */
export const setBadgesFromSync = (list: unknown[]) => writeBadges(list.filter(isKept), true);

/** The kept badges that verify and aren't revoked (for the study lab shelf). */
export async function keptVerified(): Promise<Verified[]> {
  const res = await Promise.all(savedBadges().map((kb) => checkBadge(kb.t)));
  return res.filter((r): r is { ok: true; badge: Verified } => r.ok).map((r) => r.badge);
}

/** "26 November 2026" from the issued date. */
export function issuedOn(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
