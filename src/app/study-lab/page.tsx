import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";

/**
 * The study lab (my brother's ticket 7a62bb28, Nov 26): the hidden study layers in one place, for him for now. Not
 * linked from anywhere, not in the sitemap, not indexed.
 */
export const metadata: Metadata = {
  title: "Study lab",
  description: "Deeper ways into the texts.",
  robots: { index: false, follow: false },
};

const LAYERS = [
  { href: "/aleph-alpha-alif", title: "Letters as numbers", note: "Hebrew, Greek and Arabic letters as numbers: strands, circles, a score and puzzles, and the Bible verses as tones." },
  { href: "/word-journeys", title: "Word journeys", note: "Follow one Hebrew or Greek word through the whole Bible: every place it appears." },
  { href: "/translation-lab", title: "Translation lab", note: "One verse in many translations, the differences highlighted, and the original word by word." },
  { href: "/learn-alphabets", title: "Learn the alphabets", note: "Hebrew, Greek and Arabic letters in short lessons, ending with reading a first verse yourself." },
  { href: "/study-paths", title: "Study paths", note: "Guided four-week courses across traditions, with a question to reflect on each day." },
  { href: "/speed-reader", title: "Speed reader", note: "One word at a time, at the pace you choose, from slow to very fast." },
  { href: "/memorize", title: "Memorize", note: "Learn verses by heart with gentle repetition, first-letter hints and, if you like, the original language." },
  { href: "/literary-shape", title: "Literary shape", note: "The hidden structure of passages: acrostics, parallel lines and mirrored stories." },
  { href: "/slow-reading", title: "Slow reading", note: "One short passage, read slowly several times, with quiet prompts and a private journal." },
];

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return (
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Study lab</p>
          <h1 className="font-serif text-3xl font-semibold text-ink">Deeper ways in</h1>
          <p className="text-muted">Study layers being tried out before they join the site. Only people with this address see them.</p>
        </header>
        <ul className="space-y-3">
          {LAYERS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="block rounded-2xl border border-line bg-panel p-4 hover:bg-raised">
                <span className="block font-serif text-xl font-semibold text-ink">{l.title} →</span>
                <span className="mt-1 block text-sm text-muted">{l.note}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-faint">
          <Link href="/" className="text-accent hover:underline">
            Verses Across
          </Link>
        </p>
      </div>
    </main>
  );
}
