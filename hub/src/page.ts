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
.tap { cursor:pointer; }
.linkish { background:none; border:0; padding:6px 2px; min-height:32px; color:var(--blue); font:inherit; font-size:13px; cursor:pointer; }
.card.was-open { outline:2px solid var(--blue); outline-offset:2px; }
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
.s-New { color:var(--muted); } .s-Seen { color:var(--blue); } .s-Working { color:var(--warn); } .s-Live { color:var(--good); } .s-Question { color:var(--bad); } .s-Roadmap { color:var(--purple); } .s-Done { color:var(--faint); } .s-Reopened { color:var(--bad); }
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
.tag { display:inline-block; border:1px solid var(--line); color:var(--muted); border-radius:6px; padding:1px 7px; font-size:12px; }
.fresh { color:var(--blue); font-size:12px; font-weight:600; }
.ticks { display:flex; gap:2px; align-items:flex-end; height:22px; margin:8px 0 4px; }
.ticks i { flex:1; min-width:2px; max-width:14px; height:100%; border-radius:2px; background:var(--good); }
.ticks i.down { background:var(--bad); }
.hbar { display:grid; grid-template-columns:76px 1fr 64px; gap:8px; align-items:center; font-size:13px; margin:4px 0; }
.hbar .track { height:10px; background:var(--raised); border-radius:4px; overflow:hidden; }
.hbar .track > i { display:block; height:100%; background:var(--accent); border-radius:0 4px 4px 0; }
.hbar .n { text-align:right; font-variant-numeric:tabular-nums; color:var(--muted); }
</style>
</head>
<body>
<header><h1>Verses Across · Team</h1><span class="who" id="who"></span></header>
<main id="view"></main>
<nav class="tabs" aria-label="Sections">
  <button data-tab="report"><span class="i" aria-hidden="true">✚</span>Report</button>
  <button data-tab="inbox"><span class="i" aria-hidden="true">☰</span>Tickets<span class="badge hidden" id="tkBadge"></span></button>
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
// Done shows as "Resolved"; Live means shipped and waiting for the reporter to check it.
const status = (s) => h("span.status.s-" + s, {}, s === "sheet" ? "Waiting" : s === "go" ? "Go" : s === "no" ? "No" : s === "Done" ? "Resolved" : s === "Live" ? "Live · check it" : s);

/* ---------- uploads: 10 MB parts straight into the hub's private storage, with progress ---------- */
async function uploadFiles(files, ownerKind, ownerId, onProgress) {
  const total = files.reduce((n, f) => n + f.size, 0) || 1;
  let sent = 0;
  for (const f of files) {
    const start = await post("/api/uploads", { ownerKind, ownerId, name: f.name, type: f.type || (/\\.mov$/i.test(f.name) ? "video/quicktime" : "video/mp4"), size: f.size });
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
  // Files add up (pick one, then another…), each with a preview (only on this device until sent) and a remove button.
  const previews = h("div.thumbs");
  let chosen = [];
  let urls = [];
  const draw = () => {
    for (const u of urls) URL.revokeObjectURL(u);
    urls = [];
    list.textContent = chosen.length ? chosen.length + (chosen.length === 1 ? " file, " : " files, ") + Math.round(chosen.reduce((n, f) => n + f.size, 0) / 1048576 * 10) / 10 + " MB" : "";
    previews.replaceChildren(...chosen.map((f, i) => {
      const url = URL.createObjectURL(f);
      urls.push(url);
      const name = h("div.faint", { style: "font-size:11px;overflow-wrap:anywhere" }, f.name + " (" + Math.round(f.size / 1048576 * 10) / 10 + " MB)");
      // (a photo the browser can't show, like some HEIC files, shows just its name)
      const media = (f.type || "").startsWith("video/") || /[.](mov|mp4|m4v|webm)$/i.test(f.name)
        ? h("video", { src: url, muted: true, playsinline: true, preload: "metadata", controls: true })
        : h("img", { src: url, alt: f.name, onerror: (e) => e.currentTarget.remove() });
      const remove = h("button.btn.small", { type: "button", "aria-label": "Remove " + f.name, style: "width:100%;margin-top:4px", onclick: () => { chosen.splice(i, 1); draw(); } }, "✕ Remove");
      return h("div", {}, media, name, remove);
    }));
    btn.textContent = chosen.length ? "📎 Add another photo or video" : "📎 Add photos or a screen recording";
  };
  input.addEventListener("change", () => {
    // the same file picked twice counts once
    for (const f of input.files) if (!chosen.some((c) => c.name === f.name && c.size === f.size && c.lastModified === f.lastModified)) chosen.push(f);
    input.value = ""; // so the next pick (even the same file again after removing it) is seen
    draw();
  });
  const btn = h("button.btn", { type: "button", onclick: () => input.click() }, "📎 Add photos or a screen recording");
  return { el: h("div", {}, btn, input, previews, list), files: () => [...chosen], clear: () => { chosen = []; draw(); } };
}
function mediaEl(f) {
  const src = "/api/media/" + f.id;
  if ((f.type || "").startsWith("video/")) return h("video", { src, controls: true, playsinline: true, preload: "metadata" });
  return h("a", { href: src, target: "_blank", rel: "noopener" }, h("img", { src, alt: f.name, loading: "lazy" }));
}

/* ---------- tabs ---------- */
const TABS = { report: showReport, inbox: showInbox, approvals: showApprovals, roadmap: showRoadmap, shipped: showShipped };
// Back from a ticket to Tickets: return to that ticket (or where the list was), not to the top.
let here = { tab: "", arg: "" };
let listY = 0;
let closedOpen = false;
let backTo = null;
function go(tab, arg) {
  if (here.tab === "inbox" && !here.arg) {
    listY = window.scrollY;
    closedOpen = !!document.querySelector("details.closed-cases[open]");
  }
  backTo = tab === "inbox" && !arg && here.tab === "inbox" && here.arg ? here.arg : null;
  here = { tab, arg: arg || "" };
  for (const b of document.querySelectorAll("nav.tabs button")) {
    if (b.dataset.tab === tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  const hash = "#" + tab + (arg ? "/" + arg : "");
  if (location.hash !== hash) { skipHash = true; location.hash = hash; } // a history entry, so the phone's Back goes back
  caseOpen = tab === "inbox" && !!arg;
  if (!(backTo && lastList)) {
    show(h("p.faint", {}, "Loading…"));
    window.scrollTo(0, 0);
  }
  (Object.hasOwn(TABS, tab) ? TABS[tab] : showReport)(arg).catch((e) => show(h("p.muted", {}, e.message)));
}
document.querySelectorAll("nav.tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
// Phone: on an open ticket, a sideways swipe (left or right) goes back to Tickets. Not while typing, choosing
// text, or swiping a video's controls; a mostly sideways move of 90px or more only, so scrolling isn't caught.
let caseOpen = false;
let swipe = null;
document.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  const el = e.target;
  swipe = caseOpen && e.touches.length === 1 && !(el.closest && el.closest("textarea, input, select, video, .thumbs")) ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!swipe || !caseOpen) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
  const quick = Date.now() - swipe.at < 800;
  swipe = null;
  if (quick && Math.abs(dx) >= 90 && Math.abs(dy) < Math.abs(dx) * 0.5 && !String(window.getSelection() || "")) go("inbox");
}, { passive: true });
// Back / Forward (and links to #inbox/<id>) open what the address says.
let skipHash = false;
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.addEventListener("hashchange", () => {
  if (skipHash) { skipHash = false; return; }
  const [tab, arg] = location.hash.slice(1).split("/");
  go(Object.hasOwn(TABS, tab) ? tab : "report", arg);
});

/* ---------- sorting: priority, area, device ---------- */
const PRIOS = [["urgent", "Urgent"], ["normal", "Normal"], ["someday", "Someday"]];
const AREA_LIST = [["reader", "Reader"], ["library", "Library"], ["search", "Search"], ["audio", "Audio"], ["study", "Study"], ["phone", "Phone layout"], ["hub", "This hub"], ["other", "Other"]];
const DEVICE_LIST = [["iPhone", "iPhone"], ["Android", "Android"], ["computer", "Computer"]];
const labelOf = (list, v) => (list.find((x) => x[0] === v) || [v, v])[1];
function guessDevice() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : "computer";
}
/** A row of chips to pick one (or, when optional, none by tapping it again). */
function chipChoice(title, list, start, optional) {
  let value = start;
  const chips = h("div.chips", { role: "radiogroup", "aria-label": title }, list.map(([v, label]) =>
    h("button.chip", { type: "button", role: "radio", "data-v": v, "aria-pressed": v === value ? "true" : "false", onclick: () => {
      value = optional && value === v ? "" : v;
      chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.v === value ? "true" : "false"));
    } }, label)));
  return { el: h("div", {}, h("label", {}, title), chips), value: () => value };
}
/** A ticket's short number, as people say it: #3fa2c1 */
const num = (id) => "#" + id.slice(0, 6);
const DAY = 86400000;
/** Open tickets nobody has touched for 3 days get an age badge. */
const waitingDays = (r) => (["Done", "Roadmap", "Live"].includes(r.status) ? 0 : Math.floor((Date.now() - new Date(r.updated || r.created)) / DAY));
/* What changed since you last looked: when each ticket was last opened here (this browser), and when the list was first used. */
const SEEN_KEY = "hub-seen:v1";
let seen = {};
try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch {}
if (!seen._since) seen._since = new Date().toISOString();
const saveSeen = () => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch {} };
saveSeen();
const isFresh = (r) => (r.updated || r.created) > (seen[r.id] || seen._since);
/** Opened (or changed by you) at the server's time, never this device's clock (which may be off). */
function markSeen(id, at) { if (at && at > (seen[id] || "")) seen[id] = at; saveSeen(); }
function updateTicketsBadge(list) {
  const n = list.filter((r) => isFresh(r) && !["Done", "Roadmap"].includes(r.status)).length;
  const b = $("#tkBadge");
  b.textContent = n;
  b.classList.toggle("hidden", !n);
}

/* ---------- Report ---------- */
async function showReport() {
  let type = "Bug";
  const chips = h("div.chips", { role: "radiogroup", "aria-label": "Type" }, ["Bug", "Idea", "Content", "Question"].map((t) =>
    h("button.chip", { type: "button", role: "radio", "aria-pressed": t === type ? "true" : "false", onclick: (e) => { type = t; chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c === e.currentTarget ? "true" : "false")); } }, t)));
  const body = h("textarea", { placeholder: "What happened, or what's the idea? As much detail as you like." });
  const place = h("input", { type: "text", placeholder: "e.g. Psalm 23, the Library, versesacross.com/…" });
  // Sorting: how soon, which part, which device (guessed from this phone or computer; tap to change)
  const prio = chipChoice("How soon?", PRIOS, "normal");
  const area = chipChoice("Which part of the site? (optional)", AREA_LIST, "", true);
  const device = chipChoice("On which device?", DEVICE_LIST, guessDevice(), true);
  const picker = filePicker();
  const bar = h("div.bar.hidden", {}, h("i"));
  const send = h("button.btn.primary", { type: "submit", style: "width:100%;margin-top:14px" }, "Send");
  const form = h("form", { onsubmit: async (e) => {
    e.preventDefault();
    if (!body.value.trim()) return toast("Write what it is first");
    send.disabled = true; send.textContent = "Sending…";
    try {
      const { id } = await post("/api/reports", { type, body: body.value, place: place.value, priority: prio.value(), area: area.value(), device: device.value() });
      const files = picker.files();
      if (files.length) {
        bar.classList.remove("hidden");
        await uploadFiles(files, "report", id, (p) => { bar.firstChild.style.width = Math.round(p * 100) + "%"; send.textContent = "Uploading " + Math.round(p * 100) + "%"; });
      }
      toast("Sent. Claude will pick it up.");
      picker.clear(); // (lets go of the previews)
      go("inbox", id);
    } catch (err) { toast(err.message); send.disabled = false; send.textContent = "Send"; }
  } },
    h("label", {}, "Type"), chips,
    h("label", {}, "What is it?"), body,
    h("label", {}, "Where? (optional)"), place,
    prio.el, area.el, device.el,
    h("label", {}, "Photos or a screen recording (optional)"), picker.el, bar, send);
  show(h("h2", {}, "Report a bug or idea"), h("p.muted", {}, "Claude checks this about every hour, builds it, and you can follow it in Tickets."), form);
}

/* ---------- Tickets (the "inbox" tab; Cases Closed below the open ones) ---------- */
async function showInbox(id) {
  if (id) return showOne(id);
  // Coming back from a ticket: draw the list at once from what was loaded (no "Loading…" in between, so the
  // phone has nothing to jump to the top for), put that ticket in view, then refresh it quietly.
  const target = backTo;
  backTo = null;
  if (target && lastList) {
    renderTickets(lastList, target);
    placeTicket(target);
    const fresh = await api("/api/reports").catch(() => null);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(lastList) && here.tab === "inbox" && !here.arg) {
      const y = window.scrollY;
      renderTickets(fresh, target);
      window.scrollTo(0, y);
    }
    return;
  }
  renderTickets(await api("/api/reports"), target);
  if (target) placeTicket(target);
}
let lastList = null;
/** The filters above Tickets (kept while you open tickets and come back). */
const filt = { q: "", mine: false, prio: "", area: "", type: "" };
let closedSort = "date";
function renderTickets(list, target) {
  lastList = list;
  updateTicketsBadge(list);
  const tag = (t, style) => h("span.tag", { style: style || "" }, t);
  const card = (r) => {
    const age = waitingDays(r);
    return h("div.card.tap", { "data-id": r.id, onclick: () => go("inbox", r.id) },
      h("div.row", {}, status(r.status),
        r.priority === "urgent" ? tag("Urgent", "color:var(--bad);border-color:var(--bad)") : r.priority === "someday" ? tag("Someday") : null,
        h("span.faint", {}, num(r.id) + " · " + r.type + " · " + who(r.author) + " · " + when(r.created)),
        r.media ? h("span.faint", {}, "📎" + r.media) : null, r.comments ? h("span.faint", {}, "💬" + r.comments) : null,
        isFresh(r) ? h("span.fresh", { title: "Changed since you last opened it" }, "● New activity") : null),
      h("div.pre", { style: "margin-top:6px" }, r.body.length > 220 ? r.body.slice(0, 220) + "…" : r.body),
      r.area || r.device || age >= 3 ? h("div.row", { style: "margin-top:6px" },
        r.area ? tag(labelOf(AREA_LIST, r.area)) : null, r.device ? tag(labelOf(DEVICE_LIST, r.device)) : null,
        age >= 3 ? tag("Waiting " + age + " days", "color:var(--warn);border-color:var(--warn)") : null) : null,
      r.dup_of ? h("div.faint", { style: "margin-top:6px" }, "Same as " + num(r.dup_of)) : null,
      r.notes ? h("div.faint.pre", { style: "margin-top:6px" }, "Claude" + (r.updated ? " · " + when(r.updated) : "") + ": " + r.notes) : null);
  };
  // Filters: words, mine, urgent, part of the site, type
  const active = () => !!(filt.q.trim() || filt.mine || filt.prio || filt.area || filt.type);
  const DONE = new Set(["Done", "Roadmap"]);
  const rank = { urgent: 0, normal: 1, someday: 2 };
  const sorts = {
    date: (a, z) => (z.updated || "").localeCompare(a.updated || ""),
    type: (a, z) => a.type.localeCompare(z.type) || (z.updated || "").localeCompare(a.updated || ""),
    sender: (a, z) => who(a.author).localeCompare(who(z.author)) || (z.updated || "").localeCompare(a.updated || ""),
  };
  const sortSel = h("select", { "aria-label": "Sort Cases Closed", style: "width:auto;min-height:34px;padding:4px 10px;font-size:13px" },
    [["date", "Newest closed first"], ["type", "By type"], ["sender", "By who sent it"]].map(([v, l]) => h("option", { value: v, selected: closedSort === v }, l)));
  /** The two lists (open, then Cases Closed) for the current filters. */
  const lists = () => {
    const words = filt.q.toLowerCase().split(/ +/).filter(Boolean);
    const keep = (r) =>
      (!filt.mine || r.author === ME.email) && (!filt.prio || r.priority === filt.prio) && (!filt.area || r.area === filt.area) && (!filt.type || r.type === filt.type) &&
      words.every((w) => (r.body + " " + r.place + " " + r.notes + " " + num(r.id) + " " + who(r.author)).toLowerCase().includes(w));
    const shown = list.filter(keep);
    // Open tickets on top (urgent first, then newest); finished ones (closed, or put on the roadmap) in Cases Closed.
    // Live stays in Tickets until the reporter closes it ("Fixed, close it") or confirms it works.
    const open = shown.filter((r) => !DONE.has(r.status)).sort((a, z) => (rank[a.priority] ?? 1) - (rank[z.priority] ?? 1) || z.created.localeCompare(a.created));
    const past = shown.filter((r) => DONE.has(r.status)).sort(sorts[closedSort] || sorts.date);
    const wasOpen = closedOpen || !!document.querySelector("details.closed-cases[open]");
    return [
      open.length ? h("div", {}, open.map(card)) : h("p.muted", {}, active() ? "No open ticket matches." : list.length ? "Nothing open. Everything is in Cases Closed below." : "Nothing yet. Reports you send show up here with their status."),
      past.length ? h("details.card.closed-cases", { style: "padding:0;border:0;background:none", open: wasOpen || past.some((r) => r.id === target) },
        h("summary", { class: "faint", style: "padding:10px 0;cursor:pointer" }, "Cases Closed: " + past.length + " (resolved or on the roadmap)"),
        h("div", { style: "margin:0 0 10px" }, sortSel),
        h("div", {}, past.map(card))) : null,
    ];
  };
  const box = h("div", {}, lists());
  const redraw = () => {
    const y = window.scrollY;
    closedOpen = closedOpen || !!document.querySelector("details.closed-cases[open]");
    renderTickets(lastList, null);
    window.scrollTo(0, y);
  };
  const clear = h("button.linkish" + (active() ? "" : ".hidden"), { type: "button", onclick: () => { Object.assign(filt, { q: "", mine: false, prio: "", area: "", type: "" }); redraw(); } }, "Clear filters");
  // Typing redraws only the lists below, never the search box itself (so a phone keeps its keyboard).
  const search = h("input", { type: "text", placeholder: "Search tickets (words, #number, name)", "aria-label": "Search tickets", value: filt.q });
  let timer = 0;
  search.addEventListener("input", () => {
    filt.q = search.value;
    clearTimeout(timer);
    timer = setTimeout(() => { box.replaceChildren(...lists().filter(Boolean)); clear.classList.toggle("hidden", !active()); }, 250);
  });
  const toggle = (label, on, flip) => h("button.chip", { type: "button", "aria-pressed": on ? "true" : "false", onclick: () => { flip(); redraw(); } }, label);
  const pick = (label, list2, key) => {
    const sel = h("select", { "aria-label": label, style: "width:auto;min-height:36px;padding:6px 10px;font-size:14px;border-radius:999px" },
      h("option", { value: "" }, label), list2.map(([v, l]) => h("option", { value: v, selected: filt[key] === v }, l)));
    sel.addEventListener("change", () => { filt[key] = sel.value; redraw(); });
    return sel;
  };
  const bar = h("div", { style: "margin-bottom:12px" }, search,
    h("div.chips", { style: "margin-top:8px" },
      toggle("Mine", filt.mine, () => (filt.mine = !filt.mine)),
      toggle("Urgent", filt.prio === "urgent", () => (filt.prio = filt.prio === "urgent" ? "" : "urgent")),
      pick("Any part", AREA_LIST, "area"),
      pick("Any type", [["Bug", "Bug"], ["Idea", "Idea"], ["Content", "Content"], ["Question", "Question"]], "type"),
      clear));
  sortSel.addEventListener("change", () => { closedSort = sortSel.value; closedOpen = true; redraw(); });
  show(h("h2", {}, "Tickets"), list.length ? bar : null, box);
}
/** The ticket just closed, in view and outlined for a moment (again a moment later, in case the browser moved the page). */
function placeTicket(id) {
  const put = () => {
    const el = document.querySelector('[data-id="' + id + '"]');
    if (el) el.scrollIntoView({ block: "center" });
    else window.scrollTo(0, listY);
    return el;
  };
  const el = put();
  if (el) {
    el.classList.add("was-open");
    setTimeout(() => el.classList.remove("was-open"), 1500);
  }
  requestAnimationFrame(put);
  setTimeout(() => { if (here.tab === "inbox" && !here.arg) put(); }, 150);
}

/** A ticket's text, with Edit for the person who sent it (or the owner): change it after sending. */
function bodyBox(r, id) {
  const text = h("div.pre", { style: "margin-top:8px" }, r.body);
  const mine = ME.email !== "claude" && (r.author === ME.email || ME.owner);
  if (!mine) return text;
  const box = h("div", {}, text);
  const edit = h("button.linkish", { type: "button", onclick: () => {
    const area = h("textarea", {});
    area.value = r.body;
    const save = h("button.btn.primary.small", { type: "button", onclick: async () => {
      if (!area.value.trim()) return toast("Write what it is");
      save.disabled = true;
      try { await post("/api/reports/" + id, { body: area.value }, "PATCH"); toast("Saved"); go("inbox", id); }
      catch (e) { toast(e.message); save.disabled = false; }
    } }, "Save");
    const cancel = h("button.btn.small", { type: "button", onclick: () => box.replaceChildren(text, edit) }, "Cancel");
    box.replaceChildren(h("label", {}, "Edit what you wrote"), area, h("div.row", { style: "margin-top:6px" }, save, cancel));
    area.focus();
  } }, "✎ Edit");
  box.append(edit);
  return box;
}

async function showOne(id) {
  const r = await api("/api/reports/" + id);
  markSeen(id, r.updated || r.created);
  if (lastList) updateTicketsBadge(lastList);
  const thread = h("div");
  // Sorting: the reporter or the owner can change how soon / which part / which device.
  let sorting = null;
  if (ME.owner || (ME.email !== "claude" && r.author === ME.email)) {
    const sel = (label, list, key, none) => {
      const s = h("select", { "aria-label": label }, none ? h("option", { value: "" }, none) : null, list.map(([v, l]) => h("option", { value: v, selected: r[key] === v }, l)));
      s.addEventListener("change", async () => {
        try { const res = await post("/api/reports/" + id, { [key]: s.value }, "PATCH"); markSeen(id, res.updated); toast("Saved"); } catch (e) { toast(e.message); }
      });
      return h("div", {}, h("label", {}, label), s);
    };
    sorting = h("details.card", {}, h("summary", { class: "faint" }, "Sorting: " + [labelOf(PRIOS, r.priority || "normal"), r.area ? labelOf(AREA_LIST, r.area) : "", r.device ? labelOf(DEVICE_LIST, r.device) : ""].filter(Boolean).join(" · ")),
      sel("How soon?", PRIOS, "priority"), sel("Which part of the site?", AREA_LIST, "area", "Not set"), sel("On which device?", DEVICE_LIST, "device", "Not set"));
  }
  async function loadThread() {
    const cs = await api("/api/comments?thread=report:" + id);
    thread.replaceChildren(...cs.map((c) => h("div.comment" + (c.author === "claude" ? ".claude" : ""), {}, h("div.who", {}, who(c.author) + " · " + when(c.created)), h("div.pre", {}, c.body))));
  }
  const reply = h("textarea", { placeholder: "Ask or answer here…", style: "min-height:80px" });
  const asClaude = ME.owner ? h("input", { type: "checkbox", id: "asc" }) : null;
  const send = h("button.btn.primary", { type: "button", onclick: async () => {
    if (!reply.value.trim()) return;
    send.disabled = true;
    try { await post("/api/comments", { thread: "report:" + id, body: reply.value, asClaude: !!(asClaude && asClaude.checked) }); reply.value = ""; await loadThread(); const fresh = await api("/api/reports/" + id).catch(() => null); if (fresh) markSeen(id, fresh.updated); }
    catch (e) { toast(e.message); }
    send.disabled = false;
  } }, "Send");

  // Owner's session only: the status Claude sets (Claude works the inbox from this browser).
  let tools = null;
  if (ME.owner) {
    const sel = h("select", {}, ["New", "Seen", "Working", "Question", "Reopened", "Live", "Done", "Roadmap"].map((s) => h("option", { value: s, selected: s === r.status }, s)));
    const notes = h("textarea", { style: "min-height:70px" }); notes.value = r.notes || "";
    const link = h("input", { type: "url", placeholder: "https://versesacross.com/…" }); link.value = r.live_url || "";
    const dup = h("input", { type: "text", placeholder: "Same as… e.g. #3fa2c1" });
    tools = h("details.card", {}, h("summary", { class: "faint" }, "Status and note (Claude)"),
      h("label", {}, "Status"), sel, h("label", {}, "Note"), notes, h("label", {}, "Test link"), link,
      h("button.btn", { type: "button", style: "margin-top:10px", onclick: async () => {
        try { await post("/api/reports/" + id, { status: sel.value, notes: notes.value, live_url: link.value }, "PATCH"); toast("Saved"); go("inbox", id); } catch (e) { toast(e.message); }
      } }, "Save"),
      h("label", {}, "A duplicate? Closes this one and points to the other"), dup,
      h("button.btn", { type: "button", style: "margin-top:8px", onclick: async () => {
        if (!dup.value.trim()) return toast("Type the other ticket's number");
        try { await post("/api/reports/" + id, { dup_of: dup.value }, "PATCH"); toast("Marked as a duplicate"); go("inbox", id); } catch (e) { toast(e.message); }
      } }, "Mark as duplicate"));
  }

  const picker = filePicker();
  const bar = h("div.bar.hidden", {}, h("i"));
  const addFiles = h("button.btn.small", { type: "button", onclick: async () => {
    const files = picker.files(); if (!files.length) return toast("Pick a file first");
    bar.classList.remove("hidden"); addFiles.disabled = true;
    try { await uploadFiles(files, "report", id, (p) => { bar.firstChild.style.width = Math.round(p * 100) + "%"; }); toast("Added"); picker.clear(); go("inbox", id); }
    catch (e) { toast(e.message); addFiles.disabled = false; }
  } }, "Upload");

  // Live: the reporter checks it on the site, then closes it (Resolved) or reopens it with a note.
  let close = null;
  if (r.status === "Live" && ME.email !== "claude") {
    const ok = h("input", { placeholder: "Anything to add? (optional)" });
    close = h("div.card", {}, h("div", { style: "font-weight:600" }, "Does it work now?"), ok,
      h("button.btn.primary", { type: "button", style: "margin-top:8px", onclick: async () => {
        try { await post("/api/reports/" + id + "/resolve", { note: ok.value }); toast("Closed. Thanks!"); go("inbox", id); } catch (e) { toast(e.message); }
      } }, "Fixed, close it"));
  }
  // A finished report that isn't really fixed: either of you sends it back with a note.
  let reopen = null;
  if (r.status === "Live" || r.status === "Done") {
    const why = h("textarea", { placeholder: "What's still wrong? e.g. fix not verified, still jumps on Psalm 24", style: "min-height:70px" });
    reopen = h("details.card", {}, h("summary", { class: "faint" }, "Not fixed? Reopen it"), why,
      h("button.btn", { type: "button", style: "margin-top:8px", onclick: async () => {
        if (!why.value.trim()) return toast("Say what's still wrong");
        try { await post("/api/reports/" + id + "/reopen", { note: why.value }); toast("Reopened. Claude will pick it up."); go("inbox", id); } catch (e) { toast(e.message); }
      } }, "Reopen"));
  }
  show(
    h("button.back", { onclick: () => go("inbox") }, "← Tickets"),
    h("div.card", {},
      h("div.row", {}, status(r.status), r.priority === "urgent" ? h("span.tag", { style: "color:var(--bad);border-color:var(--bad)" }, "Urgent") : null,
        h("span.faint", {}, num(r.id) + " · " + r.type + " · " + who(r.author) + " · " + when(r.created))),
      r.place ? h("div.faint", { style: "margin-top:6px" }, "Where: " + r.place) : null,
      r.dup_of ? h("p", { style: "margin:6px 0 0" }, h("a", { href: "#inbox/" + r.dup_of }, "Same as " + num(r.dup_of) + " →")) : null,
      bodyBox(r, id),
      r.files && r.files.length ? h("div.thumbs", {}, r.files.map(mediaEl)) : null,
      r.notes ? h("div.pre", { style: "margin-top:10px;border-top:1px solid var(--line);padding-top:8px" }, h("b", {}, "Claude"), r.updated ? h("span.faint", {}, " · " + when(r.updated)) : null, h("b", {}, ": "), r.notes) : null,
      r.status === "Live" && r.live_url ? h("p", {}, h("a", { href: r.live_url, target: "_blank", rel: "noopener" }, "Try it on the site →")) : null),
    close,
    reopen,
    sorting,
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
        toast("Added"); picker.clear(); go("approvals");
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
      notesText(it.notes)))]));
}
/** A roadmap card's notes: the first lines, and a tap on the text (or "Show more") opens the rest; tap again to close. */
function notesText(notes) {
  const long = notes.length > 260;
  const short = long ? notes.slice(0, 260).replace(/\\s+\\S*$/, "") + "…" : notes;
  const text = h("span", {}, short);
  const more = long ? h("button.linkish", { type: "button", "aria-expanded": "false" }, "Show more") : null;
  const box = h("div.muted" + (long ? ".tap" : ""), { style: "margin-top:4px;font-size:14px" }, text, more ? " " : null, more);
  if (long) {
    const toggle = (e) => {
      if (String(window.getSelection() || "")) return; // choosing text to copy, not tapping
      e.stopPropagation();
      const open = more.getAttribute("aria-expanded") !== "true";
      text.textContent = open ? notes : short;
      more.textContent = open ? "Show less" : "Show more";
      more.setAttribute("aria-expanded", open ? "true" : "false");
      // closing a long note: keep the card in view
      if (!open) box.closest(".card")?.scrollIntoView({ block: "nearest" });
    };
    box.addEventListener("click", toggle);
  }
  return box;
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
/** Monday of the week a date falls in, as "Week of Nov 3". */
function weekOf(iso) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
const weekLabel = (d) => {
  const thisWeek = weekOf(new Date().toISOString()).getTime();
  const lastWeek = weekOf(new Date(thisWeek - 3 * DAY).toISOString()).getTime(); // (not 7 x 24 h: clocks change)
  return d.getTime() === thisWeek ? "This week" : d.getTime() === lastWeek ? "Last week" : "Week of " + d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
/** Release notes: what shipped, grouped by week (plain-words notes first, then the site's changes). */
function byWeek(items, dateOf, render) {
  const groups = new Map();
  for (const it of items) {
    const k = weekOf(dateOf(it)).getTime();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  return [...groups].sort((a, z) => z[0] - a[0]).map(([k, list]) =>
    h("details.card", { open: k === weekOf(new Date().toISOString()).getTime() || null },
      h("summary", { style: "cursor:pointer;font-weight:600" }, weekLabel(new Date(k)) + " · " + list.length),
      h("div", { style: "margin-top:6px" }, list.map(render))));
}
async function showShipped() {
  const [s, hl, au] = await Promise.all([api("/api/shipped"), api("/api/health").catch(() => null), api("/api/audit").catch(() => null)]);
  const label = { view: "Chapters read", play: "Read-alongs started", download: "Downloads" };
  const kindName = (k) => (Object.hasOwn(label, k) ? label[k] : k);
  show(h("h2", {}, "Shipped"),
    s.totals.length ? h("div.grid2", {}, s.totals.map((t) => h("div.card", {}, h("div.faint", {}, kindName(t.kind)), h("div.num", {}, Number(t.week || 0).toLocaleString()), h("div.faint", {}, "this week · " + Number(t.month || 0).toLocaleString() + " in 30 days")))) : null,
    s.notes.length ? h("h3", {}, "In plain words, by week") : null,
    byWeek(s.notes, (n) => n.created, (n) => h("div.comment", {}, h("div.pre", {}, n.text), n.url ? h("a", { href: n.url, target: "_blank", rel: "noopener" }, "See it →") : null)),
    h("h3", {}, "Changes to the site, by week"),
    byWeek(s.commits, (c) => c.date, (c) => h("div.comment", {}, h("div.who", {}, when(c.date)), h("div", {}, c.text))),
    hl ? healthBox(hl, kindName) : null,
    au ? auditBox(au) : null);
}

/* ---------- Site health (HB5) ---------- */
function healthBox(hl, kindName) {
  const checks = hl.checks;
  const last = checks[0];
  const week = checks.filter((c) => Date.now() - new Date(c.at) < 7 * DAY);
  const up = week.length ? Math.round((week.filter((c) => c.ok).length / week.length) * 1000) / 10 : null;
  const downs = checks.filter((c) => !c.ok).slice(0, 5);
  // the last 48 hourly checks, oldest first: green answered, red failed
  const recent = checks.slice(0, 48).reverse();
  const ticks = h("div.ticks", { role: "img", "aria-label": "Last " + recent.length + " hourly checks: " + recent.filter((c) => !c.ok).length + " failed" },
    recent.map((c) => h("i" + (c.ok ? "" : ".down"), { title: new Date(c.at).toLocaleString() + (c.ok ? " · OK · " + c.ms + " ms" : " · " + c.detail) })));
  // chapters read per week (8 weeks)
  const views = hl.weeks.filter((w) => w.kind === "view");
  const max = Math.max(1, ...views.map((w) => Number(w.n)));
  const chart = views.length ? h("div.card", {}, h("div", { style: "font-weight:600;margin-bottom:6px" }, kindName("view") + " per week"),
    views.map((w) => h("div.hbar", {}, h("span.faint", {}, new Date(w.week + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })),
      h("span.track", {}, h("i", { style: "width:" + Math.max(1, Math.round((Number(w.n) / max) * 100)) + "%" })), h("span.n", {}, Number(w.n).toLocaleString())))) : null;
  const fb = hl.feedback.length ? h("div.faint", { style: "margin-top:6px" }, "Website feedback: " + hl.feedback.map((f) => f.topic + " " + f.week + " this week (" + f.month + " in 30 days)").join(" · ")) : null;
  const check = ME.owner ? h("button.btn.small", { type: "button", onclick: async (e) => {
    e.currentTarget.disabled = true;
    try { const r = await post("/api/check", {}); toast(r.ok ? "Site is up (" + r.ms + " ms)" : "Problem: " + r.detail); go("shipped"); } catch (err) { toast(err.message); }
  } }, "Check now") : null;
  return h("div", {}, h("h3", {}, "Site health"),
    h("div.card", {},
      h("div.row", {}, h("b.grow", {}, !last ? "No checks yet" : last.ok ? "✓ The site is up" : "✗ The site had a problem"), check),
      last ? h("div.faint", {}, "Checked " + when(last.at) + (last.ok ? " · slowest page " + last.ms + " ms" : " · " + last.detail)) : null,
      recent.length ? ticks : null,
      up != null ? h("div.faint", {}, up + "% of hourly checks OK in the last 7 days") : null,
      downs.length ? h("div.faint", { style: "margin-top:4px" }, "Last problems: " + downs.map((c) => new Date(c.at).toLocaleString() + " (" + c.detail + ")").join("; ")) : null,
      h("div.faint", { style: "margin-top:4px" }, "Every hour the hub opens " + hl.pages.join(", ") + " on versesacross.com.")),
    chart, fb);
}

/* ---------- Audit and backups (HB6) ---------- */
function auditBox(au) {
  const what = (w) => w.startsWith("report:") ? h("a", { href: "#inbox/" + w.slice(7) }, "Ticket " + num(w.slice(7))) : w.startsWith("approval:") ? "Clip approval" : w.startsWith("feedback:") ? "Website feedback " + w.slice(9) : w;
  const backupNow = ME.owner ? h("button.btn.small", { type: "button", onclick: async (e) => {
    e.currentTarget.disabled = true;
    try { const r = await post("/api/backup", {}); toast("Backed up (" + Math.round(r.bytes / 1024) + " KB)"); go("shipped"); } catch (err) { toast(err.message); }
  } }, "Back up now") : null;
  return h("div", {}, h("h3", {}, "Who did what"),
    h("details.card", {}, h("summary", { class: "faint", style: "cursor:pointer" }, "Decisions and status changes: " + au.log.length + " most recent"),
      au.log.map((d) => h("div.comment", {}, h("div.who", {}, who(d.by) + " · " + new Date(d.at).toLocaleString()), h("div", {}, what(d.what), " → " + (d.decision === "Done" ? "Resolved" : d.decision) + (d.note ? ": " + d.note : ""))))),
    h("h3", {}, "Backups"),
    h("div.card", {},
      h("div.row", {}, h("span.grow.faint", {}, "Every Sunday the hub's database and the site's feedback and reading totals are saved to private storage (the newest 12 are kept)."), backupNow),
      au.backups.length ? h("div.faint", { style: "margin-top:6px" }, "Last: " + new Date(au.backups[0].at).toLocaleString() + " · " + Math.round(au.backups[0].size / 1024) + " KB · " + au.backups.length + " kept") : h("div.faint", { style: "margin-top:6px" }, "None yet; the first runs this Sunday.")));
}

/* ---------- start ---------- */
(async () => {
  try { ME = await api("/api/me"); } catch { show(h("p", {}, "Not signed in.")); return; }
  $("#who").textContent = ME.name;
  api("/api/reports").then((list) => { if (!lastList) updateTicketsBadge(list); }).catch(() => {});
  api("/api/approvals").then((a) => { const n = a.filter((x) => x.status === "Waiting").length; const b = $("#apBadge"); if (n) { b.textContent = n; b.classList.remove("hidden"); } }).catch(() => {});
  const [tab, arg] = location.hash.slice(1).split("/");
  go(Object.hasOwn(TABS, tab) ? tab : "report", arg);
})();
</script>
</body>
</html>`;
