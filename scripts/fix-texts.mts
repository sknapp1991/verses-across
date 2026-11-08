/**
 * Clean transcription slips out of data/texts (found with scripts/scan-texts.mts). Each rule is scoped
 * to the versions where it was checked by hand against samples; run it after re-importing a work.
 * Idempotent: running it twice changes nothing the second time.
 *
 *   npx tsx scripts/fix-texts.mts            (writes; prints what each rule changed)
 *   npx tsx scripts/fix-texts.mts --dry      (only counts)
 *
 * Not touched: the Bible and Tanakh versions (word links and recorded audio follow their exact words),
 * except one plain typo; the Arabic Qur'an (Tanzil forbids changes).
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "data", "texts");
const DRY = process.argv.includes("--dry");

type Verse = { v: string; t: string; [k: string]: unknown };
type Chapter = { verses: Verse[]; [k: string]: unknown };
const counts = new Map<string, number>();
const bump = (rule: string, n = 1) => counts.set(rule, (counts.get(rule) ?? 0) + n);

/** Replace and count. */
function sub(rule: string, t: string, re: RegExp, to: string | ((...a: string[]) => string)): string {
  const out = typeof to === "string" ? t.replace(re, to) : t.replace(re, (...a) => to(...(a as string[])));
  if (out !== t) bump(rule, re.global ? (t.match(re)?.length ?? 1) : 1);
  return out;
}

async function walk(d: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/^\d+\.json$/.test(e.name)) out.push(p);
  }
  return out;
}

const catalog = JSON.parse(await readFile(path.join(process.cwd(), "data", "catalog.json"), "utf8")) as { versions: { id: string; work: string; language: string }[] };
const langOf = new Map(catalog.versions.map((v) => [`${v.work}/${v.id}`, v.language]));
const SCRIPTURE_EXACT = new Set(["bible", "tanakh"]);

/* ---------- vocabulary of the English texts, to mend words broken across a line ("whiz- zing") ---------- */
const vocab = new Map<string, number>();
const allFiles = await walk(ROOT);
const byKey = new Map<string, string[]>();
for (const f of allFiles) {
  const rel = path.relative(ROOT, f).split(path.sep);
  const key = `${rel[0]}/${rel[1]}`;
  (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(f);
}
for (const [key, files] of byKey) {
  if (langOf.get(key) !== "en") continue;
  for (const f of files) {
    const c = JSON.parse(await readFile(f, "utf8")) as Chapter;
    for (const x of c.verses ?? []) for (const w of (x.t ?? "").toLowerCase().match(/[a-z]+(?:-[a-z]+)*/g) ?? []) vocab.set(w, (vocab.get(w) ?? 0) + 1);
  }
}
const FUNCTION_WORDS = new Set(["and", "or", "nor", "to", "the", "a", "an", "of", "in", "on", "us", "we", "they", "he", "she", "it", "i", "you", "is", "are", "was", "be", "but", "for", "with", "as", "at", "by", "that", "this", "not", "so"]);
function mendHyphen(rule: string, t: string) {
  return sub(rule, t, /\b([A-Za-z]{2,})- ([a-z]{2,})\b/g, (_m, a, b) => {
    // "brother- and sister-in-law", or a dash used as punctuation ("only- they are false"): leave as is.
    if (FUNCTION_WORDS.has(b) || FUNCTION_WORDS.has(a.toLowerCase())) return `${a}- ${b}`;
    const joined = vocab.get((a + b).toLowerCase()) ?? 0;
    const hyphened = vocab.get(`${a}-${b}`.toLowerCase()) ?? 0;
    // Joined only when that spelling is common and the hyphenated one isn't used (high-souled, air-space stay).
    if (joined >= 3 && hyphened === 0) return a + b;
    return `${a}-${b}`;
  });
}

/* ---------- a verse number left inside the text: move what follows into that (missing) verse ---------- */
/** Verse numbers as the 1930 scan misread them: "ii 8." for 118, "01." for 101, "l2." for 12. */
const ocrNum = (tok: string) => tok.replace(/\s+/g, "").replace(/[ilI]/g, "1").replace(/[oO]/g, "0").replace(/S/g, "5").replace(/B/g, "8");

function splitMissing(rule: string, c: Chapter, ocr = false) {
  let moved = true;
  while (moved) {
    moved = false;
    const have = new Map(c.verses.map((x) => [Number(x.v), x]));
    for (let i = 0; i < c.verses.length && !moved; i++) {
      const x = c.verses[i];
      const cur = Number(x.v);
      if (!Number.isInteger(cur)) continue;
      const nextFull = c.verses.slice(i + 1).find((y) => y.t.trim() && Number.isInteger(Number(y.v)));
      const limit = nextFull ? Number(nextFull.v) : Infinity;
      const re = ocr
        ? /(^|[\s.,;:!?'"’”\]])((?:[\dilIoOSB]{1,3})(?: [\dilI]{1,2})?)(?:\*|\.)\s+(?=[A-Z‘“"'(])/g
        : /(^|[\s.,;:!?'"’”\]])(\d{1,3})(?:\s+\2)?(?:\*| ?[a-d]\.|\.)?\s+(?=[A-Z‘“"'(])/g;
      for (const m of x.t.matchAll(re)) {
        let n = Number(m[2]);
        let skip = 0; // characters of the token left in the verse ("I 42*": the "I" is a misread "!")
        if (ocr) {
          // The scan often drops leading digits ("8." for 18): take the first empty verse slot after this
          // one whose number ends with what was read. Try the whole token, then only its last part.
          const parts = m[2].includes(" ") ? [m[2], m[2].split(" ").pop()!] : [m[2]];
          let found = false;
          for (const tok of parts) {
            const d = ocrNum(tok);
            if (!/^\d+$/.test(d)) continue;
            const slot = c.verses.find((y) => Number(y.v) > cur && Number(y.v) < limit && !y.t.trim() && y.v.endsWith(d));
            const gap = !slot && Number(d) > cur && Number(d) < limit && !have.has(Number(d));
            if (!slot && !gap) continue;
            n = slot ? Number(slot.v) : Number(d);
            skip = m[2].length - tok.length;
            found = true;
            break;
          }
          if (!found) continue;
        }
        if (n <= cur || n >= limit) continue;
        const there = have.get(n);
        if (there && there.t.trim()) continue;
        const at = m.index! + m[1].length + skip;
        if (!x.t.slice(0, at).trim()) continue; // a number opening the verse: leave it (and the verse) be
        const tail = x.t.slice(m.index! + m[0].length).trim();
        if (!tail) continue;
        x.t = x.t.slice(0, at).trim();
        // The verse no longer runs on into verse n ("to"), and verse n is no longer a "see the verse before".
        if (x.to !== undefined && Number(x.to) >= n) {
          if (n - 1 > cur) x.to = String(n - 1);
          else delete x.to;
        }
        if (there) {
          there.t = tail;
          delete there.cont;
        }
        else c.verses.push({ v: String(n), t: tail });
        c.verses.sort((a, b) => Number(a.v) - Number(b.v));
        bump(rule);
        moved = true;
        break;
      }
    }
  }
}

/* ---------- rules ---------- */
const OCR_EN: [RegExp, string][] = [
  [/(?<!\p{L})aud(?!\p{L})/gu, "and"],
  [/(?<!\p{L})tbou(?!\p{L})/gu, "thou"],
  [/(?<!\p{L})thon(?!\p{L})/gu, "thou"],
  [/(?<!\p{L})ihe(?!\p{L})/gu, "the"],
  [/(?<!\p{L})tbe(?!\p{L})/gu, "the"],
  [/(?<!\p{L})tlie(?!\p{L})/gu, "the"],
  [/(?<!\p{L})tbat(?!\p{L})/gu, "that"],
  [/(?<!\p{L})witli(?!\p{L})/gu, "with"],
  [/(?<!\p{L})bim(?!\p{L})/gu, "him"],
  [/(?<!\p{L})liis(?!\p{L})/gu, "his"],
];
const VEDAS_OCR: [string, string][] = [
  ["Sadya1 kri", "Sadyaḥkrī"], ["Pis5chas", "Piśāchas"], ["Pavam5na", "Pavamāna"], ["Arā4aki", "Arāṭakī"], ["v4here", "where"],
  ["f6r", "for"], ["3trength", "strength"], ["we.1grown", "well-grown"], ["Varuni3", "Varuṇa"], ["guar4", "guard"], ["f1ed", "fled"],
  ["Se1f-luminous", "Self-luminous"], ["4magic", "magic"], ["Marut3'", "Maruts'"], ["1ndu", "Indu"], ["All-d6ties", "All-Deities"],
  ["accorcl", "accord"], ["5atakratu", "Śatakratu"],
];

/** Pickthall, the surahs from the 1930 scan: the book's running heads and footnotes got into the verses. */
function pickthall(t: string) {
  const R = "pickthall: page header / footnote";
  // A footnote line just before the page header ("i.e. the Jewish Scripture.", "* See XXII, 47, …").
  t = sub(R, t, /\s+(?:i\.e\.[^.()]{2,90}\.|[*i]\s+(?:See\s+)?[IVXLCH]{2,8}[,.][^()]{0,80}?\d\.)(?=\s+(?:[A-Za-z]{1,2}\s+)*[\dizoS]{2,3}\s+-?\s*THE GLORIOUS)/g, "");
  t = sub(R, t, /\s*(?:\b(?:[A-Z]{1,2}|[a-z])\s+)*(?:\b[\dizoIlSn]{2,3}\b,?\s*)*(?:-\s*)?THE GLORIOUS KORAN\s*-?\s*S\W?[UIT]?J?R?AH\b(?:\s+(?:x{1,4}[ivxlmu]{0,4}|i[vx]|vm)\b)?(?:\s*'"-)?/g, " ");
  t = sub(R, t, /\s*SURAH\s?[XVILC]{2,}\s+[A-Z][A-Z ]+\d{3}\b/g, " ");
  t = sub(R, t, /\s*\b[*i]\s+(?:See\s+)?(?:[IVXLCH]{2,8},\s?[\d\-]+[;,]?\s?(?:and\s+)?){1,6}\.?(?=\s|$)/g, "");
  t = sub(R, t, /\s*\bV\.\s+(?:[IVXLC]{2,8},\s?\d+,?\s?(?:and\s+)?){1,6}\./g, "");
  t = sub(R, t, /\s*\bi\s+See\s+Stir\.[^.]*\.\s*[^.]*footnote\./g, "");
  t = sub("pickthall: Lol → Lo!", t, /\bLol\b/g, "Lo!");
  t = sub("pickthall: misread apostrophe (husbands* sons)", t, /(?<=[a-z]s)\*(?= [a-z])/g, "'");
  t = sub("pickthall: stray asterisk", t, /(?<!\d)\/?\*(?=['"\s,.]|$)/g, "");
  t = mendHyphen("pickthall: word broken at a line end", t);
  return t;
}

function fixVerse(key: string, lang: string, x: Verse, file: string) {
  let t = x.t;
  const work = key.split("/")[0];
  const exact = SCRIPTURE_EXACT.has(work) || key === "quran/tanzil";

  if (!exact) {
    // Printed page numbers and leftover markup.
    t = sub("page number [p. 14]", t, /\s*\[p\. ?[\dlxvic]+\]/g, "");
    t = sub("markup <i>…</i>", t, /<\/?i>/g, "");
    t = sub("markup <page …>", t, /<page ([\w]+)>/g, "page $1");
    t = sub("markup (<…>)", t, /\(<([^<>]+)>\)/g, "($1)");
  }
  if (lang === "en" && !exact) {
    for (const [re, to] of OCR_EN) t = sub("OCR slip (aud → and, tbou → thou…)", t, re, to);
    t = sub("doubled small word (the the)", t, /\b(the|and|has|which|who|not)\s+\1\b/gi, "$1");
    t = sub("space before punctuation", t, /(\w) ([,;:!?])(?=\s+["'“‘(]?[A-Za-z]|$)/g, "$1$2");
    t = sub("space before full stop", t, /(\w) \.(?=\s+[A-Z“"‘']|$)/g, "$1.");
  }

  switch (key) {
    case "kojiki/chamberlain":
      t = sub("kojiki: note mark [*2a]", t, /\s?\[\*\d+[a-z]?\]/g, "");
      break;
    case "odyssey/butler-od":
      t = sub("odyssey: note number on a word (Temesa4)", t, /(?<=[a-z’'])\d{1,2}(?=[\s,.;:!?’”)]|$)/g, "");
      break;
    case "imitation/benham":
    case "varieties/james":
      t = sub("note number (1) after a word", t, /(?<=[\w.,;:!?’”"'])\(\d{1,2}\)/g, "");
      break;
    case "jaina/jacobi":
      t = sub("jacobi: sentence number (12)", t, /(?<=[.!?:;)'’"”])\s\([il]?\d{1,3}\)(?=\s+[A-Z]|\s*$)/g, "");
      t = sub("jacobi: section section → sections", t, /\bsection section\b/g, "sections");
      t = sub("jacobi: section8 → section 8", t, /\bsection(\d)/g, "section $1");
      break;
    case "ramayana/griffith-ry":
      t = sub("ramayana: * standing for s'", t, /Kauá\*ikí/g, "Kaus'ikí");
      t = sub("ramayana: note mark * on a word", t, /(?<=[,;])\*(?=\p{L})/gu, " ");
      t = sub("ramayana: note mark * on a word", t, /(?<=\p{L}[^\s*]{0,2})\*/gu, "");
      t = sub("ramayana: note mark * on a word", t, /\*Tis\b/g, "'Tis");
      t = sub("ramayana: note mark * on a word", t, /(^|\s)\*(?=[A-Z])/g, "$1");
      t = sub("note number after punctuation", t, /([.,;:!?'’”"])\s+[1-9]\s+(?=[A-Z])/g, "$1 ");
      break;
    case "mahabharata/ganguli":
      t = sub("note number after punctuation", t, /([.,;:!?'’”"])\s+[1-9]\s+(?=[A-Z])/g, "$1 ");
      t = mendHyphen("word broken at a line end", t);
      break;
    case "vedas/griffith":
      for (const [a, b] of VEDAS_OCR) {
        if (!t.includes(a)) continue;
        t = t.split(a).join(b);
        bump("vedas: OCR digits in words");
      }
      t = mendHyphen("word broken at a line end", t);
      break;
    case "quran/pickthall":
      t = pickthall(t);
      break;
    case "bible/kjv":
      if (file.endsWith(`1ma${path.sep}5.json`) && x.v === "35") t = sub("kjv: and and", t, /\band and\b/, "and");
      break;
    case "mishnah/kulp":
    case "analects/legge-an":
    case "the-crowd/le-bon":
    case "talmud/davidson":
    case "talmud/cohen":
    case "montaigne/cotton":
    case "upanishads/muller":
    case "ggs/khalsa":
      t = mendHyphen("word broken at a line end", t);
      break;
  }
  if (t !== x.t) {
    t = t.replace(/\s{2,}/g, " ").trim();
    x.t = t;
    return true;
  }
  return false;
}

/** Footnotes the rules can't tell from the text, removed by hand: [surah, verse, text, replacement]. */
const PICKTHALL_HAND: [number, string, string, string][] = [
  [10, "3", " See XXII, 47, XXXII, 5, and LXX, 4.", ""],
  [15, "99", " i.e. death.", ""],
  [16, "103", " i.e. Gabriel. An Muslimin.", ""],
  [24, "4", " 358 THE GLORIOUS KORAN SI>RAH", ""],
  [24, "4", "testimony They indeed", "testimony. They indeed"],
  [25, "53", "two seas J (though", "two seas (though"],
  [25, "53", " i.e. the two kinds of water in the earth.", ""],
  [29, "47", " i.e. the people of Mecca.", ""],
  [30, "29", "Nav, but", "Nay, but"],
  [30, "29", " i.e. the slaves.", ""],
  [32, "30", " i.e. punishment in this world.", ""],
  [6, "70", " i.e. angels. The same word nmil is used for angels and for prophets.", ""],
  [6, "93", " i.e. Mecca.", ""],
  [8, "44", " i.e. for the State, to be used for the common weal.", ""],
  [23, "41", "wrongdoing folk I", "wrongdoing folk!"],
];

const SPLIT = new Set(["enoch/charles", "quran/pickthall", "vedas/griffith"]);
let changedFiles = 0;
for (const [key, files] of byKey) {
  const lang = langOf.get(key) ?? "?";
  for (const f of files) {
    const raw = await readFile(f, "utf8");
    const c = JSON.parse(raw) as Chapter;
    if (!Array.isArray(c.verses)) continue;
    let changed = false;
    const wasEmpty = new Set(c.verses.filter((x) => !x.t?.trim()).map((x) => x.v));
    // Clean, split off verse numbers the cleaning uncovered, and clean what was split off; twice, so one run
    // settles everything (a second run changes nothing).
    const before = JSON.stringify(c.verses);
    for (let pass = 0; pass < 3; pass++) {
      for (const x of c.verses) if (typeof x.t === "string") fixVerse(key, lang, x, f);
      if (SPLIT.has(key)) splitMissing(`${key.split("/")[0]}: verse number inside a verse → its own verse`, c, key === "quran/pickthall");
    }
    if (JSON.stringify(c.verses) !== before) changed = true;
    if (key === "quran/pickthall") {
      // The scan's introduction to the next surah, run on after a surah's last verse.
      const last = c.verses[c.verses.length - 1];
      const cut = last?.t.search(/\s+(?:S\S{0,3}RAH\s+[XVLIC]{1,7}\b|[A-Z][\w'-]+(?:\s[\w'-]+)?,\s"[^"]{2,40}["\/']{1,2}\s(?:takes|derives)\s+its\s+name)/);
      if (last && cut > 0) {
        last.t = last.t.slice(0, cut).trim();
        bump("pickthall: next surah's introduction cut from the last verse");
        changed = true;
      }
      // 15:37-39: the scan ran "38* Till an appointed time" into 37, and the import moved 39's text to 38.
      if (c.chapter === 15) {
        const [v37, v38, v39] = ["37", "38", "39"].map((n) => c.verses.find((y) => y.v === n));
        if (v37 && v38 && v39 && v37.t.includes(" 38* Till") && !v39.t.trim()) {
          const [head, tail] = v37.t.split(" 38* ");
          v37.t = head.trim();
          v39.t = v38.t;
          delete v39.cont;
          if (v38.n !== undefined) v39.n = v38.n;
          delete v38.n;
          delete v38.to;
          v38.t = tail.trim();
          bump("pickthall: footnote left in a verse (by hand)");
          changed = true;
        }
      }
      for (const [ch, v, from, to] of PICKTHALL_HAND) {
        if (c.chapter !== ch) continue;
        const x = c.verses.find((y) => y.v === v);
        if (x && x.t.includes(from)) {
          x.t = x.t.split(from).join(to).replace(/\s{2,}/g, " ").trim();
          bump("pickthall: footnote left in a verse (by hand)");
          changed = true;
        }
      }
    }
    if (key === "enoch/charles") {
      // Sub-verse labels ("14 a.", "b."), now that the split has used them to find missing verses.
      for (const x of c.verses) {
        const t0 = x.t;
        x.t = sub("enoch: sub-verse label (14 a., b.)", x.t, /(^|\s)\d{1,3} ?[a-f]\.\s+(?=[A-Z])/g, "$1");
        x.t = sub("enoch: sub-verse label (14 a., b.)", x.t, /(^|[,.;:!?'"’]\s+)[b-f]\.\s+(?=[A-Z])/g, "$1").replace(/\s{2,}/g, " ").trim();
        if (x.t !== t0) changed = true;
      }
      // "[" left at the end of a verse belongs to the start of the next one.
      c.verses.forEach((x, i) => {
        const n = c.verses[i + 1];
        if (n && /\s\[$/.test(x.t)) {
          x.t = x.t.replace(/\s\[$/, "");
          n.t = `[${n.t}`;
          bump("enoch: [ moved to the verse it opens");
          changed = true;
        }
      });
    }
    // A verse that held only a page number or a note mark (now empty) goes; ones empty in the source stay.
    const kept = c.verses.filter((x) => typeof x.t !== "string" || x.t.trim() || wasEmpty.has(x.v));
    if (kept.length !== c.verses.length && kept.length) {
      bump("verse that held only a page number / mark, removed", c.verses.length - kept.length);
      c.verses = kept;
      changed = true;
    }
    if (!changed) continue;
    changedFiles++;
    if (DRY) continue;
    const { verses, ...head } = c;
    const top = JSON.stringify(head).slice(0, -1);
    await writeFile(f, `${top},"verses":[\n${verses.map((v) => JSON.stringify(v)).join(",\n")}\n]}\n`);
  }
}
for (const [r, n] of [...counts].sort()) console.log(`${String(n).padStart(6)}  ${r}`);
console.log(`${changedFiles} chapter files ${DRY ? "would change" : "changed"}`);
