/**
 * Echoes (hidden study page /echoes, my brother's ticket 7a62bb28): where later texts quote, echo or retell earlier
 * ones. Three parts, all data here except the cross-reference counts (public/echoes, scripts/build-echoes.mts):
 *   1. the Bible's cross references book to book, drawn as an arc diagram;
 *   2. well-known direct quotations of the Old Testament in the New;
 *   3. stories told in more than one tradition, each in its own words (parallels, never claims of borrowing).
 * A verse is "work/book/chapter:verse" ("bible/isa/7:14", "quran/quran/12:4", "gilgamesh/gilgamesh/11:11").
 * Every reference was checked against the site's texts (KJV, Pickthall, Thompson) on Nov 26 2026.
 */

/** The 66 books in order, Old Testament first (the same ids as public/texts/bible). */
export const ECHO_BOOKS =
  "gen exo lev num deu jos jdg rut 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro ecc sng isa jer lam ezk dan hos jol amo oba jon mic nam hab zep hag zec mal mat mrk luk jhn act rom 1co 2co gal eph php col 1th 2th 1ti 2ti tit phm heb jas 1pe 2pe 1jn 2jn 3jn jud rev".split(
    " ",
  );
/** Index of Matthew: books before it are the Old Testament. */
export const NT_START = 39;

/** The version each work is shown in. */
export const ECHO_VERSION: Record<string, string> = { bible: "kjv", quran: "pickthall", gilgamesh: "thompson" };

export type VerseRef = { work: string; book: string; chapter: number; verse: string };
export function parseVerse(s: string): VerseRef {
  const [work, book, cv] = s.split("/");
  const [c, v] = cv.split(":");
  return { work, book, chapter: Number(c), verse: v };
}

/** A quotation: the Old Testament verse and the New Testament verse that quotes it. */
export type Quotation = { from: string; to: string; note?: string };

export const QUOTATIONS: Quotation[] = [
  { from: "bible/isa/7:14", to: "bible/mat/1:23" },
  { from: "bible/mic/5:2", to: "bible/mat/2:6" },
  { from: "bible/hos/11:1", to: "bible/mat/2:15" },
  { from: "bible/jer/31:15", to: "bible/mat/2:18" },
  { from: "bible/isa/40:3", to: "bible/mat/3:3" },
  { from: "bible/deu/8:3", to: "bible/mat/4:4", note: "Jesus in the wilderness" },
  { from: "bible/deu/6:16", to: "bible/mat/4:7", note: "Jesus in the wilderness" },
  { from: "bible/deu/6:13", to: "bible/mat/4:10", note: "Jesus in the wilderness" },
  { from: "bible/isa/61:1", to: "bible/luk/4:18", note: "read aloud in the synagogue at Nazareth" },
  { from: "bible/isa/6:9", to: "bible/mat/13:14" },
  { from: "bible/gen/2:24", to: "bible/mat/19:5" },
  { from: "bible/zec/9:9", to: "bible/mat/21:5" },
  { from: "bible/psa/8:2", to: "bible/mat/21:16" },
  { from: "bible/psa/118:22", to: "bible/mat/21:42" },
  { from: "bible/deu/6:5", to: "bible/mat/22:37", note: "the first and great commandment" },
  { from: "bible/lev/19:18", to: "bible/mat/22:39", note: "the second commandment, like the first" },
  { from: "bible/psa/110:1", to: "bible/mat/22:44" },
  { from: "bible/zec/13:7", to: "bible/mat/26:31" },
  { from: "bible/psa/22:1", to: "bible/mat/27:46", note: "words from the cross" },
  { from: "bible/psa/69:9", to: "bible/jhn/2:17" },
  { from: "bible/isa/53:1", to: "bible/jhn/12:38" },
  { from: "bible/psa/22:18", to: "bible/jhn/19:24" },
  { from: "bible/exo/12:46", to: "bible/jhn/19:36" },
  { from: "bible/zec/12:10", to: "bible/jhn/19:37" },
  { from: "bible/jol/2:28", to: "bible/act/2:17", note: "Peter at Pentecost" },
  { from: "bible/psa/16:10", to: "bible/act/2:27", note: "Peter at Pentecost" },
  { from: "bible/isa/53:7", to: "bible/act/8:32", note: "read by the Ethiopian on the road" },
  { from: "bible/hab/2:4", to: "bible/rom/1:17" },
  { from: "bible/psa/14:3", to: "bible/rom/3:12" },
  { from: "bible/gen/15:6", to: "bible/rom/4:3" },
  { from: "bible/jol/2:32", to: "bible/rom/10:13" },
  { from: "bible/isa/52:7", to: "bible/rom/10:15" },
  { from: "bible/deu/32:35", to: "bible/rom/12:19" },
  { from: "bible/gen/12:3", to: "bible/gal/3:8" },
  { from: "bible/psa/2:7", to: "bible/heb/1:5" },
  { from: "bible/jer/31:31", to: "bible/heb/8:8" },
  { from: "bible/pro/3:11", to: "bible/heb/12:5" },
  { from: "bible/lev/11:44", to: "bible/1pe/1:16" },
  { from: "bible/isa/40:6", to: "bible/1pe/1:24" },
  { from: "bible/pro/3:34", to: "bible/jas/4:6" },
];

/** One tradition's telling: where it is, and a few of its own verses to read here. */
export type Telling = { tradition: string; where: string; read: string; verses: string[] };
export type Parallel = { id: string; title: string; note: string; tellings: Telling[] };

export const PARALLELS: Parallel[] = [
  {
    id: "flood",
    title: "Noah and the flood",
    note: "A great flood, a man told to build a vessel, and a new beginning when the waters go down. The Bible and the Quran tell it of Noah; the Epic of Gilgamesh, from ancient Mesopotamia, in its eleventh tablet has Uta-Napishtim tell a flood story of his own.",
    tellings: [
      { tradition: "Bible", where: "Genesis 6 to 9", read: "bible/gen/6:1", verses: ["bible/gen/6:13", "bible/gen/6:14", "bible/gen/8:4", "bible/gen/8:8", "bible/gen/8:9"] },
      { tradition: "Quran", where: "Surah 11:25 to 49, and Surah 71", read: "quran/quran/11:25", verses: ["quran/quran/11:37", "quran/quran/11:40", "quran/quran/11:44", "quran/quran/71:1"] },
      { tradition: "Epic of Gilgamesh", where: "Tablet 11", read: "gilgamesh/gilgamesh/11:2", verses: ["gilgamesh/gilgamesh/11:2", "gilgamesh/gilgamesh/11:11"] },
    ],
  },
  {
    id: "joseph",
    title: "Joseph and his brothers",
    note: "A favoured son's dream, his brothers' jealousy, slavery in Egypt, a false accusation, and a reunion. Genesis gives it fourteen chapters; the Quran gives it one whole surah, which speaks of it as the best of narratives.",
    tellings: [
      { tradition: "Bible", where: "Genesis 37 to 50", read: "bible/gen/37:1", verses: ["bible/gen/37:9", "bible/gen/39:12", "bible/gen/45:4"] },
      { tradition: "Quran", where: "Surah 12, Joseph", read: "quran/quran/12:1", verses: ["quran/quran/12:4", "quran/quran/12:28", "quran/quran/12:90"] },
    ],
  },
  {
    id: "bush",
    title: "Moses at the burning bush",
    note: "Moses sees a fire, comes near, is told to take off his shoes on holy ground, and is sent to Pharaoh.",
    tellings: [
      { tradition: "Bible", where: "Exodus 3", read: "bible/exo/3:1", verses: ["bible/exo/3:2", "bible/exo/3:4", "bible/exo/3:5", "bible/exo/3:10"] },
      { tradition: "Quran", where: "Surah 20:9 to 24, and 28:29 to 35", read: "quran/quran/20:9", verses: ["quran/quran/28:29", "quran/quran/20:11", "quran/quran/20:12", "quran/quran/28:30"] },
    ],
  },
  {
    id: "annunciation",
    title: "Mary and the angel",
    note: "An angel comes to Mary with news of a son; she asks how this can be, as no man has touched her, and is answered that it is God's doing.",
    tellings: [
      { tradition: "Bible", where: "Luke 1:26 to 38", read: "bible/luk/1:26", verses: ["bible/luk/1:30", "bible/luk/1:31", "bible/luk/1:34", "bible/luk/1:35"] },
      { tradition: "Quran", where: "Surah 19:16 to 21, Mary", read: "quran/quran/19:16", verses: ["quran/quran/19:19", "quran/quran/19:20", "quran/quran/19:21"] },
    ],
  },
  {
    id: "guests",
    title: "Abraham's guests",
    note: "Visitors come to Abraham, he hurries to feed them, and they bring word that his aged wife will have a son; she laughs.",
    tellings: [
      { tradition: "Bible", where: "Genesis 18", read: "bible/gen/18:1", verses: ["bible/gen/18:2", "bible/gen/18:8", "bible/gen/18:10", "bible/gen/18:12"] },
      { tradition: "Quran", where: "Surah 11:69 to 73, and 51:24 to 30", read: "quran/quran/11:69", verses: ["quran/quran/11:69", "quran/quran/11:71", "quran/quran/11:72", "quran/quran/51:28", "quran/quran/51:29"] },
    ],
  },
  {
    id: "brothers",
    title: "The two sons of Adam",
    note: "Two brothers bring offerings, one is accepted, and the other kills him. Genesis names them Cain and Abel; the Quran calls them the two sons of Adam.",
    tellings: [
      { tradition: "Bible", where: "Genesis 4:1 to 16", read: "bible/gen/4:1", verses: ["bible/gen/4:4", "bible/gen/4:5", "bible/gen/4:8", "bible/gen/4:9"] },
      { tradition: "Quran", where: "Surah 5:27 to 32", read: "quran/quran/5:27", verses: ["quran/quran/5:27", "quran/quran/5:30", "quran/quran/5:31"] },
    ],
  },
  {
    id: "jonah",
    title: "Jonah and the great fish",
    note: "A prophet runs from his task, is swallowed by a great fish, and is brought out again; his city turns back to God.",
    tellings: [
      { tradition: "Bible", where: "The book of Jonah", read: "bible/jon/1:1", verses: ["bible/jon/1:17", "bible/jon/2:10", "bible/jon/3:10"] },
      { tradition: "Quran", where: "Surah 37:139 to 148", read: "quran/quran/37:139", verses: ["quran/quran/37:140", "quran/quran/37:142", "quran/quran/37:145", "quran/quran/37:148"] },
    ],
  },
  {
    id: "garden",
    title: "The garden and the tree",
    note: "The first man and woman live in a garden, are told not to come near one tree, eat from it, and leave the garden.",
    tellings: [
      { tradition: "Bible", where: "Genesis 2 and 3", read: "bible/gen/2:8", verses: ["bible/gen/2:16", "bible/gen/2:17", "bible/gen/3:6", "bible/gen/3:23"] },
      { tradition: "Quran", where: "Surah 2:35 to 38, and 7:19 to 25", read: "quran/quran/7:19", verses: ["quran/quran/2:35", "quran/quran/7:22", "quran/quran/7:23"] },
    ],
  },
];
