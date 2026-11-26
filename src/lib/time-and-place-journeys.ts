/**
 * Journeys for the Time and place page (study lab, hub 7a62bb28): curated stop lists. Each stop names an
 * OpenBible.info place id (coordinates come from that data, resolved by scripts/build-places.mts, which also checks
 * that every verse reference exists in the KJV) and the KJV verses for that step. `modern` picks one of OpenBible's
 * proposed locations by its modern name when a route follows a particular proposal.
 */

export type StopSource = {
  /** OpenBible ancient place id (the "a…" part). */
  p: string;
  /** KJV references: "gen 12:6" or "gen 12:6-8"; several separated by ";". */
  refs: string;
  /** Use this proposed modern location instead of the best-scored one. */
  modern?: string;
  /** A short line for this step. */
  note?: string;
};
export type RouteSource = { id: string; label: string; note?: string; stops: StopSource[] };
export type JourneySource = { id: string; title: string; summary: string; caution?: string; routes: RouteSource[] };

export const JOURNEYS: JourneySource[] = [
  {
    id: "abraham",
    title: "Abraham",
    summary: "From Ur of the Chaldees to Haran, into Canaan, down to Egypt in a famine and back (Genesis 11 to 13).",
    caution: "Ur's identification with Tell el-Muqayyar is the usual view, but a northern Ur near Haran has also been proposed.",
    routes: [
      {
        id: "abraham",
        label: "Abraham's journey",
        stops: [
          { p: "a6cf75c", refs: "gen 11:28-31", note: "Terah's family leaves Ur of the Chaldees." },
          { p: "a6d9af3", refs: "gen 11:31-32; gen 12:4-5", note: "They settle in Haran; Terah dies there." },
          { p: "adf74d4", refs: "gen 12:6-7", note: "In Canaan, at Sichem, by the plain of Moreh." },
          { p: "a64f355", refs: "gen 12:8", note: "An altar between Beth-el and Hai." },
          { p: "af301ca", refs: "gen 12:10-20", note: "Down to Egypt because of famine." },
          { p: "a64f355", refs: "gen 13:1-4", note: "Back to the altar at Beth-el." },
          { p: "a85151a", refs: "gen 13:18", note: "He settles by the plain of Mamre, in Hebron." },
        ],
      },
    ],
  },
  {
    id: "exodus",
    title: "The Exodus",
    summary: "From Rameses in Egypt through the wilderness to Mount Sinai, and on to the plains of Moab (Exodus to Deuteronomy).",
    caution:
      "The route of the Exodus and the location of Mount Sinai are debated. These are three scholarly proposals, not settled facts; an Arabian route (Sinai in Midian) has also been proposed but isn't drawn here. Many stops along the way are uncertain.",
    routes: [
      {
        id: "south",
        label: "Jebel Musa (southern Sinai, traditional)",
        note: "A southern route: Mount Sinai at Jebel Musa, as monastic tradition holds.",
        stops: [
          { p: "a079b21", refs: "exo 12:37", note: "They set out from Rameses." },
          { p: "aa28709", refs: "exo 12:37; exo 13:20" },
          { p: "a27d0e0", refs: "exo 13:20", note: "Camped at Etham, on the edge of the wilderness." },
          { p: "ababfd2", refs: "exo 14:2,9", note: "By the sea, before Pi-hahiroth." },
          { p: "ad3970d", refs: "exo 15:23", note: "Bitter waters at Marah." },
          { p: "a2410c1", refs: "exo 15:27", note: "Twelve wells and seventy palms." },
          { p: "a0f54e4", refs: "exo 16:1", note: "The wilderness of Sin: manna." },
          { p: "a05ebb7", refs: "exo 17:1,8", note: "Water from the rock; battle with Amalek." },
          { p: "abfba2a", refs: "exo 19:1-2,20", modern: "Jebel Musa", note: "At Mount Sinai: the law is given." },
          { p: "ac2cef0", refs: "num 13:26; num 20:1", note: "Kadesh, where the spies return." },
          { p: "ad8027f", refs: "num 20:22-28", note: "Aaron dies on Mount Hor." },
          { p: "aca767b", refs: "num 22:1", note: "The plains of Moab, by Jordan near Jericho." },
          { p: "aefaa2d", refs: "deu 34:1-5", note: "Moses sees the land from Nebo." },
        ],
      },
      {
        id: "central",
        label: "Har Karkom (Negev)",
        note: "A proposal: Mount Sinai at Har Karkom, in the Negev highlands, as some archaeologists suggest. Only the main points are drawn.",
        stops: [
          { p: "a079b21", refs: "exo 12:37" },
          { p: "aa28709", refs: "exo 12:37" },
          { p: "abfba2a", refs: "exo 19:1-2", modern: "Har Karkom" },
          { p: "ac2cef0", refs: "num 20:1" },
          { p: "aca767b", refs: "num 22:1" },
          { p: "aefaa2d", refs: "deu 34:1" },
        ],
      },
      {
        id: "north",
        label: "Jebel Sin Bishar (west-central Sinai)",
        note: "A proposal: Mount Sinai at Jebel Sin Bishar, in west-central Sinai, as some scholars suggest. Only the main points are drawn.",
        stops: [
          { p: "a079b21", refs: "exo 12:37" },
          { p: "aa28709", refs: "exo 12:37" },
          { p: "abfba2a", refs: "exo 19:1-2", modern: "Jebel Sin Bishar" },
          { p: "ac2cef0", refs: "num 20:1" },
          { p: "aca767b", refs: "num 22:1" },
          { p: "aefaa2d", refs: "deu 34:1" },
        ],
      },
    ],
  },
  {
    id: "jesus",
    title: "Jesus' ministry",
    summary: "From Bethlehem and Nazareth through Galilee to Jerusalem.",
    caution:
      "An approximate sequence: the Gospels order events differently (John, for example, has several visits to Jerusalem), so this follows one broad outline, not a fixed itinerary.",
    routes: [
      {
        id: "jesus",
        label: "Jesus' ministry (approximate order)",
        stops: [
          { p: "a112427", refs: "mat 2:1; luk 2:4-7", note: "Born in Bethlehem of Judaea." },
          { p: "af301ca", refs: "mat 2:13-15", note: "The flight into Egypt." },
          { p: "af5884f", refs: "mat 2:23; luk 2:39-40", note: "Grows up in Nazareth." },
          { p: "ae686c9", refs: "mat 3:13; mrk 1:9", note: "Baptised in the Jordan." },
          { p: "a031bda", refs: "jhn 2:1-11", note: "Water into wine at Cana." },
          { p: "a27b472", refs: "jhn 4:5-7", note: "On the way back to Galilee: the woman at the well, by Sychar." },
          { p: "af2161c", refs: "mat 4:13; mrk 1:21", note: "Makes his home in Capernaum." },
          { p: "a562fcc", refs: "mat 4:18-22", note: "Calls fishermen by the sea of Galilee." },
          { p: "aee679c", refs: "luk 7:11-15", note: "The widow's son at Nain." },
          { p: "afed46a", refs: "mat 8:28", note: "The country of the Gergesenes, across the lake." },
          { p: "a160272", refs: "mrk 7:24-31", note: "The borders of Tyre and Sidon." },
          { p: "a9fc13a", refs: "mrk 8:22-26", note: "A blind man healed at Bethsaida." },
          { p: "ab7bf48", refs: "mat 16:13-16", note: "“Whom say ye that I am?”" },
          { p: "aaf03fa", refs: "luk 19:1-5", note: "Zacchaeus in Jericho." },
          { p: "a4f35bc", refs: "jhn 11:1,43-44; jhn 12:1", note: "Lazarus raised at Bethany." },
          { p: "a15257a", refs: "mat 21:10", note: "Into Jerusalem." },
          { p: "a42418f", refs: "mat 26:36", note: "Prayer in Gethsemane." },
          { p: "a631d35", refs: "mat 27:33; jhn 19:17", note: "Crucified at Golgotha." },
          { p: "ae7274b", refs: "luk 24:13-15", note: "On the road to Emmaus." },
        ],
      },
    ],
  },
  {
    id: "paul1",
    title: "Paul's first journey",
    summary: "With Barnabas: Cyprus and the cities of southern Asia Minor, and back to Antioch (Acts 13 to 14).",
    routes: [
      {
        id: "paul1",
        label: "First journey",
        stops: [
          { p: "ae41ab4", refs: "act 13:1-3", note: "Sent out from the church at Antioch." },
          { p: "a6d306d", refs: "act 13:4" },
          { p: "afa863b", refs: "act 13:5" },
          { p: "a314765", refs: "act 13:6-12", note: "Paphos: the proconsul believes." },
          { p: "aff04b8", refs: "act 13:13" },
          { p: "a6c704a", refs: "act 13:14-49", note: "Antioch in Pisidia: Paul's sermon." },
          { p: "ae425aa", refs: "act 13:51; act 14:1" },
          { p: "af0719d", refs: "act 14:6-19", note: "Lystra: Paul is stoned." },
          { p: "aa401a9", refs: "act 14:20" },
          { p: "af0719d", refs: "act 14:21" },
          { p: "ae425aa", refs: "act 14:21" },
          { p: "a6c704a", refs: "act 14:21" },
          { p: "aff04b8", refs: "act 14:25" },
          { p: "ac744c1", refs: "act 14:25" },
          { p: "ae41ab4", refs: "act 14:26-28", note: "Home to Antioch." },
        ],
      },
    ],
  },
  {
    id: "paul2",
    title: "Paul's second journey",
    summary: "With Silas: through Asia Minor, across to Macedonia and Greece (Acts 15 to 18).",
    routes: [
      {
        id: "paul2",
        label: "Second journey",
        stops: [
          { p: "ae41ab4", refs: "act 15:35-36,40" },
          { p: "aa401a9", refs: "act 16:1" },
          { p: "af0719d", refs: "act 16:1-3", note: "Timothy joins them." },
          { p: "a91c509", refs: "act 16:8-10", note: "The vision of the man of Macedonia." },
          { p: "a68750d", refs: "act 16:11" },
          { p: "a6a7150", refs: "act 16:11" },
          { p: "a49e1d0", refs: "act 16:12-40", note: "Philippi: Lydia, and the jailer." },
          { p: "a4bdea7", refs: "act 17:1" },
          { p: "ab20df9", refs: "act 17:1" },
          { p: "afa9d8e", refs: "act 17:1-9" },
          { p: "a62fe31", refs: "act 17:10-13" },
          { p: "a1fe6e7", refs: "act 17:15-34", note: "Athens: on Mars' hill." },
          { p: "a6f437a", refs: "act 18:1-11", note: "A year and a half in Corinth." },
          { p: "aa31dd3", refs: "act 18:18" },
          { p: "a5feb15", refs: "act 18:19-21" },
          { p: "a58735e", refs: "act 18:22" },
          { p: "ae41ab4", refs: "act 18:22" },
        ],
      },
    ],
  },
  {
    id: "paul3",
    title: "Paul's third journey",
    summary: "Through Galatia and Phrygia to Ephesus, on to Macedonia and Greece, and back to Jerusalem (Acts 18 to 21).",
    routes: [
      {
        id: "paul3",
        label: "Third journey",
        stops: [
          { p: "ae41ab4", refs: "act 18:22-23" },
          { p: "a0f440a", refs: "act 18:23", note: "Through Galatia and Phrygia (a region: the dot is approximate)." },
          { p: "a5feb15", refs: "act 19:1-10", note: "Two years in Ephesus." },
          { p: "a69e1b8", refs: "act 20:1", note: "Macedonia (a region)." },
          { p: "a4492a0", refs: "act 20:2-3", note: "Three months in Greece (a region)." },
          { p: "a49e1d0", refs: "act 20:6" },
          { p: "a91c509", refs: "act 20:6-12", note: "Troas: Eutychus." },
          { p: "a0a2ca7", refs: "act 20:13-14" },
          { p: "a33910d", refs: "act 20:14" },
          { p: "a4c2c75", refs: "act 20:15" },
          { p: "acf6ec0", refs: "act 20:15" },
          { p: "a55027d", refs: "act 20:15-38", note: "Farewell to the Ephesian elders." },
          { p: "a398e5d", refs: "act 21:1" },
          { p: "a4218ee", refs: "act 21:1" },
          { p: "ade301b", refs: "act 21:1" },
          { p: "a160272", refs: "act 21:3-6" },
          { p: "abc2af0", refs: "act 21:7" },
          { p: "a58735e", refs: "act 21:8-14" },
          { p: "a15257a", refs: "act 21:15-17" },
        ],
      },
    ],
  },
  {
    id: "rome",
    title: "Paul's voyage to Rome",
    summary: "As a prisoner from Caesarea, through storm and shipwreck on Melita, to Rome (Acts 27 to 28).",
    routes: [
      {
        id: "rome",
        label: "Voyage to Rome",
        stops: [
          { p: "a58735e", refs: "act 25:13", note: "Paul, a prisoner here, sails for Rome (Acts 27:1-2)." },
          { p: "a98e4d7", refs: "act 27:3" },
          { p: "aa4b3e2", refs: "act 27:5-6" },
          { p: "ab793ce", refs: "act 27:7" },
          { p: "a1c44ea", refs: "act 27:7" },
          { p: "aae626a", refs: "act 27:8-12" },
          { p: "aca2b0a", refs: "act 27:16", note: "The storm drives them past Clauda." },
          { p: "a57835d", refs: "act 28:1-10", note: "Shipwrecked on Melita." },
          { p: "a1e3697", refs: "act 28:12" },
          { p: "a63bb26", refs: "act 28:13" },
          { p: "a4488e9", refs: "act 28:13-14" },
          { p: "a121d5e", refs: "act 28:15" },
          { p: "afef438", refs: "act 28:15" },
          { p: "afc8e7a", refs: "act 28:16,30-31", note: "Two years in Rome." },
        ],
      },
    ],
  },
];

/** Resolved, as built into public/places/journeys.json. */
export type JourneyStop = {
  id: string; // OpenBible id/slug (the index's id)
  n: string;
  m?: string;
  x: number;
  y: number;
  c: number;
  /** g: a region (Egypt, Grecia), shown as "the region of"; a: the dot stands for a wider area (an island, a river, a circle of uncertainty). */
  g?: 1;
  a?: 1;
  /** [book, chapter, first verse, last verse] */
  r: [string, number, number, number][];
  note?: string;
};
export type JourneyRoute = { id: string; label: string; note?: string; stops: JourneyStop[] };
export type Journey = { id: string; title: string; summary: string; caution?: string; routes: JourneyRoute[] };
