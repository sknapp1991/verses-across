/**
 * Vertical short clips (1080x1920, dark mode, no sound) for TikTok / YouTube Shorts / Reels.
 *
 *   node scripts/make-shorts.mjs <out-dir> [name ...]
 *
 * Two kinds of clip:
 *   - "cards": a passage in several languages (or one idea across traditions) fading in one by one,
 *     rendered from the library texts in public/texts, then an end card.
 *   - "app": the real reader on a phone-sized screen (needs `next start -p 3100` running), e.g. Words mode.
 * Texts are read from public/texts so they are exactly what the app shows; every card names its source.
 * Needs Chrome and ffmpeg.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, ".cache-shorts"));
const ONLY = new Set(process.argv.slice(3));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP = "http://127.0.0.1:3100";
const W = 540, H = 960, SCALE = 2; // CSS px x2 = 1080x1920
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const text = (work, version, book, ch, v) => {
  const j = JSON.parse(readFileSync(path.join(ROOT, "public", "texts", work, version, `${book}.json`), "utf8"));
  const t = j.chapters[String(ch)]?.verses.find((x) => x.v === String(v))?.t;
  if (!t) throw new Error(`missing ${work}/${version}/${book} ${ch}:${v}`);
  return t.normalize("NFC"); // combining accents composed, so Greek renders cleanly
};

// Colours: the app's dark theme (globals.css .dark), and lighter version colours that read on it.
const C = { paper: "#15130f", panel: "#1c1a16", line: "#34302a", ink: "#ece7de", muted: "#b3ab9e", faint: "#847c70", accent: "#f59e0b" };
const HUES = ["#60a5fa", "#fb923c", "#4ade80", "#c084fc", "#f472b6", "#2dd4bf"];

/* ---------------- clip list ---------------- */

const CLIPS = [
  {
    name: "01-john-3-16-five-languages",
    kind: "cards",
    kicker: "One verse, five languages",
    title: "John 3:16",
    cards: [
      ["English · KJV (1611)", text("bible", "kjv", "jhn", 3, 16)],
      ["Español · Reina-Valera 1909", text("bible", "rvr1909", "jhn", 3, 16)],
      ["Français · Louis Segond 1910", text("bible", "lsg1910", "jhn", 3, 16)],
      ["Deutsch · Luther 1912", text("bible", "luther1912", "jhn", 3, 16)],
      ["Ελληνικά · Greek (Textus Receptus)", text("bible", "greek", "jhn", 3, 16)],
    ],
  },
  {
    name: "02-psalm-23-1-five-languages",
    kind: "cards",
    kicker: "One verse, five languages",
    title: "Psalm 23:1",
    cards: [
      ["English · KJV (1611)", text("bible", "kjv", "psa", 23, 1)],
      ["עברית · Hebrew (Masoretic)", text("bible", "hebrew", "psa", 23, 1), "rtl"],
      ["Español · Reina-Valera 1909", text("bible", "rvr1909", "psa", 23, 1)],
      ["Français · Louis Segond 1910", text("bible", "lsg1910", "psa", 23, 1)],
      ["Deutsch · Luther 1912", text("bible", "luther1912", "psa", 23, 1)],
    ],
  },
  {
    name: "03-golden-rule-four-traditions",
    kind: "cards",
    kicker: "The same idea, four traditions",
    title: "The Golden Rule",
    cards: [
      ["Christianity · Matthew 7:12 (KJV)", text("bible", "kjv", "mat", 7, 12)],
      ["Judaism · Hillel, Talmud Shabbat 31a (William Davidson ed., Sefaria)", "That which is hateful to you do not do to another; that is the entire Torah, and the rest is its interpretation. Go study."],
      ["Confucianism · Analects 15:23 (Legge)", "What you do not want done to yourself, do not do to others."],
      ["Buddhism · Dhammapada 130 (Sujato)", text("dhammapada", "sujato", "dhp", 10, 130)],
    ],
    // Excerpts above are exact substrings of the library text; checked below.
    excerpts: [
      [text("talmud", "davidson", "shabbat", 31, 6), "That which is hateful to you do not do to another; that is the entire Torah, and the rest is its interpretation. Go study."],
      [text("analects", "legge-an", "analects", 15, 23), "What you do not want done to yourself, do not do to others."],
    ],
  },
  {
    name: "04-the-original-word-agapao",
    kind: "app",
    kicker: "Tap a word, see the original",
  },
  {
    name: "05-verse-of-the-day-2026-11-07",
    kind: "cards",
    kicker: "Verse of the day",
    title: "Matthew 5:9",
    cards: [
      ["English · KJV (1611)", text("bible", "kjv", "mat", 5, 9)],
      ["Español · Reina-Valera 1909", text("bible", "rvr1909", "mat", 5, 9)],
      ["Ελληνικά · Greek (Textus Receptus)", text("bible", "greek", "mat", 5, 9)],
    ],
  },
];

for (const c of CLIPS) for (const [full, part] of c.excerpts ?? []) if (!full.includes(part)) throw new Error(`${c.name}: excerpt not found in source: ${part}`);

/* ---------------- browser ---------------- */

async function browser(port, profile) {
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"]);
  let ws;
  for (let i = 0; i < 50 && !ws; i++) {
    await sleep(300);
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
      if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
    } catch {}
  }
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0, last = null;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) (pending.get(m.id)(m), pending.delete(m.id));
    if (m.method === "Page.screencastFrame") {
      last = m.params.data;
      send("Page.screencastFrameAck", { sessionId: m.params.sessionId });
    }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (x) => (await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setBypassServiceWorker", { bypass: true });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: SCALE, mobile: true });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  /** Record `fn` at 25 fps into frames/, then encode to name.mp4. */
  async function record(name, fn) {
    const dir = path.join(OUT, ".frames", name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    last = null;
    await send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W * SCALE, maxHeight: H * SCALE });
    let n = 0, on = true;
    const sampler = (async () => {
      while (on) {
        if (last) writeFileSync(path.join(dir, `f${String(n++).padStart(4, "0")}.jpg`), Buffer.from(last, "base64"));
        await sleep(40);
      }
    })();
    await fn();
    on = false;
    await sampler;
    await send("Page.stopScreencast");
    await ffmpeg(["-y", "-loglevel", "error", "-framerate", "25", "-i", path.join(dir, "f%04d.jpg"), "-vf", `scale=1080:1920:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-crf", "19", "-movflags", "+faststart", path.join(OUT, `${name}.mp4`)]);
    await ffmpeg(["-y", "-loglevel", "error", "-sseof", "-1.5", "-i", path.join(OUT, `${name}.mp4`), "-frames:v", "1", path.join(OUT, `${name}.jpg`)]);
    return n;
  }
  return { send, ev, record, close: () => (ws.close(), chrome.kill()) };
}

const ffmpeg = (args) => new Promise((res, rej) => spawn("ffmpeg", args, { stdio: "inherit" }).on("exit", (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res())));

/* ---------------- cards page ---------------- */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const icon = `data:image/png;base64,${readFileSync(path.join(ROOT, "public", "icon-192.png")).toString("base64")}`;

function cardsPage(clip) {
  const step = 2.2; // seconds between cards
  const n = clip.cards.length;
  const size = n >= 5 ? 26 : n === 4 ? 29 : 34;
  const cards = clip.cards
    .map(([label, t, dir], i) => `<div class="card" style="animation-delay:${0.9 + i * step}s"><div class="label" style="color:${HUES[i % HUES.length]}">${esc(label)}</div><div class="t${/[Ͱ-Ͽἀ-῿]/.test(t) ? " el" : ""}" dir="${dir ?? "auto"}">${esc(t)}</div></div>`)
    .join("");
  const end = 0.9 + n * step + 2.6;
  return `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  html,body{width:${W}px;height:${H}px;background:${C.paper};color:${C.ink};font-family:Georgia,"Times New Roman",serif;overflow:hidden}
  .wrap{position:absolute;inset:0;padding:64px 26px 40px;display:flex;flex-direction:column}
  .kicker{font:600 15px "Segoe UI",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${C.accent}}
  h1{font-size:46px;margin:8px 0 18px;font-weight:700}
  .cards{flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px;padding-bottom:40px}
  .card{background:${C.panel};border:1px solid ${C.line};border-radius:16px;padding:14px 18px;opacity:0;transform:translateY(14px)}
  .go .card{animation:in .7s ease forwards}
  .label{font:600 15px "Segoe UI",Arial,sans-serif;margin-bottom:6px}
  .t{font-size:${size}px;line-height:1.36;font-family:Georgia,"Palatino Linotype",serif}
  .t:lang(el),.t.el{font-family:"Palatino Linotype",Georgia,serif}
  .t[dir=rtl]{font-family:"Times New Roman",serif;font-size:${size + 6}px;text-align:right}
  .foot{margin-top:18px;display:flex;align-items:center;gap:12px;opacity:.9}
  .foot img{width:40px;height:40px;border-radius:10px}
  .foot b{font-size:20px} .foot span{display:block;font:14px "Segoe UI",Arial,sans-serif;color:${C.muted}}
  .end{position:absolute;inset:0;background:${C.paper};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;opacity:0;text-align:center;padding:40px}
  .go .end{animation:in .8s ease ${end}s forwards}
  .end img{width:120px;height:120px;border-radius:28px}
  .end h2{font-size:42px} .end p{font:20px "Segoe UI",Arial,sans-serif;color:${C.muted};line-height:1.5}
  .end .url{font:600 26px "Segoe UI",Arial,sans-serif;color:${C.accent}}
  @keyframes in{to{opacity:1;transform:none}}
  </style><body><div class="wrap"><div class="kicker">${esc(clip.kicker)}</div><h1>${esc(clip.title)}</h1><div class="cards">${cards}</div>
  <div class="foot"><img src="${icon}"><div><b>Verses Across</b><span>versesacross.com</span></div></div></div>
  <div class="end"><img src="${icon}"><h2>Verses Across</h2><p>The world’s scriptures side by side,<br>in many languages.<br>Free · no ads · no account</p><div class="url">versesacross.com</div></div></body>`;
}

async function makeCards(b, clip) {
  const file = path.join(OUT, ".frames", `${clip.name}.html`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, cardsPage(clip));
  await b.send("Page.navigate", { url: pathToFileURL(file).href });
  await sleep(1200);
  const total = 0.9 + clip.cards.length * 2.2 + 2.6 + 3.2;
  return b.record(clip.name, async () => {
    await sleep(300);
    await b.ev(`document.body.classList.add("go"); true`);
    await sleep(total * 1000);
  });
}

/* ---------------- app clip: Words mode on a phone ---------------- */

async function makeWordClip(b, clip) {
  await b.send("Page.navigate", { url: `${APP}/about` });
  await sleep(1500);
  await b.ev(`(() => {
    localStorage.setItem("gs:tips:v1", "1");
    const s = JSON.parse(localStorage.getItem("gs:settings:v1") ?? "{}");
    s.versions = { ...(s.versions ?? {}), bible: ["kjv", "rvr1909", "luther1912"] };
    s.view = "stacked"; s.wordMode = true; s.theme = "dark"; s.fontSize = 20;
    localStorage.setItem("gs:settings:v1", JSON.stringify(s));
    return true })()`);
  await b.send("Page.navigate", { url: `${APP}/read/bible/jhn/3` });
  await sleep(5000);
  await b.ev(`document.querySelectorAll("dialog[open]").forEach(d => d.close()); true`);
  await b.ev(`(() => { const el = [...document.querySelectorAll('[data-v="16"]')][0]; el?.scrollIntoView({ block: "start" }); document.querySelector("main, [data-scroller]")?.scrollBy?.(0, -70); return true })()`);
  await sleep(1200);
  // Hide the floating chapter arrows: in a tall phone video they'd sit on top of the word card.
  await b.ev(`(() => { const nav = document.querySelector('[aria-label="Chapter"]'); if (nav) nav.style.display = "none"; return !!nav })()`);
  await b.ev(`(() => { const c = document.createElement("div"); c.id = "fc";
    c.style.cssText = "position:fixed;z-index:99999;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.28);border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5);pointer-events:none;left:${W - 80}px;top:${H - 140}px;transform:translate(-50%,-50%);transition:left .9s ease,top .9s ease,transform .15s";
    document.body.appendChild(c); return true })()`);
  const pos = await b.ev(`(() => {
    const t = [...document.querySelectorAll("[data-text]")].find(e => e.textContent.includes("so loved the world"));
    if (!t) return null;
    const w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) { const i = n.textContent.indexOf("loved"); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 5); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } } }
    return null })()`);
  if (!pos) throw new Error("couldn't find 'loved' on screen");
  return b.record(clip.name, async () => {
    await sleep(1600);
    await b.ev(`(() => { const c = document.getElementById("fc"); c.style.left = "${pos.x}px"; c.style.top = "${pos.y}px"; return true })()`);
    await sleep(1200);
    await b.ev(`document.getElementById("fc").style.transform = "translate(-50%,-50%) scale(.75)"; true`);
    await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pos.x, y: pos.y }] });
    await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(200);
    await b.ev(`document.getElementById("fc").style.transform = "translate(-50%,-50%)"; true`);
    await sleep(7500);
  });
}

/* ---------------- run ---------------- */

mkdirSync(OUT, { recursive: true });
const b = await browser(9371, path.join(OUT, ".frames", "profile"));
try {
  for (const clip of CLIPS) {
    if (ONLY.size && !ONLY.has(clip.name)) continue;
    const frames = clip.kind === "app" ? await makeWordClip(b, clip) : await makeCards(b, clip);
    console.log(`${clip.name}.mp4  ${(frames / 25).toFixed(1)} s`);
  }
} finally {
  b.close();
}
process.exit(0);
