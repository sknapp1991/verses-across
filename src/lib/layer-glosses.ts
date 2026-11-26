/**
 * The hidden layer's study notes (hub c74b9402, my brother's third ask): each word of the three verses in Latin letters
 * and in English, in the verse's word order (as wordsOf in letter-values.ts counts them). Standard transliterations
 * (Hebrew: Sephardic/modern style, Greek: classical scholarly, Arabic: common scholarly with long vowels marked).
 */
export type Gloss = { say: string; means: string };

export const LAYER_GLOSSES: Record<string, Gloss[]> = {
  gen: [
    { say: "bereshit", means: "in (the) beginning" },
    { say: "bara", means: "created" },
    { say: "Elohim", means: "God" },
    { say: "et", means: "(marks what follows as the object; not translated)" },
    { say: "hashamayim", means: "the heavens" },
    { say: "ve'et", means: "and (object marker)" },
    { say: "ha'aretz", means: "the earth" },
  ],
  jhn: [
    { say: "en", means: "in" },
    { say: "archē", means: "beginning" },
    { say: "ēn", means: "was" },
    { say: "ho", means: "the" },
    { say: "logos", means: "Word" },
    { say: "kai", means: "and" },
    { say: "ho", means: "the" },
    { say: "logos", means: "Word" },
    { say: "ēn", means: "was" },
    { say: "pros", means: "with (literally, toward)" },
    { say: "ton", means: "the" },
    { say: "Theon", means: "God" },
    { say: "kai", means: "and" },
    { say: "Theos", means: "God" },
    { say: "ēn", means: "was" },
    { say: "ho", means: "the" },
    { say: "logos", means: "Word" },
  ],
  fatiha: [
    { say: "bismi", means: "in the name (of)" },
    { say: "Allāhi", means: "God (Allah)" },
    { say: "ar-Raḥmāni", means: "the Most Gracious" },
    { say: "ar-Raḥīmi", means: "the Most Merciful" },
  ],
};
