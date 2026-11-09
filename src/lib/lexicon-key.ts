/**
 * One spelling key for a Hebrew or Greek word however it's written, so a word in an AI answer ("ḥērem", "hesed",
 * "agapē", "חֵרֶם", "ἀγάπη") finds its Strong's entry ("chêrem", "checed", "agápē"). Used by scripts/build-strongs.ts
 * (public/lexicon/index.json) and in the browser, so both sides spell it the same way.
 */
const HEB = /[֐-׿]/;
const GRK = /[Ͱ-Ͽἀ-῿]/;
const FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ", ς: "σ" };

/** "Hebrew" / "Greek" letters, or null for a romanized word. */
export const scriptOf = (w: string): "he" | "el" | null => (HEB.test(w) ? "he" : GRK.test(w) ? "el" : null);

export function wordKey(raw: string): string {
  const base = raw
    .normalize("NFD")
    .replace(/[̀-֑ͯ-ׇ]/g, "") // accents, macrons, dots; Hebrew points
    .toLowerCase()
    .replace(/[ךםןףץς]/g, (c) => FINALS[c] ?? c);
  if (scriptOf(base)) return base.replace(/[^א-תα-ω]/g, "");
  return base
    .replace(/[ᵉᵊ]/g, "e") // Strong's half-vowels: "tsᵉdâqâh", "bᵉrîyth"
    .replace(/[ʼʽʾʿ'’‘`\-\s]/g, "")
    .replace(/ç/g, "s")
    .replace(/kh|ch/g, "h") // ḥet / kaph / chi: "chêrem", "khesed", "ḥērem" → herem
    .replace(/ts|tz|c/g, "s") // tsade / samekh: Strong's writes samekh as c ("checed")
    .replace(/q/g, "k")
    .replace(/([ou])w/g, "$1") // Strong's "shâlôwm" → shalom
    .replace(/ph/g, "p")
    .replace(/th/g, "t") // "bᵉrîyth" = "berit"
    .replace(/iy/g, "i") // Strong's "ʼĕlôhîym" → elohim
    .replace(/y/g, "i") // "ʼĂdônây" = "adonai" (both sides spelled alike)
    .replace(/v/g, "b") // bet / vet: "kavod" = "kâbôwd"
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1") // doubled letters
    .replace(/(.)h$/, "$1"); // a final h: "tsedaqah" = "ṣedāqâ"
}
