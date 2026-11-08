/**
 * The hub's one page (served by src/index.ts): five tabs, phone first, dark by default.
 * Everything people type is put on the page with textContent (never innerHTML), so nothing typed can run.
 */
export const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#14110f">
<meta name="robots" content="noindex, nofollow">
<title>Verses Across team hub</title>
<style>
:root { --bg:#14110f; --panel:#1d1916; --raised:#26211d; --line:#3a332d; --ink:#f1ebe3; --muted:#b9ada0; --faint:#857a6f; --accent:#e9a23b; --accent-ink:#1d1305; --good:#4fb477; --warn:#e0b341; --bad:#e06c5a; --blue:#6ea8e0; --purple:#b48ae0; }
@media (prefers-color-scheme: light) { :root { --bg:#f7f3ee; --panel:#fffdf9; --raised:#f0ebe4; --line:#ddd3c7; --ink:#231d17; --muted:#5f554b; --faint:#8a7f74; --accent:#b8740f; --accent-ink:#fff; } }
* { box-sizing:border-box; }
html, body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { padding-bottom:calc(72px + env(safe-area-inset-bottom)); }
header { position:sticky; top:0; z-index:5; background:var(--bg); border-bottom:1px solid var(--line); padding:calc(10px + env(safe-area-inset-top)) 16px 10px; display:flex; align-items:center; gap:10px; }
header h1 { font:600 18px Georgia, serif; margin:0; flex:1; }
header .who { font-size:12px; color:var(--faint); }
main { max-width:720px; margin:0 auto; padding:12px 16px; }
nav.tabs { position:fixed; bottom:0; left:0; right:0; z-index:5; display:grid; grid-template-columns:repeat(5,1fr); background:var(--panel); border-top:1px solid var(--line); padding-bottom:env(safe-area-inset-bottom); }
nav.tabs button { background:none; border:0; color:var(--muted); font-size:11px; padding:8px 2px 10px; display:flex; flex-direction:column; align-items:center; gap:2px; min-height:56px; position:relative; }
nav.tabs button .i { font-size:20px; line-height:1; }
nav.tabs button[aria-current="page"] { color:var(--accent); font-weight:600; }
nav.tabs .badge { position:absolute; top:4px; right:calc(50% - 22px); background:var(--accent); color:var(--accent-ink); border-radius:9px; font-size:10px; padding:0 5px; font-weight:700; }
h2 { font:600 20px Georgia, serif; margin:8px 0 12px; }
h3 { font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:var(--faint); margin:22px 0 8px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:12px 14px; margin:0 0 10px; }
.card.tap { cursor:pointer; }
.row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.grow { flex:1; min-width:0; }
.muted { color:var(--muted); } .faint { color:var(--faint); font-size:13px; }
.pre { white-space:pre-wrap; overflow-wrap:anywhere; }
label { display:block; font-size:13px; color:var(--muted); margin:12px 0 4px; }
textarea, input[type=text], input[type=url], select { width:100%; background:var(--raised); color:var(--ink); border:1px solid var(--line); border-radius:10px; padding:10px 12px; font:inherit; font-size:16px; }
textarea { min-height:130px; resize:vertical; }
button.btn { background:var(--raised); color:var(--ink); border:1px solid var(--line); border-radius:10px; padding:10px 14px; font:inherit; font-size:15px; min-height:44px; cursor:pointer; }
button.btn.primary { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); font-weight:600; }
button.btn.small { min-height:34px; padding:5px 10px; font-size:13px; }
button:disabled { opacity:.5; }
.chips { display:flex; gap:6px; flex-wrap:wrap; }
.chip { border:1px solid var(--line); background:var(--raised); color:var(--muted); border-radius:999px; padding:7px 13px; font-size:14px; cursor:pointer; min-height:36px; }
.chip[aria-pressed="true"] { border-color:var(--accent); color:var(--accent); background:color-mix(in srgb, var(--accent) 14%, transparent); font-weight:600; }
.status { display:inline-block; border-radius:999px; padding:2px 9px; font-size:12px; font-weight:600; border:1px solid currentColor; }
.s-New { color:var(--muted); } .s-Seen { color:var(--blue); } .s-Working { color:var(--warn); } .s-Live { color:var(--good); } .s-Question { color:var(--bad); } .s-Roadmap { color:var(--purple); }
.s-Waiting { color:var(--warn); } .s-Approved, .s-go { color:var(--good); } .s-Changes, .s-no { color:var(--bad); } .s-sheet { color:var(--warn); }
.thumbs { display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:6px; margin-top:8px; }
.thumbs img, .thumbs video { width:100%; border-radius:8px; background:#000; max-height:60vh; object-fit:contain; }
.file { font-size:13px; color:var(--muted); }
.bar { height:6px; background:var(--raised); border-radius:3px; overflow:hidden; margin-top:6px; }
.bar > i { display:block; height:100%; width:0; background:var(--accent); transition:width .2s; }
.comment { border-top:1px solid var(--line); padding:8px 0; }
.comment .who { font-size:12px; color:var(--faint); }
.comment.claude .who { color:var(--accent); }
.toast { position:fixed; left:50%; bottom:calc(84px + env(safe-area-inset-bottom)); transform:translateX(-50%); background:var(--ink); color:var(--bg); padding:9px 16px; border-radius:999px; font-size:14px; z-index:9; }
.back { background:none; border:0; color:var(--accent); font:inherit; padding:6px 0; cursor:pointer; }
.num { font:600 26px Georgia, serif; }
.grid2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:8px; }
a { color:var(--accent); }
.hidden { display:none !important; }
</style>
</head>
<body>
<header><h1>Verses Across · Team</h1><span class="who" id="who"></span></header>
<main id="view"></main>
<nav class="tabs" aria-label="Sections">
  <button data-tab="report"><span class="i" aria-hidden="true">✚</span>Report</button>
  <button data-tab="inbox"><span class="i" aria-hidden="true">☰</span>Inbox</button>
  <button data-tab="approvals"><span class="i" aria-hidden="true">✓</span>Approvals<span class="badge hidden" id="apBadge"></span></button>
  <button data-tab="roadmap"><span class="i" aria-hidden="true">➜</span>Roadmap</button>
  <button data-tab="shipped"><span class="i" aria-hidden="true">★</span>Shipped</button>
</nav>
<script>
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const view = $("#view");
/** Put things in the main area (skipping the empty ones: null / false). */
const show = (...kids) => view.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
let ME = { email: "", owner: false, name: "" };

/* ---------- tiny DOM helper: h("div.card", {onclick}, "text", child) — text is always text ---------- */
function h(tag, props, ...kids) {
  const [name, ...cls] = tag.split(".");
  const el = document.createElement(name || "div");
  if (cls.length) el.className = cls.join(" ");
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}
const toast = (t) => { const el = h("div.toast", {}, t); document.body.append(el); setTimeout(() => el.remove(), 2400); };
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { "x-hub": "1", ...(opts.body && typeof opts.body === "string" ? { "content-type": "application/json" } : {}), ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j;
}
const post = (p, b, m = "POST") => api(p, { method: m, body: JSON.stringify(b) });
const when = (iso) => { const d = new Date(iso); const s = (Date.now() - d) / 1000; return s < 60 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : d.toLocaleDateString(); };
const who = (email) => email === "claude" ? "Claude" : email === ME.email ? "You" : (email || "").split("@")[0];
const status = (s) => h("span.status.s-" + s, {}, s === "sheet" ? "Waiting" : s === "go" ? "Go" : s === "no" ? "No" : s);

/* ---------- uploads: 10 MB parts straight into the hub's private storage, with progress ---------- */
async function uploadFiles(files, ownerKind, ownerId, onProgress) {
  const total = files.reduce((n, f) => n + f.size, 0) || 1;
  let sent = 0;
  for (const f of files) {
    const start = await post("/api/uploads", { ownerKind, ownerId, name: f.name, type: f.type || (/\.mov$/i.test(f.name) ? "video/quicktime" : "video/mp4"), size: f.size });
    const parts = [];
    for (let i = 0; i < start.parts; i++) {
      const blob = f.slice(i * start.partSize, Math.min(f.size, (i + 1) * start.partSize));
      let tries = 0;
      for (;;) {
        try {
          const p = await api("/api/uploads/" + start.id + "/part/" + (i + 1), { method: "PUT", body: blob, headers: { "content-type": "application/octet-stream" } });
          parts.push(p);
          break;
        } catch (e) { if (++tries >= 3) throw e; await new Promise((r) => setTimeout(r, 1500 * tries)); }
      }
      sent += blob.size;
      onProgress(sent / total);
    }
    await post("/api/uploads/" + start.id + "/complete", { parts });
  }
}
function filePicker() {
  const input = h("input", { type: "file", accept: "image/*,video/*", multiple: true, class: "hidden" });
  const list = h("div.file");
  input.addEventListener("change", () => { list.textContent = [...input.files].map((f) => f.name + " (" + Math.round(f.size / 1048576 * 10) / 10 + " MB)").join(", "); });
  const btn = h("button.btn", { type: "button", onclick: () => input.click() }, "📎 Add photos or a screen recording");
  return { el: h("div", {}, btn, input, list), files: () => [...input.files], clear: () => { input.value = ""; list.textContent = ""; } };
}
function mediaEl(f) {
  const src = "/api/media/" + f.id;
  if ((f.type || "").startsWith("video/")) return h("video", { src, controls: true, playsinline: true, preload: "metadata" });
  return h("a", { href: src, target: "_blank", rel: "noopener" }, h("img", { src, alt: f.name, loading: "lazy" }));
}

/* ---------- tabs ---------- */
const TABS = { report: showReport, inbox: showInbox, approvals: showApprovals, roadmap: showRoadmap, shipped: showShipped };
function go(tab, arg) {
  for (const b of document.querySelectorAll("nav.tabs button")) {
    if (b.dataset.tab === tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  const hash = "#" + tab + (arg ? "/" + arg : "");
  if (location.hash !== hash) { skipHash = true; location.hash = hash; } // a history entry, so the phone's Back goes back
  show(h("p.faint", {}, "Loading…"));
  window.scrollTo(0, 0);
  (Object.hasOwn(TABS, tab) ? TABS[tab] : showReport)(arg).catch((e) => show(h("p.muted", {}, e.message)));
}
document.querySelectorAll("nav.tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
// Back / Forward (and links to #inbox/<id>) open what the address says.
let skipHash = false;
window.addEventListener("hashchange", () => {
  if (skipHash) { skipHash = false; return; }
  const [tab, arg] = location.hash.slice(1).split("/");
  go(Object.hasOwn(TABS, tab) ? tab : "report", arg);
});

/* ---------- Report ---------- */
async function showReport() {
  let type = "Bug";
  const chips = h("div.chips", { role: "radiogroup", "aria-label": "Type" }, ["Bug", "Idea", "Content", "Question"].map((t) =>
    h("button.chip", { type: "button", role: "radio", "aria-pressed": t === type ? "true" : "false", onclick: (e) => { type = t; chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c === e.currentTarget ? "true" : "false")); } }, t)));
  const body = h("textarea", { placeholder: "What happened, or what's the idea? As much detail as you like." });
  const place = h("input", { type: "text", placeholder: "e.g. Psalm 23, the Library, versesacross.com/…" });
  const picker = filePicker();
  const bar = h("div.bar.hidden", {}, h("i"));
  const send = h("button.btn.primary", { type: "submit", style: "width:100%;margin-top:14px" }, "Send");
  const form = h("form", { onsubmit: async (e) => {
    e.preventDefault();
    if (!body.value.trim()) return toast("Write what it is first");
    send.disabled = true; send.textContent = "Sending…";
    try {
      const { id } = await post("/api/reports", { type, body: body.value, place: place.value });
      const files = picker.files();
      if (files.length) {
        bar.classList.remove("hidden");
        await uploadFiles(files, "report", id, (p) => { bar.firstChild.style.width = Math.round(p * 100) + "%"; send.textContent = "Uploading " + Math.round(p * 100) + "%"; });
      }
      toast("Sent. Claude will pick it up.");
      go("inbox", id);
    } catch (err) { toast(err.message); send.disabled = false; send.textContent = "Send"; }
  } },
    h("label", {}, "Type"), chips,
    h("label", {}, "What is it?"), body,
    h("label", {}, "Where? (optional)"), place,
    h("label", {}, "Photos or a screen recording (optional)"), picker.el, bar, send);
  show(h("h2", {}, "Report a bug or idea"), h("p.muted", {}, "Claude checks this about every hour, builds it, and you can follow it in the Inbox."), form);
}

/* ---------- Inbox ---------- */
async function showInbox(id) {
  if (id) return showOne(id);
  const list = await api("/api/reports");
  const items = list.map((r) => h("div.card.tap", { onclick: () => go("inbox", r.id) },
    h("div.row", {}, status(r.status), h("span.faint", {}, r.type + " · " + who(r.author) + " · " + when(r.created)),
      r.media ? h("span.faint", {}, "📎" + r.media) : null, r.comments ? h("span.faint", {}, "💬" + r.comments) : null),
    h("div.pre", { style: "margin-top:6px" }, r.body.length > 220 ? r.body.slice(0, 220) + "…" : r.body),
    r.notes ? h("div.faint.pre", { style: "margin-top:6px" }, "Claude: " + r.notes) : null));
  show(h("h2", {}, "Inbox"), items.length ? h("div", {}, items) : h("p.muted", {}, "Nothing yet. Reports you send show up here with their status."));
}

async function showOne(id) {
  const r = await api("/api/reports/" + id);
  const thread = h("div");
  async function loadThread() {
    const cs = await api("/api/comments?thread=report:" + id);
    thread.replaceChildren(...cs.map((c) => h("div.comment" + (c.author === "claude" ? ".claude" : ""), {}, h("div.who", {}, who(c.author) + " · " + when(c.created)), h("div.pre", {}, c.body))));
  }
  const reply = h("textarea", { placeholder: "Ask or answer here…", style: "min-height:80px" });
  const asClaude = ME.owner ? h("input", { type: "checkbox", id: "asc" }) : null;
  const send = h("button.btn.primary", { type: "button", onclick: async () => {
    if (!reply.value.trim()) return;
    send.disabled = true;
    try { await post("/api/comments", { thread: "report:" + id, body: reply.value, asClaude: !!(asClaude && asClaude.checked) }); reply.value = ""; await loadThread(); }
    catch (e) { toast(e.message); }
    send.disabled = false;
  } }, "Send");

  // Owner's session only: the status Claude sets (Claude works the inbox from this browser).
  let tools = null;
  if (ME.owner) {
    const sel = h("select", {}, ["New", "Seen", "Working", "Live", "Question", "Roadmap"].map((s) => h("option", { value: s, selected: s === r.status }, s)));
    const notes = h("textarea", { style: "min-height:70px" }); notes.value = r.notes || "";
    const link = h("input", { type: "url", placeholder: "https://versesacross.com/…" }); link.value = r.live_url || "";
    tools = h("details.card", {}, h("summary", { class: "faint" }, "Status and note (Claude)"),
      h("label", {}, "Status"), sel, h("label", {}, "Note"), notes, h("label", {}, "Test link"), link,
      h("button.btn", { type: "button", style: "margin-top:10px", onclick: async () => {
        try { await post("/api/reports/" + id, { status: sel.value, notes: notes.value, live_url: link.value }, "PATCH"); toast("Saved"); go("inbox", id); } catch (e) { toast(e.message); }
      } }, "Save"));
  }

  const picker = filePicker();
  const bar = h("div.bar.hidden", {}, h("i"));
  const addFiles = h("button.btn.small", { type: "button", onclick: async () => {
    const files = picker.files(); if (!files.length) return toast("Pick a file first");
    bar.classList.remove("hidden"); addFiles.disabled = true;
    try { await uploadFiles(files, "report", id, (p) => { bar.firstChild.style.width = Math.round(p * 100) + "%"; }); toast("Added"); go("inbox", id); }
    catch (e) { toast(e.message); addFiles.disabled = false; }
  } }, "Upload");

  show(
    h("button.back", { onclick: () => go("inbox") }, "← Inbox"),
    h("div.card", {},
      h("div.row", {}, status(r.status), h("span.faint", {}, r.type + " · " + who(r.author) + " · " + when(r.created))),
      r.place ? h("div.faint", { style: "margin-top:6px" }, "Where: " + r.place) : null,
      h("div.pre", { style: "margin-top:8px" }, r.body),
      r.files && r.files.length ? h("div.thumbs", {}, r.files.map(mediaEl)) : null,
      r.notes ? h("div.pre", { style: "margin-top:10px;border-top:1px solid var(--line);padding-top:8px" }, h("b", {}, "Claude: "), r.notes) : null,
      r.status === "Live" && r.live_url ? h("p", {}, h("a", { href: r.live_url, target: "_blank", rel: "noopener" }, "Try it on the site →")) : null),
    tools,
    h("h3", {}, "Conversation"), thread, reply,
    ME.owner ? h("label", { style: "display:flex;gap:6px;align-items:center" }, asClaude, "Post as Claude") : null,
    h("div.row", { style: "margin-top:8px" }, send),
    h("h3", {}, "Add more photos or video"), picker.el, bar, h("div", { style: "margin-top:8px" }, addFiles));
  await loadThread();
}

/* ---------- Approvals ---------- */
async function showApprovals() {
  const [aps, fb] = await Promise.all([api("/api/approvals"), api("/api/feedback").catch(() => [])]);
  const decide = (a) => {
    if (!ME.owner) return h("p.faint", {}, a.status === "Waiting" ? "Waiting for the owner." : "");
    const note = h("input", { type: "text", placeholder: "Note (what to change)…" });
    const btn = (label, cls) => h("button.btn.small" + cls, { type: "button", onclick: async () => {
      try { await post("/api/approvals/" + a.id, { decision: label, note: note.value }, "PATCH"); toast(label); go("approvals"); } catch (e) { toast(e.message); }
    } }, label === "Approved" ? "✓ Approve" : "Changes");
    return h("div", { style: "margin-top:8px" }, note, h("div.row", { style: "margin-top:6px" }, btn("Approved", ".primary"), btn("Changes", "")));
  };
  const apCards = aps.map((a) => h("div.card", {},
    h("div.row", {}, status(a.status), h("b.grow", {}, a.title)),
    a.detail ? h("div.pre.muted", { style: "margin-top:6px" }, a.detail) : null,
    a.files.length ? h("div.thumbs", { style: "grid-template-columns:1fr" }, a.files.map(mediaEl)) : null,
    a.status !== "Waiting" ? h("div.faint", { style: "margin-top:6px" }, a.status + (a.note ? ": " + a.note : "") + " · " + who(a.decided_by) + " · " + when(a.decided_at)) : decide(a)));
  const fbCards = fb.map((f) => {
    const card = h("div.card", {},
      h("div.row", {}, status(f.status), h("span.faint", {}, f.topic + " · " + (f.page || "no page") + " · " + when(f.received))),
      h("div.pre", { style: "margin-top:6px" }, f.message));
    if (ME.owner && f.status === "sheet") card.append(h("div.row", { style: "margin-top:8px" },
      ...["Go", "No"].map((d) => h("button.btn.small" + (d === "Go" ? ".primary" : ""), { type: "button", onclick: async () => {
        try { await post("/api/feedback/" + f.id, { decision: d }, "PATCH"); toast(d); go("approvals"); } catch (e) { toast(e.message); }
      } }, d))));
    return card;
  });
  let add = null;
  if (ME.owner) {
    const title = h("input", { type: "text", placeholder: "Title" });
    const detail = h("textarea", { placeholder: "What it is / where it will go", style: "min-height:70px" });
    const picker = filePicker();
    const bar = h("div.bar.hidden", {}, h("i"));
    const b = h("button.btn", { type: "button", style: "margin-top:8px", onclick: async () => {
      if (!title.value.trim()) return toast("Give it a title");
      b.disabled = true;
      try {
        const { id } = await post("/api/approvals", { kind: "clip", title: title.value, detail: detail.value });
        const files = picker.files();
        if (files.length) { bar.classList.remove("hidden"); await uploadFiles(files, "approval", id, (p) => { bar.firstChild.style.width = Math.round(p * 100) + "%"; }); }
        toast("Added"); go("approvals");
      } catch (e) { toast(e.message); b.disabled = false; }
    } }, "Add for approval");
    add = h("details.card", {}, h("summary", { class: "faint" }, "Add a clip for approval (Claude)"), h("label", {}, "Title"), title, h("label", {}, "Detail"), detail, h("label", {}, "Clip"), picker.el, bar, b);
  }
  show(h("h2", {}, "Approvals"),
    h("p.muted", {}, ME.owner ? "Only you can approve. Every decision is logged with who and when." : "Things waiting on the owner's OK."),
    h("h3", {}, "Clips and other things"), apCards.length ? h("div", {}, apCards) : h("p.faint", {}, "Nothing waiting."), add,
    h("h3", {}, "Website feedback (Go builds it; No closes it)"), fbCards.length ? h("div", {}, fbCards) : h("p.faint", {}, "No website feedback waiting."));
}

/* ---------- Roadmap ---------- */
async function showRoadmap(item) {
  if (item) return showRoadmapItem(item);
  const sections = await api("/api/roadmap");
  show(h("h2", {}, "Roadmap"), h("p.muted", {}, "From ROADMAP.md (Claude keeps it up to date). 👍 what you'd like next, or tap to comment."),
    ...sections.flatMap((s) => [h("h3", {}, s.name), ...s.items.map((it) => h("div.card", {},
      h("div.row", {}, h("span.faint", {}, it.id), h("b.grow", { class: "tap", onclick: () => go("roadmap", it.id) }, it.title),
        h("button.btn.small", { type: "button", "aria-pressed": it.mine ? "true" : "false", style: it.mine ? "border-color:var(--accent);color:var(--accent)" : "", onclick: async (e) => {
          try { await post("/api/roadmap/" + it.id + "/vote", {}); go("roadmap"); } catch (err) { toast(err.message); }
        } }, "👍 " + (it.votes || 0)),
        h("button.btn.small", { type: "button", onclick: () => go("roadmap", it.id) }, "💬 " + (it.comments || 0))),
      it.status ? h("div.faint", { style: "margin-top:4px" }, it.status) : null,
      h("div.muted", { style: "margin-top:4px;font-size:14px" }, it.notes.length > 260 ? it.notes.slice(0, 260) + "…" : it.notes)))]));
}
async function showRoadmapItem(id) {
  const sections = await api("/api/roadmap");
  const it = sections.flatMap((s) => s.items).find((x) => x.id === id);
  const thread = h("div");
  const load = async () => { const cs = await api("/api/comments?thread=roadmap:" + id); thread.replaceChildren(...cs.map((c) => h("div.comment" + (c.author === "claude" ? ".claude" : ""), {}, h("div.who", {}, who(c.author) + " · " + when(c.created)), h("div.pre", {}, c.body)))); };
  const reply = h("textarea", { placeholder: "Your thoughts on this…", style: "min-height:80px" });
  show(h("button.back", { onclick: () => go("roadmap") }, "← Roadmap"),
    h("div.card", {}, h("div.faint", {}, id + (it && it.status ? " · " + it.status : "")), h("b", {}, it ? it.title : id), it ? h("div.pre.muted", { style: "margin-top:6px" }, it.notes) : null),
    h("h3", {}, "Comments"), thread, reply,
    h("button.btn.primary", { type: "button", style: "margin-top:8px", onclick: async () => {
      if (!reply.value.trim()) return;
      try { await post("/api/comments", { thread: "roadmap:" + id, body: reply.value }); reply.value = ""; await load(); } catch (e) { toast(e.message); }
    } }, "Send"));
  await load();
}

/* ---------- Shipped ---------- */
async function showShipped() {
  const s = await api("/api/shipped");
  const label = { view: "Chapters read", play: "Read-alongs started", download: "Downloads" };
  show(h("h2", {}, "Shipped"),
    s.totals.length ? h("div.grid2", {}, s.totals.map((t) => h("div.card", {}, h("div.faint", {}, (Object.hasOwn(label, t.kind) ? label[t.kind] : t.kind)), h("div.num", {}, Number(t.week || 0).toLocaleString()), h("div.faint", {}, "this week · " + Number(t.month || 0).toLocaleString() + " in 30 days")))) : null,
    s.notes.length ? h("h3", {}, "In plain words") : null,
    ...s.notes.map((n) => h("div.card", {}, h("div.faint", {}, when(n.created)), h("div.pre", {}, n.text), n.url ? h("a", { href: n.url, target: "_blank", rel: "noopener" }, "See it →") : null)),
    h("h3", {}, "Latest changes to the site"),
    ...s.commits.map((c) => h("div.card", {}, h("div.faint", {}, when(c.date)), h("div", {}, c.text))));
}

/* ---------- start ---------- */
(async () => {
  try { ME = await api("/api/me"); } catch { show(h("p", {}, "Not signed in.")); return; }
  $("#who").textContent = ME.name;
  api("/api/approvals").then((a) => { const n = a.filter((x) => x.status === "Waiting").length; const b = $("#apBadge"); if (n) { b.textContent = n; b.classList.remove("hidden"); } }).catch(() => {});
  const [tab, arg] = location.hash.slice(1).split("/");
  go(Object.hasOwn(TABS, tab) ? tab : "report", arg);
})();
</script>
</body>
</html>`;
