/**
 * How to say a word written in Russian, Greek, Hebrew or Arabic, in Latin letters ("любо́вь" → "lyubóv",
 * "ἀγάπη" → "agápē", "שָׁלוֹם" → "shalom", "سَلَام" → "salām"). A simple reading guide, not a scholarly
 * transliteration. Hebrew and Arabic need their vowel marks: a word written without them gives null
 * (the vowels can't be known). The stress marks in the Russian and Greek words are kept on the vowel.
 */

const ACUTE = "́";
const isMark = (c: string) => /\p{M}/u.test(c);
const capital = (out: string, upper: boolean) => (upper && out ? out[0].toUpperCase() + out.slice(1) : out);

/** Transliterate `text` (one or more words) in `lang`; null when the language isn't covered or a word can't be read. */
export function translit(text: string, lang: string): string | null {
  const f = lang === "ru" ? ru : lang === "el" ? el : lang === "he" ? he : lang === "ar" ? ar : null;
  if (!f || !text.trim()) return null;
  const words = text.split(/(\s+|[-־‐–—,;:.!?·׃])/);
  let any = false;
  const out = words.map((w) => {
    if (!w || /^[\s\-־‐–—,;:.!?·׃]+$/.test(w)) return w === "־" ? "-" : w;
    const t = f(w);
    if (t === null) return null;
    any = true;
    return t;
  });
  if (!any || out.some((x) => x === null)) return null;
  return out.join("").normalize("NFC");
}

/* ---------- Russian ---------- */
const RU: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya", // older spellings in the Synodal text
  і: "i", ѣ: "e", ѳ: "f", ѵ: "i",
};
const RU_VOWELS = "аеиоуыэюяёіѣ";
function ru(w: string): string | null {
  const s = w.normalize("NFD");
  if (!/[Ѐ-ӿ]/.test(s)) return null;
  let out = "";
  let prev = ""; // previous base letter (lower case)
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (isMark(c)) {
      if (c === ACUTE && out) out += ACUTE; // stress
      continue;
    }
    const lower = c.toLowerCase();
    const next = s[i + 1];
    let t: string | undefined;
    if (lower === "е" && next === "̈") t = "yo"; // ё
    else if (lower === "и" && next === "̆") t = "y"; // й
    else if (lower === "е" && (!prev || RU_VOWELS.includes(prev) || prev === "ъ" || prev === "ь")) t = "ye";
    else t = RU[lower];
    if (t === undefined) t = /\p{L}/u.test(c) ? c : "";
    out += capital(t, c !== lower);
    prev = lower;
  }
  const letters = s.replace(/\p{M}/gu, "");
  return letters.length > 1 && letters === letters.toUpperCase() ? out.toUpperCase() : out;
}

/* ---------- Greek ---------- */
const EL: Record<string, string> = {
  α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "ē", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o",
  π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "ph", χ: "ch", ψ: "ps", ω: "ō", ϝ: "w",
};
const EL_VOWELS = "αεηιουω";
function el(w: string): string | null {
  const s = w.normalize("NFD");
  if (!/[Ͱ-Ͽἀ-῿]/.test(w)) return null;
  // Letters with their marks.
  const units: { b: string; up: boolean; rough: boolean; accent: boolean; split?: boolean }[] = [];
  for (const c of s) {
    if (isMark(c)) {
      const u = units[units.length - 1];
      if (!u) continue;
      if (c === "̔") u.rough = true;
      if (c === "\u0301" || c === "\u0300" || c === "\u0342") u.accent = true;
      if (c === "\u0308") u.split = true; // diaeresis: said apart
      continue;
    }
    const b = c.toLowerCase();
    units.push({ b, up: b !== c, rough: false, accent: false });
  }
  let out = "";
  const rough = units.some((u, i) => u.rough && (i === 0 || (i === 1 && EL_VOWELS.includes(units[0].b))));
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const n = units[i + 1];
    const first = i === 0;
    let t: string;
    let acc = u.accent;
    if (n && !n.split && "αεηου".includes(u.b) && (n.b === "υ" || (n.b === "ι" && u.b !== "η"))) {
      // Diphthongs: αυ ευ ηυ ου, αι ει οι (the accent sits on the second letter).
      t = (u.b === "η" ? "ē" : u.b === "ο" && n.b === "υ" ? "o" : EL[u.b]) + (n.b === "υ" ? "u" : "i");
      acc = acc || n.accent;
      i++;
    } else if (u.b === "γ" && n && "γκξχ".includes(n.b)) t = "n";
    else if (u.b === "ρ" && i === 0 && u.rough) t = "rh";
    else t = EL[u.b] ?? (/\p{L}/u.test(u.b) ? u.b : "");
    if (acc) t += ACUTE;
    if (first) t = capital(t, u.up);
    out += t;
  }
  if (rough && units[0]?.b !== "ρ") out = (units[0]?.up ? "H" : "h") + (units[0]?.up ? out[0].toLowerCase() + out.slice(1) : out);
  return out;
}

/* ---------- Hebrew ---------- */
const HE_VOWEL: Record<string, string> = {
  "ְ": "e", // sheva (said only in some places, see below)
  "ֱ": "e", "ֲ": "a", "ֳ": "o", "ִ": "i", "ֵ": "e", "ֶ": "e", "ַ": "a", "ָ": "a",
  "ֹ": "o", "ֺ": "o", "ֻ": "u", "ׇ": "o",
};
const FINAL: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
function he(w: string): string | null {
  // Drop cantillation, meteg, punctuation; keep vowels, dagesh and the shin/sin dots.
  const s = w.replace(/[֑-ֽֿ֯׀׃-׆]/g, "");
  if (!/[א-ת]/.test(s)) return null;
  if (!/[ְ-ׇּׁׂ]/.test(s)) return null; // no vowel marks: can't be read
  const units: { l: string; marks: string }[] = [];
  for (const c of s) {
    if (c >= "א" && c <= "ת") units.push({ l: c, marks: "" });
    else if (units.length) units[units.length - 1].marks += c;
  }
  let out = "";
  units.forEach(({ l, marks }, i) => {
    const last = i === units.length - 1;
    const base = FINAL[l] ?? l;
    const dagesh = marks.includes("ּ");
    const vMarks = [...marks].filter((m) => HE_VOWEL[m] !== undefined);
    const vMark = vMarks.find((m) => m !== "\u05b9") ?? vMarks[0];
    let v = vMark ? HE_VOWEL[vMark] : "";
    // Sheva is said at the start of a word and under a doubled letter; silent elsewhere.
    if (vMark === "ְ" && !(i === 0 || dagesh)) v = "";
    const prevV = out.slice(-1);
    let c: string;
    switch (base) {
      case "א": case "ע": c = ""; break;
      case "ב": c = dagesh ? "b" : "v"; break;
      case "ג": c = "g"; break;
      case "ד": c = "d"; break;
      case "ה": c = last && !v && !dagesh ? "" : "h"; break;
      case "ו":
        if (marks.includes("\u05b9") && !dagesh && vMarks.length === 1) return void (out += "o"); // holam male
        if (dagesh && !v) return void (out += "u"); // shuruq
        if (last && !marks && units[i - 1]?.l === "י" && !units[i - 1].marks) return void (out += "v"); // "-ָיו": banav
        c = marks.includes("\u05b9") ? "ov" : "v";
        break;
      case "ז": c = "z"; break;
      case "ח": c = "ch"; break;
      case "ט": c = "t"; break;
      case "י": {
        const sufV = units[i + 1]?.l === "ו" && i + 1 === units.length - 1 && !units[i + 1].marks; // "-ָיו": banav
        c = !v && !dagesh && i > 0 && ("ie".includes(prevV) || sufV) ? "" : "y";
        break;
      }
      case "כ": c = dagesh ? "k" : "kh"; break;
      case "ל": c = "l"; break;
      case "מ": c = "m"; break;
      case "נ": c = "n"; break;
      case "ס": c = "s"; break;
      case "פ": c = dagesh ? "p" : "f"; break;
      case "צ": c = "ts"; break;
      case "ק": c = "k"; break;
      case "ר": c = "r"; break;
      case "ש": c = marks.includes("ׂ") ? "s" : "sh"; break;
      case "ת": c = "t"; break;
      default: c = "";
    }
    // A patah under a final ח / ע / ה is said before it ("ruach").
    if (last && vMark === "ַ" && "חעה".includes(base)) out += "a" + (base === "ע" ? "" : c);
    else out += c + v;
  });
  return out;
}

/* ---------- Arabic ---------- */
const AR: Record<string, string> = {
  ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh", د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d",
  ط: "t", ظ: "z", ع: "ʿ", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ء: "ʾ", ؤ: "ʾ", ئ: "ʾ", پ: "p",
};
const AR_MARK: Record<string, string> = { "َ": "a", "ِ": "i", "ُ": "u", "ً": "an", "ٍ": "in", "ٌ": "un", "ٰ": "ā" };
function ar(w: string): string | null {
  const s = w.replace(/[ـۖ-ۭ]/g, ""); // tatweel, Qur'anic marks
  if (!/[ء-ي]/.test(s)) return null;
  if (!/[ً-ْٰ]/.test(s)) return null; // no vowel marks: can't be read
  const units: { l: string; marks: string }[] = [];
  for (const c of s) {
    if (/[ء-يٱپ]/.test(c)) units.push({ l: c, marks: "" });
    else if (units.length) units[units.length - 1].marks += c;
  }
  let out = "";
  let sun = false;
  // "the" (al-) at the start, or after a one-letter prefix: wa-, bi-, fa-, li-, ka-.
  const art = /[اٱ]/.test(units[0]?.l ?? "") && units[1]?.l === "ل" ? 0 : "وبفلك".includes(units[0]?.l ?? "-") && /[اٱ]/.test(units[1]?.l ?? "") && units[2]?.l === "ل" ? 1 : -1;
  units.forEach(({ l, marks }, i) => {
    const vowel = [...marks].map((m) => AR_MARK[m] ?? "").join("");
    const shadda = marks.includes("ّ");
    const prev = out.slice(-1);
    let c: string;
    if (l === "ا" || l === "ٱ") {
      if (i === art) return void (out += art === 0 ? "a" : "-"); // the "al-" of "the"
      if (units[i - 1]?.marks.includes("\u064b")) return; // after -an: kitāban
      if (prev === "a") return void (out = out.slice(0, -1) + "ā");
      c = vowel ? "" : i === 0 ? "a" : "ā";
    } else if (l === "أ") c = vowel ? "" : "a";
    else if (l === "إ") c = vowel ? "" : "i";
    else if (l === "آ") c = "ā";
    else if (l === "ى") {
      if (units[i - 1]?.marks.includes("\u064b")) return; // hudan
      return void (out = prev === "a" ? out.slice(0, -1) + "ā" : out + "ā");
    } else if (l === "ة") return void (out += vowel ? (prev === "a" || prev === "ā" ? "" : "a") + "t" + vowel : prev === "ā" ? "h" : prev === "a" ? "" : "a");
    else if (l === "و" && !vowel && !shadda && prev === "u") return void (out = out.slice(0, -1) + "ū");
    else if (l === "ي" && !vowel && !shadda && prev === "i") return void (out = out.slice(0, -1) + "ī");
    else if (l === "و") c = "w";
    else if (l === "ي") c = "y";
    else c = AR[l] ?? "";
    if (art >= 0 && i === art + 1 && l === "ل" && !vowel) {
      // "the": al-kitāb; before a doubled letter the l is said as that letter (ar-rabb, allāh).
      const n = units[i + 1];
      if (n?.marks.includes("ّ")) {
        if (n.l !== "ل") out += (AR[n.l] ?? "") + "-";
        sun = true;
      } else out += "l-";
      return;
    }
    const double = shadda && !(sun && i === art + 2 && l !== "ل");
    out += (double ? c + c : c) + vowel;
  });
  return out;
}
