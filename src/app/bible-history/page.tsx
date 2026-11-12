import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { ORIGINS, SITE_SIDE } from "@/lib/site";

export const metadata: Metadata = {
  title: "How the Bible came to be",
  description:
    "A plain overview: how the Hebrew Bible and the New Testament were written and collected, which books were accepted, debated or left out, the creeds and councils, who was called heretical, and the splits from 451 and 1054 to the Reformation.",
  alternates: { canonical: "/bible-history" },
};

const a = "underline underline-offset-2 hover:text-ink";

/** A timeline row: when, what. Dates before the common era are marked BCE; "c." = about. */
const TIMELINE: [string, string][] = [
  ["c. 1000–400 BCE", "Much of the Hebrew Bible is written, edited and gathered: the Torah, the Prophets, the Writings."],
  ["c. 250–100 BCE", "The Septuagint: the Hebrew scriptures translated into Greek in Alexandria, with some extra books."],
  ["c. 250 BCE–68 CE", "The Dead Sea Scrolls are copied (found from 1947 on)."],
  ["c. 50–60 CE", "Paul writes his letters, the oldest writings in the New Testament."],
  ["c. 65–100", "The four Gospels are written (Mark first, in the view of most scholars)."],
  ["c. 140–144", "Marcion offers his own short canon; the church in Rome breaks with him."],
  ["c. 180", "Irenaeus writes Against Heresies and defends exactly four Gospels."],
  ["313", "Constantine and Licinius allow Christianity across the Roman Empire (the Edict of Milan)."],
  ["325", "The Council of Nicaea: the Nicene Creed; Arius's teaching condemned."],
  ["367", "Athanasius lists the 27 books of today's New Testament."],
  ["380", "Theodosius makes Nicene Christianity the religion of the Empire."],
  ["381", "The Council of Constantinople expands the Nicene Creed."],
  ["382–405", "Jerome's Latin translation, later called the Vulgate."],
  ["393, 397", "Councils at Hippo and Carthage approve a list of books, the deuterocanon included."],
  ["431", "The Council of Ephesus condemns Nestorius; the Church of the East in Persia, self-governing since 424, does not accept it."],
  ["451", "The Council of Chalcedon; the Oriental Orthodox churches do not accept it."],
  ["c. 930, 1008", "The Aleppo and Leningrad Codices, the great Masoretic copies of the Hebrew Bible."],
  ["1054", "Rome's legates and the Patriarch of Constantinople excommunicate each other: the East–West schism."],
  ["1204", "Crusaders sack Constantinople, deepening the split."],
  ["1415", "Jan Hus is burned at the Council of Constance."],
  ["c. 1455", "The Gutenberg Bible, the first major book printed in Europe with movable type."],
  ["1517", "Martin Luther's Ninety-five Theses."],
  ["1525", "The first adult baptisms in Zurich: the Anabaptists."],
  ["1534", "Luther's complete German Bible; England's Act of Supremacy."],
  ["1546", "The Council of Trent confirms the Catholic canon, the deuterocanon included."],
  ["1611", "The King James Version, with the Apocrypha between the Testaments."],
  ["1646", "The Westminster Confession lists 66 books."],
  ["1945, 1947", "The Nag Hammadi library and the first Dead Sea Scrolls are found."],
  ["1965", "Rome and Constantinople lift the excommunications of 1054."],
];

type Section = { id: string; title: string; body: React.ReactNode };

const SECTIONS: Section[] = [
  {
    id: "hebrew",
    title: "1. The Hebrew Bible: scrolls before a book",
    body: (
      <>
        <p>
          For most of its history the Bible was not one book but a collection of scrolls. The Hebrew scriptures grew over many
          centuries and came to be read in three parts: the <strong className="text-ink">Torah</strong> (the five books of Moses),
          the <strong className="text-ink">Prophets</strong> and the <strong className="text-ink">Writings</strong>, together called
          the Tanakh. The Torah was treated as authoritative by about the 5th–4th century BCE; the Prophets were a settled
          collection by about 200 BCE; the edges of the Writings stayed open longer.
        </p>
        <p>
          The Dead Sea Scrolls (copied between about 250 BCE and 68 CE) include parts of every book of the Hebrew Bible except
          Esther, alongside many writings that did not become scripture. The old idea that a single &ldquo;Council of
          Jamnia&rdquo; closed the Jewish canon around 90 CE is now doubted by most scholars; the list settled gradually. From the
          7th to the 10th century the Masoretes standardised the Hebrew text with vowels and notes; the Aleppo Codex (about 930,
          now incomplete) and the Leningrad Codex (1008) are the best-known results; most Old Testament translations today start
          from the Leningrad Codex.
        </p>
      </>
    ),
  },
  {
    id: "septuagint",
    title: "2. The Septuagint and the extra books",
    body: (
      <>
        <p>
          From the 3rd century BCE Jews in Alexandria translated their scriptures into Greek. A legend (the Letter of Aristeas)
          tells of 72 translators, which gave the translation its name, the <strong className="text-ink">Septuagint</strong>{" "}
          (&ldquo;seventy&rdquo;). It included books that are not in the Hebrew Bible, such as{" "}
          <Link href="/read/bible/tob/1" className={a}>
            Tobit
          </Link>
          , Judith,{" "}
          <Link href="/read/bible/wis/1" className={a}>
            Wisdom
          </Link>
          ,{" "}
          <Link href="/read/bible/sir/1" className={a}>
            Sirach
          </Link>
          , Baruch, 1–2 Maccabees and longer versions of Esther and Daniel.
        </p>
        <p>
          Most early Christians read Greek and used the Septuagint. That is the root of a lasting difference: Catholic and
          Orthodox Bibles keep these books (the <strong className="text-ink">deuterocanon</strong>, &ldquo;second canon&rdquo;),
          while Jewish and most Protestant Bibles follow the shorter Hebrew list; Protestants call these books the{" "}
          <strong className="text-ink">Apocrypha</strong>. On this site they are in Christianity › Apocrypha &amp; Deuterocanon.
        </p>
      </>
    ),
  },
  {
    id: "new-testament",
    title: "3. Writing the New Testament",
    body: (
      <>
        <p>
          The oldest Christian writings are Paul&rsquo;s letters, from about 50–60 CE (1 Thessalonians is usually counted the
          earliest). The four Gospels followed between about 65 and 100; most scholars think Mark came first and Matthew and Luke
          used it. Other letters, Acts and Revelation date from the later 1st and early 2nd centuries.
        </p>
        <p>
          These texts were copied by hand and passed between churches. Collections of Paul&rsquo;s letters existed by the early 2nd
          century, and by about 180 Irenaeus of Lyon insisted there were exactly four Gospels. No original manuscript survives;
          the thousands of copies don&rsquo;t all agree, which is why some Bibles have verses that others leave out (see{" "}
          <Link href="/differences" className={a}>
            Why Bibles differ
          </Link>
          ).
        </p>
      </>
    ),
  },
  {
    id: "canon",
    title: "4. Which books were in, which were debated, which were left out",
    body: (
      <>
        <p>
          There was no single moment when the New Testament was &ldquo;decided&rdquo;. Churches used what they had, and lists
          slowly converged. Three questions mattered most: did a book come from an apostle or someone close to one; was it read
          widely in the churches; and did it agree with the faith as the churches already taught it (the &ldquo;rule of
          faith&rdquo;)?
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Marcion</strong> (about 140) accepted only an edited Luke and ten letters of Paul and
            rejected the Jewish scriptures altogether. The church in Rome broke with him about 144, and his challenge pushed others
            to say which books they did accept.
          </li>
          <li>
            The <strong className="text-ink">Muratorian fragment</strong> (often dated to the late 2nd century, though some
            scholars place it in the 4th) lists most of today&rsquo;s New Testament, adds the Wisdom of Solomon and the Apocalypse
            of Peter, and says the Shepherd of Hermas may be read privately but not in church.
          </li>
          <li>
            <strong className="text-ink">Eusebius</strong> (about 325) sorted books into accepted, disputed (James, Jude, 2 Peter,
            2–3 John; he was unsure about Revelation) and rejected.
          </li>
          <li>
            <strong className="text-ink">Athanasius</strong>&rsquo;s Easter letter of 367 is the first known list of exactly the 27
            books of today&rsquo;s New Testament. Councils at <strong className="text-ink">Hippo (393)</strong> and{" "}
            <strong className="text-ink">Carthage (397)</strong> approved a list that also included the deuterocanonical books.
          </li>
        </ul>
        <p>
          Some books stayed popular for a long time without making the final list: the Shepherd of Hermas and the Epistle of
          Barnabas are bound into Codex Sinaiticus, and 1 and 2 Clement into Codex Alexandrinus (4th and 5th century). Others
          were rejected as late or as teaching something different, such as the Gospel of Peter and the many Gnostic gospels; a
          library of mostly Gnostic texts, including the Gospel of Thomas, was found at Nag Hammadi in Egypt in 1945. Jerome, translating
          the Bible into Latin (382–405), preferred the Hebrew list for the Old Testament but translated some of the extra books
          anyway, and the Latin church kept them.
        </p>
      </>
    ),
  },
  {
    id: "creeds",
    title: "5. Creeds, councils, and who was called a heretic",
    body: (
      <>
        <p>
          &ldquo;Heresy&rdquo; comes from a Greek word for a choice or a faction. In early Christianity it came to mean a teaching
          that the main body of bishops judged false. The labels come from the side that prevailed, which held it was keeping the
          apostles&rsquo; teaching; the groups themselves usually saw their own teaching as the true faith, and much of what we know about them comes from their opponents.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Gnostic</strong> groups (2nd century) taught salvation through secret knowledge and often
            saw the material world as the work of a lesser god. Irenaeus wrote <em>Against Heresies</em> (about 180) against them.
          </li>
          <li>
            <strong className="text-ink">Montanism</strong> (mid-2nd century) followed new prophecies said to come from the Holy
            Spirit; it was rejected by most bishops.
          </li>
          <li>
            <strong className="text-ink">Arius</strong>, a priest in Alexandria, taught that the Son was created by the Father.
            The emperor Constantine called the <strong className="text-ink">Council of Nicaea (325)</strong>, which condemned this
            and wrote the Nicene Creed (&ldquo;of one substance with the Father&rdquo;). The debate went on for decades; the{" "}
            <strong className="text-ink">Council of Constantinople (381)</strong> expanded the creed, including on the Holy Spirit.
          </li>
          <li>
            <strong className="text-ink">Nestorius</strong>, Patriarch of Constantinople, objected to calling Mary
            &ldquo;Mother of God&rdquo; (Theotokos) and preferred &ldquo;Mother of Christ&rdquo;; his opponents said he split
            Christ in two, which he denied. The <strong className="text-ink">Council of Ephesus (431)</strong> condemned him. The
            Church of the East in Persia, already self-governing, did not accept the council (it is often, though not by itself,
            called &ldquo;Nestorian&rdquo;).
          </li>
          <li>
            The <strong className="text-ink">Council of Chalcedon (451)</strong> defined Christ as one person in two natures, divine
            and human. The Coptic, Ethiopian, Armenian and Syriac churches did not accept its wording; today they are called the{" "}
            <strong className="text-ink">Oriental Orthodox</strong> churches (their opponents called them &ldquo;Monophysite&rdquo;,
            a name they reject).
          </li>
        </ul>
        <p>
          Once emperors backed the church (from Constantine on), condemnation could carry state penalties: exile, burned books, loss
          of churches. In the Middle Ages the Western church set up inquisitions against groups such as the Cathars (against whom
          a crusade was launched in 1209), and reformers like Jan Hus were executed (1415).
        </p>
      </>
    ),
  },
  {
    id: "rome",
    title: "6. Bishops, Rome and the word “catholic”",
    body: (
      <>
        <p>
          The early churches were led by bishops in each city. &ldquo;Catholic&rdquo; (Greek for &ldquo;universal&rdquo;) is
          first found for the whole church in a letter of Ignatius of Antioch (about 110). In 313 Constantine and Licinius allowed
          Christianity across the Empire, and in 380 Theodosius made Nicene Christianity its official religion.
        </p>
        <p>
          Five great sees came to lead the church: Rome, Constantinople, Alexandria, Antioch and Jerusalem. Rome held first
          place as the church of Peter and Paul. Catholics hold that its bishop, the pope, as Peter&rsquo;s successor, has
          authority over the whole church; the Eastern churches gave Rome a primacy of honour but not that authority. This difference, more than any one event, is behind
          the later split.
        </p>
      </>
    ),
  },
  {
    id: "schism",
    title: "7. East and West: the schism of 1054",
    body: (
      <>
        <p>
          The Greek East and the Latin West drifted apart over centuries: in language, in customs, and over two big questions,
          the authority of the pope and the <em>filioque</em>, the words &ldquo;and the Son&rdquo; added in the West to the creed
          (that the Holy Spirit proceeds from the Father &ldquo;and the Son&rdquo;; first at Toledo in 589, in Rome&rsquo;s own
          creed from 1014).
        </p>
        <p>
          In <strong className="text-ink">1054</strong> the papal legate Cardinal Humbert and Patriarch Michael Cerularius of
          Constantinople excommunicated each other. It was not seen as final at the time, but the sack of Constantinople by the
          Fourth Crusade in <strong className="text-ink">1204</strong> made the break bitter. The Roman Catholic and Eastern
          Orthodox churches have been separate since; in <strong className="text-ink">1965</strong> Pope Paul VI and Patriarch
          Athenagoras lifted the excommunications of 1054.
        </p>
      </>
    ),
  },
  {
    id: "reformation",
    title: "8. The Reformation and its branches",
    body: (
      <>
        <p>
          Calls for reform came long before 1517: John Wycliffe in England (who died in 1384, and whose followers made the first
          complete English Bible) and Jan Hus in Bohemia. In <strong className="text-ink">1517</strong> Martin Luther&rsquo;s
          Ninety-five Theses against the sale of indulgences started the Protestant Reformation. Its watchwords included
          &ldquo;scripture alone&rdquo; (<em>sola scriptura</em>) as the final authority. Printing (the Gutenberg Bible, about
          1455) let Bibles and pamphlets in the people&rsquo;s own languages spread fast.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Lutherans</strong>: Luther&rsquo;s complete German Bible (1534) moved the deuterocanonical
            books into a separate section, &ldquo;Apocrypha&rdquo;, as useful to read but not equal to scripture.
          </li>
          <li>
            <strong className="text-ink">Reformed</strong> churches: Zwingli in Zurich, then Calvin in Geneva; later the
            Presbyterians. The Westminster Confession (1646) lists the 66 books and leaves the Apocrypha out.
          </li>
          <li>
            <strong className="text-ink">Anabaptists</strong> (from 1525): baptism for believers only; persecuted by Catholics and
            Protestants alike. The Mennonites and the Amish come from them.
          </li>
          <li>
            <strong className="text-ink">Church of England</strong>: Henry VIII&rsquo;s Act of Supremacy (1534) broke with Rome.
            The King James Version (1611) printed the Apocrypha between the Testaments; many later printings dropped it.
          </li>
        </ul>
        <p>
          The Catholic Church answered with the <strong className="text-ink">Council of Trent (1545–1563)</strong>, which in 1546
          confirmed the full list of 73 books, the deuterocanon included, as scripture (the same list the Council of Florence had
          given in 1442). Later movements (Baptists, Methodists and
          many more) grew from the Protestant branches.
        </p>
      </>
    ),
  },
  {
    id: "today",
    title: "9. One Bible, several canons",
    body: (
      <>
        <p>
          The result is that &ldquo;the Bible&rdquo; is not the same list everywhere. Protestant Bibles have{" "}
          <strong className="text-ink">66</strong> books; Catholic Bibles <strong className="text-ink">73</strong>; Eastern
          Orthodox Bibles add a few more (such as 1 Esdras, 3 Maccabees, the Prayer of Manasseh and Psalm 151); and the Ethiopian
          Orthodox canon is the widest of all, including 1 Enoch and Jubilees. The Hebrew Bible has the same books as the
          Protestant Old Testament, in a different order and counted as 24 rather than 39.
        </p>
      </>
    ),
  },
];

/**
 * "How the Bible came to be" (ticket 030f0951, the brother's idea, Nov 12): a neutral overview of how the canon
 * formed, which texts were accepted or rejected, the creeds and councils, how groups were judged heretical, and the
 * splits (451, 1054, the Reformation, Trent), with a timeline. A tile on the home page. Written with AI and
 * fact-checked (fable-reviewer); labelled on the page. Phase 4 of ROADMAP TX goes deeper (texts, sources).
 */
export default function BibleHistoryPage() {
  if (SITE_SIDE !== "scriptures") permanentRedirect(`${ORIGINS.scriptures}/bible-history`); // a Verses Across page
  return (
    <main className="h-app overflow-y-auto bg-paper text-muted">
      <div className="mx-auto max-w-3xl space-y-8 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-3">
          <Link href="/read" className={`text-sm ${a}`}>
            ← Home
          </Link>
          <h1 className="font-serif text-3xl font-semibold text-ink">How the Bible came to be</h1>
          <p>
            How a library of scrolls written over a thousand years became the Bible, which books were accepted, debated or left
            out, and how disagreements over books and beliefs shaped, and split, the churches.
          </p>
          <p className="text-xs text-faint">
            Written with AI (Claude) from standard reference works and checked for accuracy; it describes what happened and what
            each side held, without taking sides. Dates are approximate where marked &ldquo;about&rdquo; or &ldquo;c.&rdquo;
            Scholars still debate many of them. Spotted a mistake? Send feedback from the home page.
          </p>
          <nav aria-label="On this page" className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <a href="#timeline" className={a}>
              Timeline
            </a>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={a}>
                {s.title.replace(/^\d+\.\s*/, "").split(":")[0]}
              </a>
            ))}
          </nav>
        </header>

        <section id="timeline" aria-labelledby="timeline-h" className="scroll-mt-4 space-y-2">
          <h2 id="timeline-h" className="font-serif text-xl font-semibold text-ink">
            Timeline
          </h2>
          <ol className="divide-y divide-line rounded-xl border border-line bg-panel">
            {TIMELINE.map(([when, what]) => (
              <li key={when + what} className="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2 text-sm sm:grid-cols-[9rem_1fr]">
                <span className="font-medium tabular-nums text-ink">{when}</span>
                <span>{what}</span>
              </li>
            ))}
          </ol>
        </section>

        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-4 space-y-3">
            <h2 id={`${s.id}-h`} className="font-serif text-xl font-semibold text-ink">
              {s.title}
            </h2>
            {s.body}
          </section>
        ))}

        <footer className="border-t border-line pt-4 text-sm">
          Next on the roadmap: pages on the manuscripts themselves (the Dead Sea Scrolls, Sinaiticus, Vaticanus and more) and the
          books that didn&rsquo;t make it in. Also see{" "}
          <Link href="/differences" className={a}>
            Why Bibles differ
          </Link>{" "}
          and{" "}
          <Link href="/coming-soon" className={a}>
            Coming soon
          </Link>
          .
        </footer>
      </div>
    </main>
  );
}
