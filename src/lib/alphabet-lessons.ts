/**
 * The letter tables for the hidden "Learn the alphabets" page (src/components/learn-alphabets.tsx): Hebrew, Greek and
 * Arabic, a few letters per lesson, each with its name, sound, number value and one real word that uses it.
 *
 * - Sounds are a learner's guide in plain English: Hebrew as read today (modern Israeli, Sephardic style); Greek in the
 *   classroom (Erasmian) pronunciation used to teach New Testament Greek, a reconstruction of the ancient sounds;
 *   Arabic as in Modern Standard Arabic and Quran reading.
 * - Number values are the same as src/lib/letter-values.ts (gematria, isopsephy, eastern abjad); a check script compared
 *   every one.
 * - Example words are copied verbatim from public/texts (Hebrew: the pointed word as the STEP Bible TAHOT gives it in
 *   src/lib/layer-gen1.ts, without the chant marks; Greek: the Textus Receptus, punctuation trimmed; Arabic: Tanzil,
 *   Uthmani script). Their sounds and meanings: Hebrew and Greek from STEP Bible (Tyndale House, CC BY 4.0), lightly
 *   tidied; Arabic written for this page.
 */
export type AlphaId = "hebrew" | "greek" | "arabic";

export type Example = { text: string; say: string; means: string; ref: string };
export type Form = { label: string; ch: string };
export type LessonLetter = {
  ch: string;
  name: string;
  /** what the device voice reads for "Say it" (Hebrew and Greek only): the letter's name spelled in that language */
  voiceName?: string;
  /** the short answer the quiz uses */
  say: string;
  /** a fuller description of the sound */
  sound: string;
  /** sounds this letter can make: two letters sharing one are never both offered as answers */
  tokens: string[];
  value: number;
  forms?: Form[];
  note?: string;
  word: Example;
};
export type Mark = { sample: string; name: string; says: string };

export type Alphabet = {
  id: AlphaId;
  title: string;
  /** the first letters, as a badge */
  badge: string;
  lang: "he" | "el" | "ar";
  rtl: boolean;
  /** which verse of src/lib/layer-verses.ts the course ends with */
  verseId: "gen" | "jhn" | "fatiha";
  voice: boolean;
  intro: string;
  soundNote: string;
  numberNote: string;
  formsNote: string;
  marksTitle: string;
  marksIntro: string;
  marks: Mark[];
  marksNote: string;
  lessons: LessonLetter[][];
};

/* ---------------- Hebrew ---------------- */

const DAGESH = "ּ";
const he = (ch: string, mark: string) => ch + mark;

const HEBREW: Alphabet = {
  id: "hebrew",
  title: "Hebrew",
  badge: "אבג",
  lang: "he",
  rtl: true,
  verseId: "gen",
  voice: true,
  intro: "22 letters, all consonants, read from right to left. Vowels are small dots and dashes added around the letters.",
  soundNote: "Sounds are given as Hebrew is read today (the modern Israeli, Sephardic style). Some letters were said differently in ancient times.",
  numberNote: "Gematria: the first nine letters count 1 to 9, the next nine 10 to 90, the last four 100 to 400. A final form counts the same as its letter.",
  formsNote: "Five letters take a different shape at the end of a word: כ ך, מ ם, נ ן, פ ף, צ ץ.",
  marksTitle: "Vowel points (niqqud)",
  marksIntro:
    "Scrolls are written with letters only. Around 600 to 1000 AD scribes called the Masoretes added small marks so the traditional reading would never be lost. Here they sit on bet (ב):",
  marks: [
    { sample: he("ב", "ַ"), name: "patah", says: "a as in father" },
    { sample: he("ב", "ָ"), name: "qamats", says: "a as in father (sometimes a short o)" },
    { sample: he("ב", "ֶ"), name: "segol", says: "e as in met" },
    { sample: he("ב", "ֵ"), name: "tsere", says: "e as in they" },
    { sample: he("ב", "ִ"), name: "hiriq", says: "i as in machine" },
    { sample: he("ב", "ֹ"), name: "holam", says: "o as in bone" },
    { sample: he("ב", "ֻ"), name: "qubuts", says: "u as in rule" },
    { sample: "ב" + "ו" + DAGESH, name: "shuruk (vav with a dot)", says: "u as in rule" },
    { sample: he("ב", "ְ"), name: "sheva", says: "a very short e, or no vowel at all" },
    { sample: he("ב", DAGESH), name: "dagesh (a dot inside)", says: "b, k, p are hard (not v, kh, f); in other letters it doubles the sound" },
    { sample: "ש" + "ׁ", name: "shin dot (on the right)", says: "sh" },
    { sample: "ש" + "ׂ", name: "sin dot (on the left)", says: "s" },
  ],
  marksNote:
    "Genesis 1:1 as printed here also carries chant marks (cantillation), little signs above and below the words that guide the singing of the reading. You can read straight past them.",
  lessons: [
    [
      { ch: "א", name: "alef", voiceName: "אלף", say: "silent", sound: "silent: it holds a vowel (once a light catch in the throat)", tokens: ["silent"], value: 1, word: { text: "אֱלֹהִים", say: "Elohim", means: "God", ref: "Genesis 1:1" } },
      { ch: "ב", name: "bet / vet", voiceName: "בית", say: "b / v", sound: "b with a dot inside (בּ), v without (ב)", tokens: ["b", "v"], value: 2, word: { text: "בָּרָא", say: "bara", means: "he created", ref: "Genesis 1:1" } },
      { ch: "ג", name: "gimel", voiceName: "גימל", say: "g", sound: "g as in go", tokens: ["g"], value: 3, word: { text: "הַגָּדֹל", say: "hagadol", means: "the great", ref: "Genesis 1:16" } },
      { ch: "ד", name: "dalet", voiceName: "דלת", say: "d", sound: "d", tokens: ["d"], value: 4, word: { text: "אֶחָד", say: "echad", means: "one", ref: "Genesis 1:5" } },
      { ch: "ה", name: "he", voiceName: "הא", say: "h", sound: "h as in hat (usually silent at the end of a word)", tokens: ["h"], value: 5, word: { text: "הָאָרֶץ", say: "ha'aretz", means: "the earth", ref: "Genesis 1:1" } },
      { ch: "ו", name: "vav", voiceName: "וו", say: "v (or o, u)", sound: "v; it also writes the vowels o (וֹ) and u (וּ)", tokens: ["v", "o", "u"], value: 6, note: "At the front of a word, ו often means \"and\".", word: { text: "וְאֵת", say: "ve'et", means: "and (marks the object)", ref: "Genesis 1:1" } },
    ],
    [
      { ch: "ז", name: "zayin", voiceName: "זין", say: "z", sound: "z", tokens: ["z"], value: 7, word: { text: "זֶרַע", say: "zera", means: "seed", ref: "Genesis 1:11" } },
      { ch: "ח", name: "chet", voiceName: "חית", say: "kh", sound: "kh, like the ch in Scottish loch", tokens: ["kh"], value: 8, word: { text: "וְרוּחַ", say: "veruach", means: "and the spirit (of)", ref: "Genesis 1:2" } },
      { ch: "ט", name: "tet", voiceName: "טית", say: "t", sound: "t", tokens: ["t"], value: 9, word: { text: "טוֹב", say: "tov", means: "good", ref: "Genesis 1:4" } },
      { ch: "י", name: "yod", voiceName: "יוד", say: "y", sound: "y as in yes; it also helps write the vowels i and e", tokens: ["y"], value: 10, note: "The smallest letter.", word: { text: "יוֹם", say: "yom", means: "day", ref: "Genesis 1:5" } },
      { ch: "כ", name: "kaf / khaf", voiceName: "כף", say: "k / kh", sound: "k with a dot inside (כּ), kh (as in loch) without", tokens: ["k", "kh"], value: 20, forms: [{ label: "final", ch: "ך" }], word: { text: "כָּנָף", say: "kanaf", means: "wing", ref: "Genesis 1:21" } },
      { ch: "ל", name: "lamed", voiceName: "למד", say: "l", sound: "l", tokens: ["l"], value: 30, note: "The tallest letter.", word: { text: "לָיְלָה", say: "lailah", means: "night", ref: "Genesis 1:5" } },
    ],
    [
      { ch: "מ", name: "mem", voiceName: "מם", say: "m", sound: "m", tokens: ["m"], value: 40, forms: [{ label: "final", ch: "ם" }], word: { text: "הַמָּיִם", say: "hamayim", means: "the waters", ref: "Genesis 1:2" } },
      { ch: "נ", name: "nun", voiceName: "נון", say: "n", sound: "n", tokens: ["n"], value: 50, forms: [{ label: "final", ch: "ן" }], word: { text: "פְּנֵי", say: "penei", means: "the face (of), the surface", ref: "Genesis 1:2" } },
      { ch: "ס", name: "samekh", voiceName: "סמך", say: "s", sound: "s", tokens: ["s"], value: 60, note: "Genesis 1 never uses this letter, so the word comes from the next chapter.", word: { text: "הַסֹּבֵב", say: "hasovev", means: "the one that winds around", ref: "Genesis 2:11" } },
      { ch: "ע", name: "ayin", voiceName: "עין", say: "silent", sound: "silent today: it holds a vowel (once a sound made deep in the throat)", tokens: ["silent"], value: 70, word: { text: "עֶרֶב", say: "erev", means: "evening", ref: "Genesis 1:5" } },
      { ch: "פ", name: "pe / fe", voiceName: "פא", say: "p / f", sound: "p with a dot inside (פּ), f without", tokens: ["p", "f"], value: 80, forms: [{ label: "final", ch: "ף" }], word: { text: "פְּרִי", say: "peri", means: "fruit", ref: "Genesis 1:11" } },
    ],
    [
      { ch: "צ", name: "tsadi", voiceName: "צדי", say: "ts", sound: "ts as in cats", tokens: ["ts"], value: 90, forms: [{ label: "final", ch: "ץ" }], word: { text: "תּוֹצֵא", say: "totze", means: "let it bring out", ref: "Genesis 1:24" } },
      { ch: "ק", name: "qof", voiceName: "קוף", say: "k", sound: "k (once said further back in the throat)", tokens: ["k"], value: 100, word: { text: "בֹקֶר", say: "voker", means: "morning", ref: "Genesis 1:5" } },
      { ch: "ר", name: "resh", voiceName: "ריש", say: "r", sound: "r (today said in the throat, like a French r)", tokens: ["r"], value: 200, word: { text: "בְּרֵאשִׁית", say: "bereshit", means: "in the beginning", ref: "Genesis 1:1" } },
      { ch: "ש", name: "shin / sin", voiceName: "שין", say: "sh / s", sound: "sh with a dot on the right (שׁ), s with a dot on the left (שׂ)", tokens: ["sh", "s"], value: 300, word: { text: "הַשָּׁמַיִם", say: "hashamayim", means: "the heavens", ref: "Genesis 1:1" } },
      { ch: "ת", name: "tav", voiceName: "תו", say: "t", sound: "t", tokens: ["t"], value: 400, note: "The last letter, worth the most.", word: { text: "אֵת", say: "et", means: "(marks the object; not translated)", ref: "Genesis 1:1" } },
    ],
  ],
};

/** Final forms, shown with the letter's lesson and in the reading. */
export const HEBREW_FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/* ---------------- Greek ---------------- */

const GREEK: Alphabet = {
  id: "greek",
  title: "Greek",
  badge: "αβγ",
  lang: "el",
  rtl: false,
  verseId: "jhn",
  voice: true,
  intro: "24 letters, read from left to right, with vowels written as letters. Many shapes will look familiar: our alphabet came from this one.",
  soundNote:
    "Sounds are the classroom (Erasmian) pronunciation used to teach New Testament Greek, a reconstruction of the ancient sounds. Modern Greek says several letters differently, and the device voice speaks modern Greek.",
  numberNote:
    "Isopsephy: alpha to theta count 1 to 9, iota to pi 10 to 80, rho to omega 100 to 800. Three old letters kept only as numbers fill the gaps: stigma ϛ (6), koppa ϙ (90) and sampi ϡ (900).",
  formsNote: "Each letter has a capital. Sigma has two small forms: σ inside a word and ς at the end.",
  marksTitle: "Breathings and accents",
  marksIntro:
    "The earliest New Testament copies are all capitals with no spaces or marks. Later copyists added these small signs, and printed Greek keeps them:",
  marks: [
    { sample: "ἀ", name: "smooth breathing", says: "a vowel that starts a word with no h sound" },
    { sample: "ἁ", name: "rough breathing", says: "an h sound before the vowel (ὁ is ho)" },
    { sample: "ά", name: "acute accent", says: "the stressed syllable" },
    { sample: "ὰ", name: "grave accent", says: "an acute on a last syllable, lowered because another word follows" },
    { sample: "ᾶ", name: "circumflex", says: "stress on a long vowel, once a rise and fall in pitch" },
    { sample: "ᾳ", name: "iota under the letter", says: "a silent i (ἀρχῇ is said archē); it counts as an iota" },
    { sample: "αι", name: "ai", says: "ai as in aisle" },
    { sample: "ει", name: "ei", says: "ei as in eight" },
    { sample: "οι", name: "oi", says: "oi as in oil" },
    { sample: "ου", name: "ou", says: "ou as in soup" },
    { sample: "αυ", name: "au", says: "ow as in now" },
  ],
  marksNote: "Two vowels written together often make one sound (the last five above). In καὶ, say kai.",
  lessons: [
    [
      { ch: "α", name: "alpha", voiceName: "άλφα", say: "a", sound: "a as in father", tokens: ["a"], value: 1, forms: [{ label: "capital", ch: "Α" }], word: { text: "ἀρχῇ", say: "archē", means: "beginning", ref: "John 1:1" } },
      { ch: "β", name: "beta", voiceName: "βήτα", say: "b", sound: "b", tokens: ["b"], value: 2, forms: [{ label: "capital", ch: "Β" }], word: { text: "ἔλαβον", say: "elabon", means: "they received", ref: "John 1:12" } },
      { ch: "γ", name: "gamma", voiceName: "γάμμα", say: "g", sound: "g as in go (ng before γ, κ, ξ, χ)", tokens: ["g"], value: 3, forms: [{ label: "capital", ch: "Γ" }], word: { text: "λόγος", say: "logos", means: "Word", ref: "John 1:1" } },
      { ch: "δ", name: "delta", voiceName: "δέλτα", say: "d", sound: "d", tokens: ["d"], value: 4, forms: [{ label: "capital", ch: "Δ" }], word: { text: "ἔδωκεν", say: "edōken", means: "he gave", ref: "John 1:12" } },
      { ch: "ε", name: "epsilon", voiceName: "έψιλον", say: "e (short)", sound: "e as in met, always short", tokens: ["e (short)"], value: 5, forms: [{ label: "capital", ch: "Ε" }], word: { text: "Ἐν", say: "en", means: "in", ref: "John 1:1" } },
      { ch: "ζ", name: "zeta", voiceName: "ζήτα", say: "zd", sound: "zd as in wisdom (many classes simply say z)", tokens: ["zd", "z"], value: 7, forms: [{ label: "capital", ch: "Ζ" }], note: "Its number is 7, not 6: an old letter for 6, digamma, dropped out of the alphabet, but its place among the numbers was kept (later written with the sign stigma, ϛ).", word: { text: "ζωὴ", say: "zōē", means: "life", ref: "John 1:4" } },
    ],
    [
      { ch: "η", name: "eta", voiceName: "ήτα", say: "ē (long e)", sound: "ē, a long e as in they", tokens: ["ē (long e)"], value: 8, forms: [{ label: "capital", ch: "Η" }], word: { text: "ἦν", say: "ēn", means: "was", ref: "John 1:1" } },
      { ch: "θ", name: "theta", voiceName: "θήτα", say: "th", sound: "th as in thin", tokens: ["th"], value: 9, forms: [{ label: "capital", ch: "Θ" }], word: { text: "Θεόν", say: "theon", means: "God", ref: "John 1:1" } },
      { ch: "ι", name: "iota", voiceName: "γιώτα", say: "i", sound: "i as in machine (short or long)", tokens: ["i"], value: 10, forms: [{ label: "capital", ch: "Ι" }], note: "The smallest letter: Jesus' \"not one jot\" (Matthew 5:18) is an iota.", word: { text: "καὶ", say: "kai", means: "and", ref: "John 1:1" } },
      { ch: "κ", name: "kappa", voiceName: "κάππα", say: "k", sound: "k", tokens: ["k"], value: 20, forms: [{ label: "capital", ch: "Κ" }], word: { text: "κόσμος", say: "kosmos", means: "world", ref: "John 1:10" } },
      { ch: "λ", name: "lambda", voiceName: "λάμδα", say: "l", sound: "l", tokens: ["l"], value: 30, forms: [{ label: "capital", ch: "Λ" }], word: { text: "λόγος", say: "logos", means: "Word", ref: "John 1:1" } },
      { ch: "μ", name: "mu", voiceName: "μι", say: "m", sound: "m", tokens: ["m"], value: 40, forms: [{ label: "capital", ch: "Μ" }], word: { text: "ὄνομα", say: "onoma", means: "name", ref: "John 1:6" } },
    ],
    [
      { ch: "ν", name: "nu", voiceName: "νι", say: "n", sound: "n", tokens: ["n"], value: 50, forms: [{ label: "capital", ch: "Ν" }], note: "Careful: ν looks like our v but says n.", word: { text: "τὸν", say: "ton", means: "the", ref: "John 1:1" } },
      { ch: "ξ", name: "xi", voiceName: "ξι", say: "ks", sound: "x as in box (ks)", tokens: ["ks"], value: 60, forms: [{ label: "capital", ch: "Ξ" }], word: { text: "δόξαν", say: "doxan", means: "glory", ref: "John 1:14" } },
      { ch: "ο", name: "omicron", voiceName: "όμικρον", say: "o (short)", sound: "o as in hot, always short", tokens: ["o (short)"], value: 70, forms: [{ label: "capital", ch: "Ο" }], word: { text: "ὁ", say: "ho", means: "the", ref: "John 1:1" } },
      { ch: "π", name: "pi", voiceName: "πι", say: "p", sound: "p", tokens: ["p"], value: 80, forms: [{ label: "capital", ch: "Π" }], word: { text: "Πάντα", say: "panta", means: "all things", ref: "John 1:3" } },
      { ch: "ρ", name: "rho", voiceName: "ρο", say: "r", sound: "r, lightly rolled (rh at the start of a word)", tokens: ["r"], value: 100, forms: [{ label: "capital", ch: "Ρ" }], note: "Careful: ρ looks like our p but says r.", word: { text: "πρὸς", say: "pros", means: "with (toward)", ref: "John 1:1" } },
      { ch: "σ", name: "sigma", voiceName: "σίγμα", say: "s", sound: "s", tokens: ["s"], value: 200, forms: [{ label: "capital", ch: "Σ" }, { label: "at the end of a word", ch: "ς" }], word: { text: "σκοτίᾳ", say: "skotia", means: "darkness", ref: "John 1:5" } },
    ],
    [
      { ch: "τ", name: "tau", voiceName: "ταυ", say: "t", sound: "t", tokens: ["t"], value: 300, forms: [{ label: "capital", ch: "Τ" }], word: { text: "τὸν", say: "ton", means: "the", ref: "John 1:1" } },
      { ch: "υ", name: "upsilon", voiceName: "ύψιλον", say: "ü", sound: "ü, like German über or French tu (many classes say oo); in ου and αυ it is part of the pair", tokens: ["ü"], value: 400, forms: [{ label: "capital", ch: "Υ" }], word: { text: "ὕδατι", say: "hudati", means: "(with) water", ref: "John 1:26" } },
      { ch: "φ", name: "phi", voiceName: "φι", say: "ph (f)", sound: "ph, said f in most classes", tokens: ["ph (f)"], value: 500, forms: [{ label: "capital", ch: "Φ" }], word: { text: "φῶς", say: "phōs", means: "light", ref: "John 1:4" } },
      { ch: "χ", name: "chi", voiceName: "χι", say: "kh", sound: "kh, like the ch in Scottish loch", tokens: ["kh"], value: 600, forms: [{ label: "capital", ch: "Χ" }], note: "Careful: χ looks like our x but says kh.", word: { text: "χάριτος", say: "charitos", means: "of grace", ref: "John 1:14" } },
      { ch: "ψ", name: "psi", voiceName: "ψι", say: "ps", sound: "ps as in lips", tokens: ["ps"], value: 700, forms: [{ label: "capital", ch: "Ψ" }], word: { text: "πέμψας", say: "pempsas", means: "the one who sent", ref: "John 1:33" } },
      { ch: "ω", name: "omega", voiceName: "ωμέγα", say: "ō (long o)", sound: "ō, a long o as in bone", tokens: ["ō (long o)"], value: 800, forms: [{ label: "capital", ch: "Ω" }], note: "The last letter: \"I am the Alpha and the Omega\" (Revelation 1:8).", word: { text: "Ἰωάννης", say: "Iōannēs", means: "John", ref: "John 1:6" } },
    ],
  ],
};

/* ---------------- Arabic ---------------- */

const ZWJ = "‍";
/** A letter's four shapes, made by the font: joined on the left (initial), both sides (medial), the right (final). */
const joins = (ch: string): Form[] => [
  { label: "alone", ch },
  { label: "start", ch: ch + ZWJ },
  { label: "middle", ch: ZWJ + ch + ZWJ },
  { label: "end", ch: ZWJ + ch },
];
/** The six letters that never join to the letter after them: two shapes only. */
const rightOnly = (ch: string): Form[] => [
  { label: "alone or start", ch },
  { label: "middle or end", ch: ZWJ + ch },
];
const NO_LEFT = "This letter never joins to the letter after it, so a small gap follows it inside a word.";

const ARABIC: Alphabet = {
  id: "arabic",
  title: "Arabic",
  badge: "ابت",
  lang: "ar",
  rtl: true,
  verseId: "fatiha",
  voice: false,
  intro:
    "28 letters, read from right to left and joined like handwriting, so most letters have a shape for the start, middle and end of a word. Short vowels are small marks.",
  soundNote:
    "Sounds are given as in Modern Standard Arabic and the reading of the Quran. Several throat and \"heavy\" letters have no English match: the descriptions are a starting point. Sounds are written here only, never spoken by a device voice.",
  numberNote:
    "Abjad: the letters in their old order (abjad, hawwaz…) count 1 to 9, 10 to 90, 100 to 1000. That old order is not the order of the lessons, so the numbers jump about.",
  formsNote: "Each lesson shows a letter’s shapes for the start, middle and end of a word: it is the same letter, drawn joined to its neighbours.",
  marksTitle: "Short vowels and other marks",
  marksIntro: "Long vowels are written with letters (ا و ي). Short vowels are small marks, printed in the Quran and in teaching books, usually left out elsewhere. Here they sit on bā' (ب):",
  marks: [
    { sample: "بَ", name: "fatḥa", says: "a short a" },
    { sample: "بِ", name: "kasra", says: "a short i" },
    { sample: "بُ", name: "ḍamma", says: "a short u" },
    { sample: "بْ", name: "sukūn", says: "no vowel after the letter" },
    { sample: "بّ", name: "shadda", says: "the letter is doubled (held twice as long)" },
    { sample: "بً", name: "tanwīn", says: "-an at the end of a word (also -in ٍ and -un ٌ)" },
    { sample: "ء", name: "hamza", says: "a catch in the throat, as in uh-oh; it often sits on alif (أ إ)" },
    { sample: "ٱ", name: "alif waṣla", says: "a silent alif: the voice runs on from the word before (as in ٱللَّهِ)" },
    { sample: "ـٰ", name: "small (dagger) alif", says: "a long ā not written as a full letter (as in ٱلرَّحْمَـٰنِ)" },
  ],
  marksNote: "ٱل at the start of a word is \"the\" (al-). Before some letters, such as r, the l blends into them: ٱلرَّحِيمِ is ar-raḥīm.",
  lessons: [
    [
      { ch: "ا", name: "alif", say: "ā (long a)", sound: "a long ā as in father; at the start of a word it carries a vowel or a hamza", tokens: ["ā (long a)"], value: 1, forms: rightOnly("ا"), note: NO_LEFT, word: { text: "ٱهْدِنَا", say: "ihdinā", means: "guide us", ref: "Quran 1:6" } },
      { ch: "ب", name: "bā'", say: "b", sound: "b", tokens: ["b"], value: 2, forms: joins("ب"), word: { text: "بِسْمِ", say: "bismi", means: "in the name (of)", ref: "Quran 1:1" } },
      { ch: "ت", name: "tā'", say: "t", sound: "t", tokens: ["t"], value: 400, forms: joins("ت"), word: { text: "نَسْتَعِينُ", say: "nastaʿīnu", means: "we ask for help", ref: "Quran 1:5" } },
      { ch: "ث", name: "thā'", say: "th (thin)", sound: "th as in thin", tokens: ["th (thin)"], value: 500, forms: joins("ث"), note: "Al-Fatiha never uses this letter, so the word comes from a later chapter.", word: { text: "ٱلثَّمَرَٰتِ", say: "ath-thamarāti", means: "the fruits", ref: "Quran 2:22" } },
      { ch: "ج", name: "jīm", say: "j", sound: "j as in jam", tokens: ["j"], value: 3, forms: joins("ج"), note: "Al-Fatiha never uses this letter, so the word comes from a later chapter.", word: { text: "جَنَّـٰتٍ", say: "jannātin", means: "gardens", ref: "Quran 2:25" } },
      { ch: "ح", name: "ḥā'", say: "ḥ (deep h)", sound: "a strong, breathy h from deep in the throat", tokens: ["ḥ (deep h)"], value: 8, forms: joins("ح"), word: { text: "ٱلرَّحْمَـٰنِ", say: "ar-Raḥmāni", means: "the Most Gracious", ref: "Quran 1:1" } },
    ],
    [
      { ch: "خ", name: "khā'", say: "kh", sound: "kh, like the ch in Scottish loch", tokens: ["kh"], value: 600, forms: joins("خ"), note: "Al-Fatiha never uses this letter, so the word comes from a later chapter.", word: { text: "خَلَقَ", say: "khalaqa", means: "he created", ref: "Quran 113:2" } },
      { ch: "د", name: "dāl", say: "d", sound: "d", tokens: ["d"], value: 4, forms: rightOnly("د"), note: NO_LEFT, word: { text: "ٱلْحَمْدُ", say: "al-ḥamdu", means: "the praise", ref: "Quran 1:2" } },
      { ch: "ذ", name: "dhāl", say: "dh (this)", sound: "th as in this", tokens: ["dh (this)"], value: 700, forms: rightOnly("ذ"), note: NO_LEFT, word: { text: "ٱلَّذِينَ", say: "alladhīna", means: "those (who)", ref: "Quran 1:7" } },
      { ch: "ر", name: "rā'", say: "r", sound: "r, tapped or rolled", tokens: ["r"], value: 200, forms: rightOnly("ر"), note: NO_LEFT, word: { text: "ٱلرَّحِيمِ", say: "ar-Raḥīmi", means: "the Most Merciful", ref: "Quran 1:1" } },
      { ch: "ز", name: "zāy", say: "z", sound: "z", tokens: ["z"], value: 7, forms: rightOnly("ز"), note: `${NO_LEFT} Al-Fatiha never uses it, so the word comes from a later chapter.`, word: { text: "رِزْقًا", say: "rizqan", means: "provision", ref: "Quran 2:22" } },
      { ch: "س", name: "sīn", say: "s", sound: "s", tokens: ["s"], value: 60, forms: joins("س"), word: { text: "بِسْمِ", say: "bismi", means: "in the name (of)", ref: "Quran 1:1" } },
    ],
    [
      { ch: "ش", name: "shīn", say: "sh", sound: "sh", tokens: ["sh"], value: 300, forms: joins("ش"), note: "Al-Fatiha never uses this letter, so the word comes from a later chapter.", word: { text: "وَٱلشَّمْسِ", say: "wa-sh-shamsi", means: "by the sun", ref: "Quran 91:1" } },
      { ch: "ص", name: "ṣād", say: "ṣ (heavy s)", sound: "a heavy s, said with the tongue low and the throat tight", tokens: ["ṣ (heavy s)"], value: 90, forms: joins("ص"), word: { text: "ٱلصِّرَٰطَ", say: "aṣ-ṣirāṭa", means: "the path", ref: "Quran 1:6" } },
      { ch: "ض", name: "ḍād", say: "ḍ (heavy d)", sound: "a heavy d", tokens: ["ḍ (heavy d)"], value: 800, forms: joins("ض"), note: "Arabic is sometimes called \"the language of ḍād\", a sound few other languages have.", word: { text: "ٱلضَّآلِّينَ", say: "aḍ-ḍāllīna", means: "those who go astray", ref: "Quran 1:7" } },
      { ch: "ط", name: "ṭā'", say: "ṭ (heavy t)", sound: "a heavy t", tokens: ["ṭ (heavy t)"], value: 9, forms: joins("ط"), word: { text: "ٱلصِّرَٰطَ", say: "aṣ-ṣirāṭa", means: "the path", ref: "Quran 1:6" } },
      { ch: "ظ", name: "ẓā'", say: "ẓ (heavy dh)", sound: "a heavy th as in this", tokens: ["ẓ (heavy dh)"], value: 900, forms: joins("ظ"), note: "Al-Fatiha never uses this letter, so the word comes from a later chapter.", word: { text: "ٱلظُّلُمَـٰتِ", say: "aẓ-ẓulumāti", means: "the darkness (literally, darknesses)", ref: "Quran 6:1" } },
      { ch: "ع", name: "ʿayn", say: "ʿ (throat sound)", sound: "a tight sound squeezed from the throat; English has nothing like it", tokens: ["ʿ (throat sound)"], value: 70, forms: joins("ع"), word: { text: "ٱلْعَـٰلَمِينَ", say: "al-ʿālamīna", means: "the worlds", ref: "Quran 1:2" } },
    ],
    [
      { ch: "غ", name: "ghayn", say: "gh", sound: "gh, like a French r", tokens: ["gh"], value: 1000, forms: joins("غ"), note: "The last letter of the abjad, worth a thousand.", word: { text: "غَيْرِ", say: "ghayri", means: "not (of)", ref: "Quran 1:7" } },
      { ch: "ف", name: "fā'", say: "f", sound: "f", tokens: ["f"], value: 80, forms: joins("ف"), note: "Al-Fatiha never uses this letter, so the word comes from a later chapter.", word: { text: "ٱلْفَلَقِ", say: "al-falaqi", means: "the daybreak", ref: "Quran 113:1" } },
      { ch: "ق", name: "qāf", say: "q", sound: "q: a k said far back in the throat", tokens: ["q"], value: 100, forms: joins("ق"), word: { text: "ٱلْمُسْتَقِيمَ", say: "al-mustaqīma", means: "the straight", ref: "Quran 1:6" } },
      { ch: "ك", name: "kāf", say: "k", sound: "k", tokens: ["k"], value: 20, forms: joins("ك"), word: { text: "مَـٰلِكِ", say: "māliki", means: "Master (of)", ref: "Quran 1:4" } },
      { ch: "ل", name: "lām", say: "l", sound: "l", tokens: ["l"], value: 30, forms: joins("ل"), word: { text: "ٱللَّهِ", say: "Allāhi", means: "God", ref: "Quran 1:1" } },
    ],
    [
      { ch: "م", name: "mīm", say: "m", sound: "m", tokens: ["m"], value: 40, forms: joins("م"), word: { text: "بِسْمِ", say: "bismi", means: "in the name (of)", ref: "Quran 1:1" } },
      { ch: "ن", name: "nūn", say: "n", sound: "n", tokens: ["n"], value: 50, forms: joins("ن"), word: { text: "ٱلرَّحْمَـٰنِ", say: "ar-Raḥmāni", means: "the Most Gracious", ref: "Quran 1:1" } },
      { ch: "ه", name: "hā'", say: "h", sound: "h as in hat, said even at the end of a word", tokens: ["h"], value: 5, forms: joins("ه"), word: { text: "ٱللَّهِ", say: "Allāhi", means: "God", ref: "Quran 1:1" } },
      { ch: "و", name: "wāw", say: "w / ū", sound: "w; also a long ū as in rule", tokens: ["w / ū"], value: 6, forms: rightOnly("و"), note: `${NO_LEFT} At the front of a word, و often means "and".`, word: { text: "يَوْمِ", say: "yawmi", means: "the day (of)", ref: "Quran 1:4" } },
      { ch: "ي", name: "yā'", say: "y / ī", sound: "y; also a long ī as in machine", tokens: ["y / ī"], value: 10, forms: joins("ي"), word: { text: "ٱلرَّحِيمِ", say: "ar-Raḥīmi", means: "the Most Merciful", ref: "Quran 1:1" } },
    ],
  ],
};

export const ALPHABETS: Alphabet[] = [HEBREW, GREEK, ARABIC];
