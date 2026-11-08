#!/usr/bin/env node
// Claude's way into the team hub from Skylar's PC: the Cloudflare Access service token "Claude".
// The token lives only on this PC, in files Skylar made himself (never in the repo, never printed):
//   %USERPROFILE%\.va-hub\claude-id.txt      the Client ID
//   %USERPROFILE%\.va-hub\claude-secret.txt  the Client Secret
// What it can do is limited by the hub itself: statuses, notes, test links, replies as Claude, clips for
// approval, "what shipped" lines. It can't approve, decide website feedback, vote, or act as a person.
//
//   node hub/cli.mjs list [New|Seen|Working|Live|Question|Roadmap]
//   node hub/cli.mjs show <id>
//   node hub/cli.mjs status <id> <Status> [note…]
//   node hub/cli.mjs link <id> <https://versesacross.com/…>
//   node hub/cli.mjs say <id> <message…>            (a reply on the report, as Claude)
//   node hub/cli.mjs approval <title> <clip path> [detail…]
//   node hub/cli.mjs approvals | feedback
//   node hub/cli.mjs shipped <text> [url]
//   node hub/cli.mjs get <media id> <save to path>   (download a report's photo/video to look at)
import { readFileSync, statSync, openSync, readSync, closeSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const HUB = process.env.VA_HUB_URL || "https://hub.versesacross.com";
const dir = path.join(homedir(), ".va-hub");
let id, secret;
try {
  id = readFileSync(path.join(dir, "claude-id.txt"), "utf8").trim();
  secret = readFileSync(path.join(dir, "claude-secret.txt"), "utf8").trim();
} catch {
  console.error(`No Claude token on this PC (expected in ${dir}). Skylar sets it up once; see hub/README.md.`);
  process.exit(2);
}
if (!id || !secret) {
  console.error("The token files are empty.");
  process.exit(2);
}

async function api(p, opts = {}) {
  const r = await fetch(HUB + p, {
    ...opts,
    redirect: "manual", // an Access login redirect means the token wasn't accepted
    headers: { "cf-access-client-id": id, "cf-access-client-secret": secret, "x-hub": "1", ...(typeof opts.body === "string" ? { "content-type": "application/json" } : {}), ...(opts.headers || {}) },
  });
  if (r.status >= 300 && r.status < 400) throw new Error("The hub didn't accept Claude's token (is the Service Auth rule on the Access app?)");
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!r.ok) throw new Error(`${r.status}: ${body?.error ?? String(body).slice(0, 200)}`);
  return body;
}
const send = (p, b, method = "POST") => api(p, { method, body: JSON.stringify(b) });

async function upload(ownerKind, ownerId, file) {
  const size = statSync(file).size;
  const ext = path.extname(file).toLowerCase();
  const type = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".m4v": "video/x-m4v", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".heic": "image/heic" }[ext];
  if (!type) throw new Error(`Not a photo/video type the hub takes: ${ext}`);
  const start = await send("/api/uploads", { ownerKind, ownerId, name: path.basename(file), type, size });
  const fd = openSync(file, "r");
  const parts = [];
  try {
    for (let i = 0; i < start.parts; i++) {
      const len = Math.min(start.partSize, size - i * start.partSize);
      const buf = Buffer.alloc(len);
      readSync(fd, buf, 0, len, i * start.partSize);
      parts.push(await api(`/api/uploads/${start.id}/part/${i + 1}`, { method: "PUT", body: buf, headers: { "content-type": "application/octet-stream" } }));
      process.stdout.write(`\r  uploading ${Math.round(((i + 1) / start.parts) * 100)}%`);
    }
  } finally {
    closeSync(fd);
  }
  await send(`/api/uploads/${start.id}/complete`, { parts });
  console.log(`\r  uploaded ${path.basename(file)} (${(size / 1048576).toFixed(1)} MB)`);
  return start.id;
}

const [cmd, ...a] = process.argv.slice(2);
const line = (r) => `${r.id}  ${r.status.padEnd(8)} ${r.type.padEnd(8)} ${r.author === "claude" ? "Claude" : r.author.split("@")[0]}  ${r.created.slice(0, 16).replace("T", " ")}  ${r.body.replace(/\s+/g, " ").slice(0, 90)}${r.media ? `  [${r.media} file]` : ""}${r.comments ? `  [${r.comments} msg]` : ""}`;
try {
  if (cmd === "list") {
    const list = await api("/api/reports" + (a[0] ? `?status=${encodeURIComponent(a[0])}` : ""));
    console.log(list.length ? list.map(line).join("\n") : "(no reports)");
  } else if (cmd === "show") {
    const r = await api(`/api/reports/${a[0]}`);
    const cs = await api(`/api/comments?thread=report:${a[0]}`);
    console.log(`${r.type} · ${r.status} · by ${r.author.split("@")[0]} · ${r.created}\nWhere: ${r.place || "-"}\n\n${r.body}\n`);
    if (r.notes) console.log(`Claude's note: ${r.notes}`);
    if (r.live_url) console.log(`Test link: ${r.live_url}`);
    for (const f of r.files) console.log(`File: ${f.id}  ${f.name}  ${f.type}  ${(f.size / 1048576).toFixed(1)} MB`);
    for (const c of cs) console.log(`\n— ${c.author === "claude" ? "Claude" : c.author.split("@")[0]} (${c.created.slice(0, 16).replace("T", " ")}): ${c.body}`);
  } else if (cmd === "status") {
    await send(`/api/reports/${a[0]}`, { status: a[1], ...(a.length > 2 ? { notes: a.slice(2).join(" ") } : {}) }, "PATCH");
    console.log("ok");
  } else if (cmd === "link") {
    await send(`/api/reports/${a[0]}`, { live_url: a[1] }, "PATCH");
    console.log("ok");
  } else if (cmd === "say") {
    await send("/api/comments", { thread: `report:${a[0]}`, body: a.slice(1).join(" ") });
    console.log("ok");
  } else if (cmd === "approval") {
    const { id: aid } = await send("/api/approvals", { kind: "clip", title: a[0], detail: a.slice(2).join(" ") });
    await upload("approval", aid, a[1]);
    console.log(`approval ${aid} waiting for Skylar`);
  } else if (cmd === "approvals") {
    for (const x of await api("/api/approvals")) console.log(`${x.id}  ${x.status.padEnd(8)} ${x.title}${x.note ? `  (${x.note})` : ""}`);
  } else if (cmd === "feedback") {
    for (const f of await api("/api/feedback")) console.log(`${f.id}  ${f.status.padEnd(6)} ${f.topic}  ${f.page}  ${f.message.replace(/\s+/g, " ").slice(0, 100)}`);
  } else if (cmd === "shipped") {
    await send("/api/shipped", { text: a[0], url: a[1] ?? "" });
    console.log("ok");
  } else if (cmd === "get") {
    const r = await fetch(`${HUB}/api/media/${a[0]}`, { redirect: "manual", headers: { "cf-access-client-id": id, "cf-access-client-secret": secret } });
    if (!r.ok) throw new Error(`${r.status}`);
    writeFileSync(a[1], Buffer.from(await r.arrayBuffer()));
    console.log(`saved ${a[1]}`);
  } else if (cmd === "me") {
    console.log(await api("/api/me"));
  } else {
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//   ")).map((l) => l.slice(5)).join("\n"));
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
