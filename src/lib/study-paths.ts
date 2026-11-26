/**
 * Study paths (hidden page /study-paths, Study lab): guided four-week courses that read across traditions. Each day
 * pairs a few chapters that are on the site, with a short neutral note on why they sit together, one reflection
 * question, and each week a question a study group could talk over. Every reading below was checked with findBook
 * (the work, book and chapter exist) and every quoted line against the site's own text (Nov 26). Notes keep to what
 * the texts say: no tradition is ranked above another.
 *
 * Hebrew Bible passages link to the Tanakh (JPS 1917 + Masoretic text), so their verse numbers are the Jewish ones
 * (Psalm 19:2 = KJV 19:1); New Testament and deuterocanonical books link to the Bible.
 */
import { chapterTitle, findBook, readHref } from "./catalog";
import articleIndex from "../../public/articles/index.json";

/** A chapter to read. `v` is the verses to look at (shown, and the first one is the link's anchor). */
export type Reading = { work: string; book: string; chapter: number; v?: string; label?: string; name?: string };
export type Day = { title: string; readings: Reading[]; article?: string; note: string; question: string };
export type Week = { title: string; group: string; days: Day[] };
export type StudyPath = { id: string; title: string; blurb: string; weeks: Week[] };

const T = (book: string, chapter: number, v?: string): Reading => ({ work: "tanakh", book, chapter, v });
const B = (book: string, chapter: number, v?: string): Reading => ({ work: "bible", book, chapter, v });
const Q = (chapter: number, v?: string, name?: string): Reading => ({ work: "quran", book: "quran", chapter, v, name });

export const STUDY_PATHS: StudyPath[] = [
  {
    id: "creation",
    title: "Creation across traditions",
    blurb: "How the world began, told by Genesis and John, the Quran, Babylon, the Vedas and Upanishads, the Tao, the Maya, the Norse and more.",
    weeks: [
      {
        title: "In the beginning",
        group:
          "Genesis tells creation as a sequence of days, John as a Word, the Quran as signs spread through the whole book. What does each way of telling help you notice that the others might not?",
        days: [
          {
            title: "Two openings",
            readings: [T("gen", 1), B("jhn", 1, "1-5")],
            note: "Both books begin with the same words, \"In the beginning.\" Genesis tells six days and a seventh of rest; John's Gospel returns to that beginning and places the Word at its center.",
            question: "Genesis keeps saying \"it was good.\" What in your own day would you call good, if you stopped to look at it?",
          },
          {
            title: "Dust and breath",
            readings: [T("gen", 2)],
            note: "A second telling, closer to the ground: dust, breath, a garden, a name for every animal. Readers have long noticed how different it feels from chapter 1; the book keeps both side by side.",
            question: "The human is formed from dust and given breath. Which feels truer of you today: the dust or the breath?",
          },
          {
            title: "A hymn of everything alive",
            readings: [T("psa", 104)],
            note: "Genesis 1 lists creation in order; this psalm sings it, from springs and birds to lions, ships and the sea, and ends with every creature waiting on the breath that is sent (verses 29-30).",
            question: "The psalm notices small things: a stork in the fir trees, wild goats on the hills. What small living thing did you notice this week?",
          },
          {
            title: "Where were you?",
            readings: [T("job", 38), T("pro", 8, "22-31")],
            note: "Two more biblical pictures of the beginning: God answers Job out of the whirlwind with questions, and Wisdom speaks as one who was there: \"When He established the heavens, I was there.\"",
            question: "Job is answered with questions, not explanations. Is there a question you have learned to live with rather than solve?",
          },
          {
            title: "Signs in the heavens and the earth",
            readings: [Q(21, "30", "Al-Anbiya"), Q(41, "9-12", "Fussilat"), Q(2, "30", "Al-Baqarah")],
            note: "The Quran speaks of creation in many places rather than in one long story: the heavens and the earth \"of one piece, then We parted them,\" every living thing made of water, and the human placed on earth as khalifa (Pickthall: \"viceroy\"), one entrusted with it.",
            question: "The Quran calls the human a khalifa, one entrusted with the earth. What has been entrusted to you?",
          },
        ],
      },
      {
        title: "Before anything was",
        group:
          "The Rig Veda ends its creation hymn with a question; the Babylonian epic ends with Marduk's victory and the praise of his names. What does each ending leave you with? Can one story hold both?",
        days: [
          {
            title: "When the heavens were unnamed",
            readings: [{ work: "enuma-elish", book: "enuma-elish", chapter: 1, label: "Enuma Elish, Tablet 1" }],
            note: "The Babylonian creation epic opens \"When the heavens above were yet unnamed,\" with Apsu and Tiamat, the waters, \"merged into a single mass.\" It is one of the oldest creation stories that survives in writing.",
            question: "Here the world begins before anything has a name. What changes for you when something is given a name?",
          },
          {
            title: "Order out of struggle",
            readings: [
              { work: "enuma-elish", book: "enuma-elish", chapter: 4, label: "Enuma Elish, Tablet 4" },
              { work: "enuma-elish", book: "enuma-elish", chapter: 6, label: "Enuma Elish, Tablet 6" },
            ],
            note: "Marduk defeats Tiamat and makes the heavens from one half of her body; in the sixth tablet he forms humankind so that \"the service of the gods shall be established.\" Readers often set this beside Genesis, where the human is made in God's image and set in a garden.",
            question: "These stories give people different purposes: to serve, to bear an image, to tend a garden. What do you think you are for?",
          },
          {
            title: "Who knows?",
            readings: [{ work: "vedas", book: "rv10", chapter: 129 }],
            note: "The Rig Veda's hymn of creation (the Nasadiya) begins before being and non-being, and ends with an open question: the one who looks on from highest heaven \"verily knows it, or perhaps he knows not.\"",
            question: "The hymn ends in honest not-knowing. Where in your life is \"perhaps no one knows\" an answer you can accept?",
          },
          {
            title: "The golden germ and the great Person",
            readings: [
              { work: "vedas", book: "rv10", chapter: 121 },
              { work: "vedas", book: "rv10", chapter: 90 },
            ],
            note: "Two more Vedic hymns of the beginning: Hiranyagarbha, the golden germ that rose first, with its refrain \"What God shall we adore with our oblation?\", and Purusha, the cosmic Person of a thousand heads from whom the world is made.",
            question: "Purusha is the world as one great body. Do you feel more like a separate piece, or part of one body?",
          },
          {
            title: "One, without a second",
            readings: [
              { work: "upanishads", book: "chandogya", chapter: 99, v: "1-4", label: "Chandogya Upanishad 6.2" },
              { work: "upanishads", book: "brihadaranyaka", chapter: 3, v: "1-3", label: "Brihadaranyaka Upanishad 1.4" },
              { work: "upanishads", book: "taittiriya", chapter: 27, label: "Taittiriya Upanishad 3.6" },
            ],
            note: "The Upanishads ask what was there in the beginning: \"that only which is, one only, without a second,\" which thought, \"may I be many.\" The Taittiriya adds that beings are born from bliss and return to it.",
            question: "\"May I be many.\" If the world began as one wishing to become many, how might that change the way you see a stranger?",
          },
        ],
      },
      {
        title: "Many tellings",
        group:
          "This week's stories come from peoples with very different histories: China, Japan, the Maya, Scandinavia, Finland, Persia. What do they seem to share, and what is unmistakably their own?",
        days: [
          {
            title: "The nameless origin",
            readings: [
              { work: "tao-te-ching", book: "ttc", chapter: 1 },
              { work: "tao-te-ching", book: "ttc", chapter: 42 },
            ],
            note: "The Tao Te Ching speaks of origins without a maker who acts: the nameless is \"the Originator of heaven and earth,\" and \"The Tao produced One; One produced Two; Two produced Three; Three produced All things.\"",
            question: "The nameless comes first. Is there something in your life you understand better by not naming it?",
          },
          {
            title: "The Plain of High Heaven",
            readings: [{ work: "kojiki", book: "kojiki", chapter: 1 }],
            note: "Japan's oldest surviving chronicle, the Kojiki (712), begins with the deities born \"in the Plain of High Heaven when the Heaven and Earth began.\"",
            question: "The Kojiki begins with a list of names. Whose names would you put at the start of your own story?",
          },
          {
            title: "Made by speaking",
            readings: [
              { work: "popol-vuh-full", book: "popol-vuh-full", chapter: 2, label: "Popol Vuh: The Creation of the World" },
              { work: "popol-vuh-full", book: "popol-vuh-full", chapter: 3, label: "Popol Vuh: The Animals, the Man of Mud and the Men of Wood" },
            ],
            note: "The Popol Vuh, the K'iche' Maya book of origins: in silence and stillness the makers speak, and the earth comes into being by their word. Then come several attempts to make people, of mud and of wood. (The site's English is an AI-made translation from Ximénez's Spanish.)",
            question: "The makers in the Popol Vuh try more than once to make people. What have you had to try more than once?",
          },
          {
            title: "Ice, fire and an egg",
            readings: [
              { work: "prose-edda", book: "gylfaginning", chapter: 4, label: "Prose Edda: Gylfaginning 4" },
              { work: "kalevala", book: "kalevala", chapter: 1, label: "Kalevala, Runo 1" },
            ],
            note: "Two northern beginnings: the Prose Edda tells of the yawning gap, Ginungagap, before the world, with cold Niflheim on one side; the Finnish Kalevala tells of the daughter of the air and the eggs from which earth, heaven, sun and moon are made.",
            question: "These stories build the world from things meeting: cold and heat, sea and air. What opposites meet in you?",
          },
          {
            title: "This I ask Thee",
            readings: [
              { work: "gathas", book: "gathas", chapter: 9, v: "3-5", label: "Gathas: Yasna 44" },
              { work: "hidden-words", book: "hw", chapter: 1, v: "3-4", label: "The Hidden Words, Part 1 (from the Arabic)" },
            ],
            note: "Zarathustra asks God a chain of questions: who gave the sun and stars their way, who holds up the earth, who made light and darkness? And from the Baha'i Hidden Words: \"I loved thy creation, hence I created thee.\"",
            question: "Zarathustra meets creation with questions full of wonder. Write down one question you would ask about the world if you could.",
          },
        ],
      },
      {
        title: "Questions about beginnings",
        group:
          "Some readers take these accounts as history, some as poetry, some as both, some as neither. How do you read them, and how can a group read well together when its members read differently?",
        days: [
          {
            title: "What was God doing before?",
            readings: [{ work: "confessions", book: "confessions", chapter: 11, label: "Augustine, Confessions, Book 11" }],
            note: "Augustine takes up the old question \"What did God before He made heaven and earth?\", sets aside the joking answer, and argues that time itself was made with the world, so there was no \"before.\"",
            question: "Augustine says time began with the world. How do you live time most days: as a river, a gift, or a weight?",
          },
          {
            title: "The poisoned arrow",
            readings: [
              { work: "tipitaka", book: "mn", chapter: 63, name: "The Shorter Discourse With Māluṅkyaputta" },
              { work: "tipitaka", book: "sn15", chapter: 1, name: "Grass and Sticks" },
            ],
            note: "The Buddha leaves questions such as whether the world is eternal undeclared, likening them to a man struck by a poisoned arrow who will not be treated until he knows who shot it. Elsewhere: \"this transmigration has no known beginning.\"",
            question: "Which questions do you most want answered, and which matter most for how you live today? Are they the same ones?",
          },
          {
            title: "What came first",
            readings: [{ work: "tipitaka", book: "dn", chapter: 27, name: "What Came First" }],
            article: "truth-part-3",
            note: "In \"What Came First\" (the Aggañña Sutta) the Buddha tells of a cosmos that contracts and expands over vast ages, and how human society took shape. Part 3 of our article On Truth looks at how Buddhist thought answers the question of a creator.",
            question: "The sutta speaks of long cycles. Do you see more cycles or more straight lines in your own life?",
          },
          {
            title: "Two Roman voices",
            readings: [
              { work: "lucretius", book: "dnr", chapter: 5, label: "Lucretius, On the Nature of Things, Book 5" },
              { work: "metamorphoses", book: "metamorphoses", chapter: 1, label: "Ovid, Metamorphoses, Book 1" },
            ],
            note: "Lucretius, following Epicurus, explains the forming of the world by atoms and nature rather than by divine design. Ovid's Metamorphoses opens with Chaos divided into the elements and the human made from earth and water.",
            question: "Lucretius found calm in explaining the world without gods; others find it in a Creator. What steadies you when you think about where everything came from?",
          },
          {
            title: "With one word",
            readings: [
              T("psa", 8),
              B("col", 1, "15-20"),
              { work: "ggs", book: "opening-banis-japji-so-dar-sohila", chapter: 3, v: "56", label: "Japji Sahib (Guru Granth Sahib, Ang 3)" },
            ],
            note: "To close: a psalm's wonder at the heavens and at how small we are beside them, a hymn on Christ in whom \"all things were created,\" and the Sikh Japji: \"You created the vast expanse of the Universe with One Word!\"",
            question: "After four weeks, which telling of the beginning stays with you most, and why?",
          },
        ],
      },
    ],
  },
  {
    id: "word",
    title: "The Word",
    blurb: "Creation by speech, sacred sound, revelation, and the words we use every day: the Bible and Tanakh, the Quran, the Gita and Upanishads, the Guru Granth Sahib, the Buddha and Confucius.",
    weeks: [
      {
        title: "Spoken into being",
        group: "Many traditions picture creation as speech. Why do you think speaking, rather than building or giving birth, became such a strong image?",
        days: [
          {
            title: "And God said",
            readings: [T("gen", 1, "1-5"), T("psa", 33, "6-9")],
            note: "In Genesis each day begins with speech: \"And God said.\" The psalm gathers it into one line: \"By the word of the LORD were the heavens made.\"",
            question: "Words begin things. What has a single sentence started in your life?",
          },
          {
            title: "The Word was made flesh",
            readings: [B("jhn", 1, "1-18"), B("heb", 11, "3")],
            note: "John's Gospel speaks of the Word (Greek logos) present in the beginning, then says \"the Word was made flesh, and dwelt among us.\" Hebrews: \"the worlds were framed by the word of God.\"",
            question: "John speaks of the Word dwelling among people. When have words become something you could almost touch?",
          },
          {
            title: "Be! and it is",
            readings: [Q(2, "117", "Al-Baqarah"), Q(3, "59", "Al Imran")],
            note: "In the Quran God's creating command is a single word: \"Be!\" (kun) \"and it is.\" The same words are used of the creation of Adam in Surah 3.",
            question: "\"Be!\" and it is. Is there something you keep waiting to begin that one word from you could start?",
          },
          {
            title: "Ten utterances",
            readings: [
              { work: "mishnah", book: "pirkei-avot", chapter: 5, v: "1", label: "Pirkei Avot 5 (Mishnah)" },
              B("wis", 9, "1"),
            ],
            note: "The sages of the Mishnah teach, \"With ten utterances the world was created,\" and ask why ten, when one would have done. The Wisdom of Solomon (in Catholic and Orthodox Bibles) prays to the one \"who hast made all things with thy word.\"",
            question: "The Mishnah asks why ten sayings and not one. Why do you think good things often take many words rather than one?",
          },
          {
            title: "With one word",
            readings: [
              { work: "ggs", book: "opening-banis-japji-so-dar-sohila", chapter: 3, v: "56", label: "Japji Sahib (Ang 3)" },
              { work: "ggs", book: "opening-banis-japji-so-dar-sohila", chapter: 4, v: "24-30", label: "Japji Sahib (Ang 4)" },
              { work: "popol-vuh-full", book: "popol-vuh-full", chapter: 2, label: "Popol Vuh: The Creation of the World" },
            ],
            note: "The Japji praises the One who \"created the vast expanse of the Universe with One Word!\" and goes on, \"From the Word, comes the Naam.\" In the Maya Popol Vuh, the makers speak and the earth is made by their word.",
            question: "If the world is spoken, what in your surroundings feels most like a word being said?",
          },
        ],
      },
      {
        title: "Sacred sound",
        group: "Sacred words are repeated in many traditions: Om, a psalm, a divine name, a short prayer. What does repetition do to a word, and to the one who repeats it?",
        days: [
          {
            title: "It is Om",
            readings: [
              { work: "upanishads", book: "chandogya", chapter: 1, label: "Chandogya Upanishad 1.1" },
              { work: "upanishads", book: "katha", chapter: 2, v: "15-17", label: "Katha Upanishad 1.2" },
            ],
            note: "The Chandogya opens with meditation on the syllable Om. In the Katha, Yama, lord of death, tells the boy Nachiketas: \"That word which all the Vedas record... that word I tell thee briefly, it is Om.\"",
            question: "Is there a word or sound that quiets you? What is it, and why does it work?",
          },
          {
            title: "Of speech I am the one syllable",
            readings: [
              { work: "gita", book: "gita", chapter: 10, v: "25" },
              { work: "gita", book: "gita", chapter: 8, v: "13" },
              { work: "gita", book: "gita", chapter: 17, v: "23-24" },
            ],
            note: "Krishna says, \"of speech I am the one syllable; of sacrifices I am the sacrifice of silent repetitions.\" Elsewhere the Gita ties Om to remembrance at the hour of death and to the start of every act of sacrifice, gift and austerity.",
            question: "Silent repetition is named among the highest offerings. What do you repeat to yourself most days, aloud or not?",
          },
          {
            title: "The bow and the arrow",
            readings: [
              { work: "upanishads", book: "mundaka", chapter: 4, v: "3-4", label: "Mundaka Upanishad 2.2" },
              { work: "gita", book: "gita", chapter: 7, v: "8" },
            ],
            note: "\"Om is the bow, the Self is the arrow, Brahman is called its aim.\" In the Gita, Krishna is \"the Word of Power in all the Vedas.\"",
            question: "The Mundaka pictures attention as an arrow. What is your attention aimed at right now?",
          },
          {
            title: "Words in the body",
            readings: [T("jer", 1, "9"), T("ezk", 3, "1-3"), T("psa", 19, "2-5")],
            note: "The Hebrew prophets receive words bodily: Jeremiah's mouth is touched, Ezekiel eats a scroll that is \"as honey for sweetness.\" Psalm 19 hears the heavens speak: \"There is no speech, there are no words.\"",
            question: "Ezekiel eats the scroll. What words have you taken in so deeply that they became part of you?",
          },
          {
            title: "A still small voice",
            readings: [
              { work: "tao-te-ching", book: "ttc", chapter: 1 },
              { work: "tao-te-ching", book: "ttc", chapter: 56 },
              T("1ki", 19, "11-12"),
            ],
            note: "Some passages honor the limits of words: \"The name that can be named is not the enduring and unchanging name\"; \"He who knows (the Tao) does not (care to) speak (about it).\" Elijah meets God not in wind, earthquake or fire but in \"a still small voice.\"",
            question: "When did silence say more to you than any words could?",
          },
        ],
      },
      {
        title: "Revelation",
        group: "Traditions describe revelation in different ways: words given to a prophet, inspiration, a vision, a voice, a teacher's memory. How does your view of how a text came about shape the way you read it?",
        days: [
          {
            title: "Read!",
            readings: [Q(96, "1-5", "Al-Alaq"), Q(97, undefined, "Al-Qadr")],
            note: "Muslim tradition holds that the first verses revealed to the Prophet Muhammad were the opening of Surah 96: \"Read: In the name of thy Lord who createth.\" Surah 97 speaks of the Night of Power, \"better than a thousand months.\"",
            question: "The first word is \"Read!\" What are you reading in this season of life, and what is it doing to you?",
          },
          {
            title: "If the trees were pens",
            readings: [Q(42, "51", "Ash-Shura"), Q(31, "27", "Luqman"), Q(55, "1-4", "Ar-Rahman")],
            note: "The Quran describes how God speaks to people, \"by revelation or from behind a veil,\" or through a messenger, and says that if all the trees were pens and the sea ink, \"the words of Allah could not be exhausted.\" Surah 55 opens: the Beneficent \"hath made known the Qur'an... He hath taught him utterance.\"",
            question: "If the words of God cannot run out, what would it mean for you to keep listening?",
          },
          {
            title: "Not by bread only",
            readings: [T("deu", 8, "3"), B("mat", 4, "1-4"), T("psa", 119, "105")],
            note: "\"Man doth not live by bread only\" (Deuteronomy) is the answer Jesus gives in the wilderness. Psalm 119, the longest psalm, is a long meditation on God's word: \"Thy word is a lamp unto my feet.\"",
            question: "What feeds you that is not bread?",
          },
          {
            title: "Rain, a sword, a fire",
            readings: [T("isa", 55, "10-11"), B("heb", 4, "12"), T("jer", 23, "29")],
            note: "Isaiah likens God's word to rain that does not return empty; Hebrews calls it \"sharper than any twoedged sword\"; Jeremiah: \"Is not My word like as fire?\"",
            question: "Rain, a sword, fire: which image fits the way words of faith or wisdom have worked in you?",
          },
          {
            title: "Thought, word and deed",
            readings: [
              { work: "gathas", book: "gathas", chapter: 1, label: "Gathas: Yasna 28" },
              { work: "ggs", book: "opening-banis-japji-so-dar-sohila", chapter: 2, v: "21", label: "Japji Sahib (Ang 2)" },
            ],
            note: "Yasna 28 begins with a blessing on \"the thought... the word... the deed,\" the triad Zoroastrians still keep as good thoughts, good words, good deeds. Sikhs honor the Guru Granth Sahib, the written Word, as their living Guru; the Japji says \"the Guru's Word is the Sound-current of the Naad.\"",
            question: "Thought, word, deed: where do yours most often come apart, and where do they line up?",
          },
        ],
      },
      {
        title: "Our words",
        group: "If words can create, what responsibility comes with the ordinary words we use every day, in person and online? What would your group want to practice?",
        days: [
          {
            title: "True, beneficial, timely",
            readings: [
              { work: "tipitaka", book: "mn", chapter: 58, name: "With Prince Abhaya" },
              { work: "dhammapada", book: "dhp", chapter: 8, v: "100", label: "Dhammapada 8: Thousands" },
            ],
            note: "The Buddha says he speaks only what is \"true, correct, and beneficial,\" and knows the right time to say it, even when it is unwelcome. The Dhammapada: \"Better than a thousand meaningless sayings is a single meaningful saying.\"",
            question: "Think of something true you need to say. Is it beneficial? Is now the right time?",
          },
          {
            title: "Death and life in the tongue",
            readings: [B("jas", 3), T("pro", 18, "21"), { work: "gita", book: "gita", chapter: 17, v: "15" }],
            note: "James: \"the tongue is a little member, and boasteth great things.\" Proverbs: \"Death and life are in the power of the tongue.\" The Gita counts kind and truthful speech as \"the austerity of speech.\"",
            question: "Which of your words this week gave life, and which did not?",
          },
          {
            title: "One word for a whole life",
            readings: [
              { work: "analects", book: "analects", chapter: 15, v: "23" },
              { work: "analects", book: "analects", chapter: 13, v: "3" },
            ],
            note: "Asked for \"one word which may serve as a rule of practice for all one's life,\" Confucius answers \"reciprocity.\" Asked what he would do first in government, he says: \"rectify names,\" so that words match what is real.",
            question: "Where do your words and the reality they describe not quite match?",
          },
          {
            title: "What is truth?",
            readings: [B("jhn", 18, "33-38")],
            article: "truth-part-1",
            note: "Pilate asks \"What is truth?\" and goes out without waiting for an answer. Our article On Truth, Part 1 gathers how scriptures and philosophers have answered him.",
            question: "Where in your speech is it hardest for you to be fully truthful?",
          },
          {
            title: "The words of my mouth",
            readings: [T("psa", 19, "15"), T("isa", 40, "8"), { work: "ggs", book: "opening-banis-japji-so-dar-sohila", chapter: 4, v: "24-30", label: "Japji Sahib (Ang 4)" }],
            note: "A prayer many still say: \"Let the words of my mouth and the meditation of my heart be acceptable before Thee.\" Isaiah: \"the word of our God shall stand for ever.\" And the Japji: \"From the Word, comes spiritual wisdom.\"",
            question: "After four weeks, what one word or line will you carry with you?",
          },
        ],
      },
    ],
  },
  {
    id: "mercy",
    title: "Mercy",
    blurb: "Mercy received and mercy given: Exodus and the Psalms, the prophets, the Gospels, the Quran, the Dhammapada and the Discourse on Love, Confucius, the Jains and the Sikh Gurus.",
    weeks: [
      {
        title: "Merciful and gracious",
        group: "The same short description of God, \"gracious and merciful, slow to anger,\" is repeated across many books. Why might a tradition keep coming back to one phrase like this?",
        days: [
          {
            title: "The LORD passed by",
            readings: [T("exo", 34, "6-7")],
            note: "God's self-description to Moses, \"merciful and gracious, long-suffering, and abundant in goodness and truth,\" is known in Jewish tradition as the Thirteen Attributes of Mercy and is echoed again and again in the Hebrew Bible.",
            question: "Merciful, gracious, slow to anger: which of these would you most like to grow into?",
          },
          {
            title: "As a father has compassion",
            readings: [T("psa", 103, "8-13"), T("psa", 145, "8-9")],
            note: "Both psalms take up the words of Exodus 34. Psalm 103: \"Like as a father hath compassion upon his children.\" Psalm 145: \"His tender mercies are over all His works.\"",
            question: "\"As far as the east is from the west.\" Is there something you need to let be carried that far from you?",
          },
          {
            title: "The Beneficent, the Merciful",
            readings: [Q(1, undefined, "Al-Fatiha"), Q(39, "53", "Az-Zumar")],
            note: "Every surah but one opens \"In the name of Allah, the Beneficent, the Merciful\"; both names come from the Arabic root r-h-m, which also gives the word for womb. Surah 39: \"Despair not of the mercy of Allah, Who forgiveth all sins.\"",
            question: "Have you ever come close to despair? What reached you there?",
          },
          {
            title: "Mercy that embraces all things",
            readings: [Q(7, "156", "Al-A'raf"), Q(6, "12", "Al-An'am"), Q(21, "107", "Al-Anbiya")],
            note: "\"My mercy embraceth all things.\" Twice in Surah 6 God has \"prescribed for Himself mercy\" (verses 12 and 54), and the Prophet is sent \"as a mercy for the peoples.\"",
            question: "If mercy embraces all things, who is hardest for you to include?",
          },
          {
            title: "Rend your heart",
            readings: [T("jol", 2, "12-13"), T("jon", 4)],
            note: "Joel calls, \"rend your heart, and not your garments,\" with the words of Exodus 34. Jonah uses the same words in complaint, angry that Nineveh is spared, and his book ends with God's question.",
            question: "Jonah is upset when mercy reaches people he dislikes. Whose being shown mercy would be hard for you to welcome?",
          },
        ],
      },
      {
        title: "What mercy asks of us",
        group: "Several of this week's texts set mercy above sacrifice or ritual. Do mercy and religious practice ever pull against each other? How might they belong together?",
        days: [
          {
            title: "Love mercy",
            readings: [T("mic", 6, "8"), T("hos", 6, "6"), B("mat", 9, "10-13")],
            note: "\"To do justly, and to love mercy, and to walk humbly with thy God.\" Hosea: \"I desire mercy, and not sacrifice,\" words Jesus quotes when he is criticized for eating with sinners.",
            question: "Doing justice, loving mercy, walking humbly: which comes easiest to you, and which is hardest?",
          },
          {
            title: "Blessed are the merciful",
            readings: [B("mat", 5), B("luk", 6, "27-36")],
            note: "\"Blessed are the merciful: for they shall obtain mercy.\" In Luke's version of the sermon: \"Be ye therefore merciful, as your Father also is merciful.\"",
            question: "Both passages ask for love of enemies. What would one small step toward that look like this week?",
          },
          {
            title: "The steep path",
            readings: [Q(90, "11-17", "Al-Balad"), Q(93, undefined, "Ad-Duha"), Q(107, undefined, "Al-Ma'un")],
            note: "Three short surahs ask for mercy in deeds: to free a slave, to feed the orphan and the poor, not to drive the beggar away, not to \"refuse small kindnesses.\" Surah 93 reminds the Prophet that he too was once an orphan, and was sheltered.",
            question: "Which small kindness have you been putting off?",
          },
          {
            title: "Treating others like oneself",
            readings: [
              { work: "analects", book: "analects", chapter: 15, v: "23" },
              { work: "jaina", book: "akaranga", chapter: 4, v: "1", label: "Akaranga Sutra, Book I, Lecture 4" },
              { work: "dhammapada", book: "dhp", chapter: 10, v: "129-130", label: "Dhammapada 10: The Rod" },
            ],
            note: "Three ways of putting yourself in another's place: Confucius's \"What you do not want done to yourself, do not do to others\"; the Jain teaching that no living being \"should be slain, nor treated with violence\"; and the Dhammapada's \"All tremble at the rod... Treating others like oneself.\"",
            question: "Pick one person you will meet tomorrow. What might they fear, and what might they love?",
          },
          {
            title: "Deeds of lovingkindness",
            readings: [
              { work: "mishnah", book: "pirkei-avot", chapter: 1, v: "2", label: "Pirkei Avot 1 (Mishnah)" },
              B("jas", 2, "13"),
              Q(2, "263", "Al-Baqarah"),
            ],
            note: "Shimon the Righteous taught that the world stands on three things, the last of them \"the practice of acts of piety\" (gemilut chasadim, often rendered deeds of lovingkindness). James: \"mercy rejoiceth against judgment.\" The Quran: \"A kind word with forgiveness is better than almsgiving followed by injury.\"",
            question: "Have you ever given something with a sting attached? How could you give it differently?",
          },
        ],
      },
      {
        title: "Coming home",
        group: "Forgiveness is sometimes mistaken for pretending harm did not happen. How do these texts hold mercy and honesty about wrongdoing together?",
        days: [
          {
            title: "Lost and found",
            readings: [B("luk", 15)],
            note: "Three parables of things lost and found: a sheep, a coin, a son. The father runs to meet the younger son; the elder son stands outside and is invited in. The story ends before we hear his answer.",
            question: "In the story of the two sons, where do you find yourself today: the younger, the elder, or the father?",
          },
          {
            title: "How shall I give thee up?",
            readings: [T("hos", 11, "1-9"), T("isa", 49, "14-16")],
            note: "Mercy pictured as a parent's love that cannot let go: \"How shall I give thee up, Ephraim?\" and \"Can a woman forget her sucking child?\"",
            question: "Who has refused to give up on you?",
          },
          {
            title: "Seventy times seven",
            readings: [B("mat", 18, "21-35"), B("jhn", 8, "1-11")],
            note: "Peter asks how often to forgive; the answer is \"seventy times seven,\" followed by the parable of a servant forgiven a vast debt who will not forgive a small one. In John 8 (a passage missing from some early manuscripts): \"Neither do I condemn thee: go, and sin no more.\"",
            question: "Is there a debt, large or small, that you are still holding against someone?",
          },
          {
            title: "New every morning",
            readings: [T("lam", 3, "22-23"), T("psa", 136)],
            note: "Written among ruins, Lamentations still says \"His compassions fail not. They are new every morning.\" Psalm 136 answers every line with \"for His mercy endureth for ever.\"",
            question: "What is new this morning that you could give thanks for?",
          },
          {
            title: "Thou lover of souls",
            readings: [B("wis", 11, "24-26"), { work: "gita", book: "gita", chapter: 12, v: "13-14" }],
            note: "The Wisdom of Solomon (in Catholic and Orthodox Bibles): \"thou lovest all the things that are... thou sparest all: for they are thine, O Lord, thou lover of souls.\" The Gita describes the one dear to Krishna as \"friendly and compassionate... and forgiving.\"",
            question: "Wisdom says nothing that was made is hated. Is there something in yourself you find hard to love?",
          },
        ],
      },
      {
        title: "A boundless heart",
        group: "After a month on mercy, what is one practice your group could take on together, and how would you help each other keep it?",
        days: [
          {
            title: "May all beings be happy",
            readings: [{ work: "tipitaka", book: "kp", chapter: 9, label: "The Discourse on Love (Metta Sutta), Kp 9" }],
            note: "The Metta Sutta, recited in many Buddhist communities: \"May all beings be happy!\" and \"Even as a mother would protect with her life her child, her only child, so too for all creatures unfold a boundless heart.\" Bhikkhu Sujato translates metta as love.",
            question: "Try the wish slowly: for yourself, someone you love, a stranger, someone difficult. Which was hardest, and why?",
          },
          {
            title: "Hatred is laid to rest by love",
            readings: [
              { work: "dhammapada", book: "dhp", chapter: 1, v: "5", label: "Dhammapada 1: Pairs" },
              { work: "dhammapada", book: "dhp", chapter: 17, v: "223", label: "Dhammapada 17: Anger" },
            ],
            note: "\"For never is hatred laid to rest by hate, it's laid to rest by love: this is an ancient teaching.\" And: \"Defeat anger with kindness.\"",
            question: "Where has anger been answered with more anger in your life? What would breaking that chain look like?",
          },
          {
            title: "The simile of the saw",
            readings: [
              { work: "tipitaka", book: "mn", chapter: 21, name: "The Simile of the Saw" },
              { work: "tipitaka", book: "an8", chapter: 1, name: "The Benefits of Love" },
            ],
            note: "The Buddha asks his followers to keep a heart of love even toward those who harm them, with the hardest example he could find: bandits with a saw. AN 8.1 lists the benefits of love that is \"cultivated, developed, and practiced.\"",
            question: "Love that is cultivated sounds like a garden. What practice could water it this week?",
          },
          {
            title: "The son of compassion",
            readings: [
              { work: "ggs", book: "opening-banis-japji-so-dar-sohila", chapter: 3, v: "44", label: "Japji Sahib (Guru Granth Sahib, Ang 3)" },
              { work: "tao-te-ching", book: "ttc", chapter: 67 },
            ],
            note: "In the Japji, the bull said to hold up the earth is \"Dharma, the son of compassion.\" The Tao Te Ching names three treasures; Legge translates the first as \"gentleness,\" a word (ci) others render as compassion.",
            question: "What would change if you treated compassion as something that holds the world up?",
          },
          {
            title: "Go, and do thou likewise",
            readings: [
              B("luk", 10, "25-37"),
              { work: "hidden-words", book: "hw", chapter: 1, v: "1", label: "The Hidden Words, Part 1 (from the Arabic)" },
            ],
            note: "Asked \"who is my neighbour?\", Jesus tells of a Samaritan, an outsider to his listeners, who \"shewed mercy.\" From the Baha'i Hidden Words: \"Possess a pure, kindly and radiant heart.\"",
            question: "Who is the Samaritan in your world: someone outside your circle whose mercy might surprise you?",
          },
        ],
      },
    ],
  },
];

/* ---------------- resolved for the page (server side) ---------------- */

export type ResolvedReading = { label: string; tradition: string; href: string };
export type ResolvedDay = Omit<Day, "readings" | "article"> & { readings: ResolvedReading[]; article?: { title: string; href: string } };
export type ResolvedPath = Omit<StudyPath, "weeks"> & { weeks: (Omit<Week, "days"> & { days: ResolvedDay[] })[] };

const COLON = new Set(["bible", "tanakh", "quran"]);

function resolveReading(r: Reading): ResolvedReading | null {
  const b = findBook(r.work, r.book);
  if (!b || !b.chapters || r.chapter < 1 || r.chapter > b.chapters) return null; // (never shown if it went missing)
  const base = r.label ?? chapterTitle(b, r.chapter);
  let label = !r.v ? base : !r.label && COLON.has(r.work) ? `${base}:${r.v}` : `${base}, verse${/[-,]/.test(r.v) ? "s" : ""} ${r.v}`;
  if (r.name) label += ` (${r.name})`;
  const anchor = r.v ? r.v.split(/[-,]/)[0] : undefined;
  return { label, tradition: b.religion.name, href: readHref({ work: r.work, book: r.book, chapter: r.chapter }, undefined, anchor) };
}

type ArticleMeta = { slug: string; title: string; status: string };
const PUBLISHED = new Map((articleIndex as ArticleMeta[]).filter((a) => a.status === "published").map((a) => [a.slug, a.title]));

export function resolvedPaths(): ResolvedPath[] {
  return STUDY_PATHS.map((p) => ({
    ...p,
    weeks: p.weeks.map((w) => ({
      ...w,
      days: w.days.map(({ readings, article, ...d }) => {
        const title = article ? PUBLISHED.get(article) : undefined;
        return {
          ...d,
          readings: readings.map(resolveReading).filter((x): x is ResolvedReading => !!x),
          ...(article && title ? { article: { title, href: `/articles/${article}` } } : {}),
        };
      }),
    })),
  }));
}
