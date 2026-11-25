/** The three opening verses of the hidden layer, copied verbatim from public/texts (made by a one-off script; never edited by hand). */
export const LAYER_VERSES = [
  {
    "id": "gen",
    "script": "hebrew",
    "ref": "Genesis 1:1",
    "lang": "Hebrew (Masoretic Text, WLC)",
    "text": "בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃",
    "href": "/read/bible/gen/1",
    "system": "gematria"
  },
  {
    "id": "jhn",
    "script": "greek",
    "ref": "John 1:1",
    "lang": "Greek (Textus Receptus)",
    "text": "Ἐν ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν πρὸς τὸν Θεόν, καὶ Θεὸς ἦν ὁ λόγος.",
    "href": "/read/bible/jhn/1",
    "system": "isopsephy"
  },
  {
    "id": "fatiha",
    "script": "arabic",
    "ref": "Quran 1:1",
    "lang": "Arabic (Tanzil, Uthmani script, verbatim)",
    "text": "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
    "href": "/read/quran/quran/1",
    "system": "abjad"
  }
] as const;
