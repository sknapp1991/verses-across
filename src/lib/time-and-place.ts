/**
 * Time and place (study lab, hub 7a62bb28): the map projection shared by the build script (scripts/build-places.mts)
 * and the page, the shapes of the generated files in public/places/, and the "when were they written" timeline.
 * Plain data, safe on the server and in old Safari.
 */

/**
 * A plain equirectangular map, squeezed east-west for the latitude of Jerusalem so the Levant keeps its shape.
 * One unit is about a kilometre (a hundredth of a degree of latitude). bbox = west, south, east, north.
 */
export const PROJ = {
  bbox: [-10, 8, 70, 47] as number[],
  /** Where most chapters zoom in (the Levant, Sinai, the Nile delta): the outline keeps more detail here. */
  detailBox: [29, 27.5, 39, 37.5] as number[],
  /** The Mediterranean and Near East: medium detail (the rest of the map stays coarse). */
  regionBox: [10, 20, 52, 43] as number[],
  k: 100,
  cos: Math.cos((32 * Math.PI) / 180),
};

export function project(lon: number, lat: number): [number, number] {
  return [Math.round((lon - PROJ.bbox[0]) * PROJ.k * PROJ.cos), Math.round((PROJ.bbox[3] - lat) * PROJ.k)];
}

export function unproject(x: number, y: number): [number, number] {
  return [x / (PROJ.k * PROJ.cos) + PROJ.bbox[0], PROJ.bbox[3] - y / PROJ.k];
}

/** Great-circle distance in km between two projected points (good to about a kilometre). */
export function kmBetween(x1: number, y1: number, x2: number, y2: number): number {
  const [lon1, lat1] = unproject(x1, y1);
  const [lon2, lat2] = unproject(x2, y2);
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** The whole map in projected units. */
export const MAP_SIZE = (() => {
  const [x, y] = project(PROJ.bbox[2], PROJ.bbox[1]);
  return { w: x, h: y };
})();

/** One place in public/places/<book>.json (OpenBible.info, CC BY 4.0). */
export type Place = {
  /** OpenBible id and slug: https://www.openbible.info/geo/ancient/<id> */
  id: string;
  /** The name as the KJV spells it. */
  n: string;
  /** The modern location it is identified with. */
  m?: string;
  x?: number;
  y?: number;
  /** How sure the identification is: 2 widely agreed, 1 likely, 0 uncertain. */
  c: number;
  /** How many other locations have been proposed. */
  o?: number;
  /** The dot stands for a wider area (a region, a river, or a circle of uncertainty). */
  a?: 1;
  /** Kind of place (settlement, mountain, region…). */
  t?: string;
  /** Why it isn't on the map (location unknown…). */
  u?: string;
  /** Chapter → KJV verses that name it. */
  v: Record<string, number[]>;
};
export type BookPlaces = { places: Place[] };
export type MapOutline = { land: string; lakes: string; rivers: string; labels?: WaterLabel[] };
/** A sea, river or lake name on the map; z is the widest view (map units across) at which it shows. */
export type WaterLabel = { n: string; x: number; y: number; k: "sea" | "river" | "lake"; z: number };

/** One place in public/places/index.json, for search across the whole Bible (no verse lists). */
export type IndexPlace = Omit<Place, "v"> & {
  /** Other names: other KJV spellings, OpenBible's name, the modern name. */
  k?: string[];
  /** Books (canonical order) and the chapters in each that name it. */
  b: [string, number[]][];
  /** How many KJV verses name it (for ranking). */
  w: number;
  /** Eras whose chapters name it, as bits (see ERAS in time-and-place-eras.ts). */
  e?: number;
};

/** public/places/p/<openbible id>.json: every KJV verse that names a place, and maybe a photo. */
export type PlaceFile = {
  /** [book, [[chapter, [verses]]]] in canonical order. */
  v: [string, [number, number[]][]][];
  /** An openly licensed photo on Wikimedia Commons (from OpenBible.info's image metadata). */
  img?: { src: string; by: string; lic: string; url: string; alt: string };
};

/**
 * public/places/heat.json: per book, each place on the map (OpenBible id, no slug) and how many KJV verses in that
 * book name it, most named first. No verse text.
 */
export type HeatFile = Record<string, [string, number][]>;

/** Letters that NFD doesn't split into a base letter and an accent. */
const FOLD_EXTRA: Record<string, string> = { ı: "i", ø: "o", ß: "ss", ł: "l", æ: "ae", œ: "oe", đ: "d", Ø: "o", Ł: "l", Æ: "ae", Œ: "oe", Đ: "d" };

/** Lowercase, no accents, letters and digits only ("Beth-lehem" and "Bethlehem" match). */
export function fold(s: string): string {
  return s
    .replace(/[ıøßłæœđØŁÆŒĐ]/g, (ch) => FOLD_EXTRA[ch] ?? ch)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Edit distance with swaps (Damerau, optimal string alignment), stopping early past max. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev.push(j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2.length = 0;
    prev2.push(...prev);
    prev = cur;
  }
  return prev[b.length];
}

/**
 * How well a folded query matches one name (0 = not at all): whole name, start of the name, start of a word,
 * anywhere, then near misses (one typo for 4+ letters, two for 7+), on the whole name or its first letters.
 */
export function matchScore(q: string, name: string): number {
  const n = fold(name);
  if (!q || !n) return 0;
  const qs = q.replace(/ /g, "");
  const ns = n.replace(/ /g, "");
  if (ns === qs) return 100;
  if (ns.startsWith(qs)) return 80;
  if (n.split(" ").some((w) => w.startsWith(q))) return 65;
  if (qs.length >= 3 && ns.includes(qs)) return 45;
  if (qs.length >= 4) {
    const max = qs.length >= 7 ? 2 : 1;
    if (editDistance(qs, ns, max) <= max) return 40 - 5 * editDistance(qs, ns, max);
    if (ns.length > qs.length && editDistance(qs, ns.slice(0, qs.length), max) <= max) return 25;
  }
  return 0;
}

export const SURE_LABEL = ["Uncertain", "Likely", "Widely agreed"];
export const SURE_NOTE = [
  "Scholars are unsure where this was; this is one proposal among others.",
  "Most sources lean towards this location.",
  "Sources broadly agree on this location.",
];

/* ---------------- when the texts were written ---------------- */

/** A year range; negative years are BCE. */
export type Span = [number, number];

export type Writing = {
  /** Work and book on the site, for a "Read" link. */
  work: string;
  book: string;
  title: string;
  tradition: string;
  /** How the tradition itself tells it. */
  traditional: string;
  /** A traditional date range, when the tradition gives one that can be drawn. */
  tradSpan?: Span;
  /** The usual range among historians. */
  scholarly: string;
  span: Span;
  /** Both views broadly agree (shown as one). */
  agreed?: boolean;
  /** A known year, not an estimate (shown without "c."). */
  exact?: boolean;
};

/**
 * Kept conservative: broad ranges that are widely cited in standard reference works, worded neutrally. Where a date
 * is much debated, the range is wide and says so.
 */
export const WRITINGS: Writing[] = [
  {
    work: "gilgamesh",
    book: "gilgamesh",
    title: "Epic of Gilgamesh",
    tradition: "Ancient Mesopotamia",
    traditional: "Told of Gilgamesh, a king of Uruk, in Sumerian poems before it became one epic.",
    scholarly: "Sumerian poems c. 2100 BCE; an Old Babylonian epic c. 1800 BCE; the standard version c. 1200 to 1100 BCE.",
    span: [-2100, -1100],
  },
  {
    work: "book-of-the-dead",
    book: "book-of-the-dead",
    title: "Egyptian Book of the Dead",
    tradition: "Ancient Egypt",
    traditional: "Spells to guide the dead, grown out of older tomb and coffin texts.",
    scholarly: "In use from c. 1550 BCE for about fifteen centuries, with many versions.",
    span: [-1550, -50],
  },
  {
    work: "vedas",
    book: "rv1",
    title: "Rig Veda",
    tradition: "Hindu",
    traditional: "Shruti, “what was heard”: eternal, not made by people, seen by ancient seers and passed on by heart.",
    scholarly: "Composed and handed down orally, c. 1500 to 1000 BCE; written down much later.",
    span: [-1500, -1000],
  },
  {
    work: "gathas",
    book: "gathas",
    title: "Gathas of Zarathustra",
    tradition: "Zoroastrian",
    traditional: "The hymns of the prophet Zarathustra himself; tradition places him a few centuries before Alexander.",
    scholarly: "Much debated: their language is close to the Rig Veda's, and dates from c. 1500 to 500 BCE are proposed.",
    span: [-1500, -500],
  },
  {
    work: "i-ching",
    book: "i-ching",
    title: "I Ching",
    tradition: "Confucian and Taoist",
    traditional: "Trigrams from the sage Fu Xi, texts from King Wen and the Duke of Zhou, commentaries from Confucius.",
    scholarly: "Core text from the Western Zhou, c. 1000 to 750 BCE; the commentaries added c. 400 to 200 BCE.",
    span: [-1000, -200],
  },
  {
    work: "tanakh",
    book: "gen",
    title: "Torah (five books of Moses)",
    tradition: "Jewish and Christian",
    traditional: "Given through Moses in the wilderness, many centuries before the exile.",
    scholarly: "Written and edited over centuries: many scholars place the earliest written sources in the time of the kings (from c. 900 BCE) and the final form c. 500 to 400 BCE.",
    span: [-900, -400],
  },
  {
    work: "bible",
    book: "isa",
    title: "Prophets (Isaiah to Malachi, apart from Daniel)",
    tradition: "Jewish and Christian",
    traditional: "The words of the prophets they are named for, from the 8th to the 5th century BCE.",
    tradSpan: [-760, -430],
    scholarly:
      "Rooted in the prophets of the 8th to 5th centuries BCE; the books were gathered and added to over time (for example Isaiah 40 to 66, from the exile and after), mostly complete by c. 300 BCE.",
    span: [-760, -300],
  },
  {
    work: "bible",
    book: "dan",
    title: "Daniel",
    tradition: "Jewish and Christian",
    traditional: "Written by Daniel, an exile at the court of Babylon and Persia, in the 6th century BCE.",
    tradSpan: [-605, -530],
    scholarly: "The final form is usually dated to c. 167 to 164 BCE, in the time of Antiochus IV; some of its stories may be older.",
    span: [-167, -164],
  },
  {
    work: "upanishads",
    book: "isha",
    title: "Principal Upanishads",
    tradition: "Hindu",
    traditional: "Shruti, the close of the Vedas (Vedanta): revealed knowledge, not composed by people.",
    scholarly: "The oldest (Brihadaranyaka, Chandogya) c. 700 to 500 BCE, before the Buddha; others into the last centuries BCE.",
    span: [-700, -200],
  },
  {
    work: "tipitaka",
    book: "dn",
    title: "Pali Canon",
    tradition: "Buddhist (Theravada)",
    traditional:
      "The Buddha's teachings, recited at a council soon after his passing, passed on by heart, written down in Sri Lanka in the 1st century BCE.",
    scholarly:
      "The Buddha is usually dated to the 5th century BCE; the canon grew over several centuries and was written down in the 1st century BCE.",
    span: [-450, -20],
  },
  {
    work: "analects",
    book: "analects",
    title: "Analects of Confucius",
    tradition: "Confucian",
    traditional: "Sayings of Confucius (died 479 BCE), written down by his disciples.",
    scholarly: "Gathered by several generations of followers, c. 5th to 3rd century BCE.",
    span: [-479, -250],
  },
  {
    work: "tao-te-ching",
    book: "ttc",
    title: "Tao Te Ching",
    tradition: "Taoist",
    traditional: "Written by Laozi, an older contemporary of Confucius, in the 6th century BCE.",
    tradSpan: [-550, -480],
    scholarly: "Probably took shape c. 400 to 250 BCE; the oldest copy found (Guodian, c. 300 BCE) has parts of it.",
    span: [-400, -250],
  },
  {
    work: "jaina",
    book: "akaranga",
    title: "Jaina Sutras (Agamas)",
    tradition: "Jain",
    traditional: "The teachings of Mahavira, kept by heart by his followers. In the Svetambara account they were written down at the council of Valabhi; Digambara Jains hold that the original texts were lost.",
    scholarly: "The oldest parts (such as the Akaranga) from the last centuries BCE or earlier; written down in the 5th century CE (the Svetambara canon, at Valabhi).",
    span: [-400, 460],
  },
  {
    work: "zhuangzi",
    book: "zhuangzi",
    title: "Zhuangzi",
    tradition: "Taoist",
    traditional: "The writings of Zhuang Zhou, a 4th century BCE sage.",
    scholarly: "The “inner chapters” are often linked to Zhuang Zhou himself; the rest added by followers, into the 2nd century BCE.",
    span: [-350, -150],
  },
  {
    work: "mencius",
    book: "mencius",
    title: "Mencius",
    tradition: "Confucian",
    traditional: "The conversations of Mencius (4th century BCE), recorded by him and his disciples.",
    scholarly: "Compiled by his disciples, late 4th to 3rd century BCE.",
    span: [-330, -230],
    agreed: true,
  },
  {
    work: "enoch",
    book: "1en",
    title: "1 Enoch",
    tradition: "Jewish and Christian (Scripture in the Ethiopian Church)",
    traditional: "The visions of Enoch, the ancestor before the Flood.",
    scholarly: "Several parts written c. 300 BCE to the turn of the era; copies were found among the Dead Sea Scrolls.",
    span: [-300, 0],
  },
  {
    work: "ramayana",
    book: "ry1",
    title: "Ramayana",
    tradition: "Hindu",
    traditional: "Composed by the sage Valmiki, the first poet, in Rama's own time in a far earlier age.",
    scholarly: "Composed and expanded over centuries, roughly c. 5th century BCE to 3rd century CE.",
    span: [-500, 300],
  },
  {
    work: "mahabharata",
    book: "mbh1",
    title: "Mahabharata",
    tradition: "Hindu",
    traditional: "Composed by the sage Vyasa, who also takes part in its story, in a far earlier age.",
    scholarly: "Grew over centuries, roughly c. 400 BCE to 400 CE.",
    span: [-400, 400],
  },
  {
    work: "gita",
    book: "gita",
    title: "Bhagavad Gita",
    tradition: "Hindu",
    traditional: "Spoken by Krishna to Arjuna on the field of Kurukshetra, thousands of years ago, at the start of the present age.",
    scholarly: "Part of the Mahabharata; usually dated c. 2nd century BCE to 2nd century CE.",
    span: [-200, 200],
  },
  {
    work: "manu",
    book: "manu",
    title: "Laws of Manu",
    tradition: "Hindu",
    traditional: "The teaching of Manu, the first lawgiver of humankind.",
    scholarly: "Usually dated c. 2nd century BCE to 3rd century CE.",
    span: [-200, 250],
  },
  {
    work: "yoga-sutras",
    book: "ys",
    title: "Yoga Sutras of Patanjali",
    tradition: "Hindu (Yoga)",
    traditional: "Composed by the sage Patanjali, sometimes identified with the grammarian of the 2nd century BCE.",
    scholarly: "Dates vary widely, from c. 2nd century BCE to c. 400 CE; many scholars lean to the later end.",
    span: [-200, 450],
  },
  {
    work: "lotus",
    book: "lotus",
    title: "Lotus Sutra",
    tradition: "Buddhist (Mahayana)",
    traditional: "Taught by the Buddha on Vulture Peak late in his life.",
    scholarly: "Composed in stages, c. 1st century BCE to 2nd century CE; first put into Chinese in 286 CE.",
    span: [-100, 200],
  },
  {
    work: "bible",
    book: "rom",
    title: "Letters of Paul",
    tradition: "Christian",
    traditional: "Thirteen letters by the apostle Paul, c. 50 to the mid 60s CE.",
    tradSpan: [48, 67],
    scholarly: "Seven letters nearly all scholars agree are Paul's, c. 50 to 60 CE; whether he wrote the others is debated.",
    span: [50, 60],
  },
  {
    work: "bible",
    book: "mat",
    title: "Gospels",
    tradition: "Christian",
    traditional: "Written by Matthew, Mark (Peter's companion), Luke (Paul's companion) and the apostle John, in the later 1st century.",
    tradSpan: [50, 95],
    scholarly: "Mark c. 65 to 75 CE, Matthew and Luke c. 80 to 90, John c. 90 to 110.",
    span: [65, 110],
  },
  {
    work: "thomas",
    book: "gth",
    title: "Gospel of Thomas",
    tradition: "Early Christian (outside the canon)",
    traditional: "Presents itself as hidden sayings of Jesus written down by Didymos Judas Thomas.",
    scholarly: "Debated: dates from the mid 1st to the mid 2nd century are proposed; the oldest fragments are from c. 200 CE.",
    span: [50, 150],
  },
  {
    work: "mishnah",
    book: "berakhot",
    title: "Mishnah",
    tradition: "Jewish",
    traditional: "The Oral Torah given at Sinai alongside the written one, set down c. 200 CE by Rabbi Judah the Prince.",
    scholarly: "Edited c. 200 CE under Rabbi Judah the Prince, from earlier rabbinic teaching.",
    span: [190, 220],
    agreed: true,
  },
  {
    work: "talmud",
    book: "berakhot",
    title: "Babylonian Talmud",
    tradition: "Jewish",
    traditional: "Discussions of the rabbis of Babylonia, brought to a close by Rav Ashi and Ravina c. 500 CE.",
    tradSpan: [200, 500],
    scholarly: "Discussions from c. 200 to 500 CE; editing by later, unnamed rabbis went on to c. 600 to 700.",
    span: [200, 700],
  },
  {
    work: "quran",
    book: "quran",
    title: "Quran",
    tradition: "Muslim",
    traditional:
      "Revealed to the Prophet Muhammad over about 23 years (610 to 632 CE), gathered as one written book under Caliph Uthman c. 650.",
    tradSpan: [610, 653],
    scholarly:
      "Most historians agree the text took its standard form within a few decades of Muhammad; very early manuscripts support this.",
    span: [610, 660],
  },
  {
    work: "kojiki",
    book: "kojiki",
    title: "Kojiki",
    tradition: "Shinto",
    traditional: "The ancient records of Japan's gods and rulers, put into writing at the court's request.",
    scholarly: "Presented to the court in 712 CE by O no Yasumaro.",
    span: [712, 712],
    exact: true,
    agreed: true,
  },
  {
    work: "hadith",
    book: "bukhari",
    title: "Sahih al-Bukhari",
    tradition: "Muslim (Sunni)",
    traditional: "Reports of the Prophet's words and deeds, chosen with great care by al-Bukhari (died 870 CE).",
    scholarly: "Compiled by al-Bukhari in the mid 9th century; historians differ on how far single reports go back.",
    span: [820, 870],
    agreed: true,
  },
  {
    work: "popol-vuh",
    book: "popol-vuh",
    title: "Popol Vuh",
    tradition: "K’iche’ Maya",
    traditional: "Ancient K’iche’ accounts of creation and of their lords, from a much older book.",
    scholarly: "Written in K’iche’ in Latin letters c. 1550s; the copy that survives is from c. 1701.",
    span: [1550, 1560],
  },
  {
    work: "ggs",
    book: "opening-banis-japji-so-dar-sohila",
    title: "Guru Granth Sahib",
    tradition: "Sikh",
    traditional:
      "Hymns of the Gurus and saints, compiled by Guru Arjan in 1604; Guru Gobind Singh added the ninth Guru's hymns and named it the Guru in 1708.",
    scholarly: "The same: compiled 1604, completed c. 1706; its hymns span from the 12th century (Sheikh Farid) to the 17th.",
    span: [1604, 1706],
    agreed: true,
  },
  {
    work: "hidden-words",
    book: "hw",
    title: "Hidden Words and Kitáb-i-Aqdas",
    tradition: "Bahá’í",
    traditional: "Revealed by Bahá’u’lláh: the Hidden Words c. 1858 in Baghdad, the Kitáb-i-Aqdas c. 1873 in Akka.",
    scholarly: "The same dates: c. 1858 and c. 1873.",
    span: [1858, 1873],
    agreed: true,
  },
];

/** "c. 1500 BCE", "c. 65 CE". */
export function yearLabel(y: number): string {
  if (y === 0) return "the turn of the era";
  return y < 0 ? `${-y} BCE` : `${y} CE`;
}

export function spanLabel([a, b]: Span): string {
  if (a === b) return yearLabel(a);
  if (a < 0 && b < 0) return `${-a} to ${-b} BCE`;
  if (a > 0 && b > 0) return `${a} to ${b} CE`;
  return `${yearLabel(a)} to ${yearLabel(b)}`;
}
