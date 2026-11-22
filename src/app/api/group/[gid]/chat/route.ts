/**
 * A study group's chat (hub a3b33a99): one log per group, `groupchat/<gid>` in the sync bucket. The server only
 * moves opaque bytes: each message is encrypted on the device, with the group's key, or for a whisper ("/w name …")
 * with a key only the sender and the recipient can derive (ECDH between their devices' key pairs).
 *
 *   GET  ?etag=…   the log ({ etag, msgs }), or { same: true } when it hasn't changed since that etag
 *   POST           add a message: { ct, to? } (base64 ciphertext, and the recipient's member id for a whisper).
 *                  Only a member of the group can post: x-member-key is the secret whose SHA-256 is their member
 *                  id, and their card must be in the group.
 *
 * The log keeps the newest 300 messages from the last 90 days.
 */
import { HEX64, json, sha256hex, syncBucket } from "@/lib/sync-server";

type Ctx = { params: Promise<{ gid: string }> };
export type ChatMsg = { id: string; from: string; to?: string; at: number; ct: string };
type Log = { v: 1; msgs: ChatMsg[] };

const KEEP = 300;
const MAX_AGE = 90 * 86400_000;
const B64 = /^[A-Za-z0-9+/=]{24,8000}$/;
const bare = (etag: string) => etag.replace(/^W\//, "").replace(/"/g, "");
/** The stored log; a damaged one counts as empty (rather than blocking the chat for good). */
const parse = async (obj: { arrayBuffer(): Promise<ArrayBuffer> }): Promise<Log> => {
  try {
    const log = JSON.parse(new TextDecoder().decode(await obj.arrayBuffer())) as Log;
    return Array.isArray(log?.msgs) ? log : { v: 1, msgs: [] };
  } catch {
    return { v: 1, msgs: [] };
  }
};

export async function GET(request: Request, ctx: Ctx) {
  const { gid } = await ctx.params;
  if (!HEX64.test(gid)) return json({ error: "Not found" }, 404);
  const bucket = await syncBucket(request);
  if (bucket instanceof Response) return bucket;
  const since = new URL(request.url).searchParams.get("etag");
  const key = `groupchat/${gid}`;
  if (since) {
    const h = await bucket.head(key);
    if (!h) return json({ etag: null, msgs: [] });
    if (bare(h.httpEtag) === bare(since)) return json({ same: true });
  }
  const obj = await bucket.get(key);
  if (!obj) return json({ etag: null, msgs: [] });
  const cutoff = Date.now() - MAX_AGE;
  return json({ etag: obj.httpEtag, msgs: (await parse(obj)).msgs.filter((m) => m.at >= cutoff) });
}

export async function POST(request: Request, ctx: Ctx) {
  const { gid } = await ctx.params;
  if (!HEX64.test(gid)) return json({ error: "Not found" }, 404);
  const secret = request.headers.get("x-member-key") ?? "";
  if (secret.length < 32) return json({ error: "Not allowed" }, 403);
  const from = await sha256hex(secret);
  const bucket = await syncBucket(request);
  if (bucket instanceof Response) return bucket;
  // only someone whose card is in the group
  if (!(await bucket.head(`group/${gid}/${from}`))) return json({ error: "Join the group to chat." }, 403);
  let input: { ct?: unknown; to?: unknown };
  if (Number(request.headers.get("content-length") ?? 0) > 9000) return json({ error: "That message is too long." }, 413);
  try {
    const raw = await request.text();
    if (raw.length > 9000) return json({ error: "That message is too long." }, 413);
    input = JSON.parse(raw);
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (typeof input.ct !== "string" || !B64.test(input.ct)) return json({ error: "Bad request" }, 400);
  if (input.to !== undefined && (typeof input.to !== "string" || !HEX64.test(input.to))) return json({ error: "Bad request" }, 400);
  const msg: ChatMsg = { id: crypto.randomUUID().slice(0, 12), from, at: Date.now(), ct: input.ct, ...(input.to ? { to: input.to as string } : {}) };
  const key = `groupchat/${gid}`;
  // Append with optimistic locking: if someone else wrote first, read again and retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    const obj = await bucket.get(key);
    const log: Log = obj ? await parse(obj) : { v: 1, msgs: [] };
    const cutoff = Date.now() - MAX_AGE;
    log.msgs = [...log.msgs.filter((m) => m.at >= cutoff), msg].slice(-KEEP);
    const data = new TextEncoder().encode(JSON.stringify(log)).buffer as ArrayBuffer;
    if (!obj) {
      if (await bucket.head(key)) continue; // created meanwhile
      const r = await bucket.put(key, data);
      return json({ ok: true, msg, etag: r?.httpEtag ?? null });
    }
    const r = await bucket.put(key, data, { onlyIf: { etagMatches: bare(obj.httpEtag) } });
    if (r) return json({ ok: true, msg, etag: r.httpEtag });
  }
  return json({ error: "Busy. Try again." }, 409);
}
