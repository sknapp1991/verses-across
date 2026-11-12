import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import Link from "next/link";
import { FeedbackButton } from "@/components/feedback-dialog";

export const metadata: Metadata = {
  title: "What's new",
  description: `What changed on ${SITE_NAME}, week by week: new books and traditions, reading features, search and study tools.`,
  alternates: { canonical: "/whats-new" },
};

/**
 * "What's new" (HB4, release notes): what shipped, week by week, in plain words for readers (and Play reviewers).
 * Only things a reader can see: no team tools, no names. Newest week first; add a week at the top as things ship
 * (the hub's Shipped tab has the full list of changes).
 */
const WEEKS: { week: string; items: string[] }[] = [
  {
    week: "Week of November 9",
    items: [
      "Why Bibles differ: the New Testament verses some Bibles leave out (Matthew 17:21, Acts 8:37…) and the passages they split on (the end of Mark, John 7:53–8:11, 1 John 5:7), the KJV, WEB and ASV side by side with a short note on why. A small mark under those verses in the reader links there.",
      "Themes: 67 scripture themes (forgiveness, the flood, exile, mercy, death…), each traced across every tradition, side by side, and 44 story themes on Library Across (coming of age, revenge, voyages at sea, ghosts…) with the books that carry each one most. A verse or paragraph that is one of a theme's strongest passages shows it in Cross references.",
      "The classic books (Literature, Freethought and Psychology) now have their own site, Library Across (libraryacross.com), and Verses Across keeps the world's scriptures. Old links to a book go straight to it on the right site, and your places, highlights and notes come along.",
      "Private mode (Display options, Privacy): one switch and nothing leaves your device. Ask AI, the feedback form, anonymous reading counts, sync and study groups stay off until you switch Private mode off.",
      "Smoother on iPhone and iPad: no zooming in when you tap a text box, menus and panels that fit the screen, and a fix for older iPhones where a chapter could fail to show.",
      "On Library Across, search every book at once: which books mention a whale, a lighthouse or a dragon, with the chapters to open.",
      "At the end of a book on Library Across, “If you liked this…” suggests the books most like it.",
      "A thin progress bar shows how far you are through a chapter, with the minutes left. Books on Library Across read as one long scroll.",
      "Cross references now link books to books, and scriptures to the closest passages in the classic books.",
      "Thousands of small leftovers in the books tidied (stray underscores, margin notes, picture captions, accents), and 50 long book names shortened.",
      "The tour has two new steps: the two sites, and what's coming next.",
    ],
  },
  {
    week: "Week of November 2",
    items: [
      "Literature: over 1,000 public-domain novels, poems, plays, children's books and non-fiction, with search inside every book.",
      "Freethought: 39 public-domain books in six shelves.",
      "The I Ching, all 64 hexagrams, in James Legge's 1882 translation.",
      "Words mode: pronunciations for Hebrew, Arabic and Chinese words, and Russian, Greek, Hebrew and Arabic words letter by letter.",
      "Ask AI: an “In depth” switch for longer answers.",
      "“Studied it again” for chapters you re-read, with re-reading badges.",
      "Progress, goals, badges, sync codes and study groups.",
      "Offline downloads: keep chosen languages and versions on your device, with their recorded audio.",
      "A guided tour, continuous scroll into the next chapter, red-letter words of Jesus, and word lookup in nine languages.",
      "A “Send feedback” form in the menu, About and every verse's menu.",
      "Many new texts: the Quran, Tanakh, Mishnah, Talmud, Hadith, the Pali Canon, the Vedas, Upanishads, Ramayana, Mahabharata, Bhagavad Gita and more.",
      "Read-along with recorded voices that keep playing with the screen off.",
    ],
  },
];

const a = "underline underline-offset-2 hover:text-ink";

export default function WhatsNewPage() {
  return (
    <main className="h-app overflow-y-auto bg-paper text-muted">
      <div className="mx-auto max-w-2xl space-y-8 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-3">
          <Link href="/" className={`text-sm ${a}`}>
            ← Back to reading
          </Link>
          <h1 className="font-serif text-3xl font-semibold text-ink">What&rsquo;s new</h1>
          <p>
            What changed on {SITE_NAME}, week by week. For what&rsquo;s planned next, see{" "}
            <Link href="/coming-soon" className={a}>
              Coming soon
            </Link>
            .
          </p>
        </header>

        {WEEKS.map((w) => (
          <section key={w.week} className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-ink">{w.week}</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              {w.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        ))}

        <p className="text-sm">
          Spotted a problem or have an idea? <FeedbackButton className={a}>Tell us</FeedbackButton>.
        </p>
      </div>
    </main>
  );
}
