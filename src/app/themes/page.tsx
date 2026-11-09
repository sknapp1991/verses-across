import type { Metadata } from "next";
import Link from "next/link";
import index from "../../../public/themes/index.json";
import type { ThemeSummary } from "@/lib/themes";

export const metadata: Metadata = {
  title: "Themes",
  description: "Forgiveness, the flood, exile, mercy, death and 60 more themes, traced across the world's scriptures and the Library's books, side by side.",
  alternates: { canonical: "/themes" },
};

const THEMES = index as ThemeSummary[];
const a = "underline underline-offset-2 hover:text-ink";

/**
 * Themes (TH): one theme across every tradition and book (public/themes/, scripts/themes/build.py).
 * The list, grouped; each theme opens /themes/<id>.
 */
export default function ThemesPage() {
  const groups = [...new Set(THEMES.map((t) => t.group))];
  return (
    <main className="h-dvh overflow-y-auto bg-paper text-muted">
      <div className="mx-auto max-w-3xl space-y-8 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-3">
          <Link href="/" className={`text-sm ${a}`}>
            ← Back to reading
          </Link>
          <h1 className="font-serif text-3xl font-semibold text-ink">Themes</h1>
          <p>
            One theme, every tradition: the passages that speak most closely to it in each scripture, side by side, and the
            Library&rsquo;s books that echo it. Study guides, quizzes and lesson plans built on these are{" "}
            <Link href="/coming-soon" className={a}>
              coming
            </Link>
            .
          </p>
          <p className="text-xs text-faint">
            The passages are found by comparing meaning (the same method as the cross references), not chosen by hand, so
            some will fit better than others. Each theme&rsquo;s one-line description was written with AI.
          </p>
        </header>
        {groups.map((g) => (
          <section key={g} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-faint">{g}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {THEMES.filter((t) => t.group === g).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/themes/${t.id}`}
                    className="flex h-full flex-col gap-1 rounded-xl border border-line px-4 py-3 hover:border-accent"
                  >
                    <span className="font-serif text-lg font-semibold text-ink">{t.name}</span>
                    <span className="text-sm">{t.text}</span>
                    <span className="text-xs text-faint">
                      {t.traditions} traditions · {t.books} books
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
