/**
 * Eras for the Time and place map (study lab, hub 7a62bb28): broad periods of the biblical story with conservative
 * date ranges, which books and chapters are set in each (to light up the places they name), and the rough reach of
 * the main powers of the time, drawn by hand as simple approximate shapes (no outside boundary data).
 */
import type { Span } from "./time-and-place";

export type Power = {
  id: string;
  name: string;
  /** When this reach applies (shown with the name). */
  when: string;
  /** Outline as [lon, lat] points, deliberately rough. */
  shape: [number, number][];
  /** Where the name goes. */
  label: [number, number];
};

export type Era = {
  id: string;
  name: string;
  span: Span;
  /** A short, neutral line on the dates. */
  dates: string;
  powers: string[];
  note?: string;
};

export const POWERS: Record<string, Power> = {
  egypt: {
    id: "egypt",
    name: "Egypt",
    when: "the Nile valley and delta",
    shape: [
      [29.3, 30.9],
      [30.2, 31.5],
      [32.3, 31.3],
      [33.2, 31.1],
      [34.2, 31.3],
      [34.4, 29.6],
      [32.6, 29.9],
      [32.9, 27.5],
      [33.3, 25.5],
      [33.4, 24],
      [33, 22],
      [31.4, 22],
      [31.6, 24.2],
      [31.4, 26.2],
      [30.6, 27.7],
      [30.6, 29.3],
    ],
    label: [31.2, 27],
  },
  assyria: {
    id: "assyria",
    name: "Assyria",
    when: "at its height, c. 670 BCE (briefly including Lower Egypt, not drawn)",
    shape: [
      [35.8, 36.2],
      [37.5, 37.6],
      [40, 38],
      [42.5, 38.2],
      [44.6, 37.6],
      [46.4, 36],
      [47.6, 33.6],
      [48, 31.4],
      [47.4, 30.3],
      [45.6, 30.6],
      [43.5, 31.6],
      [41.2, 33.5],
      [38.6, 33.6],
      [37.2, 32],
      [35.6, 29.8],
      [34.3, 31.3],
      [34.9, 33],
      [35.7, 34.6],
    ],
    label: [42.4, 35.2],
  },
  babylon: {
    id: "babylon",
    name: "Babylon",
    when: "the Neo-Babylonian empire, c. 580 BCE",
    shape: [
      [35.8, 36.2],
      [38, 36.8],
      [41, 36.8],
      [43.3, 36.4],
      [45.6, 34.4],
      [47.6, 32],
      [48, 30.3],
      [46.6, 29.8],
      [44.2, 30.6],
      [41.6, 32.2],
      [38.6, 33],
      [36.8, 31],
      [35.2, 29.6],
      [34.3, 31.3],
      [34.9, 33],
      [35.7, 34.6],
    ],
    label: [42.6, 33.6],
  },
  persia: {
    id: "persia",
    name: "Persia",
    when: "the Persian empire at its widest, c. 500 BCE",
    shape: [
      [26.2, 39.6],
      [27.5, 41],
      [32, 41.4],
      [36, 41.6],
      [41.5, 41.4],
      [46, 42.2],
      [49.5, 41.5],
      [53.5, 39.8],
      [58, 40.5],
      [62, 41],
      [66, 40.5],
      [70, 38],
      [70, 25],
      [62, 25.2],
      [57.5, 25.8],
      [55, 26.6],
      [52, 27.8],
      [50.2, 29.4],
      [48.2, 29.8],
      [46.5, 29.8],
      [44, 30.8],
      [40.8, 32.4],
      [38.2, 31.2],
      [36.4, 29.6],
      [34.4, 28],
      [33.4, 24],
      [33, 22],
      [31.4, 22],
      [31.4, 24.2],
      [30.4, 27.7],
      [29.2, 29.5],
      [25.2, 30],
      [21, 30.4],
      [20, 32.8],
      [22.5, 33],
      [25.5, 31.6],
      [29.3, 31.2],
      [32.3, 31.3],
      [34.4, 31.6],
      [35.6, 34.6],
      [35.8, 36.2],
      [33, 36.2],
      [30, 36.4],
      [27.4, 36.6],
      [27.2, 38],
    ],
    label: [53, 33],
  },
  ptolemies: {
    id: "ptolemies",
    name: "The Ptolemies",
    when: "Greek rulers of Egypt, c. 250 BCE",
    shape: [
      [25, 31.6],
      [29.3, 31.2],
      [32.3, 31.3],
      [34.4, 31.6],
      [35, 33],
      [35.7, 34.3],
      [36.6, 33.5],
      [36.4, 31.2],
      [35.2, 29.6],
      [34.4, 28],
      [33.4, 24],
      [33, 22],
      [31.4, 22],
      [31.4, 24.2],
      [30.4, 27.7],
      [29.2, 29.5],
      [25, 30.2],
    ],
    label: [31.4, 27.5],
  },
  seleucids: {
    id: "seleucids",
    name: "The Seleucids",
    when: "Greek rulers of Syria and the east, c. 250 BCE",
    shape: [
      [35.8, 36.2],
      [33, 36.6],
      [30.5, 37.6],
      [30.5, 39],
      [33.5, 39.5],
      [38.5, 38.2],
      [42.5, 38],
      [45.5, 38.6],
      [50, 37.2],
      [55, 37.6],
      [60, 36.4],
      [62, 33],
      [60, 28.5],
      [57, 27],
      [54, 27],
      [51.2, 28.6],
      [48.8, 30],
      [46.6, 29.8],
      [44, 31],
      [41.4, 33.2],
      [38.8, 34],
      [36.8, 34.4],
      [35.8, 35],
    ],
    label: [46, 34.5],
  },
  rome: {
    id: "rome",
    name: "Rome",
    when: "the empire around the Mediterranean, c. 50 CE",
    shape: [
      [-10, 43.6],
      [-1.5, 43.4],
      [-1, 46.5],
      [2.5, 47],
      [7, 47],
      [10, 47],
      [14, 47],
      [17, 46],
      [20, 44.8],
      [24, 44],
      [28.5, 44.6],
      [28.2, 42],
      [31, 41.2],
      [35.5, 42],
      [40, 41],
      [41.6, 41.6],
      [40.5, 39],
      [39.3, 37.6],
      [38.6, 35.6],
      [38.8, 33.5],
      [37.2, 32],
      [36.4, 30.4],
      [35, 29.4],
      [34.4, 28],
      [33.4, 24.4],
      [32.6, 23.6],
      [31.4, 24.2],
      [30.4, 27.7],
      [29.2, 29.5],
      [25, 30.6],
      [20, 30.4],
      [15, 31],
      [11, 32],
      [9.6, 33.6],
      [5, 34.6],
      [0, 34.6],
      [-5, 34.6],
      [-10, 34],
    ],
    label: [14.5, 38.6],
  },
};

export const ERAS: Era[] = [
  {
    id: "patriarchs",
    name: "The patriarchs",
    span: [-2000, -1600],
    dates: "Traditionally the early 2nd millennium BCE; the stories can't be dated with certainty.",
    powers: ["egypt"],
  },
  {
    id: "exodus",
    name: "Exodus and judges",
    span: [-1450, -1050],
    dates: "Dates are debated: the 15th and 13th centuries BCE are the usual proposals for the Exodus.",
    powers: ["egypt"],
  },
  {
    id: "united",
    name: "The united kingdom",
    span: [-1050, -930],
    dates: "Saul, David and Solomon, c. 1050 to 930 BCE.",
    powers: ["egypt"],
  },
  {
    id: "divided",
    name: "The divided kingdom",
    span: [-930, -586],
    dates: "Israel and Judah, c. 930 BCE; Samaria falls to Assyria in 722, Jerusalem to Babylon in 586.",
    powers: ["egypt", "assyria"],
  },
  {
    id: "exile",
    name: "The exile",
    span: [-586, -539],
    dates: "From the fall of Jerusalem (586 BCE) to Cyrus taking Babylon (539 BCE).",
    powers: ["babylon", "egypt"],
  },
  {
    id: "persian",
    name: "Return and the Persian era",
    span: [-539, -332],
    dates: "From Cyrus (539 BCE) to Alexander the Great (332 BCE).",
    powers: ["persia"],
  },
  {
    id: "hellenistic",
    name: "The Hellenistic era",
    span: [-332, -63],
    dates: "From Alexander (332 BCE) to Rome taking Jerusalem (63 BCE).",
    powers: ["ptolemies", "seleucids"],
    note: "No book of the Protestant Bible is set in this era (the books of the Maccabees are), so no places light up.",
  },
  {
    id: "roman",
    name: "Rome and the New Testament",
    span: [-63, 100],
    dates: "From 63 BCE to the end of the 1st century CE.",
    powers: ["rome"],
  },
];

/**
 * The era a chapter is set in (by its story or, for the prophets, by when the prophet is placed), or -1 when it
 * isn't tied to one (Genesis 1 to 11, the poetry and wisdom books, Joel and Obadiah, whose dates are debated).
 */
export function eraOf(book: string, chapter: number): number {
  const at = (id: string) => ERAS.findIndex((e) => e.id === id);
  switch (book) {
    case "gen":
      return chapter >= 12 ? at("patriarchs") : -1;
    case "exo":
    case "lev":
    case "num":
    case "deu":
    case "jos":
    case "jdg":
    case "rut":
      return at("exodus");
    case "1sa":
      return chapter <= 7 ? at("exodus") : at("united");
    case "2sa":
      return at("united");
    case "1ki":
      return chapter <= 11 ? at("united") : at("divided");
    case "2ki":
      return chapter <= 24 ? at("divided") : at("exile");
    case "1ch":
      return chapter >= 10 ? at("united") : -1;
    case "2ch":
      return chapter <= 9 ? at("united") : chapter <= 35 ? at("divided") : at("exile");
    case "isa":
    case "hos":
    case "amo":
    case "mic":
    case "jon":
    case "nam":
    case "hab":
    case "zep":
      return at("divided");
    case "jer":
      return chapter <= 38 ? at("divided") : at("exile");
    case "lam":
    case "ezk":
    case "dan":
      return at("exile");
    case "ezr":
    case "neh":
    case "est":
    case "hag":
    case "zec":
    case "mal":
      return at("persian");
    default:
      return ["mat", "mrk", "luk", "jhn", "act", "rom", "1co", "2co", "gal", "eph", "php", "col", "1th", "2th", "1ti", "2ti", "tit", "phm", "heb", "jas", "1pe", "2pe", "1jn", "2jn", "3jn", "jud", "rev"].includes(book)
        ? at("roman")
        : -1;
  }
}
