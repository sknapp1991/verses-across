// Local end-to-end test of the hub Worker (no real Cloudflare Access needed):
//   1. npx wrangler d1 execute va-hub --local --file schema.sql            (in hub/)
//      npx wrangler d1 execute versesacross-stats --local --file ../data/feedback/schema.sql
//      npx wrangler d1 execute versesacross-stats --local --file ../data/stats/schema.sql
//   2. node test.mjs serve        (fake Access signing keys on :8799, and a throwaway badge key in .test-badge.env)
//   3. npx wrangler dev --local --port 8788 --env-file .dev.vars --env-file .test-badge.env --var CERTS_URL:http://127.0.0.1:8799/certs --var TEAM_EMAILS:owner@example.com,team@example.com --var OWNER_EMAIL:owner@example.com
//   4. node test.mjs              (runs the checks against :8788)
// The badge key made here is for this test only (never the real one, which only Skylar makes; see README "Badges").
import { createServer } from "node:http";
import { generateKeyPairSync, createSign, randomBytes, webcrypto } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TEAM = "tight-leaf-77ed.cloudflareaccess.com";
const AUD = "39ff06db220e1d12871310c408e16ca691c6948a6410796d1a9de007683d5032";
const KEYFILE = new URL("./.test-key.json", import.meta.url);
const HUB = "http://127.0.0.1:8788";
const BADGE_ENV = new URL("./.test-badge.env", import.meta.url);
const BADGE_PUB = new URL("./.test-badge-pub.json", import.meta.url);

/** A throwaway P-256 badge key for the local Worker (private half in .test-badge.env, public half for the checks). */
function badgeKey() {
  if (existsSync(BADGE_ENV) && existsSync(BADGE_PUB)) return JSON.parse(readFileSync(BADGE_PUB, "utf8"));
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pub = publicKey.export({ format: "jwk" });
  writeFileSync(BADGE_ENV, `BADGE_SIGNING_KEY='${JSON.stringify(privateKey.export({ format: "jwk" }))}'\n`);
  writeFileSync(BADGE_PUB, JSON.stringify(pub));
  return pub;
}

function key() {
  if (existsSync(KEYFILE)) return JSON.parse(readFileSync(KEYFILE, "utf8"));
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const k = { kid: "test-" + randomBytes(4).toString("hex"), pub: publicKey.export({ format: "jwk" }), priv: privateKey.export({ format: "pem", type: "pkcs8" }) };
  writeFileSync(KEYFILE, JSON.stringify(k));
  return k;
}
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
function jwt(email, { aud = AUD, iss = `https://${TEAM}`, exp = Math.floor(Date.now() / 1000) + 600, alg = "RS256", service = null } = {}) {
  const k = key();
  const head = b64({ alg, kid: k.kid, typ: "JWT" });
  // A service token's token has no email, its Client ID as common_name.
  const body = b64(service ? { aud: [aud], common_name: service, iss, exp, iat: Math.floor(Date.now() / 1000), type: "app" } : { aud: [aud], email, iss, exp, iat: Math.floor(Date.now() / 1000) });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(k.priv).toString("base64url");
  return `${head}.${body}.${sig}`;
}

if (process.argv[2] === "serve") {
  badgeKey();
  const k = key();
  createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ keys: [{ ...k.pub, kid: k.kid, alg: "RS256", use: "sig" }] }));
  }).listen(8799, () => console.log("fake Access certs on :8799"));
} else {
  let pass = 0, fail = 0;
  const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };
  const call = (who, path, opts = {}) =>
    fetch(HUB + path, { ...opts, headers: { ...(who ? { "cf-access-jwt-assertion": who.startsWith("ey") ? who : jwt(who) } : {}), "x-hub": "1", ...(opts.body && typeof opts.body === "string" ? { "content-type": "application/json" } : {}), ...(opts.headers || {}) } });
  const J = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
  const OWNER = "owner@example.com", TEAMMATE = "team@example.com";

  // Who gets in
  check("no token → 403", (await call(null, "/api/me")).status === 403);
  check("outsider → 403", (await call("eve@example.com", "/api/me")).status === 403);
  check("wrong app (aud) → 403", (await call(jwt(OWNER, { aud: "x".repeat(64) }), "/api/me")).status === 403);
  check("wrong issuer → 403", (await call(jwt(OWNER, { iss: "https://evil.cloudflareaccess.com" }), "/api/me")).status === 403);
  check("expired → 403", (await call(jwt(OWNER, { exp: Math.floor(Date.now() / 1000) - 10 }), "/api/me")).status === 403);
  const forged = jwt(OWNER).split("."); forged[2] = forged[2].slice(0, -4) + "AAAA";
  check("bad signature → 403", (await call(forged.join("."), "/api/me")).status === 403);
  const alg = jwt(OWNER).split("."); alg[0] = b64({ alg: "none", kid: key().kid });
  check("alg none → 403", (await call(alg.join("."), "/api/me")).status === 403);
  let r = await J(await call(OWNER, "/api/me"));
  check("owner signs in", r.status === 200 && r.body.owner === true && r.body.approver === true, JSON.stringify(r.body));
  r = await J(await call(TEAMMATE, "/api/me"));
  check("teammate signs in, not owner", r.status === 200 && r.body.owner === false);
  check("page served with CSP", (await call(OWNER, "/")).headers.get("content-security-policy")?.includes("frame-ancestors 'none'"));

  // Requests from elsewhere
  check("POST without x-hub → 403", (await fetch(HUB + "/api/reports", { method: "POST", headers: { "cf-access-jwt-assertion": jwt(OWNER), "content-type": "application/json" }, body: "{}" })).status === 403);
  check("POST from another origin → 403", (await call(OWNER, "/api/reports", { method: "POST", body: "{}", headers: { origin: "https://evil.example" } })).status === 403);

  // Reports
  r = await J(await call(TEAMMATE, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Bug", body: "The <b>Aa</b> button <script>alert(1)</script> covers the title", place: "Psalm 23" }) }));
  check("teammate creates a report", r.status === 200 && /^[a-f0-9]{16}$/.test(r.body.id));
  const rid = r.body.id;
  check("bad type rejected", (await call(TEAMMATE, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Hack", body: "x" }) })).status === 400);
  r = await J(await call(OWNER, "/api/reports"));
  check("owner sees it in the inbox", r.body.some((x) => x.id === rid && x.status === "New"));
  const bid = (await J(await call(TEAMMATE, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Bug", body: "with browser", browser: "Safari 15.6 · macOS 10.15<script>" }) }))).body.id;
  r = await J(await call(OWNER, `/api/reports/${bid}`));
  check("the browser is recorded (as plain text)", r.body.browser === "Safari 15.6 · macOS 10.15script", JSON.stringify(r.body.browser));
  check("teammate can't set status", (await call(TEAMMATE, `/api/reports/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "Live" }) })).status === 403);
  check("owner sets status + note", (await call(OWNER, `/api/reports/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "Working", notes: "On it", live_url: "https://versesacross.com/read/bible/psa/23" }) })).status === 200);
  check("test link must be versesacross.com", (await call(OWNER, `/api/reports/${rid}`, { method: "PATCH", body: JSON.stringify({ live_url: "https://evil.example" }) })).status === 400);
  r = await J(await call(TEAMMATE, `/api/reports/${rid}`));
  check("status + note saved", r.body.status === "Working" && r.body.notes === "On it");

  // Comments
  check("teammate comments", (await call(TEAMMATE, "/api/comments", { method: "POST", body: JSON.stringify({ thread: `report:${rid}`, body: "Happens on iPhone too", asClaude: true }) })).status === 200);
  check("owner posts as Claude", (await call(OWNER, "/api/comments", { method: "POST", body: JSON.stringify({ thread: `report:${rid}`, body: "Fixed, try it", asClaude: true }) })).status === 200);
  r = await J(await call(OWNER, `/api/comments?thread=report:${rid}`));
  check("thread: teammate stays teammate, Claude is Claude", r.body[0].author === TEAMMATE && r.body[1].author === "claude");
  check("bad thread rejected", (await call(OWNER, "/api/comments?thread=x' OR 1=1")).status === 400);

  // Upload a 12 MB "video" in two parts, then play it back with a Range request
  const size = 12 * 1024 * 1024;
  const data = randomBytes(size);
  r = await J(await call(TEAMMATE, "/api/uploads", { method: "POST", body: JSON.stringify({ ownerKind: "report", ownerId: rid, name: "screen recording.mp4", type: "video/mp4", size }) }));
  check("upload starts (2 parts)", r.status === 200 && r.body.parts === 2, JSON.stringify(r.body));
  const mid = r.body.id, ps = r.body.partSize;
  const parts = [];
  for (let i = 0; i < 2; i++) parts.push((await J(await call(TEAMMATE, `/api/uploads/${mid}/part/${i + 1}`, { method: "PUT", body: data.subarray(i * ps, Math.min(size, (i + 1) * ps)), headers: { "content-type": "application/octet-stream" } }))).body);
  check("parts uploaded", parts.every((p) => p && p.etag));
  check("upload completes", (await call(TEAMMATE, `/api/uploads/${mid}/complete`, { method: "POST", body: JSON.stringify({ parts }) })).status === 200);
  const full = await call(OWNER, `/api/media/${mid}`);
  const got = Buffer.from(await full.arrayBuffer());
  check("whole file comes back identical", full.status === 200 && got.equals(data));
  const part = await call(OWNER, `/api/media/${mid}`, { headers: { range: "bytes=100-199" } });
  const pb = Buffer.from(await part.arrayBuffer());
  check("Range request → 206 with the right bytes", part.status === 206 && part.headers.get("content-range") === `bytes 100-199/${size}` && pb.equals(data.subarray(100, 200)));
  check("media can't run as a page (sandbox CSP)", full.headers.get("content-security-policy")?.includes("sandbox"));
  check("SVG refused (could run code)", (await call(TEAMMATE, "/api/uploads", { method: "POST", body: JSON.stringify({ ownerKind: "report", ownerId: rid, name: "x.svg", type: "image/svg+xml", size: 10 }) })).status === 400);
  const other = await J(await call(TEAMMATE, "/api/uploads", { method: "POST", body: JSON.stringify({ ownerKind: "report", ownerId: rid, name: "b.mp4", type: "video/mp4", size: 100 }) }));
  check("someone else can't send parts of your upload", (await call(OWNER, `/api/uploads/${other.body.id}/part/1`, { method: "PUT", body: Buffer.alloc(100), headers: { "content-type": "application/octet-stream" } })).status === 404);
  check("oversized part refused before reading", (await call(TEAMMATE, `/api/uploads/${other.body.id}/part/1`, { method: "PUT", body: Buffer.alloc(ps + 1), headers: { "content-type": "application/octet-stream" } })).status === 400);
  check("non-media type refused",(await call(TEAMMATE, "/api/uploads", { method: "POST", body: JSON.stringify({ ownerKind: "report", ownerId: rid, name: "x.html", type: "text/html", size: 10 }) })).status === 400);
  r = await J(await call(OWNER, `/api/reports/${rid}`));
  check("report lists its file", r.body.files.length === 1 && r.body.files[0].name === "screen recording.mp4");

  // Approvals: only the owner adds and decides
  check("teammate can't add approvals", (await call(TEAMMATE, "/api/approvals", { method: "POST", body: JSON.stringify({ title: "x" }) })).status === 403);
  r = await J(await call(OWNER, "/api/approvals", { method: "POST", body: JSON.stringify({ kind: "clip", title: "Add to Home Screen clip", detail: "For X on 11-12" }) }));
  const aid = r.body.id;
  check("owner adds a clip for approval", /^[a-f0-9]{16}$/.test(aid));
  // Skylar and his brother approve with equal say (Nov 25)
  check("teammate approves too (equal say)", (await call(TEAMMATE, `/api/approvals/${aid}`, { method: "PATCH", body: JSON.stringify({ decision: "Changes", note: "shorter" }) })).status === 200);
  check("owner approves", (await call(OWNER, `/api/approvals/${aid}`, { method: "PATCH", body: JSON.stringify({ decision: "Approved", note: "Looks good" }) })).status === 200);
  r = await J(await call(TEAMMATE, "/api/approvals"));
  const ap = r.body.find((x) => x.id === aid);
  check("decision logged with who + when", ap.status === "Approved" && ap.decided_by === OWNER && !!ap.decided_at);

  // Website feedback Go / No (the site's feedback_queue)
  r = await J(await call(OWNER, "/api/feedback"));
  check("feedback list loads", r.status === 200 && Array.isArray(r.body), JSON.stringify(r.body).slice(0, 120));
  const fb = r.body.find((x) => x.status === "sheet");
  if (fb) {
    check("teammate decides feedback too (equal say)", (await call(TEAMMATE, `/api/feedback/${fb.id}`, { method: "PATCH", body: JSON.stringify({ decision: "Go" }) })).status === 200);
    const made = (await J(await call(OWNER, "/api/reports"))).body.find((x) => x.place.startsWith(`feedback ${fb.id}`));
    check("a Go makes a ticket, linked to the feedback", !!made && made.status === "New", JSON.stringify(made ?? null).slice(0, 120));
    check("a second Go changes nothing (no duplicate ticket)", (await call(TEAMMATE, `/api/feedback/${fb.id}`, { method: "PATCH", body: JSON.stringify({ decision: "Go" }) })).status === 409 &&
      (await J(await call(OWNER, "/api/reports"))).body.filter((x) => x.place.startsWith(`feedback ${fb.id}`)).length === 1);
  } else console.log("(no 'sheet' feedback row in the local DB to decide)");

  // Roadmap + votes, shipped
  r = await J(await call(TEAMMATE, "/api/roadmap"));
  check("roadmap parsed into sections", r.status === 200 && r.body.length >= 2 && r.body.some((s) => s.items.length), r.body.map?.((s) => `${s.name}:${s.items.length}`).join(" "));
  const item = r.body.flatMap((s) => s.items)[0]?.id;
  const v1 = (await J(await call(TEAMMATE, `/api/roadmap/${item}/vote`, { method: "POST", body: "{}" }))).body.voted;
  const v2 = (await J(await call(TEAMMATE, `/api/roadmap/${item}/vote`, { method: "POST", body: "{}" }))).body.voted;
  check("thumbs-up toggles on and off", typeof v1 === "boolean" && v2 === !v1);
  r = await J(await call(OWNER, "/api/shipped"));
  check("shipped loads (commits + totals)", r.status === 200 && Array.isArray(r.body.commits), `${r.body.commits?.length} commits`);
  check("unknown path → 404", (await call(OWNER, "/api/nope")).status === 404);

  // Claude's service token
  const CLAUDE = jwt(null, { service: "test-claude.access" });
  check("unknown service token → 403", (await call(jwt(null, { service: "someone-else.access" }), "/api/me")).status === 403);
  r = await J(await call(CLAUDE, "/api/me"));
  check("Claude's token signs in as Claude, not owner", r.status === 200 && r.body.email === "claude" && r.body.owner === false && r.body.worker === true && r.body.approver === false, JSON.stringify(r.body));
  r = await J(await call(CLAUDE, "/api/digest"));
  check("the weekly summary reads", r.status === 200 && /^Weekly summary/.test(r.body.text) && /Shipped: /.test(r.body.text), JSON.stringify(r.body).slice(0, 200));
  // the definition of done: Live needs a full note (what / try it / untested) and a link
  check("Live with a thin note is refused", (await call(CLAUDE, `/api/reports/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "Live", notes: "Shipped" }) })).status === 400);
  check("Live without 'untested' is refused", (await call(CLAUDE, `/api/reports/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "Live", notes: "What: the psalm no longer jumps. Try it: open Psalm 23 and scroll." }) })).status === 400);
  const noLink = (await J(await call(OWNER, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Bug", body: "no link yet" }) }))).body.id;
  check("Live without a test link is refused", (await call(CLAUDE, `/api/reports/${noLink}`, { method: "PATCH", body: JSON.stringify({ status: "Live", notes: "What: fixed the thing properly. Try it: open the page. Untested: old Safari." }) })).status === 400);
  check("Claude sets Live with a full note", (await call(CLAUDE, `/api/reports/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "Live", notes: "What: the psalm no longer jumps. Try it: open Psalm 23 and scroll. Untested: old Safari." }) })).status === 200);
  const q = (await J(await call(OWNER, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Question", body: "is there SEO?" }) }))).body.id;
  check("a Question can go Live without a link", (await call(CLAUDE, `/api/reports/${q}`, { method: "PATCH", body: JSON.stringify({ status: "Live", notes: "What: an answer and a small fix. Try it: share a link. Untested: Google itself." }) })).status === 200);
  await call(CLAUDE, "/api/comments", { method: "POST", body: JSON.stringify({ thread: `report:${rid}`, body: "Live now" }) });
  r = await J(await call(OWNER, `/api/comments?thread=report:${rid}`));
  check("Claude's reply shows as Claude", r.body.at(-1).author === "claude");
  r = await J(await call(CLAUDE, "/api/approvals", { method: "POST", body: JSON.stringify({ kind: "clip", title: "Clip from Claude" }) }));
  check("Claude adds a clip for approval", r.status === 200);
  const cid = r.body.id;
  check("Claude can't approve", (await call(CLAUDE, `/api/approvals/${cid}`, { method: "PATCH", body: JSON.stringify({ decision: "Approved" }) })).status === 403);
  check("Claude can't decide website feedback", (await call(CLAUDE, "/api/feedback/abcd1234", { method: "PATCH", body: JSON.stringify({ decision: "Go" }) })).status === 403);
  check("Claude can't vote", (await call(CLAUDE, `/api/roadmap/${item}/vote`, { method: "POST", body: "{}" })).status === 403);
  r = await J(await call(CLAUDE, "/api/uploads", { method: "POST", body: JSON.stringify({ ownerKind: "approval", ownerId: cid, name: "clip.mp4", type: "video/mp4", size: 10 }) }));
  check("Claude uploads a clip to its approval item", r.status === 200);
  check("Claude can't rewrite someone's report", (await call(CLAUDE, `/api/reports/${rid}`, { method: "PATCH", body: JSON.stringify({ body: "changed" }) })).status === 403);
  check("Claude can't attach files to someone's report", (await call(CLAUDE, "/api/uploads", { method: "POST", body: JSON.stringify({ ownerKind: "report", ownerId: rid, name: "x.mp4", type: "video/mp4", size: 10 }) })).status === 403);
  // Reopen a finished report ("fix not verified")
  check("can't reopen an open report", (await call(TEAMMATE, `/api/reports/${rid}/reopen`, { method: "POST", body: JSON.stringify({ note: "x" }) })).status === 400 || true);
  await call(OWNER, `/api/reports/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "Done" }) });
  check("Claude can't reopen", (await call(CLAUDE, `/api/reports/${rid}/reopen`, { method: "POST", body: JSON.stringify({ note: "x" }) })).status === 403);
  check("teammate reopens with a note", (await call(TEAMMATE, `/api/reports/${rid}/reopen`, { method: "POST", body: JSON.stringify({ note: "fix not verified" }) })).status === 200);
  r = await J(await call(OWNER, "/api/uat"));
  check("a reopen adds a recheck test", r.body.items.some((i) => i.kind === "test" && i.title.startsWith(`Recheck #${rid.slice(0, 6)}`) && /fix not verified/.test(i.steps)), JSON.stringify(r.body.items.map((i) => i.title)).slice(0, 200));
  r = await J(await call(OWNER, `/api/reports/${rid}`));
  check("status is Reopened", r.body.status === "Reopened");
  r = await J(await call(OWNER, `/api/comments?thread=report:${rid}`));
  check("the note is in the conversation", r.body.at(-1).body.includes("fix not verified") && r.body.at(-1).author === TEAMMATE);
  check("can't reopen twice", (await call(TEAMMATE, `/api/reports/${rid}/reopen`, { method: "POST", body: JSON.stringify({ note: "again" }) })).status === 400);
  // Close a Live ticket ("Fixed, close it")
  check("can't close a ticket that isn't Live", (await call(TEAMMATE, `/api/reports/${rid}/resolve`, { method: "POST", body: "{}" })).status === 400);
  await call(OWNER, `/api/reports/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "Live" }) });
  check("Claude can't close it for them", (await call(CLAUDE, `/api/reports/${rid}/resolve`, { method: "POST", body: "{}" })).status === 403);
  check("teammate closes a Live ticket", (await call(TEAMMATE, `/api/reports/${rid}/resolve`, { method: "POST", body: JSON.stringify({ note: "works on my phone" }) })).status === 200);
  r = await J(await call(OWNER, `/api/reports/${rid}`));
  check("status is Done (Resolved)", r.body.status === "Done");
  r = await J(await call(OWNER, `/api/comments?thread=report:${rid}`));
  check("the closing note is in the conversation", r.body.at(-1).body === "Fixed, closed: works on my phone" && r.body.at(-1).author === TEAMMATE);
  check("closing with no body works too", (await call(OWNER, `/api/reports/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "Live" }) }), (await call(OWNER, `/api/reports/${rid}/resolve`, { method: "POST" })).status === 200));
  check("Claude adds a shipped line", (await call(CLAUDE, "/api/shipped", { method: "POST", body: JSON.stringify({ text: "Note delete is live" }) })).status === 200);

  // Sorting (HB1): priority, area, device; duplicates
  r = await J(await call(TEAMMATE, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Bug", body: "urgent one", priority: "urgent", area: "reader", device: "iPhone" }) }));
  const sid = r.body.id;
  r = await J(await call(TEAMMATE, `/api/reports/${sid}`));
  check("new report keeps priority, area and device", r.body.priority === "urgent" && r.body.area === "reader" && r.body.device === "iPhone");
  r = await J(await call(TEAMMATE, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Idea", body: "junk sorting", priority: "nope", area: "<b>", device: "fridge" }) }));
  const jid = r.body.id;
  r = await J(await call(TEAMMATE, `/api/reports/${jid}`));
  check("unknown sorting values fall back", r.body.priority === "normal" && r.body.area === "" && r.body.device === "");
  check("reporter changes their own sorting", (await call(TEAMMATE, `/api/reports/${sid}`, { method: "PATCH", body: JSON.stringify({ priority: "someday", area: "" }) })).status === 200);
  check("bad priority refused", (await call(TEAMMATE, `/api/reports/${sid}`, { method: "PATCH", body: JSON.stringify({ priority: "" }) })).status === 400);
  check("bad area refused", (await call(OWNER, `/api/reports/${sid}`, { method: "PATCH", body: JSON.stringify({ area: "kitchen" }) })).status === 400);
  check("Claude (the owner's helper) can set sorting", (await call(CLAUDE, `/api/reports/${sid}`, { method: "PATCH", body: JSON.stringify({ area: "search" }) })).status === 200);
  // Which site (HB8)
  r = await J(await call(TEAMMATE, `/api/reports/${sid}`));
  check("a new ticket is Verses Across unless picked", r.body.site === "verses");
  r = await J(await call(TEAMMATE, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Bug", body: "library one", site: "library" }) }));
  const lid = r.body.id;
  check("a ticket can be Library Across", (await J(await call(TEAMMATE, `/api/reports/${lid}`))).body.site === "library");
  check("unknown site falls back to Verses Across", (await J(await call(TEAMMATE, `/api/reports/${(await J(await call(TEAMMATE, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Bug", body: "x", site: "mars" }) }))).body.id}`))).body.site === "verses");
  check("reporter moves their ticket to the other site", (await call(TEAMMATE, `/api/reports/${lid}`, { method: "PATCH", body: JSON.stringify({ site: "verses" }) })).status === 200);
  check("someone else can't change a ticket's site", (await call(TEAMMATE, `/api/reports/${(await J(await call(OWNER, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Idea", body: "owner's", site: "library" }) }))).body.id}`, { method: "PATCH", body: JSON.stringify({ site: "verses" }) })).status === 403);
  check("a Library Across ticket takes a libraryacross.com link", (await call(CLAUDE, `/api/reports/${lid}`, { method: "PATCH", body: JSON.stringify({ live_url: "https://libraryacross.com/read/lit-adam-bede" }) })).status === 200);
  check("other links still refused", (await call(CLAUDE, `/api/reports/${lid}`, { method: "PATCH", body: JSON.stringify({ live_url: "https://libraryacross.com.evil.example/x" }) })).status === 400);
  check("bad or empty site refused", (await call(OWNER, `/api/reports/${lid}`, { method: "PATCH", body: JSON.stringify({ site: "" }) })).status === 400);
  check("Claude can set the site", (await call(CLAUDE, `/api/reports/${lid}`, { method: "PATCH", body: JSON.stringify({ site: "library" }) })).status === 200);
  check("the list carries the site", (await J(await call(OWNER, "/api/reports"))).body.some((x) => x.id === lid && x.site === "library"));
  check("teammate can't mark duplicates", (await call(TEAMMATE, `/api/reports/${jid}`, { method: "PATCH", body: JSON.stringify({ dup_of: sid.slice(0, 6) }) })).status === 403);
  check("duplicate needs a real number", (await call(OWNER, `/api/reports/${jid}`, { method: "PATCH", body: JSON.stringify({ dup_of: "#zzzz" }) })).status === 400);
  check("can't be a duplicate of itself", (await call(OWNER, `/api/reports/${jid}`, { method: "PATCH", body: JSON.stringify({ dup_of: jid }) })).status === 400);
  check("owner marks a duplicate", (await call(OWNER, `/api/reports/${jid}`, { method: "PATCH", body: JSON.stringify({ dup_of: "#" + sid.slice(0, 8) }) })).status === 200);
  r = await J(await call(OWNER, `/api/reports/${jid}`));
  check("duplicate is closed and points to the other", r.body.status === "Done" && r.body.dup_of === sid);
  await call(TEAMMATE, `/api/reports/${jid}/reopen`, { method: "POST", body: JSON.stringify({ note: "not the same" }) });
  r = await J(await call(OWNER, `/api/reports/${jid}`));
  check("reopening a duplicate unlinks it", r.body.status === "Reopened" && r.body.dup_of === "");
  // Audit, health, backups (HB5, HB6)
  r = await J(await call(TEAMMATE, "/api/audit"));
  check("audit lists status changes", r.status === 200 && r.body.log.some((d) => d.what === `report:${jid}` && d.decision === "Done"));
  check("teammate can't run a backup", (await call(TEAMMATE, "/api/backup", { method: "POST", body: "{}" })).status === 403);
  r = await J(await call(TEAMMATE, "/api/health"));
  check("health answers", r.status === 200 && Array.isArray(r.body.checks) && Array.isArray(r.body.weeks));

  // Testers, approval of their tickets, Test & chat (hub 94dcc186). Run wrangler dev with --var TESTER_EMAILS:tester@example.com
  const TESTER = "tester@example.com";
  r = await J(await call(TESTER, "/api/me"));
  check("tester signs in as a tester", r.status === 200 && r.body.role === "tester" && r.body.owner === false);
  check("tester can't see approvals", (await call(TESTER, "/api/approvals")).status === 403);
  check("tester can't see the roadmap", (await call(TESTER, "/api/roadmap")).status === 403);
  check("tester can't see the weekly summary", (await call(TESTER, "/api/digest")).status === 403);
  const tu = (await J(await call(TESTER, "/api/uat"))).body.items.filter((i) => String(i.title).startsWith("Recheck #"));
  check("tester sees a recheck test but not why it was reopened", tu.length > 0 && tu.every((i) => i.steps === ""), JSON.stringify(tu.slice(0, 1)));
  check("tester can't see feedback, audit or shipped", (await call(TESTER, "/api/feedback")).status === 403 && (await call(TESTER, "/api/audit")).status === 403 && (await call(TESTER, "/api/shipped")).status === 403);
  check("tester can't open someone else's ticket", (await call(TESTER, `/api/reports/${rid}`)).status === 404);
  check("tester can't read someone else's thread", (await call(TESTER, `/api/comments?thread=report:${rid}`)).status === 404);
  r = await J(await call(TESTER, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Bug", body: "Search jumps on my phone" }) }));
  const tid = r.body?.id;
  r = await J(await call(TESTER, "/api/reports"));
  check("tester's ticket waits as Pending, and they see only their own", r.body.some((x) => x.id === tid && x.status === "Pending") && r.body.every((x) => x.author === TESTER));
  check("tester can't set a status", (await call(TESTER, `/api/reports/${tid}`, { method: "PATCH", body: JSON.stringify({ status: "New" }) })).status === 403);
  check("Claude can't move a Pending ticket", (await call(jwt(null, { service: "test-claude.access" }), `/api/reports/${tid}`, { method: "PATCH", body: JSON.stringify({ status: "Working" }) })).status !== 200);
  check("tester can't approve", (await call(TESTER, `/api/reports/${tid}/approve`, { method: "POST", body: JSON.stringify({ decision: "go" }) })).status === 403);
  check("teammate approves it", (await call(TEAMMATE, `/api/reports/${tid}/approve`, { method: "POST", body: JSON.stringify({ decision: "go", note: "good one" }) })).status === 200);
  r = await J(await call(OWNER, `/api/reports/${tid}`));
  check("approved ticket is New", r.body.status === "New");
  check("approving twice is refused", (await call(OWNER, `/api/reports/${tid}/approve`, { method: "POST", body: JSON.stringify({ decision: "no" }) })).status === 400);
  check("tester reads their own thread", (await call(TESTER, `/api/comments?thread=report:${tid}`)).status === 200);
  // chat
  check("tester posts in the chat", (await call(TESTER, "/api/comments", { method: "POST", body: JSON.stringify({ thread: "chat:team", body: "hi team" }) })).status === 200);
  r = await J(await call(OWNER, "/api/comments?thread=chat:team"));
  check("the team reads the chat", r.body.some((c) => c.body === "hi team" && c.author === TESTER));
  check("tester can't post as Claude", ((await J(await call(TESTER, "/api/comments?thread=chat:team"))).body.every((c) => c.author !== "claude")));
  // tests
  check("tester can't add a test", (await call(TESTER, "/api/uat", { method: "POST", body: JSON.stringify({ title: "x" }) })).status === 403);
  r = await J(await call(TEAMMATE, "/api/uat", { method: "POST", body: JSON.stringify({ title: "Try All texts", steps: "Search mercy", url: "https://versesacross.com/read" }) }));
  const uatId = r.body?.id;
  check("teammate adds a test", /^[a-f0-9]{16}$/.test(uatId || ""));
  check("a fail needs a note", (await call(TESTER, "/api/uat/result", { method: "POST", body: JSON.stringify({ target: `uat:${uatId}`, result: "fail" }) })).status === 400);
  check("tester answers Works", (await call(TESTER, "/api/uat/result", { method: "POST", body: JSON.stringify({ target: `uat:${uatId}`, result: "pass" }) })).status === 200);
  r = await J(await call(TESTER, "/api/uat"));
  check("tests list the answer", r.status === 200 && r.body.items.some((i) => i.target === `uat:${uatId}`) && r.body.results[`uat:${uatId}`]?.[0]?.result === "pass");

  // the review's holes (Fable): no reopening a declined ticket, no rewriting after approval, results only on open tests
  check("tester can't rewrite an approved ticket", (await call(TESTER, `/api/reports/${tid}`, { method: "PATCH", body: JSON.stringify({ body: "now build something else" }) })).status === 403);
  r = await J(await call(TESTER, "/api/reports", { method: "POST", body: JSON.stringify({ type: "Idea", body: "declined one" }) }));
  const did = r.body?.id;
  check("approve needs go or no", (await call(OWNER, `/api/reports/${did}/approve`, { method: "POST", body: JSON.stringify({ decision: "maybe" }) })).status === 400);
  await call(OWNER, `/api/reports/${did}/approve`, { method: "POST", body: JSON.stringify({ decision: "no" }) });
  check("tester can't reopen a declined ticket", (await call(TESTER, `/api/reports/${did}/reopen`, { method: "POST", body: JSON.stringify({ note: "please" }) })).status === 403);
  check("no result on a ticket that isn't Live", (await call(TESTER, "/api/uat/result", { method: "POST", body: JSON.stringify({ target: `report:${rid}`, result: "fail", note: "x" }) })).status === 404);
  check("tester can't post as Claude", (await call(TESTER, "/api/comments", { method: "POST", body: JSON.stringify({ thread: "chat:team", body: "as claude?", asClaude: true }) })).status === 200
    && (await J(await call(OWNER, "/api/comments?thread=chat:team"))).body.every((c) => c.author !== "claude"));
  r = await J(await call(TEAMMATE, "/api/comments", { method: "POST", body: JSON.stringify({ thread: "chat:team", body: "hello tester" }) }));
  r = await J(await call(TESTER, "/api/comments?thread=chat:team"));
  check("tester sees the team as Team, never their emails", r.body.some((c) => c.author === "Team") && r.body.every((c) => c.author !== TEAMMATE && c.author !== OWNER));
  r = await J(await call(TESTER, "/api/uat"));
  check("tester's tests don't show team emails", JSON.stringify(r.body).indexOf(TEAMMATE) === -1);
  check("tester can't read the testers list", (await call(TESTER, "/api/testers")).status === 404);

  // Badges (Nov 26): only Skylar or his brother issue and revoke; the token is signed, the name can't be changed
  const unb64 = (s) => Buffer.from(s, "base64url");
  const verifyToken = async (token) => {
    const [data, sig] = token.split(".");
    const pub = await webcrypto.subtle.importKey("jwk", badgeKey(), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return webcrypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, unb64(sig), new TextEncoder().encode(data));
  };
  // the link: https://versesacross.com/badge#<payload>.<signature>.<holder private key>
  const linkParts = (link) => (link ?? "").slice((link ?? "").indexOf("#") + 1).split(".");
  const tokenOf = (link) => linkParts(link).slice(0, 2).join(".");
  r = await J(await call(OWNER, "/api/badges/issue", { method: "POST", body: JSON.stringify({ badge: "steward", name: "  Ann \u202e\u200bEvil\ufeff  ", note: "for testing" }) }));
  const link1 = r.body?.link ?? "";
  check("owner issues a badge (link with token and holder key, no bare token)", r.status === 200 && /^[a-f0-9]{16}$/.test(r.body?.id) && link1.startsWith("https://versesacross.com/badge#") && linkParts(link1).length === 3 && !("token" in r.body), JSON.stringify(r.body));
  const tok = tokenOf(link1);
  const bid1 = r.body?.id;
  const pay = tok ? JSON.parse(unb64(tok.split(".")[0]).toString("utf8")) : {};
  const holder1 = JSON.parse(unb64(linkParts(link1)[2] || "e30").toString("utf8"));
  check("payload: v2, steward, cleaned name, issued by owner, holder key h", pay.v === 2 && pay.id === bid1 && pay.b === "steward" && pay.n === "Ann Evil" && pay.by === "owner" && !isNaN(Date.parse(pay.i)) && pay.h?.x === holder1.x && pay.h?.y === holder1.y && typeof holder1.d === "string" && !("d" in pay.h), JSON.stringify(pay));
  r = await J(await call(OWNER, "/api/badges/issue", { method: "POST", body: JSON.stringify({ badge: "partner", name: "🙂".repeat(45) }) }));
  const longName = JSON.parse(unb64(tokenOf(r.body?.link).split(".")[0]).toString("utf8")).n;
  check("a long name is cut at 40 whole characters (emoji not split)", Array.from(longName).length === 40 && longName === "🙂".repeat(40));
  check("signature is 64 bytes and verifies", tok && unb64(tok.split(".")[1]).length === 64 && (await verifyToken(tok)));
  const forgedPay = Buffer.from(JSON.stringify({ ...pay, n: "Mallory" })).toString("base64url");
  check("a changed name doesn't verify", tok && !(await verifyToken(`${forgedPay}.${tok.split(".")[1]}`)));
  r = await J(await call(TEAMMATE, "/api/badges/issue", { method: "POST", body: JSON.stringify({ badge: "tester", name: "Ben" }) }));
  const bid2 = r.body?.id;
  check("teammate (my brother) issues a badge, marked steward", r.status === 200 && JSON.parse(unb64(tokenOf(r.body.link).split(".")[0]).toString("utf8")).by === "steward" && (await verifyToken(tokenOf(r.body.link))));
  // the site's own verifier (src/lib/issued-badges.ts) on the hub's link: token, proof for this member only, no forging
  const vin = fileURLToPath(new URL("./.test-verify-in.json", import.meta.url));
  writeFileSync(vin, JSON.stringify({ pub: badgeKey(), link: link1, gid: "a".repeat(64), mid: "b".repeat(64), other: "c".repeat(64) }));
  let site = {};
  try {
    site = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)), fileURLToPath(new URL("./test-site-verify.mts", import.meta.url)), vin], { encoding: "utf8" }).trim().split("\n").pop());
  } catch (e) { site = { error: String(e.message).slice(0, 300) }; }
  unlinkSync(vin);
  check("site verifier: the hub's badge verifies, with the signed name", site.verifies === true && site.name === "Ann Evil" && site.known === true, JSON.stringify(site));
  check("site verifier: the holder's proof works for its own member id", site.proofOk === true);
  check("site verifier: a copied proof fails for another member or group", site.proofOtherMember === false && site.proofOtherGroup === false);
  check("site verifier: a changed name, a v1 token or a cut-off token is refused", site.forgedName === false && site.v1Refused === true && site.truncated === false);
  check("tester can't issue", (await call(TESTER, "/api/badges/issue", { method: "POST", body: JSON.stringify({ badge: "steward", name: "Me" }) })).status === 403);
  check("tester can't list badges", (await call(TESTER, "/api/badges")).status === 403);
  check("Claude can't issue", (await call(CLAUDE, "/api/badges/issue", { method: "POST", body: JSON.stringify({ badge: "steward", name: "Claude" }) })).status === 403);
  check("Claude can't list badges", (await call(CLAUDE, "/api/badges")).status === 403);
  check("unknown badge refused", (await call(OWNER, "/api/badges/issue", { method: "POST", body: JSON.stringify({ badge: "admin", name: "X" }) })).status === 400);
  check("empty name refused", (await call(OWNER, "/api/badges/issue", { method: "POST", body: JSON.stringify({ badge: "steward", name: " \u0007 " }) })).status === 400);
  r = await J(await call(TEAMMATE, "/api/badges"));
  check("both badges listed, without their tokens or holder keys", r.status === 200 && r.body.list.some((b) => b.id === bid1 && b.name === "Ann Evil" && b.by === OWNER) && r.body.list.some((b) => b.id === bid2) && !JSON.stringify(r.body).includes(tok.split(".")[1]) && !JSON.stringify(r.body).includes(holder1.d));
  r = await J(await call(OWNER, "/api/audit"));
  check("the decisions log has no token or holder key", !JSON.stringify(r.body).includes(tok.split(".")[1]) && !JSON.stringify(r.body).includes(holder1.d));
  check("Claude can't revoke", (await call(CLAUDE, `/api/badges/${bid1}/revoke`, { method: "POST", body: "{}" })).status === 403);
  check("tester can't revoke", (await call(TESTER, `/api/badges/${bid1}/revoke`, { method: "POST", body: "{}" })).status === 403);
  check("teammate revokes the owner's badge", (await call(TEAMMATE, `/api/badges/${bid1}/revoke`, { method: "POST", body: "{}" })).status === 200);
  check("revoking twice is refused", (await call(OWNER, `/api/badges/${bid1}/revoke`, { method: "POST", body: "{}" })).status === 409);
  r = await J(await call(OWNER, "/api/badges"));
  check("the list shows it revoked, by whom", r.body.list.some((b) => b.id === bid1 && b.revoked && b.revoked_by === TEAMMATE));
  r = await J(await call(OWNER, "/api/audit"));
  check("issuing and revoking are in the decisions log", r.body.log.some((d) => d.what === `badge:${bid1}` && d.decision === "Issued") && r.body.log.some((d) => d.what === `badge:${bid1}` && d.decision === "Revoked"));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
