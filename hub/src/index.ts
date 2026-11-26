/**
 * Verses Across team hub (hub.versesacross.com): a private, phone-first page for the two people who make
 * Verses Across. Report a bug or idea (with photos / screen recordings), follow its status and talk it
 * through, approve clips and website feedback, see the roadmap and what shipped.
 *
 * Security: Cloudflare Access sits in front (only the team's emails, email one-time code). This Worker
 * does not trust that alone: every request must carry a valid Access token (Cf-Access-Jwt-Assertion,
 * RS256, signed by the team's keys, for this app's AUD, not expired) whose email is on TEAM_EMAILS (or TESTER_EMAILS:
 * testers, who reach only their own tickets and Test & chat, see testerRoutes).
 * Approving: any team member (Skylar and his brother have equal say, Skylar Nov 25); never Claude or a tester.
 * Everything people type is stored and shown as text (never HTML).
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
  delete(key: string | string[]): Promise<void>;
  put(key: string, body: string, o?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  list(o: { prefix: string; limit?: number }): Promise<{ objects: { key: string; size: number; uploaded: Date }[] }>;
};
/**
 * CLAUDE_TOKEN_ID: the Client ID of the Cloudflare Access service token named "Claude" (not secret by itself;
 * its secret stays on Skylar's PC). A request carrying that token is "claude": it may set statuses, notes and
 * test links, answer as Claude, add clips for approval and "what shipped" lines. It can never approve or decide.
 * CERTS_URL: local tests only (`wrangler dev --var CERTS_URL:…`, hub/test.mjs); never set in production. */
/** TESTER_EMAILS (secret, comma-separated): testers (hub 94dcc186). They see only their own tickets, Test & chat; what
 * they send waits as Pending until a team member approves it, and Claude builds nothing Pending. */
/** BADGE_SIGNING_KEY (secret): the private half of the badge key pair, a P-256 JWK as a JSON string (see Badges below). */
type Env = { DB: D1; SITE_DB: D1; MEDIA: R2; TEAM_DOMAIN: string; POLICY_AUD: string; TEAM_EMAILS?: string; TESTER_EMAILS?: string; OWNER_EMAIL?: string; CLAUDE_TOKEN_ID?: string; REPO: string; SITE: string; CERTS_URL?: string; BADGE_SIGNING_KEY?: string };

const TYPES = new Set(["Bug", "Idea", "Content", "Question"]);
/** Open: New, Seen, Working, Question, Reopened. History: Live (shipped), Done (closed), Roadmap (later).
 * Pending: a tester's ticket waiting for a team member's OK (hub 94dcc186); nothing Pending is built. */
const STATUSES = new Set(["New", "Seen", "Working", "Live", "Question", "Roadmap", "Done", "Reopened", "Pending"]);
/** Sorting (HB1): how soon, which part of the site, and which device it happened on. */
const PRIORITIES = new Set(["urgent", "normal", "someday"]);
const AREAS = new Set(["reader", "library", "search", "audio", "study", "phone", "hub", "other"]);
const DEVICES = new Set(["iPhone", "Android", "computer"]);
/** Which site a ticket is about (HB8, Nov 11): one hub for every "…Across" site. */
const SITES = new Set(["verses", "library"]);
const PART = 10 * 1024 * 1024; // upload parts (the page sends 10 MB at a time)
const MAX_FILE = 2 * 1024 * 1024 * 1024; // 2 GB per file
/** Documents (hub 3e4fb130: articles sent in as PDF or Word): always downloaded, never shown inside the hub. */
const DOC_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);
const MAX_DOC = 100 * 1024 * 1024; // 100 MB per document
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

const emails = (v?: string) => (v ?? "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);

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
    return emails(env.TEAM_EMAILS).includes(email) || emails(env.TESTER_EMAILS).includes(email) ? email : deny("not on the team list");
  } catch (e) {
    return deny(`check failed: ${(e as Error).message}`);
  }
}

/* ---------------- Routes ---------------- */

/**
 * Once a day (the cron in wrangler.jsonc): a ticket that has been Live for 3 days with no reply is closed
 * (Done, shown as Resolved) with a note saying so; it can be reopened any time. A week later Claude reviews the
 * ones closed this way (`node hub/cli.mjs autoreview`) and tells HQ about any that don't look resolved.
 */
const AUTO_CLOSE_DAYS = 3;
const AUTO_CLOSED = "Closed automatically";
/** Who changed what, for the audit list (tickets' status changes go in the decisions log too). */
const logged = (env: Env, what: string, decision: string, note: string, by: string, at = now()) =>
  env.DB.prepare("INSERT INTO decisions (id, what, decision, note, by, at) VALUES (?, ?, ?, ?, ?, ?)").bind(uid(), what, decision, note.slice(0, 300), by, at);

async function autoClose(env: Env, at = new Date()) {
  const cutoff = new Date(at.getTime() - AUTO_CLOSE_DAYS * 86_400_000).toISOString();
  const { results } = await env.DB.prepare("SELECT id FROM reports WHERE status = 'Live' AND updated < ?").bind(cutoff).all<{ id: string }>();
  const t = at.toISOString();
  for (const r of results ?? []) {
    // a reply from anyone since it went Live means someone is still talking about it: leave it open
    const last = await env.DB.prepare("SELECT created FROM comments WHERE thread = ? ORDER BY created DESC LIMIT 1").bind(`report:${r.id}`).first<{ created: string }>();
    if (last && last.created > cutoff) continue;
    await env.DB.batch([
      env.DB.prepare("UPDATE reports SET status = 'Done', updated = ? WHERE id = ? AND status = 'Live'").bind(t, r.id),
      env.DB.prepare("INSERT INTO comments (id, thread, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(
        uid(),
        `report:${r.id}`,
        "claude",
        `${AUTO_CLOSED}: Live for ${AUTO_CLOSE_DAYS} days with no reply, so it's counted as fixed. If it isn't, tap "Not fixed? Reopen it".`,
        t,
      ),
      logged(env, `report:${r.id}`, "Done", AUTO_CLOSED, "claude", t),
    ]);
  }
  return results?.length ?? 0;
}

export default {
  async scheduled(event: { cron: string }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (event.cron === HEALTH_CRON) return ctx.waitUntil(checkSite(env));
    ctx.waitUntil(autoClose(env));
    if (new Date().getUTCDay() === 0) ctx.waitUntil(Promise.all([backup(env), weeklyDigest(env)])); // Sundays
  },
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const me = await whoIs(req, env);
    if (!me) return new Response("Not signed in to the Verses Across team hub.", { status: 403, headers: { "content-type": "text/plain" } });
    const owner = me !== "claude" && me === (env.OWNER_EMAIL ?? "").toLowerCase().trim();
    // Claude (its service token, or the owner's own session) does the inbox work: statuses, notes, clips to approve.
    const worker = owner || me === "claude";
    // a tester (on TESTER_EMAILS and not on the team list): their own tickets, Test & chat, nothing else
    const tester = me !== "claude" && !emails(env.TEAM_EMAILS).includes(me);
    const role = me === "claude" ? "claude" : tester ? "tester" : owner ? "owner" : "team";
    // who approves (clips, website feedback, testers' tickets): the team's people, with equal say (Skylar, Nov 25)
    const approver = me !== "claude" && !tester;
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
      if (path === "/api/me") return json({ email: me, owner, worker, approver, role, name: me === "claude" ? "Claude" : me.split("@")[0] });

      // Test & chat (hub 94dcc186): everyone signed in
      if (path === "/api/uat" && m === "GET" && !tester) return listUat(env);
      if (path === "/api/testers" && m === "GET") return tester ? bad("Not found", 404) : json(emails(env.TESTER_EMAILS));
      if (path === "/api/uat" && m === "POST") return tester ? bad("Only the team or Claude add tests", 403) : addUat(env, me, await req.json());
      let u = /^\/api\/uat\/([a-f0-9]{16})$/.exec(path);
      if (u && m === "PATCH") return tester ? bad("Only the team or Claude", 403) : closeUat(env, me, u[1], await req.json());
      if (path === "/api/uat/result" && m === "POST") return me === "claude" ? bad("Tests are tried by people", 403) : uatResult(env, me, await req.json(), tester);
      if (tester) return testerRoutes(req, env, me, path, m, url);

      // Reports
      if (path === "/api/reports" && m === "GET") return listReports(env, url);
      if (path === "/api/reports" && m === "POST") return createReport(env, me, await req.json());
      let r = /^\/api\/reports\/([a-f0-9]{16})$/.exec(path);
      if (r && m === "GET") return getReport(env, r[1]);
      if (r && m === "PATCH") return patchReport(env, me, worker, r[1], await req.json());
      r = /^\/api\/reports\/([a-f0-9]{16})\/reopen$/.exec(path);
      if (r && m === "POST") return me === "claude" ? bad("Only people reopen", 403) : reopenReport(env, me, r[1], await req.json());
      r = /^\/api\/reports\/([a-f0-9]{16})\/approve$/.exec(path);
      if (r && m === "POST") return me === "claude" ? bad("Only Skylar or his brother approve a tester's ticket", 403) : approveReport(env, me, r[1], await req.json());
      r = /^\/api\/reports\/([a-f0-9]{16})\/resolve$/.exec(path);
      if (r && m === "POST") return me === "claude" ? bad("Only people close their tickets (Claude sets Done)", 403) : resolveReport(env, me, r[1], await req.json().catch(() => ({})));

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
      if (r && m === "PATCH") return approver ? decideApproval(env, me, r[1], await req.json()) : bad("Only Skylar or his brother approve", 403);
      if (path === "/api/feedback" && m === "GET") return listFeedback(env);
      r = /^\/api\/feedback\/([a-f0-9]{8})$/.exec(path);
      if (r && m === "PATCH") return approver ? decideFeedback(env, me, r[1], await req.json()) : bad("Only Skylar or his brother decide", 403);

      // Roadmap, votes, shipped
      if (path === "/api/roadmap" && m === "GET") return roadmap(env, me, url.searchParams.get("site") === "library" ? "library" : "verses");
      r = /^\/api\/roadmap\/([A-Za-z0-9-]{1,12})\/vote$/.exec(path);
      if (r && m === "POST") return me === "claude" ? bad("Votes are for people", 403) : vote(env, me, r[1]);
      if (path === "/api/shipped" && m === "GET") return shipped(env);
      if (path === "/api/shipped" && m === "POST") return worker ? addShipped(env, await req.json()) : bad("Only the owner or Claude can add", 403);

      // Badges (Nov 26): issued and revoked by Skylar or his brother only (never Claude or a tester)
      if (path.startsWith("/api/badges")) {
        // people on TEAM_EMAILS only; Claude never, whichever way it signs in
        if (me === "claude" || !approver || !emails(env.TEAM_EMAILS).includes(me)) return bad("Only Skylar or his brother issue badges", 403);
        if (path === "/api/badges" && m === "GET") return listBadges(env);
        if (path === "/api/badges/issue" && m === "POST") return issueBadge(env, me, owner, await req.json());
        r = /^\/api\/badges\/([a-f0-9]{16})\/revoke$/.exec(path);
        if (r && m === "POST") return revokeBadge(env, me, r[1]);
        return bad("Not found", 404);
      }

      // Site health, the audit list and backups (HB5, HB6)
      if (path === "/api/health" && m === "GET") return health(env);
      if (path === "/api/audit" && m === "GET") return audit(env);
      if (path === "/api/digest" && m === "GET") return json({ text: await digestText(env) });
      if (path === "/api/backup" && m === "POST") return worker ? json(await backup(env)) : bad("Only the owner or Claude", 403);
      if (path === "/api/check" && m === "POST") return worker ? json(await checkSite(env)) : bad("Only the owner or Claude", 403);

      return bad("Not found", 404);
    } catch (e) {
      console.error(path, (e as Error).message);
      return bad("Something went wrong", 500);
    }
  },
};

/* ---------------- Reports ---------------- */

async function listReports(env: Env, url: URL, author?: string) {
  const status = url.searchParams.get("status");
  const q = author
    ? env.DB.prepare("SELECT * FROM reports WHERE author = ? ORDER BY created DESC LIMIT 500").bind(author)
    : status && STATUSES.has(status)
    ? env.DB.prepare("SELECT * FROM reports WHERE status = ? ORDER BY created DESC LIMIT 500").bind(status)
    : env.DB.prepare("SELECT * FROM reports ORDER BY created DESC LIMIT 500");
  const { results } = await q.all();
  const counts = await env.DB.prepare("SELECT thread, COUNT(*) AS n FROM comments WHERE thread LIKE 'report:%' GROUP BY thread").all<{ thread: string; n: number }>();
  const media = await env.DB.prepare("SELECT owner_id, COUNT(*) AS n FROM media WHERE owner_kind = 'report' AND state = 'done' GROUP BY owner_id").all<{ owner_id: string; n: number }>();
  const c = new Map(counts.results.map((x) => [x.thread.slice(7), x.n]));
  const md = new Map(media.results.map((x) => [x.owner_id, x.n]));
  return json(results.map((x) => ({ ...x, comments: c.get(x.id as string) ?? 0, media: md.get(x.id as string) ?? 0 })));
}

async function createReport(env: Env, me: string, b: Row, status = "New") {
  const type = clip(b.type, 20);
  const body = clip(b.body, 50000);
  if (!TYPES.has(type)) return bad("Pick a type");
  if (!body) return bad("Write what it is");
  const id = uid();
  const t = now();
  const priority = PRIORITIES.has(String(b.priority)) ? String(b.priority) : "normal";
  const area = AREAS.has(String(b.area)) ? String(b.area) : "";
  const device = DEVICES.has(String(b.device)) ? String(b.device) : "";
  const site = SITES.has(String(b.site)) ? String(b.site) : "verses";
  await ensureColumns(env);
  // e.g. "Safari 15.6 · macOS 10.15", worked out by the page from the browser (shown as text, never trusted for anything)
  const browser = clip(b.browser, 80).replace(/[^\w .,·()/-]+/g, "");
  await env.DB.prepare("INSERT INTO reports (id, created, author, type, place, body, updated, priority, area, device, site, status, browser) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, t, me, type, clip(b.place, 500), body, t, priority, area, device, site, status, browser)
    .run();
  return json({ id });
}

/** Columns added after the first schema (a Worker adding its own; schema.sql has them): browser (Nov 25). */
let colsReady: Promise<unknown> | null = null;
const ensureColumns = (env: Env) =>
  (colsReady ??= env.DB.prepare("ALTER TABLE reports ADD COLUMN browser TEXT NOT NULL DEFAULT ''")
    .run()
    .catch((e: Error) => (/duplicate column/i.test(e.message) ? null : ((colsReady = null), Promise.reject(e)))));

async function getReport(env: Env, id: string) {
  const report = await env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(id).first();
  if (!report) return bad("Not found", 404);
  const media = await env.DB.prepare("SELECT id, name, type, size FROM media WHERE owner_kind = 'report' AND owner_id = ? AND state = 'done' ORDER BY created").bind(id).all();
  return json({ ...report, files: media.results });
}

/** Status, note and test link are Claude's (posted from the owner's session); either of you can edit your own text. */
async function patchReport(env: Env, me: string, owner: boolean /* owner or Claude */, id: string, b: Row) {
  const report = await env.DB.prepare("SELECT author, status FROM reports WHERE id = ?").bind(id).first<{ author: string; status: string }>();
  if (!report) return bad("Not found", 404);
  const sets: string[] = [];
  const vals: unknown[] = [];
  const extra: D1Stmt[] = [];
  // Sorting: the reporter or the owner's session (Claude) may set these.
  const mine = me !== "claude" && report.author === me;
  // a tester's ticket waits for a person's OK (approveReport): Claude can't move it on
  if (report.status === "Pending" && b.status !== undefined && b.status !== "Pending") return bad("Waiting for Skylar's or his brother's OK first", 403);
  for (const [k, allowed] of [["priority", PRIORITIES], ["area", AREAS], ["device", DEVICES], ["site", SITES]] as const) {
    if (b[k] === undefined) continue;
    if (!owner && !mine) return bad("Not your report", 403);
    const v = String(b[k]);
    if ((v || k === "priority" || k === "site") && !allowed.has(v)) return bad(`Unknown ${k}`);
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  // "Same as #…": closes this one and points to the other (Claude, from the owner's session).
  if (b.dup_of !== undefined) {
    if (!owner) return bad("Only the owner's session marks duplicates", 403);
    const other = String(b.dup_of).replace(/^#/, "").trim().toLowerCase();
    if (other) {
      if (!/^[a-f0-9]{4,16}$/.test(other)) return bad("Give the other ticket's number, e.g. #3fa2c1");
      const match = await env.DB.prepare("SELECT id FROM reports WHERE id LIKE ? AND id != ? LIMIT 2").bind(`${other}%`, id).all<{ id: string }>();
      if (match.results.length !== 1) return bad("No single ticket starts with that number");
      const to = match.results[0].id;
      const t = now();
      sets.push("dup_of = ?", "status = 'Done'");
      vals.push(to);
      extra.push(
        env.DB.prepare("INSERT INTO comments (id, thread, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(uid(), `report:${id}`, "claude", `Same as #${to.slice(0, 6)}: closed here, followed there.`, t),
        logged(env, `report:${id}`, "Done", `same as #${to.slice(0, 6)}`, me, t),
      );
    } else sets.push("dup_of = ''");
  }
  if (b.status !== undefined) {
    if (!owner) return bad("Only the owner's session sets status", 403);
    if (!STATUSES.has(String(b.status))) return bad("Unknown status");
    if (String(b.status) === "Live") {
      const full = await env.DB.prepare("SELECT type, notes, live_url FROM reports WHERE id = ?").bind(id).first<{ type: string; notes: string; live_url: string }>();
      const note = b.notes !== undefined ? clip(b.notes, 4000) : full?.notes ?? "";
      const link = b.live_url !== undefined ? clip(b.live_url, 500) : full?.live_url ?? "";
      const missing = liveNoteMissing(note);
      if (missing) return bad(`A Live note needs ${missing} (What: … Try it: … Untested: …)`);
      if (!link && full?.type !== "Question") return bad("Set the test link first (link <id> <url>)");
    }
    if (b.dup_of) return bad("Set the status or the duplicate, not both");
    sets.push("status = ?");
    vals.push(String(b.status));
    if (String(b.status) !== report.status) extra.push(logged(env, `report:${id}`, String(b.status), clip(b.notes, 300), me));
  }
  if (b.notes !== undefined) {
    if (!owner) return bad("Only the owner's session sets notes", 403);
    sets.push("notes = ?");
    vals.push(clip(b.notes, 4000));
  }
  if (b.live_url !== undefined) {
    if (!owner) return bad("Only the owner's session sets the link", 403);
    const u = clip(b.live_url, 500);
    if (u && !/^https:\/\/(www\.)?(versesacross|libraryacross)\.com(\/|$)/.test(u)) return bad("Links go to versesacross.com or libraryacross.com");
    sets.push("live_url = ?");
    vals.push(u);
  }
  if (b.body !== undefined) {
    // People edit their own text (the owner may tidy any); Claude never rewrites what someone wrote.
    if (me === "claude" || (report.author !== me && !owner)) return bad("Not your report", 403);
    const body = clip(b.body, 50000);
    if (!body) return bad("Write what it is");
    sets.push("body = ?");
    vals.push(body);
  }
  if (!sets.length) return bad("Nothing to change");
  const t = now();
  await env.DB.batch([env.DB.prepare(`UPDATE reports SET ${sets.join(", ")}, updated = ? WHERE id = ?`).bind(...vals, t, id), ...extra]);
  return json({ ok: true, updated: t });
}

/** What a Live note lacks, or "" (the hub's definition of done, Nov 25): what changed, how to try it, what wasn't tested. */
function liveNoteMissing(note: string) {
  const need = [
    [/\bwhat\b/i, "what changed"],
    [/\btry\b|\bexample/i, "how to try it"],
    [/\buntested\b|\bnot tested\b|\bwasn'?t tested\b|\bnot checked\b/i, "what wasn't tested"],
  ] as const;
  const lacks = need.filter(([re]) => !re.test(note)).map(([, w]) => w);
  return note.trim().length < 40 ? "a few sentences" : lacks.join(", ");
}

/** "Not fixed": either of you can send a finished report (Live or Done) back with a note; it shows as Reopened. */
async function reopenReport(env: Env, me: string, id: string, b: Row) {
  const note = clip(b.note, 20000);
  if (!note) return bad("Say what's still wrong");
  const report = await env.DB.prepare("SELECT status FROM reports WHERE id = ?").bind(id).first<{ status: string }>();
  if (!report) return bad("Not found", 404);
  if (report.status !== "Live" && report.status !== "Done") return bad("Only finished reports can be reopened");
  const t = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE reports SET status = 'Reopened', dup_of = '', updated = ? WHERE id = ?").bind(t, id),
    env.DB.prepare("INSERT INTO comments (id, thread, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(uid(), `report:${id}`, me, `Reopened, not fixed: ${note}`, t),
    logged(env, `report:${id}`, "Reopened", note, me, t),
  ]);
  // the edge case becomes a standing test (Nov 25: a reopen is a regression to keep checking)
  await ensureUat(env);
  const first = await env.DB.prepare("SELECT body, live_url FROM reports WHERE id = ?").bind(id).first<{ body: string; live_url: string }>();
  await env.DB.prepare("INSERT INTO uat (id, created, created_by, title, steps, url) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(uid(), t, "claude", `Recheck #${id.slice(0, 6)}: ${String(first?.body ?? "").split("\n")[0].slice(0, 120)}`, `Reopened because: ${note.slice(0, 1500)}`, first?.live_url ?? "")
    .run();
  return json({ ok: true });
}

/** "Fixed, close it": the reporter (or Skylar) confirms a Live fix works → Done (shown as Resolved, in Cases Closed). */
async function resolveReport(env: Env, me: string, id: string, b: Row) {
  const note = clip(b?.note, 20000);
  const report = await env.DB.prepare("SELECT status FROM reports WHERE id = ?").bind(id).first<{ status: string }>();
  if (!report) return bad("Not found", 404);
  if (report.status !== "Live") return bad("Only a Live ticket can be closed this way");
  const t = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE reports SET status = 'Done', updated = ? WHERE id = ?").bind(t, id),
    env.DB.prepare("INSERT INTO comments (id, thread, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(uid(), `report:${id}`, me, note ? `Fixed, closed: ${note}` : "Fixed, closed.", t),
    logged(env, `report:${id}`, "Done", note || "fixed, closed by the reporter", me, t),
  ]);
  return json({ ok: true });
}

/* ---------------- Comments ---------------- */

const THREAD = /^(report|approval|uat):[a-f0-9]{16}$|^roadmap:[A-Za-z0-9-]{1,12}$|^chat:team$/;

async function listComments(env: Env, thread: string) {
  if (!THREAD.test(thread)) return bad("Bad thread");
  // the team chat: its newest 300
  const { results } = thread === "chat:team"
    ? await env.DB.prepare("SELECT * FROM (SELECT id, author, body, created FROM comments WHERE thread = ? ORDER BY created DESC LIMIT 300) ORDER BY created").bind(thread).all()
    : await env.DB.prepare("SELECT id, author, body, created FROM comments WHERE thread = ? ORDER BY created").bind(thread).all();
  return json(results);
}

async function addComment(env: Env, me: string, owner: boolean, b: Row) {
  const thread = clip(b.thread, 40);
  const body = clip(b.body, 20000);
  if (!THREAD.test(thread)) return bad("Bad thread");
  if (!body) return bad("Write something");
  // Claude answers from the owner's browser and is shown as Claude.
  const author = me === "claude" || (owner && b.asClaude === true) ? "claude" : me;
  await env.DB.prepare("INSERT INTO comments (id, thread, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(uid(), thread, author, body, now()).run();
  if (thread.startsWith("report:")) await env.DB.prepare("UPDATE reports SET updated = ? WHERE id = ?").bind(now(), thread.slice(7)).run();
  return json({ ok: true });
}

/* ---------------- Testers, approval of their tickets, Test & chat (hub 94dcc186) ---------------- */

/** What a tester may do: send tickets (Pending until approved), see and talk on their own, add files to them, see
 * those files, and the team chat. Everything else is refused here, before the team's routes. */
async function testerRoutes(req: Request, env: Env, me: string, path: string, m: string, url: URL): Promise<Response> {
  const own = async (id: string) => (await env.DB.prepare("SELECT author FROM reports WHERE id = ?").bind(id).first<{ author: string }>())?.author === me;
  if (path === "/api/reports" && m === "GET") return listReports(env, url, me);
  if (path === "/api/reports" && m === "POST") return createReport(env, me, await req.json(), "Pending");
  let r = /^\/api\/reports\/([a-f0-9]{16})$/.exec(path);
  if (r && m === "GET") return (await own(r[1])) ? getReport(env, r[1]) : bad("Not found", 404);
  if (r && m === "PATCH") {
    if (!(await own(r[1]))) return bad("Not found", 404);
    const b = (await req.json()) as Row;
    if (b.status !== undefined || b.notes !== undefined || b.live_url !== undefined || b.dup_of !== undefined) return bad("Only the team changes that", 403);
    if (b.body !== undefined) {
      const st = await env.DB.prepare("SELECT status FROM reports WHERE id = ?").bind(r[1]).first<{ status: string }>();
      if (st?.status !== "Pending") return bad("Once approved, add to it in the conversation instead", 403);
    }
    return patchReport(env, me, false, r[1], b);
  }
  // their own Live ticket: "Fixed, close it" or "Not fixed? Reopen it"
  r = /^\/api\/reports\/([a-f0-9]{16})\/(reopen|resolve)$/.exec(path);
  if (r && m === "POST") {
    const t = await env.DB.prepare("SELECT author, status FROM reports WHERE id = ?").bind(r[1]).first<{ author: string; status: string }>();
    if (!t || t.author !== me) return bad("Not found", 404);
    if (t.status !== "Live") return bad("Only a shipped (Live) ticket can be closed or reopened", 403);
    const b = (await req.json().catch(() => ({}))) as Row;
    return r[2] === "reopen" ? reopenReport(env, me, r[1], b) : resolveReport(env, me, r[1], b);
  }
  if (path === "/api/uat" && m === "GET") return listUat(env, me);
  if ((path === "/api/comments" && m === "GET") || (path === "/api/comments" && m === "POST")) {
    const b = m === "POST" ? ((await req.json()) as Row) : null;
    const thread = m === "GET" ? url.searchParams.get("thread") ?? "" : clip(b?.thread, 40);
    const ok = thread === "chat:team" || /^uat:[a-f0-9]{16}$/.test(thread) || (/^report:[a-f0-9]{16}$/.test(thread) && (await own(thread.slice(7))));
    if (!ok) return bad("Not found", 404);
    if (m === "POST") return addComment(env, me, false, { ...b, asClaude: false });
    const list = (await (await listComments(env, thread)).json()) as Row[];
    return json(list.map((c) => ({ ...c, author: shown(env, me, String(c.author)) })));
  }
  if (path === "/api/uploads" && m === "POST") return startUpload(env, me, false, await req.json());
  r = /^\/api\/uploads\/([a-f0-9]{16})\/part\/(\d{1,5})$/.exec(path);
  if (r && m === "PUT") return uploadPart(env, req, me, r[1], Number(r[2]));
  r = /^\/api\/uploads\/([a-f0-9]{16})\/complete$/.exec(path);
  if (r && m === "POST") return completeUpload(env, me, r[1], await req.json());
  r = /^\/api\/media\/([a-f0-9]{16})$/.exec(path);
  if (r && (m === "GET" || m === "HEAD")) {
    const f = await env.DB.prepare("SELECT owner_kind, owner_id FROM media WHERE id = ?").bind(r[1]).first<{ owner_kind: string; owner_id: string }>();
    return f && f.owner_kind === "report" && (await own(f.owner_id)) ? serveMedia(env, req, r[1]) : bad("Not found", 404);
  }
  return bad("Testers see their own tickets and Test & chat", 403);
}

/** How a tester sees a name: themselves, "claude", or "Team" for everyone else (never another person's email). */
const shown = (env: Env, me: string, email: string) => (email === me || email === "claude" ? email : emails(env.TEAM_EMAILS).includes(email) ? "Team" : "Another tester");

/** A tester's ticket: a team member says Go (it becomes New, for Claude) or No (closed, with the reason). */
async function approveReport(env: Env, me: string, id: string, b: Row) {
  const report = await env.DB.prepare("SELECT status FROM reports WHERE id = ?").bind(id).first<{ status: string }>();
  if (!report) return bad("Not found", 404);
  if (report.status !== "Pending") return bad("This ticket isn't waiting for an OK");
  if (b.decision !== "go" && b.decision !== "no") return bad("Approve (go) or decline (no)");
  const go = b.decision === "go";
  const note = clip(b.note, 500);
  const t = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE reports SET status = ?, updated = ? WHERE id = ? AND status = 'Pending'").bind(go ? "New" : "Done", t, id),
    env.DB.prepare("INSERT INTO comments (id, thread, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(
      uid(), `report:${id}`, me, go ? `Approved for building.${note ? " " + note : ""}` : `Not this time.${note ? " " + note : ""}`, t),
    logged(env, `report:${id}`, go ? "Go" : "No", note, me, t),
  ]);
  return json({ ok: true, updated: t });
}

/** The Test & chat tables, made the first time they're needed (a Worker making its own tables; schema.sql has them). */
let uatReady: Promise<unknown> | null = null;
const ensureUat = (env: Env) =>
  (uatReady ??= env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS uat (id TEXT PRIMARY KEY, created TEXT NOT NULL, created_by TEXT NOT NULL, title TEXT NOT NULL, steps TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', closed TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS uat_results (target TEXT NOT NULL, author TEXT NOT NULL, result TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', at TEXT NOT NULL, PRIMARY KEY (target, author))"),
  ]).catch((e) => ((uatReady = null), Promise.reject(e))));

/** What to test: the open tests, and every Live ticket (title, Claude's note, its test link; never its files). */
async function listUat(env: Env, tester?: string) {
  await ensureUat(env);
  const tests = await env.DB.prepare("SELECT id, created, created_by, title, steps, url FROM uat WHERE closed IS NULL ORDER BY created DESC LIMIT 100").all<Row>();
  const live = await env.DB.prepare("SELECT id, body, notes, live_url, site, updated FROM reports WHERE status = 'Live' ORDER BY updated DESC LIMIT 100").all<Row>();
  const results = await env.DB.prepare("SELECT target, author, result, note, at FROM uat_results ORDER BY at DESC LIMIT 2000").all<Row>();
  const items = [
    ...tests.results.map((x) => ({ target: `uat:${x.id}`, kind: "test", id: x.id, title: x.title, steps: x.steps, url: x.url, at: x.created, by: x.created_by })),
    ...live.results.map((x) => ({
      target: `report:${x.id}`,
      kind: "ticket",
      id: x.id,
      title: String(x.body).split("\n")[0].slice(0, 160),
      steps: tester ? "" : x.notes, // (Claude's notes are for the team)
      url: x.live_url,
      at: x.updated,
      site: x.site,
    })),
  ].sort((a, z) => String(z.at).localeCompare(String(a.at)));
  const targets = new Set(items.map((i) => i.target));
  const by: Record<string, Row[]> = {};
  for (const x of results.results.reverse()) if (targets.has(String(x.target))) (by[String(x.target)] ??= []).push(tester ? { ...x, author: shown(env, tester, String(x.author)) } : x);
  return json({
    items: tester ? items.map((i) => ("by" in i ? { ...i, by: shown(env, tester, String(i.by)), ...(String(i.title).startsWith("Recheck #") ? { steps: "" } : {}) } : i)) : items,
    results: by,
  });
}

async function addUat(env: Env, me: string, b: Row) {
  await ensureUat(env);
  const title = clip(b.title, 200);
  const url = clip(b.url, 500);
  if (!title) return bad("Say what to test");
  if (url && !/^https:\/\//.test(url)) return bad("The link starts with https://");
  const id = uid();
  await env.DB.prepare("INSERT INTO uat (id, created, created_by, title, steps, url) VALUES (?, ?, ?, ?, ?, ?)").bind(id, now(), me, title, clip(b.steps, 5000), url).run();
  return json({ id });
}

async function closeUat(env: Env, me: string, id: string, b: Row) {
  await ensureUat(env);
  await env.DB.batch([
    env.DB.prepare("UPDATE uat SET closed = ? WHERE id = ?").bind(b.closed === false ? null : now(), id),
    logged(env, `uat:${id}`, b.closed === false ? "Reopened" : "Closed", "", me),
  ]);
  return json({ ok: true });
}

/** Works / doesn't work, one answer per person (a new one replaces theirs). "Doesn't work" on a Live ticket also goes
 * on that ticket's conversation, so Claude sees it. */
async function uatResult(env: Env, me: string, b: Row, tester = false) {
  await ensureUat(env);
  const target = clip(b.target, 40);
  const result = b.result === "pass" ? "pass" : b.result === "fail" ? "fail" : "";
  const note = clip(b.note, 2000);
  if (!/^(uat|report):[a-f0-9]{16}$/.test(target) || !result) return bad("Bad test");
  if (result === "fail" && !note) return bad("Say what went wrong");
  const open = target.startsWith("report:")
    ? await env.DB.prepare("SELECT id FROM reports WHERE id = ? AND status = 'Live'").bind(target.slice(7)).first()
    : await env.DB.prepare("SELECT id FROM uat WHERE id = ? AND closed IS NULL").bind(target.slice(4)).first();
  if (!open) return bad("That test isn't open", 404);
  const t = now();
  const stmts = [
    env.DB.prepare("INSERT INTO uat_results (target, author, result, note, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (target, author) DO UPDATE SET result = excluded.result, note = excluded.note, at = excluded.at").bind(target, me, result, note, t),
  ];
  if (result === "fail") {
    stmts.push(env.DB.prepare("INSERT INTO comments (id, thread, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(uid(), target, me, `${tester ? "Tester's test" : "Test"}: doesn't work. ${note}`, t));
    if (target.startsWith("report:")) stmts.push(env.DB.prepare("UPDATE reports SET updated = ? WHERE id = ?").bind(t, target.slice(7)));
  }
  await env.DB.batch(stmts);
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
  if (!Number.isFinite(size) || size <= 0) return bad("That file is empty");
  if (size > MAX_FILE) return bad("That file is too big (2 GB at most)");
  if (!MEDIA_TYPES.has(type) && !DOC_TYPES.has(type)) return bad("Photos, videos or documents only (JPEG, PNG, HEIC, MP4, MOV, PDF, Word, TXT, MD)");
  if (DOC_TYPES.has(type) && size > MAX_DOC) return bad("That document is too big (100 MB at most)");
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

/** Photos and videos (shown), with Range support (iPhone Safari needs it to play and seek a video); documents and
 * anything else only as a download. */
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
  if (!MEDIA_TYPES.has(row.type)) headers["content-disposition"] = `attachment; filename="${row.name.replace(/"/g, "")}"`;
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
  const row = await env.SITE_DB.prepare("SELECT status, topic, message, page FROM feedback_queue WHERE id = ?").bind(id).first<{ status: string; topic: string; message: string; page: string }>();
  if (!row) return bad("Not found", 404);
  if (row.status !== "sheet") return bad("Already decided", 409);
  // only the first decision counts (a double tap, or both of you at once, changes nothing more)
  const res = (await env.SITE_DB.prepare("UPDATE feedback_queue SET status = ? WHERE id = ? AND status = 'sheet'").bind(decision, id).run()) as { meta?: { changes?: number } };
  if (res?.meta?.changes === 0) return bad("Already decided", 409);
  if (decision === "go") {
    // a Go makes it a ticket for Claude, linked back to the feedback (Nov 25); if that fails the Go is undone
    const made = await createReport(env, me, { type: row.topic === "bug" ? "Bug" : "Idea", body: `Website feedback (Go${note ? ": " + note : ""}):\n\n${row.message}`, place: `feedback ${id}${row.page ? " · " + row.page : ""}` }).catch(() => null);
    if (!made || !made.ok) {
      await env.SITE_DB.prepare("UPDATE feedback_queue SET status = 'sheet' WHERE id = ?").bind(id).run();
      return bad("Couldn't make the ticket; try again", 500);
    }
  }
  await env.DB.prepare("INSERT INTO decisions (id, what, decision, note, by, at) VALUES (?, ?, ?, ?, ?, ?)").bind(uid(), `feedback:${id}`, decision === "go" ? "Go" : "No", note, me, now()).run();
  return json({ ok: true });
}

/* ---------------- Roadmap and shipped ---------------- */

/** One roadmap per site (Nov 10): ROADMAP.md is Verses Across, ROADMAP-LIBRARY.md is Library Across. Item ids are
 * unique across both files, so votes and comments (keyed by id) never mix. */
const ROADMAP_FILES = { verses: "ROADMAP.md", library: "ROADMAP-LIBRARY.md" } as const;
const roadmapCache: Record<string, { at: number; text: string }> = {};
let commitsCache: { at: number; list: { sha: string; date: string; text: string }[] } | null = null;

/** A site's roadmap file from the public repo (read-only here), parsed into Now / Next / Later items. */
async function roadmap(env: Env, me: string, site: keyof typeof ROADMAP_FILES) {
  const file = ROADMAP_FILES[site];
  const cached = roadmapCache[file];
  if (!cached || Date.now() - cached.at > 10 * 60 * 1000) {
    const r = await fetch(`https://raw.githubusercontent.com/${env.REPO}/main/${file}`, { headers: { "user-agent": "va-hub" } });
    if (r.ok) roadmapCache[file] = { at: Date.now(), text: await r.text() };
  }
  const sections: { name: string; items: { id: string; title: string; status: string; notes: string }[] }[] = [];
  let cur: (typeof sections)[number] | null = null;
  for (const line of (roadmapCache[file]?.text ?? "").split("\n")) {
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
  // tickets that went Live in the last 60 days (each once, its latest time)
  const tickets = await env.DB.prepare(
    "SELECT r.id, r.body, r.live_url, r.status, MAX(d.at) AS at FROM decisions d JOIN reports r ON d.what = 'report:' || r.id WHERE d.decision = 'Live' AND d.at >= ? GROUP BY r.id ORDER BY at DESC LIMIT 200",
  )
    .bind(new Date(Date.now() - 60 * 86_400_000).toISOString())
    .all<{ id: string; body: string; live_url: string; status: string; at: string }>();
  // Anonymous reading totals from the public site (chapters read, read-alongs started, downloads), last 7 and 30 days
  const totals = await env.SITE_DB.prepare(
    "SELECT kind, SUM(CASE WHEN day >= date('now', '-7 day') THEN n ELSE 0 END) AS week, SUM(CASE WHEN day >= date('now', '-30 day') THEN n ELSE 0 END) AS month FROM daily WHERE version = '*' GROUP BY kind",
  )
    .all()
    .catch(() => ({ results: [] }));
  return json({
    notes: notes.results,
    commits: commitsCache?.list ?? [],
    totals: totals.results,
    tickets: tickets.results.map((t) => ({ id: t.id, title: t.body.split("\n")[0].slice(0, 160), url: t.live_url, status: t.status, at: t.at })),
  });
}

async function addShipped(env: Env, b: Row) {
  const text = clip(b.text, 500);
  if (!text) return bad("Write what shipped");
  const u = clip(b.url, 500);
  await env.DB.prepare("INSERT INTO shipped (id, created, text, url) VALUES (?, ?, ?, ?)").bind(uid(), now(), text, /^https:\/\/(www\.)?versesacross\.com(\/|$)/.test(u) ? u : "").run();
  return json({ ok: true });
}

/* ---------------- Weekly summary (Nov 25) ---------------- */

/** The week in four numbers, for the team chat on Sundays (and `cli.mjs digest`): what shipped, what waits on a
 * person, reopens, how long tickets take from sent to Live, and how many fixes a person confirmed. */
async function digestText(env: Env, at = new Date(), titles = true) {
  const since = new Date(at.getTime() - 7 * 86_400_000).toISOString();
  const { results: log } = await env.DB.prepare("SELECT what, decision, note, by, at FROM decisions WHERE what LIKE 'report:%' AND at >= ? ORDER BY at").bind(since).all<{ what: string; decision: string; note: string; by: string; at: string }>();
  const live = new Set(log.filter((d) => d.decision === "Live").map((d) => d.what));
  const reopened = new Set(log.filter((d) => d.decision === "Reopened").map((d) => d.what));
  const closed = log.filter((d) => d.decision === "Done");
  // confirmed by a person: their "Fixed, closed" (resolveReport), not status saves or duplicates
  const byPerson = (await env.DB.prepare("SELECT COUNT(*) AS n FROM comments WHERE thread LIKE 'report:%' AND body LIKE 'Fixed, closed%' AND created >= ?").bind(since).first<{ n: number }>())?.n ?? 0;
  const auto = closed.filter((d) => d.note === AUTO_CLOSED).length;
  // sent → first Live, for tickets that went Live this week
  const hours: number[] = [];
  for (const w of live) {
    const r = await env.DB.prepare("SELECT created FROM reports WHERE id = ?").bind(w.slice(7)).first<{ created: string }>();
    const first = log.find((d) => d.what === w && d.decision === "Live");
    if (r && first) hours.push((Date.parse(first.at) - Date.parse(r.created)) / 3_600_000);
  }
  hours.sort((a, z) => a - z);
  const median = hours.length ? hours[Math.floor(hours.length / 2)] : null;
  const waiting = await env.DB.prepare("SELECT id, body, status, created FROM reports WHERE status IN ('Question', 'Pending') ORDER BY created").all<{ id: string; body: string; status: string; created: string }>();
  const open = await env.DB.prepare("SELECT id, body, created FROM reports WHERE status IN ('New', 'Seen', 'Working', 'Reopened') ORDER BY created LIMIT 1").first<{ id: string; body: string; created: string }>();
  const line = (r: { id: string; body: string }) => `#${r.id.slice(0, 6)} ${r.body.split("\n")[0].slice(0, 70)}`;
  const fmt = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`);
  return [
    `Weekly summary (${since.slice(0, 10)} to ${at.toISOString().slice(0, 10)})`,
    `Shipped: ${live.size} ticket${live.size === 1 ? "" : "s"}${median !== null ? ` · usually ${fmt(median)} from sent to Live` : ""}`,
    `Reopened: ${reopened.size} · Closed: ${closed.length} (${byPerson} confirmed by a person, ${auto} automatically)`,
    waiting.results.length ? `Waiting on you: ${waiting.results.length}${titles ? ": " + waiting.results.slice(0, 5).map(line).join(" · ") : " (see Shipped → Weekly summary)"}` : "Waiting on you: nothing",
    open ? `Oldest open: ${titles ? line(open) : "#" + open.id.slice(0, 6)} (since ${open.created.slice(0, 10)})` : "Open tickets: none",
  ].join("\n");
}

async function weeklyDigest(env: Env) {
  await env.DB.prepare("INSERT INTO comments (id, thread, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(uid(), "chat:team", "claude", await digestText(env, new Date(), false), now()).run();
}

/* ---------------- Site health, audit and backups (HB5, HB6) ---------------- */

/** The hourly cron in wrangler.jsonc (the daily one closes tickets and, on Sundays, backs up). */
const HEALTH_CRON = "17 * * * *";
/** What the hourly check opens: the home page, a chapter, a search index and the cross references. */
const CHECK_PAGES = ["/", "/read/bible/genesis/1", "/search/kjv/meta.json", "/api/xref/bible/gen.json"];

async function checkSite(env: Env) {
  let ok = 1;
  let slowest = 0;
  const failed: string[] = [];
  for (const page of CHECK_PAGES) {
    const t0 = Date.now();
    try {
      const r = await fetch(env.SITE + page, { headers: { "user-agent": "va-hub health check" } });
      await r.arrayBuffer();
      if (!r.ok) {
        ok = 0;
        failed.push(`${page} answered ${r.status}`);
      }
    } catch (e) {
      ok = 0;
      failed.push(`${page}: ${(e as Error).message.slice(0, 80)}`);
    }
    slowest = Math.max(slowest, Date.now() - t0);
  }
  const at = now();
  await env.DB.batch([
    env.DB.prepare("INSERT OR REPLACE INTO health (at, ok, ms, detail) VALUES (?, ?, ?, ?)").bind(at, ok, slowest, failed.join("; ")),
    env.DB.prepare("DELETE FROM health WHERE at < ?").bind(new Date(Date.now() - 60 * 86_400_000).toISOString()),
  ]);
  return { at, ok: !!ok, ms: slowest, detail: failed.join("; ") };
}

async function health(env: Env) {
  const checks = await env.DB.prepare("SELECT at, ok, ms, detail FROM health ORDER BY at DESC LIMIT 400").all();
  // Reading totals by week (8 weeks) and website feedback (7 and 30 days), from the public site's database
  const weeks = await env.SITE_DB.prepare(
    "SELECT date(day, '-' || ((strftime('%w', day) + 6) % 7) || ' days') AS week, kind, SUM(n) AS n FROM daily WHERE version = '*' AND day >= date('now', '-56 day') GROUP BY week, kind ORDER BY week",
  )
    .all()
    .catch(() => ({ results: [] }));
  const feedback = await env.SITE_DB.prepare(
    "SELECT topic, SUM(CASE WHEN received >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 day') THEN 1 ELSE 0 END) AS week, COUNT(*) AS month FROM feedback_queue WHERE spam = 0 AND received >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 day') GROUP BY topic",
  )
    .all()
    .catch(() => ({ results: [] }));
  return json({ checks: checks.results, weeks: weeks.results, feedback: feedback.results, pages: CHECK_PAGES });
}

async function audit(env: Env) {
  const { results } = await env.DB.prepare("SELECT what, decision, note, by, at FROM decisions ORDER BY at DESC LIMIT 150").all();
  const backups = await env.MEDIA.list({ prefix: "backups/", limit: 100 }).catch(() => ({ objects: [] as { key: string; size: number; uploaded: Date }[] }));
  return json({
    log: results,
    backups: backups.objects.map((o) => ({ key: o.key, size: o.size, at: new Date(o.uploaded).toISOString() })).sort((a, z) => z.at.localeCompare(a.at)),
  });
}

/* ---------------- Badges (Nov 26) ---------------- */

/**
 * Signed badges for people (src/lib/issued-badges.ts on the site has the catalogue, the public key and the checks).
 * A token is base64url(JSON payload) + "." + base64url(ECDSA P-256 / SHA-256 signature, raw r||s) over the first
 * part's ASCII bytes. Payload: { v: 2, id, b: badge, n: name, i: issued ISO date, by: "owner" | "steward", h: { x, y } }.
 * `h` is the public half of a fresh "holder" key pair made for this badge; its private half goes ONLY into the link's
 * fragment (…/badge#<token>.<holder key>), so the person can prove in a study group that the badge is theirs. The link
 * is returned once; neither the token nor the holder key is stored or logged here: only who issued which badge to whom
 * (badges_issued, and a line in decisions). Revoking writes the id to the site's database (badge_revoked), read by
 * GET /api/badges/revoked.
 */
const BADGE_KINDS: Record<string, string> = { steward: "Steward", moderator: "Moderator", partner: "Partner", tester: "Tester" };

let badgesReady: Promise<unknown> | null = null;
const ensureBadges = (env: Env) =>
  (badgesReady ??= env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS badges_issued (id TEXT PRIMARY KEY, badge TEXT NOT NULL, name TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', by TEXT NOT NULL, at TEXT NOT NULL, revoked TEXT, revoked_by TEXT)",
  )
    .run()
    .catch((e) => ((badgesReady = null), Promise.reject(e))));
let revokedReady: Promise<unknown> | null = null;
const ensureRevoked = (env: Env) =>
  (revokedReady ??= env.SITE_DB.prepare("CREATE TABLE IF NOT EXISTS badge_revoked (id TEXT PRIMARY KEY, at TEXT NOT NULL)")
    .run()
    .catch((e) => ((revokedReady = null), Promise.reject(e))));

const b64urlBytes = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

let signKey: { src: string; key: Promise<CryptoKey> } | null = null;
async function badgeKey(env: Env) {
  const src = env.BADGE_SIGNING_KEY ?? "";
  if (!src) return null;
  if (signKey?.src !== src) {
    const jwk = JSON.parse(src) as JsonWebKey;
    if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d) throw new Error("BADGE_SIGNING_KEY is not a P-256 private key");
    const key = crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, d: jwk.d }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    key.catch(() => (signKey = null)); // (a bad key is tried again next time, not cached)
    signKey = { src, key };
  }
  return signKey.key;
}

async function issueBadge(env: Env, me: string, owner: boolean, b: Row) {
  const badge = String(b.badge ?? "");
  if (!Object.hasOwn(BADGE_KINDS, badge)) return bad("Pick a badge");
  // a display name: no control, invisible or direction-changing characters, at most 40 (whole characters, so an emoji
  // is never cut in half)
  const cleaned = clip(b.name, 200).replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g, "").trim();
  const name = Array.from(cleaned).slice(0, 40).join("").trim();
  if (!name) return bad("Type the name to put on the badge");
  const note = clip(b.note, 500);
  const key = await badgeKey(env).catch(() => null);
  if (!key) return bad("Badges aren't set up yet: the signing key (BADGE_SIGNING_KEY) is missing or wrong", 503);
  const id = uid();
  const t = now();
  // the badge's own holder key: public half signed into the token, private half only in the link
  const holder = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const hj = (await crypto.subtle.exportKey("jwk", holder.privateKey)) as JsonWebKey;
  const payload = { v: 2, id, b: badge, n: name, i: t, by: owner ? "owner" : "steward", h: { x: hj.x, y: hj.y } };
  const data = b64urlBytes(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(data)));
  const token = `${data}.${b64urlBytes(sig)}`;
  const holderKey = b64urlBytes(new TextEncoder().encode(JSON.stringify({ d: hj.d, x: hj.x, y: hj.y })));
  await ensureBadges(env);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO badges_issued (id, badge, name, note, by, at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, badge, name, note, me, t),
    logged(env, `badge:${id}`, "Issued", `${BADGE_KINDS[badge]} to ${name}${note ? ". " + note : ""}`, me, t),
  ]);
  return json({ id, link: `${env.SITE}/badge#${token}.${holderKey}` });
}

async function listBadges(env: Env) {
  await ensureBadges(env);
  const { results } = await env.DB.prepare("SELECT id, badge, name, note, by, at, revoked, revoked_by FROM badges_issued ORDER BY at DESC LIMIT 300").all();
  return json({ kinds: BADGE_KINDS, list: results, ready: !!env.BADGE_SIGNING_KEY });
}

async function revokeBadge(env: Env, me: string, id: string) {
  await ensureBadges(env);
  const row = await env.DB.prepare("SELECT badge, name, revoked FROM badges_issued WHERE id = ?").bind(id).first<{ badge: string; name: string; revoked: string | null }>();
  if (!row) return bad("Not found", 404);
  if (row.revoked) return bad("Already revoked", 409);
  const t = now();
  // the site's list first: if that fails, nothing here says it was revoked
  await ensureRevoked(env);
  await env.SITE_DB.prepare("INSERT OR IGNORE INTO badge_revoked (id, at) VALUES (?, ?)").bind(id, t).run();
  await env.DB.batch([
    env.DB.prepare("UPDATE badges_issued SET revoked = ?, revoked_by = ? WHERE id = ? AND revoked IS NULL").bind(t, me, id),
    logged(env, `badge:${id}`, "Revoked", `${BADGE_KINDS[row.badge] ?? row.badge} of ${row.name}`, me, t),
  ]);
  return json({ ok: true, revoked: t });
}

/** Weekly (Sundays): every table of the hub's database, plus the site's feedback queue and reading totals, as one
 * JSON file in the hub's private storage (backups/…). The newest 12 are kept. */
async function backup(env: Env) {
  const tables: Record<string, unknown[]> = {};
  await ensureUat(env); // (so the Test & chat tables are in the backup too)
  await ensureBadges(env);
  for (const t of ["reports", "comments", "media", "approvals", "decisions", "votes", "shipped", "health", "uat", "uat_results", "badges_issued"])
    tables[t] = (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results;
  for (const t of ["feedback_queue", "daily", "badge_revoked"])
    tables[`site.${t}`] = (await env.SITE_DB.prepare(`SELECT * FROM ${t}`).all().catch(() => ({ results: [] }))).results;
  const key = `backups/hub-${now().slice(0, 19).replace(/:/g, "-")}.json`;
  const body = JSON.stringify({ at: now(), tables });
  await env.MEDIA.put(key, body, { httpMetadata: { contentType: "application/json" } });
  const old = (await env.MEDIA.list({ prefix: "backups/", limit: 1000 })).objects.map((o) => o.key).sort().slice(0, -12);
  if (old.length) await env.MEDIA.delete(old);
  return { key, bytes: body.length, removed: old.length };
}
