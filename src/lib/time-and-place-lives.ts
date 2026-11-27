/**
 * "When they lived" (Time and place, study lab): the lives of figures from the scriptures on the site, each with the
 * tradition's own dating beside the usual historians' view, where they lived, and the texts on the site where they
 * appear. Plain data, safe on the server and in old Safari; no fetches.
 *
 * Kept conservative: broad "c." ranges widely given in standard reference works, worded neutrally. Where historians
 * have no independent evidence for a figure, the entry says so plainly and gives only the tradition's dating. No
 * tradition is ranked above another. Places: `id` is an OpenBible.info id in public/places/index.json (it opens the
 * place page); `geo` is [longitude, latitude] for a place that is not a Bible place (a dot only, no page).
 */
import type { Span } from "./time-and-place";

export type LifeRole =
  | "patriarch"
  | "prophet"
  | "king"
  | "leader"
  | "scribe"
  | "sage"
  | "teacher"
  | "founder"
  | "apostle"
  | "companion"
  | "guru";

export const ROLE_LABEL: Record<LifeRole, string> = {
  patriarch: "Patriarch",
  prophet: "Prophet",
  king: "King",
  leader: "Leader",
  scribe: "Priest and scribe",
  sage: "Sage",
  teacher: "Teacher",
  founder: "Founder",
  apostle: "Apostle",
  companion: "Companion",
  guru: "Guru",
};

export const LIFE_TRADITIONS = [
  "Bahá’í",
  "Buddhist",
  "Christian",
  "Confucian",
  "Hindu",
  "Jain",
  "Jewish",
  "Muslim",
  "Shinto",
  "Sikh",
  "Taoist",
  "Zoroastrian",
] as const;
export type LifeTradition = (typeof LIFE_TRADITIONS)[number];

/** A place in a life: a Bible place (opens its place page) or another place (a dot only), or neither (text only). */
export type LifePlace = { n: string; note?: string; id?: string; geo?: [number, number] };

/** A text on the site where the figure appears. */
export type LifeText = { work: string; book: string; chapter: number; verse?: number; label: string };

export type Life = {
  id: string;
  name: string;
  /** Other names. */
  also?: string;
  traditions: LifeTradition[];
  roles: LifeRole[];
  /** One or two plain sentences: who they were, as their traditions see them. */
  summary: string;
  /** The short date shown on the timeline row. */
  when: string;
  /** How the tradition dates the life. */
  traditional: string;
  /** The tradition's dates, when they can be drawn (a life, a reign or a ministry). */
  tradSpan?: Span;
  /** The usual historians' view. */
  scholarly: string;
  /** The historians' range, when they give one. */
  span?: Span;
  /** Tradition and historians broadly agree (shown as one). */
  agreed?: boolean;
  /** The kind of source the dates rest on. */
  source: string;
  places: LifePlace[];
  texts: LifeText[];
};

/** Epochs for the filter: a figure is in every epoch its historians' range or its traditional dates touch. */
export const LIFE_ERAS: { id: string; name: string; span: Span }[] = [
  { id: "early", name: "Before 1000 BCE", span: [-99999, -1000] },
  { id: "kings", name: "1000 to 500 BCE", span: [-1000, -500] },
  { id: "axial", name: "500 BCE to the turn of the era", span: [-500, 0] },
  { id: "first", name: "1 to 1000 CE", span: [0, 1000] },
  { id: "late", name: "1000 CE to modern times", span: [1000, 2100] },
];

const overlaps = (a: Span, b: Span) => a[0] <= b[1] && b[0] <= a[1];
export function lifeInEra(l: Life, era: Span): boolean {
  return (!!l.span && overlaps(l.span, era)) || (!!l.tradSpan && overlaps(l.tradSpan, era));
}
/** The year a life is sorted by: the historians' range when there is one, otherwise the tradition's. */
export function lifeYear(l: Life): number {
  return (l.span ?? l.tradSpan ?? [0, 0])[0];
}

const NO_EVIDENCE = "Historians have no independent evidence for his dates.";

export const LIVES: Life[] = [
  {
    id: "abraham",
    name: "Abraham",
    also: "Abram, Ibrahim",
    traditions: ["Jewish", "Christian", "Muslim"],
    roles: ["patriarch", "prophet"],
    summary:
      "The father of the covenant in Genesis, called to leave his homeland for Canaan. Jews, Christians and Muslims all look to him as a father in faith; the Quran honours him as a prophet and friend of God.",
    when: "Tradition: c. 2000 to 1650 BCE",
    traditional:
      "Genesis gives no calendar dates, but counting back through its ages and reigns, Jewish tradition places his birth around 1800 BCE and many Christian chronologies around 2000 BCE.",
    tradSpan: [-2000, -1640],
    scholarly: `${NO_EVIDENCE} Some have compared the setting of the stories with the early 2nd millennium BCE; many scholars think the stories took their written form much later, in the time of the kings or after.`,
    source: "Hebrew Bible (Genesis 11 to 25) and the Quran; most historians find no evidence outside the scriptures.",
    places: [
      { n: "Ur", note: "where Genesis says he set out from", id: "a6cf75c/ur-1" },
      { n: "Haran", note: "where his family settled on the way", id: "a6d9af3/haran" },
      { n: "Hebron", note: "where he lived and was buried", id: "a85151a/hebron" },
    ],
    texts: [
      { work: "bible", book: "gen", chapter: 12, verse: 1, label: "Genesis 12:1" },
      { work: "bible", book: "gen", chapter: 22, verse: 1, label: "Genesis 22:1" },
      { work: "quran", book: "quran", chapter: 14, verse: 35, label: "Quran 14:35 (Surah Ibrahim)" },
      { work: "quran", book: "quran", chapter: 2, verse: 124, label: "Quran 2:124" },
      { work: "bible", book: "rom", chapter: 4, verse: 3, label: "Romans 4:3" },
    ],
  },
  {
    id: "joseph",
    name: "Joseph",
    also: "Yusuf",
    traditions: ["Jewish", "Christian", "Muslim"],
    roles: ["patriarch"],
    summary:
      "The son of Jacob sold into slavery by his brothers, who rose to govern Egypt and saved his family in a famine. The Quran tells his story in a whole surah.",
    when: "Tradition: c. 1560 to 1450 BCE",
    traditional:
      "Jewish tradition places his life about 1560 to 1450 BCE; some Christian chronologies place it about two centuries earlier (c. 1745 to 1635 BCE).",
    tradSpan: [-1562, -1452],
    scholarly: `${NO_EVIDENCE} The Egyptian details of the story have been compared with several different periods.`,
    source: "Hebrew Bible (Genesis 37 to 50) and the Quran (Surah 12); no evidence outside the scriptures.",
    places: [
      { n: "Hebron", note: "his father's home", id: "a85151a/hebron" },
      { n: "Egypt", id: "af301ca/egypt" },
      { n: "Goshen", note: "where his family settled in Egypt", id: "a60f092/goshen-1" },
    ],
    texts: [
      { work: "bible", book: "gen", chapter: 37, verse: 3, label: "Genesis 37:3" },
      { work: "bible", book: "gen", chapter: 41, verse: 41, label: "Genesis 41:41" },
      { work: "quran", book: "quran", chapter: 12, verse: 4, label: "Quran 12:4 (Surah Yusuf)" },
    ],
  },
  {
    id: "moses",
    name: "Moses",
    also: "Moshe, Musa",
    traditions: ["Jewish", "Christian", "Muslim"],
    roles: ["prophet", "leader"],
    summary:
      "The prophet who led Israel out of Egypt and received the Law at Sinai. In the Quran he is the prophet named most often.",
    when: "Tradition: c. 1500 to 1270 BCE",
    traditional:
      "Jewish tradition dates his life to about 1391 to 1271 BCE. Many Christian chronologies, reading 1 Kings 6:1, place the Exodus around 1446 BCE.",
    tradSpan: [-1526, -1271],
    scholarly: `${NO_EVIDENCE} No source from the time names Moses or the Exodus. Scholars who see a historical memory behind the story most often place it in the 13th century BCE; the name Israel first appears outside the Bible on an Egyptian stone of c. 1208 BCE (the Merneptah Stele).`,
    source: "Hebrew Bible (Exodus to Deuteronomy) and the Quran; most historians find no evidence outside the scriptures.",
    places: [
      { n: "Egypt", note: "where he was born and raised", id: "af301ca/egypt" },
      { n: "Midian", note: "where he fled and kept sheep", id: "acc6d8e/midian" },
      { n: "Mount Sinai", note: "the traditional site", id: "abfba2a/mount-sinai" },
      { n: "Mount Nebo", note: "where he saw the promised land and died", id: "aefaa2d/mount-nebo" },
    ],
    texts: [
      { work: "bible", book: "exo", chapter: 3, verse: 4, label: "Exodus 3:4" },
      { work: "bible", book: "exo", chapter: 20, verse: 1, label: "Exodus 20:1" },
      { work: "bible", book: "deu", chapter: 34, verse: 5, label: "Deuteronomy 34:5" },
      { work: "quran", book: "quran", chapter: 20, verse: 9, label: "Quran 20:9 (Surah Ta Ha)" },
      { work: "quran", book: "quran", chapter: 28, verse: 7, label: "Quran 28:7" },
    ],
  },
  {
    id: "samuel",
    name: "Samuel",
    traditions: ["Jewish", "Christian"],
    roles: ["prophet", "leader"],
    summary: "The last of the judges and a prophet, who anointed Saul and then David as king.",
    when: "Tradition: 11th century BCE",
    traditional: "The books of Samuel set his life in the 11th century BCE, before and during the reign of Saul.",
    tradSpan: [-1100, -1015],
    scholarly: `${NO_EVIDENCE} Historians who see a historical figure behind the stories place him where the books do, in the 11th century BCE.`,
    source: "Hebrew Bible (1 Samuel); no evidence outside the Bible.",
    places: [
      { n: "Shiloh", note: "where he grew up at the sanctuary", id: "aa4680a/shiloh" },
      { n: "Ramah", note: "his home", id: "a90f6e1/ramah-4" },
    ],
    texts: [
      { work: "bible", book: "1sa", chapter: 3, verse: 10, label: "1 Samuel 3:10" },
      { work: "bible", book: "1sa", chapter: 16, verse: 13, label: "1 Samuel 16:13" },
    ],
  },
  {
    id: "david",
    name: "David",
    also: "Dawud",
    traditions: ["Jewish", "Christian", "Muslim"],
    roles: ["king", "prophet"],
    summary:
      "The shepherd who became king of Israel, made Jerusalem his capital and, by tradition, wrote many of the Psalms. The Quran honours him as a prophet given the Psalms (Zabur).",
    when: "c. 1010 to 970 BCE (reign)",
    traditional: "He reigned forty years (2 Samuel 5:4); the usual Bible chronology gives about 1010 to 970 BCE.",
    tradSpan: [-1040, -970],
    scholarly:
      "Most historians accept that David was a real king in the 10th century BCE: a stone from Tel Dan, of the 9th century BCE, has a phrase that most scholars read as “House of David”. How large and strong his kingdom was is debated.",
    span: [-1010, -970],
    source: "Hebrew Bible (1 and 2 Samuel); the Tel Dan inscription; most historians accept a 10th century BCE king.",
    places: [
      { n: "Bethlehem", note: "his home town", id: "a112427/bethlehem-1" },
      { n: "Hebron", note: "where he first reigned", id: "a85151a/hebron" },
      { n: "Jerusalem", note: "his capital", id: "a15257a/jerusalem" },
    ],
    texts: [
      { work: "bible", book: "1sa", chapter: 16, verse: 13, label: "1 Samuel 16:13" },
      { work: "bible", book: "2sa", chapter: 5, verse: 4, label: "2 Samuel 5:4" },
      { work: "bible", book: "psa", chapter: 23, label: "Psalm 23" },
      { work: "quran", book: "quran", chapter: 38, verse: 17, label: "Quran 38:17" },
    ],
  },
  {
    id: "solomon",
    name: "Solomon",
    also: "Shlomo, Sulayman",
    traditions: ["Jewish", "Christian", "Muslim"],
    roles: ["king", "prophet", "sage"],
    summary:
      "David's son, remembered for his wisdom and for building the Temple in Jerusalem. Proverbs, Ecclesiastes and the Song of Songs carry his name; the Quran honours him as a prophet.",
    when: "c. 970 to 931 BCE (reign)",
    traditional: "He reigned forty years (1 Kings 11:42), usually dated about 970 to 931 BCE.",
    tradSpan: [-970, -931],
    scholarly:
      "No inscription of his time names him. Most historians accept a son of David who ruled in Jerusalem in the 10th century BCE; the size and wealth of his kingdom are much debated.",
    span: [-970, -931],
    source: "Hebrew Bible (1 Kings 1 to 11) and the Quran; historians debate the scale, not usually the king.",
    places: [{ n: "Jerusalem", note: "where he built the Temple", id: "a15257a/jerusalem" }],
    texts: [
      { work: "bible", book: "1ki", chapter: 3, verse: 5, label: "1 Kings 3:5" },
      { work: "bible", book: "1ki", chapter: 6, verse: 1, label: "1 Kings 6:1" },
      { work: "bible", book: "pro", chapter: 1, verse: 1, label: "Proverbs 1:1" },
      { work: "quran", book: "quran", chapter: 27, verse: 15, label: "Quran 27:15" },
    ],
  },
  {
    id: "elijah",
    name: "Elijah",
    also: "Elias, Ilyas",
    traditions: ["Jewish", "Christian", "Muslim"],
    roles: ["prophet"],
    summary:
      "The prophet who stood against the worship of Baal in the days of King Ahab and was taken up to heaven in a whirlwind. Jews await his return before the Messiah; the Quran names him among the messengers.",
    when: "9th century BCE (Ahab's reign)",
    traditional: "He prophesied in the reigns of Ahab and Ahaziah of Israel, in the 9th century BCE.",
    tradSpan: [-875, -850],
    scholarly:
      "Historians have no independent evidence for Elijah himself. His stories are set in the reign of King Ahab (c. 874 to 853 BCE), who is named in an Assyrian inscription of 853 BCE.",
    source: "Hebrew Bible (1 Kings 17 to 2 Kings 2); Assyrian records date Ahab, not Elijah.",
    places: [
      { n: "Gilead", note: "his homeland (Tishbe, in Gilead)", id: "ae73b90/gilead-1" },
      { n: "Zarephath", note: "where he stayed with a widow", id: "a6fa2d3/zarephath" },
      { n: "Mount Carmel", note: "the contest with the prophets of Baal", id: "a3e21c6/mount-carmel" },
      { n: "Jordan", note: "where he was taken up", id: "ae686c9/jordan" },
    ],
    texts: [
      { work: "bible", book: "1ki", chapter: 17, verse: 1, label: "1 Kings 17:1" },
      { work: "bible", book: "1ki", chapter: 18, verse: 36, label: "1 Kings 18:36" },
      { work: "bible", book: "2ki", chapter: 2, verse: 11, label: "2 Kings 2:11" },
      { work: "bible", book: "mal", chapter: 4, verse: 5, label: "Malachi 4:5 (3:23 in Hebrew Bibles)" },
      { work: "quran", book: "quran", chapter: 37, verse: 123, label: "Quran 37:123" },
    ],
  },
  {
    id: "isaiah",
    name: "Isaiah",
    traditions: ["Jewish", "Christian"],
    roles: ["prophet"],
    summary: "A prophet of Jerusalem in the days of the Assyrian empire, whose book speaks of judgment, comfort and hope.",
    when: "c. 740 to 700 BCE",
    traditional:
      "Isaiah son of Amoz prophesied in Jerusalem under Uzziah, Jotham, Ahaz and Hezekiah (Isaiah 1:1), about 740 to 700 BCE. Tradition holds he wrote the whole book, and that he died a martyr under Manasseh.",
    tradSpan: [-740, -687],
    scholarly:
      "Historians broadly accept Isaiah of Jerusalem in the late 8th century BCE (King Hezekiah and the Assyrian attack of 701 BCE are known from Assyrian records). Most scholars date chapters 40 to 66 later, to the exile and after.",
    span: [-740, -700],
    source: "Hebrew Bible (Isaiah; 2 Kings 19 to 20); Assyrian records date his kings.",
    places: [{ n: "Jerusalem", id: "a15257a/jerusalem" }],
    texts: [
      { work: "bible", book: "isa", chapter: 1, verse: 1, label: "Isaiah 1:1" },
      { work: "bible", book: "isa", chapter: 6, verse: 8, label: "Isaiah 6:8" },
      { work: "bible", book: "2ki", chapter: 19, verse: 2, label: "2 Kings 19:2" },
    ],
  },
  {
    id: "hezekiah",
    name: "Hezekiah",
    traditions: ["Jewish", "Christian"],
    roles: ["king"],
    summary: "A king of Judah who reformed worship and held Jerusalem when the Assyrian army came.",
    when: "c. 715 to 686 BCE (reign)",
    traditional: "He reigned twenty-nine years in Jerusalem (2 Kings 18:2).",
    scholarly:
      "Well attested: the annals of the Assyrian king Sennacherib name him and describe the siege of Jerusalem in 701 BCE. His reign is usually dated c. 715 to 686 BCE (some date its start to 727).",
    span: [-715, -686],
    agreed: true,
    source: "Hebrew Bible (2 Kings 18 to 20, Isaiah 36 to 39); Assyrian annals.",
    places: [{ n: "Jerusalem", id: "a15257a/jerusalem" }],
    texts: [
      { work: "bible", book: "2ki", chapter: 18, verse: 1, label: "2 Kings 18:1" },
      { work: "bible", book: "isa", chapter: 36, verse: 1, label: "Isaiah 36:1" },
    ],
  },
  {
    id: "jeremiah",
    name: "Jeremiah",
    traditions: ["Jewish", "Christian"],
    roles: ["prophet"],
    summary: "The prophet who warned Jerusalem before its fall to Babylon, and wept for it after.",
    when: "c. 627 to after 586 BCE",
    traditional:
      "Called in the thirteenth year of King Josiah (Jeremiah 1:2), about 627 BCE, he prophesied until after Jerusalem fell in 587 or 586 BCE, and was taken to Egypt.",
    scholarly:
      "Historians broadly agree that he was active from the late 7th century BCE until after the fall of Jerusalem; the book was edited and added to afterwards.",
    span: [-627, -580],
    agreed: true,
    source: "Hebrew Bible (Jeremiah); Babylonian chronicles date the fall of Jerusalem.",
    places: [
      { n: "Anathoth", note: "his home town", id: "ab34789/anathoth" },
      { n: "Jerusalem", id: "a15257a/jerusalem" },
      { n: "Tahpanhes", note: "in Egypt, where he was taken", id: "adb008c/tahpanhes" },
    ],
    texts: [
      { work: "bible", book: "jer", chapter: 1, verse: 1, label: "Jeremiah 1:1" },
      { work: "bible", book: "jer", chapter: 36, verse: 4, label: "Jeremiah 36:4" },
    ],
  },
  {
    id: "ezekiel",
    name: "Ezekiel",
    traditions: ["Jewish", "Christian"],
    roles: ["prophet"],
    summary: "A priest taken to Babylon with the exiles, whose visions include the valley of dry bones.",
    when: "c. 593 to 571 BCE (visions)",
    traditional: "Taken to Babylon in 597 BCE; his visions are dated from the fifth year of the exile to the twenty-seventh (593 to 571 BCE).",
    scholarly: "Historians broadly accept these dates for the prophet; the book may have been edited by his followers.",
    span: [-593, -571],
    agreed: true,
    source: "Hebrew Bible (Ezekiel, which dates its own visions).",
    places: [
      { n: "Chebar", note: "the canal in Babylonia where he lived among the exiles", id: "a3d2f0a/chebar" },
      { n: "Jerusalem", note: "his home before the exile", id: "a15257a/jerusalem" },
    ],
    texts: [
      { work: "bible", book: "ezk", chapter: 1, verse: 3, label: "Ezekiel 1:3" },
      { work: "bible", book: "ezk", chapter: 37, verse: 1, label: "Ezekiel 37:1" },
    ],
  },
  {
    id: "daniel",
    name: "Daniel",
    traditions: ["Jewish", "Christian"],
    roles: ["prophet", "sage"],
    summary:
      "A young exile at the court of Babylon and then Persia, remembered for his faithfulness and his visions. He is among the Prophets in Christian Bibles and the Writings in the Jewish one.",
    when: "Tradition: 6th century BCE",
    traditional: "Taken to Babylon in 605 BCE, he served at court into the reign of Cyrus, in the 530s BCE.",
    tradSpan: [-620, -530],
    scholarly: `${NO_EVIDENCE} Most historians date the book in its final form to c. 167 to 164 BCE, in the time of Antiochus IV; some of its stories may be older.`,
    source: "Hebrew Bible (Daniel); no evidence outside the Bible.",
    places: [
      { n: "Babylon", id: "a217d18/babylon-1" },
      { n: "Shushan (Susa)", note: "the setting of one of his visions", id: "a033b84/susa" },
    ],
    texts: [
      { work: "bible", book: "dan", chapter: 1, verse: 6, label: "Daniel 1:6" },
      { work: "bible", book: "dan", chapter: 6, verse: 16, label: "Daniel 6:16" },
    ],
  },
  {
    id: "cyrus",
    name: "Cyrus the Great",
    also: "Koresh",
    traditions: ["Jewish", "Christian"],
    roles: ["king"],
    summary:
      "The king of Persia who took Babylon in 539 BCE and let the exiles go home to rebuild the Temple. Isaiah calls him the Lord's anointed.",
    when: "c. 559 to 530 BCE (reign)",
    traditional: "The decree of Cyrus “in the first year of Cyrus king of Persia” (Ezra 1:1), his first year over Babylon, about 538 BCE, opens the book of Ezra.",
    scholarly: "Well attested: the Cyrus Cylinder and Babylonian chronicles. King of Persia c. 559 to 530 BCE; he took Babylon in 539 BCE.",
    span: [-559, -530],
    agreed: true,
    source: "Hebrew Bible (Isaiah 45, Ezra 1); Persian and Babylonian inscriptions; Greek historians.",
    places: [
      { n: "Babylon", note: "which he took in 539 BCE", id: "a217d18/babylon-1" },
      { n: "Achmetha (Ecbatana)", note: "where his decree was found again (Ezra 6:2)", id: "a212ef7/ecbatana" },
    ],
    texts: [
      { work: "bible", book: "isa", chapter: 45, verse: 1, label: "Isaiah 45:1" },
      { work: "bible", book: "ezr", chapter: 1, verse: 1, label: "Ezra 1:1" },
    ],
  },
  {
    id: "ezra",
    name: "Ezra",
    traditions: ["Jewish", "Christian"],
    roles: ["scribe", "leader"],
    summary:
      "A priest and scribe who brought the Law from Babylon to Jerusalem and read it to the people. Jewish tradition honours him as a restorer of the Torah.",
    when: "Arrived 458 or 398 BCE",
    traditional: "He came to Jerusalem in the seventh year of King Artaxerxes (Ezra 7:7), conventionally dated 458 BCE.",
    tradSpan: [-458, -440],
    scholarly:
      "Many historians accept him as a real figure of the Persian period. Many date his arrival to 458 BCE (Artaxerxes I); some argue for 398 BCE (Artaxerxes II).",
    span: [-458, -398],
    source: "Hebrew Bible (Ezra 7 to 10, Nehemiah 8); dates follow the Persian kings.",
    places: [
      { n: "Babylon", note: "where he set out from", id: "a217d18/babylon-1" },
      { n: "Jerusalem", id: "a15257a/jerusalem" },
    ],
    texts: [
      { work: "bible", book: "ezr", chapter: 7, verse: 6, label: "Ezra 7:6" },
      { work: "bible", book: "neh", chapter: 8, verse: 2, label: "Nehemiah 8:2" },
    ],
  },
  {
    id: "nehemiah",
    name: "Nehemiah",
    traditions: ["Jewish", "Christian"],
    roles: ["leader"],
    summary: "Cupbearer to the king of Persia, who came home as governor of Judah and rebuilt the walls of Jerusalem.",
    when: "Governor from 445 BCE",
    traditional: "He came to Jerusalem in the twentieth year of Artaxerxes (Nehemiah 2:1) and governed for twelve years, then returned later (Nehemiah 13:6).",
    scholarly:
      "Widely accepted: governor from 445 BCE to after 433 BCE. Sanballat, one of his opponents, is also named in letters found at Elephantine in Egypt.",
    span: [-445, -430],
    agreed: true,
    source: "Hebrew Bible (Nehemiah); the Elephantine papyri.",
    places: [
      { n: "Shushan (Susa)", note: "the Persian court where he served", id: "a033b84/susa" },
      { n: "Jerusalem", id: "a15257a/jerusalem" },
    ],
    texts: [
      { work: "bible", book: "neh", chapter: 1, verse: 1, label: "Nehemiah 1:1" },
      { work: "bible", book: "neh", chapter: 2, verse: 1, label: "Nehemiah 2:1" },
    ],
  },
  {
    id: "zoroaster",
    name: "Zoroaster",
    also: "Zarathustra",
    traditions: ["Zoroastrian"],
    roles: ["prophet", "founder"],
    summary:
      "The prophet of Ahura Mazda, the Wise Lord, whose own hymns, the Gathas, are the heart of the Avesta. Zoroastrians honour him as the founder of their faith.",
    when: "Widely disputed",
    traditional:
      "Zoroastrian tradition, following later Persian texts, places him “258 years before Alexander”, in the 7th to 6th century BCE (often given as c. 628 to 551 BCE). Some Zoroastrians hold that he lived much earlier.",
    tradSpan: [-628, -551],
    scholarly:
      "The dating is widely disputed. Estimates range from c. 1500 to 1000 BCE (the language of the Gathas is very close to that of the Rig Veda) to c. 600 BCE. Many scholars now lean to the earlier end, but there is no consensus. Where he lived is also uncertain: somewhere in the eastern Iranian lands or Central Asia.",
    span: [-1500, -600],
    source: "The Gathas (Avesta) and later Pahlavi tradition; scholarly opinion is divided.",
    places: [{ n: "The eastern Iranian lands or Central Asia", note: "the exact place is not known" }],
    texts: [
      { work: "gathas", book: "gathas", chapter: 1, verse: 1, label: "Gathas 1 (Yasna 28)" },
      { work: "gathas", book: "gathas", chapter: 17, label: "Gathas 17 (Yasna 53)" },
      { work: "vendidad", book: "vendidad", chapter: 19, verse: 2, label: "Vendidad 19:2" },
    ],
  },
  {
    id: "krishna",
    name: "Krishna",
    traditions: ["Hindu"],
    roles: ["teacher"],
    summary:
      "The teacher of the Bhagavad Gita, who speaks to Arjuna on the field of Kurukshetra. Hindus revere him as an avatar of Vishnu, and many as the Supreme Lord himself.",
    when: "Tradition: before 3102 BCE",
    traditional:
      "Hindu tradition places his life at the end of the Dvapara Yuga; his passing began the present age, the Kali Yuga, traditionally dated to 3102 BCE.",
    tradSpan: [-3228, -3102],
    scholarly: `${NO_EVIDENCE} The Mahabharata, with the Gita, took shape c. 400 BCE to 400 CE, and the Puranas over the centuries after; devotion to Vasudeva-Krishna is attested by the 2nd century BCE, on the Heliodorus pillar.`,
    source: "Mahabharata, Bhagavad Gita and Puranas; historians date the texts, not his life.",
    places: [{ n: "Mathura, Dvaraka and Kurukshetra", note: "in northern and western India, beyond this map" }],
    texts: [
      { work: "gita", book: "gita", chapter: 1, label: "Bhagavad Gita, Chapter 1" },
      { work: "gita", book: "gita", chapter: 4, verse: 7, label: "Bhagavad Gita 4:7" },
      { work: "vishnu-purana", book: "vp5", chapter: 1, label: "Vishnu Purana, Book 5" },
    ],
  },
  {
    id: "buddha",
    name: "The Buddha",
    also: "Siddhartha Gautama, Shakyamuni",
    traditions: ["Buddhist"],
    roles: ["founder", "teacher"],
    summary:
      "Siddhartha Gautama of the Shakya people, who left a prince's life, awakened under the Bodhi tree and taught the way to the end of suffering for forty-five years.",
    when: "c. 6th to 5th century BCE",
    traditional:
      "In the Theravada tradition of Sri Lanka and Southeast Asia, the Buddha lived 624 to 544 BCE, and the Buddhist Era counts from his passing. Other Buddhist traditions give other dates.",
    tradSpan: [-624, -544],
    scholarly:
      "Usually placed in the 6th to 5th century BCE. The older chronology long used by scholars gives c. 563 to 483 BCE; the revised chronology many now favour puts his death around 400 BCE (c. 480 to 400 BCE). Each gives him a life of about eighty years.",
    span: [-563, -400],
    source: "Pali Canon; scholarly consensus on the 5th century BCE, with two chronologies.",
    places: [
      { n: "Lumbini, Bodh Gaya, Sarnath and Kushinagar", note: "his birth, awakening, first teaching and passing, in what are now Nepal and northern India, beyond this map" },
    ],
    texts: [
      { work: "tipitaka", book: "mn", chapter: 26, label: "MN 26: The Noble Search" },
      { work: "tipitaka", book: "dn", chapter: 16, label: "DN 16: The Buddha's last days" },
      { work: "dhammapada", book: "dhp", chapter: 14, verse: 181, label: "Dhammapada 14: The Buddha" },
      { work: "lotus", book: "lotus", chapter: 1, label: "Lotus Sutra 1" },
    ],
  },
  {
    id: "mahavira",
    name: "Mahavira",
    also: "Vardhamana",
    traditions: ["Jain"],
    roles: ["teacher"],
    summary:
      "The twenty-fourth and last Tirthankara of this age. Jains see him as renewing an eternal path taught by those before him, rather than founding a new one.",
    when: "c. 6th to 5th century BCE",
    traditional: "Svetambara Jain tradition dates his liberation (nirvana) to 527 BCE, and so his life to c. 599 to 527 BCE.",
    tradSpan: [-599, -527],
    scholarly:
      "An older contemporary of the Buddha. His dates are often given as c. 540 to 468 BCE; on the Buddha's revised dates, his death falls later, around 425 BCE.",
    span: [-540, -425],
    source: "Jain Agamas (Kalpa Sutra, Akaranga); historians tie his dates to the Buddha's.",
    places: [{ n: "Vaishali and Pava", note: "in Bihar, northern India, beyond this map" }],
    texts: [
      { work: "jaina", book: "kalpa", chapter: 1, verse: 6, label: "Kalpa Sutra 1: his life" },
      { work: "jaina", book: "akaranga", chapter: 1, verse: 1, label: "Akaranga Sutra 1" },
    ],
  },
  {
    id: "confucius",
    name: "Confucius",
    also: "Kong Qiu, Kongzi",
    traditions: ["Confucian"],
    roles: ["sage", "teacher"],
    summary: "A teacher of the state of Lu whose sayings on goodness, learning and right conduct were gathered by his students in the Analects.",
    when: "c. 551 to 479 BCE",
    traditional: "Born in Lu in 551 BCE, he taught for most of his life and died in 479 BCE.",
    scholarly: "Widely accepted: c. 551 to 479 BCE, from early Chinese histories.",
    span: [-551, -479],
    agreed: true,
    source: "Analects; Sima Qian's Records of the Grand Historian; widely accepted.",
    places: [{ n: "Qufu, in the state of Lu", note: "in Shandong, eastern China, beyond this map" }],
    texts: [
      { work: "analects", book: "analects", chapter: 1, verse: 1, label: "Analects 1:1" },
      { work: "analects", book: "analects", chapter: 2, verse: 4, label: "Analects 2:4" },
      { work: "zhuangzi", book: "zhuangzi", chapter: 5, verse: 23, label: "Zhuangzi 5:23" },
    ],
  },
  {
    id: "laozi",
    name: "Laozi",
    also: "Lao Tzu, Lao Dan",
    traditions: ["Taoist"],
    roles: ["sage", "founder"],
    summary:
      "The sage to whom the Tao Te Ching is credited. Taoists honour him as the founder of their way, and in later tradition as a divine teacher.",
    when: "Tradition: 6th century BCE",
    traditional:
      "Tradition, from Sima Qian's Records of the Grand Historian (c. 100 BCE), makes Laozi a keeper of the archives at the Zhou court and an older contemporary of Confucius, in the 6th century BCE.",
    tradSpan: [-571, -471],
    scholarly: `${NO_EVIDENCE} Sima Qian himself gave more than one account of who he was. Many scholars think the Tao Te Ching took shape later, around the 4th century BCE, and they debate whether it goes back to one person.`,
    source: "Tao Te Ching and Zhuangzi; Sima Qian's Records; scholars are divided.",
    places: [{ n: "The Zhou court at Luoyang", note: "in tradition; China is beyond this map" }],
    texts: [
      { work: "tao-te-ching", book: "ttc", chapter: 1, label: "Tao Te Ching 1" },
      { work: "zhuangzi", book: "zhuangzi", chapter: 3, verse: 14, label: "Zhuangzi 3:14" },
    ],
  },
  {
    id: "zhuangzi",
    name: "Zhuangzi",
    also: "Zhuang Zhou, Chuang Tzu",
    traditions: ["Taoist"],
    roles: ["sage"],
    summary: "A Taoist sage known for his humour and his parables, like the dream of the butterfly.",
    when: "c. 369 to 286 BCE",
    traditional: "Zhuang Zhou of the state of Song lived in the 4th century BCE.",
    scholarly: "Widely accepted as a real person of the 4th century BCE; the usual dates, c. 369 to 286 BCE, are approximate. Only the “inner chapters” are usually linked to him.",
    span: [-369, -286],
    agreed: true,
    source: "Zhuangzi; Sima Qian's Records; widely accepted, dates approximate.",
    places: [{ n: "The state of Song", note: "in central China, beyond this map" }],
    texts: [
      { work: "zhuangzi", book: "zhuangzi", chapter: 1, label: "Zhuangzi 1" },
      { work: "zhuangzi", book: "zhuangzi", chapter: 2, label: "Zhuangzi 2" },
    ],
  },
  {
    id: "mencius",
    name: "Mencius",
    also: "Mengzi",
    traditions: ["Confucian"],
    roles: ["sage", "teacher"],
    summary: "The great follower of Confucius, who taught that human nature is good and counselled the kings of his day.",
    when: "c. 372 to 289 BCE",
    traditional: "Born in the state of Zou about a century after Confucius died.",
    scholarly: "Widely accepted: c. 372 to 289 BCE; the dates are approximate.",
    span: [-372, -289],
    agreed: true,
    source: "Mencius; early Chinese histories; widely accepted.",
    places: [{ n: "The state of Zou", note: "in Shandong, eastern China, beyond this map" }],
    texts: [{ work: "mencius", book: "mencius", chapter: 1, verse: 1, label: "Mencius 1:1" }],
  },
  {
    id: "jimmu",
    name: "Emperor Jimmu",
    also: "Kamu-yamato-ihare-biko",
    traditions: ["Shinto"],
    roles: ["king", "founder"],
    summary:
      "The first emperor of Japan in the Kojiki and the Nihongi, a descendant of the sun goddess Amaterasu, who journeyed east from Kyushu to Yamato.",
    when: "Tradition: from 660 BCE",
    traditional: "The Nihongi dates his accession to 660 BCE, the date still kept as Japan's National Foundation Day.",
    tradSpan: [-660, -585],
    scholarly: `${NO_EVIDENCE} Historians generally treat the reigns of the earliest emperors as traditional rather than datable; the first rulers historians can date lived many centuries later.`,
    source: "Kojiki and Nihongi; historians find no evidence for the earliest reigns.",
    places: [{ n: "Hyuga and Yamato", note: "in Japan, beyond this map" }],
    texts: [
      { work: "kojiki", book: "kojiki", chapter: 44, verse: 1, label: "Kojiki, Section 44" },
      { work: "nihongi", book: "nihongi", chapter: 3, label: "Nihongi, Book 3" },
    ],
  },
  {
    id: "hillel",
    name: "Hillel the Elder",
    traditions: ["Jewish"],
    roles: ["sage", "teacher"],
    summary: "A sage known for his patience and for teaching the whole Torah as “what is hateful to you, do not do to your neighbour”.",
    when: "c. 30 BCE to 10 CE (leader)",
    traditional: "Jewish tradition holds that he came from Babylonia and led the sages in Jerusalem for forty years, from about 30 BCE to 10 CE.",
    scholarly: "Widely accepted as a leading teacher in Jerusalem in the late 1st century BCE and early 1st century CE; his exact dates are not known.",
    span: [-30, 10],
    agreed: true,
    source: "Mishnah (Pirkei Avot) and Talmud; dates approximate.",
    places: [{ n: "Jerusalem", id: "a15257a/jerusalem" }],
    texts: [{ work: "mishnah", book: "pirkei-avot", chapter: 1, verse: 12, label: "Pirkei Avot 1:12" }],
  },
  {
    id: "john-baptist",
    name: "John the Baptist",
    also: "Yahya",
    traditions: ["Christian", "Muslim"],
    roles: ["prophet"],
    summary:
      "The prophet who preached repentance and baptised people in the Jordan, among them Jesus. The Quran honours him as Yahya, son of Zechariah.",
    when: "Died c. 30 CE",
    traditional: "Born about six months before Jesus (Luke 1); put to death by Herod Antipas.",
    scholarly:
      "Widely accepted as historical: the Jewish historian Josephus describes him and his death under Herod Antipas. He was active around 28 to 30 CE and died before 36 CE.",
    span: [-6, 30],
    agreed: true,
    source: "Gospels and the Quran; Josephus (Antiquities 18); widely accepted.",
    places: [{ n: "The Jordan", note: "where he baptised", id: "ae686c9/jordan" }],
    texts: [
      { work: "bible", book: "mat", chapter: 3, verse: 1, label: "Matthew 3:1" },
      { work: "bible", book: "luk", chapter: 1, verse: 13, label: "Luke 1:13" },
      { work: "quran", book: "quran", chapter: 19, verse: 7, label: "Quran 19:7 (Surah Maryam)" },
      { work: "josephus", book: "antiquities-18", chapter: 5, label: "Josephus, Antiquities 18.5" },
    ],
  },
  {
    id: "jesus",
    name: "Jesus",
    also: "Jesus of Nazareth, Isa",
    traditions: ["Christian", "Muslim"],
    roles: ["teacher", "prophet"],
    summary:
      "A Jewish teacher from Galilee. Christians believe he is the Messiah and the Son of God, who died and rose again; Muslims honour him as a prophet and the Messiah, born of the virgin Mary.",
    when: "c. 6 BCE to c. 33 CE",
    traditional:
      "The Christian calendar counts from his birth. The Gospels place it in the days of King Herod, who died in 4 BCE, and his death under Pontius Pilate, governor of Judea from 26 to 36 CE.",
    scholarly:
      "Nearly all historians agree that Jesus of Nazareth lived: born c. 6 to 4 BCE, crucified in Jerusalem c. 30 to 33 CE. Roman and Jewish writers of the 1st and early 2nd centuries (Josephus, Tacitus) mention him.",
    span: [-6, 33],
    agreed: true,
    source: "Gospels and the Quran; Josephus and Tacitus; nearly all historians accept his life.",
    places: [
      { n: "Bethlehem", note: "where the Gospels say he was born", id: "a112427/bethlehem-1" },
      { n: "Nazareth", note: "where he grew up", id: "af5884f/nazareth" },
      { n: "Capernaum", note: "the base of his teaching in Galilee", id: "af2161c/capernaum" },
      { n: "Jerusalem", note: "where he was crucified", id: "a15257a/jerusalem" },
    ],
    texts: [
      { work: "bible", book: "luk", chapter: 2, verse: 7, label: "Luke 2:7" },
      { work: "bible", book: "mat", chapter: 5, verse: 1, label: "Matthew 5:1" },
      { work: "bible", book: "jhn", chapter: 1, verse: 14, label: "John 1:14" },
      { work: "quran", book: "quran", chapter: 19, verse: 34, label: "Quran 19:34 (Surah Maryam)" },
      { work: "thomas", book: "gth", chapter: 1, label: "Gospel of Thomas" },
      { work: "josephus", book: "antiquities-18", chapter: 3, label: "Josephus, Antiquities 18.3" },
    ],
  },
  {
    id: "peter",
    name: "Peter",
    also: "Simon Peter, Cephas",
    traditions: ["Christian"],
    roles: ["apostle"],
    summary: "A fisherman of Galilee, first among the twelve apostles and a leader of the church in Jerusalem.",
    when: "Died c. 64 to 68 CE",
    traditional: "Tradition holds that he led the church in Rome and was crucified there under the emperor Nero, about 64 to 68 CE.",
    scholarly:
      "His life in Galilee and his leading role in Jerusalem are widely accepted. His death in Rome under Nero is hinted at c. 96 CE (1 Clement) and stated plainly by the late 2nd century; many historians accept it.",
    span: [1, 66],
    source: "Gospels, Acts and Paul's letters; early church writers.",
    places: [
      { n: "Capernaum", note: "his home in the Gospels (his town was Bethsaida)", id: "af2161c/capernaum" },
      { n: "Jerusalem", id: "a15257a/jerusalem" },
      { n: "Rome", note: "where tradition says he died", id: "afc8e7a/rome" },
    ],
    texts: [
      { work: "bible", book: "mat", chapter: 16, verse: 18, label: "Matthew 16:18" },
      { work: "bible", book: "act", chapter: 2, verse: 14, label: "Acts 2:14" },
      { work: "bible", book: "1pe", chapter: 1, verse: 1, label: "1 Peter 1:1" },
    ],
  },
  {
    id: "paul",
    name: "Paul",
    also: "Saul of Tarsus",
    traditions: ["Christian"],
    roles: ["apostle"],
    summary: "A Pharisee who became an apostle after a vision of the risen Jesus, carried the faith across the Roman world and wrote many of the New Testament's letters.",
    when: "c. 5 to c. 65 CE",
    traditional: "Born in Tarsus; tradition holds that he was beheaded in Rome under Nero, about 64 to 67 CE.",
    tradSpan: [5, 67],
    scholarly:
      "Widely accepted: born c. 5 to 10 CE, a missionary c. 35 to 60 CE. Seven letters nearly all scholars agree are his date c. 50 to 60 CE; his death in Rome is an early tradition.",
    span: [5, 65],
    source: "Acts and Paul's own letters; early church writers; widely accepted.",
    places: [
      { n: "Tarsus", note: "his home city", id: "a666ea0/tarsus" },
      { n: "Damascus", note: "the road where he saw his vision", id: "a69c1d4/damascus" },
      { n: "Antioch", note: "where his journeys began", id: "ae41ab4/antioch-1" },
      { n: "Ephesus", id: "a5feb15/ephesus" },
      { n: "Corinth", id: "a6f437a/corinth" },
      { n: "Rome", id: "afc8e7a/rome" },
    ],
    texts: [
      { work: "bible", book: "act", chapter: 9, verse: 4, label: "Acts 9:4" },
      { work: "bible", book: "act", chapter: 13, verse: 9, label: "Acts 13:9" },
      { work: "bible", book: "rom", chapter: 1, verse: 1, label: "Romans 1:1" },
    ],
  },
  {
    id: "judah-prince",
    name: "Rabbi Judah the Prince",
    also: "Yehudah HaNasi, “Rabbi”",
    traditions: ["Jewish"],
    roles: ["sage", "leader"],
    summary: "The sage who led the Jews of the land, based in Galilee, and edited the Mishnah, the first great written collection of the Oral Torah.",
    when: "c. 135 to 217 CE",
    traditional: "He brought the Mishnah to its final form around 200 CE; in it he is called simply “Rabbi”.",
    scholarly: "Widely accepted: c. 135 to c. 217 CE; the dates are approximate.",
    span: [135, 217],
    agreed: true,
    source: "Mishnah and Talmud; widely accepted, dates approximate.",
    places: [{ n: "Galilee", note: "where he lived and taught (Beit Shearim and Sepphoris)", id: "a9cf1e8/galilee-1" }],
    texts: [{ work: "mishnah", book: "pirkei-avot", chapter: 2, verse: 1, label: "Pirkei Avot 2:1" }],
  },
  {
    id: "muhammad",
    name: "Muhammad",
    traditions: ["Muslim"],
    roles: ["prophet"],
    summary:
      "The Prophet of Islam, to whom Muslims believe the Quran was revealed over about twenty-three years. Muslims see him as the last of the prophets, renewing the faith of Abraham.",
    when: "c. 570 to 632 CE",
    traditional:
      "Born in Mecca in the Year of the Elephant (c. 570); the first revelation c. 610; the Hijra to Medina in 622, year 1 of the Islamic calendar; died in Medina in 632.",
    scholarly: "Historians broadly agree on these dates; the year of his birth is approximate.",
    span: [570, 632],
    agreed: true,
    source: "The Quran; early biographies (sira) and hadith; historians broadly agree.",
    places: [
      { n: "Mecca", note: "where he was born and the revelation began", geo: [39.826, 21.423] },
      { n: "Medina", note: "where he moved in 622 and died", geo: [39.611, 24.468] },
    ],
    texts: [
      { work: "quran", book: "quran", chapter: 96, verse: 1, label: "Quran 96:1" },
      { work: "quran", book: "quran", chapter: 33, verse: 40, label: "Quran 33:40" },
      { work: "quran", book: "quran", chapter: 48, verse: 29, label: "Quran 48:29" },
      { work: "hadith", book: "bukhari", chapter: 1, label: "Sahih al-Bukhari, book 1 (Revelation)" },
    ],
  },
  {
    id: "ali",
    name: "Ali ibn Abi Talib",
    traditions: ["Muslim"],
    roles: ["companion", "leader"],
    summary:
      "Cousin and son-in-law of Muhammad: the fourth caliph for Sunni Muslims, and the first Imam for Shia Muslims.",
    when: "c. 600 to 661 CE",
    traditional: "Raised in the Prophet's household in Mecca; caliph from 656; killed at Kufa in 661.",
    scholarly: "Historians broadly agree on these dates; the year of his birth is approximate.",
    span: [600, 661],
    agreed: true,
    source: "Hadith and early histories; historians broadly agree.",
    places: [
      { n: "Mecca", note: "his birthplace", geo: [39.826, 21.423] },
      { n: "Medina", geo: [39.611, 24.468] },
      { n: "Kufa", note: "his capital as caliph, where he died", geo: [44.402, 32.03] },
    ],
    texts: [{ work: "hadith", book: "bukhari", chapter: 62, label: "Sahih al-Bukhari, book 62 (Companions)" }],
  },
  {
    id: "nanak",
    name: "Guru Nanak",
    traditions: ["Sikh"],
    roles: ["guru", "founder"],
    summary: "The first of the ten Sikh Gurus, whose hymns open the Guru Granth Sahib with the Japji.",
    when: "1469 to 1539 CE",
    traditional: "Born at Talwandi (now Nankana Sahib) in 1469; he travelled widely and died at Kartarpur in 1539.",
    scholarly: "The same dates are widely accepted.",
    span: [1469, 1539],
    agreed: true,
    source: "Guru Granth Sahib; early Sikh biographies (janamsakhis); widely accepted.",
    places: [{ n: "Talwandi and Kartarpur", note: "in the Punjab, beyond this map" }],
    texts: [
      { work: "ggs", book: "opening-banis-japji-so-dar-sohila", chapter: 1, verse: 4, label: "Japji (Guru Granth Sahib, opening)" },
    ],
  },
  {
    id: "arjan",
    name: "Guru Arjan",
    traditions: ["Sikh"],
    roles: ["guru"],
    summary: "The fifth Sikh Guru, who compiled the Adi Granth in 1604, wrote the Sukhmani, and is honoured as the first Sikh martyr.",
    when: "1563 to 1606 CE",
    traditional: "Guru from 1581; compiled the scripture in 1604; died in Lahore in 1606.",
    scholarly: "The same dates are widely accepted.",
    span: [1563, 1606],
    agreed: true,
    source: "Guru Granth Sahib; Sikh and Mughal records; widely accepted.",
    places: [{ n: "Amritsar and Lahore", note: "in the Punjab, beyond this map" }],
    texts: [{ work: "ggs", book: "raag-gauree", chapter: 112, verse: 13, label: "Gauree Sukhmani (Guru Granth Sahib)" }],
  },
  {
    id: "bab",
    name: "The Báb",
    also: "Siyyid ʿAlí-Muhammad",
    traditions: ["Bahá’í"],
    roles: ["prophet", "founder"],
    summary:
      "A merchant of Shiraz who declared in 1844 that he was the Báb, “the Gate”, founded the Bábí faith and foretold one greater to come. Bahá’ís honour him as the Herald of Bahá’u’lláh.",
    when: "1819 to 1850 CE",
    traditional: "Born in Shiraz in 1819; declared his mission in 1844; executed in Tabriz in 1850.",
    scholarly: "The same dates are well documented.",
    span: [1819, 1850],
    agreed: true,
    source: "Bábí and Bahá’í writings; Persian and European records of the time.",
    places: [
      { n: "Shiraz", note: "his home city", geo: [52.531, 29.61] },
      { n: "Tabriz", note: "where he was executed", geo: [46.292, 38.08] },
    ],
    texts: [
      { work: "aqdas", book: "aqdas", chapter: 1, verse: 135, label: "Kitáb-i-Aqdas 135 (“My Herald”)" },
      { work: "aqdas", book: "aqdas", chapter: 1, verse: 137, label: "Kitáb-i-Aqdas 137" },
    ],
  },
  {
    id: "bahaullah",
    name: "Bahá’u’lláh",
    also: "Mírzá Husayn-ʿAlí",
    traditions: ["Bahá’í"],
    roles: ["prophet", "founder"],
    summary: "The founder of the Bahá’í Faith, who wrote the Hidden Words and the Kitáb-i-Aqdas through decades of exile.",
    when: "1817 to 1892 CE",
    traditional:
      "Born in Tehran in 1817; exiled to Baghdad (1853), Constantinople and Adrianople, then to Akka (1868); died at Bahjí, near Akka, in 1892.",
    scholarly: "The same dates are well documented.",
    span: [1817, 1892],
    agreed: true,
    source: "Bahá’í writings; Ottoman, Persian and European records of the time.",
    places: [
      { n: "Tehran", note: "his birthplace", geo: [51.389, 35.689] },
      { n: "Baghdad", note: "ten years of exile", geo: [44.366, 33.315] },
      { n: "Adrianople (Edirne)", geo: [26.555, 41.677] },
      { n: "Akka (the Bible's Accho)", note: "his last exile, where he died", id: "a5f4dfc/acco" },
    ],
    texts: [
      { work: "hidden-words", book: "hw", chapter: 1, verse: 1, label: "The Hidden Words 1" },
      { work: "aqdas", book: "aqdas", chapter: 1, verse: 1, label: "Kitáb-i-Aqdas 1" },
    ],
  },
];
