/**
 * Letters as numbers, as the three traditions count them (my brother's ticket c74b9402, Nov 25: the hidden layer).
 * Hebrew gematria (standard values, final forms count as their letter), Greek isopsephy (with the old numerals
 * digamma/stigma 6 and koppa 90), Arabic abjad (the eastern order). Only base letters count: vowel points,
 * cantillation, accents, breathings, the small "dagger" alif and other marks are left out, as the traditional counts do.
 * The scripture text itself is never changed: these functions only read it.
 */
export type Script = "hebrew" | "greek" | "arabic";
export type Letter = { ch: string; value: number; word: number };

const HEBREW: Record<string, number> = {
  "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "ז": 7, "ח": 8, "ט": 9,
  "י": 10, "כ": 20, "ך": 20, "ל": 30, "מ": 40, "ם": 40, "נ": 50, "ן": 50, "ס": 60, "ע": 70, "פ": 80, "ף": 80, "צ": 90, "ץ": 90,
  "ק": 100, "ר": 200, "ש": 300, "ת": 400,
};
const GREEK: Record<string, number> = {
  α: 1, β: 2, γ: 3, δ: 4, ε: 5, ϛ: 6, ϝ: 6, ζ: 7, η: 8, θ: 9,
  ι: 10, κ: 20, λ: 30, μ: 40, ν: 50, ξ: 60, ο: 70, π: 80, ϙ: 90, ϟ: 90,
  ρ: 100, σ: 200, ς: 200, τ: 300, υ: 400, φ: 500, χ: 600, ψ: 700, ω: 800, ϡ: 900,
  "\u0345": 10, // the iota written under a letter (ἀρχῇ) is an iota and counts as one
};
const ARABIC: Record<string, number> = {
  "ا": 1, "أ": 1, "إ": 1, "آ": 1, "ٱ": 1, "ء": 1, "ب": 2, "ج": 3, "د": 4, "ه": 5, "ة": 5, "و": 6, "ؤ": 6, "ز": 7, "ح": 8, "ط": 9,
  "ي": 10, "ى": 10, "ئ": 10, "ك": 20, "ل": 30, "م": 40, "ن": 50, "س": 60, "ع": 70, "ف": 80, "ص": 90,
  "ق": 100, "ر": 200, "ش": 300, "ت": 400, "ث": 500, "خ": 600, "ذ": 700, "ض": 800, "ظ": 900, "غ": 1000,
};
const TABLE: Record<Script, Record<string, number>> = { hebrew: HEBREW, greek: GREEK, arabic: ARABIC };

/**
 * A verse's words as the counts see them: split at spaces (and, in Hebrew, at the maqaf that joins short words, as the
 * interlinear does), leaving out the paragraph marks פ and ס that stand alone after some verses (they aren't words).
 */
export function tokensOf(text: string, script: Script): string[] {
  const parts = text.split(script === "hebrew" ? /[\s\u05BE]+/ : /\s+/).filter(Boolean);
  return script === "hebrew" ? parts.filter((w) => !/^[\u05E4\u05E1]$/.test(w)) : parts;
}

/** The counted letters of a verse, in reading order, each with its value and which word it is in. */
export function lettersOf(text: string, script: Script): Letter[] {
  const table = TABLE[script];
  const out: Letter[] = [];
  let word = 0;
  for (const tok of tokensOf(text, script)) {
    // Greek: accents and breathings come apart from their letters (NFD) and are dropped; capitals count as small letters
    const src = script === "greek" ? tok.normalize("NFD").toLowerCase() : tok;
    let any = false;
    for (const ch of src) {
      const v = table[ch];
      if (v) {
        out.push({ ch, value: v, word });
        any = true;
      }
    }
    if (any) word++;
  }
  return out;
}

export const valueOf = (text: string, script: Script) => lettersOf(text, script).reduce((n, l) => n + l.value, 0);

/** The verse's words with their values (as written, punctuation trimmed), in the same order lettersOf numbers them. */
export function wordsOf(text: string, script: Script): { text: string; value: number }[] {
  return tokensOf(text, script)
    .map((w) => ({ text: w.replace(/[\u05C3,.;:\u00B7\u0387]+$/u, ""), value: valueOf(w, script) }))
    .filter((w) => w.value > 0);
}
