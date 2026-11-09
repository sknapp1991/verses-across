/**
 * Letter by letter: the name and sound of each letter of a Russian, Greek, Hebrew or Arabic word, and what
 * its small marks mean (Hebrew and Arabic vowel points, Greek accents and breathings, the Russian stress
 * mark). For the "letters" panel on word cards (src/components/word-study.tsx). A learner's guide: sounds are
 * approximate English equivalents (Greek as in the traditional teaching of Ancient Greek; Hebrew as in
 * modern Israeli reading; Arabic as in Modern Standard Arabic).
 */

type Letter = { name: string; sound: string };
type Mark = { name: string; says: string };

/* ---------- Russian ---------- */
const RU: Record<string, Letter> = {
  а: { name: "a", sound: "a as in father" },
  б: { name: "be", sound: "b" },
  в: { name: "ve", sound: "v" },
  г: { name: "ge", sound: "g as in go" },
  д: { name: "de", sound: "d" },
  е: { name: "ye", sound: "ye as in yes (e after a consonant)" },
  ё: { name: "yo", sound: "yo as in yonder (always stressed)" },
  ж: { name: "zhe", sound: "zh, like the s in measure" },
  з: { name: "ze", sound: "z" },
  и: { name: "i", sound: "ee as in see" },
  й: { name: "i kratkoye (short i)", sound: "y as in boy" },
  к: { name: "ka", sound: "k" },
  л: { name: "el", sound: "l" },
  м: { name: "em", sound: "m" },
  н: { name: "en", sound: "n" },
  о: { name: "o", sound: "o as in more (unstressed: closer to a)" },
  п: { name: "pe", sound: "p" },
  р: { name: "er", sound: "r, rolled" },
  с: { name: "es", sound: "s" },
  т: { name: "te", sound: "t" },
  у: { name: "u", sound: "oo as in food" },
  ф: { name: "ef", sound: "f" },
  х: { name: "kha", sound: "kh, like ch in Scottish loch" },
  ц: { name: "tse", sound: "ts as in cats" },
  ч: { name: "che", sound: "ch as in church" },
  ш: { name: "sha", sound: "sh" },
  щ: { name: "shcha", sound: "a long, soft sh (shsh)" },
  ъ: { name: "tvyordy znak (hard sign)", sound: "no sound: keeps the letters before and after it apart (in the old Synodal spelling it also ends many words, silently)" },
  ы: { name: "y", sound: "a deep i, said with the tongue pulled back" },
  ь: { name: "myagky znak (soft sign)", sound: "no sound: makes the consonant before it soft (a light y-glide)" },
  э: { name: "e", sound: "e as in met" },
  ю: { name: "yu", sound: "yu as in you" },
  я: { name: "ya", sound: "ya as in yard" },
  // older spellings in the 1876 Synodal text
  і: { name: "i (old spelling)", sound: "ee; written before vowels before 1918, now и" },
  ѣ: { name: "yat (old spelling)", sound: "ye; replaced by е in 1918" },
  ѳ: { name: "fita (old spelling)", sound: "f; replaced by ф in 1918" },
  ѵ: { name: "izhitsa (old spelling)", sound: "ee; used in a few Greek words" },
};

/* ---------- Greek ---------- */
const EL: Record<string, Letter> = {
  α: { name: "alpha", sound: "a as in father" },
  β: { name: "beta", sound: "b" },
  γ: { name: "gamma", sound: "g as in go (ng before γ, κ, ξ, χ)" },
  δ: { name: "delta", sound: "d" },
  ε: { name: "epsilon", sound: "e as in met (short)" },
  ζ: { name: "zeta", sound: "zd (or dz)" },
  η: { name: "eta", sound: "ē, long e as in they" },
  θ: { name: "theta", sound: "th as in thin" },
  ι: { name: "iota", sound: "i as in machine" },
  κ: { name: "kappa", sound: "k" },
  λ: { name: "lambda", sound: "l" },
  μ: { name: "mu", sound: "m" },
  ν: { name: "nu", sound: "n" },
  ξ: { name: "xi", sound: "ks as in box" },
  ο: { name: "omicron", sound: "o as in hot (short)" },
  π: { name: "pi", sound: "p" },
  ρ: { name: "rho", sound: "r" },
  σ: { name: "sigma", sound: "s" },
  ς: { name: "sigma (at the end of a word)", sound: "s" },
  τ: { name: "tau", sound: "t" },
  υ: { name: "upsilon", sound: "u, like French u or German ü" },
  φ: { name: "phi", sound: "ph, f" },
  χ: { name: "chi", sound: "ch as in Scottish loch" },
  ψ: { name: "psi", sound: "ps as in lips" },
  ω: { name: "omega", sound: "ō, long o as in bone" },
  ϲ: { name: "lunate sigma", sound: "s (an old way of writing σ)" },
};
const EL_MARKS: Record<string, Mark> = {
  "̓": { name: "smooth breathing", says: "no h sound before this vowel" },
  "̔": { name: "rough breathing", says: "an h sound before this vowel (rho: rh)" },
  "́": { name: "acute accent", says: "the word's stress (originally a rising pitch) is here" },
  "̀": { name: "grave accent", says: "an acute on a last syllable, lowered because another word follows" },
  "͂": { name: "circumflex", says: "stress with a rise-and-fall pitch, on a long vowel" },
  "ͅ": { name: "iota subscript", says: "a silent i written under the vowel (once said, ai / ēi / ōi)" },
  "̈": { name: "diaeresis", says: "say this vowel separately, not as part of a diphthong" },
  "̄": { name: "macron", says: "a long vowel" },
  "̆": { name: "breve", says: "a short vowel" },
};

/* ---------- Hebrew ---------- */
const HE: Record<string, Letter> = {
  א: { name: "alef", sound: "silent; carries a vowel" },
  ב: { name: "bet / vet", sound: "b with a dot inside, v without" },
  ג: { name: "gimel", sound: "g as in go" },
  ד: { name: "dalet", sound: "d" },
  ה: { name: "he", sound: "h (often silent at the end of a word)" },
  ו: { name: "vav", sound: "v; or the vowel o (וֹ) or u (וּ)" },
  ז: { name: "zayin", sound: "z" },
  ח: { name: "chet", sound: "ch as in Scottish loch" },
  ט: { name: "tet", sound: "t" },
  י: { name: "yod", sound: "y; or part of the vowel i / e" },
  כ: { name: "kaf / khaf", sound: "k with a dot inside, kh (as in loch) without" },
  ך: { name: "final kaf", sound: "kh (k with a dot); the form at the end of a word" },
  ל: { name: "lamed", sound: "l" },
  מ: { name: "mem", sound: "m" },
  ם: { name: "final mem", sound: "m; the form at the end of a word" },
  נ: { name: "nun", sound: "n" },
  ן: { name: "final nun", sound: "n; the form at the end of a word" },
  ס: { name: "samekh", sound: "s" },
  ע: { name: "ayin", sound: "silent today (once a sound made deep in the throat); carries a vowel" },
  פ: { name: "pe / fe", sound: "p with a dot inside, f without" },
  ף: { name: "final pe", sound: "f; the form at the end of a word" },
  צ: { name: "tsadi", sound: "ts as in cats" },
  ץ: { name: "final tsadi", sound: "ts; the form at the end of a word" },
  ק: { name: "qof", sound: "k (once said further back in the throat)" },
  ר: { name: "resh", sound: "r" },
  ש: { name: "shin / sin", sound: "sh with a dot on the right, s with a dot on the left" },
  ת: { name: "tav", sound: "t" },
};
const HE_MARKS: Record<string, Mark> = {
  "ְ": { name: "sheva", says: "a very short e, or no vowel at all" },
  "ֱ": { name: "hataf segol", says: "a very short e" },
  "ֲ": { name: "hataf patah", says: "a very short a" },
  "ֳ": { name: "hataf qamats", says: "a very short o" },
  "ִ": { name: "hiriq", says: "i as in machine" },
  "ֵ": { name: "tsere", says: "e as in they" },
  "ֶ": { name: "segol", says: "e as in met" },
  "ַ": { name: "patah", says: "a as in father" },
  "ָ": { name: "qamats", says: "a as in father (sometimes o)" },
  "ֹ": { name: "holam", says: "o as in bone" },
  "ֺ": { name: "holam haser for vav", says: "the vav here is the consonant v, followed by o" },
  "ֻ": { name: "qubuts", says: "u as in rule" },
  "ּ": { name: "dagesh", says: "a dot inside: b / k / p are hard (not v / kh / f), or the letter is doubled; in vav, often the vowel u; in a final he, the h is said (mappiq)" },
  "ֽ": { name: "meteg", says: "a secondary stress, or a long vowel" },
  "ֿ": { name: "rafe", says: "the letter is soft (v / kh / f)" },
  "ׁ": { name: "shin dot", says: "say sh" },
  "ׂ": { name: "sin dot", says: "say s" },
  "ׇ": { name: "qamats qatan", says: "a short o" },
};
// cantillation marks (the chant of the synagogue reading, U+0591–U+05AF): one note for all
const isHeCantillation = (c: string) => c >= "֑" && c <= "֯";

/* ---------- Arabic ---------- */
const AR: Record<string, Letter> = {
  ا: { name: "alif", sound: "a long a, or a seat for hamza" },
  أ: { name: "alif with hamza above", sound: "a glottal stop, then a or u" },
  إ: { name: "alif with hamza below", sound: "a glottal stop, then i" },
  آ: { name: "alif madda", sound: "a glottal stop and a long ā" },
  ٱ: { name: "alif wasla", sound: "silent: the vowel of the word before carries on" },
  ء: { name: "hamza", sound: "a glottal stop, the catch in uh-oh" },
  ب: { name: "bā'", sound: "b" },
  ت: { name: "tā'", sound: "t" },
  ث: { name: "thā'", sound: "th as in thin" },
  ج: { name: "jīm", sound: "j as in jam" },
  ح: { name: "ḥā'", sound: "a strong breathy h from deep in the throat" },
  خ: { name: "khā'", sound: "kh, like ch in Scottish loch" },
  د: { name: "dāl", sound: "d" },
  ذ: { name: "dhāl", sound: "th as in this" },
  ر: { name: "rā'", sound: "r, rolled" },
  ز: { name: "zāy", sound: "z" },
  س: { name: "sīn", sound: "s" },
  ش: { name: "shīn", sound: "sh" },
  ص: { name: "ṣād", sound: "a heavy s, said with the tongue low" },
  ض: { name: "ḍād", sound: "a heavy d" },
  ط: { name: "ṭā'", sound: "a heavy t" },
  ظ: { name: "ẓā'", sound: "a heavy th (as in this)" },
  ع: { name: "'ayn", sound: "a sound squeezed from the throat; no English equivalent" },
  غ: { name: "ghayn", sound: "gh, like a French r" },
  ف: { name: "fā'", sound: "f" },
  ق: { name: "qāf", sound: "k said far back in the throat" },
  ك: { name: "kāf", sound: "k" },
  ل: { name: "lām", sound: "l" },
  م: { name: "mīm", sound: "m" },
  ن: { name: "nūn", sound: "n" },
  ه: { name: "hā'", sound: "h" },
  و: { name: "wāw", sound: "w; or a long ū" },
  ي: { name: "yā'", sound: "y; or a long ī" },
  ى: { name: "alif maqṣūra", sound: "a long ā at the end of a word (written like yā' without dots)" },
  ة: { name: "tā' marbūṭa", sound: "a (or at, when another word follows): marks many feminine words" },
  ؤ: { name: "hamza on wāw", sound: "a glottal stop" },
  ئ: { name: "hamza on yā'", sound: "a glottal stop" },
  پ: { name: "pe (Persian)", sound: "p" },
  چ: { name: "che (Persian)", sound: "ch" },
  گ: { name: "gāf (Persian)", sound: "g" },
  ژ: { name: "zhe (Persian)", sound: "zh" },
  ی: { name: "ye (Persian)", sound: "y, or a long ī" },
  ک: { name: "kāf (Persian)", sound: "k" },
};
const AR_MARKS: Record<string, Mark> = {
  "َ": { name: "fatḥa", says: "the short vowel a" },
  "ِ": { name: "kasra", says: "the short vowel i" },
  "ُ": { name: "ḍamma", says: "the short vowel u" },
  "ْ": { name: "sukūn", says: "no vowel after this letter" },
  "ّ": { name: "shadda", says: "the letter is doubled (said twice as long)" },
  "ً": { name: "tanwīn fatḥ", says: "-an at the end of a word" },
  "ٍ": { name: "tanwīn kasr", says: "-in at the end of a word" },
  "ٌ": { name: "tanwīn ḍamm", says: "-un at the end of a word" },
  "ٰ": { name: "dagger alif", says: "a long ā not written as a full letter" },
  "ٓ": { name: "madda", says: "a long vowel after a glottal stop" },
  "ٔ": { name: "hamza above", says: "a glottal stop" },
  "ٕ": { name: "hamza below", says: "a glottal stop" },
};
const isArQuranic = (c: string) => (c >= "ۖ" && c <= "ۭ") || (c >= "ؐ" && c <= "ؚ");

export const LETTER_LANGS = new Set(["ru", "el", "he", "ar"]);
export const ALPHABET_NAME: Record<string, string> = { ru: "Cyrillic", el: "Greek", he: "Hebrew", ar: "Arabic" };

export type LetterInfo = { char: string; base: string; name: string; sound: string; marks: Mark[] };

/** A word, letter by letter: each base letter with the marks written on it. Null when the language has no table. */
export function lettersOf(word: string, lang: string): LetterInfo[] | null {
  if (!LETTER_LANGS.has(lang)) return null;
  const table = lang === "ru" ? RU : lang === "el" ? EL : lang === "he" ? HE : AR;
  const markTable: Record<string, Mark> = lang === "el" ? EL_MARKS : lang === "he" ? HE_MARKS : lang === "ar" ? AR_MARKS : {};
  // Composed first (й and ё typed as и/е + a mark become one letter again; Hebrew presentation forms too).
  // Greek letters with accents are then taken apart (ά → α + acute); Russian й/ё and Arabic letters stay whole
  // (أ is a letter of its own, not alif + a mark).
  const keepWhole = (c: string) => (lang === "ru" && /[ёЁйЙ]/.test(c)) || lang === "ar";
  const chars = [...word.normalize("NFC")].flatMap((c) => (keepWhole(c) ? [c] : [...c.normalize("NFD")]));
  const out: LetterInfo[] = [];
  for (const c of chars) {
    const isMark = /\p{M}/u.test(c);
    if (isMark) {
      const last = out[out.length - 1];
      if (!last) continue;
      last.char += c;
      let m: Mark | undefined = markTable[c];
      if (!m && lang === "ru" && c === "́") m = { name: "stress mark", says: "stress this syllable (written only in dictionaries and learners' texts)" };
      if (!m && lang === "he" && isHeCantillation(c)) m = { name: "cantillation mark", says: "a note of the chant used when the text is read aloud in the synagogue; it also marks the stressed syllable" };
      if (!m && lang === "ar" && isArQuranic(c)) m = { name: "Quranic reading mark", says: "a pause or recitation sign used in the Quran" };
      if (!m && lang === "ar") m = { name: "extra mark", says: "a less common vowel or reading sign" };
      if (m && !last.marks.some((x) => x.name === m!.name)) last.marks.push(m);
      continue;
    }
    // spaces, dashes and punctuation (Greek koronis, Hebrew paseq and maqaf, Arabic comma / semicolon / question
    // mark, the Arabic stretching line, Quranic stop signs) and digits are not letters
    if (/[\s\-־׀׃‐-—,;:.!?··᾽،؛؟ـ۝۞ۥۦ٠-٩۰-۹0-9]/.test(c)) continue;
    const lower = c.toLowerCase();
    const letter = table[lower] ?? table[c];
    const upper = lower !== c;
    out.push({
      char: c,
      base: c,
      name: letter ? (upper ? `${letter.name} (capital)` : letter.name) : "",
      sound: letter?.sound ?? "",
      marks: [],
    });
  }
  // Hebrew letters with two sounds: say which one this is, from its dot (only when the word is pointed).
  if (lang === "he" && /[ְ-ּׁׂ]/.test(word)) {
    const VOWEL = /[ְ-ָׇֻ]/; // a vowel point other than holam
    for (const x of out) {
      const has = (c: string) => x.char.includes(c);
      const set = (name: string, sound: string) => ((x.name = name), (x.sound = sound));
      if (x.base === "ש" && has("ׁ")) set("shin", "sh");
      else if (x.base === "ש" && has("ׂ")) set("sin", "s");
      else if (x.base === "ב") {
        if (has("ּ")) set("bet", "b");
        else set("vet", "v");
      } else if (x.base === "כ" || x.base === "ך") {
        const fin = x.base === "ך" ? "final " : "";
        if (has("ּ")) set(fin + "kaf", "k");
        else set(fin + "khaf", "kh, like ch in Scottish loch");
      } else if (x.base === "פ") {
        if (has("ּ")) set("pe", "p");
        else set("fe", "f");
      } else if (x.base === "ה" && has("ּ")) set("he (with mappiq)", "h, said even at the end of the word");
      else if (x.base === "ו" && has("ּ") && !VOWEL.test(x.char) && !has("ֹ")) set("vav (as the vowel u, shuruk)", "u as in rule");
      else if (x.base === "ו" && has("ּ")) set("vav (doubled)", "vv");
      else if (x.base === "ו" && has("ֹ") && !VOWEL.test(x.char)) set("vav (usually the vowel o)", "o as in bone (or v + o after a vowel-less letter)");
    }
  }
  return out.map((x) => ({ ...x, char: x.char.normalize("NFC") }));
}
