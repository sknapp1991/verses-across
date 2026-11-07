/**
 * A made-up demo reader for screen recordings (shorts, store screenshots), so Progress shows a real-looking
 * level, streak and badges instead of "Level 1, 0 badges". Everything goes into the headless browser's own
 * storage for the site; nothing is sent anywhere and no real person's data is used.
 *
 * Use (with the CDP `ev` helper in make-shorts.mjs or a test script), on any page of the site, before
 * opening the reader:
 *   import { DEMO_PROFILE_JS } from "./demo-profile.mjs";
 *   await b.send("Page.navigate", { url: `${APP}/about` }); await sleep(3000);
 *   await b.ev(DEMO_PROFILE_JS);            // resolves to "demo profile ready"
 *   await b.send("Page.navigate", { url: `${APP}/read/bible/jhn/3` });
 *
 * Result: about level 12 ("Reader"), a 21-day streak, three Gospels studied, a reading plan under way,
 * a daily goal, notes, highlights and favorites, and about 20 badges. It replaces this browser
 * profile's reading data, so only use it in a throwaway profile.
 */
export const DEMO_PROFILE_JS = `(async () => {
  const DAY = 86400000;
  const key = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const now = Date.now();

  // Reading activity: the last 21 days in a row, plus some earlier days (best streak 21).
  const works = ["bible", "quran", "gita", "dhammapada", "tanakh"];
  const books = [["mat", 28], ["mrk", 16], ["luk", 24], ["jhn", 21]];
  const days = {};
  const dayList = [...Array(21).keys(), 24, 25, 27, 30, 31, 33, 36, 38, 41, 44];
  dayList.forEach((ago, i) => {
    const [b, n] = books[i % books.length];
    const ch = [1, 2, 3].map((k) => "bible/" + b + "/" + (((i * 3 + k) % n) + 1));
    const w = { bible: 900 + (i % 5) * 120 };
    w[works[i % works.length]] = (w[works[i % works.length]] ?? 0) + 240;
    days[key(now - ago * DAY)] = { r: 900 + (i % 5) * 150, l: i % 3 ? 300 : 0, v: 70 + (i % 6) * 12, ch, w };
  });
  localStorage.setItem("va-activity:v1", JSON.stringify({ v: 1, days }));

  // A daily goal, some goals already reached, and a plan started two weeks ago.
  localStorage.setItem("va-goals:v1", JSON.stringify([{ id: "demo15", type: "amount", metric: "time", period: "day", target: 15 }]));
  localStorage.setItem("va-goals-count:v1", "12");
  localStorage.setItem("va-goals-met:v1", JSON.stringify({ demo15: key(now) })); // today's goal: already announced
  localStorage.setItem("gs:plans:v1", JSON.stringify({ "gospels-30": { start: now - 13 * DAY } }));
  // Announce nothing on the first look (badges and level are marked as already seen on first run).
  localStorage.removeItem("va-badges-seen:v1");
  localStorage.removeItem("va-level-seen:v1");
  localStorage.setItem("va-tour:v1", "done");
  localStorage.setItem("gs:tips:v1", "1");

  // Study items: Matthew, Mark and John studied; notes, highlights and favorites.
  const items = [];
  const add = (kind, book, chapter, verse, extra = {}, ago = 5) => {
    const ref = "bible/" + book + "/" + chapter + (verse ? ":" + verse : "");
    const t = now - ago * DAY;
    items.push({ id: kind + ":" + ref, kind, work: "bible", book, chapter, ...(verse ? { verse: String(verse) } : {}), createdAt: t, updatedAt: t, ...extra });
  };
  [["mat", 28], ["mrk", 16], ["jhn", 21]].forEach(([b, n], j) => { for (let c = 1; c <= n; c++) add("studied", b, c, null, {}, 40 - j * 12 - Math.floor(c / 3)); });
  const colors = ["yellow", "green", "blue", "pink", "orange"];
  for (let v = 1; v <= 30; v++) add("highlight", "jhn", 1 + (v % 21), v, { color: colors[v % 5] }, v % 20);
  [["jhn", 3, 16], ["mat", 5, 9], ["mat", 6, 33], ["mrk", 12, 31], ["jhn", 14, 27], ["jhn", 1, 5], ["mat", 7, 7], ["mat", 11, 28], ["jhn", 15, 12], ["mrk", 10, 27], ["mat", 22, 37], ["jhn", 8, 32]]
    .forEach(([b, c, v], i) => add("favorite", b, c, v, {}, i));
  [["jhn", 3, 16, "Compare the Greek word for love here with John 21."], ["mat", 5, 9, "Read next to the Dhammapada on peace."], ["jhn", 1, 1, "Logos: look at the Greek column."], ["mrk", 12, 31, "Same command in Leviticus 19:18."], ["mat", 6, 33, "Memorize this week."], ["jhn", 15, 12, "Talk about this one with the study group."]]
    .forEach(([b, c, v, text], i) => add("note", b, c, v, { text }, i * 2));
  const db = await new Promise((res, rej) => { const r = indexedDB.open("globalstudy", 1); r.onupgradeneeded = () => r.result.createObjectStore("study", { keyPath: "id" }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const tx = db.transaction("study", "readwrite"); const s = tx.objectStore("study"); s.clear(); items.forEach((i) => s.put(i)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close();
  return "demo profile ready";
})()`;
