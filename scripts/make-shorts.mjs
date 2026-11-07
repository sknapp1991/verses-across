/**
 * Vertical short clips (1080x1920, dark mode, no sound) for TikTok / YouTube Shorts / Reels.
 *
 *   node scripts/make-shorts.mjs <out-dir> [name ...]
 *   node scripts/make-shorts.mjs <out-dir> --votd 2026-11-08 21     (verse of the day for 21 days from that date)
 *
 * Two kinds of clip:
 *   - "cards": a passage in several languages (or one idea across traditions) fading in one by one,
 *     rendered from the library texts in public/texts, then an end card.
 *   - "app": the real reader on a phone-sized screen (the live site by default; SHORTS_APP=http://127.0.0.1:3100 for a local build), e.g. Words mode.
 * Texts are read from public/texts so they are exactly what the app shows; every card names its source.
 * Needs Chrome and ffmpeg.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, ".cache-shorts"));
const VOTD_AT = process.argv.indexOf("--votd");
const ONLY = new Set(process.argv.slice(3).filter((a, i) => !a.startsWith("--") && (VOTD_AT < 0 || i + 3 > VOTD_AT + 2)));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP = process.env.SHORTS_APP || "https://versesacross.com"; // the real reader to record ("app" clips); a local build also works
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

const KJV = "English · King James Version";
const RVR = "Español · Reina-Valera 1909";
const LSG = "Français · Louis Segond 1910";
const LUT = "Deutsch · Luther 1912";
const GRK = "Ελληνικά · Greek (Textus Receptus)";
const HEB = "עברית · Hebrew (Masoretic)";

const CLIPS = [
  {
    name: "01-john-3-16-five-languages",
    kind: "cards",
    kicker: "One verse, five languages",
    title: "John 3:16",
    cards: [
      [KJV, text("bible", "kjv", "jhn", 3, 16)],
      [RVR, text("bible", "rvr1909", "jhn", 3, 16)],
      [LSG, text("bible", "lsg1910", "jhn", 3, 16)],
      [LUT, text("bible", "luther1912", "jhn", 3, 16)],
      [GRK, text("bible", "greek", "jhn", 3, 16)],
    ],
  },
  {
    name: "02-psalm-23-1-five-languages",
    kind: "cards",
    kicker: "One verse, five languages",
    title: "Psalm 23:1",
    cards: [
      [KJV, text("bible", "kjv", "psa", 23, 1)],
      [HEB, text("bible", "hebrew", "psa", 23, 1), "rtl"],
      [RVR, text("bible", "rvr1909", "psa", 23, 1)],
      [LSG, text("bible", "lsg1910", "psa", 23, 1)],
      [LUT, text("bible", "luther1912", "psa", 23, 1)],
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
  { name: "04-the-original-word-agapao", kind: "app", kicker: "Tap a word, see the original", book: "jhn", ch: 3, v: 16, phrase: "so loved the world", word: "loved", versions: ["kjv", "rvr1909", "luther1912"] },
  {
    name: "05-verse-of-the-day-2026-11-07",
    kind: "cards",
    kicker: "Verse of the day",
    title: "Matthew 5:9",
    cards: [
      [KJV, text("bible", "kjv", "mat", 5, 9)],
      [RVR, text("bible", "rvr1909", "mat", 5, 9)],
      [GRK, text("bible", "greek", "mat", 5, 9)],
    ],
  },
  { name: "06-the-original-word-logos", kind: "app", book: "jhn", ch: 1, v: 1, phrase: "In the beginning was the Word", word: "Word", versions: ["kjv", "rvr1909", "luther1912"] },
  { name: "07-the-original-word-shalom", kind: "app", book: "num", ch: 6, v: 26, phrase: "give thee peace", word: "peace", versions: ["kjv", "rvr1909", "luther1912"] },
  { name: "08-the-original-word-hesed", kind: "app", book: "psa", ch: 136, v: 1, phrase: "his mercy endureth", word: "mercy", versions: ["kjv", "rvr1909", "luther1912"] },
  {
    name: "09-forgiveness-four-traditions",
    kind: "cards",
    kicker: "The same idea, four traditions",
    title: "Forgiveness",
    cards: [
      ["Christianity · Matthew 6:14 (KJV)", text("bible", "kjv", "mat", 6, 14)],
      ["Islam · Quran 24:22 (Pickthall)", "Let them forgive and show indulgence. Yearn ye not that Allah may forgive you? Allah is Forgiving, Merciful."],
      ["Buddhism · Dhammapada 5 (Sujato)", text("dhammapada", "sujato", "dhp", 1, 5)],
      ["Hinduism · Bhagavad Gita 16:3 (Besant)", text("gita", "besant", "gita", 16, 3)],
    ],
    excerpts: [[text("quran", "pickthall", "quran", 24, 22), "Let them forgive and show indulgence. Yearn ye not that Allah may forgive you? Allah is Forgiving, Merciful."]],
  },
];

/* ---------------- verse of the day (same list and same day rule as src/lib/daily.ts) ---------------- */

const catalog = JSON.parse(readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
const DAILY = [...readFileSync(path.join(ROOT, "src", "lib", "daily.ts"), "utf8").matchAll(/\{ work: "([^"]+)", book: "([^"]+)", chapter: (\d+), verse: "([^"]+)" \}/g)].map((m) => ({ work: m[1], book: m[2], chapter: Number(m[3]), verse: m[4] }));
const dailyFor = (y, m, d) => DAILY[Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) % DAILY.length];
const LANG = { en: "English", es: "Español", el: "Ελληνικά", he: "עברית", ar: "العربية", sa: "संस्कृतम्", pi: "Pāli" };
/** Versions shown for a work's verse of the day: its English, plus the original language (and Spanish for the Bible). */
const VOTD_VERSIONS = { bible: null, tanakh: ["jps1917", "mt"], quran: ["pickthall", "tanzil"], gita: ["besant", "sanskrit"], dhammapada: ["sujato", "pli"], mishnah: ["kulp", "mishnah-he"] };
function itemName(work, book) {
  for (const r of catalog.religions) for (const col of r.collections) for (const it of col.items) if (it.work === work && it.id === book) return it.name;
  return book;
}
function votdClip(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dv = dailyFor(y, m, d);
  const ot = dv.work === "bible" && !["mat", "mrk", "luk", "jhn", "act", "rom", "1co", "2co", "gal", "eph", "php", "col", "1th", "2th", "1ti", "2ti", "tit", "phm", "heb", "jas", "1pe", "2pe", "1jn", "2jn", "3jn", "jud", "rev"].includes(dv.book);
  const ids = VOTD_VERSIONS[dv.work] ?? (dv.work === "bible" ? ["kjv", "rvr1909", ot ? "hebrew" : "greek"] : catalog.versions.filter((v) => v.work === dv.work && v.language === "en").slice(0, 1).map((v) => v.id));
  const cards = ids.map((id) => {
    const v = catalog.versions.find((x) => x.work === dv.work && x.id === id);
    const t = text(dv.work, id, dv.book, dv.chapter, dv.verse);
    return [`${LANG[v.language] ?? v.language} · ${v.name}`, t, ["he", "ar"].includes(v.language) ? "rtl" : undefined];
  });
  const name = itemName(dv.work, dv.book).split(" · ")[0];
  const single = ["quran", "gita", "dhammapada", "yoga-sutras", "thomas"].includes(dv.work);
  return { name: `votd-${dateStr}`, kind: "cards", kicker: "Verse of the day", title: `${name} ${dv.chapter}:${dv.verse}`.replace(/^(The Quran|Bhagavad Gita|Dhammapada) /, single ? "$1 " : "$1 "), cards };
}

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
  const { book, ch, v, phrase, word, versions } = clip;
  await b.send("Page.navigate", { url: `${APP}/about` });
  await sleep(1500);
  await b.ev(`(() => {
    localStorage.clear(); // a clean reader each time (no tab strip from earlier clips)
    localStorage.setItem("gs:tips:v1", "1");
    const s = JSON.parse(localStorage.getItem("gs:settings:v1") ?? "{}");
    s.versions = { ...(s.versions ?? {}), bible: ${JSON.stringify(versions)} };
    s.view = "stacked"; s.wordMode = true; s.theme = "dark"; s.fontSize = 20;
    localStorage.setItem("gs:settings:v1", JSON.stringify(s));
    return true })()`);
  await b.send("Page.navigate", { url: `${APP}/read/bible/${book}/${ch}` });
  await sleep(5000);
  await b.ev(`document.querySelectorAll("dialog[open]").forEach(d => d.close()); true`);
  await b.ev(`(() => { const el = [...document.querySelectorAll('[data-v="${v}"]')][0]; el?.scrollIntoView({ block: "start" }); document.querySelector("main, [data-scroller]")?.scrollBy?.(0, -70); return true })()`);
  await sleep(1200);
  // Hide the floating chapter arrows: in a tall phone video they'd sit on top of the word card.
  await b.ev(`(() => { const nav = document.querySelector('[aria-label="Chapter"]'); if (nav) nav.style.display = "none"; return !!nav })()`);
  await b.ev(`(() => { const c = document.createElement("div"); c.id = "fc";
    c.style.cssText = "position:fixed;z-index:99999;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.28);border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5);pointer-events:none;left:${W - 80}px;top:${H - 140}px;transform:translate(-50%,-50%);transition:left .9s ease,top .9s ease,transform .15s";
    document.body.appendChild(c); return true })()`);
  const pos = await b.ev(`(() => {
    const t = [...document.querySelectorAll("[data-text]")].find(e => e.textContent.includes(${JSON.stringify(phrase)}));
    if (!t) return null;
    const w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) { const i = n.textContent.indexOf(${JSON.stringify(word)}); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + ${word.length}); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } } }
    return null })()`);
  if (!pos) throw new Error(`couldn't find "${word}" on screen`);
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
  const votd = process.argv.indexOf("--votd");
  const list = votd > 0
    ? Array.from({ length: Number(process.argv[votd + 2] ?? 1) }, (_, i) => {
        const [y, m, d] = process.argv[votd + 1].split("-").map(Number);
        return votdClip(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
      })
    : CLIPS.filter((c) => !ONLY.size || ONLY.has(c.name));
  for (const clip of list) {
    const frames = clip.kind === "app" ? await makeWordClip(b, clip) : await makeCards(b, clip);
    console.log(`${clip.name}.mp4  ${(frames / 25).toFixed(1)} s`);
  }
} finally {
  b.close();
}
process.exit(0);
