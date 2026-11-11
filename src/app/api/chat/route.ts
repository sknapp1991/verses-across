/**
 * The testers' study chat (Skylar, Nov 10; page: src/app/testers). One public room ("testers"), no accounts: a display
 * name and a random browser id. Stored in D1 (STATS_DB, tables in data/stats/chat.sql), kept 30 days.
 *
 * Safety, all on the server:
 * - the room's link code must match (a reset by Skylar makes old links stop working);
 * - rate limits: CHAT_LIMIT per IP (if bound) and one message every 4 s per browser; at most 500 characters;
 * - no links or web addresses except from the moderator; a short profanity list; repeated or shouted spam refused;
 * - bans cover the browser id and a salted hash of the IP (never shown or used for anything else).
 * Moderator: Skylar's key (header x-chat-mod), checked against its SHA-256 in chat_room; he can delete, ban and reset.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SITE_SIDE } from "@/lib/site";

type Stmt = { bind(...v: unknown[]): Stmt; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
type D1 = { prepare(q: string): Stmt; batch(s: Stmt[]): Promise<unknown> };
type Limiter = { limit(o: { key: string }): Promise<{ success: boolean }> };
type Env = { STATS_DB?: D1; CHAT_LIMIT?: Limiter };
type Room = { id: string; code: string; mod_hash: string };

const ROOM = "testers";
const KEEP_DAYS = 30;
const MAX_LEN = 500;
const GAP_MS = 4000;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const bad = (error: string, status = 400) => json({ error }, status);

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const env = (): Env => {
  try {
    return getCloudflareContext().env as unknown as Env;
  } catch {
    return {};
  }
};
/** Only the site's own pages may write (browsers send these headers; a plain script usually doesn't). */
function sameSite(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  return req.headers.get("origin") === new URL(req.url).origin;
}

/* ---------- what gets refused ---------- */
const EMAIL = /[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+\s*\.\s*[a-z]{2,}/i;
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|me|ly|gg|app|xyz|info|biz|link|site|online|ru|cn|be|dev|uk|us|tv|ca|de|store)\b)/i;
// A short list of strong profanity and slurs (whole words, common spellings). Not meant to be complete: Skylar moderates.
// (KJV words like "bastard", "whore", "rape" and names like Dick are left out on purpose: this is a Bible-study room.)
const ROOTS = ["fuck", "shit", "bitch", "cunt", "pussy", "asshole", "slut", "nigger", "nigga", "faggot", "fag", "retard", "kike", "spic", "wetback", "tranny", "porn"];
const PROFANE = new RegExp(`(^|[^a-z])(${ROOTS.join("|")})(s|es|ed|er|ers|ing|y)?($|[^a-z])`, "i");
const normal = (s: string) => s.toLowerCase().replace(/[@4]/g, "a").replace(/3/g, "e").replace(/[1!|]/g, "i").replace(/0/g, "o").replace(/[$5]/g, "s").replace(/(.)\1{2,}/g, "$1$1");
/** Invisible and direction-changing characters (zero-width spaces, RTL override…) are removed before any check. */
const clean = (s: string) => s.replace(/[\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g, "");
const MOD_NAME = /skylar|\bmod\b|admin|moderator|verses\s*across/i;
function refused(text: string, name: string, isMod: boolean): string | null {
  if (!isMod && (EMAIL.test(text) || EMAIL.test(name))) return "Please don't post email addresses in the chat: everyone can read it. Email testers@versesacross.com instead.";
  if (!isMod && (LINK.test(text) || LINK.test(name))) return "Links and web addresses aren't allowed here.";
  if (!isMod && MOD_NAME.test(name)) return "Please pick a different name (that one is for the moderator).";
  if (!/[\p{L}\p{N}]/u.test(name) || !/[\p{L}\p{N}\p{Emoji_Presentation}]/u.test(text)) return "Write a few words, please.";
  if (PROFANE.test(normal(text)) || PROFANE.test(normal(name))) return "Please keep it friendly: that word isn't allowed here.";
  if (/(.)\1{9,}/u.test(text)) return "That looks like spam.";
  if (text.split("\n").length > 20) return "That's a lot of lines: please keep it shorter.";
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length > 24 && letters === letters.toUpperCase()) return "Please don't shout (all capitals).";
  return null;
}

/* ---------- reading ---------- */
async function room(db: D1) {
  return db.prepare("SELECT id, code, mod_hash FROM chat_room WHERE id = ?").bind(ROOM).first<Room>();
}
async function isModerator(req: Request, r: Room) {
  const key = req.headers.get("x-chat-mod");
  return !!key && key.length >= 24 && (await sha256(key)) === r.mod_hash;
}

/** GET /api/chat?c=<code>&after=<id>: new messages (the last 100 on first load). */
export async function GET(req: Request) {
  if (SITE_SIDE !== "scriptures") return bad("Not found.", 404); // the chat lives on versesacross.com only
  const { STATS_DB: db } = env();
  if (!db) return bad("The chat isn't available here.", 503);
  const r = await room(db).catch(() => null);
  if (!r) return bad("The chat isn't set up yet.", 503);
  const url = new URL(req.url);
  const mod = await isModerator(req, r);
  if (!mod && url.searchParams.get("c") !== r.code) return bad("This chat link has changed. Ask Skylar for the new one.", 410);
  const n = Number(url.searchParams.get("after"));
  const after = Number.isSafeInteger(n) && n > 0 ? n : 0;
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString(); // older ones are never shown, even before they're deleted
  const rows = (
    await db
      .prepare(`SELECT id, member, name, body, is_mod, created FROM chat_msg WHERE room = ? AND id > ? AND created >= ? ORDER BY id DESC LIMIT 100`)
      .bind(ROOM, after, cutoff)
      .all<{ id: number; member: string; name: string; body: string; is_mod: number; created: string }>()
  ).results.reverse();
  const me = url.searchParams.get("m") ?? "";
  // members see each message's author only as "you" or not (the browser id stays private); the moderator sees the id
  const messages = rows.map((x) => ({ id: x.id, name: x.name, body: x.body, at: x.created, mod: !!x.is_mod, mine: x.member === me, ...(mod ? { member: x.member.slice(0, 6) } : {}) }));
  return json({ messages, mod, code: mod ? r.code : undefined });
}

/* ---------- writing ---------- */
/** POST /api/chat: { c, m, name, text } to send; { action: "delete" | "ban" | "reset", id } for the moderator. */
export async function POST(req: Request) {
  if (SITE_SIDE !== "scriptures") return bad("Not found.", 404);
  if (!sameSite(req)) return bad("Not allowed.", 403);
  const { STATS_DB: db, CHAT_LIMIT } = env();
  if (!db) return bad("The chat isn't available here.", 503);
  const r = await room(db).catch(() => null);
  if (!r) return bad("The chat isn't set up yet.", 503);
  const raw = await req.text();
  if (raw.length > 4000) return bad("Too long.", 413);
  let b: { c?: unknown; m?: unknown; name?: unknown; text?: unknown; action?: unknown; id?: unknown };
  try {
    b = JSON.parse(raw);
  } catch {
    return bad("Bad request.");
  }
  const mod = await isModerator(req, r);
  const now = new Date();

  if (typeof b.action === "string") {
    if (!mod) return bad("Only the moderator can do that.", 403);
    const id = Number(b.id);
    if (b.action === "delete" && id > 0) {
      await db.prepare("DELETE FROM chat_msg WHERE room = ? AND id = ?").bind(ROOM, id).run();
      return json({ ok: true });
    }
    if (b.action === "ban" && id > 0) {
      const m = await db.prepare("SELECT member, iphash FROM chat_msg WHERE room = ? AND id = ?").bind(ROOM, id).first<{ member: string; iphash: string }>();
      if (!m) return bad("That message is gone.", 404);
      await db.batch([
        db.prepare("INSERT INTO chat_ban (room, member, iphash, created) VALUES (?, ?, ?, ?)").bind(ROOM, m.member, m.iphash, now.toISOString()),
        // their messages go (by browser only: others on the same Wi-Fi or mobile network keep theirs); posting is blocked by both
        db.prepare("DELETE FROM chat_msg WHERE room = ? AND member = ?").bind(ROOM, m.member),
      ]);
      return json({ ok: true });
    }
    if (b.action === "reset") {
      const bytes = crypto.getRandomValues(new Uint8Array(9));
      const code = [...bytes].map((x) => x.toString(36).padStart(2, "0")).join("").slice(0, 14);
      await db.prepare("UPDATE chat_room SET code = ? WHERE id = ?").bind(code, ROOM).run();
      return json({ ok: true, code });
    }
    return bad("Unknown action.");
  }

  // a message
  if (!mod && b.c !== r.code) return bad("This chat link has changed. Ask Skylar for the new one.", 410);
  const member = typeof b.m === "string" && /^[a-z0-9]{12,40}$/.test(b.m) ? b.m : "";
  const name = typeof b.name === "string" ? clean(b.name).replace(/\s+/g, " ").trim().slice(0, 30) : "";
  const text = typeof b.text === "string" ? clean(b.text).replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim() : "";
  if (!member) return bad("Reload the page and try again.");
  if (name.length < 2) return bad("Pick a display name (2 to 30 characters).");
  if (!text) return bad("Write a message first.");
  if (text.length > MAX_LEN) return bad(`Please keep it under ${MAX_LEN} characters.`);
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  if (CHAT_LIMIT && !(await CHAT_LIMIT.limit({ key: ip }).catch(() => ({ success: true }))).success) return bad("Slow down a little, then try again.", 429);
  const iphash = (await sha256(`${r.mod_hash}:${ip}`)).slice(0, 24);
  const banned = await db.prepare("SELECT 1 AS x FROM chat_ban WHERE room = ? AND (member = ? OR iphash = ?)").bind(ROOM, member, iphash).first();
  if (banned && !mod) return bad("You can't post in this chat.", 403);
  const why = refused(text, name, mod);
  if (why) return bad(why, 422);
  const last = await db
    .prepare("SELECT body, created FROM chat_msg WHERE room = ? AND member = ? ORDER BY id DESC LIMIT 1") // per browser: shared IPs are common
    .bind(ROOM, member)
    .first<{ body: string; created: string }>();
  if (last && !mod) {
    if (now.getTime() - Date.parse(last.created) < GAP_MS) return bad("Slow down a little, then try again.", 429);
    if (last.body === text) return bad("You just sent that.", 422);
  }
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString();
  await db.batch([
    db.prepare("INSERT INTO chat_msg (room, member, iphash, name, body, is_mod, created) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(ROOM, member, iphash, name, text, mod ? 1 : 0, now.toISOString()),
    db.prepare("DELETE FROM chat_msg WHERE room = ? AND created < ?").bind(ROOM, cutoff), // kept 30 days
  ]);
  return json({ ok: true });
}
