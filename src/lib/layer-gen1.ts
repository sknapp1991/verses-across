/** Genesis 1 for the hidden layer: verses verbatim (WLC, public/texts) with each word's sound and meaning (STEP Bible
 * TAHOT, Tyndale House, Cambridge, CC BY 4.0). Made by scripts/build-layer-gen1.mts; don't edit by hand. */
export type LayerWord = { he: string; say: string; means: string };
export type LayerVerse = { v: number; text: string; words: LayerWord[] };
export const GENESIS_1: LayerVerse[] = [
 {
  "v": 1,
  "text": "בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃",
  "words": [
   {
    "he": "בְּרֵאשִׁית",
    "say": "bereshit",
    "means": "in beginning"
   },
   {
    "he": "בָּרָא",
    "say": "bara'",
    "means": "he created"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "אֵת",
    "say": "'et",
    "means": "(object marker)"
   },
   {
    "he": "הַשָּׁמַיִם",
    "say": "hashamayim",
    "means": "the heavens"
   },
   {
    "he": "וְאֵת",
    "say": "ve'et",
    "means": "and (object marker)"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   }
  ]
 },
 {
  "v": 2,
  "text": "וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֨הוּ֙ וָבֹ֔הוּ וְחֹ֖שֶׁךְ עַל־פְּנֵ֣י תְה֑וֹם וְר֣וּחַ אֱלֹהִ֔ים מְרַחֶ֖פֶת עַל־פְּנֵ֥י הַמָּֽיִם׃",
  "words": [
   {
    "he": "וְהָאָרֶץ",
    "say": "veha'aretz",
    "means": "and the earth"
   },
   {
    "he": "הָיְתָה",
    "say": "hayetah",
    "means": "it was"
   },
   {
    "he": "תֹהוּ",
    "say": "tohu",
    "means": "formlessness"
   },
   {
    "he": "וָבֹהוּ",
    "say": "vavohu",
    "means": "and emptiness"
   },
   {
    "he": "וְחֹשֶׁךְ",
    "say": "vechoshekh",
    "means": "and darkness"
   },
   {
    "he": "עַל־",
    "say": "'al-",
    "means": "[was] over"
   },
   {
    "he": "פְּנֵי",
    "say": "penei",
    "means": "[the] surface of"
   },
   {
    "he": "תְהוֹם",
    "say": "tehom",
    "means": "[the] deep"
   },
   {
    "he": "וְרוּחַ",
    "say": "veruach",
    "means": "and [the] spirit of"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "מְרַחֶפֶת",
    "say": "merachefet",
    "means": "[was] hovering"
   },
   {
    "he": "עַל־",
    "say": "'al-",
    "means": "over"
   },
   {
    "he": "פְּנֵי",
    "say": "penei",
    "means": "[the] surface of"
   },
   {
    "he": "הַמָּיִם",
    "say": "hamayim",
    "means": "the waters"
   }
  ]
 },
 {
  "v": 3,
  "text": "וַיֹּ֥אמֶר אֱלֹהִ֖ים יְהִ֣י א֑וֹר וַֽיְהִי־אֽוֹר׃",
  "words": [
   {
    "he": "וַיֹּאמֶר",
    "say": "vaiyomer",
    "means": "and he said"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "יְהִי",
    "say": "yehi",
    "means": "let it be"
   },
   {
    "he": "אוֹר",
    "say": "'or",
    "means": "light"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "אוֹר",
    "say": "'or",
    "means": "light"
   }
  ]
 },
 {
  "v": 4,
  "text": "וַיַּ֧רְא אֱלֹהִ֛ים אֶת־הָא֖וֹר כִּי־ט֑וֹב וַיַּבְדֵּ֣ל אֱלֹהִ֔ים בֵּ֥ין הָא֖וֹר וּבֵ֥ין הַחֹֽשֶׁךְ׃",
  "words": [
   {
    "he": "וַיַּרְא",
    "say": "vaiyar'",
    "means": "and he saw"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "הָאוֹר",
    "say": "ha'or",
    "means": "the light"
   },
   {
    "he": "כִּי־",
    "say": "ki-",
    "means": "that"
   },
   {
    "he": "טוֹב",
    "say": "tov",
    "means": "[it was] good"
   },
   {
    "he": "וַיַּבְדֵּל",
    "say": "vaiyavdel",
    "means": "and he separated"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "בֵּין",
    "say": "bein",
    "means": "between"
   },
   {
    "he": "הָאוֹר",
    "say": "ha'or",
    "means": "the light"
   },
   {
    "he": "וּבֵין",
    "say": "uvein",
    "means": "and between"
   },
   {
    "he": "הַחֹשֶׁךְ",
    "say": "hachoshekh",
    "means": "the darkness"
   }
  ]
 },
 {
  "v": 5,
  "text": "וַיִּקְרָ֨א אֱלֹהִ֤ים ׀ לָאוֹר֙ י֔וֹם וְלַחֹ֖שֶׁךְ קָ֣רָא לָ֑יְלָה וַֽיְהִי־עֶ֥רֶב וַֽיְהִי־בֹ֖קֶר י֥וֹם אֶחָֽד׃ פ",
  "words": [
   {
    "he": "וַיִּקְרָא",
    "say": "vaiyikra'",
    "means": "and he called"
   },
   {
    "he": "אֱלֹהִים׀",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "לָאוֹר",
    "say": "la'or",
    "means": "to the light"
   },
   {
    "he": "יוֹם",
    "say": "yom",
    "means": "day"
   },
   {
    "he": "וְלַחֹשֶׁךְ",
    "say": "velachoshekh",
    "means": "and to the darkness"
   },
   {
    "he": "קָרָא",
    "say": "kara'",
    "means": "he called"
   },
   {
    "he": "לָיְלָה",
    "say": "lailah",
    "means": "night"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "עֶרֶב",
    "say": "'erev",
    "means": "evening"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "בֹקֶר",
    "say": "voker",
    "means": "morning"
   },
   {
    "he": "יוֹם",
    "say": "yom",
    "means": "day"
   },
   {
    "he": "אֶחָד",
    "say": "'echad",
    "means": "one"
   }
  ]
 },
 {
  "v": 6,
  "text": "וַיֹּ֣אמֶר אֱלֹהִ֔ים יְהִ֥י רָקִ֖יעַ בְּת֣וֹךְ הַמָּ֑יִם וִיהִ֣י מַבְדִּ֔יל בֵּ֥ין מַ֖יִם לָמָֽיִם׃",
  "words": [
   {
    "he": "וַיֹּאמֶר",
    "say": "vaiyomer",
    "means": "and he said"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "יְהִי",
    "say": "yehi",
    "means": "let it be"
   },
   {
    "he": "רָקִיעַ",
    "say": "rakia'",
    "means": "a firmament"
   },
   {
    "he": "בְּתוֹךְ",
    "say": "betokh",
    "means": "in [the] middle of"
   },
   {
    "he": "הַמָּיִם",
    "say": "hamayim",
    "means": "the waters"
   },
   {
    "he": "וִיהִי",
    "say": "vihi",
    "means": "and let it be"
   },
   {
    "he": "מַבְדִּיל",
    "say": "mavdil",
    "means": "separating"
   },
   {
    "he": "בֵּין",
    "say": "bein",
    "means": "between"
   },
   {
    "he": "מַיִם",
    "say": "mayim",
    "means": "waters"
   },
   {
    "he": "לָמָיִם",
    "say": "lamayim",
    "means": "to waters"
   }
  ]
 },
 {
  "v": 7,
  "text": "וַיַּ֣עַשׂ אֱלֹהִים֮ אֶת־הָרָקִיעַ֒ וַיַּבְדֵּ֗ל בֵּ֤ין הַמַּ֨יִם֙ אֲשֶׁר֙ מִתַּ֣חַת לָרָקִ֔יעַ וּבֵ֣ין הַמַּ֔יִם אֲשֶׁ֖ר מֵעַ֣ל לָרָקִ֑יעַ וַֽיְהִי־כֵֽן׃",
  "words": [
   {
    "he": "וַיַּעַשׂ",
    "say": "vaiya'as",
    "means": "and he made"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "הָרָקִיעַ",
    "say": "harakia'",
    "means": "the firmament"
   },
   {
    "he": "וַיַּבְדֵּל",
    "say": "vaiyavdel",
    "means": "and he separated"
   },
   {
    "he": "בֵּין",
    "say": "bein",
    "means": "between"
   },
   {
    "he": "הַמַּיִם",
    "say": "hamayim",
    "means": "the waters"
   },
   {
    "he": "אֲשֶׁר",
    "say": "'asher",
    "means": "which"
   },
   {
    "he": "מִתַּחַת",
    "say": "mitachat",
    "means": "[were] from under"
   },
   {
    "he": "לָרָקִיעַ",
    "say": "larakia'",
    "means": "to the firmament"
   },
   {
    "he": "וּבֵין",
    "say": "uvein",
    "means": "and between"
   },
   {
    "he": "הַמַּיִם",
    "say": "hamayim",
    "means": "the waters"
   },
   {
    "he": "אֲשֶׁר",
    "say": "'asher",
    "means": "which"
   },
   {
    "he": "מֵעַל",
    "say": "me'al",
    "means": "[were] from above"
   },
   {
    "he": "לָרָקִיעַ",
    "say": "larakia'",
    "means": "to the firmament"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and it was"
   },
   {
    "he": "כֵן",
    "say": "khen",
    "means": "so"
   }
  ]
 },
 {
  "v": 8,
  "text": "וַיִּקְרָ֧א אֱלֹהִ֛ים לָֽרָקִ֖יעַ שָׁמָ֑יִם וַֽיְהִי־עֶ֥רֶב וַֽיְהִי־בֹ֖קֶר י֥וֹם שֵׁנִֽי׃ פ",
  "words": [
   {
    "he": "וַיִּקְרָא",
    "say": "vaiyikra'",
    "means": "and he called"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "לָרָקִיעַ",
    "say": "larakia'",
    "means": "to the firmament"
   },
   {
    "he": "שָׁמָיִם",
    "say": "shamayim",
    "means": "heaven"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "עֶרֶב",
    "say": "'erev",
    "means": "evening"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "בֹקֶר",
    "say": "voker",
    "means": "morning"
   },
   {
    "he": "יוֹם",
    "say": "yom",
    "means": "a day"
   },
   {
    "he": "שֵׁנִי",
    "say": "sheni",
    "means": "second"
   }
  ]
 },
 {
  "v": 9,
  "text": "וַיֹּ֣אמֶר אֱלֹהִ֗ים יִקָּו֨וּ הַמַּ֜יִם מִתַּ֤חַת הַשָּׁמַ֨יִם֙ אֶל־מָק֣וֹם אֶחָ֔ד וְתֵרָאֶ֖ה הַיַּבָּשָׁ֑ה וַֽיְהִי־כֵֽן׃",
  "words": [
   {
    "he": "וַיֹּאמֶר",
    "say": "vaiyomer",
    "means": "and he said"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "יִקָּווּ",
    "say": "yikavu",
    "means": "let them gather"
   },
   {
    "he": "הַמַּיִם",
    "say": "hamayim",
    "means": "the waters"
   },
   {
    "he": "מִתַּחַת",
    "say": "mitachat",
    "means": "from under"
   },
   {
    "he": "הַשָּׁמַיִם",
    "say": "hashamayim",
    "means": "the heavens"
   },
   {
    "he": "אֶל־",
    "say": "'el-",
    "means": "to"
   },
   {
    "he": "מָקוֹם",
    "say": "makom",
    "means": "a place"
   },
   {
    "he": "אֶחָד",
    "say": "'echad",
    "means": "one"
   },
   {
    "he": "וְתֵרָאֶה",
    "say": "vetera'eh",
    "means": "and let it appear"
   },
   {
    "he": "הַיַּבָּשָׁה",
    "say": "haiyabashah",
    "means": "the dry ground"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and it was"
   },
   {
    "he": "כֵן",
    "say": "khen",
    "means": "so"
   }
  ]
 },
 {
  "v": 10,
  "text": "וַיִּקְרָ֨א אֱלֹהִ֤ים ׀ לַיַּבָּשָׁה֙ אֶ֔רֶץ וּלְמִקְוֵ֥ה הַמַּ֖יִם קָרָ֣א יַמִּ֑ים וַיַּ֥רְא אֱלֹהִ֖ים כִּי־טֽוֹב׃",
  "words": [
   {
    "he": "וַיִּקְרָא",
    "say": "vaiyikra'",
    "means": "and he called"
   },
   {
    "he": "אֱלֹהִים׀",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "לַיַּבָּשָׁה",
    "say": "laiyabashah",
    "means": "to the dry ground"
   },
   {
    "he": "אֶרֶץ",
    "say": "'eretz",
    "means": "earth"
   },
   {
    "he": "וּלְמִקְוֵה",
    "say": "ulemikveh",
    "means": "and to [the] collection of"
   },
   {
    "he": "הַמַּיִם",
    "say": "hamayim",
    "means": "the waters"
   },
   {
    "he": "קָרָא",
    "say": "kara'",
    "means": "he called"
   },
   {
    "he": "יַמִּים",
    "say": "yamim",
    "means": "seas"
   },
   {
    "he": "וַיַּרְא",
    "say": "vaiyar'",
    "means": "and he saw"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "כִּי־",
    "say": "ki-",
    "means": "that"
   },
   {
    "he": "טוֹב",
    "say": "tov",
    "means": "[it was] good"
   }
  ]
 },
 {
  "v": 11,
  "text": "וַיֹּ֣אמֶר אֱלֹהִ֗ים תַּֽדְשֵׁ֤א הָאָ֨רֶץ֙ דֶּ֔שֶׁא עֵ֚שֶׂב מַזְרִ֣יעַ זֶ֔רַע עֵ֣ץ פְּרִ֞י עֹ֤שֶׂה פְּרִי֙ לְמִינ֔וֹ אֲשֶׁ֥ר זַרְעוֹ־ב֖וֹ עַל־הָאָ֑רֶץ וַֽיְהִי־כֵֽן׃",
  "words": [
   {
    "he": "וַיֹּאמֶר",
    "say": "vaiyomer",
    "means": "and he said"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "תַּדְשֵׁא",
    "say": "tadshe'",
    "means": "let it sprout"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "דֶּשֶׁא",
    "say": "deshe'",
    "means": "vegetation"
   },
   {
    "he": "עֵשֶׂב",
    "say": "'esev",
    "means": "plant[s]"
   },
   {
    "he": "מַזְרִיעַ",
    "say": "mazria'",
    "means": "[which] bears seed"
   },
   {
    "he": "זֶרַע",
    "say": "zera'",
    "means": "seed"
   },
   {
    "he": "עֵץ",
    "say": "'etz",
    "means": "tree[s] of"
   },
   {
    "he": "פְּרִי",
    "say": "peri",
    "means": "fruit"
   },
   {
    "he": "עֹשֶׂה",
    "say": "'oseh",
    "means": "producing"
   },
   {
    "he": "פְּרִי",
    "say": "peri",
    "means": "fruit"
   },
   {
    "he": "לְמִינוֹ",
    "say": "lemino",
    "means": "to kind its"
   },
   {
    "he": "אֲשֶׁר",
    "say": "'asher",
    "means": "which"
   },
   {
    "he": "זַרְעוֹ־",
    "say": "zar'ov-",
    "means": "seed its"
   },
   {
    "he": "בוֹ",
    "say": "vo",
    "means": "[is] in the it"
   },
   {
    "he": "עַל־",
    "say": "'al-",
    "means": "on"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and it was"
   },
   {
    "he": "כֵן",
    "say": "khen",
    "means": "so"
   }
  ]
 },
 {
  "v": 12,
  "text": "וַתּוֹצֵ֨א הָאָ֜רֶץ דֶּ֠שֶׁא עֵ֣שֶׂב מַזְרִ֤יעַ זֶ֨רַע֙ לְמִינֵ֔הוּ וְעֵ֧ץ עֹֽשֶׂה־פְּרִ֛י אֲשֶׁ֥ר זַרְעוֹ־ב֖וֹ לְמִינֵ֑הוּ וַיַּ֥רְא אֱלֹהִ֖ים כִּי־טֽוֹב׃",
  "words": [
   {
    "he": "וַתּוֹצֵא",
    "say": "vatotze'",
    "means": "and it brought forth"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "דֶּשֶׁא",
    "say": "deshe'",
    "means": "vegetation"
   },
   {
    "he": "עֵשֶׂב",
    "say": "'esev",
    "means": "plant[s]"
   },
   {
    "he": "מַזְרִיעַ",
    "say": "mazria'",
    "means": "[which] bears seed"
   },
   {
    "he": "זֶרַע",
    "say": "zera'",
    "means": "seed"
   },
   {
    "he": "לְמִינֵהוּ",
    "say": "leminehu",
    "means": "to kind its"
   },
   {
    "he": "וְעֵץ",
    "say": "ve'etz",
    "means": "and tree[s]"
   },
   {
    "he": "עֹשֶׂה־",
    "say": "'oseh-",
    "means": "producing"
   },
   {
    "he": "פְּרִי",
    "say": "peri",
    "means": "fruit"
   },
   {
    "he": "אֲשֶׁר",
    "say": "'asher",
    "means": "which"
   },
   {
    "he": "זַרְעוֹ־",
    "say": "zar'ov-",
    "means": "seed its"
   },
   {
    "he": "בוֹ",
    "say": "vo",
    "means": "[was] in the it"
   },
   {
    "he": "לְמִינֵהוּ",
    "say": "leminehu",
    "means": "to kind its"
   },
   {
    "he": "וַיַּרְא",
    "say": "vaiyar'",
    "means": "and he saw"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "כִּי־",
    "say": "ki-",
    "means": "that"
   },
   {
    "he": "טוֹב",
    "say": "tov",
    "means": "[it was] good"
   }
  ]
 },
 {
  "v": 13,
  "text": "וַֽיְהִי־עֶ֥רֶב וַֽיְהִי־בֹ֖קֶר י֥וֹם שְׁלִישִֽׁי׃ פ",
  "words": [
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "עֶרֶב",
    "say": "'erev",
    "means": "evening"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "בֹקֶר",
    "say": "voker",
    "means": "morning"
   },
   {
    "he": "יוֹם",
    "say": "yom",
    "means": "a day"
   },
   {
    "he": "שְׁלִישִׁי",
    "say": "shelishi",
    "means": "third"
   }
  ]
 },
 {
  "v": 14,
  "text": "וַיֹּ֣אמֶר אֱלֹהִ֗ים יְהִ֤י מְאֹרֹת֙ בִּרְקִ֣יעַ הַשָּׁמַ֔יִם לְהַבְדִּ֕יל בֵּ֥ין הַיּ֖וֹם וּבֵ֣ין הַלָּ֑יְלָה וְהָי֤וּ לְאֹתֹת֙ וּלְמ֣וֹעֲדִ֔ים וּלְיָמִ֖ים וְשָׁנִֽים׃",
  "words": [
   {
    "he": "וַיֹּאמֶר",
    "say": "vaiyomer",
    "means": "and he said"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "יְהִי",
    "say": "yehi",
    "means": "let it be"
   },
   {
    "he": "מְאֹרֹת",
    "say": "me'orot",
    "means": "luminaries"
   },
   {
    "he": "בִּרְקִיעַ",
    "say": "birkia'",
    "means": "in [the] firmament of"
   },
   {
    "he": "הַשָּׁמַיִם",
    "say": "hashamayim",
    "means": "the heavens"
   },
   {
    "he": "לְהַבְדִּיל",
    "say": "lehavdil",
    "means": "to separate"
   },
   {
    "he": "בֵּין",
    "say": "bein",
    "means": "between"
   },
   {
    "he": "הַיּוֹם",
    "say": "haiyom",
    "means": "the day"
   },
   {
    "he": "וּבֵין",
    "say": "uvein",
    "means": "and between"
   },
   {
    "he": "הַלָּיְלָה",
    "say": "halayelah",
    "means": "the night"
   },
   {
    "he": "וְהָיוּ",
    "say": "vehayu",
    "means": "and they will become"
   },
   {
    "he": "לְאֹתֹת",
    "say": "le'otot",
    "means": "into signs"
   },
   {
    "he": "וּלְמוֹעֲדִים",
    "say": "ulemo'adim",
    "means": "and into appointed times"
   },
   {
    "he": "וּלְיָמִים",
    "say": "uleyamim",
    "means": "and into days"
   },
   {
    "he": "וְשָׁנִים",
    "say": "veshanim",
    "means": "and years"
   }
  ]
 },
 {
  "v": 15,
  "text": "וְהָי֤וּ לִמְאוֹרֹת֙ בִּרְקִ֣יעַ הַשָּׁמַ֔יִם לְהָאִ֖יר עַל־הָאָ֑רֶץ וַֽיְהִי־כֵֽן׃",
  "words": [
   {
    "he": "וְהָיוּ",
    "say": "vehayu",
    "means": "and they will become"
   },
   {
    "he": "לִמְאוֹרֹת",
    "say": "lim'orot",
    "means": "into luminaries"
   },
   {
    "he": "בִּרְקִיעַ",
    "say": "birkia'",
    "means": "in [the] firmament of"
   },
   {
    "he": "הַשָּׁמַיִם",
    "say": "hashamayim",
    "means": "the heavens"
   },
   {
    "he": "לְהָאִיר",
    "say": "leha'ir",
    "means": "to give light"
   },
   {
    "he": "עַל־",
    "say": "'al-",
    "means": "on"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and it was"
   },
   {
    "he": "כֵן",
    "say": "khen",
    "means": "so"
   }
  ]
 },
 {
  "v": 16,
  "text": "וַיַּ֣עַשׂ אֱלֹהִ֔ים אֶת־שְׁנֵ֥י הַמְּאֹרֹ֖ת הַגְּדֹלִ֑ים אֶת־הַמָּא֤וֹר הַגָּדֹל֙ לְמֶמְשֶׁ֣לֶת הַיּ֔וֹם וְאֶת־הַמָּא֤וֹר הַקָּטֹן֙ לְמֶמְשֶׁ֣לֶת הַלַּ֔יְלָה וְאֵ֖ת הַכּוֹכָבִֽים׃",
  "words": [
   {
    "he": "וַיַּעַשׂ",
    "say": "vaiya'as",
    "means": "and he made"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "שְׁנֵי",
    "say": "shenei",
    "means": "[the] two"
   },
   {
    "he": "הַמְּאֹרֹת",
    "say": "hame'orot",
    "means": "the luminaries"
   },
   {
    "he": "הַגְּדֹלִים",
    "say": "hagedolim",
    "means": "the great"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "הַמָּאוֹר",
    "say": "hama'or",
    "means": "the luminary"
   },
   {
    "he": "הַגָּדֹל",
    "say": "hagadol",
    "means": "the great"
   },
   {
    "he": "לְמֶמְשֶׁלֶת",
    "say": "lememshelet",
    "means": "for [the] dominion of"
   },
   {
    "he": "הַיּוֹם",
    "say": "haiyom",
    "means": "the day"
   },
   {
    "he": "וְאֶת־",
    "say": "ve'et",
    "means": "and (object marker)"
   },
   {
    "he": "הַמָּאוֹר",
    "say": "hama'or",
    "means": "the luminary"
   },
   {
    "he": "הַקָּטֹן",
    "say": "hakaton",
    "means": "the small"
   },
   {
    "he": "לְמֶמְשֶׁלֶת",
    "say": "lememshelet",
    "means": "for [the] dominion of"
   },
   {
    "he": "הַלַּיְלָה",
    "say": "halaylah",
    "means": "the night"
   },
   {
    "he": "וְאֵת",
    "say": "ve'et",
    "means": "and (object marker)"
   },
   {
    "he": "הַכּוֹכָבִים",
    "say": "hakokhavim",
    "means": "the stars"
   }
  ]
 },
 {
  "v": 17,
  "text": "וַיִּתֵּ֥ן אֹתָ֛ם אֱלֹהִ֖ים בִּרְקִ֣יעַ הַשָּׁמָ֑יִם לְהָאִ֖יר עַל־הָאָֽרֶץ׃",
  "words": [
   {
    "he": "וַיִּתֵּן",
    "say": "vaiyiten",
    "means": "and he set"
   },
   {
    "he": "אֹתָם",
    "say": "'otam",
    "means": "(object marker) them"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "בִּרְקִיעַ",
    "say": "birkia'",
    "means": "in [the] firmament of"
   },
   {
    "he": "הַשָּׁמָיִם",
    "say": "hashamayim",
    "means": "the heavens"
   },
   {
    "he": "לְהָאִיר",
    "say": "leha'ir",
    "means": "to give light"
   },
   {
    "he": "עַל־",
    "say": "'al-",
    "means": "on"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   }
  ]
 },
 {
  "v": 18,
  "text": "וְלִמְשֹׁל֙ בַּיּ֣וֹם וּבַלַּ֔יְלָה וּֽלֲהַבְדִּ֔יל בֵּ֥ין הָא֖וֹר וּבֵ֣ין הַחֹ֑שֶׁךְ וַיַּ֥רְא אֱלֹהִ֖ים כִּי־טֽוֹב׃",
  "words": [
   {
    "he": "וְלִמְשֹׁל",
    "say": "velimshol",
    "means": "and to rule"
   },
   {
    "he": "בַּיּוֹם",
    "say": "baiyom",
    "means": "over the day"
   },
   {
    "he": "וּבַלַּיְלָה",
    "say": "uvalaylah",
    "means": "and over the night"
   },
   {
    "he": "וּלֲהַבְדִּיל",
    "say": "ulahavdil",
    "means": "and to separate"
   },
   {
    "he": "בֵּין",
    "say": "bein",
    "means": "between"
   },
   {
    "he": "הָאוֹר",
    "say": "ha'or",
    "means": "the light"
   },
   {
    "he": "וּבֵין",
    "say": "uvein",
    "means": "and between"
   },
   {
    "he": "הַחֹשֶׁךְ",
    "say": "hachoshekh",
    "means": "the darkness"
   },
   {
    "he": "וַיַּרְא",
    "say": "vaiyar'",
    "means": "and he saw"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "כִּי־",
    "say": "ki-",
    "means": "that"
   },
   {
    "he": "טוֹב",
    "say": "tov",
    "means": "[it was] good"
   }
  ]
 },
 {
  "v": 19,
  "text": "וַֽיְהִי־עֶ֥רֶב וַֽיְהִי־בֹ֖קֶר י֥וֹם רְבִיעִֽי׃ פ",
  "words": [
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "עֶרֶב",
    "say": "'erev",
    "means": "evening"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "בֹקֶר",
    "say": "voker",
    "means": "morning"
   },
   {
    "he": "יוֹם",
    "say": "yom",
    "means": "a day"
   },
   {
    "he": "רְבִיעִי",
    "say": "revi'i",
    "means": "fourth"
   }
  ]
 },
 {
  "v": 20,
  "text": "וַיֹּ֣אמֶר אֱלֹהִ֔ים יִשְׁרְצ֣וּ הַמַּ֔יִם שֶׁ֖רֶץ נֶ֣פֶשׁ חַיָּ֑ה וְעוֹף֙ יְעוֹפֵ֣ף עַל־הָאָ֔רֶץ עַל־פְּנֵ֖י רְקִ֥יעַ הַשָּׁמָֽיִם׃",
  "words": [
   {
    "he": "וַיֹּאמֶר",
    "say": "vaiyomer",
    "means": "and he said"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "יִשְׁרְצוּ",
    "say": "yishretzu",
    "means": "let them swarm"
   },
   {
    "he": "הַמַּיִם",
    "say": "hamayim",
    "means": "the waters"
   },
   {
    "he": "שֶׁרֶץ",
    "say": "sheretz",
    "means": "swarming thing[s]"
   },
   {
    "he": "נֶפֶשׁ",
    "say": "nefesh",
    "means": "creature[s]"
   },
   {
    "he": "חַיָּה",
    "say": "chaiyah",
    "means": "living"
   },
   {
    "he": "וְעוֹף",
    "say": "ve'of",
    "means": "and bird[s]"
   },
   {
    "he": "יְעוֹפֵף",
    "say": "ye'ofef",
    "means": "let it fly"
   },
   {
    "he": "עַל־",
    "say": "'al-",
    "means": "above"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "עַל־",
    "say": "'al-",
    "means": "on"
   },
   {
    "he": "פְּנֵי",
    "say": "penei",
    "means": "[the] surface of"
   },
   {
    "he": "רְקִיעַ",
    "say": "rekia'",
    "means": "[the] firmament of"
   },
   {
    "he": "הַשָּׁמָיִם",
    "say": "hashamayim",
    "means": "the heavens"
   }
  ]
 },
 {
  "v": 21,
  "text": "וַיִּבְרָ֣א אֱלֹהִ֔ים אֶת־הַתַּנִּינִ֖ם הַגְּדֹלִ֑ים וְאֵ֣ת כָּל־נֶ֣פֶשׁ הַֽחַיָּ֣ה ׀ הָֽרֹמֶ֡שֶׂת אֲשֶׁר֩ שָׁרְצ֨וּ הַמַּ֜יִם לְמִֽינֵהֶ֗ם וְאֵ֨ת כָּל־ע֤וֹף כָּנָף֙ לְמִינֵ֔הוּ וַיַּ֥רְא אֱלֹהִ֖ים כִּי־טֽוֹב׃",
  "words": [
   {
    "he": "וַיִּבְרָא",
    "say": "vaiyivra'",
    "means": "and he created"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "הַתַּנִּינִם",
    "say": "hataninim",
    "means": "the sea monsters"
   },
   {
    "he": "הַגְּדֹלִים",
    "say": "hagedolim",
    "means": "the great"
   },
   {
    "he": "וְאֵת",
    "say": "ve'et",
    "means": "and (object marker)"
   },
   {
    "he": "כָּל־",
    "say": "kol-",
    "means": "every"
   },
   {
    "he": "נֶפֶשׁ",
    "say": "nefesh",
    "means": "creature"
   },
   {
    "he": "הַחַיָּה׀",
    "say": "hachaiyah",
    "means": "the living"
   },
   {
    "he": "הָרֹמֶשֶׂת",
    "say": "haromeset",
    "means": "which creeps"
   },
   {
    "he": "אֲשֶׁר",
    "say": "'asher",
    "means": "which"
   },
   {
    "he": "שָׁרְצוּ",
    "say": "sharetzu",
    "means": "they swarmed"
   },
   {
    "he": "הַמַּיִם",
    "say": "hamayim",
    "means": "the waters"
   },
   {
    "he": "לְמִינֵהֶם",
    "say": "leminehem",
    "means": "to kind their"
   },
   {
    "he": "וְאֵת",
    "say": "ve'et",
    "means": "and (object marker)"
   },
   {
    "he": "כָּל־",
    "say": "kol-",
    "means": "every"
   },
   {
    "he": "עוֹף",
    "say": "of",
    "means": "bird of"
   },
   {
    "he": "כָּנָף",
    "say": "kanaf",
    "means": "wing"
   },
   {
    "he": "לְמִינֵהוּ",
    "say": "leminehu",
    "means": "to kind its"
   },
   {
    "he": "וַיַּרְא",
    "say": "vaiyar'",
    "means": "and he saw"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "כִּי־",
    "say": "ki-",
    "means": "that"
   },
   {
    "he": "טוֹב",
    "say": "tov",
    "means": "[it was] good"
   }
  ]
 },
 {
  "v": 22,
  "text": "וַיְבָ֧רֶךְ אֹתָ֛ם אֱלֹהִ֖ים לֵאמֹ֑ר פְּר֣וּ וּרְב֗וּ וּמִלְא֤וּ אֶת־הַמַּ֨יִם֙ בַּיַּמִּ֔ים וְהָע֖וֹף יִ֥רֶב בָּאָֽרֶץ׃",
  "words": [
   {
    "he": "וַיְבָרֶךְ",
    "say": "vayvarekh",
    "means": "and he blessed"
   },
   {
    "he": "אֹתָם",
    "say": "'otam",
    "means": "(object marker) them"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "לֵאמֹר",
    "say": "lemor",
    "means": "to saying"
   },
   {
    "he": "פְּרוּ",
    "say": "peru",
    "means": "be fruitful"
   },
   {
    "he": "וּרְבוּ",
    "say": "urevu",
    "means": "and multiply"
   },
   {
    "he": "וּמִלְאוּ",
    "say": "umil'u",
    "means": "and fill"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "הַמַּיִם",
    "say": "hamayim",
    "means": "the waters"
   },
   {
    "he": "בַּיַּמִּים",
    "say": "baiyamim",
    "means": "in the seas"
   },
   {
    "he": "וְהָעוֹף",
    "say": "veha'of",
    "means": "and the bird[s]"
   },
   {
    "he": "יִרֶב",
    "say": "yirev",
    "means": "let it multiply"
   },
   {
    "he": "בָּאָרֶץ",
    "say": "ba'aretz",
    "means": "on the earth"
   }
  ]
 },
 {
  "v": 23,
  "text": "וַֽיְהִי־עֶ֥רֶב וַֽיְהִי־בֹ֖קֶר י֥וֹם חֲמִישִֽׁי׃ פ",
  "words": [
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "עֶרֶב",
    "say": "'erev",
    "means": "evening"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "בֹקֶר",
    "say": "voker",
    "means": "morning"
   },
   {
    "he": "יוֹם",
    "say": "yom",
    "means": "a day"
   },
   {
    "he": "חֲמִישִׁי",
    "say": "chamishi",
    "means": "fifth"
   }
  ]
 },
 {
  "v": 24,
  "text": "וַיֹּ֣אמֶר אֱלֹהִ֗ים תּוֹצֵ֨א הָאָ֜רֶץ נֶ֤פֶשׁ חַיָּה֙ לְמִינָ֔הּ בְּהֵמָ֥ה וָרֶ֛מֶשׂ וְחַֽיְתוֹ־אֶ֖רֶץ לְמִינָ֑הּ וַֽיְהִי־כֵֽן׃",
  "words": [
   {
    "he": "וַיֹּאמֶר",
    "say": "vaiyomer",
    "means": "and he said"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "תּוֹצֵא",
    "say": "totze'",
    "means": "let it produce"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "נֶפֶשׁ",
    "say": "nefesh",
    "means": "creature[s]"
   },
   {
    "he": "חַיָּה",
    "say": "chaiyah",
    "means": "living"
   },
   {
    "he": "לְמִינָהּ",
    "say": "leminah",
    "means": "to kind its"
   },
   {
    "he": "בְּהֵמָה",
    "say": "behemah",
    "means": "livestock"
   },
   {
    "he": "וָרֶמֶשׂ",
    "say": "varemes",
    "means": "and creeping thing[s]"
   },
   {
    "he": "וְחַיְתוֹ־",
    "say": "vechaytov-",
    "means": "and animal[s] of"
   },
   {
    "he": "אֶרֶץ",
    "say": "'eretz",
    "means": "[the] earth"
   },
   {
    "he": "לְמִינָהּ",
    "say": "leminah",
    "means": "to kind its"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and it was"
   },
   {
    "he": "כֵן",
    "say": "khen",
    "means": "so"
   }
  ]
 },
 {
  "v": 25,
  "text": "וַיַּ֣עַשׂ אֱלֹהִים֩ אֶת־חַיַּ֨ת הָאָ֜רֶץ לְמִינָ֗הּ וְאֶת־הַבְּהֵמָה֙ לְמִינָ֔הּ וְאֵ֛ת כָּל־רֶ֥מֶשׂ הָֽאֲדָמָ֖ה לְמִינֵ֑הוּ וַיַּ֥רְא אֱלֹהִ֖ים כִּי־טֽוֹב׃",
  "words": [
   {
    "he": "וַיַּעַשׂ",
    "say": "vaiya'as",
    "means": "and he made"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "חַיַּת",
    "say": "chaiyat",
    "means": "[the] animal[s] of"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "לְמִינָהּ",
    "say": "leminah",
    "means": "to kind its"
   },
   {
    "he": "וְאֶת־",
    "say": "ve'et",
    "means": "and (object marker)"
   },
   {
    "he": "הַבְּהֵמָה",
    "say": "habehemah",
    "means": "the livestock"
   },
   {
    "he": "לְמִינָהּ",
    "say": "leminah",
    "means": "to kind its"
   },
   {
    "he": "וְאֵת",
    "say": "ve'et",
    "means": "and (object marker)"
   },
   {
    "he": "כָּל־",
    "say": "kol-",
    "means": "every"
   },
   {
    "he": "רֶמֶשׂ",
    "say": "remes",
    "means": "the creeping thing of"
   },
   {
    "he": "הָאֲדָמָה",
    "say": "ha'adamah",
    "means": "the ground"
   },
   {
    "he": "לְמִינֵהוּ",
    "say": "leminehu",
    "means": "to kind its"
   },
   {
    "he": "וַיַּרְא",
    "say": "vaiyar'",
    "means": "and he saw"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "כִּי־",
    "say": "ki-",
    "means": "that"
   },
   {
    "he": "טוֹב",
    "say": "tov",
    "means": "[it was] good"
   }
  ]
 },
 {
  "v": 26,
  "text": "וַיֹּ֣אמֶר אֱלֹהִ֔ים נַֽעֲשֶׂ֥ה אָדָ֛ם בְּצַלְמֵ֖נוּ כִּדְמוּתֵ֑נוּ וְיִרְדּוּ֩ בִדְגַ֨ת הַיָּ֜ם וּבְע֣וֹף הַשָּׁמַ֗יִם וּבַבְּהֵמָה֙ וּבְכָל־הָאָ֔רֶץ וּבְכָל־הָרֶ֖מֶשׂ הָֽרֹמֵ֥שׂ עַל־הָאָֽרֶץ׃",
  "words": [
   {
    "he": "וַיֹּאמֶר",
    "say": "vaiyomer",
    "means": "and he said"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "נַעֲשֶׂה",
    "say": "na'aseh",
    "means": "let us make"
   },
   {
    "he": "אָדָם",
    "say": "'adam",
    "means": "humankind"
   },
   {
    "he": "בְּצַלְמֵנוּ",
    "say": "betzalmenu",
    "means": "in image our"
   },
   {
    "he": "כִּדְמוּתֵנוּ",
    "say": "kidmutenu",
    "means": "according to likeness our"
   },
   {
    "he": "וְיִרְדּוּ",
    "say": "veyirdu",
    "means": "and they may rule"
   },
   {
    "he": "בִדְגַת",
    "say": "vidgat",
    "means": "over [the] fish of"
   },
   {
    "he": "הַיָּם",
    "say": "haiyam",
    "means": "the sea"
   },
   {
    "he": "וּבְעוֹף",
    "say": "uve'of",
    "means": "and over [the] bird[s] of"
   },
   {
    "he": "הַשָּׁמַיִם",
    "say": "hashamayim",
    "means": "the heavens"
   },
   {
    "he": "וּבַבְּהֵמָה",
    "say": "uvabehemah",
    "means": "and over the livestock"
   },
   {
    "he": "וּבְכָל־",
    "say": "uvekhol-",
    "means": "and over all"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "וּבְכָל־",
    "say": "uvekhol-",
    "means": "and over every"
   },
   {
    "he": "הָרֶמֶשׂ",
    "say": "haremes",
    "means": "the creeping thing"
   },
   {
    "he": "הָרֹמֵשׂ",
    "say": "haromes",
    "means": "which creeps"
   },
   {
    "he": "עַל־",
    "say": "'al-",
    "means": "on"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   }
  ]
 },
 {
  "v": 27,
  "text": "וַיִּבְרָ֨א אֱלֹהִ֤ים ׀ אֶת־הָֽאָדָם֙ בְּצַלְמ֔וֹ בְּצֶ֥לֶם אֱלֹהִ֖ים בָּרָ֣א אֹת֑וֹ זָכָ֥ר וּנְקֵבָ֖ה בָּרָ֥א אֹתָֽם׃",
  "words": [
   {
    "he": "וַיִּבְרָא",
    "say": "vaiyivra'",
    "means": "and he created"
   },
   {
    "he": "אֱלֹהִים׀",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "הָאָדָם",
    "say": "ha'adam",
    "means": "the humankind"
   },
   {
    "he": "בְּצַלְמוֹ",
    "say": "betzalmo",
    "means": "in own image his"
   },
   {
    "he": "בְּצֶלֶם",
    "say": "betzelem",
    "means": "in [the] image of"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "בָּרָא",
    "say": "bara'",
    "means": "he created"
   },
   {
    "he": "אֹתוֹ",
    "say": "'oto",
    "means": "(object marker) it"
   },
   {
    "he": "זָכָר",
    "say": "zakhar",
    "means": "male"
   },
   {
    "he": "וּנְקֵבָה",
    "say": "unekevah",
    "means": "and female"
   },
   {
    "he": "בָּרָא",
    "say": "bara'",
    "means": "he created"
   },
   {
    "he": "אֹתָם",
    "say": "'otam",
    "means": "(object marker) them"
   }
  ]
 },
 {
  "v": 28,
  "text": "וַיְבָ֣רֶךְ אֹתָם֮ אֱלֹהִים֒ וַיֹּ֨אמֶר לָהֶ֜ם אֱלֹהִ֗ים פְּר֥וּ וּרְב֛וּ וּמִלְא֥וּ אֶת־הָאָ֖רֶץ וְכִבְשֻׁ֑הָ וּרְד֞וּ בִּדְגַ֤ת הַיָּם֙ וּבְע֣וֹף הַשָּׁמַ֔יִם וּבְכָל־חַיָּ֖ה הָֽרֹמֶ֥שֶׂת עַל־הָאָֽרֶץ׃",
  "words": [
   {
    "he": "וַיְבָרֶךְ",
    "say": "vayvarekh",
    "means": "and he blessed"
   },
   {
    "he": "אֹתָם",
    "say": "'otam",
    "means": "(object marker) them"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "וַיֹּאמֶר",
    "say": "vaiyomer",
    "means": "and he said"
   },
   {
    "he": "לָהֶם",
    "say": "lahem",
    "means": "to the them"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "פְּרוּ",
    "say": "peru",
    "means": "be fruitful"
   },
   {
    "he": "וּרְבוּ",
    "say": "urevu",
    "means": "and multiply"
   },
   {
    "he": "וּמִלְאוּ",
    "say": "umil'u",
    "means": "and fill"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "וְכִבְשֻׁהָ",
    "say": "vekhivshuha",
    "means": "and subdue it"
   },
   {
    "he": "וּרְדוּ",
    "say": "uredu",
    "means": "and rule"
   },
   {
    "he": "בִּדְגַת",
    "say": "bidgat",
    "means": "over [the] fish of"
   },
   {
    "he": "הַיָּם",
    "say": "haiyam",
    "means": "the sea"
   },
   {
    "he": "וּבְעוֹף",
    "say": "uve'of",
    "means": "and over [the] bird[s] of"
   },
   {
    "he": "הַשָּׁמַיִם",
    "say": "hashamayim",
    "means": "the heavens"
   },
   {
    "he": "וּבְכָל־",
    "say": "uvekhol-",
    "means": "and over every"
   },
   {
    "he": "חַיָּה",
    "say": "chaiyah",
    "means": "animal"
   },
   {
    "he": "הָרֹמֶשֶׂת",
    "say": "haromeset",
    "means": "which creeps"
   },
   {
    "he": "עַל־",
    "say": "'al-",
    "means": "on"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   }
  ]
 },
 {
  "v": 29,
  "text": "וַיֹּ֣אמֶר אֱלֹהִ֗ים הִנֵּה֩ נָתַ֨תִּי לָכֶ֜ם אֶת־כָּל־עֵ֣שֶׂב ׀ זֹרֵ֣עַ זֶ֗רַע אֲשֶׁר֙ עַל־פְּנֵ֣י כָל־הָאָ֔רֶץ וְאֶת־כָּל־הָעֵ֛ץ אֲשֶׁר־בּ֥וֹ פְרִי־עֵ֖ץ זֹרֵ֣עַ זָ֑רַע לָכֶ֥ם יִֽהְיֶ֖ה לְאָכְלָֽה׃",
  "words": [
   {
    "he": "וַיֹּאמֶר",
    "say": "vaiyomer",
    "means": "and he said"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "הִנֵּה",
    "say": "hineh",
    "means": "here!"
   },
   {
    "he": "נָתַתִּי",
    "say": "natati",
    "means": "I give"
   },
   {
    "he": "לָכֶם",
    "say": "lakhem",
    "means": "to the you"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "כָּל־",
    "say": "kol-",
    "means": "every"
   },
   {
    "he": "עֵשֶׂב׀",
    "say": "'esev",
    "means": "plant"
   },
   {
    "he": "זֹרֵעַ",
    "say": "zorea'",
    "means": "[which] bears seed"
   },
   {
    "he": "זֶרַע",
    "say": "zera'",
    "means": "seed"
   },
   {
    "he": "אֲשֶׁר",
    "say": "'asher",
    "means": "which"
   },
   {
    "he": "עַל־",
    "say": "'al-",
    "means": "[is] on"
   },
   {
    "he": "פְּנֵי",
    "say": "penei",
    "means": "[the] surface of"
   },
   {
    "he": "כָל־",
    "say": "khol-",
    "means": "all"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "וְאֶת־",
    "say": "ve'et",
    "means": "and (object marker)"
   },
   {
    "he": "כָּל־",
    "say": "kol-",
    "means": "every"
   },
   {
    "he": "הָעֵץ",
    "say": "ha'etz",
    "means": "the tree"
   },
   {
    "he": "אֲשֶׁר־",
    "say": "'asher-",
    "means": "which"
   },
   {
    "he": "בּוֹ",
    "say": "bo",
    "means": "in the it"
   },
   {
    "he": "פְרִי־",
    "say": "feri-",
    "means": "[is the] fruit of"
   },
   {
    "he": "עֵץ",
    "say": "'etz",
    "means": "a tree"
   },
   {
    "he": "זֹרֵעַ",
    "say": "zorea'",
    "means": "[which] bears seed"
   },
   {
    "he": "זָרַע",
    "say": "zara'",
    "means": "seed"
   },
   {
    "he": "לָכֶם",
    "say": "lakhem",
    "means": "to the you"
   },
   {
    "he": "יִהְיֶה",
    "say": "yihyeh",
    "means": "it will be[long]"
   },
   {
    "he": "לְאָכְלָה",
    "say": "le'okhlah",
    "means": "to food"
   }
  ]
 },
 {
  "v": 30,
  "text": "וּֽלְכָל־חַיַּ֣ת הָ֠אָרֶץ וּלְכָל־ע֨וֹף הַשָּׁמַ֜יִם וּלְכֹ֣ל ׀ רוֹמֵ֣שׂ עַל־הָאָ֗רֶץ אֲשֶׁר־בּוֹ֙ נֶ֣פֶשׁ חַיָּ֔ה אֶת־כָּל־יֶ֥רֶק עֵ֖שֶׂב לְאָכְלָ֑ה וַֽיְהִי־כֵֽן׃",
  "words": [
   {
    "he": "וּלְכָל־",
    "say": "ulekhol-",
    "means": "and to every"
   },
   {
    "he": "חַיַּת",
    "say": "chaiyat",
    "means": "the animal of"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "וּלְכָל־",
    "say": "ulekhol-",
    "means": "and to every"
   },
   {
    "he": "עוֹף",
    "say": "of",
    "means": "the bird of"
   },
   {
    "he": "הַשָּׁמַיִם",
    "say": "hashamayim",
    "means": "the heavens"
   },
   {
    "he": "וּלְכֹל׀",
    "say": "ulekhol",
    "means": "and to every"
   },
   {
    "he": "רוֹמֵשׂ",
    "say": "romes",
    "means": "creeping [thing]"
   },
   {
    "he": "עַל־",
    "say": "'al-",
    "means": "on"
   },
   {
    "he": "הָאָרֶץ",
    "say": "ha'aretz",
    "means": "the earth"
   },
   {
    "he": "אֲשֶׁר־",
    "say": "'asher-",
    "means": "which"
   },
   {
    "he": "בּוֹ",
    "say": "bo",
    "means": "[is] in the it"
   },
   {
    "he": "נֶפֶשׁ",
    "say": "nefesh",
    "means": "life"
   },
   {
    "he": "חַיָּה",
    "say": "chaiyah",
    "means": "living"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "כָּל־",
    "say": "kol-",
    "means": "all"
   },
   {
    "he": "יֶרֶק",
    "say": "yerek",
    "means": "greenery of"
   },
   {
    "he": "עֵשֶׂב",
    "say": "'esev",
    "means": "plant[s]"
   },
   {
    "he": "לְאָכְלָה",
    "say": "le'okhlah",
    "means": "to food"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and it was"
   },
   {
    "he": "כֵן",
    "say": "khen",
    "means": "so"
   }
  ]
 },
 {
  "v": 31,
  "text": "וַיַּ֤רְא אֱלֹהִים֙ אֶת־כָּל־אֲשֶׁ֣ר עָשָׂ֔ה וְהִנֵּה־ט֖וֹב מְאֹ֑ד וַֽיְהִי־עֶ֥רֶב וַֽיְהִי־בֹ֖קֶר י֥וֹם הַשִּׁשִּֽׁי׃ פ",
  "words": [
   {
    "he": "וַיַּרְא",
    "say": "vaiyar'",
    "means": "and he saw"
   },
   {
    "he": "אֱלֹהִים",
    "say": "'elohim",
    "means": "God"
   },
   {
    "he": "אֶת־",
    "say": "'et-",
    "means": "(object marker)"
   },
   {
    "he": "כָּל־",
    "say": "kol-",
    "means": "all"
   },
   {
    "he": "אֲשֶׁר",
    "say": "'asher",
    "means": "that"
   },
   {
    "he": "עָשָׂה",
    "say": "'asah",
    "means": "he had made"
   },
   {
    "he": "וְהִנֵּה־",
    "say": "vehineh-",
    "means": "and there!"
   },
   {
    "he": "טוֹב",
    "say": "tov",
    "means": "[it was] good"
   },
   {
    "he": "מְאֹד",
    "say": "me'od",
    "means": "very"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "עֶרֶב",
    "say": "'erev",
    "means": "evening"
   },
   {
    "he": "וַיְהִי־",
    "say": "vayhi-",
    "means": "and there was"
   },
   {
    "he": "בֹקֶר",
    "say": "voker",
    "means": "morning"
   },
   {
    "he": "יוֹם",
    "say": "yom",
    "means": "[the] day"
   },
   {
    "he": "הַשִּׁשִּׁי",
    "say": "hashishi",
    "means": "the sixth"
   }
  ]
 }
];
