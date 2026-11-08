/**
 * Verses Across team hub (hub.versesacross.com): a private, phone-first page for the two people who make
 * Verses Across. Report a bug or idea (with photos / screen recordings), follow its status and talk it
 * through, approve clips and website feedback, see the roadmap and what shipped.
 *
 * Security: Cloudflare Access sits in front (only the team's emails, email one-time code). This Worker
 * does not trust that alone: every request must carry a valid Access token (Cf-Access-Jwt-Assertion,
 * RS256, signed by the team's keys, for this app's AUD, not expired) whose email is on TEAM_EMAILS.
 * Approving is only for OWNER_EMAIL. Everything people type is stored and shown as text (never HTML).
 */
import { PAGE } from "./page";

type D1Stmt = { bind(...v: unknown[]): D1Stmt; run(): Promise<unknown>; first<T = Row>(): Promise<T | null>; all<T = Row>(): Promise<{ results: T[] }> };
type D1 = { prepare(q: string): D1Stmt; batch(s: D1Stmt[]): Promise<unknown> };
type Row = Record<string, unknown>;
type R2Obj = { body: ReadableStream; size: number; httpMetadata?: { contentType?: string }; range?: { offset: number; length: number } };
type R2Upload = { uploadPart(n: number, body: ReadableStream | ArrayBuffer): Promise<{ partNumber: number; etag: string }>; complete(parts: { partNumber: number; etag: string }[]): Promise<unknown>; abort(): Promise<void> };
type R2 = {
  get(key: string, o?: { range?: { offset: number; length?: number } }): Promise<R2Obj | null>;
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>;
  createMultipartUpload(key: string, o?: { httpMetadata?: { contentType?: string } }): Promise<{ uploadId: string; key: string }>;
  resumeMultipartUpload(key: string, uploadId: string): R2Upload;
  delete(key: string): Promise<void>;
};
/**
 * CLAUDE_TOKEN_ID: the Client ID of the Cloudflare Access service token named "Claude" (not secret by itself;
 * its secret stays on Skylar's PC). A request carrying that token is "claude": it may set statuses, notes and
 * test links, answer as Claude, add clips for approval and "what shipped" lines. It can never approve or decide.
 * CERTS_URL: local tests only (`wrangler dev --var CERTS_URL:…`, hub/test.mjs); never set in production. */
type Env = { DB: D1; SITE_DB: D1; MEDIA: R2; TEAM_DOMAIN: string; POLICY_AUD: string; TEAM_EMAILS?: string; OWNER_EMAIL?: string; CLAUDE_TOKEN_ID?: string; REPO: string; SITE: string; CERTS_URL?: string };

const TYPES = new Set(["Bug", "Idea", "Content", "Question"]);
/** Open: New, Seen, Working, Question. History: Live (shipped), Done (closed, nothing to change), Roadmap (later). */
const STATUSES = new Set(["New", "Seen", "Working", "Live", "Question", "Roadmap", "Done"]);
const PART = 10 * 1024 * 1024; // upload parts (the page sends 10 MB at a time)
const MAX_FILE = 2 * 1024 * 1024 * 1024; // 2 GB per file
/** Exactly these: photos and phone videos. Never SVG or HTML (they could run code on the hub's address). */
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif", "image/avif", "video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/3gpp"]);

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const bad = (msg: string, status = 400) => json({ error: msg }, status);
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/* ---------------- Access token check ---------------- */

type Jwk = { kid: string; kty: string; n: string; e: string; alg?: string };
let certs: { at: number; keys: Map<string, CryptoKey> } | null = null;

async function keys(team: string, certsUrl?: string) {
  if (certs && Date.now() - certs.at < 60 * 60 * 1000) return certs.keys;
  // A test key server is only ever accepted on this PC (127.0.0.1); otherwise the team's real keys.
  const local = certsUrl && /^http:\/\/127\.0\.0\.1:\d+\//.test(certsUrl) ? certsUrl : null;
  const r = await fetch(local || `https://${team}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error(`certs ${r.status}`);
  const body = (await r.json()) as { keys: Jwk[] };
  const map = new Map<string, CryptoKey>();
  for (const k of body.keys)
    if (k.kty === "RSA")
      map.set(k.kid, await crypto.subtle.importKey("jwk", { kty: "RSA", n: k.n, e: k.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
  certs = { at: Date.now(), keys: map };
  return map;
}

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

/** Why a sign-in was refused, in the Worker's log (never the token itself). */
const deny = (why: string): null => (console.warn(`access denied: ${why}`), null);

/** The signed-in email, "claude" for Claude's service token, or null. Checks signature, issuer, audience and expiry. */
async function whoIs(req: Request, env: Env): Promise<string | null> {
  const token = req.headers.get("cf-access-jwt-assertion");
  if (!token) return null;
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(b64url(h))) as { alg: string; kid: string };
    if (head.alg !== "RS256") return null;
    let key = (await keys(env.TEAM_DOMAIN, env.CERTS_URL)).get(head.kid);
    if (!key && certs && Date.now() - certs.at > 60 * 1000) {
      certs = null; // keys rotate: fetch them once more (at most once a minute)
      key = (await keys(env.TEAM_DOMAIN, env.CERTS_URL)).get(head.kid);
    }
    if (!key) return deny("unknown signing key");
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return deny("bad signature");
    const claims = JSON.parse(new TextDecoder().decode(b64url(p))) as { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string; common_name?: string };
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const t = Math.floor(Date.now() / 1000);
    if (!aud.includes(env.POLICY_AUD)) return deny("wrong app");
    if (claims.iss !== `https://${env.TEAM_DOMAIN}`) return deny("wrong issuer");
    if (!claims.exp || claims.exp < t || (claims.nbf && claims.nbf > t + 60)) return deny("expired");
    // Claude's service token: no email, its Client ID as common_name.
    if (!claims.email && claims.common_name) return env.CLAUDE_TOKEN_ID && claims.common_name === env.CLAUDE_TOKEN_ID ? "claude" : deny("unknown service token");
    const email = (claims.email ?? "").toLowerCase();
    const team = (env.TEAM_EMAILS ?? "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
    return team.includes(email) ? email : deny("not on the team list");
  } catch (e) {
    return deny(`check failed: ${(e as Error).message}`);
  }
}

/* ---------------- Routes ---------------- */

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const me = await whoIs(req, env);
    if (!me) return new Response("Not signed in to the Verses Across team hub.", { status: 403, headers: { "content-type": "text/plain" } });
    const owner = me !== "claude" && me === (env.OWNER_EMAIL ?? "").toLowerCase().trim();
    // Claude (its service token, or the owner's own session) does the inbox work: statuses, notes, clips to approve.
    const worker = owner || me === "claude";
    const path = url.pathname;
    const m = req.method;

    // State-changing requests must come from the hub page itself (no other site can make the browser send them).
    if (m !== "GET" && m !== "HEAD") {
      const origin = req.headers.get("origin");
      if (origin && origin !== url.origin) return bad("Wrong origin", 403);
      if (req.headers.get("x-hub") !== "1") return bad("Missing header", 403);
    }

    try {
      if (path === "/" || path === "/index.html")
        return new Response(PAGE, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
            "x-content-type-options": "nosniff",
            "referrer-policy": "no-referrer",
          },
        });
      if (path === "/api/me") return json({ email: me, owner, worker, name: me === "claude" ? "Claude" : me.split("@")[0] });

      // Reports
      if (path === "/api/reports" && m === "GET") return listReports(env, url);
      if (path === "/api/reports" && m === "POST") return createReport(env, me, await req.json());
      let r = /^\/api\/reports\/([a-f0-9]{16})$/.exec(path);
      if (r && m === "GET") return getReport(env, r[1]);
      if (r && m === "PATCH") return patchReport(env, me, worker, r[1], await req.json());

      // Comments (report, roadmap item or approval threads)
      if (path === "/api/comments" && m === "GET") return listComments(env, url.searchParams.get("thread") ?? "");
      if (path === "/api/comments" && m === "POST") return addComment(env, me, owner, await req.json());

      // Uploads (to R2, 10 MB parts) and media
      if (path === "/api/uploads" && m === "POST") return startUpload(env, me, worker, await req.json());
      r = /^\/api\/uploads\/([a-f0-9]{16})\/part\/(\d{1,5})$/.exec(path);
      if (r && m === "PUT") return uploadPart(env, req, me, r[1], Number(r[2]));
      r = /^\/api\/uploads\/([a-f0-9]{16})\/complete$/.exec(path);
      if (r && m === "POST") return completeUpload(env, me, r[1], await req.json());
      r = /^\/api\/media\/([a-f0-9]{16})$/.exec(path);
      if (r && (m === "GET" || m === "HEAD")) return serveMedia(env, req, r[1]);

      // Approvals (clips) and website feedback (Go / No)
      if (path === "/api/approvals" && m === "GET") return listApprovals(env);
      if (path === "/api/approvals" && m === "POST") return worker ? createApproval(env, me, await req.json()) : bad("Only the owner or Claude can add approvals", 403);
      r = /^\/api\/approvals\/([a-f0-9]{16})$/.exec(path);
      if (r && m === "PATCH") return owner ? decideApproval(env, me, r[1], await req.json()) : bad("Only the owner can approve", 403);
      if (path === "/api/feedback" && m === "GET") return listFeedback(env);
      r = /^\/api\/feedback\/([a-f0-9]{8})$/.exec(path);
      if (r && m === "PATCH") return owner ? decideFeedback(env, me, r[1], await req.json()) : bad("Only the owner can decide", 403);

      // Roadmap, votes, shipped
      if (path === "/api/roadmap" && m === "GET") return roadmap(env, me);
      r = /^\/api\/roadmap\/([A-Za-z0-9-]{1,12})\/vote$/.exec(path);
      if (r && m === "POST") return me === "claude" ? bad("Votes are for people", 403) : vote(env, me, r[1]);
      if (path === "/api/shipped" && m === "GET") return shipped(env);
      if (path === "/api/shipped" && m === "POST") return worker ? addShipped(env, await req.json()) : bad("Only the owner or Claude can add", 403);

      return bad("Not found", 404);
    } catch (e) {
      console.error(path, (e as Error).message);
      return bad("Something went wrong", 500);
    }
  },
};

/* ---------------- Reports ---------------- */

async function listReports(env: Env, url: URL) {
  const status = url.searchParams.get("status");
  const q = status && STATUSES.has(status)
    ? env.DB.prepare("SELECT * FROM reports WHERE status = ? ORDER BY created DESC LIMIT 200").bind(status)
    : env.DB.prepare("SELECT * FROM reports ORDER BY created DESC LIMIT 200");
  const { results } = await q.all();
  const counts = await env.DB.prepare("SELECT thread, COUNT(*) AS n FROM comments WHERE thread LIKE 'report:%' GROUP BY thread").all<{ thread: string; n: number }>();
  const media = await env.DB.prepare("SELECT owner_id, COUNT(*) AS n FROM media WHERE owner_kind = 'report' AND state = 'done' GROUP BY owner_id").all<{ owner_id: string; n: number }>();
  const c = new Map(counts.results.map((x) => [x.thread.slice(7), x.n]));
  const md = new Map(media.results.map((x) => [x.owner_id, x.n]));
  return json(results.map((x) => ({ ...x, comments: c.get(x.id as string) ?? 0, media: md.get(x.id as string) ?? 0 })));
}

async function createReport(env: Env, me: string, b: Row) {
  const type = clip(b.type, 20);
  const body = clip(b.body, 8000);
  if (!TYPES.has(type)) return bad("Pick a type");
  if (!body) return bad("Write what it is");
  const id = uid();
  const t = now();
  await env.DB.prepare("INSERT INTO reports (id, created, author, type, place, body, updated) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, t, me, type, clip(b.place, 500), body, t)
    .run();
  return json({ id });
}

async function getReport(env: Env, id: string) {
  const report = await env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(id).first();
  if (!report) return bad("Not found", 404);
  const media = await env.DB.prepare("SELECT id, name, type, size FROM media WHERE owner_kind = 'report' AND owner_id = ? AND state = 'done' ORDER BY created").bind(id).all();
  return json({ ...report, files: media.results });
}

/** Status, note and test link are Claude's (posted from the owner's session); either of you can edit your own text. */
async function patchReport(env: Env, me: string, owner: boolean /* owner or Claude */, id: string, b: Row) {
  const report = await env.DB.prepare("SELECT author FROM reports WHERE id = ?").bind(id).first<{ author: string }>();
  if (!report) return bad("Not found", 404);
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (b.status !== undefined) {
    if (!owner) return bad("Only the owner's session sets status", 403);
    if (!STATUSES.has(String(b.status))) return bad("Unknown status");
    sets.push("status = ?");
    vals.push(String(b.status));
  }
  if (b.notes !== undefined) {
    if (!owner) return bad("Only the owner's session sets notes", 403);
    sets.push("notes = ?");
    vals.push(clip(b.notes, 4000));
  }
  if (b.live_url !== undefined) {
    if (!owner) return bad("Only the owner's session sets the link", 403);
    const u = clip(b.live_url, 500);
    if (u && !/^https:\/\/(www\.)?versesacross\.com(\/|$)/.test(u)) return bad("Links go to versesacross.com");
    sets.push("live_url = ?");
    vals.push(u);
  }
  if (b.body !== undefined) {
    // People edit their own text (the owner may tidy any); Claude never rewrites what someone wrote.
    if (me === "claude" || (report.author !== me && !owner)) return bad("Not your report", 403);
    const body = clip(b.body, 8000);
    if (!body) return bad("Write what it is");
    sets.push("body = ?");
    vals.push(body);
  }
  if (!sets.length) return bad("Nothing to change");
  await env.DB.prepare(`UPDATE reports SET ${sets.join(", ")}, updated = ? WHERE id = ?`).bind(...vals, now(), id).run();
  return json({ ok: true });
}

/* ---------------- Comments ---------------- */

const THREAD = /^(report|approval):[a-f0-9]{16}$|^roadmap:[A-Za-z0-9-]{1,12}$/;

async function listComments(env: Env, thread: string) {
  if (!THREAD.test(thread)) return bad("Bad thread");
  const { results } = await env.DB.prepare("SELECT id, author, body, created FROM comments WHERE thread = ? ORDER BY created").bind(thread).all();
  return json(results);
}

async function addComment(env: Env, me: string, owner: boolean, b: Row) {
  const thread = clip(b.thread, 40);
  const body = clip(b.body, 4000);
  if (!THREAD.test(thread)) return bad("Bad thread");
  if (!body) return bad("Write something");
  // Claude answers from the owner's browser and is shown as Claude.
  const author = me === "claude" || (owner && b.asClaude === true) ? "claude" : me;
  await env.DB.prepare("INSERT INTO comments (id, thread, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(uid(), thread, author, body, now()).run();
  if (thread.startsWith("report:")) await env.DB.prepare("UPDATE reports SET updated = ? WHERE id = ?").bind(now(), thread.slice(7)).run();
  return json({ ok: true });
}

/* ---------------- Uploads and media ---------------- */

async function startUpload(env: Env, me: string, owner: boolean, b: Row) {
  const kind = b.ownerKind === "approval" ? "approval" : "report";
  const ownerId = clip(b.ownerId, 16);
  const size = Number(b.size);
  const type = clip(b.type, 100) || "application/octet-stream";
  const name = clip(b.name, 200).replace(/[^\w.\- ()]+/g, "_") || "file";
  if (!/^[a-f0-9]{16}$/.test(ownerId)) return bad("Bad owner");
  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE) return bad("That file is too big (2 GB at most)");
  if (!MEDIA_TYPES.has(type)) return bad("Photos and videos only (JPEG, PNG, HEIC, MP4, MOV…)");
  if (kind === "approval" && !owner) return bad("Only the owner adds approval files", 403);
  const table = kind === "report" ? "reports" : "approvals";
  const exists = await env.DB.prepare(`SELECT id, ${kind === "report" ? "author" : "created_by"} AS who FROM ${table} WHERE id = ?`).bind(ownerId).first<{ who: string }>();
  if (!exists) return bad("Not found", 404);
  // A report's files come from its author (or the owner); Claude only adds clips to approvals.
  if (kind === "report" && (me === "claude" || (exists.who !== me && !owner))) return bad("Not your report", 403);
  const id = uid();
  const key = `${kind}/${ownerId}/${id}-${name}`;
  const up = await env.MEDIA.createMultipartUpload(key, { httpMetadata: { contentType: type } });
  await env.DB.prepare("INSERT INTO media (id, owner_kind, owner_id, key, name, type, size, upload_id, uploaded_by, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, kind, ownerId, key, name, type, size, up.uploadId, me, now())
    .run();
  return json({ id, partSize: PART, parts: Math.ceil(size / PART) });
}

async function uploadPart(env: Env, req: Request, me: string, id: string, n: number) {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (!(len > 0 && len <= PART)) return bad("Bad part size");
  const row = await env.DB.prepare("SELECT key, upload_id, size, state, uploaded_by FROM media WHERE id = ?").bind(id).first<{ key: string; upload_id: string; size: number; state: string; uploaded_by: string }>();
  if (!row || row.state !== "uploading" || row.uploaded_by !== me) return bad("No such upload", 404);
  if (n < 1 || n > Math.ceil(row.size / PART)) return bad("Bad part");
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > PART) return bad("Bad part size");
  const part = await env.MEDIA.resumeMultipartUpload(row.key, row.upload_id).uploadPart(n, buf);
  return json(part);
}

async function completeUpload(env: Env, me: string, id: string, b: Row) {
  const row = await env.DB.prepare("SELECT key, upload_id, state, uploaded_by FROM media WHERE id = ?").bind(id).first<{ key: string; upload_id: string; state: string; uploaded_by: string }>();
  if (!row || row.state !== "uploading" || row.uploaded_by !== me) return bad("No such upload", 404);
  const parts = (Array.isArray(b.parts) ? b.parts : []).map((p: Row) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) }));
  if (!parts.length) return bad("No parts");
  await env.MEDIA.resumeMultipartUpload(row.key, row.upload_id).complete(parts.sort((a, z) => a.partNumber - z.partNumber));
  // The real size (Range requests are answered from it, not from what the browser said at the start).
  const real = await env.MEDIA.head(row.key);
  await env.DB.prepare("UPDATE media SET state = 'done', upload_id = NULL, size = ? WHERE id = ?").bind(real?.size ?? 0, id).run();
  return json({ ok: true });
}

/** Photos and videos, with Range support (iPhone Safari needs it to play and seek a video). */
async function serveMedia(env: Env, req: Request, id: string) {
  const row = await env.DB.prepare("SELECT key, type, name, size FROM media WHERE id = ? AND state = 'done'").bind(id).first<{ key: string; type: string; name: string; size: number }>();
  if (!row) return bad("Not found", 404);
  const headers: Record<string, string> = {
    "content-type": row.type,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=3600",
    "content-disposition": `inline; filename="${row.name.replace(/"/g, "")}"`,
    "x-content-type-options": "nosniff",
    // Even opened on its own, a file is never a page that can run anything.
    "content-security-policy": "default-src 'none'; media-src 'self'; img-src 'self'; sandbox",
  };
  if (!MEDIA_TYPES.has(row.type)) headers["content-disposition"] = "attachment";
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = row.size;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    const obj = await env.MEDIA.get(row.key, { range: { offset: start, length: end - start + 1 } });
    if (!obj) return bad("Not found", 404);
    return new Response(req.method === "HEAD" ? null : obj.body, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  const obj = await env.MEDIA.get(row.key);
  if (!obj) return bad("Not found", 404);
  return new Response(req.method === "HEAD" ? null : obj.body, { headers: { ...headers, "content-length": String(obj.size) } });
}

/* ---------------- Approvals and website feedback ---------------- */

async function listApprovals(env: Env) {
  const { results } = await env.DB.prepare("SELECT * FROM approvals ORDER BY (status = 'Waiting') DESC, created DESC LIMIT 100").all();
  const media = await env.DB.prepare("SELECT id, owner_id, name, type FROM media WHERE owner_kind = 'approval' AND state = 'done'").all<{ id: string; owner_id: string; name: string; type: string }>();
  return json(results.map((a) => ({ ...a, files: media.results.filter((x) => x.owner_id === a.id) })));
}

async function createApproval(env: Env, me: string, b: Row) {
  const title = clip(b.title, 200);
  if (!title) return bad("Give it a title");
  const id = uid();
  await env.DB.prepare("INSERT INTO approvals (id, kind, title, detail, created, created_by) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, b.kind === "clip" ? "clip" : "other", title, clip(b.detail, 4000), now(), me)
    .run();
  return json({ id });
}

async function decideApproval(env: Env, me: string, id: string, b: Row) {
  const decision = b.decision === "Approved" ? "Approved" : b.decision === "Changes" ? "Changes" : null;
  if (!decision) return bad("Approved or Changes");
  const note = clip(b.note, 2000);
  const t = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE approvals SET status = ?, note = ?, decided_by = ?, decided_at = ? WHERE id = ?").bind(decision, note, me, t, id),
    env.DB.prepare("INSERT INTO decisions (id, what, decision, note, by, at) VALUES (?, ?, ?, ?, ?, ?)").bind(uid(), `approval:${id}`, decision, note, me, t),
  ]);
  return json({ ok: true });
}

/** Website feedback the daily triage put up for a decision (feedback_queue in the site's database). */
async function listFeedback(env: Env) {
  const { results } = await env.SITE_DB.prepare(
    "SELECT id, received, topic, message, page, status FROM feedback_queue WHERE spam = 0 AND status IN ('sheet', 'go', 'no') ORDER BY (status = 'sheet') DESC, received DESC LIMIT 100",
  ).all();
  return json(results);
}

async function decideFeedback(env: Env, me: string, id: string, b: Row) {
  const decision = b.decision === "Go" ? "go" : b.decision === "No" ? "no" : null;
  if (!decision) return bad("Go or No");
  const note = clip(b.note, 2000);
  const row = await env.SITE_DB.prepare("SELECT status FROM feedback_queue WHERE id = ?").bind(id).first<{ status: string }>();
  if (!row) return bad("Not found", 404);
  await env.SITE_DB.prepare("UPDATE feedback_queue SET status = ? WHERE id = ?").bind(decision, id).run();
  await env.DB.prepare("INSERT INTO decisions (id, what, decision, note, by, at) VALUES (?, ?, ?, ?, ?, ?)").bind(uid(), `feedback:${id}`, decision === "go" ? "Go" : "No", note, me, now()).run();
  return json({ ok: true });
}

/* ---------------- Roadmap and shipped ---------------- */

let roadmapCache: { at: number; text: string } | null = null;
let commitsCache: { at: number; list: { sha: string; date: string; text: string }[] } | null = null;

/** ROADMAP.md from the public repo (read-only here), parsed into Now / Next / Later items. */
async function roadmap(env: Env, me: string) {
  if (!roadmapCache || Date.now() - roadmapCache.at > 10 * 60 * 1000) {
    const r = await fetch(`https://raw.githubusercontent.com/${env.REPO}/main/ROADMAP.md`, { headers: { "user-agent": "va-hub" } });
    if (r.ok) roadmapCache = { at: Date.now(), text: await r.text() };
  }
  const sections: { name: string; items: { id: string; title: string; status: string; notes: string }[] }[] = [];
  let cur: (typeof sections)[number] | null = null;
  for (const line of (roadmapCache?.text ?? "").split("\n")) {
    const h = /^## (Now|Next|Later)\b/.exec(line);
    if (h) {
      cur = { name: h[1], items: [] };
      sections.push(cur);
      continue;
    }
    if (/^## /.test(line)) cur = null;
    if (!cur || !line.startsWith("| ") || /^\|\s*-/.test(line) || /^\|\s*(ID|#)\s*\|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3 || !/^[A-Za-z0-9-]{1,12}$/.test(cells[0])) continue;
    const plain = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "");
    cur.items.push({ id: cells[0], title: plain(cells[1]), status: cells.length > 3 ? plain(cells[2]) : "", notes: plain(cells[cells.length - 1]) });
  }
  const votes = await env.DB.prepare("SELECT item, author FROM votes").all<{ item: string; author: string }>();
  const comments = await env.DB.prepare("SELECT thread, COUNT(*) AS n FROM comments WHERE thread LIKE 'roadmap:%' GROUP BY thread").all<{ thread: string; n: number }>();
  const cn = new Map(comments.results.map((c) => [c.thread.slice(8), c.n]));
  for (const s of sections)
    for (const it of s.items as (typeof s.items[number] & { votes?: number; mine?: boolean; comments?: number })[]) {
      const v = votes.results.filter((x) => x.item === it.id);
      it.votes = v.length;
      it.mine = v.some((x) => x.author === me);
      it.comments = cn.get(it.id) ?? 0;
    }
  return json(sections);
}

async function vote(env: Env, me: string, item: string) {
  const had = await env.DB.prepare("SELECT 1 AS x FROM votes WHERE item = ? AND author = ?").bind(item, me).first();
  if (had) await env.DB.prepare("DELETE FROM votes WHERE item = ? AND author = ?").bind(item, me).run();
  else await env.DB.prepare("INSERT INTO votes (item, author, created) VALUES (?, ?, ?)").bind(item, me, now()).run();
  return json({ voted: !had });
}

async function shipped(env: Env) {
  if (!commitsCache || Date.now() - commitsCache.at > 10 * 60 * 1000) {
    const r = await fetch(`https://api.github.com/repos/${env.REPO}/commits?per_page=25`, { headers: { "user-agent": "va-hub", accept: "application/vnd.github+json" } });
    if (r.ok) {
      const list = (await r.json()) as { sha: string; commit: { message: string; author: { date: string } } }[];
      commitsCache = { at: Date.now(), list: list.map((c) => ({ sha: c.sha.slice(0, 9), date: c.commit.author.date, text: c.commit.message.split("\n")[0] })) };
    }
  }
  const notes = await env.DB.prepare("SELECT * FROM shipped ORDER BY created DESC LIMIT 50").all();
  // Anonymous reading totals from the public site (chapters read, read-alongs started, downloads), last 7 and 30 days
  const totals = await env.SITE_DB.prepare(
    "SELECT kind, SUM(CASE WHEN day >= date('now', '-7 day') THEN n ELSE 0 END) AS week, SUM(CASE WHEN day >= date('now', '-30 day') THEN n ELSE 0 END) AS month FROM daily GROUP BY kind",
  )
    .all()
    .catch(() => ({ results: [] }));
  return json({ notes: notes.results, commits: commitsCache?.list ?? [], totals: totals.results });
}

async function addShipped(env: Env, b: Row) {
  const text = clip(b.text, 500);
  if (!text) return bad("Write what shipped");
  const u = clip(b.url, 500);
  await env.DB.prepare("INSERT INTO shipped (id, created, text, url) VALUES (?, ?, ?, ?)").bind(uid(), now(), text, /^https:\/\/(www\.)?versesacross\.com(\/|$)/.test(u) ? u : "").run();
  return json({ ok: true });
}
