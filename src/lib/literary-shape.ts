/**
 * Literary shape (study lab, hub 7a62bb28): curated examples of the hidden structure of Bible passages. Acrostics
 * (every first letter is read from the Hebrew text itself, WLC), parallel lines (the KJV verse cut where its lines
 * turn), and mirrored stories (chiasm) as an A B C … C' B' A' outline. Every quote and every claim was checked against
 * the site's texts (scripts/_shape-check.mts during the build). Verse numbers follow the English (KJV) numbering, which
 * is how the site's Hebrew files are numbered too.
 */

/* ---------------- Hebrew letters ---------------- */

export const HEBREW_LETTERS = [
  ["א", "Aleph"], ["ב", "Bet"], ["ג", "Gimel"], ["ד", "Dalet"], ["ה", "He"], ["ו", "Vav"], ["ז", "Zayin"],
  ["ח", "Het"], ["ט", "Tet"], ["י", "Yod"], ["כ", "Kaf"], ["ל", "Lamed"], ["מ", "Mem"], ["נ", "Nun"],
  ["ס", "Samekh"], ["ע", "Ayin"], ["פ", "Pe"], ["צ", "Tsadi"], ["ק", "Qof"], ["ר", "Resh"], ["ש", "Shin"], ["ת", "Tav"],
] as const;

const FINALS: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
const LETTER = /[א-ת]/;

/** A letter's usual form, its name and its place in the alphabet (1–22), or null for anything else. */
export function letterInfo(ch: string): { char: string; name: string; n: number } | null {
  const base = FINALS[ch] ?? ch;
  const i = HEBREW_LETTERS.findIndex(([c]) => c === base);
  return i < 0 ? null : { char: base, name: HEBREW_LETTERS[i][1], n: i + 1 };
}

/** The first Hebrew letter of a piece of text (vowel points and accents skipped). */
export function firstLetter(text: string): string {
  const m = text.match(LETTER);
  return m ? m[0] : "";
}

/**
 * A verse cut into pieces at the given words (counting only words with letters, so a paseq ׀ is not a word). The
 * pieces put back together are the verse exactly as written. `head` is anything before the first cut (a heading).
 */
export function cutAtWords(text: string, starts: number[]): { head: string; parts: string[] } {
  const bits = text.split(/(\s+)/);
  const cuts: number[] = []; // positions in `bits`
  let w = 0;
  bits.forEach((b, i) => {
    if (!LETTER.test(b)) return;
    if (starts.indexOf(w) >= 0) cuts.push(i);
    w++;
  });
  if (!cuts.length) return { head: "", parts: [text] };
  const head = bits.slice(0, cuts[0]).join("");
  const parts = cuts.map((c, k) => bits.slice(c, k + 1 < cuts.length ? cuts[k + 1] : bits.length).join(""));
  return { head, parts };
}

/* ---------------- acrostics ---------------- */

export type Acrostic = {
  id: string;
  title: string;
  book: string;
  chapter: number;
  from?: number;
  to?: number;
  /** Verses whose acrostic line(s) start later than the first word: the word number(s), counting from 0. */
  starts?: Record<string, number[]>;
  /** Show the verses in groups of this many (Psalm 119's sections of 8, Lamentations 3's threes). */
  group?: number;
  about: string;
  /** What doesn't fit the pattern, said plainly. */
  irregular?: string;
};

export const ACROSTICS: Acrostic[] = [
  {
    id: "ps119",
    title: "Psalm 119",
    book: "psa",
    chapter: 119,
    group: 8,
    about: "The longest acrostic: 22 sections of 8 verses, and all 8 verses of a section begin with the same letter, from aleph to tav. It is a long meditation on God's word.",
    irregular: "None: all 176 verses follow the pattern.",
  },
  {
    id: "ps25",
    title: "Psalm 25",
    book: "psa",
    chapter: 25,
    starts: { "1": [1], "2": [1] },
    about: "A prayer for guidance, one verse for each letter.",
    irregular:
      "A loose acrostic. Verse 1's line starts after the heading \"Of David\", and the bet line (verse 2) starts with its second word, after \"my God\". There is no vav verse (some find one in the second half of verse 5), and no qof verse: verses 18 and 19 both begin with resh. The last verse (22) begins with pe again, outside the alphabet.",
  },
  {
    id: "ps34",
    title: "Psalm 34",
    book: "psa",
    chapter: 34,
    starts: { "1": [7] },
    about: "\"O taste and see that the LORD is good\": a song of thanks, one verse for each letter.",
    irregular: "Verse 1's line starts after the long heading. There is no vav verse (verse 5 is he, verse 6 is zayin; some find one in the second half of verse 5), and the last verse (22) begins with pe again, outside the alphabet.",
  },
  {
    id: "ps111",
    title: "Psalm 111",
    book: "psa",
    chapter: 111,
    starts: { "1": [2, 5], "2": [0, 3], "3": [0, 2], "4": [0, 3], "5": [0, 3], "6": [0, 4], "7": [0, 4], "8": [0, 3], "9": [0, 3, 5], "10": [0, 4, 7] },
    about: "Here the alphabet runs line by line, not verse by verse: 22 short lines in 10 verses, after the opening \"Praise ye the LORD\" (Hallelujah).",
    irregular: "None in the letters. The opening Hallelujah stands outside the pattern.",
  },
  {
    id: "ps112",
    title: "Psalm 112",
    book: "psa",
    chapter: 112,
    starts: { "1": [2, 5], "2": [0, 4], "3": [0, 2], "4": [0, 4], "5": [0, 3], "6": [0, 2], "7": [0, 4], "8": [0, 4], "9": [0, 3, 6], "10": [0, 3, 8] },
    about: "A twin of Psalm 111, built the same way, line by line. Psalm 111 praises God; Psalm 112 describes the person who fears him.",
    irregular: "None in the letters. The opening Hallelujah stands outside the pattern.",
  },
  {
    id: "ps145",
    title: "Psalm 145",
    book: "psa",
    chapter: 145,
    starts: { "1": [2] },
    about: "\"I will extol thee, my God, O king\": a song of praise, one verse for each letter.",
    irregular:
      "Verse 1's line starts after the heading \"A praise of David\". There is no nun verse in the Masoretic (traditional Hebrew) text: verse 13 begins with mem and verse 14 with samekh. A Psalms scroll from Qumran and the Greek Septuagint have a nun line there, saying that God is faithful in his words, and some modern translations add it.",
  },
  {
    id: "pro31",
    title: "Proverbs 31:10–31",
    book: "pro",
    chapter: 31,
    from: 10,
    to: 31,
    about: "\"Who can find a virtuous woman?\" The closing poem of Proverbs, one verse for each letter.",
    irregular: "None: ayin (verse 25) comes before pe (verse 26), in the usual order.",
  },
  {
    id: "lam1",
    title: "Lamentations 1",
    book: "lam",
    chapter: 1,
    about: "A lament for Jerusalem, one verse for each letter.",
    irregular: "None: ayin (verse 16) comes before pe (verse 17), in the usual order.",
  },
  {
    id: "lam2",
    title: "Lamentations 2",
    book: "lam",
    chapter: 2,
    about: "A second lament, one verse for each letter.",
    irregular: "Pe (verse 16) comes before ayin (verse 17). This order is also known from some ancient alphabet lists, so it may be an older order rather than a mistake.",
  },
  {
    id: "lam3",
    title: "Lamentations 3",
    book: "lam",
    chapter: 3,
    group: 3,
    about: "66 verses: three verses for each letter. The famous \"his compassions fail not. They are new every morning\" (verses 22–23) falls under het.",
    irregular: "Pe (verses 46–48) comes before ayin (verses 49–51), as in chapters 2 and 4.",
  },
  {
    id: "lam4",
    title: "Lamentations 4",
    book: "lam",
    chapter: 4,
    about: "A fourth lament, one verse for each letter.",
    irregular: "Pe (verse 16) comes before ayin (verse 17). Chapter 5 also has 22 verses, but it is not an acrostic.",
  },
];

/* ---------------- parallel lines ---------------- */

export type ParallelKind = "synonymous" | "antithetic" | "synthetic";

export const KIND_NAME: Record<ParallelKind, { name: string; short: string }> = {
  synonymous: { name: "Synonymous", short: "the second line says the same thing again, in other words" },
  antithetic: { name: "Contrasting (antithetic)", short: "the second line says the opposite, often turning on \"but\"" },
  synthetic: { name: "Building (synthetic)", short: "the next line carries the thought further" },
};

export type Parallel = {
  ref: string;
  book: string;
  chapter: number;
  verses: number[];
  /** Each new line starts at the first place this text appears in the verse (KJV). Text before the first is a heading. */
  cuts: string[][];
  kind: ParallelKind;
  note: string;
};

export const PARALLELS: Parallel[] = [
  {
    ref: "Psalm 19:1–2",
    book: "psa",
    chapter: 19,
    verses: [1, 2],
    cuts: [["The heavens", "and the firmament"], ["Day unto day", "and night unto night"]],
    kind: "synonymous",
    note: "The heavens and the firmament (the sky) both speak of God; day and night both pass the message on.",
  },
  {
    ref: "Isaiah 55:6",
    book: "isa",
    chapter: 55,
    verses: [6],
    cuts: [["Seek ye", "call ye"]],
    kind: "synonymous",
    note: "Seek and call, while he may be found and while he is near: one plea, said twice.",
  },
  {
    ref: "Proverbs 15:1",
    book: "pro",
    chapter: 15,
    verses: [1],
    cuts: [["A soft answer", "but grievous words"]],
    kind: "antithetic",
    note: "Soft against grievous (harsh), turning wrath away against stirring anger up.",
  },
  {
    ref: "Isaiah 1:3",
    book: "isa",
    chapter: 1,
    verses: [3],
    cuts: [["The ox knoweth", "and the ass", "but Israel", "my people"]],
    kind: "antithetic",
    note: "Two synonymous pairs set against each other: even the animals know their master, but his people do not.",
  },
  {
    ref: "Isaiah 40:31",
    book: "isa",
    chapter: 40,
    verses: [31],
    cuts: [["But they that wait", "they shall mount up", "they shall run", "and they shall walk"]],
    kind: "synthetic",
    note: "The promise unfolds line by line: renewed strength, then flying, running and walking without tiring.",
  },
  {
    ref: "Psalm 103:11–12",
    book: "psa",
    chapter: 103,
    verses: [11, 12],
    cuts: [["For as the heaven", "so great"], ["As far as", "so far"]],
    kind: "synthetic",
    note: "Each verse sets up a picture (\"as …\") and then completes it (\"so …\"): high as the heavens, far as east from west.",
  },
];

/* ---------------- mirrored stories ---------------- */

export type ChiasmLine = { label: string; book: string; chapter: number; verse: number; to?: number; quote?: string };
export type Chiasm = { id: string; title: string; about: string; source: string; lines: ChiasmLine[]; centre?: ChiasmLine };

/** Lines before the centre, top to bottom; each pairs with the matching line after (A with A', B with B'…). */
export const CHIASMS: Chiasm[] = [
  {
    id: "flood",
    title: "The Flood (Genesis 6–9)",
    about:
      "The Flood account climbs to a turning point and comes back down the same steps in reverse: seven days, forty days and 150 days on the way in, then 150, forty and seven on the way out. At the centre, God remembers Noah.",
    source: "A simplified form of the outline proposed by Gordon Wenham (1978). Debated: others read the account as two earlier sources woven together, and question how many of the pairs are deliberate.",
    lines: [
      { label: "Noah's three sons", book: "gen", chapter: 6, verse: 10, quote: "Shem, Ham, and Japheth" },
      { label: "A flood announced", book: "gen", chapter: 6, verse: 17, quote: "I, even I, do bring a flood of waters upon the earth" },
      { label: "A covenant promised", book: "gen", chapter: 6, verse: 18, quote: "with thee will I establish my covenant" },
      { label: "Food for the ark", book: "gen", chapter: 6, verse: 21, quote: "take thou unto thee of all food that is eaten" },
      { label: "Into the ark", book: "gen", chapter: 7, verse: 1, quote: "Come thou and all thy house into the ark" },
      { label: "Seven days", book: "gen", chapter: 7, verse: 10, quote: "after seven days" },
      { label: "Forty days", book: "gen", chapter: 7, verse: 17, quote: "the flood was forty days upon the earth" },
      { label: "The waters prevail; the mountains covered; 150 days", book: "gen", chapter: 7, verse: 19, to: 24, quote: "an hundred and fifty days" },
    ],
    centre: { label: "The turning point", book: "gen", chapter: 8, verse: 1, quote: "And God remembered Noah" },
  },
  {
    id: "babel",
    title: "The tower of Babel (Genesis 11:1–9)",
    about:
      "Nine verses that fold in the middle: what the people do in the first half is echoed and reversed in the second. At the centre the LORD comes down to see. The same Hebrew word, havah (\"go to\", come, let us), opens both the people's plan and God's answer.",
    source: "After the outline of J. P. Fokkelman, as set out by Gordon Wenham. Widely accepted, though the exact pairs vary from scholar to scholar.",
    lines: [
      { label: "One language for the whole earth", book: "gen", chapter: 11, verse: 1, quote: "the whole earth was of one language" },
      { label: "They settle there", book: "gen", chapter: 11, verse: 2, quote: "they dwelt there" },
      { label: "One to another", book: "gen", chapter: 11, verse: 3, quote: "they said one to another" },
      { label: "Come, let us make bricks", book: "gen", chapter: 11, verse: 3, quote: "Go to, let us make brick" },
      { label: "Let us build", book: "gen", chapter: 11, verse: 4, quote: "let us build us" },
      { label: "A city and a tower", book: "gen", chapter: 11, verse: 4, quote: "a city and a tower" },
    ],
    centre: { label: "The turning point", book: "gen", chapter: 11, verse: 5, quote: "And the LORD came down to see" },
  },
  {
    id: "sabbath",
    title: "A saying of Jesus (Mark 2:27)",
    about: "Chiasm in miniature: one sentence whose words come back in reverse order, so the saying turns on itself.",
    source: "A widely noted example: the pattern is plain in the wording.",
    lines: [
      { label: "", book: "mrk", chapter: 2, verse: 27, quote: "The sabbath" },
      { label: "", book: "mrk", chapter: 2, verse: 27, quote: "was made for man" },
    ],
  },
];

/** The lines after the centre, in order (… C' B' A'): CHIASM_RETURN[id][i] pairs with lines[lines.length - 1 - i]. */
export const CHIASM_RETURN: Record<string, ChiasmLine[]> = {
  flood: [
    { label: "The waters go down; the mountain tops seen; after 150 days", book: "gen", chapter: 8, verse: 3, to: 5, quote: "the hundred and fifty days" },
    { label: "Forty days", book: "gen", chapter: 8, verse: 6, quote: "at the end of forty days" },
    { label: "Seven days, and seven more", book: "gen", chapter: 8, verse: 10, to: 12, quote: "yet other seven days" },
    { label: "Out of the ark", book: "gen", chapter: 8, verse: 16, quote: "Go forth of the ark" },
    { label: "Food after the flood", book: "gen", chapter: 9, verse: 3, quote: "Every moving thing that liveth shall be meat for you" },
    { label: "The covenant made", book: "gen", chapter: 9, verse: 9, quote: "I establish my covenant with you" },
    { label: "No more flood", book: "gen", chapter: 9, verse: 11, quote: "neither shall there any more be a flood to destroy the earth" },
    { label: "Noah's three sons", book: "gen", chapter: 9, verse: 18, quote: "Shem, and Ham, and Japheth" },
  ],
  babel: [
    { label: "The city and the tower", book: "gen", chapter: 11, verse: 5, quote: "the city and the tower" },
    { label: "Which they built", book: "gen", chapter: 11, verse: 5, quote: "which the children of men builded" },
    { label: "Come, let us go down", book: "gen", chapter: 11, verse: 7, quote: "Go to, let us go down" },
    { label: "One another", book: "gen", chapter: 11, verse: 7, quote: "one another’s speech" },
    { label: "Scattered from there", book: "gen", chapter: 11, verse: 8, quote: "scattered them abroad from thence" },
    { label: "The language of all the earth", book: "gen", chapter: 11, verse: 9, quote: "the language of all the earth" },
  ],
  sabbath: [
    { label: "", book: "mrk", chapter: 2, verse: 27, quote: "and not man" },
    { label: "", book: "mrk", chapter: 2, verse: 27, quote: "for the sabbath" },
  ],
};

/** "Genesis 7:19–24" style reference. */
export function refOf(names: Record<string, string>, l: { book: string; chapter: number; verse: number; to?: number }) {
  return `${names[l.book] ?? l.book} ${l.chapter}:${l.verse}${l.to ? `–${l.to}` : ""}`;
}

/** Splits a KJV verse where each new line starts; null if a cut isn't found (then the verse is shown whole). */
export function splitLines(text: string, cuts: string[]): { head: string; lines: string[] } | null {
  const at: number[] = [];
  let from = 0;
  for (const c of cuts) {
    const i = text.indexOf(c, from);
    if (i < 0) return null;
    at.push(i);
    from = i + c.length;
  }
  return {
    head: text.slice(0, at[0]).trim(),
    lines: at.map((a, k) => text.slice(a, k + 1 < at.length ? at[k + 1] : text.length).trim()),
  };
}
