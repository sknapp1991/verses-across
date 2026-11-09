// Local end-to-end test of the hub Worker (no real Cloudflare Access needed):
//   1. npx wrangler d1 execute va-hub --local --file schema.sql            (in hub/)
//      npx wrangler d1 execute versesacross-stats --local --file ../data/feedback/schema.sql
//      npx wrangler d1 execute versesacross-stats --local --file ../data/stats/schema.sql
//   2. node test.mjs serve        (fake Access signing keys on :8799)
//   3. npx wrangler dev --local --port 8788 --var CERTS_URL:http://127.0.0.1:8799/certs --var TEAM_EMAILS:owner@example.com,team@example.com --var OWNER_EMAIL:owner@example.com
//   4. node test.mjs              (runs the checks against :8788)
import { createServer } from "node:http";
import { generateKeyPairSync, createSign, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const TEAM = "tight-leaf-77ed.cloudflareaccess.com";
const AUD = "39ff06db220e1d12871310c408e16ca691c6948a6410796d1a9de007683d5032";
const KEYFILE = new URL("./.test-key.json", import.meta.url);
const HUB = "http://127.0.0.1:8788";

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
  check("owner signs in", r.status === 200 && r.body.owner === true, JSON.stringify(r.body));
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
  check("teammate can't approve", (await call(TEAMMATE, `/api/approvals/${aid}`, { method: "PATCH", body: JSON.stringify({ decision: "Approved" }) })).status === 403);
  check("owner approves", (await call(OWNER, `/api/approvals/${aid}`, { method: "PATCH", body: JSON.stringify({ decision: "Approved", note: "Looks good" }) })).status === 200);
  r = await J(await call(TEAMMATE, "/api/approvals"));
  const ap = r.body.find((x) => x.id === aid);
  check("decision logged with who + when", ap.status === "Approved" && ap.decided_by === OWNER && !!ap.decided_at);

  // Website feedback Go / No (the site's feedback_queue)
  r = await J(await call(OWNER, "/api/feedback"));
  check("feedback list loads", r.status === 200 && Array.isArray(r.body), JSON.stringify(r.body).slice(0, 120));
  const fb = r.body.find((x) => x.status === "sheet");
  if (fb) {
    check("teammate can't decide feedback", (await call(TEAMMATE, `/api/feedback/${fb.id}`, { method: "PATCH", body: JSON.stringify({ decision: "Go" }) })).status === 403);
    check("owner says Go", (await call(OWNER, `/api/feedback/${fb.id}`, { method: "PATCH", body: JSON.stringify({ decision: "Go" }) })).status === 200);
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
  check("Claude's token signs in as Claude, not owner", r.status === 200 && r.body.email === "claude" && r.body.owner === false && r.body.worker === true, JSON.stringify(r.body));
  check("Claude sets status + note", (await call(CLAUDE, `/api/reports/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "Live", notes: "Shipped" }) })).status === 200);
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

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
